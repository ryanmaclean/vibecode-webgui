#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

# Check Status of All Native Homebrew Services
# VibeCode Native Homebrew Management
# Last Updated: 2025-10-28

# Initialize log aggregation
init_log_aggregation


RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}======================================================================${NC}"
echo -e "${BLUE}Native Homebrew Services Status${NC}"
echo -e "${BLUE}======================================================================${NC}"
echo ""

# Check Redis
echo -e "${YELLOW}Redis Status:${NC}"
if pgrep -x "redis-server" > /dev/null; then
    echo -e "  ${GREEN}✓ Running${NC}"
    redis-cli -a VibeCodeChangeInProduction2025 INFO server 2>&1 | grep -E "redis_version|uptime_in_seconds" | sed 's/^/    /'
    echo "    Port: 6379"
    echo "    Password: VibeCodeChangeInProduction2025"
else
    echo -e "  ${RED}✗ Not running${NC}"
fi
echo ""

# Check PostgreSQL
export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"
echo -e "${YELLOW}PostgreSQL 16 Status:${NC}"
if brew services list | grep postgresql@16 | grep -q "started"; then
    echo -e "  ${GREEN}✓ Running${NC}"
    psql -d postgres -t -c "SELECT version();" 2>&1 | head -1 | sed 's/^/    /'
    echo "    Port: 5432"
    echo "    User: vibecode"
    echo "    Database: vibecode"
else
    echo -e "  ${RED}✗ Not running${NC}"
fi
echo ""

# Check Node.js
echo -e "${YELLOW}Node.js:${NC}"
echo "    Version: $(node --version)"
echo "    npm: $(npm --version)"
echo "    Location: $(which node)"
echo ""

# Check ports
echo -e "${YELLOW}Port Status:${NC}"
for port in 6379 5432 3000 8080; do
    if lsof -nP -iTCP:$port | grep -q LISTEN; then
        echo -e "    Port $port: ${GREEN}✓ In use${NC}"
    else
        echo -e "    Port $port: ${BLUE}Available${NC}"
    fi
done
echo ""

echo -e "${BLUE}======================================================================${NC}"
