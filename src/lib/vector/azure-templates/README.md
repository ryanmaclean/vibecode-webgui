# Azure Vector Database Templates

This directory contains Azure Resource Manager (ARM) templates for deploying the vector database infrastructure to Microsoft Azure.

## Available Templates

- `vector-databases.json`: A comprehensive template for deploying all necessary vector database infrastructure.

## Vector Databases Template

The `vector-databases.json` template can deploy:

1. **Azure Cosmos DB**: For vector storage and similarity search
2. **SQL Server**: For vector storage with SQL Server vector functions
3. **Azure Cache for Redis**: For vector caching and/or Redis vector search
4. **Azure OpenAI Service**: For generating embeddings

### Deployment Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `location` | Azure region for deployment | Resource group location |
| `projectName` | Base name for all resources | *Required* |
| `environment` | Environment (dev, test, prod) | dev |
| `deployCosmosDB` | Whether to deploy Cosmos DB | true |
| `deploySQLServer` | Whether to deploy SQL Server | false |
| `deployRedisCache` | Whether to deploy Azure Cache for Redis | true |
| `deployOpenAI` | Whether to deploy Azure OpenAI Service | true |
| `cosmosDBThroughput` | Cosmos DB throughput | 400 |
| `redisCacheSKU` | Redis cache SKU | Basic |
| `redisCacheFamily` | Redis cache family | C |
| `redisCacheCapacity` | Redis cache capacity | 1 |
| `sqlServerAdminLogin` | SQL Server admin username | *Required if deploying SQL Server* |
| `sqlServerAdminPassword` | SQL Server admin password | *Required if deploying SQL Server* |
| `openAISkuName` | Azure OpenAI SKU | S0 |
| `openAIDeploymentCapacity` | Azure OpenAI capacity (TPM) | 1 |
| `openAIEmbeddingModel` | Embedding model to deploy | text-embedding-ada-002 |

### Deployment Instructions

#### Using Azure Portal

1. Navigate to the [Azure Portal](https://portal.azure.com)
2. Go to **Create a resource > Template deployment (deploy using custom templates)**
3. Click **Build your own template in the editor**
4. Click **Load file** and select the `vector-databases.json` template
5. Click **Save**
6. Fill in the parameters form
7. Agree to terms and click **Purchase**

#### Using Azure CLI

```bash
# Login to Azure
az login

# Create a resource group if needed
az group create --name myResourceGroup --location eastus

# Deploy the template
az deployment group create \
  --resource-group myResourceGroup \
  --template-file vector-databases.json \
  --parameters projectName=vibecode environment=dev \
               deployCosmosDB=true deployRedisCache=true \
               deployOpenAI=true deploySQLServer=false
```

#### Using PowerShell

```powershell
# Login to Azure
Connect-AzAccount

# Create a resource group if needed
New-AzResourceGroup -Name myResourceGroup -Location eastus

# Deploy the template
New-AzResourceGroupDeployment `
  -ResourceGroupName myResourceGroup `
  -TemplateFile vector-databases.json `
  -projectName vibecode `
  -environment dev `
  -deployCosmosDB $true `
  -deployRedisCache $true `
  -deployOpenAI $true `
  -deploySQLServer $false
```

### Outputs

The template provides the following outputs:

- `cosmosDBEndpoint`: Cosmos DB account endpoint
- `sqlServerFqdn`: SQL Server fully qualified domain name
- `redisCacheHostName`: Redis cache hostname
- `openAIEndpoint`: Azure OpenAI endpoint

## Configuration for Vector Adapter

After deployment, use the following environment variables to configure the vector adapter:

```env
# Cosmos DB Configuration
COSMOS_ENDPOINT=<cosmosDBEndpoint output>
COSMOS_KEY=<primary key from Azure Portal>
COSMOS_DATABASE=vectordb
COSMOS_CONTAINER=vectors

# SQL Server Configuration
SQLSERVER_SERVER=<sqlServerFqdn output>
SQLSERVER_USER=<sqlServerAdminLogin parameter>
SQLSERVER_PASSWORD=<sqlServerAdminPassword parameter>
SQLSERVER_DATABASE=vectordb

# Redis Configuration
REDIS_HOST=<redisCacheHostName output>
REDIS_PORT=6380
REDIS_PASSWORD=<primary key from Azure Portal>
REDIS_SSL=true

# Azure OpenAI Configuration
AZURE_OPENAI_ENDPOINT=<openAIEndpoint output>
AZURE_OPENAI_API_KEY=<key from Azure Portal>
AZURE_OPENAI_DEPLOYMENT=embedding
```

## Security Considerations

1. **SQL Server**: Configure Azure Private Link for production deployments
2. **Cosmos DB**: Use Azure Managed Identity for authentication in production
3. **Redis Cache**: Enable non-TLS port only in development environments
4. **Azure OpenAI**: Consider IP restrictions or private endpoints for production

## Cost Optimization

1. **Cosmos DB**: Use serverless for development to minimize costs
2. **SQL Server**: Consider Azure SQL Elastic Pool for multi-database scenarios
3. **Redis Cache**: Start with Basic tier and upgrade as needed based on monitoring
4. **Azure OpenAI**: Share embeddings deployment across multiple applications