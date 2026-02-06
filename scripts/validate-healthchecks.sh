#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

#
# Healthcheck Validation Script
# Tests all Docker Compose service healthchecks
#

# Initialize log aggregation
init_log_aggregation


set -e

COMPOSE_FILE="${1:-docker/docker-compose.yml}"
TIMEOUT=120
CHECK_INTERVAL=5

echo "=================================="
echo "Docker Compose Healthcheck Validator"
echo "=================================="
echo "Compose file: $COMPOSE_FILE"
echo "Timeout: ${TIMEOUT}s"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Docker Compose is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗ Docker is not installed${NC}"
    exit 1
fi

if ! docker compose version &> /dev/null; then
    echo -e "${RED}✗ Docker Compose is not installed${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Docker Compose installed${NC}"

# Validate compose file syntax
echo -e "\n${YELLOW}Validating compose file syntax...${NC}"
if docker compose -f "$COMPOSE_FILE" config --quiet; then
    echo -e "${GREEN}✓ Compose file syntax valid${NC}"
else
    echo -e "${RED}✗ Compose file has syntax errors${NC}"
    exit 1
fi

# Extract service names
echo -e "\n${YELLOW}Extracting services...${NC}"
SERVICES=$(docker compose -f "$COMPOSE_FILE" config --services)
echo "Services found:"
echo "$SERVICES" | sed 's/^/  - /'

# Start services
echo -e "\n${YELLOW}Starting services...${NC}"
docker compose -f "$COMPOSE_FILE" up -d

# Wait for services to become healthy
echo -e "\n${YELLOW}Waiting for services to become healthy...${NC}"
ELAPSED=0
ALL_HEALTHY=false

while [ $ELAPSED -lt $TIMEOUT ]; do
    HEALTHY_COUNT=0
    TOTAL_COUNT=0

    for service in $SERVICES; do
        TOTAL_COUNT=$((TOTAL_COUNT + 1))
        STATUS=$(docker compose -f "$COMPOSE_FILE" ps "$service" --format json 2>/dev/null | jq -r '.[0].Health // "no-healthcheck"' 2>/dev/null || echo "unknown")

        case "$STATUS" in
            "healthy")
                HEALTHY_COUNT=$((HEALTHY_COUNT + 1))
                echo -e "  ${GREEN}✓${NC} $service: healthy"
                ;;
            "starting")
                echo -e "  ${YELLOW}⏳${NC} $service: starting..."
                ;;
            "unhealthy")
                echo -e "  ${RED}✗${NC} $service: unhealthy"
                ;;
            "no-healthcheck")
                echo -e "  ${YELLOW}⚠${NC} $service: no healthcheck configured"
                HEALTHY_COUNT=$((HEALTHY_COUNT + 1))  # Don't block on services without healthcheck
                ;;
            *)
                echo -e "  ${YELLOW}?${NC} $service: $STATUS"
                ;;
        esac
    done

    echo ""

    if [ $HEALTHY_COUNT -eq $TOTAL_COUNT ]; then
        ALL_HEALTHY=true
        break
    fi

    sleep $CHECK_INTERVAL
    ELAPSED=$((ELAPSED + CHECK_INTERVAL))
    echo -e "${YELLOW}Elapsed: ${ELAPSED}s / ${TIMEOUT}s${NC}\n"
done

echo "=================================="
if [ "$ALL_HEALTHY" = true ]; then
    echo -e "${GREEN}✓ All services are healthy!${NC}"
    echo ""

    # Test health endpoints
    echo -e "${YELLOW}Testing health endpoints...${NC}"

    # Test webgui healthz endpoint
    if curl -f -s http://localhost:3000/api/healthz > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} webgui /api/healthz responding"
    else
        echo -e "${YELLOW}⚠${NC} webgui /api/healthz not responding (may not be exposed)"
    fi

    # Test webgui health endpoint
    if curl -f -s http://localhost:3000/api/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} webgui /api/health responding"
    else
        echo -e "${YELLOW}⚠${NC} webgui /api/health not responding (may not be exposed)"
    fi

    # Show final status
    echo ""
    echo "Final service status:"
    docker compose -f "$COMPOSE_FILE" ps

    exit 0
else
    echo -e "${RED}✗ Timeout waiting for services to become healthy${NC}"
    echo ""
    echo "Service logs:"
    for service in $SERVICES; do
        echo -e "\n${YELLOW}=== $service logs ===${NC}"
        docker compose -f "$COMPOSE_FILE" logs --tail 20 "$service"
    done

    exit 1
fi
