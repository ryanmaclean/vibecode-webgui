# OpenAI Agents Deployment Architecture

**Version:** 1.0.0
**Date:** 2025-10-02
**Status:** Production Ready

## Executive Summary

Comprehensive deployment infrastructure for OpenAI Agents integration in VibeCode, featuring containerized runtimes, Kubernetes orchestration, auto-scaling, monitoring, and CI/CD automation. Designed for high availability, cost optimization, and operational excellence.

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Load Balancer / Ingress                   │
│                  (NGINX + Istio Gateway)                     │
└────────────────────────┬────────────────────────────────────┘
                         │
         ┌───────────────┴───────────────┐
         │                               │
┌────────▼────────┐            ┌────────▼────────┐
│  OpenAI Agents  │            │   Monitoring    │
│   Deployment    │            │   Stack         │
│   (3-50 pods)   │◄───────────┤  (Prometheus +  │
│                 │            │   Grafana)      │
└────────┬────────┘            └─────────────────┘
         │
    ┌────┴────┐
    │         │
┌───▼───┐ ┌──▼────┐
│Storage│ │ Cache │
│(50GB) │ │(20GB) │
└───────┘ └───────┘
```

### Key Features

- **Multi-Environment Support**: Dev, Staging, Production configurations
- **Auto-Scaling**: CPU, memory, and custom metrics-based HPA
- **High Availability**: 3+ replicas with pod disruption budgets
- **Zero-Downtime Deployments**: Rolling updates with canary analysis
- **Comprehensive Monitoring**: Prometheus + Grafana + Datadog
- **Security**: RBAC, NetworkPolicy, Pod Security Standards
- **Disaster Recovery**: Automated backups with 7-30 day retention
- **Cost Optimization**: Resource requests/limits, spot instances

## Infrastructure Components

### 1. Docker Images

**Location:** `/docker/agents/`

#### Multi-Architecture Support
- AMD64 (x86_64)
- ARM64 (Apple Silicon, Graviton)

#### Image Specifications
```dockerfile
Base Image: python:3.11-slim
Runtime: Python 3.11 + Node.js 18
Size: ~500MB compressed
Layers: Optimized for caching
Security: Non-root user, minimal attack surface
```

#### Build Process
```bash
# Local build
docker build -t vibecode-openai-agents:dev docker/agents/

# Multi-arch build
docker buildx build --platform linux/amd64,linux/arm64 \
  -t ghcr.io/ryanmaclean/vibecode-openai-agents:latest \
  --push docker/agents/
```

### 2. Kubernetes Manifests

**Location:** `/k8s/agents/`

#### Base Configuration (`/k8s/agents/base/`)

| Resource | Purpose | Replicas/Size |
|----------|---------|---------------|
| Deployment | Agent runtime pods | 3-20 |
| Service | ClusterIP + Headless | - |
| HPA | Auto-scaling | CPU/Memory/Custom |
| PVC | Persistent storage | 50Gi |
| ConfigMap | Runtime config | - |
| Secret | API keys, credentials | - |
| ServiceMonitor | Prometheus scraping | - |
| NetworkPolicy | Traffic control | - |
| PDB | Availability guarantee | minAvailable: 2 |
| RBAC | Service account permissions | - |

#### Environment Overlays

**Development** (`/k8s/agents/overlays/dev/`)
- 1 replica
- Minimal resources (250m CPU, 512Mi RAM)
- Debug logging enabled
- No persistence
- Rapid iteration focus

**Staging** (`/k8s/agents/overlays/staging/`)
- 3 replicas
- Standard resources (500m CPU, 1Gi RAM)
- Production-like environment
- Daily backups
- Pre-production testing

**Production** (`/k8s/agents/overlays/production/`)
- 5-50 replicas (auto-scaled)
- High resources (1-4 CPU, 2-8Gi RAM)
- Warning-level logging
- 6-hour backups, 30-day retention
- Maximum reliability

### 3. Helm Chart

**Location:** `/k8s/agents/charts/openai-agents/`

#### Chart Structure
```
openai-agents/
├── Chart.yaml           # Chart metadata
├── values.yaml          # Default values
└── templates/
    ├── _helpers.tpl     # Template helpers
    ├── deployment.yaml
    ├── service.yaml
    ├── hpa.yaml
    ├── configmap.yaml
    ├── secret.yaml
    ├── servicemonitor.yaml
    ├── networkpolicy.yaml
    └── pdb.yaml
