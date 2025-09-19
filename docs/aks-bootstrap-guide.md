# AKS Bootstrap Guide: Production VibeCode Deployment

This guide walks through deploying VibeCode platform to Azure Kubernetes Service (AKS) with production-grade PostgreSQL + pgvector and Datadog monitoring.

## 🎯 **Prerequisites**

### **Azure Resources Required**
- **AKS cluster** with Linux node pools
- **Azure Container Registry (ACR)** for container images
- **Managed Identity** with appropriate permissions
- **Azure CLI** logged in with contributor access

### **Local Tools Required**
```bash
# Install required tools
az --version          # Azure CLI 2.0+
kubectl version       # Kubernetes CLI
helm version          # Helm 3.0+
docker --version      # Docker for building images
```

### **Permissions Required**
- **AKS Cluster Admin** role on the cluster
- **ACR Push** role on the container registry
- **Contributor** role on the resource group

---

## 🚀 **Quick Start**

### **1. Clone and Configure**
```bash
git clone https://github.com/ryanmaclean/vibecode-webgui.git
cd vibecode-webgui

# Create AKS environment configuration
cp .env.example .env.aks
```

### **2. Configure Environment**
Edit `.env.aks` with your Azure-specific values:

```bash
# Azure Configuration
CLUSTER_NAME=vibecode-aks
RESOURCE_GROUP=vibecode-rg
ACR_NAME=vibecodecr
LOCATION=eastus2
SUBSCRIPTION_ID=your-subscription-id

# Application Configuration
NAMESPACE=vibecode-platform
INGRESS_HOST=vibecode.yourdomain.com

# Datadog Configuration (required)
DD_API_KEY=your-datadog-api-key
DD_APP_KEY=your-datadog-app-key
DD_SITE=datadoghq.com

# Database Configuration (auto-generated if not provided)
POSTGRES_PASSWORD=auto-generated-secure-password
DATADOG_PASSWORD=auto-generated-monitoring-password

# Application Secrets
NEXTAUTH_SECRET=auto-generated-secret
NEXTAUTH_URL=https://vibecode.yourdomain.com
OPENROUTER_API_KEY=your-openrouter-key
AZURE_OPENAI_API_KEY=your-azure-openai-key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
```

### **3. Run Bootstrap**
```bash
# Make scripts executable
chmod +x scripts/aks-*.sh

# Run complete AKS bootstrap
./scripts/aks-bootstrap.sh
```

---

## 📋 **What Gets Deployed**

### **Core Infrastructure**
- ✅ **Datadog Agent** with AKS-optimized configuration
- ✅ **PostgreSQL 16** with pgvector extension on Azure Disk storage
- ✅ **VibeCode Application** with production-grade configuration
- ✅ **Ingress Controller** with TLS termination
- ✅ **Horizontal Pod Autoscaler** for automatic scaling

### **Monitoring & Observability**
- ✅ **Database Monitoring** with pgvector-specific metrics
- ✅ **Application Performance Monitoring** with Dynamic Instrumentation
- ✅ **Log Aggregation** with structured logging
- ✅ **Custom Metrics** for vector operations and search performance

### **Security Features**
- ✅ **Managed Identity** for service-to-service authentication
- ✅ **Azure Key Vault** integration for secrets
- ✅ **Network Policies** for pod-to-pod communication
- ✅ **Pod Security Standards** enforcement

---

## 🔧 **Manual Steps (If Needed)**

### **Create AKS Cluster**
If you don't have an AKS cluster yet:

```bash
# Create resource group
az group create --name vibecode-rg --location eastus2

# Create AKS cluster
az aks create \
  --resource-group vibecode-rg \
  --name vibecode-aks \
  --node-count 3 \
  --node-vm-size Standard_D4s_v3 \
  --enable-addons monitoring \
  --enable-managed-identity \
  --generate-ssh-keys

# Create ACR
az acr create \
  --resource-group vibecode-rg \
  --name vibecodecr \
  --sku Premium

# Attach ACR to AKS
az aks update \
  --resource-group vibecode-rg \
  --name vibecode-aks \
  --attach-acr vibecodecr
```

### **Configure kubectl**
```bash
# Get AKS credentials
az aks get-credentials \
  --resource-group vibecode-rg \
  --name vibecode-aks

# Verify connection
kubectl get nodes
```

---

## 🔍 **Verification Steps**

### **1. Check Deployments**
```bash
# Check all pods are running
kubectl get pods -n vibecode-platform

# Check Datadog agents
kubectl get pods -n datadog

# Check services
kubectl get services -n vibecode-platform
```

### **2. Test PostgreSQL + pgvector**
```bash
# Connect to PostgreSQL
kubectl exec -it statefulset/postgresql -n vibecode-platform -- psql -U postgres -d vibecode

# Test pgvector extension
vibecode=# SELECT extname FROM pg_extension WHERE extname='vector';
 extname 
---------
 vector

# Test vector operations
vibecode=# SELECT embedding <-> '[0.1,0.2,0.3]'::vector as distance FROM app.document_embeddings LIMIT 1;
```

### **3. Test Application**
```bash
# Port forward to test locally
kubectl port-forward service/vibecode-webgui 3000:80 -n vibecode-platform

# Test health endpoint
curl http://localhost:3000/api/health

# Test vector search
curl http://localhost:3000/api/docs/search?q=deployment
```

