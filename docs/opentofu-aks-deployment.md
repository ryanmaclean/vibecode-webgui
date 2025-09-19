# OpenTofu-First AKS Deployment Guide

This guide demonstrates the **OpenTofu-first approach** to deploying VibeCode on Azure Kubernetes Service with production-grade PostgreSQL + pgvector and Datadog Database Monitoring.

## 🎯 **Philosophy: Infrastructure as Code First**

### **OpenTofu Handles**:
- ✅ **AKS cluster** with node pools and networking
- ✅ **PostgreSQL StatefulSet** with pgvector extension
- ✅ **Datadog agents** with comprehensive monitoring
- ✅ **Secrets and ConfigMaps** for security
- ✅ **RBAC and Network Policies** for security
- ✅ **Azure resources** (ACR, networking, identities)

### **Scripts Handle**:
- ⚙️ **Orchestration** of OpenTofu commands
- ⚙️ **Image building and pushing** to ACR
- ⚙️ **Helm deployment** for application (easier updates)
- ⚙️ **Verification** of deployments and health checks

---

## 🚀 **Quick Start**

### **1. Prerequisites**
```bash
# Required tools
brew install opentofu kubectl helm azure-cli docker

# Login to Azure
az login
az account set --subscription YOUR_SUBSCRIPTION_ID

# Verify tools
tofu version    # Should be 1.6+
kubectl version # Should be 1.28+
helm version    # Should be 3.12+
```

### **2. Configure Environment**
```bash
# Copy configuration template
cp env.aks.example .env.aks

# Generate secure passwords
openssl rand -base64 32  # Use for NEXTAUTH_SECRET and postgresql_admin_password

# Edit .env.aks with your values
vim .env.aks
```

### **3. Deploy Everything**
```bash
# Single command deployment
./scripts/tofu-aks-deploy.sh

# This will:
# 1. Initialize OpenTofu
# 2. Plan and apply infrastructure
# 3. Configure kubectl
# 4. Build and push Docker image
# 5. Deploy application with Helm
# 6. Verify everything is working
```

---

## 📋 **What Gets Deployed**

### **Azure Infrastructure (via OpenTofu)**
```
Resource Group: vibecode-rg
├── AKS Cluster (vibecode-aks-xxxx)
│   ├── System Node Pool (2x Standard_D4s_v3)
│   └── User Node Pool (3x Standard_D8s_v3)
├── Azure Container Registry (vibecodecr)
├── Virtual Network + Subnets
├── Managed Identity
└── Network Security Groups
```

### **Kubernetes Resources (via OpenTofu)**
```
Namespace: vibecode-platform
├── PostgreSQL StatefulSet
│   ├── pgvector extension enabled
│   ├── Datadog monitoring configured
│   └── 100GB Azure Disk storage
├── Datadog Agents (DaemonSet + Cluster Agent)
│   ├── Database Monitoring enabled
│   ├── APM and profiling enabled
│   └── Custom pgvector metrics
├── Secrets (vibecode-secrets, datadog-secret)
├── ConfigMaps (application configuration)
├── RBAC (ServiceAccount, Roles, Bindings)
└── Network Policies (security)
```

### **Application (via Helm)**
```
VibeCode WebGUI Application
├── Deployment (3 replicas with HPA)
├── Service (ClusterIP)
├── Ingress (NGINX with TLS)
├── PodDisruptionBudget (high availability)
└── Datadog annotations (monitoring)
```

---

## 🔧 **Configuration Deep Dive**

### **OpenTofu Variables**
All infrastructure is configured via OpenTofu variables in `.env.aks`:

```bash
# Core configuration
TF_VAR_project_name=vibecode           # Project name prefix
TF_VAR_environment=dev                 # Environment (dev/staging/prod)
TF_VAR_location=East US 2             # Azure region

# AKS configuration  
TF_VAR_aks_kubernetes_version=1.28     # Kubernetes version
TF_VAR_aks_system_node_count=2         # System node count
TF_VAR_aks_user_node_count=3           # Application node count

# Database configuration
TF_VAR_postgresql_version=16           # PostgreSQL version
TF_VAR_postgresql_storage_size=100Gi   # Storage size

# Monitoring configuration
TF_VAR_datadog_api_key=xxx            # Required for monitoring
TF_VAR_datadog_app_key=xxx            # Required for DBM
```