```

#### Installation
```bash
# Install from chart directory
helm install openai-agents k8s/agents/charts/openai-agents \
  --namespace openai-agents \
  --create-namespace \
  --values k8s/agents/overlays/production/values.yaml

# Upgrade existing deployment
helm upgrade openai-agents k8s/agents/charts/openai-agents \
  --namespace openai-agents \
  --reuse-values \
  --set image.tag=v1.2.3

# Rollback
helm rollback openai-agents -n openai-agents
```

## Auto-Scaling Strategy

### Horizontal Pod Autoscaler (HPA)

#### Metrics-Based Scaling
```yaml
Trigger Conditions:
  CPU Usage > 70%        → Scale up
  Memory Usage > 80%     → Scale up
  Active Sessions > 8    → Scale up
  Request Queue > 10     → Scale up
  Response Time P95 > 2s → Scale up

Scale Behavior:
  Scale Up:
    - Max 100% increase per 30s
    - Max 4 pods per 30s
  Scale Down:
    - Max 50% decrease per 60s
    - Max 2 pods per 60s
    - Stabilization window: 5 minutes
```

#### Custom Metrics
- `agent_active_sessions`: Active agent sessions per pod
- `agent_request_queue_depth`: Pending requests in queue
- `agent_response_time_p95`: 95th percentile response time

### Vertical Pod Autoscaler (VPA)
```yaml
# Optional - for resource optimization
Update Mode: Auto
Min Allowed:
  CPU: 250m
  Memory: 512Mi
Max Allowed:
  CPU: 8
  Memory: 16Gi
```

## Monitoring and Observability

### 1. Prometheus Metrics

**Location:** `/k8s/agents/base/servicemonitor.yaml`

#### Application Metrics
```
# Session metrics
agent_active_sessions{namespace, pod}
agent_session_duration_seconds{namespace, pod}

# Request metrics
agent_requests_total{namespace, pod, status}
agent_response_time_seconds{namespace, pod, quantile}

# Error metrics
agent_errors_total{namespace, pod, error_type}
agent_error_rate{namespace, pod}

# OpenAI API metrics
openai_api_calls_total{namespace, pod, model}
openai_api_duration_seconds{namespace, pod, model}
openai_tokens_used_total{namespace, pod, model}

# Resource metrics
container_cpu_usage_seconds_total
container_memory_working_set_bytes
container_network_receive_bytes_total
```

#### Kubernetes Metrics
```
kube_deployment_status_replicas_available
kube_pod_container_status_restarts_total
kube_pod_container_resource_requests
kube_pod_container_resource_limits
```

### 2. Grafana Dashboard

**Location:** `/k8s/agents/monitoring/grafana-dashboard.json`

#### Dashboard Panels
1. **Active Sessions** - Real-time session count
2. **Request Rate** - Requests per second by status
3. **Response Time Percentiles** - P50, P95, P99 latency
4. **Error Rate** - Errors by type
5. **CPU Usage** - Container CPU utilization
6. **Memory Usage** - Container memory utilization
7. **Pod Availability** - Available vs desired replicas
8. **OpenAI API Latency** - External API response times
9. **Token Usage** - Token consumption by model
10. **Pod Status** - Detailed pod information table
11. **Network I/O** - Network traffic
12. **Pod Restarts** - Container restart count

#### Alert Rules
```yaml
Alerts:
  - HighErrorRate: >5% errors for 5 minutes
  - HighResponseTime: P95 > 5s for 5 minutes
  - PodCrashLooping: Restarts > 0 in 15 minutes
  - HighMemoryUsage: >90% memory for 5 minutes
  - NoAgentsAvailable: <2 pods available for 2 minutes
```

### 3. Datadog Integration

```yaml
Configuration:
  - APM Tracing: Enabled
  - Log Collection: JSON format
  - Profiling: Continuous profiling
  - Metrics: Custom metrics via DogStatsD
  - RUM: Real User Monitoring (if applicable)

