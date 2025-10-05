# Vercel-Style Doc Search on AKS with OpenTofu

This configuration deploys a [Vercel Next.js OpenAI Doc Search Starter](https://vercel.com/templates/next.js/nextjs-openai-doc-search-starter) equivalent on Azure Kubernetes Service (AKS) using OpenTofu.

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Azure Resource Group                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐    ┌──────────────────────────────┐   │
│  │   AKS Cluster   │    │     PostgreSQL + pgvector    │   │
│  │                 │    │                              │   │
│  │ ┌─────────────┐ │    │ ┌──────────────────────────┐ │   │
│  │ │ Next.js App │ │    │ │ Vector Embeddings Store  │ │   │
│  │ │ (3 replicas)│◄┼────┼─┤ (Supabase alternative)  │ │   │
│  │ └─────────────┘ │    │ └──────────────────────────┘ │   │
│  │                 │    │                              │   │
│  │ ┌─────────────┐ │    │ ┌──────────────────────────┐ │   │
│  │ │ DocSearch   │ │    │ │ Full-text + Vector Search│ │   │
│  │ │ Component   │ │    │ │ (pgvector + tsvector)    │ │   │
│  │ └─────────────┘ │    │ └──────────────────────────┘ │   │
│  └─────────────────┘    └──────────────────────────────┘   │
│                                                             │
│  ┌─────────────────┐    ┌──────────────────────────────┐   │
│  │ Azure OpenAI    │    │      Azure Key Vault        │   │
│  │                 │    │                              │   │
│  │ ┌─────────────┐ │    │ ┌──────────────────────────┐ │   │
│  │ │ GPT-4 Turbo │ │    │ │ Database Connection      │ │   │
│  │ │ Deployment  │ │    │ │ OpenAI API Keys          │ │   │
│  │ └─────────────┘ │    │ │ Application Secrets      │ │   │
│  │                 │    │ └──────────────────────────┘ │   │
│  │ ┌─────────────┐ │    └──────────────────────────────┘   │
│  │ │ Embeddings  │ │                                       │
│  │ │ Deployment  │ │    ┌──────────────────────────────┐   │
│  │ └─────────────┘ │    │   Azure Container Registry   │   │
│  └─────────────────┘    │                              │   │
│                         │ ┌──────────────────────────┐ │   │
│                         │ │ Next.js Docker Images    │ │   │
│                         │ │ (vibecode-docs:latest)   │ │   │
│                         │ └──────────────────────────┘ │   │
│                         └──────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites

1. **OpenTofu** >= 1.6 installed:
   ```bash
   # macOS
   brew install opentofu
   
   # Linux
   curl -fsSL https://get.opentofu.org/install-opentofu.sh | sh
   
   # Verify
   tofu version
   ```

2. **Azure CLI** authenticated:
   ```bash
   az login
   az account set --subscription "your-subscription-id"
   ```

3. **kubectl** for Kubernetes management:
   ```bash
   brew install kubectl  # macOS
   ```

### Step 1: Configure Deployment

```bash
# Clone repository
git clone https://github.com/vibecode/vibecode-webgui.git
cd vibecode-webgui/infrastructure/opentofu/vercel-style-deployment

# Copy and edit configuration
cp terraform.tfvars.example terraform.tfvars
nano terraform.tfvars
```

> ℹ️ **Cost control tip:** leave `postgresql_high_availability_enabled = false` for dev/test runs. Enable it only when you need zone-redundant capacity in production.

### Step 2: Deploy Infrastructure

```bash
# Initialize OpenTofu
tofu init

# Plan deployment
tofu plan

# Deploy (takes ~15-20 minutes)
tofu apply
```

### Step 3: Configure Kubernetes

```bash
# Get AKS credentials
tofu output -raw kubectl_config_command | bash

# Verify connection
kubectl get nodes
```

### Step 4: Deploy Application

```bash
# Build and push Docker image
tofu output -raw docker_login_command | bash
docker build -t $(tofu output -raw container_registry_login_server)/vibecode-docs:latest .
docker push $(tofu output -raw container_registry_login_server)/vibecode-docs:latest

# Deploy with Helm
helm upgrade --install vibecode-docs ./helm/vibecode-docs \
  --namespace vibecode-docs \
  --create-namespace \
  --set image.repository=$(tofu output -raw container_registry_login_server)/vibecode-docs \
  --set image.tag=latest
```

### Step 5: Initialize Database

```bash
# Apply database migrations
kubectl exec -it deployment/vibecode-docs -- npm run db:migrate

# Generate embeddings from documentation
kubectl exec -it deployment/vibecode-docs -- npm run embeddings:generate
```

## 🔍 Key Differences from Vercel Template

| Component | **Vercel Template** | **Our AKS Implementation** |
|-----------|-------------------|----------------------------|
| **Hosting** | Vercel Edge Functions | ✅ **AKS with auto-scaling** |
| **Database** | Supabase (managed) | ✅ **Azure PostgreSQL Flexible Server** |
| **Vector DB** | Supabase pgvector | ✅ **Native pgvector with optimizations** |
| **AI Service** | OpenAI API | ✅ **Azure OpenAI Service** |
| **Secrets** | Vercel Environment Variables | ✅ **Azure Key Vault** |
| **Monitoring** | Vercel Analytics | ✅ **Azure Monitor + Container Insights** |
| **Scaling** | Automatic (serverless) | ✅ **Kubernetes HPA + Node Auto-scaling** |
| **Cost Model** | Pay-per-request | ✅ **Fixed infrastructure costs** |

## 🎯 Architecture Benefits

### **Enterprise Features**
- 🔄 **Optional High Availability**: Toggle `postgresql_high_availability_enabled` for multi-zone PostgreSQL when the workload justifies the cost
- ✅ **Security**: Private networking, Key Vault, workload identity
- ✅ **Monitoring**: Azure Monitor with Container Insights
- ✅ **Compliance**: Azure compliance certifications

### **Performance Optimizations**
- ✅ **Database Tuning**: pgvector-optimized PostgreSQL configuration
- ✅ **Connection Pooling**: Built-in PostgreSQL connection pooling
- ✅ **Caching**: Redis integration ready
- ✅ **CDN Ready**: Azure Front Door integration available

### **Cost Efficiency**
- ✅ **Predictable Costs**: Fixed monthly infrastructure costs
- ✅ **Resource Optimization**: Auto-scaling based on demand
- ✅ **Spot Instances**: Optional spot node pools for dev/staging

## 📊 Resource Specifications

### **Production Configuration**
- **AKS Cluster**: 2 system nodes (Standard_D4s_v3) + 3-10 user nodes (Standard_D8s_v3)
- **PostgreSQL**: Standard_D4s_v3 with 64GB storage, HA enabled
- **Azure OpenAI**: S0 tier with GPT-4 Turbo + embeddings deployments
- **Storage**: 64GB PostgreSQL + 20GB container registry

### **Estimated Monthly Costs (East US 2)**
- AKS Cluster: ~$400-800/month (depending on node count)
- PostgreSQL: ~$200-300/month (with HA)
- Azure OpenAI: ~$50-200/month (usage-based)
- **Total**: ~$650-1300/month for production workload

## 🔧 Customization Options

### **Scaling Configuration**
```hcl
# In terraform.tfvars
aks_user_node_min_count = 2    # Minimum nodes
aks_user_node_max_count = 20   # Maximum nodes
replicas = 5                   # Application replicas
```

### **Database Performance**
```hcl
postgresql_sku_name = "GP_Standard_D8s_v3"  # Higher performance
postgresql_storage_mb = 131072               # 128GB storage
```

### **AI Model Configuration**
The deployment includes optimized Azure OpenAI deployments:
- **GPT-4 Turbo**: 30 TPM capacity for chat completions
- **text-embedding-ada-002**: 120 TPM for vector embeddings

## 🚀 Deployment Commands Reference

```bash
# Initialize infrastructure
tofu init
tofu plan
tofu apply

# Get cluster access
$(tofu output -raw kubectl_config_command)

# Deploy application
$(tofu output -raw docker_login_command)
docker build -t $(tofu output -raw container_registry_login_server)/vibecode-docs:latest .
docker push $(tofu output -raw container_registry_login_server)/vibecode-docs:latest

# Initialize database
kubectl exec -it deployment/vibecode-docs -- npm run db:migrate
kubectl exec -it deployment/vibecode-docs -- npm run embeddings:generate

# Verify deployment
kubectl get pods -n vibecode-docs
kubectl logs -f deployment/vibecode-docs -n vibecode-docs
```

## 🔍 Monitoring and Troubleshooting

### **Check Application Status**
```bash
# Pod status
kubectl get pods -n vibecode-docs

# Application logs
kubectl logs -f deployment/vibecode-docs -n vibecode-docs

# Database connectivity
kubectl exec -it deployment/vibecode-docs -- npm run db:test
```

### **Performance Monitoring**
- **Azure Monitor**: Container insights for cluster metrics
- **Application Insights**: Application performance monitoring
- **PostgreSQL Insights**: Database performance metrics

### **Common Issues**
1. **Database Connection**: Check Key Vault secrets and network connectivity
2. **Image Pull Errors**: Verify ACR permissions and image tags
3. **OpenAI API Limits**: Monitor Azure OpenAI quota and deployments

## 🔄 Updating and Maintenance

### **Infrastructure Updates**
```bash
# Update infrastructure
tofu plan
tofu apply

# Update Kubernetes cluster
az aks upgrade --resource-group $(tofu output -raw resource_group_name) \
               --name $(tofu output -raw aks_cluster_name) \
               --kubernetes-version 1.29
```

### **Application Updates**
```bash
# Build new version
docker build -t $(tofu output -raw container_registry_login_server)/vibecode-docs:v2.0 .
docker push $(tofu output -raw container_registry_login_server)/vibecode-docs:v2.0

# Update deployment
helm upgrade vibecode-docs ./helm/vibecode-docs \
  --namespace vibecode-docs \
  --set image.tag=v2.0
```

This implementation provides enterprise-grade infrastructure for the Vercel doc search template while maintaining the same developer experience and functionality.
