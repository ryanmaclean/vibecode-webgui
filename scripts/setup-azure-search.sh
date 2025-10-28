#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Check if .env exists, if not create from .env.example
if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        cp .env.example .env
        echo -e "${GREEN}Created .env file from .env.example${NC}"
    else
        touch .env
        echo -e "${GREEN}Created empty .env file${NC}"
    fi
fi

# Prompt for Azure Search endpoint
echo -e "\n${GREEN}🔍 Please enter your Azure Cognitive Search endpoint (e.g., https://your-search-service.search.windows.net):${NC}"
read AZURE_SEARCH_ENDPOINT

# Prompt for Azure Search API key
echo -e "\n${GREEN}🔑 Please enter your Azure Cognitive Search API key:${NC}"
read -s AZURE_SEARCH_KEY

# Update .env file
update_env_var() {
    local var_name=$1
    local var_value=$2
    
    if grep -q "^${var_name}=" .env; then
        # Update existing variable
        sed -i '' "s|^${var_name}=.*|${var_name}=${var_value//|/\\|}|" .env
        echo -e "${GREEN}✅ Updated ${var_name} in .env${NC}"
    else
        # Add new variable
        echo "${var_name}=${var_value}" >> .env
        echo -e "${GREEN}✅ Added ${var_name} to .env${NC}"
    fi
}

# Update environment variables
update_env_var "AZURE_SEARCH_ENDPOINT" "$AZURE_SEARCH_ENDPOINT"
update_env_var "AZURE_SEARCH_KEY" "$AZURE_SEARCH_KEY"

echo -e "\n${GREEN}🎉 Azure Cognitive Search configuration complete!${NC}"
