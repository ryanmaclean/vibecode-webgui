#!/usr/bin/env bash

# AgentAPI Test Execution Script
# Runs comprehensive test suite with coverage reporting
# Usage: ./scripts/run-agentapi-tests.sh [test-type]
# Test types: unit, integration, e2e, performance, security, all

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

TEST_TYPE="${1:-all}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RESULTS_DIR="$PROJECT_ROOT/test-results"
COVERAGE_DIR="$PROJECT_ROOT/coverage"

# Test configuration
COVERAGE_THRESHOLD=80
PARALLEL_WORKERS=4

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_test() {
    echo -e "${BLUE}[TEST]${NC} $1"
}

check_prerequisites() {
    log_info "Checking prerequisites..."

    if ! command -v npm &> /dev/null; then
        log_error "npm not found"
        exit 1
    fi

    if ! command -v docker &> /dev/null; then
        log_error "docker not found"
        exit 1
    fi

    # Ensure dependencies are installed
    if [ ! -d "$PROJECT_ROOT/node_modules" ]; then
        log_info "Installing dependencies..."
        npm ci
    fi

    log_info "Prerequisites check passed"
}

setup_test_environment() {
    log_info "Setting up test environment..."

    # Create results directory
    mkdir -p "$RESULTS_DIR"
    mkdir -p "$COVERAGE_DIR"

    # Start test services
    log_info "Starting test database..."
    docker-compose -f docker/docker-compose.test.yml up -d postgres redis

    # Wait for services
    sleep 5

    # Run database migrations
    export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/vibecode_test"
    npm run prisma:migrate:deploy

    log_info "Test environment ready"
}

cleanup_test_environment() {
    log_info "Cleaning up test environment..."

    docker-compose -f docker/docker-compose.test.yml down -v || true

    log_info "Cleanup complete"
}

run_unit_tests() {
    log_test "Running unit tests..."

    npm run test:unit -- \
        --testPathPattern="agent" \
        --coverage \
        --coverageDirectory="$COVERAGE_DIR/unit" \
        --maxWorkers=$PARALLEL_WORKERS \
        --json --outputFile="$RESULTS_DIR/unit-results.json"

    local exit_code=$?

    if [ $exit_code -eq 0 ]; then
        log_info "✓ Unit tests passed"
    else
        log_error "✗ Unit tests failed"
    fi

    return $exit_code
}

run_integration_tests() {
    log_test "Running integration tests..."

    npm run test:integration -- \
        --testPathPattern="agent" \
        --runInBand \
        --json --outputFile="$RESULTS_DIR/integration-results.json"

    local exit_code=$?

    if [ $exit_code -eq 0 ]; then
        log_info "✓ Integration tests passed"
    else
        log_error "✗ Integration tests failed"
    fi

    return $exit_code
}

run_e2e_tests() {
    log_test "Running E2E tests..."

    # Start AgentAPI container
    docker run -d \
        --name agentapi-test \
        -p 3284:3284 \
        -e AGENTAPI_HOST=0.0.0.0 \
        ghcr.io/ryanmaclean/vibecode-agentapi:latest

    sleep 10

    # Run Playwright tests
    npm run test:e2e -- \
        --grep="agent" \
        --reporter=json \
        --output="$RESULTS_DIR/playwright-results.json"

    local exit_code=$?

    # Cleanup
    docker stop agentapi-test || true
    docker rm agentapi-test || true

    if [ $exit_code -eq 0 ]; then
        log_info "✓ E2E tests passed"
    else
        log_error "✗ E2E tests failed"
    fi

    return $exit_code
}

run_performance_tests() {
    log_test "Running performance tests..."

    # Start AgentAPI container
    docker run -d \
        --name agentapi-perf \
        -p 3284:3284 \
        -e AGENTAPI_HOST=0.0.0.0 \
        -e AGENTAPI_MAX_CONCURRENT_AGENTS=10 \
        ghcr.io/ryanmaclean/vibecode-agentapi:latest

    sleep 10

    # Run performance tests
    npm run test:performance -- \
        --testPathPattern="agent" \
        --runInBand \
        --json --outputFile="$RESULTS_DIR/performance-results.json"

    local exit_code=$?

    # Cleanup
    docker stop agentapi-perf || true
    docker rm agentapi-perf || true

    if [ $exit_code -eq 0 ]; then
        log_info "✓ Performance tests passed"
    else
        log_error "✗ Performance tests failed"
    fi

    return $exit_code
}

run_security_tests() {
    log_test "Running security tests..."

    npm run test:security -- \
        --testPathPattern="agent" \
        --json --outputFile="$RESULTS_DIR/security-results.json"

    local exit_code=$?

    if [ $exit_code -eq 0 ]; then
        log_info "✓ Security tests passed"
    else
        log_error "✗ Security tests failed"
    fi

    return $exit_code
}

