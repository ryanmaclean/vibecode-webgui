# Azure Infrastructure for VibeCode WebGUI

This Terraform configuration deploys a complete VibeCode WebGUI platform on Azure with:

- **AKS Cluster** with auto-scaling and multiple node pools
- **Azure Database for PostgreSQL Flexible Server** with pgvector extension
- **Azure AI Services** (OpenAI, Computer Vision, Language Service) 
- **Azure Container Registry** for container images
- **Datadog Database Monitoring** with full observability
- **Key Vault** for secrets management
- **Virtual Network** with proper security groups

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Azure Resource Group                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐    ┌──────────────────────────────┐   │
│  │   Azure AKS     │    │     PostgreSQL Flexible      │   │
│  │   Cluster       │◄──►│     Server + pgvector        │   │
│  │                 │    │                              │   │
│  │ • System Nodes  │    │ • High Availability          │   │
│  │ • User Nodes    │    │ • Automated Backups          │   │
│  │ • Auto-scaling  │    │ • Database Monitoring        │   │
│  └─────────────────┘    └──────────────────────────────┘   │
│           │                                                 │
│           ▼                                                 │
│  ┌─────────────────┐    ┌──────────────────────────────┐   │
│  │   Azure AI      │    │      Key Vault              │   │
│  │   Services      │    │                              │   │
│  │                 │    │ • API Keys                   │   │
│  │ • OpenAI GPT-4  │    │ • Connection Strings         │   │
│  │ • Computer Vision│    │ • Certificates               │   │
│  │ • Language Svc  │    │ • Secrets Rotation           │   │
│  └─────────────────┘    └──────────────────────────────┘   │
│                                                             │
│  ┌─────────────────┐    ┌──────────────────────────────┐   │
│  │   Container     │    │      Log Analytics           │   │
│  │   Registry      │    │      Workspace               │   │
│  │                 │    │                              │   │
│  │ • Premium SKU   │    │ • Container Insights         │   │
│  │ • Managed ID    │    │ • Datadog Integration        │   │
│  │ • Geo-replication│   │ • Custom Metrics             │   │
│  └─────────────────┘    └──────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites

1. **Azure CLI** installed and authenticated:
   ```bash
   az login
   az account set --subscription "your-subscription-id"
   ```

2. **Terraform** >= 1.5 or **OpenTofu** >= 1.6 installed:
   ```bash
   # macOS - Terraform
   brew install terraform
   
   # macOS - OpenTofu (open-source alternative)
   brew install opentofu
   
   # Or download from:
   # Terraform: https://www.terraform.io/downloads
   # OpenTofu: https://opentofu.org/docs/intro/install/
   ```

3. **kubectl** installed for Kubernetes management:
   ```bash
   # macOS
   brew install kubectl
   ```

4. **Required Azure permissions**:
   - Contributor or Owner role on the subscription
   - Ability to create service principals
   - Access to create Azure AI Services resources

### Step 1: Clone and Configure

```bash
git clone https://github.com/vibecode/vibecode-webgui.git
cd vibecode-webgui/infrastructure/terraform/azure
```

### Step 2: Configure Variables

```bash
# Copy example configuration
cp terraform.tfvars.example terraform.tfvars

# Edit with your values
nano terraform.tfvars
```

**Required variables to set:**
```hcl
# Project configuration
project_name = "vibecode"
environment  = "prod"
azure_region = "East US 2"

# Monitoring (required)
datadog_api_key = "your-datadog-api-key"
datadog_app_key = "your-datadog-app-key"

# Optional: Domain configuration
domain_name = "app.vibecode.com"
```

### Step 3: Initialize and Deploy

```bash
# For Terraform users:
terraform init
terraform plan
terraform apply

# For OpenTofu users (open-source alternative):
tofu init
tofu plan
tofu apply
```

The deployment takes approximately **15-20 minutes** and creates:
- ✅ Resource Group and networking
- ✅ PostgreSQL with pgvector extension
- ✅ AKS cluster with 2 node pools
- ✅ Azure AI Services with GPT-4 and embeddings
- ✅ Container Registry with managed identity
- ✅ Key Vault with all secrets
- ✅ Datadog monitoring setup

### Step 4: Configure kubectl

```bash
# Get AKS credentials
az aks get-credentials --resource-group $(terraform output -raw resource_group_name) \
                       --name $(terraform output -raw aks_cluster_name)

# Verify connection
kubectl get nodes
```

### Step 5: Deploy Application

```bash
# Build and push container image
docker build -t $(terraform output -raw acr_login_server)/vibecode:latest .
docker push $(terraform output -raw acr_login_server)/vibecode:latest

# Application is automatically deployed via Terraform
kubectl get pods -n vibecode
```

