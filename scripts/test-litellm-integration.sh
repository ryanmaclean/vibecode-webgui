#!/bin/bash

# LiteLLM Integration Test Script
# ==============================

set -e

echo "🤖 LiteLLM Integration Test Suite"
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DOCKER_COMPOSE_FILE="docker-compose.litellm.yml"
TEST_TIMEOUT=300 # 5 minutes

# Environment variables with defaults
LITELLM_BASE_URL="${LITELLM_BASE_URL:-http://localhost:4000}"
LITELLM_MASTER_KEY="${LITELLM_MASTER_KEY:-sk-vibecode-master-key-12345}"
POSTGRES_URL="${POSTGRES_URL:-postgresql://litellm:litellm_password@localhost:5433/litellm}"
REDIS_URL="${REDIS_URL:-redis://localhost:6380}"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if a port is open
check_port() {
    local host=$1
    local port=$2
    timeout 5 bash -c "cat < /dev/null > /dev/tcp/$host/$port" 2>/dev/null
}

# Function to wait for service to be ready
wait_for_service() {
    local service_name=$1
    local check_command="$2"
    local max_attempts=30
    local attempt=1

    print_status "Waiting for $service_name to be ready..."
    
    while [ $attempt -le $max_attempts ]; do
        if eval "$check_command" >/dev/null 2>&1; then
            print_success "$service_name is ready!"
            return 0
        fi
        
        print_status "Attempt $attempt/$max_attempts: $service_name not ready yet..."
        sleep 5
        ((attempt++))
    done
    
    print_error "$service_name failed to start after $max_attempts attempts"
    return 1
}

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    local missing_deps=()
    
    if ! command_exists docker; then
        missing_deps+=("docker")
    fi
    
    if ! command_exists docker-compose; then
        missing_deps+=("docker-compose")
    fi
    
    if ! command_exists curl; then
        missing_deps+=("curl")
    fi
    
    if ! command_exists npm; then
        missing_deps+=("npm")
    fi
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        print_error "Missing required dependencies: ${missing_deps[*]}"
        print_error "Please install the missing dependencies and try again"
        exit 1
    fi
    
    print_success "All prerequisites satisfied"
}

# Function to setup environment
setup_environment() {
    print_status "Setting up test environment..."
    
    # Create .env file for testing
    cat > "$PROJECT_ROOT/.env.litellm.test" << EOF
# LiteLLM Test Environment
LITELLM_MASTER_KEY=${LITELLM_MASTER_KEY}
LITELLM_BASE_URL=${LITELLM_BASE_URL}
POSTGRES_URL=${POSTGRES_URL}
REDIS_URL=${REDIS_URL}

# Optional API keys (set these for full testing)
OPENAI_API_KEY=${OPENAI_API_KEY:-}
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-}
DD_API_KEY=${DD_API_KEY:-}

# Test configuration
NODE_ENV=test
RUN_REAL_LITELLM_TESTS=true
EOF

    # Export environment variables
    export $(cat "$PROJECT_ROOT/.env.litellm.test" | grep -v '^#' | xargs)
    
    print_success "Environment configured"
}

# Function to start LiteLLM services
start_services() {
    print_status "Starting LiteLLM services..."
    
    cd "$PROJECT_ROOT"
    
    # Check if services are already running
    if docker-compose -f "$DOCKER_COMPOSE_FILE" ps | grep -q "Up"; then
        print_warning "Some services are already running. Stopping them first..."
        docker-compose -f "$DOCKER_COMPOSE_FILE" down
    fi
    
    # Start services
    docker-compose -f "$DOCKER_COMPOSE_FILE" up -d
    
    # Wait for database
    wait_for_service "PostgreSQL" "docker-compose -f $DOCKER_COMPOSE_FILE exec -T litellm-postgres pg_isready -U litellm"
    
    # Wait for Redis
    wait_for_service "Redis" "docker-compose -f $DOCKER_COMPOSE_FILE exec -T litellm-redis redis-cli ping"
    
    # Wait for LiteLLM proxy
    wait_for_service "LiteLLM Proxy" "curl -f $LITELLM_BASE_URL/health"
    
    print_success "All services are running"
}

# Function to run health checks
run_health_checks() {
    print_status "Running health checks..."
    
    # Check LiteLLM proxy health
    if curl -s -f "$LITELLM_BASE_URL/health" > /dev/null; then
        print_success "LiteLLM proxy health check passed"
    else
        print_error "LiteLLM proxy health check failed"
        return 1
    fi
    
    # Check metrics endpoint
    if curl -s -f "$LITELLM_BASE_URL/metrics" > /dev/null; then
        print_success "Metrics endpoint is accessible"
    else
        print_warning "Metrics endpoint is not accessible"
    fi
    
    # Check VibeCode API integration (if running)
    if check_port localhost 3000; then
        if curl -s -f "http://localhost:3000/api/ai/litellm" > /dev/null; then
            print_success "VibeCode API integration health check passed"
        else
            print_warning "VibeCode API integration not responding (this is OK if not running)"
        fi
    else
        print_warning "VibeCode app not running on port 3000 (this is OK for infrastructure-only tests)"
    fi
}