Tags:
  - environment: production
  - service: openai-agents
  - version: 1.0.0
```

## CI/CD Pipeline

**Location:** `/.github/workflows/agents.yml`

### Pipeline Stages

```
┌──────────────────────────────────────────────────────────┐
│ 1. Lint & Validate                                       │
│    ├── Python linting (black, flake8, pylint)           │
│    ├── Type checking (mypy)                             │
│    ├── Kubernetes manifest validation                   │
│    ├── Helm chart validation                            │
│    └── Security scanning (Kubescape)                    │
└──────────────┬───────────────────────────────────────────┘
               │
┌──────────────▼───────────────────────────────────────────┐
│ 2. Build & Test                                          │
│    ├── Unit tests (pytest)                              │
│    ├── Integration tests                                │
│    ├── Coverage reporting (codecov)                     │
│    └── Matrix testing (Python 3.10, 3.11, 3.12)        │
└──────────────┬───────────────────────────────────────────┘
               │
┌──────────────▼───────────────────────────────────────────┐
│ 3. Build Docker Image                                    │
│    ├── Multi-arch build (AMD64, ARM64)                  │
│    ├── Push to GHCR                                     │
│    ├── Image signing (cosign)                           │
│    └── Vulnerability scanning (Trivy)                   │
└──────────────┬───────────────────────────────────────────┘
               │
┌──────────────▼───────────────────────────────────────────┐
│ 4. Integration Tests (Kind)                              │
│    ├── Deploy to Kind cluster                           │
│    ├── Run integration tests                            │
│    └── Collect logs on failure                          │
└──────────────┬───────────────────────────────────────────┘
               │
      ┌────────┴────────┐
      │                 │
┌─────▼─────┐    ┌─────▼─────┐
│  Deploy   │    │  Deploy   │
│    Dev    │    │  Staging  │
│           │    │           │
│  develop  │    │   main    │
│  branch   │    │  branch   │
└─────┬─────┘    └─────┬─────┘
      │                │
      └────────┬───────┘
               │
        ┌──────▼──────┐
        │   Deploy    │
        │ Production  │
        │             │
        │ (Canary +   │
        │  Full)      │
        └─────────────┘
```

### Deployment Strategy

#### Development
```yaml
Trigger: Push to develop branch
Target: vibecode-dev-aks
Strategy: Direct deployment
Replicas: 1
Testing: Smoke tests only
```

#### Staging
```yaml
Trigger: Push to main branch
Target: vibecode-staging-aks
Strategy: Rolling update
Replicas: 3
Testing: Full integration tests
Approval: None (automatic)
```

#### Production
```yaml
Trigger: Push to main branch (after staging)
Target: vibecode-prod-aks
Strategy: Canary → Full rollout
Canary Phase:
  - Deploy 1 replica with new version
  - Monitor for 60 seconds
  - Check error rate < 1%
  - Rollback on failure
Full Rollout:
  - Scale to 3 replicas
  - Monitor continuously
  - Create GitHub release
Approval: Manual environment approval
```

### Rollback Procedure
```bash
# Automatic rollback on failure
helm rollback openai-agents -n openai-agents

# Manual rollback to specific revision
helm rollback openai-agents 5 -n openai-agents

# Check rollback status
helm history openai-agents -n openai-agents
```

## Backup and Disaster Recovery

### Backup Strategy

#### Automated Backups
```yaml
Schedule:
  Development: None
  Staging: Daily at 03:00 UTC
  Production: Every 6 hours

Retention:
  Staging: 7 days
  Production: 30 days

Storage:
  Provider: Azure Blob Storage
  Redundancy: GRS (Geo-Redundant Storage)
  Encryption: AES-256
```

#### Backup Contents
- Persistent volume data (sessions, cache)
- ConfigMaps and Secrets (encrypted)
- Deployment state and configuration
- Database snapshots (if applicable)

#### Backup CronJob
```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: openai-agents-backup
spec:
  schedule: "0 */6 * * *"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: azure-cli:latest
            command:
            - /scripts/backup.sh
            volumeMounts:
            - name: data
              mountPath: /data
