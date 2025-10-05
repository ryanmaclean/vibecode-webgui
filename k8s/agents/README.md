# OpenAI Agents - Kubernetes Infrastructure

Production-ready Kubernetes deployment infrastructure for OpenAI Agents integration in VibeCode.

## Quick Start

### Prerequisites
- Kubernetes cluster (1.28+)
- Helm 3.13+
- kubectl 1.28+
- Azure CLI (for Azure deployments)

### Installation

#### Option 1: Using Helm (Recommended)
```bash
# Install to production
helm install openai-agents charts/openai-agents \
  --namespace openai-agents \
  --create-namespace \
  --values overlays/production/values.yaml

# Install to staging
helm install openai-agents charts/openai-agents \
  --namespace openai-agents \
  --create-namespace \
  --values overlays/staging/values.yaml
```

#### Option 2: Using Kustomize
```bash
# Deploy to production
kubectl apply -k overlays/production/

# Deploy to staging
kubectl apply -k overlays/staging/
```

### Verification
```bash
# Check deployment status
kubectl get pods -n openai-agents

# Check service endpoints
kubectl get svc -n openai-agents

# Check ingress
kubectl get ingress -n openai-agents

# Test health endpoint
curl https://agents.vibecode.io/health
```

## Directory Structure

```
k8s/agents/
├── README.md                          # This file
├── base/                              # Base Kubernetes manifests
│   ├── configmap.yaml                 # Application configuration
│   ├── deployment.yaml                # Agent runtime deployment
│   ├── hpa.yaml                       # Horizontal Pod Autoscaler
│   ├── kustomization.yaml             # Kustomize base config
│   ├── namespace.yaml                 # Namespace with quotas
│   ├── networkpolicy.yaml             # Network traffic rules
│   ├── pdb.yaml                       # Pod Disruption Budget
│   ├── pvc.yaml                       # Persistent Volume Claims
│   ├── rbac.yaml                      # Service Account & RBAC
│   ├── secrets.yaml                   # Secrets (template)
│   ├── service.yaml                   # Service definitions
│   ├── servicemonitor.yaml            # Prometheus monitoring
│   └── backup-cronjob.yaml            # Backup automation
├── charts/                            # Helm charts
│   └── openai-agents/
│       ├── Chart.yaml                 # Chart metadata
│       ├── values.yaml                # Default values
│       └── templates/                 # Helm templates
│           ├── _helpers.tpl           # Template helpers
│           ├── configmap.yaml
│           ├── deployment.yaml
│           ├── hpa.yaml
│           ├── ingress.yaml
│           ├── pdb.yaml
│           ├── pvc.yaml
│           ├── secret.yaml
│           ├── service.yaml
│           └── serviceaccount.yaml
├── overlays/                          # Environment-specific configs
│   ├── dev/
│   │   └── values.yaml                # Development values
│   ├── staging/
│   │   └── values.yaml                # Staging values
│   └── production/
│       └── values.yaml                # Production values
└── monitoring/                        # Monitoring dashboards
    └── grafana-dashboard.json         # Grafana dashboard
```

## Configuration

### Environment Variables
```yaml
AGENT_CONFIG_PATH: /config/agent.yaml
LOGGING_CONFIG_PATH: /config/logging.yaml
OPENAI_API_KEY: <from-secret>
POD_NAME: <auto-injected>
POD_NAMESPACE: <auto-injected>
```

### Secrets
Create secrets before deployment:
```bash
# Using kubectl
kubectl create secret generic openai-agents-secrets \
  --namespace openai-agents \
  --from-literal=openai-api-key=<your-key> \
  --from-literal=openai-org-id=<your-org-id>

# Using Azure Key Vault (External Secrets Operator)
kubectl apply -f base/secrets.yaml
```

### Storage
```yaml
Data PVC:
  Size: 50Gi (dev) / 50Gi (staging) / 200Gi (production)
  StorageClass: azure-file-premium
  AccessMode: ReadWriteMany

Cache PVC:
  Size: 20Gi (dev) / 20Gi (staging) / 100Gi (production)
  StorageClass: azure-file-standard
  AccessMode: ReadWriteMany
```

