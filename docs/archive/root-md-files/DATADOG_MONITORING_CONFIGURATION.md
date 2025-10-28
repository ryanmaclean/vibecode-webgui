# Datadog Monitoring Configuration for VibeCode

This document outlines the comprehensive Datadog monitoring setup across all environments (dev/stg/prd).

## 🎯 Monitoring Strategy

### Environment Parity
- **Development (KIND)**: Full monitoring stack with dummy credentials
- **Staging (Azure AKS)**: Production-like monitoring with staging tags
- **Production (Azure AKS)**: Full production monitoring with real credentials

### Key Monitoring Features
- ✅ **Application Performance Monitoring (APM)**
- ✅ **Infrastructure Monitoring**
- ✅ **Log Aggregation**
- ✅ **Database Monitoring**
- ✅ **Container Insights**
- ✅ **Network Monitoring**
- ✅ **Security Monitoring**

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   KIND (Local)  │    │  Staging (AKS)  │    │Production (AKS) │
│                 │    │                 │    │                 │
│ ├─ Docs Service │    │ ├─ Docs Service │    │ ├─ Docs Service │
│ ├─ Main App     │    │ ├─ Main App     │    │ ├─ Main App     │
│ └─ Datadog      │    │ └─ Datadog      │    │ └─ Datadog      │
│    Agent        │    │    Agent        │    │    Agent        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        │                       │                       │
        └───────────────────────┼───────────────────────┘
                                │
                        ┌───────▼────────┐
                        │ Datadog Cloud  │
                        │   Dashboard    │
                        └────────────────┘
```

## 📊 Deployment Configurations

### 1. KIND (Local Development)

**Location**: `scripts/deploy-kind-with-monitoring.sh`

**Configuration**:
- Lightweight DaemonSet deployment
- Dummy API keys for local development
- Basic monitoring features enabled
- Resource limits: 256Mi memory, 100m CPU

**Tags**:
```yaml
- env:local
- cluster:kind
- project:vibecode
```

**Features Enabled**:
- ✅ Container monitoring
- ✅ Process monitoring
- ✅ Log collection
- ✅ APM tracing
- ❌ Network monitoring (disabled for performance)
- ❌ Database monitoring (no production DB in KIND)

### 2. Azure Staging/Production

**Location**: `infrastructure/terraform/azure/kubernetes-deployment.tf`

**Configuration**:
- Helm chart deployment (datadog/datadog)
- Production Datadog credentials from Key Vault
- Full monitoring stack enabled
- High availability configuration

**Features Enabled**:
- ✅ Container insights
- ✅ Database monitoring (PostgreSQL)
- ✅ APM tracing
- ✅ Log aggregation
- ✅ Network monitoring
- ✅ Security scanning
- ✅ Orchestrator explorer

## 🔧 Configuration Files

### KIND Configuration
```yaml
# File: k8s/datadog-values-kind.yaml
datadog:
  apiKeyExistingSecret: datadog-secret
  site: "datadoghq.com"
  clusterName: "vibecode-kind-local"
  logs:
    enabled: true
  apm:
    portEnabled: true
  tags:
    - "env:local"
    - "cluster:kind"
```

### Terraform Configuration
```hcl
# File: infrastructure/terraform/azure/kubernetes-deployment.tf
resource "helm_release" "datadog" {
  name       = "datadog"
  repository = "https://helm.datadoghq.com"
  chart      = "datadog"
  
  values = [
    yamlencode({
      datadog = {
        apiKeyExistingSecret = kubernetes_secret.datadog_config.metadata[0].name
        site                 = "datadoghq.com"
        clusterName          = azurerm_kubernetes_cluster.main.name
        dbm.enabled          = true
        logs.enabled         = true
        apm.portEnabled      = true
      }
    })
  ]
}
```

## 🔧 Environment Variables

To standardize configuration, we prefer `DD_*` variables with a safe fallback to legacy `DATADOG_*` variants. For client-side RUM, prefer `NEXT_PUBLIC_DD_*` with legacy `NEXT_PUBLIC_DATADOG_*` fallback.

- __Server-side (preferred → fallback)__
  - `DD_API_KEY` → `DATADOG_API_KEY`
  - `DD_APP_KEY` → `DATADOG_APP_KEY`
  - `DD_SITE` → `DATADOG_SITE` (default: `datadoghq.com`)
  - `DD_SERVICE` → `DATADOG_SERVICE` (default: `vibecode-webgui`)
  - `DD_ENV` → `DATADOG_ENV` (default: `development`/`production` by `NODE_ENV`)
  - `DD_VERSION` → `DATADOG_VERSION` (default: package version or `1.0.0`)

- __Database Monitoring (DBM)__
  - `DD_POSTGRES_PASSWORD` → `DATADOG_POSTGRES_PASSWORD` (password for the Datadog DB user)
  - `DD_POSTGRES_USER` (default: `datadog`)

- __Client (RUM)__
  - `NEXT_PUBLIC_DD_APPLICATION_ID` → `NEXT_PUBLIC_DATADOG_APPLICATION_ID` (also accepts `NEXT_PUBLIC_DATADOG_RUM_APPLICATION_ID`)
  - `NEXT_PUBLIC_DD_CLIENT_TOKEN` → `NEXT_PUBLIC_DATADOG_CLIENT_TOKEN` (also accepts `NEXT_PUBLIC_DATADOG_RUM_CLIENT_TOKEN`)
  - `NEXT_PUBLIC_DD_SITE` → `NEXT_PUBLIC_DATADOG_SITE` (default: `datadoghq.com`)
  - Optional: `NEXT_PUBLIC_APP_VERSION` for front-end version tagging
  - RUM is prod-only by default; enable in dev with `NEXT_PUBLIC_ENABLE_RUM_IN_DEV=true`.

- __Centralized helper__
  - Code should resolve env vars via `src/lib/monitoring/datadog-env.ts` to ensure consistent precedence and safe mismatch warnings.

Example `.env` excerpt:

```env
# Server
DD_API_KEY=your-datadog-api-key
# DATADOG_API_KEY=your-datadog-api-key  # optional fallback
DD_SITE=datadoghq.com
DD_SERVICE=vibecode-webgui
DD_ENV=development
DD_VERSION=1.0.0

