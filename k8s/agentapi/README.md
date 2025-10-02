# AgentAPI Kubernetes Deployment

Complete Kubernetes manifests for deploying VibeCode with AgentAPI integration.

## Architecture

```
Pod: vibecode-workspace
├── Container: code-server (IDE)
│   ├── Port 8765 (HTTP)
│   ├── Resources: 500m-2000m CPU, 1-4Gi RAM
│   └── Volumes: workspace (RW), terminal (RW), config (RW)
│
├── Container: agentapi (Agent Controller)
│   ├── Port 3284 (HTTP API)
│   ├── Port 9090 (Metrics)
│   ├── Resources: 100m-500m CPU, 256Mi-1Gi RAM
│   └── Volumes: workspace (RO), terminal (RW), config (RO)
│
└── Shared Volumes
    ├── workspace (PVC 50Gi)
    ├── terminal (EmptyDir 100Mi Memory)
    └── config (EmptyDir 100Mi)
```

## Quick Start

### Prerequisites

1. Kubernetes cluster (v1.27+)
2. kubectl configured
3. Storage class `vibecode-ssd-storage` available
4. Container images pushed to registry

### Deploy All Resources

```bash
# Create namespace and RBAC
kubectl apply -f 00-namespace.yaml

# Create ConfigMap and Secrets
kubectl apply -f 01-configmap.yaml
kubectl apply -f 02-secrets.yaml

# Create Service and PVC
kubectl apply -f 03-service.yaml
kubectl apply -f 06-pvc.yaml

# Deploy workload
kubectl apply -f 04-deployment.yaml

# Configure autoscaling and policies
kubectl apply -f 05-hpa.yaml
kubectl apply -f 07-networkpolicy.yaml
kubectl apply -f 08-pdb.yaml
kubectl apply -f 09-priorityclass.yaml
```

### Verify Deployment

```bash
# Check pod status
kubectl -n vibecode-platform get pods -l app=code-server -w

# View logs
kubectl -n vibecode-platform logs -l app=code-server -c code-server --tail=50
kubectl -n vibecode-platform logs -l app=code-server -c agentapi --tail=50

# Check health
kubectl -n vibecode-platform exec -it <pod-name> -c agentapi -- curl http://127.0.0.1:3284/health

# View metrics
kubectl -n vibecode-platform exec -it <pod-name> -c agentapi -- curl http://127.0.0.1:9090/metrics
```

## Resource Configuration

### Per-Pod Resources

```yaml
code-server:
  requests: { cpu: 500m, memory: 1Gi }
  limits: { cpu: 2000m, memory: 4Gi }

agentapi:
  requests: { cpu: 100m, memory: 256Mi }
  limits: { cpu: 500m, memory: 1Gi }

Total per pod:
  requests: { cpu: 600m, memory: 1.25Gi }
  limits: { cpu: 2500m, memory: 5Gi }
```

### 100 Concurrent Pods

```
Total cluster resources:
  requests: { cpu: 60 cores, memory: 125 GiB }
  limits: { cpu: 250 cores, memory: 500 GiB }

Overhead vs standalone:
  CPU: 20% (10 cores)
  Memory: 25% (25 GiB)
```

## Horizontal Pod Autoscaler

Automatically scales pods based on:
- CPU utilization: 70% average
- Memory utilization: 80% average
- Active agents: 1 per pod average

```bash
# Check HPA status
kubectl -n vibecode-platform get hpa code-server-workspace-hpa

# View scaling events
kubectl -n vibecode-platform describe hpa code-server-workspace-hpa
```

Scale range: 1-100 pods

## Configuration

### Environment Variables (ConfigMap)

Edit `01-configmap.yaml` to configure:

```yaml
max_concurrent_agents: 2           # Max agents per pod
agent_timeout: 300                 # Agent timeout (seconds)
log_level: info                    # Log verbosity
resources:
  max_memory_mb: 512               # Memory limit per agent
  max_cpu_percent: 50              # CPU limit per agent
```

### Secrets

Update `02-secrets.yaml` with:

```bash
# Code-server password
kubectl -n vibecode-platform create secret generic code-server-config \
  --from-literal=password='your-secure-password' \
  --dry-run=client -o yaml | kubectl apply -f -

# AI provider API keys
kubectl -n vibecode-platform create secret generic agentapi-secrets \
  --from-literal=ANTHROPIC_API_KEY='sk-ant-xxx' \
  --from-literal=OPENAI_API_KEY='sk-xxx' \
  --dry-run=client -o yaml | kubectl apply -f -
```

## Health Checks

### Liveness Probes

- **code-server**: HTTP GET /healthz on port 8765
- **agentapi**: Exec health-check.sh script

### Readiness Probes

- **code-server**: HTTP GET /healthz on port 8765
- **agentapi**: Exec readiness-check.sh script

Checks:
- HTTP server responsiveness
- Terminal directory accessibility
- Agent process count
- Required commands availability

## Monitoring

### Prometheus Metrics

Metrics exposed on port 9090:

```
agentapi_active_agents_total
agentapi_agents_started_total
agentapi_agents_failed_total
agentapi_http_requests_total
agentapi_http_request_duration_seconds
agentapi_memory_usage_bytes
agentapi_cpu_usage_seconds_total
```

### Service Monitor (Prometheus Operator)

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: code-server-workspace
  namespace: vibecode-platform
spec:
  selector:
    matchLabels:
      app.kubernetes.io/name: vibecode
      app.kubernetes.io/component: workspace
  endpoints:
    - port: metrics
      interval: 30s
      path: /metrics
