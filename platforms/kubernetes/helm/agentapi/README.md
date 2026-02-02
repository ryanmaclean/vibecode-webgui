# AgentAPI Helm Chart

Helm chart for deploying VibeCode workspaces with AgentAPI sidecar for AI agent control.

## Overview

This chart deploys a complete VibeCode workspace environment with:
- **code-server**: Browser-based IDE with VS Code interface
- **agentapi**: HTTP server for controlling AI coding agents (Aider, Goose, Cline)
- **PostgreSQL**: Optional embedded or external managed database
- **Redis**: Optional embedded or external managed cache
- **Monitoring**: Prometheus metrics and optional Datadog integration

## Prerequisites

- Kubernetes 1.23+
- Helm 3.8+
- PV provisioner support (for workspace persistence)
- Ingress controller (nginx recommended)
- cert-manager (for TLS)

## Installation

### Quick Start (Development)

```bash
# Add Bitnami repo for dependencies
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update

# Install with default values
helm install agentapi ./helm/agentapi \
  --namespace vibecode-platform \
  --create-namespace

# Get access URLs
kubectl get ingress -n vibecode-platform
```

### Production Deployment

```bash
# Install with production values
helm install agentapi ./helm/agentapi \
  --namespace vibecode-platform \
  --create-namespace \
  --values ./helm/agentapi/values-production.yaml \
  --set-sensitive externalPostgresql.host="your-rds-endpoint.amazonaws.com" \
  --set-sensitive externalPostgresql.password="your-db-password" \
  --set-sensitive externalRedis.host="your-elasticache-endpoint.amazonaws.com" \
  --set-sensitive externalRedis.password="your-redis-password"
```

### Custom Values

```bash
# Create custom values file
cat > custom-values.yaml <<EOF
global:
  environment: staging
  cloudProvider: aws

codeserver:
  image:
    tag: v1.0.0
  resources:
    limits:
      cpu: 4000m
      memory: 8Gi

agentapi:
  config:
    maxConcurrentAgents: 10
    logLevel: debug

ingress:
  hosts:
    - host: workspace.example.com
      paths:
        - path: /
          pathType: Prefix
EOF

# Install with custom values
helm install agentapi ./helm/agentapi \
  --namespace vibecode-platform \
  --values custom-values.yaml
```

## Configuration

### Core Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `global.environment` | Environment name (dev, staging, production) | `development` |
| `global.cloudProvider` | Cloud provider (aws, gcp, azure) | `aws` |
| `replicaCount` | Number of workspace replicas | `1` |

### Code-Server Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `codeserver.enabled` | Enable code-server container | `true` |
| `codeserver.image.repository` | Code-server image repository | `ghcr.io/ryanmaclean/vibecode-codeserver` |
| `codeserver.image.tag` | Code-server image tag | `latest` |
| `codeserver.resources.requests.cpu` | CPU request | `500m` |
| `codeserver.resources.requests.memory` | Memory request | `1Gi` |
| `codeserver.resources.limits.cpu` | CPU limit | `2000m` |
| `codeserver.resources.limits.memory` | Memory limit | `4Gi` |
| `codeserver.service.port` | Service port | `8765` |
| `codeserver.workspace.size` | Workspace PVC size | `50Gi` |

### AgentAPI Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `agentapi.enabled` | Enable agentapi sidecar | `true` |
| `agentapi.image.repository` | AgentAPI image repository | `ghcr.io/ryanmaclean/vibecode-agentapi` |
| `agentapi.image.tag` | AgentAPI image tag | `latest` |
| `agentapi.config.host` | AgentAPI bind address | `127.0.0.1` |
| `agentapi.config.port` | AgentAPI port | `3284` |
| `agentapi.config.logLevel` | Log level (debug, info, warn, error) | `info` |
| `agentapi.config.maxConcurrentAgents` | Max concurrent agents | `5` |
| `agentapi.config.agentTimeout` | Agent timeout in seconds | `300` |
| `agentapi.resources.requests.cpu` | CPU request | `250m` |
| `agentapi.resources.requests.memory` | Memory request | `512Mi` |
| `agentapi.resources.limits.cpu` | CPU limit | `1000m` |
| `agentapi.resources.limits.memory` | Memory limit | `2Gi` |