## 🔐 Security Features

### Network Security
- **Private subnets** for database and AI services
- **Network Security Groups** with minimal required access
- **Private DNS zones** for secure service communication
- **Azure CNI** with network policies enabled

### Identity and Access Management
- **Managed Identity** for all service-to-service authentication
- **Workload Identity** for Kubernetes pods
- **Azure RBAC** integration for fine-grained permissions
- **Key Vault** integration for secrets management

### Data Protection
- **Encryption at rest** for all data stores
- **TLS encryption** for all data in transit
- **Private endpoints** for database access
- **Geo-redundant backups** for disaster recovery

## 🧠 Azure AI Services Integration

### Azure OpenAI Service
The deployment includes multiple model deployments:

```typescript
// Available models after deployment
const models = {
  chat: "gpt-4-turbo",           // GPT-4 for complex reasoning
  completion: "gpt-35-turbo",     // GPT-3.5 for faster responses  
  embedding: "text-embedding-ada-002"  // Vector embeddings
};

// Usage example
import { getAzureAIClient } from '@/lib/azure-ai-client';

const aiClient = getAzureAIClient();
const response = await aiClient.createChatCompletion({
  messages: [{ role: 'user', content: 'Help me debug this code' }],
  model: 'gpt-4-turbo'
});
```

### Computer Vision Service
```typescript
// Analyze code screenshots or diagrams
const analysis = await aiClient.analyzeImage(imageUrl, [
  'Description', 'Tags', 'Objects'
]);
```

### Language Service
```typescript
// Analyze code comments and documentation
const sentiment = await aiClient.analyzeSentiment(codeComments);
const keyPhrases = await aiClient.extractKeyPhrases(documentation);
```

## 🚀 **Redis & Key-Value Store Options**

VibeCode provides **three enterprise-grade options** for key-value storage, caching, and session management:

### **1. Azure Cache for Redis (Recommended)**
Microsoft's traditional managed Redis service with enterprise features:

- ✅ **Fully managed** with automatic patching and updates
- ✅ **High availability** with zone redundancy and geo-replication  
- ✅ **Multiple tiers**: Basic, Standard, Premium with up to 1.2TB memory
- ✅ **Enterprise security** with VNet integration and private endpoints
- ✅ **Backup & recovery** with automated RDB snapshots
- ✅ **Compatible** with all Redis clients and applications

```hcl
# Configure in terraform.tfvars
redis_deployment_type = "azure_cache_redis"
azure_cache_redis_config = {
  sku_name    = "Premium"
  capacity    = 1
  zones       = ["1", "2", "3"]
  redis_configuration = {
    maxmemory_policy     = "allkeys-lru"
    rdb_backup_enabled   = true
    rdb_backup_frequency = 60
  }
}
```

### **2. Azure Managed Redis (Preview)**
Microsoft's **next-generation Redis service** with latest innovations:

- ✅ **Latest Redis Enterprise** features (RediSearch, RedisJSON, RedisTimeSeries, RedisBloom)
- ✅ **Superior performance** with up to 99.999% availability
- ✅ **Advanced modules** for AI/ML workloads and vector search
- ✅ **Flash storage** options for cost-effective large datasets
- ✅ **Active geo-replication** for global applications
- ✅ **Enhanced observability** with real-time metrics

```hcl
# Configure in terraform.tfvars  
redis_deployment_type = "azure_managed_redis"
azure_managed_redis_config = {
  sku_name          = "Balanced"
  capacity_gb       = 12
  high_availability = true
  modules = [
    "RediSearch",      # Vector search and full-text search
    "RedisJSON",       # Native JSON support
    "RedisTimeSeries", # Time series data
    "RedisBloom"       # Probabilistic data structures
  ]
}
```