```

## Security

### Pod Security Standards

```yaml
securityContext:
  runAsNonRoot: true
  runAsUser: 1000
  runAsGroup: 1000
  fsGroup: 1000
  seccompProfile:
    type: RuntimeDefault

capabilities:
  drop: ["ALL"]
  add: ["NET_BIND_SERVICE"]
```

### Network Policy

Default deny-all with explicit allow rules:
- Allow IDE traffic from frontend (port 8765)
- Allow metrics scraping from Prometheus (port 9090)
- Allow egress to DNS, HTTPS, internal services

### RBAC

Minimal permissions:
- Read ConfigMaps and Secrets
- Get/List/Create/Update PVCs

## Troubleshooting

### Pod not starting

```bash
# Check events
kubectl -n vibecode-platform describe pod <pod-name>

# Check init containers
kubectl -n vibecode-platform logs <pod-name> -c init-terminal-dir
kubectl -n vibecode-platform logs <pod-name> -c init-agent-deps

# Check PVC status
kubectl -n vibecode-platform get pvc
kubectl -n vibecode-platform describe pvc code-server-workspace-pvc
```

### AgentAPI health check failing

```bash
# Check agentapi logs
kubectl -n vibecode-platform logs <pod-name> -c agentapi --tail=100

# Exec into container
kubectl -n vibecode-platform exec -it <pod-name> -c agentapi -- /bin/bash

# Test health endpoint
curl http://127.0.0.1:3284/health

# Check terminal directory
ls -la /tmp/terminals

# Check agent tools
aider --version
python3 --version
node --version
```

### High resource usage

```bash
# Check pod resource usage
kubectl top pod -n vibecode-platform -l app=code-server

# Check container-level metrics
kubectl top pod -n vibecode-platform <pod-name> --containers

# View detailed metrics
kubectl -n vibecode-platform exec -it <pod-name> -c agentapi -- curl http://127.0.0.1:9090/metrics
```

### Connection issues

```bash
# Test service connectivity
kubectl -n vibecode-platform run -it --rm debug --image=curlimages/curl --restart=Never -- \
  curl http://code-server-workspace.vibecode-platform.svc.cluster.local:8765/healthz

# Check NetworkPolicy
kubectl -n vibecode-platform get networkpolicies
kubectl -n vibecode-platform describe networkpolicy code-server-workspace-netpol

# Verify DNS
kubectl -n vibecode-platform run -it --rm debug --image=busybox --restart=Never -- \
  nslookup code-server-workspace.vibecode-platform.svc.cluster.local
```

## Upgrades

### Rolling Update

```bash
# Update image version
kubectl -n vibecode-platform set image deployment/code-server-workspace \
  code-server=ghcr.io/ryanmaclean/vibecode-codeserver:v1.3.0 \
  agentapi=ghcr.io/ryanmaclean/vibecode-agentapi:v0.2.0

# Monitor rollout
kubectl -n vibecode-platform rollout status deployment/code-server-workspace

# Check rollout history
kubectl -n vibecode-platform rollout history deployment/code-server-workspace
```

### Rollback

```bash
# Rollback to previous version
kubectl -n vibecode-platform rollout undo deployment/code-server-workspace

# Rollback to specific revision
kubectl -n vibecode-platform rollout undo deployment/code-server-workspace --to-revision=3
```

### Zero-Downtime Updates

Thanks to:
- `maxUnavailable: 0` in RollingUpdate strategy
- ReadinessProbe validation before traffic routing
- PodDisruptionBudget ensuring minimum availability

## Performance Tuning

### CPU Limits

Adjust based on workload:

```yaml
# Light workload (1-2 agents)
code-server: { cpu: 250m-1000m }
agentapi: { cpu: 50m-250m }

# Medium workload (3-5 agents)
code-server: { cpu: 500m-2000m }
agentapi: { cpu: 100m-500m }

# Heavy workload (5+ agents)
code-server: { cpu: 1000m-4000m }
agentapi: { cpu: 200m-1000m }
```

### Memory Optimization

```yaml
# Minimal profile
code-server: { memory: 512Mi-2Gi }
agentapi: { memory: 128Mi-512Mi }

# Standard profile (recommended)
code-server: { memory: 1Gi-4Gi }
agentapi: { memory: 256Mi-1Gi }

# AI/Full profile
code-server: { memory: 2Gi-8Gi }
agentapi: { memory: 512Mi-2Gi }
```

### Storage Performance

Use SSD-backed storage for workspace PVCs:

```yaml
storageClassName: vibecode-ssd-storage  # or
storageClassName: fast-ssd              # or
storageClassName: premium-rwo           # GKE
```

## Best Practices

1. **Resource Requests**: Always set requests for predictable scheduling
2. **Resource Limits**: Set limits to prevent resource exhaustion
3. **Health Checks**: Configure appropriate timeouts and thresholds
4. **Monitoring**: Enable Prometheus metrics for observability
5. **Security**: Apply Pod Security Standards and NetworkPolicies
6. **Backups**: Regular backups of workspace PVCs
7. **Secrets**: Use external secret management (Vault, AWS Secrets Manager)
8. **Affinity**: Use pod anti-affinity for high availability
9. **Autoscaling**: Enable HPA for dynamic scaling
10. **Updates**: Use rolling updates with zero downtime

## References

- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Horizontal Pod Autoscaler](https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/)
- [Pod Security Standards](https://kubernetes.io/docs/concepts/security/pod-security-standards/)
- [Network Policies](https://kubernetes.io/docs/concepts/services-networking/network-policies/)
- [Prometheus Operator](https://github.com/prometheus-operator/prometheus-operator)
