#!/bin/bash
# Setup All Native Homebrew Services
# VibeCode Native Homebrew Setup
# Last Updated: 2025-10-28

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}======================================================================${NC}"
echo -e "${BLUE}VibeCode Native Homebrew Setup - All Services${NC}"
echo -e "${BLUE}======================================================================${NC}"
echo ""

# Check if Homebrew is installed
if ! command -v brew &> /dev/null; then
    echo -e "${RED}✗ Homebrew is not installed${NC}"
    echo "Install Homebrew from: https://brew.sh"
    exit 1
fi

echo -e "${GREEN}✓ Homebrew installed${NC}"
echo ""

# Install Redis (Valkey-compatible)
echo -e "${YELLOW}Step 1/3: Installing Redis...${NC}"
if brew list redis &> /dev/null; then
    echo -e "${GREEN}✓ Redis already installed${NC}"
else
    brew install redis
    echo -e "${GREEN}✓ Redis installed${NC}"
fi

# Install PostgreSQL 16
echo -e "${YELLOW}Step 2/3: Installing PostgreSQL 16...${NC}"
if brew list postgresql@16 &> /dev/null; then
    echo -e "${GREEN}✓ PostgreSQL 16 already installed${NC}"
else
    brew install postgresql@16
    echo -e "${GREEN}✓ PostgreSQL 16 installed${NC}"
fi

# Install pgvector extension
echo -e "${YELLOW}Step 3/3: Installing pgvector extension...${NC}"
export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"

if psql -d postgres -c "SELECT * FROM pg_available_extensions WHERE name = 'vector';" 2>/dev/null | grep -q "vector"; then
    echo -e "${GREEN}✓ pgvector already installed${NC}"
else
    echo "Cloning and building pgvector..."
    cd /tmp
    rm -rf pgvector
    git clone --depth 1 https://github.com/pgvector/pgvector.git
    cd pgvector
    make
    make install PG_CONFIG=/opt/homebrew/opt/postgresql@16/bin/pg_config
    cd ~
    echo -e "${GREEN}✓ pgvector installed${NC}"
fi

echo ""
echo -e "${GREEN}======================================================================${NC}"
echo -e "${GREEN}All services installed successfully!${NC}"
echo -e "${GREEN}======================================================================${NC}"
echo ""
echo "Next steps:"
echo "  1. Run: ./scripts/homebrew/start-all.sh"
echo "  2. Run: ./scripts/homebrew/initialize-databases.sh"
echo "  3. Run benchmarks: ~/vibecode-benchmarks/scripts/run-all-benchmarks.sh"
echo ""
