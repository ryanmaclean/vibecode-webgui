#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

set -e

# Colors for output

# Initialize log aggregation
init_log_aggregation

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Setting up Azure OpenAI resources...${NC}"

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo -e "${RED}❌ Azure CLI is not installed. Please install it from https://docs.microsoft.com/en-us/cli/azure/install-azure-cli${NC}"
    exit 1
fi

# Check Azure login status
if ! az account show &> /dev/null; then
    echo -e "${YELLOW}⚠️  Not logged into Azure. Attempting to log in...${NC}"
    if ! az login; then
        echo -e "${RED}❌ Azure login failed. Please log in using 'az login' and try again.${NC}"
        exit 1
    fi
fi

# Set variables
RESOURCE_GROUP="vibecode-genai-rg"
LOCATION="eastus"
AI_SERVICE_NAME="vibecode-ai-$(openssl rand -hex 4)"
DEPLOYMENT_NAME="text-embedding-ada-002"
MODEL_NAME="text-embedding-ada-002"
SKU="S0"

# Create resource group
echo -e "\n${GREEN}1. Creating resource group...${NC}"
az group create --name $RESOURCE_GROUP --location $LOCATION

# Create Cognitive Services account
echo -e "\n${GREEN}2. Creating Azure OpenAI service...${NC}
az cognitiveservices account create \
    --name $AI_SERVICE_NAME \
    --resource-group $RESOURCE_GROUP \
    --location $LOCATION \
    --kind OpenAI \
    --sku $SKU \
    --yes

# Wait for the service to be provisioned
echo -e "\n${GREEN}Waiting for Azure OpenAI service to be provisioned...${NC}
az cognitiveservices account wait --resource-group $RESOURCE_GROUP --name $AI_SERVICE_NAME --created

# Deploy the model
echo -e "\n${GREEN}3. Deploying model...${NC}
az cognitiveservices account deployment create \
    --name $AI_SERVICE_NAME \
    --resource-group $RESOURCE_GROUP \
    --deployment-name $DEPLOYMENT_NAME \
    --model-name $MODEL_NAME \
    --model-version "2" \
    --model-format "OpenAI" \
    --scale-settings-scale-type "Standard" \
    --capacity 1

# Get the keys and endpoint
echo -e "\n${GREEN}4. Retrieving credentials...${NC}
ENDPOINT=$(az cognitiveservices account show --name $AI_SERVICE_NAME --resource-group $RESOURCE_GROUP --query "properties.endpoint" -o tsv)
KEY=$(az cognitiveservices account keys list --name $AI_SERVICE_NAME --resource-group $RESOURCE_GROUP --query "key1" -o tsv)

# Update .env file
echo -e "\n${GREEN}5. Updating .env file...${NC}"
if [ ! -f .env ]; then
    cp .env.example .env
fi

sed -i '' -e "s|AZURE_OPENAI_ENDPOINT=.*|AZURE_OPENAI_ENDPOINT=$ENDPOINT|g" .env
sed -i '' -e "s|AZURE_OPENAI_API_KEY=.*|AZURE_OPENAI_API_KEY=$KEY|g" .env

# Output completion message
echo -e "\n${GREEN}✅ Azure OpenAI resources setup complete!${NC}"
echo -e "\n${YELLOW}⚠️  IMPORTANT: Save these credentials in a secure location:${NC}"
echo -e "Resource Group: ${GREEN}$RESOURCE_GROUP${NC}"
echo -e "Service Name:   ${GREEN}$AI_SERVICE_NAME${NC}"
echo -e "Endpoint:       ${GREEN}$ENDPOINT${NC}"
echo -e "API Key:        ${GREEN}$(echo $KEY | sed 's/./*/g')${NC}"
echo -e "\n${GREEN}The .env file has been updated with your Azure OpenAI credentials.${NC}"

# Set environment variables for current session
export AZURE_OPENAI_ENDPOINT=$ENDPOINT
export AZURE_OPENAI_API_KEY=$KEY

echo -e "\n${GREEN}You can now run the setup-test-env.sh script to continue with the test environment setup.${NC}"