### **Datadog Dynamic Instrumentation**
Configured automatically with security redaction rules:

```javascript
// Automatic redaction of sensitive data
const redactionRules = [
  {
    name: "redact-secrets",
    pattern: "(?i)(password|secret|token|key)\\s*[=:]\\s*['\"]?([^\\s'\"]+)",
    replacement: "$1=***REDACTED***"
  },
  {
    name: "redact-database-urls",
    pattern: "postgresql://[^@]+@[^/]+/\\w+", 
    replacement: "postgresql://***:***@***/**"
  },
  {
    name: "redact-api-keys",
    pattern: "sk-[a-zA-Z0-9]{32,}",
    replacement: "sk-***REDACTED***"
  }
]
```

### **Source Maps for Dynamic Instrumentation**
Next.js configured to generate production source maps:

```javascript
// next.config.js
const nextConfig = {
  productionBrowserSourceMaps: true,
  webpack: (config, { dev }) => {
    if (!dev) {
      config.devtool = 'source-map'
    }
    return config
  }
}
```

---

## 🔍 **Verification & Monitoring**

### **Check Deployment Status**
```bash
# Check all pods
kubectl get pods -n vibecode-platform
kubectl get pods -n datadog

# Check services and ingress
kubectl get svc,ingress -n vibecode-platform

# Check HPA status
kubectl get hpa -n vibecode-platform
```

### **Test PostgreSQL + pgvector**
```bash
# Connect to PostgreSQL
kubectl exec -it statefulset/postgresql -n vibecode-platform -- psql -U postgres -d vibecode

# Verify pgvector extension
vibecode=# SELECT extname FROM pg_extension WHERE extname='vector';
 extname 
---------
 vector

# Test vector operations
vibecode=# SELECT '[0.1,0.2,0.3]'::vector <-> '[0.1,0.2,0.4]'::vector as distance;
   distance   
--------------
 0.1
```

### **Check Datadog Monitoring**
1. **Database Monitoring**: https://app.datadoghq.com/databases
   - Look for host: `postgresql.vibecode-platform.svc.cluster.local`
   - Check custom metrics: `postgresql.pgvector.*`

2. **APM**: https://app.datadoghq.com/apm/services
   - Service: `vibecode-webgui`
   - Check traces with Dynamic Instrumentation

3. **Infrastructure**: https://app.datadoghq.com/infrastructure
   - Check AKS nodes and pods
   - Verify container metrics

### **Test Application**
```bash
# Port forward to test locally
kubectl port-forward -n vibecode-platform svc/vibecode-app 3000:80

# Test health endpoint
curl http://localhost:3000/api/health

# Test vector search (if implemented)
curl http://localhost:3000/api/docs/search?q=kubernetes
```

---

## 🎛️ **Customization**

### **Scaling Configuration**
Edit OpenTofu variables to adjust cluster size:

```bash
# In .env.aks
TF_VAR_aks_user_node_count=5           # Scale to 5 nodes
TF_VAR_aks_user_vm_size=Standard_D16s_v3  # Use larger VMs

# Apply changes
./scripts/tofu-aks-deploy.sh
```

### **Application Scaling**
Edit Helm values for application scaling:

```yaml
# charts/vibecode/values.yaml
autoscaling:
  enabled: true
  minReplicas: 5      # Minimum pods
  maxReplicas: 50     # Maximum pods
  targetCPUUtilizationPercentage: 60  # Scale at 60% CPU
```

### **Database Configuration**
PostgreSQL settings are in OpenTofu:

```hcl
# tofu/k8s-postgresql.tf
locals {
  postgresql_config = {
    shared_buffers = "512MB"        # Increase for more memory
    work_mem = "128MB"             # Increase for complex queries
    maintenance_work_mem = "256MB" # Increase for index operations
    max_wal_size = "4GB"          # Increase for high write loads
  }
}
```

