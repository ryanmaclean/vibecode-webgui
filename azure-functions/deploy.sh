#!/bin/bash
set -e

# Azure Functions deployment script for VibeCode Doc Search
# This script deploys the cost-optimized serverless doc search system

echo "🚀 Deploying VibeCode Doc Search to Azure Functions..."

# Configuration
RESOURCE_GROUP="vibecode-docs-rg"
LOCATION="eastus2"
FUNCTION_APP_NAME="vibecode-docs-search"
STORAGE_ACCOUNT="vibecodedocsstorage"
PLAN_NAME="vibecode-docs-plan"

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo "❌ Azure CLI is not installed. Please install it first."
    exit 1
fi

# Check if logged in
if ! az account show &> /dev/null; then
    echo "❌ Not logged in to Azure. Please run 'az login' first."
    exit 1
fi

echo "✅ Azure CLI authenticated"

# Create resource group
echo "📦 Creating resource group..."
az group create \
    --name $RESOURCE_GROUP \
    --location $LOCATION \
    --tags "Project=VibeCode" "Environment=Production" "CostOptimized=true"

# Create storage account for functions
echo "💾 Creating storage account..."
az storage account create \
    --name $STORAGE_ACCOUNT \
    --location $LOCATION \
    --resource-group $RESOURCE_GROUP \
    --sku Standard_LRS \
    --kind StorageV2

# Create consumption plan (most cost-effective)
echo "⚡ Creating consumption plan..."
az functionapp plan create \
    --name $PLAN_NAME \
    --resource-group $RESOURCE_GROUP \
    --location $LOCATION \
    --consumption-plan-location $LOCATION \
    --sku Y1

# Create function app
echo "🔧 Creating function app..."
az functionapp create \
    --name $FUNCTION_APP_NAME \
    --storage-account $STORAGE_ACCOUNT \
    --consumption-plan-location $LOCATION \
    --resource-group $RESOURCE_GROUP \
    --plan $PLAN_NAME \
    --runtime node \
    --runtime-version 18 \
    --functions-version 4 \
    --tags "CostOptimized=true" "Template=Vercel-Alternative"

# Configure application settings
echo "⚙️ Configuring application settings..."
az functionapp config appsettings set \
    --name $FUNCTION_APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --settings \
        "WEBSITE_NODE_DEFAULT_VERSION=18" \
        "FUNCTIONS_EXTENSION_VERSION=~4" \
        "WEBSITE_RUN_FROM_PACKAGE=1"

# Configure for Datadog monitoring (skip Application Insights for cost savings)
echo "📊 Configuring for Datadog monitoring..."
az functionapp config appsettings set \
    --name $FUNCTION_APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --settings \
        "DD_SITE=datadoghq.com" \
        "DD_SERVICE=vibecode-docs-search" \
        "DD_ENV=production" \
        "DD_VERSION=1.0.0" \
        "DD_LOGS_ENABLED=true" \
        "DD_TRACE_ENABLED=true" \
        "DD_SERVERLESS_LOGS_ENABLED=true"

echo "✅ Azure Functions infrastructure created successfully!"

# Build and deploy functions
echo "🔨 Building functions..."
npm install
npm run build

echo "🚀 Deploying functions..."
func azure functionapp publish $FUNCTION_APP_NAME --typescript

# Get function URLs
echo "🔗 Getting function URLs..."
SEARCH_URL=$(az functionapp function show \
    --name $FUNCTION_APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --function-name SearchFunction \
    --query invokeUrlTemplate -o tsv)

echo ""
echo "🎉 Deployment completed successfully!"
echo ""
echo "📋 Deployment Summary:"
echo "├── Resource Group: $RESOURCE_GROUP"
echo "├── Function App: $FUNCTION_APP_NAME"
echo "├── Plan: Consumption (Pay-per-execution)"
echo "├── Runtime: Node.js 18"
echo "└── Location: $LOCATION"
echo ""
echo "🔗 Function Endpoints:"
echo "├── Search API: $SEARCH_URL"
echo "└── Embedding Generator: Timer-triggered (runs daily at 2 AM)"
echo ""
echo "💰 Estimated Monthly Cost: $30-80 (even cheaper without App Insights!)"
echo "   ├── Functions: $0-2 (1M free executions)"
echo "   ├── Storage: $1-2"
echo "   ├── Datadog: $0 (using existing free account)"
echo "   └── PostgreSQL: $25-35 (separate)"
echo ""
echo "⚙️ Next Steps:"
echo "1. Set up PostgreSQL Flexible Server with pgvector"
echo "2. Configure environment variables:"
echo "   - DATABASE_URL"
echo "   - AZURE_OPENAI_API_KEY"
echo "   - AZURE_OPENAI_ENDPOINT"
echo "   - EMBEDDINGS_DEPLOYMENT_NAME"
echo "   - DD_API_KEY (your Datadog API key)"
echo "3. Run initial embedding generation"
echo "4. Test search functionality"
echo "5. View logs and metrics in your existing Datadog dashboard"
echo ""
echo "🔧 Configuration Commands:"
echo "az functionapp config appsettings set \\"
echo "    --name $FUNCTION_APP_NAME \\"
echo "    --resource-group $RESOURCE_GROUP \\"
echo "    --settings \\"
echo "        'DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require' \\"
echo "        'AZURE_OPENAI_API_KEY=your-key' \\"
echo "        'AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com' \\"
echo "        'EMBEDDINGS_DEPLOYMENT_NAME=text-embedding-ada-002' \\"
echo "        'DD_API_KEY=your-datadog-api-key'"