# Function to run unit tests
run_unit_tests() {
    print_status "Running LiteLLM unit tests..."
    
    cd "$PROJECT_ROOT"
    
    # Run specific LiteLLM integration tests
    if npm test -- --testPathPattern="litellm-integration" --verbose; then
        print_success "Unit tests passed"
    else
        print_error "Unit tests failed"
        return 1
    fi
}

# Function to run integration tests
run_integration_tests() {
    print_status "Running LiteLLM integration tests..."
    
    # Test direct LiteLLM proxy endpoints
    print_status "Testing LiteLLM proxy endpoints..."
    
    # Test models endpoint
    if curl -s -H "Authorization: Bearer $LITELLM_MASTER_KEY" "$LITELLM_BASE_URL/models" | grep -q '"data"'; then
        print_success "Models endpoint test passed"
    else
        print_error "Models endpoint test failed"
        return 1
    fi
    
    # Test chat completion (if API keys available)
    if [ -n "$OPENAI_API_KEY" ]; then
        print_status "Testing chat completion with real API key..."
        
        CHAT_RESPONSE=$(curl -s -X POST "$LITELLM_BASE_URL/chat/completions" \
            -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
            -H "Content-Type: application/json" \
            -d '{
                "model": "gpt-4o-mini",
                "messages": [{"role": "user", "content": "Say hello"}],
                "max_tokens": 10
            }')
        
        if echo "$CHAT_RESPONSE" | grep -q '"choices"'; then
            print_success "Chat completion test passed"
        else
            print_error "Chat completion test failed"
            echo "Response: $CHAT_RESPONSE"
            return 1
        fi
    else
        print_warning "Skipping chat completion test (no OPENAI_API_KEY)"
    fi
    
    # Test database connectivity
    print_status "Testing database connectivity..."
    if docker-compose -f "$DOCKER_COMPOSE_FILE" exec -T litellm-postgres psql -U litellm -d litellm -c "SELECT 1;" > /dev/null; then
        print_success "Database connectivity test passed"
    else
        print_error "Database connectivity test failed"
        return 1
    fi
    
    # Test Redis connectivity
    print_status "Testing Redis connectivity..."
    if docker-compose -f "$DOCKER_COMPOSE_FILE" exec -T litellm-redis redis-cli ping | grep -q "PONG"; then
        print_success "Redis connectivity test passed"
    else
        print_error "Redis connectivity test failed"
        return 1
    fi
}

# Function to run performance tests
run_performance_tests() {
    print_status "Running performance tests..."
    
    # Test concurrent requests
    print_status "Testing concurrent request handling..."
    
    for i in {1..5}; do
        curl -s -X POST "$LITELLM_BASE_URL/health" &
    done
    wait
    
    print_success "Concurrent request test completed"
}

# Function to test monitoring integration
test_monitoring() {
    print_status "Testing monitoring integration..."
    
    # Check Prometheus metrics
    if curl -s "$LITELLM_BASE_URL/metrics" | grep -q "litellm_"; then
        print_success "Prometheus metrics are being exported"
    else
        print_warning "Prometheus metrics not found"
    fi
    
    # Check if Datadog agent is running (if configured)
    if docker-compose -f "$DOCKER_COMPOSE_FILE" ps | grep -q "litellm-datadog-agent"; then
        print_success "Datadog agent is running"
    else
        print_warning "Datadog agent is not running (this is OK if not configured)"
    fi
}

# Function to run load tests
run_load_tests() {
    if [ "$RUN_LOAD_TESTS" = "true" ]; then
        print_status "Running load tests..."
        
        # Simple load test with curl
        print_status "Running 50 concurrent health check requests..."
        
        start_time=$(date +%s)
        for i in {1..50}; do
            curl -s -f "$LITELLM_BASE_URL/health" > /dev/null &
        done
        wait
        end_time=$(date +%s)
        
        duration=$((end_time - start_time))
        print_success "Load test completed in ${duration} seconds"
        
        if [ $duration -lt 10 ]; then
            print_success "Load test performance is acceptable"
        else
            print_warning "Load test performance is slower than expected"
        fi
    else
        print_status "Skipping load tests (set RUN_LOAD_TESTS=true to enable)"
    fi
}

