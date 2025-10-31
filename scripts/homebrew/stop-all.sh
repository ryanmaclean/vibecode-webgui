#!/bin/bash
# Stop All Native Homebrew Services
# VibeCode Native Homebrew Management
# Last Updated: 2025-10-28

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}======================================================================${NC}"
echo -e "${BLUE}Stopping All Native Homebrew Services${NC}"
echo -e "${BLUE}======================================================================${NC}"
echo ""

# Stop Redis
echo -e "${YELLOW}Stopping Redis...${NC}"
if pgrep -x "redis-server" > /dev/null; then
    redis-cli -a VibeCodeChangeInProduction2025 shutdown 2>&1 | grep -v "Warning" || true
    sleep 1
    if ! pgrep -x "redis-server" > /dev/null; then
        echo -e "${GREEN}✓ Redis stopped${NC}"
    else
        echo -e "${RED}✗ Failed to stop Redis gracefully, forcing...${NC}"
        pkill -9 redis-server || true
    fi
else
    echo -e "${GREEN}✓ Redis not running${NC}"
fi

# Stop PostgreSQL 16
echo -e "${YELLOW}Stopping PostgreSQL 16...${NC}"
export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"
if brew services list | grep postgresql@16 | grep -q "started"; then
    brew services stop postgresql@16
    sleep 2
    echo -e "${GREEN}✓ PostgreSQL 16 stopped${NC}"
else
    echo -e "${GREEN}✓ PostgreSQL 16 not running${NC}"
fi

echo ""
echo -e "${GREEN}======================================================================${NC}"
echo -e "${GREEN}All services stopped!${NC}"
echo -e "${GREEN}======================================================================${NC}"
echo ""
