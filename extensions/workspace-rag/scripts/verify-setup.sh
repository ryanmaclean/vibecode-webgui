#!/bin/bash
# Verification script - checks if everything is set up correctly

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🔍 Verifying Workspace RAG Extension Setup"
echo "==========================================="
echo ""

ERRORS=0

# Check build
if [ -f "dist/extension.js" ]; then
    echo -e "${GREEN}✅ Extension built${NC}"
else
    echo -e "${RED}❌ Extension not built. Run: npm run build${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Check dependencies
if [ -d "node_modules" ] && [ -f "node_modules/pg/package.json" ]; then
    echo -e "${GREEN}✅ Dependencies installed${NC}"
else
    echo -e "${RED}❌ Dependencies missing. Run: npm install${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Check PostgreSQL connection (if psql available)
if command -v psql &> /dev/null; then
    if psql -h localhost -U postgres -d workspace_rag -c "SELECT 1;" &>/dev/null; then
        echo -e "${GREEN}✅ PostgreSQL connection works${NC}"
        
        # Check pgvector extension
        if psql -h localhost -U postgres -d workspace_rag -c "\dx vector" &>/dev/null | grep -q vector; then
            echo -e "${GREEN}✅ pgvector extension installed${NC}"
        else
            echo -e "${YELLOW}⚠️  pgvector extension not found. Run: CREATE EXTENSION vector;${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  Cannot connect to PostgreSQL. Check settings.${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  psql not found. Skipping database check.${NC}"
fi

# Check TypeScript compilation
if npm run compile 2>&1 | grep -q "error TS"; then
    echo -e "${RED}❌ TypeScript compilation errors${NC}"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✅ TypeScript compiles${NC}"
fi

echo ""
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ All checks passed! Ready to use.${NC}"
    exit 0
else
    echo -e "${RED}❌ Found $ERRORS issue(s). Please fix before using.${NC}"
    exit 1
fi
