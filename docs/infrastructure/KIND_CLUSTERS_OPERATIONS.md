# KIND Clusters Operations Guide

Last Updated: 2026-02-05

## Overview

This project runs 3 KIND (Kubernetes in Docker) clusters on a single machine sharing **24GB of Docker VM disk space**. Disk pressure is a recurring challenge.

## Cluster Architecture

| Cluster | Context | Nodes | Purpose |
|---------|---------|-------|---------|
| kind-tundra-dome | kind-tundra-dome | control-plane + 1 worker | Main development cluster |
| kind-gastown | kind-gastown | control-plane + 2 workers | Secondary/staging cluster |
| kind-vibecode-local | kind-vibecode-local | control-plane + 1 worker | Local development/testing |

### Node Details

All nodes run:
- **OS**: Debian GNU/Linux 12 (bookworm)
- **Kubernetes**: v1.35.0
- **Container Runtime**: containerd 2.2.0
- **Kernel**: 6.12.65-linuxkit

### Network Configuration

| Node | Internal IP |
|------|-------------|
| tundra-dome-control-plane | 172.18.0.7 |
| tundra-dome-worker | 172.18.0.4 |
| gastown-control-plane | 172.18.0.5 |
| gastown-worker | 172.18.0.3 |
| gastown-worker2 | 172.18.0.8 |
| vibecode-local-control-plane | 172.18.0.6 |
| vibecode-local-worker | 172.18.0.2 |

## Disk Management

### Critical Thresholds

- **Warning**: 85% disk usage
- **Critical**: 90% disk usage
- **Emergency**: 95% disk usage (pod evictions may occur)

### Cleanup Commands

#### Quick Cleanup (Unused Images)

```bash
for node in tundra-dome-control-plane tundra-dome-worker gastown-control-plane gastown-worker gastown-worker2 vibecode-local-control-plane vibecode-local-worker; do
  echo "=== Cleaning $node ==="
  docker exec $node crictl rmi --prune 2>/dev/null
done
```

#### Check Disk Usage on All Nodes

```bash
for node in tundra-dome-control-plane tundra-dome-worker gastown-control-plane gastown-worker gastown-worker2 vibecode-local-control-plane vibecode-local-worker; do
  echo "=== $node ==="
  docker exec $node df -h / | tail -1
done
```

#### Docker System Cleanup (Host)

```bash
# Show disk usage
docker system df

# Prune unused data (careful - removes stopped containers, unused networks, dangling images)
docker system prune

# Aggressive cleanup (removes all unused images, not just dangling)
docker system prune -a
```

## Pod Health Monitoring

### Check Pods Across All Clusters

```bash
# Tundra Dome
kubectl --context kind-tundra-dome get pods -A

# Gastown
kubectl --context kind-gastown get pods -A

# Vibecode Local
kubectl --context kind-vibecode-local get pods -A
```

### Common Pod Issues

| Issue | Cause | Resolution |
|-------|-------|------------|
| OOMKilled | Memory limit exceeded | Increase memory limits or optimize app |
| Pending | Insufficient resources | Scale down other pods or cleanup disk |
| CrashLoopBackOff | Application error | Check logs: `kubectl logs <pod>` |
| ImagePullBackOff | Image not available | Check image name/registry access |

## Resource Limits Summary

### Tundra-Dome Namespace Workloads

| Pod | CPU Request | CPU Limit | Memory Request | Memory Limit |
|-----|-------------|-----------|----------------|--------------|
| airflow-api-server | 200m | 1 | 768Mi-1Gi | 2-3Gi |
| kafka | 250m | 500m | 512Mi | 1Gi |
| gt-kafka-consumer | 100m | 250m | 256Mi | 512Mi |
| td-event-emitter | 100m | 250m | 256Mi | 512Mi |
| tundra-observer | 100m | 250m | 256Mi | 512Mi |
| polecat-worker | 50m | 200m | 128Mi | 256Mi |

## Persistent Volumes (Gastown Cluster)

| PVC | Namespace | Capacity | Status |
|-----|-----------|----------|--------|
| airflow-airflow-pvc | tundra-dome | 5Gi | Bound |
| gitea-gitea-pvc | tundra-dome | 5Gi | Bound |
| kafka-data-kafka-kafka-0 | tundra-dome | 10Gi | Bound |

## Monitoring Stack

All clusters have Datadog agents deployed:

| Cluster | Namespace | Components |
|---------|-----------|------------|
| kind-tundra-dome | datadog | datadog-agent, datadog-cluster-agent, datadog-operator |
| kind-gastown | datadog | datadog-agent (x2), datadog-cluster-agent |
| kind-vibecode-local | datadog-system | datadog (x2), datadog-cluster-agent, datadog-operator |