## Auto-Scaling

### Horizontal Pod Autoscaler
```yaml
Min Replicas: 3 (production) / 3 (staging) / 1 (dev)
Max Replicas: 50 (production) / 10 (staging) / 1 (dev)

Metrics:
  - CPU: 70%
  - Memory: 80%
  - Active Sessions: 8 per pod
  - Request Queue: 10 per pod
```

### Scaling Behavior
```yaml
Scale Up:
  - Max 100% increase per 30s
  - Max 4 pods per 30s
  - Stabilization: 60s

Scale Down:
  - Max 50% decrease per 60s
  - Max 2 pods per 60s
  - Stabilization: 300s
```

## Monitoring

### Metrics Endpoints
- Application metrics: `http://<pod>:9090/metrics`
- Health check: `http://<pod>:8081/health/live`
- Readiness check: `http://<pod>:8081/health/ready`

### Grafana Dashboard
Import dashboard from `monitoring/grafana-dashboard.json`

### Key Metrics
- `agent_active_sessions` - Active agent sessions
- `agent_requests_total` - Total requests by status
- `agent_response_time_seconds` - Response time histogram
- `agent_errors_total` - Total errors by type
- `openai_api_calls_total` - OpenAI API calls
- `openai_tokens_used_total` - Token consumption

### Alerts
- High error rate (>5% for 5 minutes)
- High response time (P95 >5s for 5 minutes)
- Pod crash looping
- High memory usage (>90% for 5 minutes)
- Low pod availability (<2 pods for 2 minutes)

## Operations

### Common Tasks

#### Upgrade Deployment
```bash
# Helm upgrade
helm upgrade openai-agents charts/openai-agents \
  --namespace openai-agents \
  --reuse-values \
  --set image.tag=v1.2.3

# Rollout restart
kubectl rollout restart deployment/openai-agents -n openai-agents
```

#### Scale Manually
```bash
# Scale deployment
kubectl scale deployment openai-agents -n openai-agents --replicas=10

# Update HPA
kubectl patch hpa openai-agents -n openai-agents \
  --type=json \
  -p='[{"op":"replace","path":"/spec/maxReplicas","value":30}]'
```

#### View Logs
```bash
# All pods
kubectl logs -n openai-agents -l app=openai-agents --tail=100

# Specific pod
kubectl logs -n openai-agents <pod-name> -f

# Previous container logs
kubectl logs -n openai-agents <pod-name> --previous
```

#### Debug Pod
```bash
# Execute shell in pod
kubectl exec -it -n openai-agents <pod-name> -- /bin/bash

# Check configuration
kubectl exec -n openai-agents <pod-name> -- cat /config/agent.yaml

# Test health endpoint
kubectl exec -n openai-agents <pod-name> -- curl http://localhost:8081/health/live
```

#### Rollback
```bash
# Helm rollback
helm rollback openai-agents -n openai-agents

# Rollback to specific revision
helm rollback openai-agents 5 -n openai-agents

# Check history
helm history openai-agents -n openai-agents
```

### Backup and Restore

#### Manual Backup
```bash
# Trigger backup CronJob manually
kubectl create job --from=cronjob/openai-agents-backup \
  openai-agents-backup-manual-$(date +%s) \
  -n openai-agents
```

#### Restore from Backup
```bash
# List available backups
az storage blob list \
  --account-name <storage-account> \
  --container-name backups \
  --prefix openai-agents/

# Download backup
az storage blob download-batch \
  --account-name <storage-account> \
  --destination ./restore \
  --source backups \
  --pattern "openai-agents/openai-agents-backup-20251002-*"

# Extract and restore
tar xzf restore/data.tar.gz -C /mnt/data/
kubectl apply -f restore/configmap.yaml
kubectl apply -f restore/secrets.yaml
```

## Troubleshooting

### Pod Not Starting
```bash
# Check pod status
kubectl describe pod <pod-name> -n openai-agents

# Check events
kubectl get events -n openai-agents --sort-by='.lastTimestamp'

# Check resource availability
kubectl describe nodes
```

