# VibeCode WebGUI - ARM Templates

Deploy VibeCode WebGUI enterprise platform to Azure using ARM templates with one-click deployment.

[![Deploy to Azure](https://aka.ms/deploytoazurebutton)](https://portal.azure.com/#create/Microsoft.Template/uri/https%3A%2F%2Fraw.githubusercontent.com%2Fvibecode%2Fvibecode-webgui%2Fmain%2Finfrastructure%2Farm%2Fazuredeploy.json)
[![Deploy to Azure US Gov](https://aka.ms/deploytoazuregovbutton)](https://portal.azure.us/#create/Microsoft.Template/uri/https%3A%2F%2Fraw.githubusercontent.com%2Fvibecode%2Fvibecode-webgui%2Fmain%2Finfrastructure%2Farm%2Fazuredeploy.json)
[![Visualize](https://raw.githubusercontent.com/Azure/azure-quickstart-templates/master/1-CONTRIBUTION-GUIDE/images/visualizebutton.svg?sanitize=true)](http://armviz.io/#/?load=https%3A%2F%2Fraw.githubusercontent.com%2Fvibecode%2Fvibecode-webgui%2Fmain%2Finfrastructure%2Farm%2Fazuredeploy.json)

## 🎯 What Gets Deployed

This ARM template creates a complete enterprise-ready VibeCode WebGUI platform including:

### Core Infrastructure
- **Azure Kubernetes Service (AKS)** cluster with auto-scaling
- **Azure Database for PostgreSQL Flexible Server** with pgvector extension
- **Azure Container Registry** for container images
- **Azure Key Vault** for secrets management
- **Virtual Network** with dedicated subnets
- **Log Analytics Workspace** for monitoring

### AI Services
- **Azure OpenAI Service** with GPT-4 Turbo, GPT-3.5 Turbo, and text-embedding-ada-002
- **Computer Vision Service** for image analysis
- **Language Service** for text analytics
- **Managed Identity** for secure service authentication

### Pre-configured Features
- **pgvector extension** enabled for vector similarity search
- **High Availability** PostgreSQL with geo-redundant backups
- **Auto-scaling** AKS node pools (1-10 nodes)
- **Container Registry** with security policies
- **Network security** with private subnets

## 🚀 Quick Deployment

### Option 1: One-Click Deployment

1. Click the **Deploy to Azure** button above
2. Fill in the required parameters:
   - **Resource Group**: Create new or use existing
   - **Project Name**: `vibecode` (or your preferred name)
   - **Environment**: `prod`, `staging`, or `dev`
   - **Administrator Password**: Strong password for PostgreSQL
   - **Datadog API Key**: Your Datadog API key for monitoring
   - **Datadog App Key**: Your Datadog application key
3. Review and create (takes 15-20 minutes)

### Option 2: Azure CLI

```bash
# Create resource group
az group create --name vibecode-prod-rg --location "East US 2"

# Deploy template
az deployment group create \
  --resource-group vibecode-prod-rg \
  --template-file azuredeploy.json \
  --parameters azuredeploy.parameters.json \
  --parameters administratorPassword="YourStrongPassword123!" \
  --parameters datadogApiKey="your-datadog-api-key" \
  --parameters datadogAppKey="your-datadog-app-key"
```

### Option 3: Azure PowerShell

```powershell
# Create resource group
New-AzResourceGroup -Name "vibecode-prod-rg" -Location "East US 2"

# Deploy template
New-AzResourceGroupDeployment `
  -ResourceGroupName "vibecode-prod-rg" `
  -TemplateFile "azuredeploy.json" `
  -TemplateParameterFile "azuredeploy.parameters.json" `
  -administratorPassword (ConvertTo-SecureString "YourStrongPassword123!" -AsPlainText -Force) `
  -datadogApiKey (ConvertTo-SecureString "your-datadog-api-key" -AsPlainText -Force) `
  -datadogAppKey (ConvertTo-SecureString "your-datadog-app-key" -AsPlainText -Force)
```

## 📋 Parameters

### Required Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `administratorPassword` | PostgreSQL admin password (min 8 chars) | `StrongPass123!` |
| `datadogApiKey` | Datadog API key for monitoring | `abc123...` |
| `datadogAppKey` | Datadog application key | `def456...` |

### Optional Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `projectName` | `vibecode` | Project name for resource naming |
| `environment` | `prod` | Environment (dev/staging/prod) |
| `location` | Resource group location | Azure region |
| `administratorLogin` | `vibecodeusr` | PostgreSQL admin username |
| `aksKubernetesVersion` | `1.28` | Kubernetes version |
| `aksSystemNodeCount` | `2` | System node pool size |
| `aksUserNodeCount` | `3` | User node pool initial size |
| `postgresqlSkuName` | `GP_Standard_D4s_v3` | PostgreSQL SKU |
| `postgresqlStorageGB` | `64` | PostgreSQL storage size |
| `enableHighAvailability` | `true` | Enable PostgreSQL HA |

## 🏗️ Architecture

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
│  │ • User Nodes    │    │ • Geo-redundant Backups      │   │
│  │ • Auto-scaling  │    │ • Private Networking         │   │
│  └─────────────────┘    └──────────────────────────────┘   │
│           │                                                 │
│           ▼                                                 │
│  ┌─────────────────┐    ┌──────────────────────────────┐   │
│  │   Azure AI      │    │      Key Vault              │   │
│  │   Services      │    │                              │   │
│  │                 │    │ • API Keys Storage           │   │
│  │ • OpenAI GPT-4  │    │ • Managed Identity Access    │   │
│  │ • Computer Vision│    │ • Automatic Rotation         │   │
│  │ • Language Svc  │    │ • RBAC Integration           │   │
│  └─────────────────┘    └──────────────────────────────┘   │
│                                                             │
│  ┌─────────────────┐    ┌──────────────────────────────┐   │
│  │   Container     │    │      Log Analytics           │   │
│  │   Registry      │    │      Workspace               │   │
│  │                 │    │                              │   │
│  │ • Premium SKU   │    │ • AKS Integration            │   │
│  │ • Managed ID    │    │ • Datadog Integration        │   │
│  │ • Security Scan │    │ • Custom Metrics             │   │
│  └─────────────────┘    └──────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## 🔐 Security Features

### Network Security
- **Private VNet** with dedicated subnets
- **Network Security Groups** with minimal access
- **Private DNS zones** for secure service communication
- **Azure CNI** networking with Calico network policies

### Identity & Access Management
- **Managed Identity** for all service-to-service auth
- **Azure RBAC** integration
- **Key Vault** with RBAC authorization
- **Workload Identity** for Kubernetes pods

### Data Protection
- **Encryption at rest** for all data stores
- **TLS encryption** for data in transit
- **Private networking** for database access
- **Geo-redundant backups** for disaster recovery

## 📊 Cost Estimation

**Monthly costs in East US 2 region:**

| Component | Configuration | Estimated Cost |
|-----------|---------------|----------------|
| **AKS Cluster** | 2 system + 3 user nodes (D4s_v3, D8s_v3) | ~$800/month |
| **PostgreSQL** | GP_Standard_D4s_v3, 64GB, HA enabled | ~$350/month |
| **Azure OpenAI** | GPT-4 + GPT-3.5 + embeddings | ~$200/month* |
| **AI Services** | Computer Vision + Language (S tier) | ~$100/month* |
| **Container Registry** | Premium tier | ~$20/month |
| **Other Services** | Key Vault, Log Analytics, networking | ~$100/month |
| **Total** | | **~$1,570/month** |

*AI service costs depend on usage volume*

### Cost Optimization
- **Auto-scaling** reduces costs during low usage
- **Spot instances** available for non-critical workloads
- **Reserved instances** recommended for predictable workloads
- **Budget alerts** can be configured post-deployment

## 🚀 Post-Deployment Steps

### 1. Configure kubectl Access

```bash
# Get AKS credentials
az aks get-credentials --resource-group <resource-group-name> --name <aks-cluster-name>

# Verify connection
kubectl get nodes
```

### 2. Deploy VibeCode Application

```bash
# Clone the repository
git clone https://github.com/vibecode/vibecode-webgui.git
cd vibecode-webgui

# Build and push to ACR
az acr login --name <container-registry-name>
docker build -t <container-registry-name>.azurecr.io/vibecode:latest .
docker push <container-registry-name>.azurecr.io/vibecode:latest

# Deploy to AKS
kubectl apply -f k8s/vibecode-deployment.yaml
```

### 3. Configure Datadog Monitoring

```bash
# Add Datadog Helm repository
helm repo add datadog https://helm.datadoghq.com
helm repo update

# Install Datadog agent
helm install datadog datadog/datadog \
  --set datadog.apiKey=<your-datadog-api-key> \
  --set datadog.appKey=<your-datadog-app-key> \
  --set clusterAgent.enabled=true \
  --set clusterAgent.metricsProvider.enabled=true
```

### 4. Enable PostgreSQL pgvector

The pgvector extension is automatically configured, but you may need to create it in your database:

```sql
-- Connect to your database
\c vibecode_prod

-- Create pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify extension
\dx
```

## 🔍 Monitoring and Troubleshooting

### View Deployment Status

```bash
# Check deployment status
az deployment group show --resource-group <resource-group-name> --name <deployment-name>

# List all resources
az resource list --resource-group <resource-group-name> --output table
```

### Common Issues

**1. Deployment Timeouts**
- AKS cluster creation can take 10-15 minutes
- PostgreSQL with HA can take 15-20 minutes
- Check Azure Activity Log for detailed error messages

**2. Parameter Validation Errors**
- Ensure password meets complexity requirements (8+ chars, mixed case, numbers, symbols)
- Verify Datadog keys are valid and have proper permissions
- Check that chosen location supports all required services

**3. Resource Conflicts**
- Resource names must be globally unique (automatically handled with uniqueString)
- Check for existing resources with conflicting names
- Verify subscription limits for VM cores and other resources

### Getting Support

1. **Check deployment logs** in Azure Portal Activity Log
2. **Review resource health** in Azure Portal
3. **Monitor deployment** with `az deployment group show`
4. **Open issues** in the [VibeCode repository](https://github.com/vibecode/vibecode-webgui/issues)

## 📚 Additional Resources

- [Azure ARM Template Documentation](https://docs.microsoft.com/en-us/azure/azure-resource-manager/templates/)
- [Azure Kubernetes Service Documentation](https://docs.microsoft.com/en-us/azure/aks/)
- [Azure Database for PostgreSQL Documentation](https://docs.microsoft.com/en-us/azure/postgresql/)
- [Azure AI Services Documentation](https://docs.microsoft.com/en-us/azure/cognitive-services/)
- [VibeCode WebGUI Documentation](../../README.md)

## 🎉 Next Steps

After successful deployment:

1. **Access your AKS cluster** and deploy the VibeCode application
2. **Configure AI services** for your development workflows
3. **Set up monitoring dashboards** in Datadog
4. **Enable vector search** with pgvector for enhanced code assistance
5. **Customize the platform** for your specific development needs

Happy coding with VibeCode! 🚀 