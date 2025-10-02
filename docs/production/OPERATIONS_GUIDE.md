# Operations Guide

**Document Owner**: SRE Team
**Last Updated**: 2025-10-02
**Version**: 1.0.0
**Audience**: Production Operators, SREs, On-Call Engineers

## Table of Contents

1. [Daily Operations](#daily-operations)
2. [Weekly Maintenance](#weekly-maintenance)
3. [Monthly Reviews](#monthly-reviews)
4. [Monitoring Procedures](#monitoring-procedures)
5. [Capacity Management](#capacity-management)
6. [Backup and Restore](#backup-and-restore)
7. [Certificate Management](#certificate-management)
8. [Access Control](#access-control)

---

## Daily Operations

### Morning Health Check (9:00 AM Daily)

**Dashboard Review**:
```bash
# Check Datadog overview dashboard
open "https://app.datadoghq.com/dashboard/production-overview"

# Verify key metrics (last 24h):
# - Availability: >99.9%
# - Error rate: <0.5%
# - P95 latency: <1000ms
# - Active users: within expected range
```

**Service Health Verification**:
```bash
#!/bin/bash
# daily-health-check.sh

echo "=== VibeCode Daily Health Check ==="
echo "Date: $(date)"

# 1. Cluster Status
echo -e "\n1. Cluster Health:"
kubectl get nodes
kubectl top nodes

# 2. Application Pods
echo -e "\n2. Application Pods:"
kubectl get pods -n vibecode -o wide
kubectl get pods -n vibecode --field-selector=status.phase!=Running

# 3. Database Health
echo -e "\n3. Database Health:"
kubectl exec -n vibecode postgres-0 -- pg_isready
kubectl exec -n vibecode postgres-0 -- psql -U vibecode -c "SELECT count(*) FROM pg_stat_activity;"

# 4. Redis Health
echo -e "\n4. Redis Health:"
kubectl exec -n vibecode redis-0 -- redis-cli ping
kubectl exec -n vibecode redis-0 -- redis-cli info stats | grep total_commands_processed

# 5. Storage Status
echo -e "\n5. Storage:"
kubectl get pv,pvc -n vibecode

# 6. Recent Errors
echo -e "\n6. Recent Application Errors (last 1h):"
kubectl logs -n vibecode -l app=vibecode-webgui --since=1h | grep -i error | tail -20

# 7. Certificate Status
echo -e "\n7. TLS Certificates:"
kubectl get certificate -n vibecode
echo | openssl s_client -connect vibecode.eastus2.cloudapp.azure.com:443 2>/dev/null | openssl x509 -noout -dates

# 8. Autoscaler Status
echo -e "\n8. Horizontal Pod Autoscaler:"
kubectl get hpa -n vibecode

echo -e "\n=== Health Check Complete ==="
```

**Alert Review**:
```bash
# Check active alerts in Datadog
curl -s "https://api.datadoghq.com/api/v1/monitor" \
  -H "DD-API-KEY: ${DD_API_KEY}" \
  -H "DD-APPLICATION-KEY: ${DD_APP_KEY}" | \
  jq '.[] | select(.overall_state!="OK") | {name: .name, status: .overall_state}'

# Review PagerDuty incidents
curl -s "https://api.pagerduty.com/incidents?statuses[]=triggered&statuses[]=acknowledged" \
  -H "Authorization: Token token=${PD_API_TOKEN}" | \
  jq '.incidents[] | {id: .id, title: .title, status: .status}'
```

**Performance Metrics Check**:
```bash
# Check key performance indicators
curl -s "https://vibecode.eastus2.cloudapp.azure.com/api/monitoring/metrics" | jq '{
  error_rate: .error_rate,
  p95_latency: .response_time_p95,
  throughput: .requests_per_second,
  active_users: .active_sessions
}'

# Compare to yesterday
curl -s "https://vibecode.eastus2.cloudapp.azure.com/api/monitoring/metrics?compare=yesterday" | jq '.'
```

**Action Items**:
- [ ] Document any anomalies in #operations channel
- [ ] Create tickets for non-critical issues
- [ ] Update capacity forecast if usage trending up
- [ ] Acknowledge any alerts that are expected

### Log Review (Continuous)

**Real-Time Log Monitoring**:
```bash
# Stream application logs (filtered for errors)
kubectl logs -n vibecode -l app=vibecode-webgui -f | grep -E "(ERROR|WARN|CRITICAL)"

# Monitor specific service logs
stern -n vibecode vibecode-webgui --since 1h
```

**Structured Log Analysis** (Datadog):
```
Query: service:vibecode status:error env:production

Facets:
- @error.kind
- @http.status_code
- @user.id (for user-impacting errors)

Time Range: Last 1 hour
Grouping: By @error.message
```

**Common Log Patterns to Watch**:
```bash
# Database connection errors
"ECONNREFUSED" "connection refused" "too many connections"

# Authentication failures (brute force attempts)
"authentication failed" "invalid token" "rate limit exceeded"

# Memory issues
"JavaScript heap out of memory" "ENOMEM" "allocation failure"

# External API failures
"timeout" "ENOTFOUND" "503" "upstream connect error"
```

**Log Aggregation Commands**:
```bash
# Count errors by type (last 1h)
kubectl logs -n vibecode -l app=vibecode-webgui --since=1h | \
  grep ERROR | \
  awk '{print $5}' | \
  sort | uniq -c | sort -rn

# Find slow queries
kubectl logs -n vibecode postgres-0 --since=1h | \
  grep "duration:" | \
  awk '$6 > 1000 {print $0}' | \
  tail -20
```

### Traffic Analysis

**Request Rate Monitoring**:
```bash
# Check current throughput
kubectl exec -n vibecode -it deploy/vibecode-webgui -- \
  wget -q -O- http://localhost:9090/metrics | grep http_requests_total

# Datadog query for traffic patterns
curl -s "https://api.datadoghq.com/api/v1/query?query=sum:trace.web.request.hits{env:production}.as_count()" \
  -H "DD-API-KEY: ${DD_API_KEY}" \
  -H "DD-APPLICATION-KEY: ${DD_APP_KEY}" | \
  jq '.series[0].pointlist[-1][1]'
```

**Traffic Anomaly Detection**:
```bash
# Compare current traffic to 24h ago
current=$(curl -s "https://vibecode.eastus2.cloudapp.azure.com/api/monitoring/metrics" | jq '.requests_per_second')
baseline=$(curl -s "https://vibecode.eastus2.cloudapp.azure.com/api/monitoring/metrics?compare=24h" | jq '.requests_per_second')

echo "Current: $current req/s"
echo "Baseline: $baseline req/s"
echo "Delta: $(echo "scale=2; ($current - $baseline) / $baseline * 100" | bc)%"
```

### Resource Utilization Check

**CPU and Memory**:
```bash
# Pod resource usage
kubectl top pods -n vibecode --sort-by=cpu
kubectl top pods -n vibecode --sort-by=memory

# Node resource usage
kubectl top nodes

# Detailed resource breakdown
kubectl describe nodes | grep -A 5 "Allocated resources"
```

**Disk Space Monitoring**:
```bash
# Check PVC usage
kubectl exec -n vibecode postgres-0 -- df -h /var/lib/postgresql/data
kubectl exec -n vibecode redis-0 -- df -h /data

# Check node disk usage
kubectl get nodes -o json | jq -r '.items[] | {
  name: .metadata.name,
  disk_pressure: .status.conditions[] | select(.type=="DiskPressure") | .status
}'
```

**Network Utilization**:
```bash
# Check network policies
kubectl get networkpolicies -n vibecode

# Monitor ingress traffic
kubectl get ingress -n vibecode
kubectl describe ingress vibecode -n vibecode | grep -A 10 "Rules"
```

---

## Weekly Maintenance

### Sunday Maintenance Window (2:00 AM - 4:00 AM UTC)

**Pre-Maintenance Checklist**:
- [ ] Notify stakeholders of maintenance window
- [ ] Create maintenance banner on dashboard
- [ ] Schedule PagerDuty maintenance window
- [ ] Backup all databases
- [ ] Document baseline metrics

**Security Updates**:
```bash
# 1. Check for security vulnerabilities
npm audit --audit-level=moderate

# 2. Update container images (if patches available)
docker pull ghcr.io/vibecode/webgui:latest
docker pull ghcr.io/vibecode/agentapi:latest

# 3. Scan updated images
docker scan ghcr.io/vibecode/webgui:latest

# 4. Update Kubernetes components (if needed)
kubectl version --short
# Check for cluster upgrade availability in cloud provider console

# 5. Update cert-manager
helm upgrade cert-manager jetstack/cert-manager -n cert-manager --version v1.12.0
```

**Database Maintenance**:
```bash
# PostgreSQL maintenance
kubectl exec -n vibecode postgres-0 -- psql -U vibecode vibecode_db <<EOF
-- Analyze tables for query optimization
ANALYZE;

-- Vacuum to reclaim space
VACUUM (VERBOSE, ANALYZE);

-- Reindex for performance
REINDEX DATABASE vibecode_db;

-- Check for bloated tables
SELECT schemaname, tablename,
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 10;
EOF

# Redis maintenance
kubectl exec -n vibecode redis-0 -- redis-cli <<EOF
# Save snapshot
SAVE

# Analyze memory usage
MEMORY STATS

# Check fragmentation
INFO memory
EOF
```

**Log Rotation**:
```bash
# Rotate application logs
kubectl exec -n vibecode -l app=vibecode-webgui -- sh -c '
  find /var/log -name "*.log" -mtime +7 -exec gzip {} \;
  find /var/log -name "*.log.gz" -mtime +30 -delete
'

# Archive old logs to S3/Azure Blob
kubectl exec -n vibecode backup-agent -- sh -c '
  tar czf logs-$(date +%Y%m%d).tar.gz /var/log/archive/
  az storage blob upload --file logs-$(date +%Y%m%d).tar.gz --container logs
'
```

**Backup Verification**:
```bash
# Test database restore to staging
kubectl exec -n vibecode-staging postgres-0 -- psql -U vibecode vibecode_db < latest-backup.sql

# Verify data integrity
kubectl exec -n vibecode-staging postgres-0 -- psql -U vibecode -d vibecode_db -c "
  SELECT count(*) FROM workspaces;
  SELECT count(*) FROM users;
  SELECT count(*) FROM sessions;
"

# Test application startup with restored data
kubectl rollout restart deployment/vibecode-webgui -n vibecode-staging
```

**Certificate Renewal Check**:
```bash
# List all certificates expiring in next 30 days
kubectl get certificate -A -o json | jq -r '
  .items[] |
  select(.status.notAfter | fromdateiso8601 < (now + 2592000)) |
  {namespace: .metadata.namespace, name: .metadata.name, expires: .status.notAfter}
'

# Renew if necessary (cert-manager auto-renews at 30 days)
kubectl describe certificate -n vibecode vibecode-tls
```

**Storage Cleanup**:
```bash
# Remove old container images from nodes
kubectl get nodes -o name | xargs -I {} kubectl debug {} -it --image=alpine -- sh -c '
  docker system prune -a --filter "until=720h" --force
'

# Clean up completed jobs
kubectl delete jobs -n vibecode --field-selector status.successful=1

# Remove old PVCs
kubectl get pvc -A --sort-by=.metadata.creationTimestamp | head -20
```

**Performance Tuning**:
```bash
# Review slow queries from past week
kubectl exec -n vibecode postgres-0 -- psql -U vibecode -d vibecode_db <<EOF
SELECT
  query,
  calls,
  mean_exec_time,
  max_exec_time
FROM pg_stat_statements
WHERE mean_exec_time > 100
ORDER BY mean_exec_time DESC
LIMIT 20;
EOF

# Create indexes for slow queries (if needed)
# ALTER TABLE workspaces ADD INDEX idx_user_created (user_id, created_at);
```

**Monitoring Health Check**:
```bash
# Verify Datadog agent
kubectl get daemonset -n datadog

# Check Prometheus scraping
kubectl port-forward -n monitoring svc/prometheus 9090:9090 &
curl http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | select(.health!="up")'

# Test alert routing
curl -X POST https://api.datadoghq.com/api/v1/events \
  -H "DD-API-KEY: ${DD_API_KEY}" \
  -d '{
    "title": "Weekly maintenance test alert",
    "text": "Testing alert routing",
    "priority": "low",
    "tags": ["env:production", "test:true"]
  }'
```

**Post-Maintenance Validation**:
- [ ] All services healthy
- [ ] Smoke tests passing
- [ ] No increase in error rate
- [ ] Performance within baseline
- [ ] Alerts routing correctly
- [ ] Document maintenance summary

---

## Monthly Reviews

### First Monday of Month (9:00 AM UTC)

**Capacity Planning Review**:
```bash
# Generate capacity report (last 30 days)
curl -s "https://api.datadoghq.com/api/v1/query?query=avg:system.cpu.user{env:production}&from=$(date -u -d '30 days ago' +%s)&to=$(date +%s)" \
  -H "DD-API-KEY: ${DD_API_KEY}" \
  -H "DD-APPLICATION-KEY: ${DD_APP_KEY}" | \
  jq '.series[0].pointlist | {
    avg: (add / length),
    max: max,
    trend: (if ((.[length-1][1] - .[0][1]) > 0) then "increasing" else "decreasing" end)
  }'

# Document findings:
# - Peak usage patterns
# - Resource bottlenecks
# - Growth projections (next 3 months)
```

**Cost Analysis**:
```bash
# Kubernetes resource cost estimation
kubectl cost -n vibecode --window 30d

# Cloud provider billing review
# (Access Azure/AWS/GCP console)
# - Compute costs
# - Storage costs
# - Network egress
# - Unused resources (opportunities for optimization)
```

**Security Audit**:
```bash
# Review access logs
kubectl logs -n vibecode auth-service --since=720h | grep "authentication failed" | wc -l

# Check for unused service accounts
kubectl get serviceaccount -A -o json | jq -r '
  .items[] |
  select(.metadata.creationTimestamp | fromdateiso8601 < (now - 7776000)) |
  {namespace: .metadata.namespace, name: .metadata.name}
'

# Scan for security vulnerabilities
trivy image --severity HIGH,CRITICAL ghcr.io/vibecode/webgui:latest

# Review RBAC policies
kubectl auth can-i --list --as=system:serviceaccount:vibecode:default
```

**Performance Review**:
```bash
# Generate performance report (last 30 days)
cat <<EOF > monthly-performance-report.md
# Monthly Performance Report - $(date +%Y-%m)

## Key Metrics

### Availability
- Target: 99.9%
- Actual: $(curl -s "https://vibecode.eastus2.cloudapp.azure.com/api/monitoring/slo?period=30d" | jq -r '.availability')

### Performance
- P50 Latency: $(curl -s "https://vibecode.eastus2.cloudapp.azure.com/api/monitoring/metrics?period=30d" | jq -r '.p50')ms
- P95 Latency: $(curl -s "https://vibecode.eastus2.cloudapp.azure.com/api/monitoring/metrics?period=30d" | jq -r '.p95')ms
- P99 Latency: $(curl -s "https://vibecode.eastus2.cloudapp.azure.com/api/monitoring/metrics?period=30d" | jq -r '.p99')ms

### Error Budget
- Error budget remaining: $(curl -s "https://vibecode.eastus2.cloudapp.azure.com/api/monitoring/slo?period=30d" | jq -r '.error_budget_remaining')%

### Incidents
- P1 incidents: ___
- P2 incidents: ___
- MTTR: ___ minutes

## Action Items
- [ ] Investigate P95 latency spike on [date]
- [ ] Optimize slow database queries
- [ ] Increase cache hit rate (current: 85%, target: 95%)

EOF
```

**Dependency Updates**:
```bash
# Check for outdated dependencies
npm outdated

# Create update plan (testing required):
# - Patch updates: Low risk, apply weekly
# - Minor updates: Medium risk, test in staging
# - Major updates: High risk, schedule dedicated migration
```

**Backup Verification**:
```bash
# List all backups (last 30 days)
az storage blob list --container backups --prefix vibecode-db --output table | grep $(date +%Y-%m)

# Verify backup integrity (sample test)
latest_backup=$(az storage blob list --container backups --prefix vibecode-db --output json | jq -r 'sort_by(.properties.creationTime) | .[-1].name')
az storage blob download --container backups --name ${latest_backup} --file test-restore.sql
kubectl exec -n vibecode-test postgres-0 -- psql -U vibecode test_db < test-restore.sql
```

**Documentation Review**:
- [ ] Update runbooks with new procedures
- [ ] Document known issues and workarounds
- [ ] Review and update on-call playbooks
- [ ] Update architecture diagrams if changes occurred

---

## Monitoring Procedures

### Datadog Dashboard Overview

**Primary Dashboards**:

1. **Production Overview** (`production-overview`)
   - Request rate and throughput
   - Error rate (by status code)
   - P50/P95/P99 latency
   - Active users and sessions
   - Pod health and autoscaling

2. **Database Performance** (`database-performance`)
   - Query latency (P95, P99)
   - Connection pool utilization
   - Slow query count
   - Database CPU and memory
   - Replication lag (if applicable)

3. **Infrastructure Health** (`infrastructure-health`)
   - Node CPU and memory
   - Disk usage and IOPS
   - Network throughput
   - Pod resource requests vs limits
   - Kubernetes events

4. **User Experience** (`user-experience`)
   - Core Web Vitals (LCP, FID, CLS)
   - Page load times
   - JavaScript errors
   - API endpoint performance
   - Geographic distribution

**Dashboard Access**:
```bash
# Open all critical dashboards
open "https://app.datadoghq.com/dashboard/production-overview"
open "https://app.datadoghq.com/dashboard/database-performance"
open "https://app.datadoghq.com/dashboard/infrastructure-health"
open "https://app.datadoghq.com/dashboard/user-experience"
```

### Alert Response Time SLAs

**Severity Levels**:

| Severity | Description | Response Time | Example |
|----------|-------------|---------------|---------|
| P1 (Critical) | Service down, data loss | <15 minutes | Complete outage, database corruption |
| P2 (High) | Degraded performance | <1 hour | High error rate, slow responses |
| P3 (Medium) | Non-critical issues | <4 hours | Individual feature failure |
| P4 (Low) | Informational | <24 hours | Resource usage trending up |

**Alert Acknowledgment**:
```bash
# Acknowledge alert in Datadog
datadog-cli monitor mute <monitor-id> --scope env:production --message "Investigating issue"

# Acknowledge in PagerDuty
pd acknowledge <incident-id> --user <user-id>

# Update status page
curl -X POST https://api.statuspage.io/v1/pages/${PAGE_ID}/incidents \
  -H "Authorization: OAuth ${STATUSPAGE_TOKEN}" \
  -d '{
    "incident": {
      "name": "Investigating Performance Degradation",
      "status": "investigating",
      "impact": "minor"
    }
  }'
```

### Custom Monitoring Queries

**Datadog APM Queries**:
```
# High error rate on specific endpoint
service:vibecode resource_name:"GET /api/workspaces" status:error env:production

# Slow database queries
service:postgres operation_name:query @duration:>1000 env:production

# Memory usage trending
avg:system.mem.used{env:production,service:vibecode} by {host}

# 95th percentile latency by endpoint
p95:trace.web.request.duration{env:production} by {resource_name}
```

**Prometheus Queries**:
```promql
# Request rate (per second)
rate(http_requests_total{env="production"}[5m])

# Error rate (percentage)
sum(rate(http_requests_total{env="production",status=~"5.."}[5m])) /
sum(rate(http_requests_total{env="production"}[5m])) * 100

# Pod CPU usage
sum(rate(container_cpu_usage_seconds_total{namespace="vibecode"}[5m])) by (pod)

# Memory usage
sum(container_memory_working_set_bytes{namespace="vibecode"}) by (pod)
```

### Log Search Patterns

**Common Queries** (Datadog Logs):
```
# Authentication failures
service:vibecode @http.status_code:401 @error.message:*authentication*

# Database connection errors
service:vibecode @error.kind:DatabaseError @error.message:*connection*

# Slow requests (>1s)
service:vibecode @http.duration:>1000

# User actions
service:vibecode @user.action:* @user.id:* status:info

# Critical errors by service
service:* status:error @error.severity:critical env:production
```

---

## Capacity Management

### Resource Planning Formula

**CPU Capacity**:
```
Required CPU = (Average CPU per Pod × Number of Pods × Peak Factor) + System Reserve

Example:
- Average CPU per pod: 0.5 cores
- Number of pods: 10
- Peak factor: 2x (traffic spikes)
- System reserve: 30%

Required = (0.5 × 10 × 2) + 30% = 13 cores
```

**Memory Capacity**:
```
Required Memory = (Average Memory per Pod × Number of Pods × Growth Factor) + System Reserve

Example:
- Average memory per pod: 2 GB
- Number of pods: 10
- Growth factor: 1.5x (headroom)
- System reserve: 20%

Required = (2 × 10 × 1.5) + 20% = 36 GB
```

### Autoscaling Configuration

**Horizontal Pod Autoscaler** (HPA):
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: vibecode-webgui
  namespace: vibecode
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: vibecode-webgui
  minReplicas: 6
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  - type: Pods
    pods:
      metric:
        name: http_requests_per_second
      target:
        type: AverageValue
        averageValue: "1000"
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 10
        periodSeconds: 60
```

**Vertical Pod Autoscaler** (VPA):
```yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: vibecode-webgui
  namespace: vibecode
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: vibecode-webgui
  updatePolicy:
    updateMode: "Auto"
  resourcePolicy:
    containerPolicies:
    - containerName: webgui
      minAllowed:
        cpu: 500m
        memory: 1Gi
      maxAllowed:
        cpu: 4000m
        memory: 8Gi
      controlledResources:
      - cpu
      - memory
```

### Scaling Triggers

**Manual Scaling**:
```bash
# Scale up for expected traffic spike
kubectl scale deployment vibecode-webgui -n vibecode --replicas=15

# Scale database read replicas
kubectl scale statefulset postgres-read -n vibecode --replicas=3
```

**Predictive Scaling** (based on historical data):
```bash
# Analyze traffic patterns for past 30 days
curl -s "https://api.datadoghq.com/api/v1/query?query=avg:trace.web.request.hits{env:production}&from=$(date -u -d '30 days ago' +%s)&to=$(date +%s)" \
  -H "DD-API-KEY: ${DD_API_KEY}" | \
  jq '.series[0].pointlist | group_by(.[0] % 86400) | map({hour: (.[0][0] % 86400 / 3600), avg: (map(.[1]) | add / length)})'

# Schedule pre-scaling for known peaks (e.g., Monday 9am)
# (Use Kubernetes CronJob or external scheduler)
```

---

## Backup and Restore

### Automated Backup Schedule

**Database Backups**:
```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: postgres-backup
  namespace: vibecode
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM UTC
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: postgres:15
            command:
            - /bin/bash
            - -c
            - |
              pg_dump -h postgres -U vibecode vibecode_db | \
              gzip > /backup/vibecode-db-$(date +\%Y\%m\%d-\%H\%M\%S).sql.gz

              # Upload to Azure Blob Storage
              az storage blob upload \
                --account-name vibecodebackups \
                --container-name database \
                --file /backup/vibecode-db-$(date +\%Y\%m\%d-\%H\%M\%S).sql.gz

              # Cleanup backups older than 30 days
              find /backup -name "*.sql.gz" -mtime +30 -delete
            env:
            - name: PGPASSWORD
              valueFrom:
                secretKeyRef:
                  name: postgres-credentials
                  key: password
            volumeMounts:
            - name: backup-volume
              mountPath: /backup
          volumes:
          - name: backup-volume
            persistentVolumeClaim:
              claimName: backup-pvc
          restartPolicy: OnFailure
```

**Application State Backups**:
```bash
# Backup Redis data
kubectl exec -n vibecode redis-0 -- redis-cli --rdb /data/dump-$(date +%Y%m%d).rdb

# Backup workspace files
kubectl exec -n vibecode backup-agent -- tar czf \
  /backup/workspaces-$(date +%Y%m%d).tar.gz \
  /mnt/workspaces
```

### Restore Procedures

**Database Restore** (full):
```bash
# 1. List available backups
az storage blob list --container-name database --output table

# 2. Download backup
az storage blob download \
  --container-name database \
  --name vibecode-db-20251002-020000.sql.gz \
  --file restore.sql.gz

# 3. Stop application (prevent writes during restore)
kubectl scale deployment vibecode-webgui -n vibecode --replicas=0

# 4. Restore database
gunzip restore.sql.gz
kubectl exec -n vibecode postgres-0 -- psql -U vibecode vibecode_db < restore.sql

# 5. Verify data integrity
kubectl exec -n vibecode postgres-0 -- psql -U vibecode -d vibecode_db -c "
  SELECT count(*) FROM workspaces;
  SELECT max(created_at) FROM users;
"

# 6. Restart application
kubectl scale deployment vibecode-webgui -n vibecode --replicas=6
```

**Point-in-Time Recovery** (PITR):
```bash
# Restore to specific timestamp (requires WAL archiving)
kubectl exec -n vibecode postgres-0 -- sh -c '
  pg_basebackup -h postgres -U replication -D /var/lib/postgresql/pitr

  # Create recovery.conf
  cat > /var/lib/postgresql/pitr/recovery.conf <<EOF
restore_command = "cp /archive/%f %p"
recovery_target_time = "2025-10-02 14:30:00"
EOF

  # Start recovery
  pg_ctl start -D /var/lib/postgresql/pitr
'
```

### Backup Verification

**Weekly Backup Test** (automated):
```bash
#!/bin/bash
# test-backup-restore.sh

# 1. Create test namespace
kubectl create namespace vibecode-backup-test

# 2. Deploy minimal database
kubectl apply -f k8s/postgres-test.yaml -n vibecode-backup-test

# 3. Download latest backup
latest_backup=$(az storage blob list --container database --output json | jq -r 'sort_by(.properties.creationTime) | .[-1].name')
az storage blob download --container database --name ${latest_backup} --file test-backup.sql.gz

# 4. Restore backup
gunzip test-backup.sql.gz
kubectl exec -n vibecode-backup-test postgres-test-0 -- psql -U vibecode test_db < test-backup.sql

# 5. Verify data
result=$(kubectl exec -n vibecode-backup-test postgres-test-0 -- psql -U vibecode -d test_db -t -c "SELECT count(*) FROM workspaces;")

if [ $result -gt 0 ]; then
  echo "✅ Backup verification passed: $result workspaces restored"
else
  echo "❌ Backup verification failed"
  exit 1
fi

# 6. Cleanup
kubectl delete namespace vibecode-backup-test
```

---

## Certificate Management

### TLS Certificate Lifecycle

**Certificate Inventory**:
```bash
# List all certificates
kubectl get certificate -A -o custom-columns=\
NAMESPACE:.metadata.namespace,\
NAME:.metadata.name,\
READY:.status.conditions[0].status,\
SECRET:.spec.secretName,\
ISSUER:.spec.issuerRef.name,\
EXPIRES:.status.notAfter

# Check certificate details
kubectl describe certificate vibecode-tls -n vibecode
```

**Manual Certificate Renewal** (if auto-renewal fails):
```bash
# 1. Delete existing certificate request
kubectl delete certificaterequest -n vibecode --all

# 2. Delete certificate (will trigger recreation)
kubectl delete certificate vibecode-tls -n vibecode

# 3. Recreate certificate
kubectl apply -f - <<EOF
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: vibecode-tls
  namespace: vibecode
spec:
  secretName: vibecode-tls
  issuerRef:
    name: letsencrypt-prod
    kind: ClusterIssuer
  dnsNames:
  - vibecode.eastus2.cloudapp.azure.com
  - api.vibecode.eastus2.cloudapp.azure.com
EOF

# 4. Monitor renewal
kubectl get certificate vibecode-tls -n vibecode -w

# 5. Verify new certificate
echo | openssl s_client -connect vibecode.eastus2.cloudapp.azure.com:443 2>/dev/null | \
  openssl x509 -noout -dates -subject
```

**Certificate Monitoring**:
```yaml
# Datadog monitor for certificate expiration
apiVersion: v1
kind: ConfigMap
metadata:
  name: certificate-monitor
  namespace: monitoring
data:
  monitor.yaml: |
    name: "TLS Certificate Expiring Soon"
    type: metric alert
    query: "avg(last_5m):min:kubernetes.certificate.expiration{kube_namespace:vibecode} < 2592000"
    message: |
      Certificate expiring in less than 30 days
      @pagerduty-ops
    tags:
      - service:vibecode
      - severity:high
```

---

## Access Control

### RBAC Policies

**Service Account Review**:
```bash
# List all service accounts
kubectl get serviceaccount -A

# Check service account permissions
kubectl auth can-i --list --as=system:serviceaccount:vibecode:default -n vibecode

# Audit unused service accounts (older than 90 days)
kubectl get serviceaccount -A -o json | jq -r '
  .items[] |
  select(.metadata.creationTimestamp | fromdateiso8601 < (now - 7776000)) |
  {namespace: .metadata.namespace, name: .metadata.name, created: .metadata.creationTimestamp}
'
```

**Role and RoleBinding Audit**:
```bash
# List all roles and rolebindings
kubectl get role,rolebinding -n vibecode

# Check who has access to secrets
kubectl get rolebinding -n vibecode -o json | jq -r '
  .items[] |
  select(.roleRef.kind=="Role" and (.roleRef.name | contains("secret"))) |
  {name: .metadata.name, subjects: .subjects}
'
```

### User Access Management

**Add New Operator**:
```bash
# 1. Create kubeconfig for new user
kubectl create serviceaccount ops-user -n vibecode

# 2. Create role
kubectl apply -f - <<EOF
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: ops-user-role
  namespace: vibecode
rules:
- apiGroups: ["apps"]
  resources: ["deployments", "replicasets", "pods"]
  verbs: ["get", "list", "watch"]
- apiGroups: [""]
  resources: ["pods", "pods/log"]
  verbs: ["get", "list", "watch"]
EOF

# 3. Create role binding
kubectl create rolebinding ops-user-binding \
  --role=ops-user-role \
  --serviceaccount=vibecode:ops-user \
  -n vibecode

# 4. Generate kubeconfig
./scripts/generate-kubeconfig.sh ops-user vibecode
```

**Revoke Access**:
```bash
# Remove user access
kubectl delete rolebinding ops-user-binding -n vibecode
kubectl delete serviceaccount ops-user -n vibecode

# Rotate service account tokens
kubectl delete secret -n vibecode $(kubectl get secret -n vibecode -o name | grep ops-user)
```

### Audit Logging

**Enable Audit Logging**:
```yaml
apiVersion: audit.k8s.io/v1
kind: Policy
rules:
- level: Metadata
  resources:
  - group: ""
    resources: ["secrets", "configmaps"]
- level: RequestResponse
  resources:
  - group: ""
    resources: ["pods/exec", "pods/portforward"]
```

**Review Audit Logs**:
```bash
# Check for suspicious activities
kubectl logs -n kube-system kube-apiserver-* | \
  grep -E "(secrets|exec|portforward)" | \
  jq 'select(.user.username!="system:serviceaccount")'
```

---

## Appendix

### On-Call Contacts

**Primary Escalation**:
- SRE On-Call: PagerDuty rotation
- Engineering Manager: [Name] - [Contact]
- VP Engineering: [Name] - [Contact]

**Secondary Contacts**:
- Database Admin: [Name] - [Contact]
- Security Team: [Name] - [Contact]
- Cloud Provider Support: [Portal Link]

### Useful Commands Quick Reference

```bash
# Get pod logs
kubectl logs -n vibecode <pod-name> --tail=100 --follow

# Describe pod
kubectl describe pod -n vibecode <pod-name>

# Execute command in pod
kubectl exec -it -n vibecode <pod-name> -- /bin/bash

# Port forward
kubectl port-forward -n vibecode svc/vibecode-webgui 3000:3000

# Scale deployment
kubectl scale deployment vibecode-webgui -n vibecode --replicas=10

# Restart deployment
kubectl rollout restart deployment vibecode-webgui -n vibecode

# Check resource usage
kubectl top pod -n vibecode
kubectl top node

# View events
kubectl get events -n vibecode --sort-by='.lastTimestamp'
```

---

**Document Version**: 1.0.0
**Last Reviewed**: 2025-10-02
**Next Review**: 2025-11-02
**Owner**: SRE Team