### High Error Rate
```bash
# Check application logs
kubectl logs -n openai-agents -l app=openai-agents --tail=200 | grep ERROR

# Check metrics
curl http://<pod-ip>:9090/metrics | grep agent_errors_total

# Check OpenAI API status
curl https://status.openai.com/api/v2/status.json
```

### Performance Issues
```bash
# Check resource usage
kubectl top pods -n openai-agents

# Check HPA status
kubectl get hpa -n openai-agents
kubectl describe hpa openai-agents -n openai-agents

# Check node resources
kubectl top nodes
```

### Network Issues
```bash
# Test service connectivity
kubectl run test-pod --rm -it --image=busybox -- \
  wget -O- http://openai-agents.openai-agents.svc.cluster.local/health

# Check network policies
kubectl get networkpolicies -n openai-agents
kubectl describe networkpolicy openai-agents-network-policy -n openai-agents

# Check service endpoints
kubectl get endpoints -n openai-agents
```

## Security

### Pod Security
- Non-root user (UID 1000)
- Read-only root filesystem
- No privilege escalation
- Dropped all capabilities
- Seccomp profile enabled

### Network Security
- Network policies enabled
- Ingress only from authorized namespaces
- Egress restricted to necessary services
- TLS encryption for external traffic

### Secrets Management
- External Secrets Operator for Azure Key Vault
- Automatic secret rotation
- Encrypted at rest and in transit
- Workload identity for Azure resources

## Cost Optimization

### Resource Optimization
- Right-sized CPU/memory requests
- Aggressive scale-down policies
- Spot instances for non-production
- Time-based scaling for off-hours

### Storage Optimization
- Tiered storage (hot/warm/cold)
- Compression enabled
- Incremental backups
- Lifecycle policies for retention

### Network Optimization
- Internal load balancers
- Response compression
- CDN for static content
- Regional traffic management

See [OPENAI_AGENTS_COST_OPTIMIZATION.md](../../claudedocs/OPENAI_AGENTS_COST_OPTIMIZATION.md) for details.

## CI/CD

### GitHub Actions Workflow
Located at `.github/workflows/agents.yml`

### Pipeline Stages
1. Lint and validate (Python, Kubernetes manifests, Helm charts)
2. Build and test (unit tests, integration tests, coverage)
3. Build Docker image (multi-arch, sign with cosign, scan vulnerabilities)
4. Integration tests (Kind cluster deployment)
5. Deploy to dev (automatic on develop branch)
6. Deploy to staging (automatic on main branch)
7. Deploy to production (canary rollout, manual approval)

### Deployment Strategy
- **Dev:** Direct deployment, 1 replica, rapid iteration
- **Staging:** Rolling update, 3 replicas, full integration tests
- **Production:** Canary rollout, 5-50 replicas, health checks, auto-rollback

## Documentation

### Core Documentation
- [Deployment Architecture](../../claudedocs/OPENAI_AGENTS_DEPLOYMENT.md)
- [Cost Optimization Guide](../../claudedocs/OPENAI_AGENTS_COST_OPTIMIZATION.md)

### External Resources
- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Helm Documentation](https://helm.sh/docs/)
- [Azure AKS Documentation](https://docs.microsoft.com/en-us/azure/aks/)
- [OpenAI API Documentation](https://platform.openai.com/docs/)

## Support

### Contact
- **DevOps Team:** devops@vibecode.io
- **On-Call:** PagerDuty escalation
- **Slack:** #vibecode-infrastructure

### Issue Reporting
1. Check logs: `kubectl logs -n openai-agents -l app=openai-agents`
2. Check metrics: Grafana dashboard or Datadog APM
3. Create incident: Include logs, metrics, and reproduction steps
4. Escalate: Contact on-call if critical

## License

MIT License - See LICENSE file for details

## Contributing

1. Create feature branch
2. Make changes and test locally (Kind cluster)
3. Update documentation
4. Submit pull request with tests
5. Wait for CI/CD pipeline to pass
6. Request review from DevOps team

---

**Last Updated:** 2025-10-02
**Maintained By:** VibeCode DevOps Team
**Version:** 1.0.0