```

### Disaster Recovery

#### Recovery Time Objective (RTO)
- **Development:** 4 hours
- **Staging:** 2 hours
- **Production:** 30 minutes

#### Recovery Point Objective (RPO)
- **Development:** 24 hours
- **Staging:** 24 hours
- **Production:** 6 hours

#### Recovery Procedures

1. **Complete Cluster Failure**
```bash
# 1. Provision new AKS cluster
az aks create --name vibecode-dr-aks --resource-group vibecode-dr-rg

# 2. Install prerequisites (cert-manager, ingress-nginx)
helm install cert-manager jetstack/cert-manager --namespace cert-manager
helm install ingress-nginx ingress-nginx/ingress-nginx --namespace ingress-nginx

# 3. Restore from backup
./scripts/restore-from-backup.sh --date 2025-10-02 --time 18:00

# 4. Deploy agents
helm install openai-agents k8s/agents/charts/openai-agents \
  --namespace openai-agents \
  --values k8s/agents/overlays/production/values.yaml

# 5. Verify deployment
kubectl get pods -n openai-agents
curl https://agents.vibecode.io/health
```

2. **Partial Service Degradation**
```bash
# Scale up replicas
kubectl scale deployment openai-agents -n openai-agents --replicas=10

# Force pod recreation
kubectl rollout restart deployment openai-agents -n openai-agents

# Check pod distribution
kubectl get pods -n openai-agents -o wide
```

3. **Data Corruption**
```bash
# Restore from specific backup
./scripts/restore-data.sh --backup-id backup-20251002-180000

# Verify data integrity
kubectl exec -n openai-agents openai-agents-0 -- /scripts/verify-data.sh
```

## Cost Optimization

### Resource Management

#### Right-Sizing Strategy
```yaml
Development:
  CPU Request: 250m (cost: ~$2/month)
  Memory Request: 512Mi (cost: ~$1/month)
  Total per pod: ~$3/month
  Expected pods: 1
  Monthly cost: ~$3

Staging:
  CPU Request: 500m (cost: ~$4/month)
  Memory Request: 1Gi (cost: ~$2/month)
  Total per pod: ~$6/month
  Expected pods: 3
  Monthly cost: ~$18

Production:
  CPU Request: 1 (cost: ~$8/month)
  Memory Request: 2Gi (cost: ~$4/month)
  Total per pod: ~$12/month
  Expected pods: 5-50
  Average pods: 10
  Monthly cost: ~$120
```

#### Storage Costs
```yaml
Development:
  Data PVC: 0Gi (emptyDir) - $0
  Cache PVC: 0Gi (emptyDir) - $0

Staging:
  Data PVC: 50Gi Standard - $10/month
  Cache PVC: 20Gi Standard - $4/month
  Total: $14/month

Production:
  Data PVC: 200Gi Premium - $80/month
  Cache PVC: 100Gi Premium - $40/month
  Backup Storage: 500Gi GRS - $25/month
  Total: $145/month
```

#### Total Cost Estimate
```
Development: $3/month
Staging: $32/month
Production: $265/month (base) to $745/month (peak)

Annual Total: $3,600 - $9,300
```

### Cost Optimization Strategies

1. **Auto-Scaling Optimization**
   - Scale down during off-peak hours (nights, weekends)
   - Use predictive scaling based on historical patterns
   - Target 70-80% resource utilization

2. **Spot Instances**
   - Use Azure Spot VMs for non-critical workloads
   - Potential savings: 60-80%
   - Implement pod disruption budgets to handle evictions

3. **Resource Limits**
   - Set appropriate CPU/memory limits to prevent over-provisioning
   - Monitor actual usage vs. requests/limits
   - Adjust based on metrics

4. **Storage Optimization**
   - Lifecycle policies for backup retention
   - Compress logs and session data
   - Use appropriate storage tiers

5. **Network Optimization**
   - Use internal load balancers where possible
   - Minimize cross-region traffic
   - Implement caching strategies

### Cost Monitoring
```yaml
Tools:
  - Azure Cost Management
  - Kubecost (Kubernetes cost allocation)
  - Datadog Cost Monitoring

