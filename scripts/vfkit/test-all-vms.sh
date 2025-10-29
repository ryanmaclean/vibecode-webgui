#!/usr/bin/env bash
# Test All VMs - Comprehensive test suite for entire stack
# Tests: All VMs, integration, connectivity, performance

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

log_info() { echo -e "${BLUE}[INFO]${NC} $*"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_section() { echo -e "\n${CYAN}===${NC} $* ${CYAN}===${NC}"; }

total_passed=0
total_failed=0

# Test if VM is running
test_vm_running() {
    local vm_name=$1
    "$SCRIPT_DIR/vm-manager.sh" status "$vm_name" | grep -q "RUNNING"
}

# Run individual VM test
run_vm_test() {
    local vm_name=$1
    local test_script="$SCRIPT_DIR/test-${vm_name}.sh"

    log_section "Testing $vm_name VM"

    # Check if VM is running
    if ! test_vm_running "$vm_name"; then
        log_error "$vm_name VM is not running"
        log_info "Start it with: $SCRIPT_DIR/vm-manager.sh start $vm_name"
        return 1
    fi

    # Run test script
    if [[ -x "$test_script" ]]; then
        if "$test_script"; then
            log_success "$vm_name tests passed"
            return 0
        else
            log_error "$vm_name tests failed"
            return 1
        fi
    else
        log_warn "Test script not found or not executable: $test_script"
        return 1
    fi
}

# Integration test: Valkey + PostgreSQL
test_integration_cache_db() {
    log_section "Integration Test: Valkey + PostgreSQL"

    # Test Valkey is accessible
    if ! redis-cli -h localhost -p 6379 -a VibeCodeChangeMe2025 ping 2>/dev/null | grep -q PONG; then
        log_error "Valkey not accessible"
        return 1
    fi

    # Test PostgreSQL is accessible
    if ! PGPASSWORD=vibecode psql -h localhost -U vibecode -d vibecode -c "SELECT 1" >/dev/null 2>&1; then
        log_error "PostgreSQL not accessible"
        return 1
    fi

    # Test: Store DB query result in Valkey cache
    log_info "Testing cache-aside pattern..."

    # Get data from DB
    local db_result
    db_result=$(PGPASSWORD=vibecode psql -h localhost -U vibecode -d vibecode -t -A -c "SELECT NOW();" 2>/dev/null)

    if [[ -z "$db_result" ]]; then
        log_error "Failed to query PostgreSQL"
        return 1
    fi

    # Store in Valkey
    redis-cli -h localhost -p 6379 -a VibeCodeChangeMe2025 SET "test:integration:timestamp" "$db_result" EX 60 >/dev/null 2>&1

    # Retrieve from Valkey
    local cache_result
    cache_result=$(redis-cli -h localhost -p 6379 -a VibeCodeChangeMe2025 GET "test:integration:timestamp" 2>/dev/null)

    # Cleanup
    redis-cli -h localhost -p 6379 -a VibeCodeChangeMe2025 DEL "test:integration:timestamp" >/dev/null 2>&1

    if [[ "$db_result" == "$cache_result" ]]; then
        log_success "Cache-aside pattern works correctly"
        return 0
    else
        log_error "Cache-aside pattern failed: DB='$db_result' vs Cache='$cache_result'"
        return 1
    fi
}

# Integration test: Full stack
test_integration_full_stack() {
    log_section "Integration Test: Full Stack"

    log_info "Testing full stack connectivity..."

    local stack_healthy=true

    # Test Valkey
    if redis-cli -h localhost -p 6379 -a VibeCodeChangeMe2025 ping 2>/dev/null | grep -q PONG; then
        log_success "Valkey: Connected"
    else
        log_error "Valkey: Connection failed"
        stack_healthy=false
    fi

    # Test PostgreSQL
    if PGPASSWORD=vibecode psql -h localhost -U vibecode -d vibecode -c "SELECT 1" >/dev/null 2>&1; then
        log_success "PostgreSQL: Connected"
    else
        log_error "PostgreSQL: Connection failed"
        stack_healthy=false
    fi

    # Test Node.js health endpoint
    if curl -s http://localhost:3000/health >/dev/null 2>&1; then
        log_success "Node.js: Health endpoint responding"
    else
        log_warn "Node.js: Health endpoint not responding (might be expected)"
    fi

    $stack_healthy
}

# Performance test: Valkey throughput
test_performance_valkey() {
    log_section "Performance Test: Valkey Throughput"

    if ! command -v redis-benchmark &>/dev/null; then
        log_warn "redis-benchmark not available, skipping"
        return 0
    fi

    log_info "Running Valkey benchmark (10000 requests)..."

    local benchmark_output
    benchmark_output=$(redis-benchmark -h localhost -p 6379 -a VibeCodeChangeMe2025 \
        -t set,get -n 10000 -q 2>&1 || echo "FAILED")

    if [[ "$benchmark_output" != "FAILED" ]]; then
        echo "$benchmark_output" | while read -r line; do
            echo "  $line"
        done
        log_success "Valkey benchmark completed"
        return 0
    else
        log_error "Valkey benchmark failed"
        return 1
    fi
}

# Performance test: PostgreSQL query speed
test_performance_postgresql() {
    log_section "Performance Test: PostgreSQL Query Speed"

    log_info "Testing PostgreSQL query performance..."

    local start_time end_time duration

    start_time=$(date +%s%3N)

    PGPASSWORD=vibecode psql -h localhost -U vibecode -d vibecode -c "
        SELECT generate_series(1, 10000) AS id;
    " >/dev/null 2>&1

    end_time=$(date +%s%3N)
    duration=$((end_time - start_time))

    echo "  Query time (10,000 rows): ${duration}ms"

    if [[ $duration -lt 5000 ]]; then
        log_success "PostgreSQL query performance: Good (${duration}ms)"
        return 0
    else
        log_warn "PostgreSQL query performance: Slow (${duration}ms)"
        return 0  # Don't fail, just warn
    fi
}

# Check required tools
check_requirements() {
    log_section "Checking Requirements"

    local missing_tools=()

    if ! command -v redis-cli &>/dev/null; then
        missing_tools+=("redis-cli")
    fi

    if ! command -v psql &>/dev/null; then
        missing_tools+=("psql")
    fi

    if ! command -v curl &>/dev/null; then
        missing_tools+=("curl")
    fi

    if ! command -v jq &>/dev/null; then
        missing_tools+=("jq")
    fi

    if [[ ${#missing_tools[@]} -gt 0 ]]; then
        log_warn "Missing tools: ${missing_tools[*]}"
        log_info "Install with: brew install ${missing_tools[*]}"
        log_warn "Some tests may be skipped"
    else
        log_success "All required tools available"
    fi
}

# Main test execution
main() {
    echo -e "${BLUE}TPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPW${NC}"
    echo -e "${BLUE}Q  VibeCode VM Stack - Comprehensive Test Suite       Q${NC}"
    echo -e "${BLUE}ZPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP]${NC}"

    check_requirements

    # Test individual VMs
    log_section "Individual VM Tests"

    local vms=("valkey" "postgresql" "nodejs-dev")
    local vm_results=()

    for vm in "${vms[@]}"; do
        if run_vm_test "$vm"; then
            vm_results+=("${GREEN}${NC} $vm")
            ((total_passed++))
        else
            vm_results+=("${RED}${NC} $vm")
            ((total_failed++))
        fi
        echo ""
    done

    # Integration tests
    log_section "Integration Tests"

    if command -v redis-cli &>/dev/null && command -v psql &>/dev/null; then
        if test_integration_cache_db; then
            ((total_passed++))
        else
            ((total_failed++))
        fi

        echo ""

        if test_integration_full_stack; then
            ((total_passed++))
        else
            ((total_failed++))
        fi
    else
        log_warn "Skipping integration tests (missing tools)"
    fi

    # Performance tests
    log_section "Performance Tests"

    if command -v redis-cli &>/dev/null; then
        if test_performance_valkey; then
            ((total_passed++))
        else
            ((total_failed++))
        fi
    else
        log_warn "Skipping Valkey performance test"
    fi

    echo ""

    if command -v psql &>/dev/null; then
        if test_performance_postgresql; then
            ((total_passed++))
        else
            ((total_failed++))
        fi
    else
        log_warn "Skipping PostgreSQL performance test"
    fi

    # Show VM status
    log_section "VM Status"
    "$SCRIPT_DIR/vm-manager.sh" list

    # Final summary
    echo -e "\n${CYAN}PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP${NC}"
    echo -e "${CYAN}Q  Final Test Summary                               Q${NC}"
    echo -e "${CYAN}PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP${NC}"

    echo -e "\n${YELLOW}Individual VM Results:${NC}"
    for result in "${vm_results[@]}"; do
        echo -e "  $result"
    done

    echo -e "\n${YELLOW}Overall Results:${NC}"
    echo -e "  ${GREEN}Passed:${NC} $total_passed"
    echo -e "  ${RED}Failed:${NC} $total_failed"
    echo -e "  ${YELLOW}Total:${NC} $((total_passed + total_failed))"

    if [[ $total_failed -eq 0 ]]; then
        echo -e "\n${GREEN} All tests passed! VibeCode VM stack is fully operational.${NC}"
        exit 0
    else
        echo -e "\n${RED} Some tests failed. Review the output above.${NC}"
        echo -e "\n${YELLOW}Troubleshooting:${NC}"
        echo "  1. Check VM logs: $SCRIPT_DIR/vm-manager.sh logs <vm-name>"
        echo "  2. Restart VMs: $SCRIPT_DIR/vm-manager.sh restart-all"
        echo "  3. Run health check: $SCRIPT_DIR/vm-manager.sh health"
        exit 1
    fi
}

main "$@"
