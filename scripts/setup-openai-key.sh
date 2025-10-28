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

# Prompt for OpenAI API key
echo -e "\n${GREEN}🔑 Please enter your OpenAI API key:${NC}"
read -s OPENAI_API_KEY

# Update .env file
if grep -q "^OPENAI_API_KEY=" .env; then
    # Update existing key
    sed -i '' "s|^OPENAI_API_KEY=.*|OPENAI_API_KEY=$OPENAI_API_KEY|" .env
    echo -e "${GREEN}✅ Updated OPENAI_API_KEY in .env${NC}"
else
    # Add new key
    echo "OPENAI_API_KEY=$OPENAI_API_KEY" >> .env
    echo -e "${GREEN}✅ Added OPENAI_API_KEY to .env${NC}"
fi

echo -e "\n${GREEN}🎉 OpenAI API key has been set up successfully!${NC}"