Alerts:
  - Daily cost > $50
  - Weekly cost > $300
  - Monthly projection > $10,000

Reports:
  - Weekly cost breakdown by namespace
  - Monthly resource utilization report
  - Quarterly cost optimization recommendations
```

## Security

### Pod Security

#### Security Context
```yaml
securityContext:
  runAsNonRoot: true
  runAsUser: 1000
  fsGroup: 1000
  seccompProfile:
    type: RuntimeDefault

containerSecurityContext:
  allowPrivilegeEscalation: false
  readOnlyRootFilesystem: true
  capabilities:
    drop: ["ALL"]
```

#### Network Policy
```yaml
Ingress:
  - Allow from ingress-nginx namespace (port 8080)
  - Allow from monitoring namespace (port 9090)
  - Allow from kube-system namespace (port 8081)

Egress:
  - Allow DNS (port 53)
  - Allow HTTPS (port 443) for OpenAI API
  - Allow database (ports 5432, 6379)
```

### Secrets Management

#### External Secrets Operator
```yaml
Backend: Azure Key Vault
Refresh Interval: 1 hour
Auto-rotation: Enabled

Secrets:
  - openai-api-key
  - openai-org-id
  - database-url
  - redis-url
  - jwt-secret
  - datadog-api-key
```

#### Best Practices
- Never commit secrets to Git
- Use Azure Key Vault for production secrets
- Rotate secrets quarterly
- Enable secret auditing
- Use workload identity for Azure resources

### Image Security

#### Scanning
```yaml
Tools:
  - Trivy (vulnerabilities)
  - Kubescape (misconfigurations)
  - Cosign (image signing)

Frequency:
  - On build (CI/CD)
  - Daily scheduled scans
  - On-demand scans

Severity Thresholds:
  Development: High
  Staging: Medium
  Production: Low (all vulnerabilities)
```

## Operations Guide

### Deployment Commands

#### Install
```bash
# Using Helm
helm install openai-agents k8s/agents/charts/openai-agents \
  --namespace openai-agents \
  --create-namespace \
  --values k8s/agents/overlays/production/values.yaml

# Using Kustomize
kubectl apply -k k8s/agents/overlays/production/
```

#### Upgrade
```bash
# Helm upgrade
helm upgrade openai-agents k8s/agents/charts/openai-agents \
  --namespace openai-agents \
  --reuse-values \
  --set image.tag=v1.2.3

# Rollout restart
kubectl rollout restart deployment/openai-agents -n openai-agents
```

#### Scale
```bash
# Manual scaling
kubectl scale deployment openai-agents -n openai-agents --replicas=10

# Update HPA limits
kubectl patch hpa openai-agents -n openai-agents \
  -p '{"spec":{"maxReplicas":30}}'
```

#### Rollback
```bash
# Helm rollback
helm rollback openai-agents -n openai-agents

# Kubectl rollback
kubectl rollout undo deployment/openai-agents -n openai-agents
```

### Troubleshooting

#### Pod Not Starting
```bash
# Check pod status
kubectl get pods -n openai-agents
kubectl describe pod <pod-name> -n openai-agents

# Check events
kubectl get events -n openai-agents --sort-by='.lastTimestamp'

# Check logs
kubectl logs <pod-name> -n openai-agents --previous
```

#### High Error Rate
```bash
# Check error metrics
curl https://agents.vibecode.io/metrics | grep agent_errors_total

# Check application logs
kubectl logs -n openai-agents -l app=openai-agents --tail=100

# Check Datadog APM
# Navigate to APM → Services → openai-agents
```

#### Performance Issues
```bash
# Check resource usage
kubectl top pods -n openai-agents

# Check HPA status
kubectl get hpa -n openai-agents
kubectl describe hpa openai-agents -n openai-agents

# Check node resource availability
kubectl top nodes
```

#### Network Issues
```bash
# Test internal connectivity
kubectl run test-pod --rm -it --image=busybox -- wget -O- http://openai-agents.openai-agents.svc.cluster.local/health

