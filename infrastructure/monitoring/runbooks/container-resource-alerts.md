# Container Resource Alerts Runbook

## Overview

This runbook provides response procedures for container resource alerts in the VibeCode platform. These alerts monitor CPU, memory, disk, network, and operational health of all containers.

**Alert Groups:**
- `vibecode.container.resources` - Resource utilization alerts
- `vibecode.container.performance` - Performance degradation alerts

**Dashboards:**
- [Container Monitoring Dashboard](http://localhost:3000/monitoring/containers)
- [Datadog Container Metrics](https://grafana.vibecode.dev/d/container-metrics)
- [Prometheus Alerts](https://prometheus.vibecode.dev/alerts)

---

## CPU Alerts

### ContainerHighCPUUsage

**When this fires:**
- Container CPU usage >80% for 5+ minutes

**Possible causes:**
- Spike in application traffic or requests
- Inefficient code or processing loops
- Runaway processes or memory leaks
- Insufficient CPU limits for workload
- Competing processes on the node

**Immediate actions:**
1. Check container CPU usage in real-time:
   ```bash
   kubectl top pod <pod-name> --containers
   docker stats <container-name>
   ```

2. Review container logs for errors or unusual activity:
   ```bash
   kubectl logs <pod-name> -c <container-name> --tail=100
   docker logs <container-name> --tail 100
   ```

3. Check application metrics (request rate, queue depth):
   ```bash
   curl http://localhost:3000/api/monitoring/containers?container=<name>
   ```

4. Identify top CPU-consuming processes inside container:
   ```bash
   kubectl exec <pod-name> -c <container-name> -- top -b -n 1
   docker exec <container-name> top -b -n 1 | head -20
   ```

**Mitigations:**
- If traffic spike: Scale horizontally (add replicas)
  ```bash
  kubectl scale deployment <deployment-name> --replicas=<N>
  ```
- If inefficient code: Enable rate limiting or request throttling
- If resource constrained: Increase CPU limits temporarily
  ```bash
  kubectl set resources deployment <name> -c=<container> --limits=cpu=2000m
  ```
- If runaway process: Restart container
  ```bash
  kubectl rollout restart deployment <deployment-name>
  docker restart <container-name>
  ```

**Follow-up:**
- Review application code for CPU optimization opportunities
- Analyze traffic patterns and capacity requirements
- Adjust CPU limits/requests based on actual usage patterns
- Set up horizontal pod autoscaling if not already configured
- Create incident report if sustained or recurring

---

### ContainerCriticalCPUUsage

**When this fires:**
- Container CPU usage >95% for 3+ minutes

**Possible causes:**
- Same as ContainerHighCPUUsage but more severe
- Application hitting performance ceiling
- Denial of service or abuse
- Cascading failure from downstream service issues

**Immediate actions:**
1. **URGENT**: Check if container is still responsive:
   ```bash
   kubectl exec <pod-name> -c <container-name> -- echo "alive"
   curl -m 5 http://<service-endpoint>/health
   ```

2. Check for alerts on related services (database, cache, downstream APIs)

3. Immediately scale up if traffic-related:
   ```bash
   kubectl scale deployment <deployment-name> --replicas=<current+2>
   ```

4. Check for potential security issues (DDoS, crypto mining):
   ```bash
   kubectl top nodes
   # Look for unusual network activity
   kubectl exec <pod-name> -c <container-name> -- netstat -tupn
   ```

**Mitigations:**
- **Priority 1**: Add capacity immediately via scaling
- **Priority 2**: Implement emergency rate limiting at ingress/load balancer
- If security concern: Isolate pod and investigate
  ```bash
  kubectl cordon <node-name>
  kubectl drain <node-name> --ignore-daemonsets
  ```
- If database-related: Check connection pool settings and query performance
- Consider failover to backup region if available

**Follow-up:**
- Mandatory incident review with P1 severity
- Update resource limits and autoscaling thresholds
- Implement circuit breakers if cascading failure detected
- Review security logs for abuse patterns
- Update monitoring thresholds if alert was too sensitive

---

## Memory Alerts

### ContainerHighMemoryUsage

**When this fires:**
- Container memory usage >85% of limit for 3+ minutes

**Possible causes:**
- Memory leak in application code
- Increased cache usage or data volume
- Insufficient memory limits for workload
- Connection pool or buffer growth
- Large in-memory data structures

**Immediate actions:**
1. Check current memory usage and trends:
   ```bash
   kubectl top pod <pod-name> --containers
   curl http://localhost:3000/api/monitoring/containers/history?container=<name>&metric=memory&duration=1h
   ```

2. Review container logs for OOM warnings:
   ```bash
   kubectl logs <pod-name> -c <container-name> | grep -i "out of memory\|oom\|killed"
   ```

3. Check if memory usage is growing over time (leak indicator):
   ```bash
   # Compare memory at different intervals
   kubectl exec <pod-name> -c <container-name> -- free -m
   sleep 60
   kubectl exec <pod-name> -c <container-name> -- free -m
   ```

4. Inspect memory-intensive processes:
   ```bash
   kubectl exec <pod-name> -c <container-name> -- ps aux --sort=-%mem | head -10
   ```

**Mitigations:**
- If steady state high usage: Increase memory limits
  ```bash
  kubectl set resources deployment <name> -c=<container> --limits=memory=2Gi
  ```
- If memory leak suspected: Restart container and monitor
  ```bash
  kubectl delete pod <pod-name>
  ```
- If cache-related: Clear or reduce cache size if safe
- If connection pool: Reduce max connections or pool size
- Scale horizontally to distribute memory load

**Follow-up:**
- If memory leak: Profile application to identify leak source
- Review memory allocation patterns in code
- Optimize data structures and caching strategies
- Set appropriate memory limits based on actual needs
- Enable memory profiling in staging environment
- Update container memory limits in deployment manifests

---

### ContainerCriticalMemoryUsage

**When this fires:**
- Container memory usage >95% of limit for 2+ minutes
- **High risk of OOM kill**

**Possible causes:**
- Same as ContainerHighMemoryUsage but imminent failure
- Rapid memory consumption from unexpected load
- Memory bomb or malicious payload

**Immediate actions:**
1. **URGENT**: Preemptive action to prevent OOM kill:
   ```bash
   # Increase memory limit immediately
   kubectl set resources deployment <name> -c=<container> --limits=memory=4Gi

   # Or scale horizontally if possible
   kubectl scale deployment <deployment-name> --replicas=<current+2>
   ```

2. Check OOM killer logs on node:
   ```bash
   kubectl get events --field-selector involvedObject.name=<pod-name>
   # Look for "OOMKilling" events
   ```

3. Monitor for automatic restart:
   ```bash
   kubectl get pods -w | grep <pod-name>
   ```

4. If service is critical and at risk:
   - Enable emergency rate limiting
   - Redirect traffic to healthy replicas
   - Prepare rollback if recent deployment

**Mitigations:**
- **DO NOT WAIT**: Increase memory limits or add replicas immediately
- If no quick fix available: Prepare for controlled restart during low-traffic window
- Clear application caches if safe to do so
- Reduce worker pool sizes or concurrent operations
- Check for resource leaks in recent code changes

**Follow-up:**
- **MANDATORY**: Root cause analysis within 24 hours
- P1 incident ticket with timeline and resolution steps
- Memory profiling and heap dump analysis
- Code review of recent changes
- Update resource requests/limits permanently
- Implement memory monitoring and alerting improvements

---

### ContainerMemoryNearLimit / ContainerOOMKilled

**When this fires:**
- ContainerMemoryNearLimit: >90% memory for 5+ minutes
- ContainerOOMKilled: Container killed by OOM killer

**For OOMKilled (most critical):**
1. **Immediate**: Container has been killed and likely restarting
   ```bash
   # Check restart count
   kubectl get pods | grep <pod-name>
   kubectl describe pod <pod-name> | grep -A 10 "Last State"
   ```

2. Review previous container logs (before OOM):
   ```bash
   kubectl logs <pod-name> -c <container-name> --previous
   ```

3. Check node memory pressure:
   ```bash
   kubectl describe node <node-name> | grep -A 5 "Conditions"
   ```

4. Increase memory limits BEFORE next restart:
   ```bash
   kubectl set resources deployment <name> -c=<container> --limits=memory=4Gi --requests=memory=2Gi
   ```

**Mitigations:**
- Immediately increase memory limits by 50-100%
- Scale horizontally if workload can be distributed
- Review and optimize memory-intensive operations
- Implement memory circuit breakers in application code
- Consider pod disruption budgets to maintain availability

**Follow-up:**
- Mandatory post-mortem for OOM kills in production
- Analyze memory dumps from failed containers
- Implement memory leak detection in CI/CD pipeline
- Set up preemptive alerts at lower thresholds (70-80%)
- Update deployment manifests with correct resource limits

---

## Disk/Storage Alerts

### ContainerDiskUsageHigh / ContainerDiskUsageWarning

**When this fires:**
- DiskUsageHigh: >90% disk usage for 5+ minutes (CRITICAL)
- DiskUsageWarning: >80% disk usage for 10+ minutes (WARNING)

**Possible causes:**
- Log files growing without rotation
- Temporary files not being cleaned up
- Application data growth (uploads, cache, database)
- Failed log shipping or archival
- Insufficient disk space allocated

**Immediate actions:**
1. Check current disk usage:
   ```bash
   kubectl exec <pod-name> -c <container-name> -- df -h
   docker exec <container-name> df -h
   ```

2. Find largest files/directories:
   ```bash
   kubectl exec <pod-name> -c <container-name> -- du -sh /* 2>/dev/null | sort -rh | head -10
   kubectl exec <pod-name> -c <container-name> -- find /var/log -type f -size +100M
   ```

3. Check for rapid growth:
   ```bash
   # Check recent file modifications
   kubectl exec <pod-name> -c <container-name> -- find / -type f -mmin -60 -size +10M 2>/dev/null
   ```

4. Review log rotation configuration:
   ```bash
   kubectl exec <pod-name> -c <container-name> -- ls -lah /var/log/
   ```

**Mitigations:**
- If logs filling disk: Force log rotation or truncate
  ```bash
  kubectl exec <pod-name> -c <container-name> -- truncate -s 0 /var/log/large-file.log
  ```
- If temp files: Clean up safely
  ```bash
  kubectl exec <pod-name> -c <container-name> -- find /tmp -type f -mtime +7 -delete
  ```
- If persistent volume: Expand PVC if supported
  ```bash
  kubectl patch pvc <pvc-name> -p '{"spec":{"resources":{"requests":{"storage":"20Gi"}}}}'
  ```
- If ephemeral storage: Increase ephemeral-storage limit
  ```bash
  kubectl set resources deployment <name> --limits=ephemeral-storage=10Gi
  ```

**Follow-up:**
- Configure proper log rotation (logrotate, sidecar, log shipper)
- Set up automated cleanup jobs for temp files
- Implement application-level data archival
- Monitor disk growth trends for capacity planning
- Update storage limits in deployment manifests
- Consider using external log aggregation (ELK, Datadog)

---

## Network Alerts

### ContainerNetworkSaturation

**When this fires:**
- Network receive or transmit rate >100MB/s for 5+ minutes

**Possible causes:**
- Traffic spike or DDoS attack
- Data synchronization or backup operations
- Websocket or streaming connections
- Database replication or large queries
- File uploads/downloads

**Immediate actions:**
1. Check network traffic patterns:
   ```bash
   kubectl exec <pod-name> -c <container-name> -- netstat -tunp
   curl http://localhost:3000/api/monitoring/containers/history?container=<name>&metric=network_rx&duration=30m
   ```

2. Identify top network consumers:
   ```bash
   kubectl exec <pod-name> -c <container-name> -- ss -tunp | awk '{print $5}' | sort | uniq -c | sort -rn | head -10
   ```

3. Check for unusual connection patterns:
   ```bash
   kubectl exec <pod-name> -c <container-name> -- netstat -an | grep ESTABLISHED | wc -l
   ```

**Mitigations:**
- If legitimate traffic: Scale horizontally or increase network bandwidth
- If DDoS: Enable rate limiting at ingress/WAF level
- If data sync: Throttle or schedule during off-peak hours
- If websockets: Review connection management and cleanup
- Consider CDN for static content or media delivery

**Follow-up:**
- Analyze traffic patterns and optimize data transfer
- Implement network-level rate limiting
- Review connection pooling and keep-alive settings
- Monitor for security threats or abuse
- Consider dedicated network bandwidth or QoS policies

---

### ContainerNetworkErrors

**When this fires:**
- Network receive or transmit errors >10/sec for 3+ minutes

**Possible causes:**
- Network infrastructure issues (switches, routers)
- MTU mismatch or packet fragmentation
- Network congestion or packet drops
- Faulty network interface or driver
- Container network plugin issues (CNI)

**Immediate actions:**
1. Check error types and rates:
   ```bash
   kubectl exec <pod-name> -c <container-name> -- ifconfig | grep -i error
   kubectl exec <pod-name> -c <container-name> -- ip -s link
   ```

2. Review node network health:
   ```bash
   kubectl get nodes -o wide
   kubectl describe node <node-name> | grep -A 10 "Conditions"
   ```

3. Check for packet drops:
   ```bash
   kubectl exec <pod-name> -c <container-name> -- netstat -i
   ```

4. Test network connectivity:
   ```bash
   kubectl exec <pod-name> -c <container-name> -- ping -c 5 8.8.8.8
   kubectl exec <pod-name> -c <container-name> -- curl -I https://google.com
   ```

**Mitigations:**
- If CNI issue: Restart network plugin or pod
- If node issue: Cordon and drain node, investigate hardware
- If MTU mismatch: Adjust MTU settings
  ```bash
  # Check MTU
  kubectl exec <pod-name> -c <container-name> -- ip link show
  ```
- If congestion: Implement network QoS or traffic shaping

**Follow-up:**
- Engage network engineering team for infrastructure review
- Review container network configuration
- Check for kernel or CNI plugin updates
- Monitor network error trends across all containers
- Document network topology and dependencies

---

## Container State Alerts

### ContainerRestartingFrequently

**When this fires:**
- Container restarted >3 times in 10 minutes

**Possible causes:**
- Application crashes or panics
- Failed health checks or readiness probes
- OOM kills (check memory alerts)
- Dependency failures (database, cache, external API)
- Configuration errors or missing secrets

**Immediate actions:**
1. Check restart history and reason:
   ```bash
   kubectl describe pod <pod-name> | grep -A 20 "State:"
   kubectl get events --field-selector involvedObject.name=<pod-name>
   ```

2. Review recent logs from all restarts:
   ```bash
   kubectl logs <pod-name> -c <container-name> --previous
   kubectl logs <pod-name> -c <container-name> --tail=200
   ```

3. Check health check configuration:
   ```bash
   kubectl describe pod <pod-name> | grep -A 5 "Liveness\|Readiness"
   ```

4. Verify dependencies are available:
   ```bash
   # Check database connectivity
   kubectl exec <pod-name> -c <container-name> -- nc -zv <db-host> <db-port>
   ```

**Mitigations:**
- If health check too aggressive: Adjust probe timings
  ```bash
  # Increase initialDelaySeconds, periodSeconds, failureThreshold
  kubectl edit deployment <deployment-name>
  ```
- If dependency issue: Fix or failover to backup
- If configuration: Validate and fix ConfigMaps/Secrets
- If crash loop: Increase logging verbosity and restart
- Temporarily increase restart backoff to prevent rapid restarts

**Follow-up:**
- Fix root cause of crashes (code bugs, resource limits)
- Review and optimize health check configurations
- Implement circuit breakers for external dependencies
- Add better error handling and graceful degradation
- Create runbook for specific failure patterns

---

### ContainerNotRunning / ContainerWaitingTooLong

**When this fires:**
- ContainerNotRunning: Container not in running state for 3+ minutes
- ContainerWaitingTooLong: Container in waiting state for 5+ minutes

**Possible causes:**
- Image pull failures (registry issues, auth, quota)
- Init container failures
- Volume mount failures (PVC not bound, permissions)
- Resource constraints (no available nodes)
- Container runtime errors

**Immediate actions:**
1. Check container status and reason:
   ```bash
   kubectl get pods <pod-name> -o yaml | grep -A 20 "containerStatuses:"
   kubectl describe pod <pod-name>
   ```

2. Common waiting reasons:
   - **ImagePullBackOff**: Check image exists and credentials
     ```bash
     kubectl get secret <registry-secret> -o yaml
     ```
   - **CreateContainerError**: Check volume mounts and permissions
   - **CrashLoopBackOff**: See ContainerRestartingFrequently section

3. Check node resources:
   ```bash
   kubectl top nodes
   kubectl describe node <node-name> | grep -A 10 "Allocated resources"
   ```

4. Check for pending volumes:
   ```bash
   kubectl get pvc | grep Pending
   ```

**Mitigations:**
- If image pull: Fix registry credentials or pull policy
  ```bash
  kubectl create secret docker-registry <name> --docker-server=<server> \
    --docker-username=<user> --docker-password=<pass>
  ```
- If resource constraints: Add nodes or free up resources
- If volume issue: Check PVC binding and storage class
- If init container: Fix init container issue first

**Follow-up:**
- Review deployment manifests for correctness
- Test deployments in staging before production
- Monitor image registry health and quotas
- Document common deployment issues and fixes
- Implement deployment validation pipelines

---

## Performance Alerts

### ContainerCPUThrottling

**When this fires:**
- Container CPU throttled >25% of the time for 5+ minutes

**Possible causes:**
- CPU limits set too low for workload
- Bursty workload patterns
- Noisy neighbors on shared nodes
- CPU quota exhausted

**Immediate actions:**
1. Check throttling metrics:
   ```bash
   curl http://localhost:3000/api/monitoring/containers/history?container=<name>&metric=cpu&duration=1h
   ```

2. Compare CPU usage to limits:
   ```bash
   kubectl describe pod <pod-name> | grep -A 10 "Limits\|Requests"
   kubectl top pod <pod-name> --containers
   ```

3. Check if throttling impacts performance:
   - Review application latency metrics
   - Check for increased error rates or timeouts

**Mitigations:**
- Increase CPU limits if justified:
  ```bash
  kubectl set resources deployment <name> -c=<container> --limits=cpu=2000m
  ```
- Adjust CPU requests to match actual usage
- Consider QoS class changes (Guaranteed vs Burstable)
- Smooth out bursty workloads with queues or rate limiting

**Follow-up:**
- Analyze CPU usage patterns and optimize code
- Right-size CPU limits based on actual needs
- Consider dedicated nodes for CPU-intensive workloads
- Review CPU quota policies and node capacity
- Implement better workload distribution

---

### ContainerHighIOWait

**When this fires:**
- Container I/O wait time >0.8 for 5+ minutes

**Possible causes:**
- Slow storage backend (network storage, over-provisioned disks)
- Large database queries or bulk operations
- Insufficient IOPS for workload
- Disk contention from other containers
- Storage driver performance issues

**Immediate actions:**
1. Check I/O metrics:
   ```bash
   kubectl exec <pod-name> -c <container-name> -- iostat -x 1 5
   ```

2. Identify I/O-intensive processes:
   ```bash
   kubectl exec <pod-name> -c <container-name> -- iotop -n 1 -b 2>/dev/null || \
   kubectl exec <pod-name> -c <container-name> -- ps aux --sort=-%io
   ```

3. Check for slow queries or operations:
   ```bash
   # For database containers
   kubectl logs <pod-name> | grep "slow query"
   ```

4. Review storage class performance:
   ```bash
   kubectl get pvc <pvc-name> -o yaml | grep storageClassName
   kubectl get storageclass
   ```

**Mitigations:**
- If database: Optimize queries, add indexes, tune cache
- If storage backend: Migrate to faster storage class (SSD, local NVMe)
- If bulk operations: Throttle or schedule during off-peak hours
- Increase IOPS limits if on cloud provider (EBS, PD)
- Consider caching layer (Redis) to reduce disk I/O

**Follow-up:**
- Performance tuning for database or I/O-intensive applications
- Upgrade to faster storage tiers
- Implement read replicas or caching strategies
- Monitor storage performance trends
- Review storage architecture and optimization opportunities

---

## General Troubleshooting Steps

### Quick Diagnostic Commands

```bash
# Pod overview
kubectl get pods -o wide | grep <pod-name>
kubectl describe pod <pod-name>

# Resource usage
kubectl top pod <pod-name> --containers
kubectl top node

# Logs
kubectl logs <pod-name> -c <container-name> --tail=100 -f
kubectl logs <pod-name> -c <container-name> --previous

# Events
kubectl get events --sort-by='.lastTimestamp' | head -20
kubectl get events --field-selector involvedObject.name=<pod-name>

# Container exec
kubectl exec -it <pod-name> -c <container-name> -- /bin/sh

# Configuration
kubectl get pod <pod-name> -o yaml
kubectl describe deployment <deployment-name>

# API monitoring
curl http://localhost:3000/api/monitoring/containers
curl http://localhost:3000/api/monitoring/containers?container=<name>
curl http://localhost:3000/api/monitoring/containers/history?container=<name>&metric=cpu&duration=1h
```

### Escalation Criteria

Escalate to on-call engineer if:
- Multiple critical alerts firing simultaneously
- OOM kills occurring repeatedly (>3 in 1 hour)
- Service degradation or outage detected
- Alerts persist after standard mitigation attempts
- Security concern suspected (DDoS, crypto mining, unauthorized access)
- Cross-service cascading failures

### Emergency Contacts

- **Platform Team**: #platform-oncall (Slack)
- **DevOps Lead**: platform-oncall@vibecode.dev (PagerDuty)
- **Security Team**: #security-incidents (for security-related issues)
- **Database Team**: #database-oncall (for DB container issues)

---

## Post-Incident Review Checklist

After resolving any critical container resource alert:

1. **Document Timeline**:
   - When alert fired
   - Actions taken and by whom
   - When issue was resolved
   - Impact on users/services

2. **Root Cause Analysis**:
   - What triggered the alert?
   - Why did it happen?
   - Was the alert threshold appropriate?

3. **Prevention**:
   - Update resource limits/requests
   - Fix code issues or memory leaks
   - Improve monitoring and alerting
   - Update runbook with lessons learned

4. **Communication**:
   - Notify stakeholders of resolution
   - Update status page if public-facing
   - Share post-mortem with team

5. **Action Items**:
   - Create tickets for permanent fixes
   - Schedule follow-up reviews
   - Update documentation
   - Improve alerting if needed

---

## Additional Resources

- [Container Monitoring Documentation](../../docs/monitoring/container-monitoring.md)
- [Infrastructure Monitoring README](../README.md)
- [Container Monitoring Dashboard](http://localhost:3000/monitoring/containers)
- [Datadog Container Dashboard](https://app.datadoghq.com/dashboard/)
- [Prometheus Alert Rules](../alerts/container-resource-alerts.yml)
- [AlertManager Configuration](../alertmanager.yml)

---

**Last Updated**: 2026-02-19
**Maintained By**: Platform Team
**Review Cycle**: Quarterly
