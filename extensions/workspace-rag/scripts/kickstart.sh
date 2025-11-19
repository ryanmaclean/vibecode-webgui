#!/bin/bash
# Workspace RAG Extension - Kickstart Script
# This script sets up and verifies the extension is ready to use

set -e

echo "🚀 Workspace RAG Extension - Kickstart"
echo "========================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check Node.js
echo "📦 Checking Node.js..."
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found. Please install Node.js >= 18${NC}"
    exit 1
fi
NODE_VERSION=$(node --version)
echo -e "${GREEN}✅ Node.js: $NODE_VERSION${NC}"

# Check PostgreSQL
echo ""
echo "🐘 Checking PostgreSQL..."
if ! command -v psql &> /dev/null; then
    echo -e "${YELLOW}⚠️  PostgreSQL not found. Install with: brew install postgresql@15${NC}"
else
    echo -e "${GREEN}✅ PostgreSQL found${NC}"
    
    # Check if pgvector extension exists
    if psql -lqt 2>/dev/null | cut -d \| -f 1 | grep -qw workspace_rag; then
        echo -e "${GREEN}✅ Database 'workspace_rag' exists${NC}"
    else
        echo -e "${YELLOW}⚠️  Database 'workspace_rag' not found. Create with:${NC}"
        echo "   createdb workspace_rag"
        echo "   psql workspace_rag -c 'CREATE EXTENSION vector;'"
    fi
fi

# Install dependencies
echo ""
echo "📥 Installing dependencies..."
if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
    npm install
    echo -e "${GREEN}✅ Dependencies installed${NC}"
else
    echo -e "${GREEN}✅ Dependencies already installed${NC}"
fi

# Build extension
echo ""
echo "🔨 Building extension..."
npm run build
if [ -f "dist/extension.js" ]; then
    SIZE=$(ls -lh dist/extension.js | awk '{print $5}')
    echo -e "${GREEN}✅ Build successful (${SIZE})${NC}"
else
    echo -e "${RED}❌ Build failed - dist/extension.js not found${NC}"
    exit 1
fi

# Type check
echo ""
echo "🔍 Type checking..."
if npm run compile 2>&1 | grep -q "error"; then
    echo -e "${YELLOW}⚠️  TypeScript errors found (check output above)${NC}"
else
    echo -e "${GREEN}✅ Type check passed${NC}"
fi

# Summary
echo ""
echo "========================================"
echo -e "${GREEN}✅ Kickstart Complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Press F5 in VS Code to launch Extension Development Host"
echo "2. Configure database settings in VS Code Settings"
echo "3. Set OpenAI API key: Cmd+Shift+P > 'Set OpenAI API Key'"
echo "4. Index workspace: Cmd+Shift+P > 'Index Workspace'"
echo "5. Open 'Workspace RAG Chat' panel in Explorer"
echo ""
echo "See QUICKSTART.md for detailed instructions"