# Function to cleanup
cleanup() {
    print_status "Cleaning up test environment..."
    
    cd "$PROJECT_ROOT"
    
    # Stop services if requested
    if [ "$CLEANUP_SERVICES" != "false" ]; then
        docker-compose -f "$DOCKER_COMPOSE_FILE" down
        print_success "Services stopped"
    else
        print_status "Services left running (set CLEANUP_SERVICES=false to keep running)"
    fi
    
    # Remove test environment file
    rm -f "$PROJECT_ROOT/.env.litellm.test"
    
    print_success "Cleanup completed"
}

# Function to show service logs
show_logs() {
    print_status "Recent service logs:"
    echo "====================="
    
    docker-compose -f "$DOCKER_COMPOSE_FILE" logs --tail=50 litellm-proxy
}

# Function to show usage
show_usage() {
    cat << EOF
LiteLLM Integration Test Script

Usage: $0 [OPTIONS]

Options:
    --unit-only         Run only unit tests (no services)
    --no-cleanup        Don't stop services after tests
    --load-tests        Include load testing
    --logs              Show service logs after tests
    --help              Show this help message

Environment Variables:
    LITELLM_BASE_URL    LiteLLM proxy URL (default: http://localhost:4000)
    LITELLM_MASTER_KEY  LiteLLM master key (default: sk-vibecode-master-key-12345)
    OPENAI_API_KEY      OpenAI API key (optional, for real API tests)
    ANTHROPIC_API_KEY   Anthropic API key (optional, for real API tests)
    DD_API_KEY          Datadog API key (optional, for monitoring tests)
    CLEANUP_SERVICES    Set to 'false' to keep services running (default: true)
    RUN_LOAD_TESTS      Set to 'true' to run load tests (default: false)

Examples:
    # Run all tests
    $0

    # Run only unit tests
    $0 --unit-only

    # Run tests and keep services running
    $0 --no-cleanup

    # Run tests with load testing
    $0 --load-tests

    # Show logs after tests
    $0 --logs
EOF
}

# Main execution
main() {
    local unit_only=false
    local show_logs_after=false
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --unit-only)
                unit_only=true
                shift
                ;;
            --no-cleanup)
                export CLEANUP_SERVICES=false
                shift
                ;;
            --load-tests)
                export RUN_LOAD_TESTS=true
                shift
                ;;
            --logs)
                show_logs_after=true
                shift
                ;;
            --help)
                show_usage
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done
    
    # Set defaults
    export CLEANUP_SERVICES="${CLEANUP_SERVICES:-true}"
    export RUN_LOAD_TESTS="${RUN_LOAD_TESTS:-false}"
    
    # Trap for cleanup on exit
    trap cleanup EXIT
    
    echo "Starting LiteLLM Integration Tests..."
    echo "Time: $(date)"
    echo "Project: $PROJECT_ROOT"
    echo "Unit only: $unit_only"
    echo ""
    
    # Check prerequisites
    check_prerequisites
    
    # Setup environment
    setup_environment
    
    if [ "$unit_only" = "true" ]; then
        print_status "Running unit tests only..."
        run_unit_tests
    else
        # Start services
        start_services
        
        # Run health checks
        run_health_checks
        
        # Run all tests
        run_unit_tests
        run_integration_tests
        run_performance_tests
        test_monitoring
        run_load_tests
    fi
    
    # Show logs if requested
    if [ "$show_logs_after" = "true" ]; then
        show_logs
    fi
    
    print_success "All tests completed successfully! 🎉"
    
    # Summary
    echo ""
    echo "📊 Test Summary:"
    echo "================"
    echo "✅ Prerequisites check"
    echo "✅ Environment setup"
    if [ "$unit_only" != "true" ]; then
        echo "✅ Service startup"
        echo "✅ Health checks"
        echo "✅ Integration tests"
        echo "✅ Performance tests"
        echo "✅ Monitoring tests"
        if [ "$RUN_LOAD_TESTS" = "true" ]; then
            echo "✅ Load tests"
        fi
    fi
    echo "✅ Unit tests"
    echo ""
    
    if [ "$CLEANUP_SERVICES" != "false" ]; then
        print_status "Services have been stopped"
    else
        print_status "Services are still running:"
        print_status "  - LiteLLM Proxy: $LITELLM_BASE_URL"
        print_status "  - LiteLLM UI: http://localhost:3001"
        print_status "  - PostgreSQL: localhost:5433"
        print_status "  - Redis: localhost:6380"
        print_status ""
        print_status "To stop services: docker-compose -f $DOCKER_COMPOSE_FILE down"
    fi
}

# Run main function with all arguments
main "$@" 