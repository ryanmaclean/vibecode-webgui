---
title: azure infrastructure
description: azure infrastructure documentation
---

# Azure Infrastructure Summary for VibeCode WebGUI

## 🎯 **Complete Enterprise-Ready Azure Deployment**

I've created a comprehensive Terraform infrastructure for deploying VibeCode WebGUI on Azure with full enterprise features including **Azure AI Services integration**, **PostgreSQL with pgvector**, **AKS deployment**, and **Datadog Database Monitoring**.

---

## 📋 **Infrastructure Components Created**

### 🏗️ **Core Infrastructure**
- ✅ **Azure Resource Group** with consistent naming and tagging
- ✅ **Virtual Network** with dedicated subnets for AKS and PostgreSQL
- ✅ **Network Security Groups** with proper firewall rules
- ✅ **Private DNS Zones** for secure service communication
- ✅ **Key Vault** for centralized secrets management
- ✅ **Log Analytics Workspace** for monitoring and logging

### 🚢 **Azure Kubernetes Service (AKS)**
- ✅ **Production-ready AKS cluster** with managed identity
- ✅ **System node pool** (2x Standard_D4s_v3) for system workloads
- ✅ **User node pool** (3x Standard_D8s_v3) for application workloads
- ✅ **Auto-scaling enabled** (1-10 nodes) with intelligent scaling policies
- ✅ **Workload Identity** integration for secure pod authentication
- ✅ **Azure CNI networking** with network policies
- ✅ **Azure Monitor integration** with Container Insights
- ✅ **Key Vault secrets provider** for automatic secret rotation

### 🐘 **PostgreSQL Flexible Server with pgvector**
- ✅ **PostgreSQL 16** with High Availability and geo-redundant backups
- ✅ **pgvector extension** automatically enabled per [Azure documentation](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/how-to-use-pgvector)
- ✅ **Performance-optimized configuration** for vector operations:
  - `shared_preload_libraries = 'vector'`
  - `max_wal_size = '2GB'`
  - `work_mem = '256MB'`
  - `maintenance_work_mem = '512MB'`
- ✅ **Private networking** with VNet integration
- ✅ **Automated backups** with 35-day retention
- ✅ **Datadog Database Monitoring** user and permissions
- ✅ **Database diagnostic settings** for comprehensive monitoring

### 🧠 **Azure AI Services Integration**
- ✅ **Azure OpenAI Service** with multiple model deployments:
  - GPT-4 Turbo for complex reasoning
  - GPT-3.5 Turbo for fast responses
  - text-embedding-ada-002 for vector embeddings
- ✅ **Computer Vision Service** for image analysis
- ✅ **Language Service** for text analytics and sentiment analysis
- ✅ **Cognitive Services Multi-Service** account
- ✅ **Managed Identity integration** for secure access
- ✅ **Network access controls** with VNet integration

### 📦 **Container Infrastructure**
- ✅ **Azure Container Registry (Premium)** with geo-replication
- ✅ **Managed Identity authentication** (no admin passwords)
- ✅ **Network rules** for secure access
- ✅ **Trust and retention policies** for production compliance

### 📊 **Monitoring and Observability**
- ✅ **Datadog Agent** deployed via Helm with latest versions:
  - Node Agent: 7.66.1 (meets >=7.33.0 requirement)
  - Cluster Agent: 1.24.0 (meets >=1.18.0 requirement)
- ✅ **orchestratorExplorer enabled** for Pod collection
- ✅ **Database Monitoring** with dedicated PostgreSQL user
- ✅ **Log collection** from all containers
- ✅ **APM and Network Monitoring** enabled
- ✅ **Custom metrics** and dashboard integration

---

## 🔧 **Created Terraform Files**

| File | Purpose | Features |
|------|---------|----------|
| **`main.tf`** | Core infrastructure setup | Resource group, networking, Key Vault, logging |
| **`variables.tf`** | All configuration variables | 40+ variables with validation and defaults |
| **`postgresql.tf`** | Database configuration | pgvector setup, monitoring user, performance tuning |
| **`ai-services.tf`** | Azure AI Services | OpenAI, Computer Vision, Language services |
| **`aks.tf`** | Kubernetes cluster | AKS with node pools, auto-scaling, security |
| **`kubernetes-deployment.tf`** | K8s application deployment | Pods, services, HPA, Datadog integration |
| **`terraform.tfvars.example`** | Configuration template | Production-ready example values |
| **`README.md`** | Comprehensive deployment guide | Step-by-step instructions |

---

## 🚀 **Azure AI Services as OpenRouter Alternative**

