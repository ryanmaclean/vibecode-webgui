# VibeCode Platform Helm Chart

A comprehensive Helm chart for deploying the VibeCode platform with per-user code-server instances on Kubernetes.

## Overview

This Helm chart deploys a multi-tenant code-server platform that provides:

- **Per-user code-server instances** with isolated workspaces
- **AI integration** with OpenRouter, MCP, and Artificial Analysis
- **Security hardening** with Pod Security Standards, Network Policies, and RBAC
- **Resource management** with quotas and limits
- **Monitoring and observability** with Prometheus metrics
- **Automated user provisioning** and lifecycle management

## Prerequisites

- Kubernetes 1.24+
- Helm 3.8+
- NGINX Ingress Controller
- cert-manager (optional, for TLS)
- Prometheus Operator (optional, for monitoring)

## Installation

### Quick Start

```bash
# Add the Helm repository (when published)
helm repo add vibecode https://charts.vibecode.dev
helm repo update

# Install with default values
helm install vibecode-platform vibecode/vibecode-platform \
  --create-namespace \
  --namespace vibecode-platform
```

### Local Development

```bash
# Clone the repository
git clone https://github.com/vibecode/vibecode-platform
cd vibecode-platform/helm/vibecode-platform

# Install from local chart
helm install vibecode-platform . \
  --create-namespace \
  --namespace vibecode-platform \
  --values values.yaml
```

### Custom Configuration

```bash
# Create custom values file
cat > custom-values.yaml <<EOF
global:
  namespace: my-vibecode

codeServer:
  resources:
    requests:
      cpu: "1000m"
      memory: "2Gi"
    limits:
      cpu: "4000m"
      memory: "8Gi"

aiIntegration:
  openRouter:
    enabled: true
  mcp:
    enabled: true

monitoring:
  enabled: true
EOF

# Install with custom values
helm install vibecode-platform . \
  --values custom-values.yaml \
  --namespace my-vibecode \
  --create-namespace
```

## Configuration

### Core Values

| Parameter | Description | Default |
|-----------|-------------|---------|
| `global.namespace` | Target namespace | `vibecode-platform` |
| `global.storageClass` | Default storage class | `vibecode-local-storage` |
| `codeServer.image.repository` | Code-server image | `codercom/code-server` |
| `codeServer.image.tag` | Code-server version | `4.22.1` |
| `codeServer.resources.requests.cpu` | CPU request | `500m` |
| `codeServer.resources.requests.memory` | Memory request | `1Gi` |
| `codeServer.resources.limits.cpu` | CPU limit | `2000m` |
| `codeServer.resources.limits.memory` | Memory limit | `4Gi` |

### AI Integration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `aiIntegration.openRouter.enabled` | Enable OpenRouter | `true` |
| `aiIntegration.openRouter.apiUrl` | OpenRouter API URL | `https://openrouter.ai/api/v1` |
| `aiIntegration.mcp.enabled` | Enable MCP server | `true` |
| `aiIntegration.mcp.serverPort` | MCP server port | `3001` |
| `aiIntegration.artificialAnalysis.enabled` | Enable AI analysis | `true` |

### Security

| Parameter | Description | Default |
|-----------|-------------|---------|
| `security.podSecurityStandards.enforce` | Pod security enforcement | `restricted` |
| `security.networkPolicies.enabled` | Enable network policies | `true` |
| `security.rbac.enabled` | Enable RBAC | `true` |

### Storage

| Parameter | Description | Default |
|-----------|-------------|---------|
| `codeServer.persistence.enabled` | Enable persistent storage | `true` |
| `codeServer.persistence.size` | PVC size | `10Gi` |
| `codeServer.persistence.storageClass` | Storage class | `vibecode-local-storage` |
| `codeServer.persistence.accessMode` | Access mode | `ReadWriteOnce` |

### Monitoring

| Parameter | Description | Default |
|-----------|-------------|---------|
| `monitoring.enabled` | Enable monitoring | `true` |
| `monitoring.prometheus.enabled` | Enable Prometheus metrics | `true` |
| `monitoring.prometheus.port` | Metrics port | `9090` |
| `monitoring.grafana.enabled` | Enable Grafana dashboard | `true` |

## User Management

### Creating Users

The chart provides templates for per-user resources but doesn't automatically create users. Use the provided job template:

```bash
# Create a user provisioning job
kubectl create job provision-user-alice \
  --from=cronjob/user-provisioner \
  --env="USER_ID=alice" \
  --namespace=vibecode-platform
```

### Accessing User Workspaces

Each user gets their own subdomain:
- URL: `https://{USER_ID}.vibecode.local`
- Credentials: Generated and stored in secret `code-server-{USER_ID}-config`

```bash
# Get user password
kubectl get secret code-server-alice-config \
  --namespace=vibecode-platform \
  -o jsonpath='{.data.password}' | base64 -d
```

## AI Integration Setup

### OpenRouter Configuration

1. Get an API key from [OpenRouter](https://openrouter.ai)
2. Create secret:
```bash
kubectl create secret generic openrouter-api-key \
  --from-literal=api-key=YOUR_API_KEY \
  --namespace=vibecode-platform
```

### Artificial Analysis Configuration

1. Get an API key from [Artificial Analysis](https://artificialanalysis.ai)
2. Create secret:
```bash
kubectl create secret generic artificial-analysis-api-key \
  --from-literal=api-key=YOUR_API_KEY \
  --namespace=vibecode-platform
```

## Monitoring and Observability

### Prometheus Metrics

The platform exposes metrics at `/metrics` endpoint on port 9090:

- User workspace health
- Resource utilization
- AI integration usage
- Storage consumption

### Grafana Dashboard

A pre-configured dashboard is included showing:

- Active users
- CPU and memory usage
- Storage utilization
- AI API usage

### Accessing Monitoring

```bash
# Port-forward to Grafana (if deployed)
kubectl port-forward svc/grafana 3000:3000 -n monitoring

# Access metrics directly
kubectl port-forward svc/vibecode-platform-metrics 9090:9090 -n vibecode-platform
```

## Security

### Pod Security Standards

The chart enforces `restricted` Pod Security Standards by default:

- Non-root containers
- Read-only root filesystem where possible
- Dropped capabilities
- Security contexts enforced

### Network Policies

Network isolation between users:

- Users can only access their own workspaces
- AI API access allowed
- DNS resolution allowed
- External package downloads allowed

### RBAC

Minimal required permissions:

- Platform service account: workspace management
- User workspaces: read-only access to own resources

## Troubleshooting

### Common Issues

**PVC stuck in Pending:**
```bash
# Check storage class
kubectl get storageclass

# Check node capacity
kubectl describe nodes
```

**User workspace not accessible:**
```bash
# Check deployment status
kubectl get deployment code-server-{USER_ID} -n vibecode-platform

# Check service and ingress
kubectl get svc,ing -l vibecode.dev/user-id={USER_ID} -n vibecode-platform

# Check logs
kubectl logs deployment/code-server-{USER_ID} -n vibecode-platform
```

**AI integration not working:**
```bash
# Check secrets
kubectl get secrets -l app.kubernetes.io/component=ai-integration -n vibecode-platform

# Check environment variables
kubectl describe pod -l vibecode.dev/user-id={USER_ID} -n vibecode-platform
```

### Debug Mode

Enable debug logging:

```yaml
codeServer:
  env:
    - name: LOG_LEVEL
      value: debug
```

## Upgrading

```bash
# Update Helm repository
helm repo update

# Upgrade release
helm upgrade vibecode-platform vibecode/vibecode-platform \
  --namespace vibecode-platform \
  --values custom-values.yaml
```

## Uninstalling

```bash
# Delete the release
helm uninstall vibecode-platform --namespace vibecode-platform

# Optionally delete PVCs (WARNING: This will delete user data!)
kubectl delete pvc -l app.kubernetes.io/name=vibecode-platform -n vibecode-platform

# Delete namespace
kubectl delete namespace vibecode-platform
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes and test
4. Submit a pull request

### Testing

```bash
# Run Helm tests
helm test vibecode-platform --namespace vibecode-platform

# Lint the chart
helm lint .

# Template and validate
helm template vibecode-platform . --values values.yaml | kubectl apply --dry-run=client -f -
```

## License

This Helm chart is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- GitHub Issues: [vibecode/vibecode-platform/issues](https://github.com/vibecode/vibecode-platform/issues)
- Documentation: [docs.vibecode.dev](https://docs.vibecode.dev)
- Community: [Discord](https://discord.gg/vibecode)