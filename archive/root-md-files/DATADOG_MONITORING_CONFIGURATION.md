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

**Last Updated**: January 21, 2025  
**Environment**: dev/stg/prd parity achieved ✅  
**Status**: Production ready with comprehensive monitoring