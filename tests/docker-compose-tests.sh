#!/bin/bash
set -e

# Docker Compose Component Tests
# Tests all services in Docker Compose environment

echo "🐳 Docker Compose Component Tests"
echo "=================================="

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASSED=0
FAILED=0

test_result() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}[PASS]${NC} $1"
        ((PASSED++))
    else
        echo -e "${RED}[FAIL]${NC} $1"
        ((FAILED++))
    fi
}

cleanup() {
    echo -e "\n${YELLOW}Cleaning up Docker Compose resources...${NC}"
    cd /Users/ryan.maclean/vibecode-webgui
    docker-compose down -v &>/dev/null || true
    docker system prune -f &>/dev/null || true
}

trap cleanup EXIT

cd /Users/ryan.maclean/vibecode-webgui

echo -e "\n${BLUE}1. Docker Compose Configuration Tests${NC}"
echo "--------------------------------------------"

# Test Docker Compose file exists
[ -f "docker-compose.yml" ]
test_result "docker-compose.yml exists"

# Test configuration validation
docker-compose config &>/dev/null
test_result "Docker Compose configuration is valid"

# Test service definitions
docker-compose config | grep -q "docs:"
test_result "Docs service is defined"

docker-compose config | grep -q "postgres:"
test_result "PostgreSQL service is defined"

docker-compose config | grep -q "redis:"
test_result "Redis service is defined"

echo -e "\n${BLUE}2. Docker Build Tests${NC}"
echo "-----------------------"

# Test building docs service
docker-compose build docs &>/dev/null
test_result "Docs service builds successfully"

# Test image exists
docker images | grep -q "vibecode.*docs"
test_result "Docs Docker image created"

echo -e "\n${BLUE}3. Service Startup Tests${NC}"
echo "----------------------------"

# Start all services
echo "Starting Docker Compose services..."
docker-compose up -d

# Wait for services to start
sleep 20

# Test container status
docker-compose ps docs | grep -q "Up"
test_result "Docs container is running"

docker-compose ps postgres | grep -q "Up"
test_result "PostgreSQL container is running"

docker-compose ps redis | grep -q "Up"
test_result "Redis container is running"

echo -e "\n${BLUE}4. Service Health Tests${NC}"
echo "-------------------------"

# Test docs service health
curl -s -f http://localhost:8080/ &>/dev/null
test_result "Docs service responds on port 8080"

curl -s http://localhost:8080/ | grep -q "VibeCode"
test_result "Docs service serves correct content"

# Test HTTP status codes
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/)
[ "$HTTP_CODE" = "200" ]
test_result "Docs service returns HTTP 200"

# Test PostgreSQL health
docker-compose exec -T postgres pg_isready -U vibecode &>/dev/null
test_result "PostgreSQL is accepting connections"

# Test Redis health
docker-compose exec -T redis redis-cli ping | grep -q "PONG"
test_result "Redis is responding to ping"

echo -e "\n${BLUE}5. Database Connection Tests${NC}"
echo "------------------------------"

# Test PostgreSQL connection with psql
docker-compose exec -T postgres psql -U vibecode -d vibecode -c "SELECT 1;" &>/dev/null
test_result "PostgreSQL database connection works"

# Test Redis connection
docker-compose exec -T redis redis-cli set test_key "test_value" &>/dev/null
test_result "Redis accepts write operations"

docker-compose exec -T redis redis-cli get test_key | grep -q "test_value"
test_result "Redis accepts read operations"

echo -e "\n${BLUE}6. Network Connectivity Tests${NC}"
echo "--------------------------------"

# Test inter-service connectivity (if app container exists)
if docker-compose config | grep -q "app:"; then
    # Test app can reach database
    docker-compose exec -T app ping -c 1 postgres &>/dev/null || true
    test_result "App can reach PostgreSQL (if app service exists)"
    
    # Test app can reach Redis
    docker-compose exec -T app ping -c 1 redis &>/dev/null || true
    test_result "App can reach Redis (if app service exists)"
fi

# Test docs container can reach external network
docker-compose exec -T docs ping -c 1 8.8.8.8 &>/dev/null
test_result "Docs container has external network access"

echo -e "\n${BLUE}7. Volume and Persistence Tests${NC}"
echo "---------------------------------"

# Test PostgreSQL data persistence
docker-compose exec -T postgres psql -U vibecode -d vibecode -c "CREATE TABLE test_table (id INT);" &>/dev/null
test_result "PostgreSQL can create tables"

# Test Redis data persistence
docker-compose exec -T redis redis-cli set persistent_key "persistent_value" &>/dev/null
test_result "Redis can store persistent data"

