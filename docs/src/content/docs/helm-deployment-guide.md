---
title: Helm Deployment Guide
description: Production-ready Helm charts with environment-specific scaling for dev, staging, and production deployments
---

# ⚓ Helm Deployment Guide

Complete production-ready Helm charts with environment-specific scaling, cost optimization, and enterprise security features.

## 🎯 Overview

VibeCode provides comprehensive Helm charts with environment-specific values files optimized for different deployment scenarios:

- **Development**: Cost-optimized with minimal resources
- **Staging**: Production-like testing with medium resources  
- **Production**: Enterprise-scale with high availability and full security

## 📋 Prerequisites

```bash
# Required tools
kubectl version --client
helm version
kind version  # For local testing

# Optional: Docker Desktop or similar container runtime
docker version
```

## 🚀 Quick Start

### 1. Clone and Prepare
```bash
git clone https://github.com/vibecode/webgui.git
cd webgui

# Create a KIND cluster for testing
kind create cluster --name vibecode-simple
```

### 2. Deploy to Development
```bash
helm install vibecode-dev ./helm/vibecode-platform \
  -f ./helm/vibecode-platform/values-dev.yaml \
  --namespace vibecode-dev \
  --create-namespace
```

### 3. Verify Deployment
```bash
kubectl get all -n vibecode-dev
helm test vibecode-dev -n vibecode-dev
```

## 🏗️ Environment-Specific Deployments

### 🧪 Development Environment

**Purpose**: Local development, testing, minimal cost
```bash
helm install vibecode-dev ./helm/vibecode-platform \
  -f ./helm/vibecode-platform/values-dev.yaml \
  --namespace vibecode-dev \
  --create-namespace \
  --set monitoring.enabled=false \
  --set security.networkPolicies.enabled=false
```

**Key Features**:
- **Resources**: 100m CPU, 256Mi RAM per workspace
- **Storage**: 2Gi workspaces, standard storage class
- **Security**: Baseline pod security standards
- **Monitoring**: Disabled for cost savings
- **Scaling**: Single replicas, no auto-scaling

### 🎭 Staging Environment

**Purpose**: Production-like testing, QA validation
```bash
helm install vibecode-staging ./helm/vibecode-platform \
  -f ./helm/vibecode-platform/values-staging.yaml \
  --namespace vibecode-staging \
  --create-namespace \
  --set certManager.issuer.server=https://acme-staging-v02.api.letsencrypt.org/directory
```

**Key Features**:
- **Resources**: 250m CPU, 512Mi RAM per workspace
- **Storage**: 5Gi workspaces, SSD storage class  
- **Security**: Restricted pod security standards
- **Monitoring**: Full monitoring with 7-day retention
- **Scaling**: Basic auto-scaling (1-5 replicas)

### 🏭 Production Environment

**Purpose**: Enterprise scale, high availability, full security
```bash
helm install vibecode-prod ./helm/vibecode-platform \
  -f ./helm/vibecode-platform/values-prod.yaml \
  --namespace vibecode-production \
  --create-namespace \
  --set backup.enabled=true \
  --set logging.level=info
```

**Key Features**:
- **Resources**: 500m CPU, 1Gi RAM per workspace (burst to 4 cores, 8Gi)
- **Storage**: 10Gi workspaces, premium SSD with retention
- **Security**: Restricted pod security + admission controllers
- **Monitoring**: Full observability with 30-day retention + alerting
- **Scaling**: Aggressive auto-scaling (3-50 replicas)

## 📊 Resource Scaling Comparison

| Component | Development | Staging | Production | Scale Factor |
|-----------|-------------|---------|------------|--------------|
| **CPU Request** | 100m | 250m | 500m | 5x |
| **Memory Request** | 256Mi | 512Mi | 1Gi | 4x |
| **CPU Limit** | 500m | 1000m | 4000m | 8x |
| **Memory Limit** | 1Gi | 2Gi | 8Gi | 8x |
| **Workspace Storage** | 2Gi | 5Gi | 10Gi | 5x |
| **Max Workspace** | 5Gi | 20Gi | 50Gi | 10x |
| **Cluster Storage** | 50Gi | 500Gi | 2Ti | 40x |

## 🛡️ Security Scaling

| Security Feature | Dev | Staging | Production |
|------------------|-----|---------|------------|
| **Pod Security Standards** | `baseline` | `restricted` | `restricted` |
| **Network Policies** | ❌ Disabled | ✅ Enabled | ✅ + DefaultDeny |
| **RBAC** | ✅ Basic | ✅ Full | ✅ Strict |
| **TLS/SSL** | ❌ HTTP | ✅ Staging certs | ✅ Production certs |
| **Admission Controllers** | ❌ None | ✅ Basic | ✅ Full suite |