### **OpenRouter-Compatible Interface**
Created `src/lib/azure-ai-client.ts` that provides:
- ✅ **Drop-in replacement** for OpenRouter API calls
- ✅ **Unified interface** for all Azure AI services
- ✅ **Chat completions** using Azure OpenAI GPT-4/GPT-3.5
- ✅ **Vector embeddings** using Azure OpenAI text-embedding-ada-002
- ✅ **Image analysis** using Azure Computer Vision
- ✅ **Text analytics** using Azure Language Service
- ✅ **Model information** in OpenRouter-compatible format

### **Usage Examples**
```typescript
// Drop-in replacement for OpenRouter
import { getAzureAIClient } from '@/lib/azure-ai-client';

const aiClient = getAzureAIClient();

// Chat completion (same API as OpenRouter)
const response = await aiClient.createChatCompletion({
  messages: [{ role: 'user', content: 'Help me debug this code' }],
  model: 'gpt-4-turbo'
});

// Vector embeddings for RAG
const embeddings = await aiClient.createEmbedding({
  input: 'Code documentation text',
  model: 'text-embedding-ada-002'
});

// Extended Azure capabilities
const imageAnalysis = await aiClient.analyzeImage(imageUrl);
const sentiment = await aiClient.analyzeSentiment(text);
```

---

## 🎯 **Datadog Database Monitoring Compliance**

### **Version Compliance** ✅
- **Datadog Agent**: 7.66.1 (required: >=7.33.0)
- **Cluster Agent**: 1.24.0 (required: >=1.18.0)
- **orchestratorExplorer**: Enabled for Pod collection
- **Both agents running**: Yes, in each cluster

### **Database Monitoring Features** ✅
- **Dedicated monitoring user** with proper PostgreSQL permissions
- **Query performance monitoring** with pg_stat_statements
- **Connection pool analysis** and session monitoring
- **Lock detection** and deadlock analysis
- **Index recommendations** for vector queries
- **Resource utilization** tracking (CPU, memory, storage)

---

## 💰 **Cost Estimates and Optimization**

### **Monthly Cost Breakdown (East US 2)**
- **AKS Cluster**: ~$800/month (2x D4s_v3 + 3x D8s_v3)
- **PostgreSQL**: ~$350/month (GP_Standard_D4s_v3 + HA + 64GB)
- **Azure OpenAI**: ~$200/month (GPT-4 + GPT-3.5 + embeddings)*
- **AI Services**: ~$100/month (Computer Vision + Language)*
- **Container Registry**: ~$20/month (Premium)
- **Log Analytics**: ~$100/month (30-day retention)
- **Total**: **~$1,570/month**

*\*AI costs vary based on usage*

### **Cost Optimization Features** ✅
- **Auto-scaling** enabled to reduce costs during low usage
- **Spot instances** configurable for non-critical workloads
- **Reserved instances** recommended for predictable workloads
- **Budget alerts** can be configured in Azure Cost Management

#### 🪶 Minimum AKS Footprint Checklist
- Keep the system node pool on the smallest supported general-purpose SKU (≥4 vCPUs, ≥4 GB RAM) with exactly two nodes and a taint so only system add-ons land there.
- Place application pods on a separate user node pool with the autoscaler `minCount` (or manual node count) set to `0` so it drains completely when traffic is idle.
- Use `az aks stop` / `az aks start` to hibernate the cluster during predictable downtimes; the managed control plane remains free in the AKS Free tier while nodes are stopped.
- Stick with the AKS Free tier unless you require an uptime SLA—this keeps the control plane cost at $0 and focuses spend on the nodes you actually run.

### 🚨 **Failure Mode: Local OpenTofu State Loss**
- **What happened**: Deleting `tofu/terraform.tfstate` (or its lock file) locally while the cluster exists remotely confuses OpenTofu. Subsequent applies recreate the Azure resource groups from scratch, tearing down AKS, Postgres, and the ingress IP.
- **Symptoms**: `az group list` shows missing `rg-vibecode-aks-prod`, DNS stops resolving, and OpenTofu plans report all infrastructure as new.
- **Mitigation**:
  1. Restore a recent backup (`terraform.tfstate.YYYYMMDD.backup`) before running `tofu plan` again.
  2. Move state off the laptop: create an Azure Storage account + blob container and switch the backend (`scripts/create-remote-state-storage.sh`, then copy `tofu/backend.tf.example` ➜ `backend.tf` and run `tofu init -migrate-state`).
  3. Require `TF_BACKEND_CONFIG` secrets in CI and protect the storage account with RBAC/soft delete so accidental removals are recoverable.
  4. After recreating the cluster, Azure may report `provisioningState: Creating` with zero nodes. Wait for the VMSS to finish booting (5–10 minutes) before retrying Helm/`kubectl`; premature applies will fail with `No resources found`.

