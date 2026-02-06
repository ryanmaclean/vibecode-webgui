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

echo -e "${GREEN}🚀 Setting up test environment for GenAI demo...${NC}"

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

# Get Azure subscription details
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
TENANT_ID=$(az account show --query tenantId -o tsv)

if [ -z "$SUBSCRIPTION_ID" ] || [ -z "$TENANT_ID" ]; then
    echo -e "${RED}❌ Failed to get Azure subscription details. Please check your Azure login.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Using Azure subscription: $(az account show --query name -o tsv) (${SUBSCRIPTION_ID})${NC}"

# Set environment variables for Azure
export AZURE_SUBSCRIPTION_ID=$SUBSCRIPTION_ID
export AZURE_TENANT_ID=$TENANT_ID

# 1. Start required services
echo -e "\n${GREEN}1. Starting Docker services...${NC}"
docker-compose up -d db datadog-agent

# 2. Wait for PostgreSQL to be ready
echo -e "\n${GREEN}2. Waiting for PostgreSQL to be ready...${NC}
MAX_RETRIES=30
COUNTER=0

until docker-compose exec -T db pg_isready -U vibecode || [ $COUNTER -eq $MAX_RETRIES ]; do
  echo -n "."
  sleep 2
  COUNTER=$((COUNTER+1))
done

if [ $COUNTER -eq $MAX_RETRIES ]; then
    echo -e "\n${RED}❌ Timed out waiting for PostgreSQL to be ready${NC}"
    exit 1
fi

echo -e "\n${GREEN}✅ PostgreSQL is ready!${NC}"

# 3. Install dependencies
echo -e "\n${GREEN}3. Installing dependencies...${NC}
if [ ! -d "node_modules" ]; then
    npm install --legacy-peer-deps
else
    echo -e "${YELLOW}⚠️  node_modules directory already exists. Skipping npm install.${NC}"
fi

# 4. Run database migrations
echo -e "\n${GREEN}4. Running database migrations...${NC}
if ! npx prisma migrate status | grep -q 'Database schema is up to date'; then
    npx prisma migrate deploy
else
    echo -e "${YELLOW}⚠️  Database schema is already up to date.${NC}"
fi

# 5. Install tsx if not already installed
echo -e "\n${GREEN}5. Setting up test environment...${NC}
npm install -g tsx

# 6. Set up test data
echo -e "\n${GREEN}6. Setting up test data...${NC}
npx tsx scripts/setup-demo-db.ts

# 7. Set up Azure environment variables
echo -e "\n${GREEN}7. Setting up Azure environment...${NC}
# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    cp .env.example .env
    echo -e "${GREEN}✅ Created .env file from .env.example${NC}
else
    echo -e "${YELLOW}⚠️  .env file already exists. Skipping creation.${NC}"
fi

# Update .env with Azure credentials
if [ -n "$AZURE_OPENAI_ENDPOINT" ] && [ -n "$AZURE_OPENAI_API_KEY" ]; then
    echo -e "\n${GREEN}✅ Using Azure OpenAI credentials from environment variables${NC}
    # Update .env with Azure OpenAI credentials
    sed -i '' -e "s|AZURE_OPENAI_ENDPOINT=.*|AZURE_OPENAI_ENDPOINT=$AZURE_OPENAI_ENDPOINT|" .env
    sed -i '' -e "s|AZURE_OPENAI_API_KEY=.*|AZURE_OPENAI_API_KEY=$AZURE_OPENAI_API_KEY|" .env
else
    echo -e "\n${YELLOW}⚠️  Azure OpenAI credentials not found in environment variables.${NC}"
    echo -e "${YELLOW}   Please set AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY in your environment.${NC}"
fi

# 8. Run tests
echo -e "\n${GREEN}8. Running tests...${NC}
npm test tests/genai-workflow.test.ts

echo -e "\n${GREEN}✅ Test environment setup complete!${NC}"
echo -e "\nTo start the demo application, run: ${GREEN}npm run dev${NC}"
echo -e "To run the demo script: ${GREEN}cd demo && npx ts-node genai-workflow.ts${NC}"