## 💾 Storage Strategy

### Per-User Workspace Sizing
```yaml
# Development - Cost optimized
userManagement:
  workspace:
    defaultSize: 2Gi    # Small projects
    maxSize: 5Gi        # Limit growth
    storageClass: standard

# Production - Performance optimized  
userManagement:
  workspace:
    defaultSize: 10Gi   # Generous for most projects
    maxSize: 50Gi       # Enterprise monorepos + ML
    storageClass: premium-ssd-retained
```

### Storage Class Recommendations
- **Development**: `standard` (cheapest, adequate performance)
- **Staging**: `ssd-fast` (better performance for testing)
- **Production**: `premium-ssd-retained` (high performance + durability)

## 🔧 Configuration Management

### Environment Variables
```bash
# Set environment-specific variables
export DATADOG_API_KEY="your-datadog-key"
export OPENROUTER_API_KEY="your-openrouter-key"
export GITHUB_CLIENT_ID="your-github-app-id"
export GITHUB_CLIENT_SECRET="your-github-secret"

# Deploy with secrets
helm install vibecode-prod ./helm/vibecode-platform \
  -f ./helm/vibecode-platform/values-prod.yaml \
  --namespace vibecode-production \
  --create-namespace \
  --set aiIntegration.openRouter.apiKey="$OPENROUTER_API_KEY" \
  --set monitoring.datadog.apiKey="$DATADOG_API_KEY"
```

### Custom Values Override
```bash
# Create custom values file
cat > custom-values.yaml << EOF
codeServer:
  resources:
    requests:
      cpu: "1000m"      # Custom CPU allocation
      memory: "2Gi"     # Custom memory allocation
monitoring:
  enabled: true
  retention: "14d"      # Custom retention
EOF

# Deploy with custom values
helm install vibecode-custom ./helm/vibecode-platform \
  -f ./helm/vibecode-platform/values-prod.yaml \
  -f custom-values.yaml \
  --namespace vibecode-custom \
  --create-namespace
```

## 🧪 Testing and Validation

### Helm Template Testing
```bash
# Test template rendering
helm template vibecode-test ./helm/vibecode-platform \
  -f ./helm/vibecode-platform/values-dev.yaml \
  --dry-run

# Validate against Kubernetes API
helm install vibecode-test ./helm/vibecode-platform \
  -f ./helm/vibecode-platform/values-dev.yaml \
  --namespace vibecode-test \
  --create-namespace \
  --dry-run
```

### Built-in Test Suite
```bash
# Run Helm tests
helm test vibecode-dev -n vibecode-dev

# Test connectivity
kubectl run test-pod --image=busybox:1.36 --rm -it --restart=Never \
  -- wget -qO- http://vibecode-service.vibecode-dev.svc.cluster.local:3000/api/health
```

### Resource Monitoring
```bash
# Check resource utilization
kubectl top pods -n vibecode-dev
kubectl describe resourcequota -n vibecode-dev

# Monitor storage usage
kubectl get pvc -n vibecode-dev
df -h # On worker nodes
```

## 🔄 Upgrades and Rollbacks

### Rolling Updates
```bash
# Update with new values
helm upgrade vibecode-dev ./helm/vibecode-platform \
  -f ./helm/vibecode-platform/values-dev.yaml \
  --namespace vibecode-dev

# Check rollout status
kubectl rollout status deployment/vibecode-webgui -n vibecode-dev
```

### Rollback Strategy
```bash
# List release history
helm history vibecode-dev -n vibecode-dev

# Rollback to previous version
helm rollback vibecode-dev 1 -n vibecode-dev

# Rollback with timeout
helm rollback vibecode-dev 1 -n vibecode-dev --timeout=300s
```

## 📈 Scaling Operations

### Manual Scaling
```bash
# Scale specific deployment
kubectl scale deployment vibecode-webgui --replicas=5 -n vibecode-production

# Update Helm values for permanent scaling
helm upgrade vibecode-prod ./helm/vibecode-platform \
  -f ./helm/vibecode-platform/values-prod.yaml \
  --set autoscaling.minReplicas=5 \
  --set autoscaling.maxReplicas=20 \
  --namespace vibecode-production
```

### Auto-scaling Configuration
```yaml
# Production auto-scaling
autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 50
  targetCPUUtilizationPercentage: 60
  targetMemoryUtilizationPercentage: 70
```

## 🎯 User Provisioning