## Troubleshooting

### High Disk Usage

1. Check current usage:
   ```bash
   docker exec tundra-dome-control-plane df -h /
   ```

2. Run image cleanup across all nodes (see cleanup commands above)

3. Check for large PVCs:
   ```bash
   kubectl get pvc -A --context kind-gastown
   ```

4. Delete completed/failed pods:
   ```bash
   kubectl delete pods --field-selector=status.phase==Succeeded -A
   kubectl delete pods --field-selector=status.phase==Failed -A
   ```

### OOMKilled Pods

The Airflow API server is known to OOMKill with 2Gi limit. Options:
1. Increase memory limit to 3Gi
2. Use SequentialExecutor (already configured)
3. Reduce DAG complexity

### Pending Datadog Agent

If datadog-agent shows Pending with port conflicts:
- Check node affinity rules
- Verify no duplicate DaemonSets
- Check for port 10255/10250 conflicts

## Configuration Files

KIND cluster configurations are located at:
- `/platforms/kubernetes/k8s/kind-config.yaml`
- `/platforms/kubernetes/k8s/kind-vibecode-local.yaml`
- `/platforms/kubernetes/k8s/kind-cluster-config.yaml`

## Optimization Recommendations

### Critical (Implement Now)

1. **Increase Docker VM disk**: Current 24GB is insufficient for 3 clusters. Recommend 40-50GB minimum.
   - Docker Desktop: Settings > Resources > Virtual disk limit
   - Colima: `colima start --disk 50`

2. **Automated cleanup cron job**: Install the alert script:
   ```bash
   # Add to crontab (crontab -e):
   */15 * * * * /Users/studio/gt/mbp_m1/crew/default/scripts/monitoring/kind-disk-alert.sh >> /tmp/kind-disk-alert.log 2>&1
   ```

3. **Fix OOMKilled Airflow pods**: The airflow-api-server needs 3Gi memory limit (not 2Gi) to avoid OOMKill loops.

### High Priority

4. **Consolidate clusters**: Consider reducing from 3 to 2 clusters:
   - Merge `kind-tundra-dome` and `kind-gastown` workloads
   - Keep `kind-vibecode-local` for isolated development

5. **Implement local image registry**: Avoid re-pulling images on every restart:
   ```bash
   # Create a local registry
   docker run -d --restart=always -p 5000:5000 --name registry registry:2

   # Configure KIND to use it (in kind-config.yaml):
   containerdConfigPatches:
   - |-
     [plugins."io.containerd.grpc.v1.cri".registry.mirrors."localhost:5000"]
       endpoint = ["http://registry:5000"]
   ```

6. **Reduce PVC sizes**: Current allocations may be oversized:
   - Kafka: 10Gi allocated, likely using <1Gi
   - Airflow: 5Gi allocated
   - Gitea: 5Gi allocated, using 60KB

### Medium Priority

7. **Install metrics-server**: Enable `kubectl top` for resource monitoring:
   ```bash
   kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
   ```

8. **Configure resource quotas**: Prevent namespace from consuming too many resources

9. **Implement log rotation**: Configure containerd log rotation to prevent log bloat

### Disk Usage Analysis (2026-02-05)

| Component | Size | Notes |
|-----------|------|-------|
| Docker Volumes (KIND nodes) | ~20GB | Shared overlay filesystem |
| Container images per node | 500MB-1GB | After cleanup |
| Containerd snapshots | 3-6GB per worker | Varies by workload |
| PVCs | Up to 20Gi allocated | Actual usage much lower |

## Monitoring Scripts

### Health Check Script

```bash
# Full health check with optional cleanup
./scripts/monitoring/kind-cluster-health.sh --verbose
./scripts/monitoring/kind-cluster-health.sh --cleanup
```

### Disk Alert Script (Cron)

```bash
# Test the alert script
./scripts/monitoring/kind-disk-alert.sh

# Install in crontab for 15-minute checks
crontab -e
# Add: */15 * * * * /path/to/scripts/monitoring/kind-disk-alert.sh >> /tmp/kind-disk-alert.log 2>&1
```

## Quick Reference

```bash
# Switch contexts
kubectl config use-context kind-tundra-dome
kubectl config use-context kind-gastown
kubectl config use-context kind-vibecode-local

# Check cluster health
kubectl get nodes
kubectl get pods -A

# Resource usage (requires metrics-server)
kubectl top nodes
kubectl top pods -A
```