### **4. Check Datadog Dashboard**
1. Go to **Datadog → Database Monitoring**
2. Look for host: `postgresql.vibecode-platform.svc.cluster.local`
3. Verify custom metrics: `postgresql.pgvector.*`
4. Check **APM → Services** for `vibecode-webgui`

---

## 🎛️ **Configuration Details**

### **Storage Configuration**
- **PostgreSQL**: 100GB Premium SSD with Azure Disk CSI driver
- **Application**: Ephemeral storage with source maps mounted
- **Backup**: Automated PostgreSQL backups via Azure

### **Networking Configuration**
- **Ingress**: NGINX Ingress Controller with TLS
- **Service Mesh**: Optional Istio integration available
- **Network Policies**: Pod-to-pod communication restrictions

### **Scaling Configuration**
- **HPA**: CPU and memory-based autoscaling (3-20 replicas)
- **VPA**: Vertical Pod Autoscaler for resource optimization
- **Cluster Autoscaler**: Node-level scaling based on demand

### **Security Configuration**
- **Pod Security**: Restricted security context
- **RBAC**: Least-privilege service accounts
- **Secrets**: Azure Key Vault CSI driver integration
- **Network**: Private endpoints for database access

---

## 🔧 **Customization**

### **Scaling Adjustments**
Edit `k8s/vibecode-aks-deployment.yaml`:

```yaml
# Adjust HPA settings
spec:
  minReplicas: 5      # Minimum pods
  maxReplicas: 50     # Maximum pods
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        averageUtilization: 60  # Scale at 60% CPU
```

### **Resource Adjustments**
```yaml
# Adjust resource requests/limits
resources:
  requests:
    cpu: 1000m        # 1 CPU core
    memory: 2Gi       # 2GB RAM
  limits:
    cpu: 4000m        # 4 CPU cores
    memory: 8Gi       # 8GB RAM
```

### **Database Configuration**
Edit PostgreSQL configuration in `scripts/aks-postgresql-setup.sh`:

```sql
-- Adjust PostgreSQL settings
shared_buffers = 512MB        -- Increase for more memory
work_mem = 128MB             -- Increase for complex queries
maintenance_work_mem = 256MB -- Increase for index operations
```

---

## 🚨 **Troubleshooting**

### **Common Issues**

**1. Pod Stuck in Pending**
```bash
# Check node resources
kubectl describe nodes

# Check PVC status
kubectl get pvc -n vibecode-platform

# Check events
kubectl get events -n vibecode-platform --sort-by='.lastTimestamp'
```

**2. Database Connection Issues**
```bash
# Check PostgreSQL logs
kubectl logs statefulset/postgresql -n vibecode-platform

# Test database connectivity
kubectl exec -it statefulset/postgresql -n vibecode-platform -- pg_isready

# Check service DNS
kubectl exec -it deployment/vibecode-webgui -n vibecode-platform -- nslookup postgresql
```

**3. Datadog Agent Issues**
```bash
# Check agent status
kubectl exec -it daemonset/datadog-agent -n datadog -- agent status

# Check cluster agent
kubectl logs deployment/datadog-cluster-agent -n datadog

# Verify configuration
kubectl get configmap datadog-config -n datadog -o yaml
```

**4. Image Pull Issues**
```bash
# Check ACR integration
az aks check-acr --resource-group vibecode-rg --name vibecode-aks --acr vibecodecr

# Verify image exists
az acr repository list --name vibecodecr

# Check pod events
kubectl describe pod <pod-name> -n vibecode-platform
```

### **Recovery Procedures**

**Rollback Deployment**
```bash
# Rollback to previous version
kubectl rollout undo deployment/vibecode-webgui -n vibecode-platform

# Check rollout status
kubectl rollout status deployment/vibecode-webgui -n vibecode-platform
```

**Database Recovery**
```bash
# Scale down application
kubectl scale deployment/vibecode-webgui --replicas=0 -n vibecode-platform

# Backup current data
kubectl exec statefulset/postgresql -n vibecode-platform -- pg_dump -U postgres vibecode > backup.sql

# Restore from backup (if needed)
kubectl exec -i statefulset/postgresql -n vibecode-platform -- psql -U postgres vibecode < backup.sql
```

---

## 📊 **Cost Optimization**

### **Resource Optimization**
- Use **spot instances** for non-critical workloads
- Enable **cluster autoscaler** to scale down during low usage
- Set appropriate **resource requests** and **limits**

### **Storage Optimization**
- Use **Standard SSD** instead of Premium for non-critical data
- Enable **storage auto-grow** instead of over-provisioning
- Configure **backup retention** based on compliance needs

### **Monitoring Cost Control**
- Set **log retention** policies in Datadog
- Use **metric sampling** for high-volume metrics
- Configure **alert thresholds** to avoid unnecessary noise

---

## 🎯 **Production Checklist**

Before going live, ensure:

- [ ] **DNS configured** for ingress hostname
- [ ] **TLS certificates** obtained and configured
- [ ] **Backup strategy** implemented and tested
- [ ] **Monitoring alerts** configured in Datadog
- [ ] **Security scanning** completed for container images
- [ ] **Load testing** performed at expected scale
- [ ] **Disaster recovery** procedures documented
- [ ] **Access controls** reviewed and approved
- [ ] **Compliance requirements** verified
- [ ] **Performance benchmarks** established

---

This guide provides a complete path from local development to production AKS deployment with enterprise-grade monitoring and observability! 🚀
