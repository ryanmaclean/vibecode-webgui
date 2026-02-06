#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

# Start All Native Homebrew Services
# VibeCode Native Homebrew Management
# Last Updated: 2025-10-28

# Initialize log aggregation
init_log_aggregation


set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}======================================================================${NC}"
echo -e "${BLUE}Starting All Native Homebrew Services${NC}"
echo -e "${BLUE}======================================================================${NC}"
echo ""

# Start Redis
echo -e "${YELLOW}Starting Redis...${NC}"
if pgrep -x "redis-server" > /dev/null; then
    echo -e "${GREEN}✓ Redis already running${NC}"
else
    redis-server ~/vibecode-benchmarks/redis-benchmark.conf --daemonize yes
    sleep 2
    if redis-cli -a VibeCodeChangeInProduction2025 PING 2>&1 | grep -q "PONG"; then
        echo -e "${GREEN}✓ Redis started successfully${NC}"
    else
        echo -e "${RED}✗ Failed to start Redis${NC}"
    fi
fi

# Start PostgreSQL 16
echo -e "${YELLOW}Starting PostgreSQL 16...${NC}"
export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"
if brew services list | grep postgresql@16 | grep -q "started"; then
    echo -e "${GREEN}✓ PostgreSQL 16 already running${NC}"
else
    brew services start postgresql@16
    sleep 3
    if psql -d postgres -c "SELECT 1;" &> /dev/null; then
        echo -e "${GREEN}✓ PostgreSQL 16 started successfully${NC}"
    else
        echo -e "${RED}✗ Failed to start PostgreSQL 16${NC}"
    fi
fi

echo ""
echo -e "${GREEN}======================================================================${NC}"
echo -e "${GREEN}All services started!${NC}"
echo -e "${GREEN}======================================================================${NC}"
echo ""
echo "Service Status:"
echo "  Redis: localhost:6379 (password: VibeCodeChangeInProduction2025)"
echo "  PostgreSQL: localhost:5432 (user: vibecode, password: vibecode_prod_2024)"
echo ""
echo "Test connections:"
echo "  Redis: redis-cli -a VibeCodeChangeInProduction2025 PING"
echo "  PostgreSQL: psql -h localhost -U vibecode -d vibecode -c 'SELECT version();'"
echo ""