### Database Configuration

#### Embedded PostgreSQL (Development)

```yaml
postgresql:
  enabled: true
  auth:
    username: vibecode
    password: changeme
    database: vibecode_production
```

#### External PostgreSQL (Production)

```yaml
postgresql:
  enabled: false

externalPostgresql:
  enabled: true
  host: your-rds-endpoint.amazonaws.com
  port: 5432
  username: vibecode
  password: your-secure-password
  database: vibecode_production
  sslMode: require
```

### Cache Configuration

#### Embedded Redis (Development)

```yaml
redis:
  enabled: true
  auth:
    password: changeme
```

#### External Redis (Production)

```yaml
redis:
  enabled: false

externalRedis:
  enabled: true
  host: your-elasticache-endpoint.amazonaws.com
  port: 6379
  password: your-secure-password
  database: 0
```

### Ingress Configuration

```yaml
ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
  hosts:
    - host: workspace.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: workspace-tls
      hosts:
        - workspace.example.com
```

### Autoscaling Configuration

```yaml
autoscaling:
  enabled: true
  minReplicas: 1
  maxReplicas: 10
  targetCPUUtilizationPercentage: 80
  targetMemoryUtilizationPercentage: 80
```

### Monitoring Configuration

#### Prometheus Metrics

```yaml
monitoring:
  enabled: true
  prometheus:
    enabled: true
    port: 9090
    path: /metrics
```

#### Datadog Integration

```yaml
monitoring:
  datadog:
    enabled: true
    apiKeySecretName: datadog-secret
    site: datadoghq.com
    env: production
```

## Supported Agents

The agentapi supports multiple AI coding agents:

- **Aider**: AI pair programming with Claude/GPT models
- **Goose**: Autonomous coding agent
- **Cline**: Claude-powered coding assistant

Configure agents in `values.yaml`:

```yaml
agentapi:
  agents:
    - name: aider
      enabled: true
      command: aider
      args: []
    - name: goose
      enabled: true
      command: goose
      args: []
    - name: cline
      enabled: true
      command: npx
      args: ["-y", "@cline/cli"]
```

## Upgrade

```bash
# Upgrade to new version
helm upgrade agentapi ./helm/agentapi \
  --namespace vibecode-platform \
  --values custom-values.yaml

# Check rollout status
kubectl rollout status deployment/agentapi -n vibecode-platform
```

## Uninstall

```bash
# Delete release
helm uninstall agentapi --namespace vibecode-platform

# Delete namespace (if desired)
kubectl delete namespace vibecode-platform
```

## Troubleshooting

### Check Pod Status

```bash
kubectl get pods -n vibecode-platform
kubectl describe pod <pod-name> -n vibecode-platform
```

### View Logs

```bash
# code-server logs
kubectl logs -n vibecode-platform -l app=code-server -c code-server

# agentapi logs
kubectl logs -n vibecode-platform -l app=code-server -c agentapi -f

# Follow all logs
kubectl logs -n vibecode-platform -l app=code-server --all-containers -f
```

### Run Health Check

```bash
export POD_NAME=$(kubectl get pod -n vibecode-platform -l app=code-server -o jsonpath='{.items[0].metadata.name}')

kubectl exec -n vibecode-platform $POD_NAME -c agentapi -- \
  /etc/agentapi/health-check.sh
```

### Test Endpoints

```bash
# Health endpoint
kubectl exec -n vibecode-platform $POD_NAME -c agentapi -- \
  curl http://127.0.0.1:3284/health

# Metrics endpoint
kubectl exec -n vibecode-platform $POD_NAME -c agentapi -- \
  curl http://127.0.0.1:9090/metrics
```

### Common Issues

#### Pod Not Starting

```bash
# Check events
kubectl describe pod $POD_NAME -n vibecode-platform

# Check resource limits
kubectl top pods -n vibecode-platform
```

#### Permission Issues