### Dynamic User Workspace Creation
```bash
# Provision workspace for user
kubectl create job provision-user-alice \
  --from=cronjob/vibecode-provisioner \
  -n vibecode-production \
  -- /scripts/provision-user.sh alice

# Check provisioning status
kubectl logs job/provision-user-alice -n vibecode-production
```

### User Management Commands
```bash
# List all user workspaces
kubectl get deployments -l app.kubernetes.io/component=code-server -n vibecode-production

# Delete user workspace
export USER_ID="alice"
kubectl delete deployment code-server-$USER_ID -n vibecode-production
kubectl delete service code-server-$USER_ID -n vibecode-production
kubectl delete pvc workspace-$USER_ID -n vibecode-production
kubectl delete secret code-server-$USER_ID-config -n vibecode-production
```

## 🔍 Monitoring and Observability

### Prometheus Metrics
```bash
# Access Prometheus (port-forward)
kubectl port-forward svc/prometheus 9090:9090 -n vibecode-production

# Access Grafana
kubectl port-forward svc/grafana 3000:3000 -n vibecode-production
# Default: admin/admin
```

### Health Checks
```bash
# Check all components
kubectl get pods,services,ingress -n vibecode-production

# Detailed pod status
kubectl describe pods -l app.kubernetes.io/name=vibecode-platform -n vibecode-production

# Check resource quotas
kubectl describe resourcequota -n vibecode-production
```

## 🚨 Troubleshooting

### Common Issues

#### ResourceQuota Exceeded
```bash
# Check quota usage
kubectl describe resourcequota -n vibecode-dev

# Increase quota temporarily
kubectl patch resourcequota vibecode-dev-global -n vibecode-dev \
  --patch='{"spec":{"hard":{"requests.cpu":"4","requests.memory":"8Gi"}}}'

# Or update via Helm
helm upgrade vibecode-dev ./helm/vibecode-platform \
  -f ./helm/vibecode-platform/values-dev.yaml \
  --set resourceQuota.hard.requests.cpu="4" \
  --set resourceQuota.hard.requests.memory="8Gi"
```

#### Storage Issues
```bash
# Check PVC status
kubectl get pvc -n vibecode-dev

# Check StorageClass
kubectl get storageclass

# Manually create PVC if needed
kubectl apply -f - << EOF
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: test-workspace
  namespace: vibecode-dev
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 2Gi
  storageClassName: standard
EOF
```

#### Network Connectivity
```bash
# Test service resolution
kubectl run debug-pod --image=busybox:1.36 --rm -it --restart=Never \
  -- nslookup vibecode-service.vibecode-dev.svc.cluster.local

# Check network policies
kubectl get networkpolicy -n vibecode-dev
kubectl describe networkpolicy -n vibecode-dev
```

### Debug Commands
```bash
# Get all resources
kubectl get all,pvc,secrets,configmaps,networkpolicies,resourcequotas -n vibecode-dev

# Check pod logs
kubectl logs -l app.kubernetes.io/name=vibecode-platform -n vibecode-dev --tail=100

# Execute into pod
kubectl exec -it deployment/vibecode-webgui -n vibecode-dev -- /bin/bash

# Check events
kubectl get events -n vibecode-dev --sort-by='.lastTimestamp'
```

## 📚 Best Practices

### 1. Environment Isolation
- Use separate namespaces for each environment
- Apply appropriate resource quotas and limits
- Implement network policies for security

### 2. Resource Management
- Start with conservative resource requests
- Monitor actual usage and adjust based on data
- Use horizontal pod autoscaling for variable workloads

### 3. Security Hardening
- Always use restricted pod security standards in production
- Enable network policies and admission controllers
- Regular security audits and updates

### 4. Cost Optimization
- Right-size storage allocations based on real usage
- Use appropriate storage classes (standard vs premium)
- Monitor and cleanup unused resources

### 5. Monitoring and Alerting
- Enable comprehensive monitoring in staging and production
- Set up alerts for resource exhaustion and failures
- Regular backup and disaster recovery testing

## 🔗 Related Documentation

- [KIND Troubleshooting Guide](./kind-troubleshooting) - Local cluster setup
- [Comprehensive Test Report](./comprehensive-environment-test-report) - Validation results
- [Enhanced AI Features](./enhanced-ai-features) - AI integration setup
- [Production Status Report](./production-status-report) - Current deployment status

---

For additional support or questions about Helm deployments, see our [GitHub Issues](https://github.com/vibecode/webgui/issues) or [Documentation Wiki](https://ryanmaclean.github.io/vibecode-webgui/).