# Database Monitoring (DBM)
DD_POSTGRES_USER=datadog
DD_POSTGRES_PASSWORD=your-strong-password
# DATADOG_POSTGRES_PASSWORD=your-strong-password # optional fallback

# Client (RUM)
NEXT_PUBLIC_DD_APPLICATION_ID=your-app-id
NEXT_PUBLIC_DD_CLIENT_TOKEN=your-client-token
NEXT_PUBLIC_DD_SITE=datadoghq.com
# NEXT_PUBLIC_DATADOG_APPLICATION_ID=your-app-id     # optional fallback
# NEXT_PUBLIC_DATADOG_CLIENT_TOKEN=your-client-token # optional fallback
# NEXT_PUBLIC_DATADOG_SITE=datadoghq.com             # optional fallback

# Enable RUM in dev only if needed
NEXT_PUBLIC_ENABLE_RUM_IN_DEV=false
```

## 🧩 Application Instrumentation

### Server (Node/Next.js API)
- __Tracer__: Initialize Datadog tracing in the server entrypoint as early as possible.
- __Config source__: Use `src/lib/monitoring/datadog-env.ts` helpers for `service`, `env`, `version`, and `site`.
- __Logs__: Write app logs to stdout/stderr; the Datadog Agent collects container logs when `logs.enabled: true`.
- __APM__: Ensure `apm.portEnabled: true` (already set in values files) and the agent runs on the same node/namespace.

### Client (RUM)
- Prefer `NEXT_PUBLIC_DD_*` vars. `getRUMPublicConfig()` in `src/lib/monitoring/datadog-env.ts` centralizes resolution.
- RUM is disabled in development by default; enable only if needed with `NEXT_PUBLIC_ENABLE_RUM_IN_DEV=true`.

### Secure Defaults
- No secrets are logged. `datadog-env` emits safe mismatch warnings only.
- RUM disabled in dev by default; enable explicitly.
- KIND uses dummy credentials; production uses Key Vault/Secrets.
- Favor minimal config with sensible defaults to reduce complexity.

## 🗺️ Kubernetes and Infra Artifacts Map

- __Agent values (KIND)__: `k8s/datadog-values-kind.yaml`
- __Agent values (AKS)__: `k8s/datadog-values.yaml`
- __Agent manifests (various examples)__:
  - `k8s/datadog-daemonset.yaml`
  - `k8s/datadog-agent-all.yaml`
  - `k8s/datadog-agent-fixed.yaml`
  - `k8s/datadog-simple.yaml`
  - `k8s/datadog-rbac-complete.yaml`
  - `datadog-agent.yaml` (root example)
  - `infrastructure/kubernetes/monitoring/datadog-agent.yaml`
  - `charts/vibecode-platform/templates/datadog-agent.yaml`
- __Secrets__:
  - `k8s/datadog-secret.yaml` (local/dev example)
  - `helm/vibecode-platform/templates/datadog-secret-hook.yaml` (Helm hook)
- __Database Monitoring (DBM)__:
  - `kubernetes/datadog/datadog-dbm-config.yaml`
  - `kubernetes/datadog/datadog-db-secret.yaml`

## 🧱 Monitoring IaC (Dashboards, Synthetics, Policies)

- `infrastructure/monitoring/terraform/main.tf`
- `infrastructure/monitoring/terraform/datadog-synthetics.tf`
- `infrastructure/monitoring/terraform/security-tests.tf`
- `infrastructure/monitoring/datadog-dashboard.tf`

## 🚀 Deployment Process

### Automated Deployment

1. **KIND (Local)**:
   ```bash
   # Deploy with monitoring
   scripts/deploy-kind-with-monitoring.sh
   ```

2. **Azure (Terraform)**:
   ```bash
   # Deploy infrastructure with monitoring
   cd infrastructure/terraform/azure
   terraform apply
   ```

3. **CI/CD (GitHub Actions)**:
   - Automatically deploys monitoring in staging
   - Validates monitoring deployment
   - Tests Datadog agent connectivity

### Manual Verification

```bash
# Check Datadog deployment
kubectl get pods -n datadog
kubectl logs -l app=datadog-agent -n datadog