check_coverage() {
    log_info "Checking coverage thresholds..."

    if [ ! -f "$COVERAGE_DIR/coverage-summary.json" ]; then
        log_warn "Coverage summary not found"
        return 0
    fi

    COVERAGE=$(cat "$COVERAGE_DIR/coverage-summary.json" | jq '.total.lines.pct')

    log_info "Line coverage: ${COVERAGE}%"

    if (( $(echo "$COVERAGE < $COVERAGE_THRESHOLD" | bc -l) )); then
        log_error "Coverage below threshold: ${COVERAGE}% < ${COVERAGE_THRESHOLD}%"
        return 1
    else
        log_info "✓ Coverage meets threshold"
        return 0
    fi
}

generate_test_report() {
    log_info "Generating test report..."

    REPORT_FILE="$RESULTS_DIR/test-summary.md"

    cat > "$REPORT_FILE" <<EOF
# AgentAPI Test Summary

**Generated**: $(date)
**Test Type**: $TEST_TYPE

## Test Results

| Test Suite | Status | Duration |
|------------|--------|----------|
| Unit Tests | ${UNIT_STATUS:-N/A} | ${UNIT_DURATION:-N/A} |
| Integration Tests | ${INTEGRATION_STATUS:-N/A} | ${INTEGRATION_DURATION:-N/A} |
| E2E Tests | ${E2E_STATUS:-N/A} | ${E2E_DURATION:-N/A} |
| Performance Tests | ${PERFORMANCE_STATUS:-N/A} | ${PERFORMANCE_DURATION:-N/A} |
| Security Tests | ${SECURITY_STATUS:-N/A} | ${SECURITY_DURATION:-N/A} |

## Coverage

- **Line Coverage**: ${COVERAGE:-N/A}%
- **Threshold**: ${COVERAGE_THRESHOLD}%

## Artifacts

- Unit test results: \`test-results/unit-results.json\`
- Integration test results: \`test-results/integration-results.json\`
- E2E test results: \`test-results/playwright-results.json\`
- Coverage report: \`coverage/\`

EOF

    log_info "Test report saved to: $REPORT_FILE"
    cat "$REPORT_FILE"
}

run_all_tests() {
    log_info "Running complete test suite..."

    local all_passed=true

    # Unit tests
    if run_unit_tests; then
        UNIT_STATUS="✅ Passed"
    else
        UNIT_STATUS="❌ Failed"
        all_passed=false
    fi

    # Integration tests
    if run_integration_tests; then
        INTEGRATION_STATUS="✅ Passed"
    else
        INTEGRATION_STATUS="❌ Failed"
        all_passed=false
    fi

    # E2E tests
    if run_e2e_tests; then
        E2E_STATUS="✅ Passed"
    else
        E2E_STATUS="❌ Failed"
        all_passed=false
    fi

    # Performance tests
    if run_performance_tests; then
        PERFORMANCE_STATUS="✅ Passed"
    else
        PERFORMANCE_STATUS="❌ Failed"
        all_passed=false
    fi

    # Security tests
    if run_security_tests; then
        SECURITY_STATUS="✅ Passed"
    else
        SECURITY_STATUS="❌ Failed"
        all_passed=false
    fi

    # Check coverage
    if ! check_coverage; then
        all_passed=false
    fi

    generate_test_report

    if [ "$all_passed" = true ]; then
        log_info "🎉 All tests passed!"
        return 0
    else
        log_error "⚠️ Some tests failed"
        return 1
    fi
}

main() {
    log_info "AgentAPI Test Execution Script"
    log_info "Test type: $TEST_TYPE"
    echo ""

    check_prerequisites
    setup_test_environment

    # Trap to ensure cleanup
    trap cleanup_test_environment EXIT

    local exit_code=0

    case "$TEST_TYPE" in
        unit)
            run_unit_tests || exit_code=$?
            ;;
        integration)
            run_integration_tests || exit_code=$?
            ;;
        e2e)
            run_e2e_tests || exit_code=$?
            ;;
        performance)
            run_performance_tests || exit_code=$?
            ;;
        security)
            run_security_tests || exit_code=$?
            ;;
        all)
            run_all_tests || exit_code=$?
            ;;
        *)
            log_error "Invalid test type: $TEST_TYPE"
            echo "Valid types: unit, integration, e2e, performance, security, all"
            exit 1
            ;;
    esac

    if [ $exit_code -eq 0 ]; then
        log_info "✓ Test execution completed successfully"
    else
        log_error "✗ Test execution failed with exit code: $exit_code"
    fi

    exit $exit_code
}

main "$@"
