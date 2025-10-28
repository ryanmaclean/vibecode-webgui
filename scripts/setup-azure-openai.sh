#!/bin/bash

# This script helps set up Azure OpenAI service and deployment
# Prerequisites: Azure CLI must be installed and logged in

set -e

echo "🚀 Setting up Azure OpenAI Service"
echo "--------------------------------"

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo "❌ Azure CLI is not installed. Please install it first:"
    echo "   https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
    exit 1
fi

# Check if user is logged in to Azure
if ! az account show &> /dev/null; then
    echo "🔐 Please log in to your Azure account..."
    az login --use-device-code
fi

# Get subscription details
echo "\n🔍 Checking Azure subscription..."
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
SUBSCRIPTION_NAME=$(az account show --query name -o tsv)
echo "   Subscription: $SUBSCRIPTION_NAME ($SUBSCRIPTION_ID)"

# Get or create resource group
echo "\n🔧 Configuring resource group..."
read -p "   Enter resource group name [vibecode-openai-rg]: " RESOURCE_GROUP
RESOURCE_GROUP=${RESOURCE_GROUP:-vibecode-openai-rg}

if ! az group show --name "$RESOURCE_GROUP" &> /dev/null; then
    read -p "   Resource group '$RESOURCE_GROUP' doesn't exist. Create it? [Y/n] " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]] || [ -z "$REPLY" ]; then
        read -p "   Enter location (e.g., eastus, westus2) [eastus]: " LOCATION
        LOCATION=${LOCATION:-eastus}
        az group create --name "$RESOURCE_GROUP" --location "$LOCATION"
    else
        echo "❌ Resource group is required. Exiting."
        exit 1
    fi
fi

# Create Azure OpenAI service
echo "\n🤖 Creating Azure OpenAI service..."
read -p "   Enter a name for your OpenAI service [vibecode-openai]: " SERVICE_NAME
SERVICE_NAME=${SERVICE_NAME:-vibecode-openai}

# Check if service already exists
if az cognitiveservices account show --name "$SERVICE_NAME" --resource-group "$RESOURCE_GROUP" &> /dev/null; then
    echo "   ✅ Service '$SERVICE_NAME' already exists."
else
    echo "   Creating Azure OpenAI service '$SERVICE_NAME'..."
    az cognitiveservices account create \
        --name "$SERVICE_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --kind "OpenAI" \
        --sku "S0" \
        --location "$LOCATION" \
        --yes
    
    echo "   ✅ Azure OpenAI service created successfully!"
fi

# Get the endpoint and keys
echo "\n🔑 Getting service credentials..."
ENDPOINT=$(az cognitiveservices account show --name "$SERVICE_NAME" --resource-group "$RESOURCE_GROUP" --query "properties.endpoint" -o tsv)
API_KEY=$(az cognitiveservices account keys list --name "$SERVICE_NAME" --resource-group "$RESOURCE_GROUP" --query "key1" -o tsv)

# Create a deployment for text-embedding-ada-002
echo "\n🔧 Creating deployment for text-embedding-ada-002..."
az cognitiveservices account deployment create \
    --name "$SERVICE_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --deployment-name "text-embedding-ada-002" \
    --model-name "text-embedding-ada-002" \
    --model-version "2" \
    --model-format "OpenAI" \
    --scale-settings-scale-type "Standard"

echo "\n🎉 Azure OpenAI setup complete!"
echo "--------------------------------"
echo "Service Name: $SERVICE_NAME"
echo "Endpoint: $ENDPOINT"
echo "API Key: $API_KEY"

# Create or update .env.local file
echo "\n📝 Updating .env.local file..."
cat > .env.local <<EOL
# Azure OpenAI Configuration - DO NOT COMMIT THIS FILE
AZURE_OPENAI_API_KEY=$API_KEY
AZURE_OPENAI_ENDPOINT=$ENDPOINT
AZURE_OPENAI_DEPLOYMENT_NAME=text-embedding-ada-002
AZURE_OPENAI_API_VERSION=2023-05-15
EOL

echo "✅ .env.local file has been created/updated with your Azure OpenAI credentials."
echo "   This file is in .gitignore and will not be committed to version control."
echo "\nYou can now run the test script with:"
echo "  npx tsx scripts/test-genai-embeddings.ts"