# Check monitoring metrics
kubectl top nodes
kubectl top pods -n vibecode
```

## 📈 Monitoring Dashboards

### Key Metrics Tracked

**Application Metrics**:
- Request latency (p50, p95, p99)
- Error rates
- Throughput (requests/second)
- Apdex scores

**Infrastructure Metrics**:
- CPU utilization
- Memory usage
- Disk I/O
- Network traffic

**Database Metrics**:
- Query performance
- Connection pool status
- Slow queries
- Lock contention

**Container Metrics**:
- Pod restart counts
- Resource utilization
- Image pull times
- Health check status

### Custom Dashboards

1. **VibeCode Application Overview**
   - Service map
   - Error tracking
   - Performance metrics

2. **Infrastructure Health**
   - Kubernetes cluster status
   - Node performance
   - Resource allocation

3. **Database Performance**
   - PostgreSQL metrics
   - Query performance
   - Connection monitoring

## 🔔 Alerting Configuration

### Critical Alerts

1. **Application Down**: Service unavailable > 1 minute
2. **High Error Rate**: Error rate > 5% for 5 minutes
3. **High Latency**: p95 latency > 2s for 5 minutes
4. **Resource Exhaustion**: CPU > 90% or Memory > 95%

### Warning Alerts

1. **Moderate Latency**: p95 latency > 1s for 10 minutes
2. **Increased Errors**: Error rate > 2% for 10 minutes
3. **Resource Pressure**: CPU > 70% or Memory > 80%

## 🔐 Security and Access

### API Key Management

**KIND (Local)**:
- Uses dummy credentials
- No sensitive data exposure
- Local development only

**Azure (Production)**:
- API keys stored in Azure Key Vault
- Workload identity authentication
- Encrypted in transit and at rest

### RBAC Configuration

```yaml
# Datadog agent permissions
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: datadog-agent
rules:
- apiGroups: [""]
  resources: ["services", "events", "endpoints", "pods", "nodes"]
  verbs: ["get", "list", "watch"]
```

## 🧪 Testing and Validation

### Automated Tests

1. **Deployment Test**: Validates Datadog agent deployment
2. **Connectivity Test**: Checks metric collection
3. **Integration Test**: Verifies dashboard data

### Manual Validation Checklist

- [ ] Datadog agent pods running
- [ ] Metrics appearing in Datadog dashboard
- [ ] Logs being collected
- [ ] APM traces visible
- [ ] Alerts configured and firing
- [ ] Custom dashboards populated

## 📚 Documentation Links

- [Datadog Kubernetes Integration](https://docs.datadoghq.com/integrations/kubernetes/)
- [Azure AKS Monitoring](https://docs.datadoghq.com/integrations/azure_aks/)
- [Helm Chart Configuration](https://github.com/DataDog/helm-charts/tree/main/charts/datadog)

## 🛠️ Troubleshooting

### Common Issues

1. **Agent Not Starting**:
   ```bash
   kubectl describe pod -l app=datadog-agent -n datadog
   kubectl logs -l app=datadog-agent -n datadog
   ```

2. **No Metrics in Dashboard**:
   - Check API key configuration
   - Verify network connectivity
   - Review agent logs

3. **High Resource Usage**:
   - Adjust resource limits
   - Disable unnecessary features
   - Optimize collection intervals

### Debug Commands

```bash
# Check agent status
kubectl exec -it datadog-agent-<pod> -n datadog -- agent status

# View agent configuration
kubectl exec -it datadog-agent-<pod> -n datadog -- agent config

# Test connectivity
kubectl exec -it datadog-agent-<pod> -n datadog -- agent check connectivity
```

## 📅 Maintenance

### Regular Tasks

1. **Weekly**: Review dashboard metrics and alerts
2. **Monthly**: Update agent versions
3. **Quarterly**: Review and optimize monitoring configuration

### Agent Updates

```bash
# Update Helm chart
helm repo update
helm upgrade datadog datadog/datadog -n datadog
```

---

**Last Updated**: August 21, 2025  
**Environment**: dev/stg/prd parity achieved ✅  
**Status**: Production ready with comprehensive monitoring