---

## 🚨 **Troubleshooting**

### **Common Issues**

**1. OpenTofu Plan Fails**
```bash
# Check Azure authentication
az account show

# Verify required variables
grep TF_VAR_ .env.aks

# Check OpenTofu syntax
cd tofu && tofu validate
```

**2. Image Build Fails**
```bash
# Check Docker is running
docker info

# Check ACR access
az acr login --name vibecodecr

# Manual build test
docker build -f Dockerfile.production -t test .
```

**3. Pods Stuck in Pending**
```bash
# Check node resources
kubectl describe nodes

# Check PVC status
kubectl get pvc -n vibecode-platform

# Check events
kubectl get events -n vibecode-platform --sort-by='.lastTimestamp'
```

**4. Datadog Not Receiving Data**
```bash
# Check agent status
kubectl exec -n datadog daemonset/datadog-agent -- agent status

# Check cluster agent
kubectl logs -n datadog deployment/datadog-cluster-agent

# Verify API keys
kubectl get secret -n datadog datadog-secret -o yaml
```

### **Recovery Procedures**

**Rollback OpenTofu Changes**
```bash
cd tofu
tofu workspace select production
tofu plan -destroy  # Review what will be destroyed
# tofu destroy      # Only if you want to start over
```

**Application Rollback**
```bash
# Rollback Helm deployment
helm rollback vibecode-app -n vibecode-platform

# Check rollback status
helm history vibecode-app -n vibecode-platform
```

---

## 💰 **Cost Optimization**

### **Development Environment**
```bash
# Smaller cluster for development
TF_VAR_aks_system_node_count=1
TF_VAR_aks_user_node_count=2
TF_VAR_aks_user_vm_size=Standard_D4s_v3
TF_VAR_postgresql_storage_size=20Gi
```

### **Production Environment**
```bash
# Optimized for production
TF_VAR_aks_system_node_count=2
TF_VAR_aks_user_node_count=3
TF_VAR_aks_user_vm_size=Standard_D8s_v3
TF_VAR_postgresql_storage_size=100Gi

# Enable cluster autoscaler
TF_VAR_aks_enable_auto_scaling=true
TF_VAR_aks_min_count=2
TF_VAR_aks_max_count=10
```

### **Cost Monitoring**
- Set up Azure Cost Management alerts
- Use Datadog cost monitoring for container insights
- Monitor resource utilization via HPA metrics

---

## 🎯 **Production Checklist**

Before going live:

- [ ] **DNS configured** for ingress hostname
- [ ] **TLS certificates** configured (cert-manager + Let's Encrypt)
- [ ] **Backup strategy** implemented for PostgreSQL
- [ ] **Monitoring alerts** configured in Datadog
- [ ] **Security scanning** completed for container images
- [ ] **Load testing** performed at expected scale
- [ ] **Disaster recovery** procedures documented and tested
- [ ] **Access controls** reviewed (RBAC, Network Policies)
- [ ] **Compliance requirements** verified
- [ ] **Performance benchmarks** established
- [ ] **Cost budgets** and alerts configured

---

## 🎉 **Success!**

You now have a **production-ready VibeCode platform** running on AKS with:

- ✅ **pgvector + PostgreSQL** with comprehensive monitoring
- ✅ **Datadog Database Monitoring** with custom metrics
- ✅ **Dynamic Instrumentation** with security redaction
- ✅ **Auto-scaling** based on CPU/memory usage
- ✅ **High availability** with pod disruption budgets
- ✅ **Security** with RBAC and network policies
- ✅ **Infrastructure as Code** with OpenTofu
- ✅ **Easy updates** with Helm

The **OpenTofu-first approach** ensures your infrastructure is:
- **Reproducible** across environments
- **Version controlled** and auditable  
- **Secure** with proper RBAC and secrets management
- **Scalable** with auto-scaling and proper resource limits
- **Observable** with comprehensive Datadog monitoring

🚀 **Your Lovable.ai clone is now live on Azure!** 🚀