```bash
# Verify security context
kubectl get pod $POD_NAME -n vibecode-platform -o yaml | grep -A10 securityContext

# Check volume mounts
kubectl get pod $POD_NAME -n vibecode-platform -o yaml | grep -A10 volumeMounts
```

#### Database Connection Issues

```bash
# Test database connectivity
kubectl exec -n vibecode-platform $POD_NAME -c agentapi -- \
  curl http://127.0.0.1:3284/health/db

# Check database credentials
kubectl get secret agentapi-db -n vibecode-platform -o yaml
```

## Performance Tuning

### Resource Allocation

**Development**:
```yaml
codeserver:
  resources:
    requests:
      cpu: 500m
      memory: 1Gi
    limits:
      cpu: 2000m
      memory: 4Gi

agentapi:
  resources:
    requests:
      cpu: 250m
      memory: 512Mi
    limits:
      cpu: 1000m
      memory: 2Gi
```

**Production**:
```yaml
codeserver:
  resources:
    requests:
      cpu: 1000m
      memory: 2Gi
    limits:
      cpu: 4000m
      memory: 8Gi

agentapi:
  resources:
    requests:
      cpu: 500m
      memory: 1Gi
    limits:
      cpu: 2000m
      memory: 4Gi
```

### Persistent Volume Performance

Use high-performance storage classes:

```yaml
persistence:
  storageClass: "fast-ssd"  # Or your cloud provider's SSD class
  size: 100Gi
```

AWS EBS recommendations:
- `gp3` (General Purpose SSD) - Best balance
- `io2` (Provisioned IOPS) - Maximum performance

## Security

### Pod Security Standards

This chart implements Pod Security Standards (PSS):

- `runAsNonRoot: true`
- `seccompProfile: RuntimeDefault`
- `allowPrivilegeEscalation: false`
- `capabilities: drop ALL`

### Network Policies

Enable network policies for traffic isolation:

```yaml
networkPolicy:
  enabled: true
  policyTypes:
    - Ingress
    - Egress
```

### Secrets Management

Use external secrets manager (recommended for production):

```bash
# AWS Secrets Manager example
kubectl create secret generic agentapi-db \
  --from-literal=password=$(aws secretsmanager get-secret-value \
    --secret-id prod/vibecode/db-password \
    --query SecretString \
    --output text)
```

## Examples

### Multi-Tenant Deployment

Deploy multiple workspaces with resource quotas:

```bash
# Create namespace per tenant
kubectl create namespace tenant-alice
kubectl create namespace tenant-bob

# Apply resource quotas
kubectl apply -f - <<EOF
apiVersion: v1
kind: ResourceQuota
metadata:
  name: workspace-quota
  namespace: tenant-alice
spec:
  hard:
    requests.cpu: "4"
    requests.memory: 8Gi
    persistentvolumeclaims: "5"
EOF

# Deploy per tenant
helm install alice ./helm/agentapi -n tenant-alice
helm install bob ./helm/agentapi -n tenant-bob
```

### GPU-Enabled Workspaces

For ML/AI workloads:

```yaml
codeserver:
  resources:
    limits:
      nvidia.com/gpu: 1

nodeSelector:
  gpu-enabled: "true"

tolerations:
  - key: nvidia.com/gpu
    operator: Exists
    effect: NoSchedule
```

## CI/CD Integration

### GitOps with ArgoCD

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: agentapi
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/vibecode/vibecode-webgui
    targetRevision: main
    path: helm/agentapi
    helm:
      valueFiles:
        - values-production.yaml
  destination:
    server: https://kubernetes.default.svc
    namespace: vibecode-platform
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
```

### GitHub Actions Deployment

```yaml
- name: Deploy to Kubernetes
  run: |
    helm upgrade --install agentapi ./helm/agentapi \
      --namespace vibecode-platform \
      --create-namespace \
      --values values-production.yaml \
      --set image.tag=${{ github.sha }} \
      --wait
```

## License

MIT License - see LICENSE file for details

## Support

- Issues: https://github.com/vibecode/vibecode-webgui/issues
- Documentation: https://github.com/vibecode/vibecode-webgui/tree/main/docs
- Email: devops@vibecode.dev
