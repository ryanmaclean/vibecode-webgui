# Troubleshooting Guide

**Document Owner**: SRE Team
**Last Updated**: 2025-10-02
**Version**: 1.0.0
**Audience**: Production Operators, SREs, On-Call Engineers

## Table of Contents

1. [Common Issues by Component](#common-issues-by-component)
2. [Log Analysis](#log-analysis)
3. [Performance Debugging](#performance-debugging)
4. [Network Troubleshooting](#network-troubleshooting)
5. [Container Debugging](#container-debugging)
6. [Database Issues](#database-issues)
7. [Security Incidents](#security-incidents)

---

## Common Issues by Component

### Application (Next.js WebGUI)

#### Issue: Application Pods CrashLooping

**Symptoms**:
- Pods repeatedly restarting
- Status: `CrashLoopBackOff` or `Error`
- Users unable to access application

**Diagnosis**:
```bash
# Check pod status
kubectl get pods -n vibecode -l app=vibecode-webgui

# View recent logs
kubectl logs -n vibecode -l app=vibecode-webgui --tail=100

# Check pod events
kubectl describe pod -n vibecode <pod-name> | grep -A 10 Events
```

**Common Causes and Solutions**:

1. **Missing Environment Variables**
   ```bash
   # Check configmap
   kubectl get configmap -n vibecode vibecode-config -o yaml

   # Check secrets
   kubectl get secret -n vibecode vibecode-secrets -o yaml

   # Solution: Update missing variables
   kubectl edit configmap vibecode-config -n vibecode
   ```

2. **Database Connection Failure**
   ```bash
   # Test database connectivity
   kubectl exec -n vibecode <pod-name> -- nc -zv postgres 5432

   # Check database password
   kubectl get secret -n vibecode postgres-credentials -o jsonpath='{.data.password}' | base64 -d

   # Solution: Verify database service
   kubectl get svc -n vibecode postgres
   kubectl get pods -n vibecode -l app=postgres
   ```

3. **Out of Memory (OOMKilled)**
   ```bash
   # Check OOMKilled status
   kubectl get pods -n vibecode -o json | jq -r '.items[] | select(.status.containerStatuses[].lastState.terminated.reason=="OOMKilled") | .metadata.name'

   # Solution: Increase memory limits
   kubectl set resources deployment vibecode-webgui -n vibecode --limits=memory=4Gi
   ```

4. **Port Already in Use**
   ```bash
   # Check port conflicts
   kubectl logs -n vibecode <pod-name> | grep "EADDRINUSE"

   # Solution: Verify service configuration
   kubectl get svc vibecode-webgui -n vibecode -o yaml
   ```

**Resolution Steps**:
```bash
# 1. Fix underlying issue (see above)

# 2. Delete crashing pods (will be recreated)
kubectl delete pod -n vibecode -l app=vibecode-webgui

# 3. Monitor rollout
kubectl rollout status deployment vibecode-webgui -n vibecode

# 4. Verify health
kubectl get pods -n vibecode -l app=vibecode-webgui
curl -f https://vibecode.eastus2.cloudapp.azure.com/api/health
```

---

#### Issue: High Response Time / Slow Performance

**Symptoms**:
- API responses >2 seconds
- Users reporting slow page loads
- Datadog P95 latency >1000ms

**Diagnosis**:
```bash
# Check current latency
curl -s "https://vibecode.eastus2.cloudapp.azure.com/api/monitoring/metrics" | jq '.response_time_p95'

# View slow requests in Datadog
open "https://app.datadoghq.com/apm/traces?query=service:vibecode @duration:>1000"

# Check pod resource usage
kubectl top pods -n vibecode -l app=vibecode-webgui
```

**Common Causes and Solutions**:

1. **CPU Throttling**
   ```bash
   # Check CPU usage
   kubectl top pods -n vibecode | grep vibecode-webgui

   # Check if hitting limits
   kubectl describe pod -n vibecode <pod-name> | grep -A 5 "Limits"

   # Solution: Scale up or increase CPU limits
   kubectl scale deployment vibecode-webgui -n vibecode --replicas=10
   # OR
   kubectl set resources deployment vibecode-webgui -n vibecode --limits=cpu=2000m
   ```

2. **Database Slow Queries**
   ```bash
   # Check slow queries
   kubectl exec -n vibecode postgres-0 -- psql -U vibecode -d vibecode_db <<EOF
   SELECT query, calls, mean_exec_time, max_exec_time
   FROM pg_stat_statements
   WHERE mean_exec_time > 100
   ORDER BY mean_exec_time DESC
   LIMIT 10;
   EOF

   # Solution: Add indexes or optimize queries
   kubectl exec -n vibecode postgres-0 -- psql -U vibecode -d vibecode_db -c "
   CREATE INDEX CONCURRENTLY idx_workspaces_user_id ON workspaces(user_id);
   "
   ```

3. **Redis Cache Miss Rate High**
   ```bash
   # Check cache hit rate
   kubectl exec -n vibecode redis-0 -- redis-cli INFO stats | grep keyspace

   # Solution: Increase cache TTL or memory
   kubectl exec -n vibecode redis-0 -- redis-cli CONFIG SET maxmemory 2gb
   ```

4. **External API Timeouts**
   ```bash
   # Check for timeout errors
   kubectl logs -n vibecode -l app=vibecode-webgui | grep -E "(timeout|ETIMEDOUT)"

   # Solution: Implement circuit breaker and retries
   # (Application code change required)
   ```

**Resolution Steps**:
```bash
# 1. Identify bottleneck using Datadog APM
open "https://app.datadoghq.com/apm/services/vibecode"

# 2. Apply appropriate fix from above

# 3. Monitor improvement
watch -n 5 'curl -s "https://vibecode.eastus2.cloudapp.azure.com/api/monitoring/metrics" | jq ".response_time_p95"'

# 4. If no improvement, escalate to engineering team
```

---

#### Issue: Authentication Failures

**Symptoms**:
- Users unable to log in
- 401 Unauthorized errors
- Session token errors

**Diagnosis**:
```bash
# Check auth service logs
kubectl logs -n vibecode -l app=vibecode-webgui | grep -E "(auth|login|token)"

# Check Redis (session store)
kubectl exec -n vibecode redis-0 -- redis-cli ping

# Test authentication endpoint
curl -X POST https://vibecode.eastus2.cloudapp.azure.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test"}' -v
```

**Common Causes and Solutions**:

1. **JWT Secret Misconfigured**
   ```bash
   # Check JWT secret exists
   kubectl get secret -n vibecode vibecode-secrets -o jsonpath='{.data.jwt-secret}' | base64 -d

   # Solution: Regenerate and update secret
   new_secret=$(openssl rand -hex 32)
   kubectl patch secret vibecode-secrets -n vibecode --type='json' -p="[{\"op\":\"replace\",\"path\":\"/data/jwt-secret\",\"value\":\"$(echo -n $new_secret | base64)\"}]"

   # Restart pods to pick up new secret
   kubectl rollout restart deployment vibecode-webgui -n vibecode
   ```

2. **Redis Session Store Down**
   ```bash
   # Check Redis health
   kubectl get pods -n vibecode -l app=redis
   kubectl logs -n vibecode redis-0 --tail=50

   # Solution: Restart Redis if unhealthy
   kubectl rollout restart statefulset redis -n vibecode
   ```

3. **Database User Table Locked**
   ```bash
   # Check for locks
   kubectl exec -n vibecode postgres-0 -- psql -U vibecode -d vibecode_db -c "
   SELECT pid, usename, query, state
   FROM pg_stat_activity
   WHERE query LIKE '%users%' AND state = 'active';
   "

   # Solution: Kill blocking queries
   kubectl exec -n vibecode postgres-0 -- psql -U vibecode -d vibecode_db -c "
   SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'active' AND query LIKE '%users%';
   "
   ```

4. **Clock Skew (Token Expiration)**
   ```bash
   # Check time synchronization
   kubectl exec -n vibecode <pod-name> -- date
   date

   # Solution: Restart NTP service on nodes
   kubectl get nodes -o json | jq -r '.items[].metadata.name' | xargs -I {} kubectl debug {} -it --image=alpine -- sh -c 'ntpd -q -p pool.ntp.org'
   ```

---

### Agent API

#### Issue: Agent API Not Responding

**Symptoms**:
- Workspace creation fails
- Agent commands timeout
- 503 Service Unavailable

**Diagnosis**:
```bash
# Check AgentAPI pod status
kubectl get pods -n vibecode -l app=agentapi

# Check logs
kubectl logs -n vibecode -l app=agentapi --tail=100

# Test health endpoint
curl -f http://agentapi.vibecode.svc.cluster.local:3284/health
```

**Common Causes and Solutions**:

1. **Python Process Hung**
   ```bash
   # Check process status
   kubectl exec -n vibecode <agentapi-pod> -- ps aux

   # Solution: Restart pod
   kubectl delete pod -n vibecode <agentapi-pod>
   ```

2. **Too Many Concurrent Agents**
   ```bash
   # Check agent count
   kubectl logs -n vibecode <agentapi-pod> | grep "active agents"

   # Solution: Increase max concurrent agents
   kubectl set env deployment agentapi -n vibecode AGENTAPI_MAX_CONCURRENT_AGENTS=5
   ```

3. **Disk Space Full**
   ```bash
   # Check disk usage
   kubectl exec -n vibecode <agentapi-pod> -- df -h

   # Solution: Clean up temporary files
   kubectl exec -n vibecode <agentapi-pod> -- sh -c 'find /tmp/terminals -mtime +1 -delete'
   ```

---

### Database (PostgreSQL)

#### Issue: Database Connection Pool Exhausted

**Symptoms**:
- "too many connections" errors
- Connection timeouts
- Application cannot access database

**Diagnosis**:
```bash
# Check current connections
kubectl exec -n vibecode postgres-0 -- psql -U vibecode -c "
SELECT count(*), state, usename
FROM pg_stat_activity
GROUP BY state, usename;
"

# Check max connections setting
kubectl exec -n vibecode postgres-0 -- psql -U vibecode -c "SHOW max_connections;"
```

**Resolution**:
```bash
# 1. Kill idle connections
kubectl exec -n vibecode postgres-0 -- psql -U vibecode -c "
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle'
  AND state_change < now() - interval '5 minutes'
  AND usename != 'postgres';
"

# 2. Increase max connections (temporary)
kubectl exec -n vibecode postgres-0 -- psql -U vibecode -c "ALTER SYSTEM SET max_connections = 300;"
kubectl exec -n vibecode postgres-0 -- psql -U vibecode -c "SELECT pg_reload_conf();"

# 3. Increase application connection pool limits
kubectl set env deployment vibecode-webgui -n vibecode DATABASE_POOL_MAX=50

# 4. Restart application
kubectl rollout restart deployment vibecode-webgui -n vibecode

# 5. Monitor connection count
watch -n 5 'kubectl exec -n vibecode postgres-0 -- psql -U vibecode -t -c "SELECT count(*) FROM pg_stat_activity;"'
```

---

#### Issue: Database Replication Lag

**Symptoms**:
- Read queries returning stale data
- Replication lag alerts

**Diagnosis**:
```bash
# Check replication status
kubectl exec -n vibecode postgres-0 -- psql -U vibecode -c "
SELECT client_addr, state, sync_state, replay_lag
FROM pg_stat_replication;
"

# Check replication lag in bytes
kubectl exec -n vibecode postgres-0 -- psql -U vibecode -c "
SELECT pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn) AS lag_bytes
FROM pg_stat_replication;
"
```

**Resolution**:
```bash
# 1. Check network connectivity to replica
kubectl exec -n vibecode postgres-0 -- nc -zv postgres-read-0 5432

# 2. Check replica disk space
kubectl exec -n vibecode postgres-read-0 -- df -h /var/lib/postgresql/data

# 3. If lag >100MB, consider restarting replication
kubectl exec -n vibecode postgres-read-0 -- pg_ctl restart

# 4. Monitor lag reduction
watch -n 10 'kubectl exec -n vibecode postgres-0 -- psql -U vibecode -t -c "SELECT pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn) FROM pg_stat_replication;"'
```

---

### Redis

#### Issue: Redis Memory Eviction / OOM

**Symptoms**:
- Cache miss rate increased
- Session loss
- Redis eviction alerts

**Diagnosis**:
```bash
# Check memory usage
kubectl exec -n vibecode redis-0 -- redis-cli INFO memory

# Check eviction stats
kubectl exec -n vibecode redis-0 -- redis-cli INFO stats | grep evicted_keys
```

**Resolution**:
```bash
# 1. Check memory limit
kubectl get pod -n vibecode redis-0 -o jsonpath='{.spec.containers[0].resources.limits.memory}'

# 2. Increase memory limit
kubectl set resources statefulset redis -n vibecode --limits=memory=4Gi

# 3. Change eviction policy (if appropriate)
kubectl exec -n vibecode redis-0 -- redis-cli CONFIG SET maxmemory-policy allkeys-lru

# 4. Flush old keys (last resort)
kubectl exec -n vibecode redis-0 -- redis-cli --scan --pattern "session:*" | head -1000 | xargs kubectl exec -n vibecode redis-0 -- redis-cli DEL
```

---

## Log Analysis

### Application Logs

**Access Logs**:
```bash
# Stream application logs
kubectl logs -n vibecode -l app=vibecode-webgui -f

# Filter by level
kubectl logs -n vibecode -l app=vibecode-webgui --tail=1000 | grep ERROR

# Search for specific user
kubectl logs -n vibecode -l app=vibecode-webgui | grep "user_id:12345"

# Count errors by type
kubectl logs -n vibecode -l app=vibecode-webgui --since=1h | \
  grep ERROR | \
  awk '{print $5}' | \
  sort | uniq -c | sort -rn
```

**Structured Log Queries** (Datadog):
```
# Authentication errors
service:vibecode status:error @error.kind:AuthenticationError

# Database errors
service:vibecode @error.kind:DatabaseError @error.message:*connection*

# Slow requests
service:vibecode @http.duration:>1000 @http.url_details.path:*

# User-specific errors
service:vibecode status:error @user.id:12345

# Aggregate errors by endpoint
service:vibecode status:error | group by @http.route
```

### Database Logs

**PostgreSQL Logs**:
```bash
# View database logs
kubectl logs -n vibecode postgres-0 --tail=100

# Find slow queries (>1s)
kubectl logs -n vibecode postgres-0 | grep "duration:" | awk '$6 > 1000'

# Connection errors
kubectl logs -n vibecode postgres-0 | grep -E "(FATAL|ERROR)" | tail -50

# Deadlock detection
kubectl logs -n vibecode postgres-0 | grep deadlock
```

**Query Analysis**:
```bash
# Show running queries
kubectl exec -n vibecode postgres-0 -- psql -U vibecode -d vibecode_db -c "
SELECT pid, usename, application_name, state, query, now() - query_start AS duration
FROM pg_stat_activity
WHERE state != 'idle'
ORDER BY duration DESC;
"

# Show slow query stats
kubectl exec -n vibecode postgres-0 -- psql -U vibecode -d vibecode_db -c "
SELECT query, calls, total_exec_time, mean_exec_time, max_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 20;
"
```

### System Logs

**Node Logs**:
```bash
# Get node system logs
kubectl debug node/<node-name> -it --image=alpine -- sh -c '
  chroot /host
  journalctl -u kubelet --since "1 hour ago" | tail -100
'

# Check for OOM events
kubectl debug node/<node-name> -it --image=alpine -- sh -c '
  chroot /host
  dmesg | grep -i "out of memory"
'
```

**Kubernetes Events**:
```bash
# View recent events
kubectl get events -n vibecode --sort-by='.lastTimestamp' | tail -50

# Filter warning events
kubectl get events -n vibecode --field-selector type=Warning

# Pod-specific events
kubectl describe pod -n vibecode <pod-name> | grep -A 20 Events
```

---

## Performance Debugging

### CPU Profiling

**Identify CPU Bottlenecks**:
```bash
# Check current CPU usage
kubectl top pods -n vibecode --sort-by=cpu

# Profile specific pod (Node.js)
kubectl exec -n vibecode <pod-name> -- node --prof app.js

# Generate flame graph
kubectl cp <pod-name>:/tmp/isolate-*.log ./profile.log
node --prof-process profile.log > processed.txt
```

**CPU Throttling Detection**:
```bash
# Check if pod is being throttled
kubectl get pod -n vibecode <pod-name> -o jsonpath='{.spec.containers[0].resources}' | jq '.'

# View CPU metrics
curl -s "http://localhost:9090/api/v1/query?query=rate(container_cpu_usage_seconds_total{pod=\"<pod-name>\"}[5m])" | jq '.'
```

### Memory Profiling

**Memory Leak Detection**:
```bash
# Check memory trend over time
kubectl top pod -n vibecode <pod-name> --no-headers | awk '{print $3}' > memory.txt

# Take heap snapshot (Node.js)
kubectl exec -n vibecode <pod-name> -- kill -USR2 1

# Download heap snapshot
kubectl cp <pod-name>:/tmp/heapsnapshot-*.heapsnapshot ./heap.heapsnapshot

# Analyze with Chrome DevTools
open -a "Google Chrome" heap.heapsnapshot
```

**Memory Pressure Detection**:
```bash
# Check for memory pressure on nodes
kubectl describe nodes | grep -A 5 "MemoryPressure"

# Check container memory usage vs limits
kubectl get pods -n vibecode -o json | jq -r '
  .items[] |
  {
    name: .metadata.name,
    mem_request: .spec.containers[0].resources.requests.memory,
    mem_limit: .spec.containers[0].resources.limits.memory,
    mem_usage: .status.containerStatuses[0].usage.memory
  }
'
```

### Database Performance

**Query Performance Analysis**:
```bash
# Enable query logging
kubectl exec -n vibecode postgres-0 -- psql -U vibecode -c "
ALTER SYSTEM SET log_min_duration_statement = 100;
SELECT pg_reload_conf();
"

# Analyze slow queries
kubectl exec -n vibecode postgres-0 -- psql -U vibecode -d vibecode_db -c "
SELECT query, calls, total_exec_time, mean_exec_time, stddev_exec_time
FROM pg_stat_statements
WHERE mean_exec_time > 100
ORDER BY total_exec_time DESC
LIMIT 20;
"

# EXPLAIN query plan
kubectl exec -n vibecode postgres-0 -- psql -U vibecode -d vibecode_db -c "
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM workspaces WHERE user_id = 123;
"
```

**Index Analysis**:
```bash
# Find missing indexes
kubectl exec -n vibecode postgres-0 -- psql -U vibecode -d vibecode_db -c "
SELECT schemaname, tablename, attname, n_distinct, correlation
FROM pg_stats
WHERE schemaname = 'public'
  AND n_distinct > 100
  AND correlation < 0.1
ORDER BY n_distinct DESC;
"

# Check index usage
kubectl exec -n vibecode postgres-0 -- psql -U vibecode -d vibecode_db -c "
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY pg_relation_size(indexrelid) DESC;
"
```

---

## Network Troubleshooting

### Connectivity Issues

**Test Service Connectivity**:
```bash
# Test from within cluster
kubectl run -it --rm debug --image=alpine --restart=Never -- sh -c '
  apk add curl
  curl -v http://vibecode-webgui.vibecode.svc.cluster.local:3000/api/health
'

# Test DNS resolution
kubectl run -it --rm debug --image=alpine --restart=Never -- sh -c '
  nslookup vibecode-webgui.vibecode.svc.cluster.local
'

# Test network policy
kubectl get networkpolicy -n vibecode
kubectl describe networkpolicy -n vibecode
```

**Ingress Debugging**:
```bash
# Check ingress configuration
kubectl get ingress -n vibecode vibecode -o yaml

# Check ingress controller logs
kubectl logs -n ingress-nginx -l app.kubernetes.io/name=ingress-nginx

# Test ingress connectivity
curl -v https://vibecode.eastus2.cloudapp.azure.com -k
curl -v -H "Host: vibecode.eastus2.cloudapp.azure.com" http://<ingress-ip>
```

### DNS Issues

**DNS Resolution Debugging**:
```bash
# Check CoreDNS pods
kubectl get pods -n kube-system -l k8s-app=kube-dns

# Check CoreDNS logs
kubectl logs -n kube-system -l k8s-app=kube-dns --tail=100

# Test DNS from pod
kubectl exec -it -n vibecode <pod-name> -- nslookup kubernetes.default.svc.cluster.local

# Check service endpoints
kubectl get endpoints -n vibecode vibecode-webgui
```

**DNS Performance**:
```bash
# Measure DNS latency
kubectl run -it --rm debug --image=alpine --restart=Never -- sh -c '
  apk add bind-tools
  time nslookup vibecode-webgui.vibecode.svc.cluster.local
'

# Check DNS cache hit rate
kubectl exec -n kube-system <coredns-pod> -- wget -qO- http://localhost:9153/metrics | grep coredns_cache_hits_total
```

### TLS/Certificate Issues

**Certificate Validation**:
```bash
# Check certificate details
echo | openssl s_client -connect vibecode.eastus2.cloudapp.azure.com:443 -showcerts 2>/dev/null | openssl x509 -noout -text

# Check certificate expiration
echo | openssl s_client -connect vibecode.eastus2.cloudapp.azure.com:443 2>/dev/null | openssl x509 -noout -dates

# Verify certificate chain
echo | openssl s_client -connect vibecode.eastus2.cloudapp.azure.com:443 -showcerts 2>/dev/null
```

**Certificate Manager Debugging**:
```bash
# Check certificate status
kubectl get certificate -n vibecode

# Describe certificate for events
kubectl describe certificate vibecode-tls -n vibecode

# Check certificate request
kubectl get certificaterequest -n vibecode

# Check cert-manager logs
kubectl logs -n cert-manager -l app=cert-manager
```

---

## Container Debugging

### Pod Startup Failures

**ImagePullBackOff**:
```bash
# Check image pull status
kubectl describe pod -n vibecode <pod-name> | grep -A 10 "Events"

# Verify image exists
docker pull ghcr.io/vibecode/webgui:${VERSION}

# Check image pull secret
kubectl get secret -n vibecode regcred -o yaml

# Test image pull
kubectl run test-pull --image=ghcr.io/vibecode/webgui:${VERSION} --rm -it --restart=Never
```

**Init Container Failures**:
```bash
# Check init container logs
kubectl logs -n vibecode <pod-name> -c <init-container-name>

# Skip init container (for debugging)
kubectl debug <pod-name> -it --copy-to=debug-pod --container=<main-container>
```

### Resource Constraints

**Pod Eviction**:
```bash
# Check for evicted pods
kubectl get pods -n vibecode --field-selector=status.phase=Failed

# View eviction reason
kubectl get pods -n vibecode -o json | jq -r '
  .items[] |
  select(.status.reason=="Evicted") |
  {name: .metadata.name, reason: .status.message}
'

# Check node pressure
kubectl describe nodes | grep -E "MemoryPressure|DiskPressure"
```

**Resource Quota Exceeded**:
```bash
# Check resource quotas
kubectl get resourcequota -n vibecode

# Describe quota usage
kubectl describe resourcequota -n vibecode

# Check limit ranges
kubectl get limitrange -n vibecode -o yaml
```

### Container Shell Access

**Debug Running Pod**:
```bash
# Execute bash in running pod
kubectl exec -it -n vibecode <pod-name> -- /bin/bash

# Debug with ephemeral container (if no shell)
kubectl debug -it <pod-name> --image=alpine --target=<container-name>

# Copy files from pod
kubectl cp vibecode/<pod-name>:/tmp/debug.log ./debug.log
```

**Debug Crashed Pod**:
```bash
# View logs of crashed container
kubectl logs -n vibecode <pod-name> --previous

# Create debug copy of pod
kubectl debug <pod-name> -it --copy-to=debug-pod
```

---

## Database Issues

### Connection Errors

**Cannot Connect to Database**:
```bash
# 1. Check database pod status
kubectl get pods -n vibecode -l app=postgres

# 2. Check database service
kubectl get svc -n vibecode postgres

# 3. Test connectivity from app pod
kubectl exec -n vibecode <app-pod> -- nc -zv postgres 5432

# 4. Check database logs
kubectl logs -n vibecode postgres-0 --tail=100

# 5. Verify credentials
kubectl get secret -n vibecode postgres-credentials -o yaml
```

### Performance Degradation

**Slow Queries**:
```bash
# Identify slow queries
kubectl exec -n vibecode postgres-0 -- psql -U vibecode -d vibecode_db -c "
SELECT pid, now() - query_start AS duration, query
FROM pg_stat_activity
WHERE state != 'idle' AND now() - query_start > interval '5 seconds'
ORDER BY duration DESC;
"

# Kill long-running query
kubectl exec -n vibecode postgres-0 -- psql -U vibecode -c "SELECT pg_terminate_backend(<pid>);"
```

**Lock Contention**:
```bash
# Check for locks
kubectl exec -n vibecode postgres-0 -- psql -U vibecode -d vibecode_db -c "
SELECT blocked_locks.pid AS blocked_pid,
       blocked_activity.usename AS blocked_user,
       blocking_locks.pid AS blocking_pid,
       blocking_activity.usename AS blocking_user,
       blocked_activity.query AS blocked_statement,
       blocking_activity.query AS blocking_statement
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;
"
```

### Data Corruption

**Check Database Integrity**:
```bash
# Run vacuum
kubectl exec -n vibecode postgres-0 -- psql -U vibecode -d vibecode_db -c "VACUUM FULL VERBOSE;"

# Check for corruption
kubectl exec -n vibecode postgres-0 -- psql -U vibecode -d vibecode_db -c "
SELECT * FROM pg_stat_database WHERE datname = 'vibecode_db';
"

# Reindex if needed
kubectl exec -n vibecode postgres-0 -- psql -U vibecode -d vibecode_db -c "REINDEX DATABASE vibecode_db;"
```

---

## Security Incidents

### Unauthorized Access Attempts

**Detect Brute Force Attacks**:
```bash
# Check failed login attempts
kubectl logs -n vibecode -l app=vibecode-webgui | grep "authentication failed" | tail -100

# Count failed attempts by IP
kubectl logs -n vibecode -l app=vibecode-webgui | \
  grep "authentication failed" | \
  awk '{print $8}' | \
  sort | uniq -c | sort -rn

# Block IP (temporary)
kubectl exec -n ingress-nginx <ingress-pod> -- sh -c '
  iptables -A INPUT -s <malicious-ip> -j DROP
'
```

### Data Exfiltration

**Detect Unusual Data Access**:
```bash
# Check for large data transfers
kubectl logs -n vibecode -l app=vibecode-webgui | grep "GET /api/workspaces" | awk '$10 > 10000000'

# Monitor outbound traffic
kubectl exec -n vibecode <pod-name> -- tcpdump -i eth0 -w /tmp/capture.pcap

# Analyze with Datadog APM
open "https://app.datadoghq.com/apm/traces?query=service:vibecode @http.response.size:>10000000"
```

### Container Compromise

**Check for Malicious Processes**:
```bash
# List running processes
kubectl exec -n vibecode <pod-name> -- ps aux

# Check for suspicious network connections
kubectl exec -n vibecode <pod-name> -- netstat -tuln

# Inspect file system changes
kubectl exec -n vibecode <pod-name> -- find / -mtime -1 -type f

# If compromised, isolate pod immediately
kubectl label pod <pod-name> quarantine=true
kubectl patch networkpolicy default-deny -n vibecode -p '{"spec":{"podSelector":{"matchLabels":{"quarantine":"true"}}}}'
```

---

## Escalation Procedures

### When to Escalate

**Immediate Escalation** (P1):
- Complete service outage (all users affected)
- Data loss or corruption
- Security breach confirmed
- Database disaster

**1-Hour Escalation** (P2):
- Degraded performance (>50% of users affected)
- Partial feature outage
- High error rate (>5%)
- Capacity issues

**4-Hour Escalation** (P3):
- Individual feature broken
- Intermittent errors
- Non-critical security issue

### Escalation Contacts

1. **Engineering Manager**: [Contact Info]
2. **VP Engineering**: [Contact Info]
3. **Database Administrator**: [Contact Info]
4. **Security Team**: [Contact Info]
5. **Cloud Provider Support**: [Portal]

### Incident Communication Template

```markdown
**Incident: [Brief Description]**

**Severity**: P1 / P2 / P3

**Impact**:
- Users affected: [Number or percentage]
- Services impacted: [List]
- Data at risk: Yes/No

**Timeline**:
- Detected: [Time]
- Diagnosed: [Time]
- Mitigation started: [Time]

**Root Cause**:
- [Brief description]

**Current Status**:
- [What's happening now]

**Next Steps**:
- [Action items]

**ETA to Resolution**: [Time estimate]

**Point of Contact**: [Name, Slack handle]
```

---

## Appendix: Useful Commands

### Quick Diagnostics

```bash
# One-line health check
kubectl get pods -n vibecode && kubectl get svc -n vibecode && curl -f https://vibecode.eastus2.cloudapp.azure.com/api/health

# Full system status
kubectl get all -n vibecode

# Resource usage summary
kubectl top nodes && kubectl top pods -n vibecode

# Recent errors
kubectl logs -n vibecode -l app=vibecode-webgui --since=10m | grep -i error | tail -20
```

### Performance Monitoring

```bash
# Watch pod status
watch kubectl get pods -n vibecode

# Monitor metrics
watch -n 5 'curl -s "https://vibecode.eastus2.cloudapp.azure.com/api/monitoring/metrics" | jq "."'

# Stream logs with filter
kubectl logs -n vibecode -l app=vibecode-webgui -f | grep -E "(ERROR|WARN)"
```

---

**Document Version**: 1.0.0
**Last Reviewed**: 2025-10-02
**Next Review**: 2025-11-02
**Owner**: SRE Team