### **3. Valkey (Open Source)**
The **community-driven Redis fork** by [Linux Foundation](https://github.com/valkey-io/valkey):

- ✅ **100% open source** under BSD license, no licensing restrictions
- ✅ **Redis compatible** with enhanced performance and features
- ✅ **Multi-threading** for better multi-core utilization
- ✅ **Experimental RDMA** support for ultra-low latency
- ✅ **Community backed** by AWS, Google Cloud, and Oracle
- ✅ **Cost effective** running on your AKS infrastructure

```hcl
# Configure in terraform.tfvars
redis_deployment_type = "valkey"
valkey_config = {
  cluster_size       = 3
  replica_count      = 1
  memory_limit       = "4Gi"
  storage_size       = "10Gi"
  enable_persistence = true
}
```

**Valkey vs Redis Comparison:**

| Feature | Azure Cache for Redis | Azure Managed Redis | Valkey |
|---------|----------------------|--------------------|---------| 
| **Licensing** | Proprietary/Commercial | Proprietary/Commercial | Open Source (BSD) |
| **Latest Features** | Redis 6.x/7.x | Redis Enterprise 7.4+ | Redis 7.2.4+ with enhancements |
| **Multi-threading** | Limited | Enterprise features | Enhanced multi-threading |
| **Vector Search** | Limited | RediSearch module | Compatible with Redis modules |
| **RDMA Support** | No | No | Experimental support |
| **Cost** | Managed service pricing | Premium managed pricing | Infrastructure costs only |
| **Support** | Microsoft Enterprise | Microsoft Enterprise | Community + your team |

### **Choosing the Right Option**

- **Use Azure Cache for Redis** for production workloads requiring enterprise support and proven stability
- **Use Azure Managed Redis** for cutting-edge features, AI/ML workloads, and maximum performance
- **Use Valkey** for cost optimization, open-source preference, or custom Redis requirements

### **Deployment Flexibility**

Deploy **all three simultaneously** for testing and migration:

```hcl
redis_deployment_type = "all"  # Deploys all three options
```

This allows you to:
- **Compare performance** across different implementations
- **Migrate gradually** from one service to another  
- **Use different services** for different application components
- **Test compatibility** before committing to a single solution

## 🐘 PostgreSQL with pgvector

### Automatic Setup
The deployment automatically:
- ✅ Enables the **pgvector extension** as per [Azure documentation](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/how-to-use-pgvector)
- ✅ Configures **performance parameters** for vector operations
- ✅ Sets up **Datadog Database Monitoring** user
- ✅ Creates **private networking** with AKS integration

### Vector Search Ready
```sql
-- Vector extension is automatically enabled
CREATE TABLE embeddings (
  id SERIAL PRIMARY KEY,
  content TEXT,
  embedding vector(1536)  -- Ready for OpenAI embeddings
);

-- Optimized for similarity search
SELECT content FROM embeddings 
ORDER BY embedding <-> '[0.1, 0.2, ...]'::vector 
LIMIT 10;
```

### Performance Configuration
The deployment automatically configures:
```sql
-- Optimized parameters for vector operations
shared_preload_libraries = 'vector'
max_wal_size = '2GB'
work_mem = '256MB'
maintenance_work_mem = '512MB'
```

## 📊 Datadog Database Monitoring

### Automatic Configuration
- ✅ **Database Monitoring** enabled for PostgreSQL
- ✅ **Dedicated monitoring user** with proper permissions
- ✅ **Query sampling** and performance insights
- ✅ **Agent version compliance** (>=7.33.0 and >=1.18.0)
- ✅ **orchestratorExplorer** enabled for Pod collection

### Monitoring Features
- **Query Performance**: Slow query detection and optimization recommendations
- **Connection Monitoring**: Connection pool and session analysis
- **Lock Analysis**: Deadlock detection and resolution guidance
- **Index Recommendations**: Automatic index suggestions for vector queries
- **Resource Utilization**: CPU, memory, and storage monitoring

## 🔧 Configuration Options

### Environment-Specific Configurations

**Development Environment:**
```hcl
environment = "dev"
postgresql_high_availability_enabled = false
postgresql_backup_retention_days = 7
aks_user_node_count = 1
aks_user_node_max_count = 3
```

**Production Environment:**
```hcl
environment = "prod"
postgresql_high_availability_enabled = true
postgresql_geo_redundant_backup_enabled = true
postgresql_backup_retention_days = 35
enable_private_cluster = true
authorized_ip_ranges = ["your.office.ip/32"]
```

### Scaling Configuration
```hcl
# Auto-scaling parameters
aks_user_node_min_count = 3
aks_user_node_max_count = 20

# PostgreSQL performance tiers
postgresql_sku_name = "GP_Standard_D8s_v3"  # 8 vCPU, 32GB RAM
postgresql_storage_mb = 131072               # 128GB storage
```

## 🏷️ Cost Optimization

### Estimated Monthly Costs (East US 2)

| Component | SKU | Estimated Cost |
|-----------|-----|----------------|
| **AKS Cluster** | 2x D4s_v3 + 3x D8s_v3 | ~$800/month |
| **PostgreSQL** | GP_Standard_D4s_v3 + 64GB | ~$350/month |
| **Azure OpenAI** | GPT-4 + GPT-3.5 + Embeddings | ~$200/month* |
| **Computer Vision** | S0 tier | ~$50/month* |
| **Language Service** | S0 tier | ~$50/month* |
| **Container Registry** | Premium | ~$20/month |
| **Log Analytics** | 30-day retention | ~$100/month |
| **Total** | | **~$1,570/month** |

*\*AI service costs depend on usage volume*

### Cost Optimization Tips
1. **Use Spot Instances** for non-critical workloads
2. **Configure auto-scaling** to scale down during off-hours
3. **Use Reserved Instances** for predictable workloads
4. **Monitor AI usage** and optimize prompt engineering
5. **Set up budget alerts** in Azure Cost Management

## 🔍 Monitoring and Observability

### Built-in Monitoring Stack
- **Azure Monitor** for infrastructure metrics
- **Container Insights** for Kubernetes monitoring
- **Log Analytics** for centralized logging
- **Datadog Agent** for comprehensive observability
- **Application Insights** integration ready

### Key Metrics to Monitor
```yaml
Infrastructure:
  - AKS node CPU/memory utilization
  - PostgreSQL connection count and query performance
  - AI service token usage and latency
  - Container registry pull metrics

Application:
  - Request latency and error rates
  - Database query performance
  - AI model response times
  - Vector search performance
```

## 🚨 Troubleshooting

### Common Issues

**1. PostgreSQL Connection Issues**
```bash
# Check network connectivity
kubectl exec -it deployment/vibecode-app -n vibecode -- nc -zv postgres-fqdn 5432

# Verify pgvector extension
kubectl exec -it deployment/vibecode-app -n vibecode -- psql $DATABASE_URL -c "\dx"
```

**2. Azure AI Services Authentication**
```bash
# Check workload identity
kubectl describe serviceaccount vibecode-sa -n vibecode

# Test AI service connectivity
kubectl exec -it deployment/vibecode-app -n vibecode -- \
  curl -H "Authorization: Bearer $(cat /var/run/secrets/azure/tokens/azure-identity-token)" \
       "https://management.azure.com/.default"
```

**3. Datadog Agent Issues**
```bash
# Check agent status
kubectl get pods -n datadog
kubectl logs -f daemonset/datadog-agent -n datadog

# Verify database monitoring
kubectl exec -it deployment/vibecode-app -n vibecode -- \
  psql $DATABASE_URL -c "SELECT * FROM pg_stat_statements LIMIT 5;"
```

### Useful Commands

```bash
# Get all infrastructure outputs (Terraform)
terraform output

# Get all infrastructure outputs (OpenTofu)
tofu output

# Scale AKS nodes
az aks scale --resource-group vibecode-prod-rg \
             --name vibecode-prod-aks \
             --node-count 5 \
             --nodepool-name user

# Connect to PostgreSQL
az postgres flexible-server connect \
   --name vibecode-prod-postgresql \
   --admin-user vibecodeusr \
   --database-name vibecode_prod

# View Datadog metrics
kubectl port-forward -n datadog svc/datadog-agent 8126:8126
# Access metrics at http://localhost:8126/info
```

## 🔄 Updates and Maintenance

### Infrastructure Updates
```bash
# Terraform users:
terraform plan && terraform apply

# OpenTofu users:
tofu plan && tofu apply

# Update single component (Terraform/OpenTofu):
terraform apply -target=azurerm_kubernetes_cluster.main
# or
tofu apply -target=azurerm_kubernetes_cluster.main
```

### Application Updates
```bash
# Build new image
docker build -t $(terraform output -raw acr_login_server)/vibecode:v2.0.0 .
docker push $(terraform output -raw acr_login_server)/vibecode:v2.0.0

# Update deployment
kubectl set image deployment/vibecode-app \
  vibecode=$(terraform output -raw acr_login_server)/vibecode:v2.0.0 \
  -n vibecode
```

### Backup and Recovery
```bash
# Manual PostgreSQL backup
az postgres flexible-server backup create \
   --resource-group vibecode-prod-rg \
   --name vibecode-prod-postgresql \
   --backup-name manual-backup-$(date +%Y%m%d)

# Restore from backup
az postgres flexible-server restore \
   --resource-group vibecode-prod-rg \
   --name vibecode-prod-postgresql-restored \
   --source-server vibecode-prod-postgresql \
   --restore-time "2024-01-01T00:00:00Z"
```

## 📚 Additional Resources

- [Azure AI Services Documentation](https://docs.microsoft.com/en-us/azure/cognitive-services/)
- [Azure PostgreSQL pgvector Guide](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/how-to-use-pgvector)
- [AKS Best Practices](https://docs.microsoft.com/en-us/azure/aks/best-practices)
- [Datadog Azure Integration](https://docs.datadoghq.com/integrations/azure/)
- [Terraform Azure Provider](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs)

## 🆘 Support

For issues and questions:
1. Check the [troubleshooting section](#-troubleshooting) above
2. Review Azure service health status
3. Check Datadog monitoring for alerts
4. Open an issue in the VibeCode repository 