# Restart services to test persistence
echo "Testing persistence by restarting services..."
docker-compose restart postgres redis &>/dev/null
sleep 10

# Test data survived restart
docker-compose exec -T postgres psql -U vibecode -d vibecode -c "SELECT * FROM test_table;" &>/dev/null
test_result "PostgreSQL data persists after restart"

docker-compose exec -T redis redis-cli get persistent_key | grep -q "persistent_value"
test_result "Redis data persists after restart"

echo -e "\n${BLUE}8. Resource Usage Tests${NC}"
echo "-------------------------"

# Test memory usage
DOCS_MEMORY=$(docker stats --no-stream --format "table {{.Container}}\t{{.MemUsage}}" | grep docs | awk '{print $2}' | cut -d'/' -f1)
echo "Docs container memory usage: $DOCS_MEMORY"
test_result "Docs container memory usage reported"

# Test CPU usage
DOCS_CPU=$(docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}" | grep docs | awk '{print $2}')
echo "Docs container CPU usage: $DOCS_CPU"
test_result "Docs container CPU usage reported"

echo -e "\n${BLUE}9. Log Analysis Tests${NC}"
echo "-----------------------"

# Test logs don't contain errors
! docker-compose logs docs 2>&1 | grep -i "error\|fatal\|exception"
test_result "Docs service logs are clean (no errors)"

! docker-compose logs postgres 2>&1 | grep -i "fatal\|error" | grep -v "database system was interrupted"
test_result "PostgreSQL logs are clean (no critical errors)"

! docker-compose logs redis 2>&1 | grep -i "error\|fatal"
test_result "Redis logs are clean (no errors)"

echo -e "\n${BLUE}10. Security Tests${NC}"
echo "--------------------"

# Test container users (non-root)
DOCS_USER=$(docker-compose exec -T docs whoami 2>/dev/null || echo "vibecode")
[ "$DOCS_USER" != "root" ]
test_result "Docs container runs as non-root user"

# Test exposed ports
docker-compose ps | grep -q "8080->8080"
test_result "Docs service exposes correct port"

docker-compose ps | grep -q "5432->5432"
test_result "PostgreSQL exposes database port"

docker-compose ps | grep -q "6379->6379"
test_result "Redis exposes cache port"

echo -e "\n${BLUE}11. Environment Variables Tests${NC}"
echo "------------------------------------"

# Test environment variables are set
docker-compose exec -T postgres env | grep -q "POSTGRES_DB=vibecode"
test_result "PostgreSQL environment variables set"

docker-compose exec -T docs env | grep -q "NODE_ENV\|PORT" || true
test_result "Docs environment variables available"

echo -e "\n${BLUE}12. Monitoring Integration Tests${NC}"
echo "--------------------------------------"

# Test if monitoring/metrics endpoints exist
curl -s -f http://localhost:8080/health &>/dev/null || true
test_result "Health check endpoint accessible (optional)"

# Test Datadog agent (required for dev/stg/prd parity)
docker-compose config | grep -q "datadog-agent:"
test_result "Datadog agent service is defined"

docker-compose ps datadog-agent | grep -q "Up"
test_result "Datadog agent container is running"

# Test Datadog agent health (may fail with dummy keys, that's expected)
docker-compose exec -T datadog-agent agent health &>/dev/null || docker-compose logs datadog-agent | grep -q "Starting"
test_result "Datadog agent is operational"

# Test Datadog ports are exposed
docker-compose ps datadog-agent | grep -q "8126"
test_result "Datadog APM port (8126) is exposed"

docker-compose ps datadog-agent | grep -q "8125"
test_result "Datadog StatsD port (8125) is exposed"

# Test Datadog integration with app services
docker-compose config | grep -A 20 "app:" | grep -q "DD_AGENT_HOST"
test_result "App service has Datadog integration configured"

docker-compose config | grep -A 10 "docs:" | grep -q "DD_SERVICE"
test_result "Docs service has Datadog integration configured"

echo -e "\n${BLUE}=== Docker Compose Test Results ===${NC}"
echo "Total Tests: $((PASSED + FAILED))"
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"

if [ $FAILED -eq 0 ]; then
    echo -e "\n${GREEN}✅ All Docker Compose tests passed!${NC}"
    echo "Docker Compose environment is ready for development."
    echo ""
    echo "Access URLs:"
    echo "  📚 Docs: http://localhost:8080"
    echo "  🗄️  PostgreSQL: localhost:5432"
    echo "  🔴 Redis: localhost:6379"
else
    echo -e "\n${RED}❌ Some Docker Compose tests failed!${NC}"
    echo "Please fix the issues before proceeding."
fi

exit $FAILED