```bash
# One-time setup: provision storage account + container for remote state
./scripts/create-remote-state-storage.sh \
  RESOURCE_GROUP=rg-vibecode-tofu-state \
  STORAGE_ACCOUNT_NAME=vibecodetofustate123 \
  CONTAINER_NAME=opentofu-state

# Migrate local state to Azure Blob Storage
TF_BACKEND_RG=rg-vibecode-tofu-state \
TF_BACKEND_STORAGE=vibecodetofustate123 \
TF_BACKEND_CONTAINER=opentofu-state \
tofu init -migrate-state \
  -backend-config="resource_group_name=${TF_BACKEND_RG}" \
  -backend-config="storage_account_name=${TF_BACKEND_STORAGE}" \
  -backend-config="container_name=${TF_BACKEND_CONTAINER}" \
  -backend-config="key=opentofu/terraform.tfstate"
```

---

## 🔒 **Security and Compliance**

### **Network Security** ✅
- **Private subnets** for database and AI services
- **Network Security Groups** with minimal required access
- **Private DNS zones** for secure communication
- **VNet integration** for all services

### **Identity and Access** ✅
- **Managed Identity** for all service-to-service authentication
- **Workload Identity** for Kubernetes pods
- **Azure RBAC** integration
- **Key Vault** for secrets management with rotation

### **Data Protection** ✅
- **Encryption at rest** for all data stores
- **TLS encryption** for data in transit
- **Private endpoints** for database access
- **Geo-redundant backups** for disaster recovery

---

## 📈 **Scalability and Performance**

### **Auto-Scaling Configuration** ✅
- **AKS cluster**: 1-10 nodes with intelligent scaling
- **Horizontal Pod Autoscaler**: 3-20 pods based on CPU/memory
- **PostgreSQL**: Vertical scaling available
- **AI Services**: Standard scale with burst capacity

### **Performance Optimization** ✅
- **PostgreSQL tuned** for vector operations
- **AKS node pools** optimized for different workloads
- **Container resource limits** and requests configured
- **Network performance** optimized with Azure CNI

---

## 🚀 **Deployment Instructions**

### **Prerequisites**
1. Azure CLI authenticated
2. Terraform >= 1.5 installed
3. kubectl installed
4. Required Azure permissions

### **Quick Deployment**
```bash
# 1. Clone and configure
git clone https://github.com/vibecode/vibecode-webgui.git
cd vibecode-webgui/infrastructure/terraform/azure
cp terraform.tfvars.example terraform.tfvars

# 2. Set required variables
export TF_VAR_datadog_api_key="your-datadog-api-key"
export TF_VAR_datadog_app_key="your-datadog-app-key"

# 3. Deploy infrastructure (15-20 minutes)
terraform init
terraform plan
terraform apply

# 4. Configure kubectl
az aks get-credentials --resource-group $(terraform output -raw resource_group_name) \
                       --name $(terraform output -raw aks_cluster_name)

# 5. Build and deploy application
docker build -t $(terraform output -raw acr_login_server)/vibecode:latest .
docker push $(terraform output -raw acr_login_server)/vibecode:latest
```

---

## ✅ **Testing Validation**

### **PostgreSQL pgvector Integration** ✅
All deployment methods now use `pgvector/pgvector:pg16`:
- ✅ Local Docker Compose
- ✅ Production Docker Compose  
- ✅ KIND Kubernetes
- ✅ Azure PostgreSQL Flexible Server

### **Prisma Schema Compatibility** ✅
```prisma
model RAGChunk {
  embedding  Unsupported("vector(1536)")? // Works across all deployments
}
```

### **Datadog Agent Compliance** ✅
All monitoring requirements met per compatibility matrix.

---

## 🔗 **Integration Points**

### **Application Integration**
- **Environment variables** automatically configured via Kubernetes secrets
- **Azure AI endpoints** available through workload identity
- **Database connection** secured with managed identity
- **Monitoring** enabled with Datadog integration

### **CI/CD Integration**
- **Container Registry** ready for automated builds
- **Kubernetes deployments** configured for rolling updates
- **Infrastructure updates** via Terraform
- **Monitoring alerts** configurable in Datadog

---

## 📚 **Documentation Created**

1. **`infrastructure/terraform/azure/README.md`** - Complete deployment guide
2. **`terraform.tfvars.example`** - Configuration template
3. **`src/lib/azure-ai-client.ts`** - Azure AI integration library
4. **This summary document** - Architecture overview

---

## 🎉 **Achievements Summary**

✅ **Complete Azure infrastructure** with enterprise features  
✅ **Azure AI Services integration** as OpenRouter alternative  
✅ **PostgreSQL with pgvector** properly configured per Azure docs  
✅ **Datadog Database Monitoring** with compliance verification  
✅ **AKS deployment** with auto-scaling and security  
✅ **Comprehensive documentation** and deployment guides  
✅ **Cost-optimized configuration** with monitoring  
✅ **Production-ready security** with managed identities  

**The infrastructure is now ready for production deployment with full Azure AI Services integration, vectorized database capabilities, and enterprise-grade monitoring!** 🚀 