# Check network policies
kubectl get networkpolicies -n openai-agents
kubectl describe networkpolicy openai-agents-network-policy -n openai-agents

# Check service endpoints
kubectl get endpoints -n openai-agents
```

### Health Checks

#### Liveness Probe
```bash
# Manual check
kubectl exec -n openai-agents <pod-name> -- curl http://localhost:8081/health/live

# Expected response
{"status":"ok","timestamp":"2025-10-02T12:00:00Z"}
```

#### Readiness Probe
```bash
# Manual check
kubectl exec -n openai-agents <pod-name> -- curl http://localhost:8081/health/ready

# Expected response
{"status":"ready","dependencies":{"database":"ok","redis":"ok","openai":"ok"}}
```

#### Startup Probe
```bash
# Manual check
kubectl exec -n openai-agents <pod-name> -- curl http://localhost:8081/health/startup

# Expected response
{"status":"started","uptime":"45s"}
```

## Testing Strategy

### Unit Tests
```bash
# Run unit tests
pytest tests/agents/unit/ -v --cov=src/agents

# Expected coverage: >80%
```

### Integration Tests
```bash
# Deploy to Kind cluster
kind create cluster --config k8s/kind-test-config.yaml

# Install agents
helm install openai-agents k8s/agents/charts/openai-agents \
  --set persistence.enabled=false

# Run tests
pytest tests/agents/integration/ -v
```

### Load Tests
```bash
# Using k6
k6 run --vus 100 --duration 5m tests/agents/load/scenario.js

# Using hey
hey -n 10000 -c 100 https://agents.vibecode.io/api/v1/agent/execute
```

### Smoke Tests
```bash
# Health check
curl -f https://agents.vibecode.io/health

# Metrics endpoint
curl -f https://agents.vibecode.io/metrics

# API endpoint
curl -X POST https://agents.vibecode.io/api/v1/agent/execute \
  -H "Content-Type: application/json" \
  -d '{"prompt":"test","model":"gpt-4"}'
```

## Future Enhancements

### Planned Features
1. **Multi-Region Deployment**
   - Active-active across Azure regions
   - Global load balancing with Traffic Manager
   - Cross-region replication

2. **Advanced Auto-Scaling**
   - Predictive scaling with machine learning
   - Custom metrics from application telemetry
   - Integration with Azure Monitor autoscale

3. **Enhanced Monitoring**
   - SLO/SLI tracking with error budgets
   - Distributed tracing with OpenTelemetry
   - Synthetic monitoring from multiple locations

4. **Cost Optimization**
   - Spot instance pools with fallback
   - Reserved instance recommendations
   - Automatic rightsizing with VPA

5. **Security Enhancements**
   - Workload identity for Azure services
   - mTLS between services with Istio
   - Runtime security with Falco

## References

### Documentation
- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Helm Documentation](https://helm.sh/docs/)
- [Azure AKS Documentation](https://docs.microsoft.com/en-us/azure/aks/)
- [OpenAI API Documentation](https://platform.openai.com/docs/)

### Tools
- [kubectl](https://kubernetes.io/docs/tasks/tools/)
- [helm](https://helm.sh/docs/intro/install/)
- [k9s](https://k9scli.io/)
- [kubectx/kubens](https://github.com/ahmetb/kubectx)
- [stern](https://github.com/stern/stern)

### Monitoring
- [Prometheus](https://prometheus.io/docs/)
- [Grafana](https://grafana.com/docs/)
- [Datadog](https://docs.datadoghq.com/)

## Support

### Contact Information
- **DevOps Team:** devops@vibecode.io
- **On-Call:** PagerDuty escalation
- **Slack Channel:** #vibecode-infrastructure

### Runbooks
- [Incident Response](./runbooks/incident-response.md)
- [Deployment Procedures](./runbooks/deployment.md)
- [Troubleshooting Guide](./runbooks/troubleshooting.md)
- [Disaster Recovery](./runbooks/disaster-recovery.md)

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-10-02 | DevOps Team | Initial deployment architecture |

---

**Document Status:** Complete
**Last Updated:** 2025-10-02
**Next Review:** 2025-11-02
