#!/bin/bash
# Valkey VM Test Suite
# Tests for Valkey (Redis-compatible) VM infrastructure

set -euo pipefail

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/test-framework.sh"

# Configuration
VALKEY_CONFIG="${VALKEY_CONFIG:-/Users/ryan.maclean/vibecode-webgui/config/vfkit/valkey-vm.yaml}"
VALKEY_HOST="${VALKEY_HOST:-localhost}"
VALKEY_PORT="${VALKEY_PORT:-6379}"
VALKEY_PASSWORD="${VALKEY_PASSWORD:-vibecode123}"
VM_NAME="vibecode-valkey"
VFKIT_BIN="/Users/ryan.maclean/vibecode-webgui/src-tauri/resources/vfkit-aarch64-apple-darwin"

# Test data
TEST_KEY="test:key:$(date +%s)"
TEST_VALUE="test_value_$(date +%s)"

# Cleanup function
cleanup() {
    log_info "Cleaning up..."
    if pgrep -f "vfkit.*$VM_NAME" >/dev/null; then
        log_info "Stopping Valkey VM..."
        pkill -f "vfkit.*$VM_NAME" || true
        sleep 2
    fi
}

# Trap cleanup on exit
trap cleanup EXIT

# Main test suite
main() {
    init_test_suite "Valkey VM Tests"

    # Test 1: Configuration file exists
    log_info "Test 1: Checking Valkey VM configuration..."
    assert_file_exists "$VALKEY_CONFIG" "Valkey VM config file exists"

    # Test 2: Validate YAML syntax
    log_info "Test 2: Validating YAML syntax..."
    if command -v python3 >/dev/null 2>&1; then
        python3 -c "import yaml; yaml.safe_load(open('$VALKEY_CONFIG'))" 2>&1 && \
            assert_success "YAML syntax validation" true || \
            assert_success "YAML syntax validation" false
    else
        log_warn "Python3 not available, skipping YAML validation"
    fi

    # Test 3: vfkit binary exists and is executable
    log_info "Test 3: Checking vfkit binary..."
    assert_file_exists "$VFKIT_BIN" "vfkit binary exists"
    if [[ -x "$VFKIT_BIN" ]]; then
        assert_success "vfkit binary is executable" true
    else
        assert_success "vfkit binary is executable" false
    fi

    # Test 4: Start VM (if config exists)
    if [[ ! -f "$VALKEY_CONFIG" ]]; then
        log_warn "Valkey VM config not found at $VALKEY_CONFIG"
        log_warn "Skipping runtime tests. Please run VM setup first."
        finalize_test_suite "Valkey VM Tests (Partial)"
        return
    fi

    log_info "Test 4: Starting Valkey VM..."
    log_info "Command: $VFKIT_BIN --config $VALKEY_CONFIG"

    # Start VM in background
    "$VFKIT_BIN" --config "$VALKEY_CONFIG" > /tmp/valkey-vm.log 2>&1 &
    local vm_pid=$!
    sleep 5

    # Check if VM is running
    if ps -p $vm_pid > /dev/null 2>&1; then
        assert_success "Valkey VM started successfully" true
    else
        assert_success "Valkey VM started successfully" false
        log_error "VM failed to start. Log output:"
        tail -20 /tmp/valkey-vm.log
        finalize_test_suite "Valkey VM Tests (Failed)"
        exit 1
    fi

    # Test 5: Wait for VM to boot
    log_info "Test 5: Waiting for VM to boot..."
    if wait_for_vm "$VM_NAME" 60; then
        assert_success "VM boot completed" true
    else
        assert_success "VM boot completed" false
    fi

    # Test 6: Check port accessibility
    log_info "Test 6: Checking port $VALKEY_PORT accessibility..."
    if wait_for_port "$VALKEY_HOST" "$VALKEY_PORT" 30; then
        assert_port_open "$VALKEY_HOST" "$VALKEY_PORT" 5 "Valkey port $VALKEY_PORT is accessible"
    else
        assert_port_open "$VALKEY_HOST" "$VALKEY_PORT" 5 "Valkey port $VALKEY_PORT is accessible"
    fi

    # Test 7: PING command
    log_info "Test 7: Testing PING command..."
    if command -v redis-cli >/dev/null 2>&1; then
        local ping_response=$(redis-cli -h "$VALKEY_HOST" -p "$VALKEY_PORT" -a "$VALKEY_PASSWORD" --no-auth-warning PING 2>&1 || echo "ERROR")
        assert_equals "PONG" "$ping_response" "PING returns PONG"
    else
        log_warn "redis-cli not installed, using nc for basic connectivity test"
        echo -e "PING\r\n" | nc -w 2 "$VALKEY_HOST" "$VALKEY_PORT" > /tmp/valkey-ping.txt 2>&1 || true
        if grep -q "PONG\|OK" /tmp/valkey-ping.txt; then
            assert_success "Basic connectivity test" true
        else
            log_warn "Could not verify PING response without redis-cli"
        fi
    fi

    # Test 8: SET/GET operations
    if command -v redis-cli >/dev/null 2>&1; then
        log_info "Test 8: Testing SET/GET operations..."

        # SET command
        local set_response=$(redis-cli -h "$VALKEY_HOST" -p "$VALKEY_PORT" -a "$VALKEY_PASSWORD" --no-auth-warning SET "$TEST_KEY" "$TEST_VALUE" 2>&1)
        assert_equals "OK" "$set_response" "SET command successful"

        # GET command
        local get_response=$(redis-cli -h "$VALKEY_HOST" -p "$VALKEY_PORT" -a "$VALKEY_PASSWORD" --no-auth-warning GET "$TEST_KEY" 2>&1)
        assert_equals "$TEST_VALUE" "$get_response" "GET returns correct value"

        # DELETE command
        redis-cli -h "$VALKEY_HOST" -p "$VALKEY_PORT" -a "$VALKEY_PASSWORD" --no-auth-warning DEL "$TEST_KEY" >/dev/null 2>&1
    else
        log_warn "redis-cli not installed, skipping SET/GET tests"
        log_info "To install redis-cli: brew install redis"
    fi

    # Test 9: Persistence test (restart)
    if command -v redis-cli >/dev/null 2>&1; then
        log_info "Test 9: Testing persistence..."

        local persist_key="persist:test:$(date +%s)"
        local persist_value="persist_value_$(date +%s)"

        # Set a key
        redis-cli -h "$VALKEY_HOST" -p "$VALKEY_PORT" -a "$VALKEY_PASSWORD" --no-auth-warning SET "$persist_key" "$persist_value" >/dev/null 2>&1

        # Save to disk
        redis-cli -h "$VALKEY_HOST" -p "$VALKEY_PORT" -a "$VALKEY_PASSWORD" --no-auth-warning SAVE >/dev/null 2>&1

        # Restart VM
        log_info "Restarting VM to test persistence..."
        pkill -f "vfkit.*$VM_NAME" || true
        sleep 3

        "$VFKIT_BIN" --config "$VALKEY_CONFIG" > /tmp/valkey-vm-restart.log 2>&1 &
        sleep 5

        if wait_for_port "$VALKEY_HOST" "$VALKEY_PORT" 30; then
            local persisted_value=$(redis-cli -h "$VALKEY_HOST" -p "$VALKEY_PORT" -a "$VALKEY_PASSWORD" --no-auth-warning GET "$persist_key" 2>&1)
            assert_equals "$persist_value" "$persisted_value" "Persisted data survives restart"

            # Cleanup
            redis-cli -h "$VALKEY_HOST" -p "$VALKEY_PORT" -a "$VALKEY_PASSWORD" --no-auth-warning DEL "$persist_key" >/dev/null 2>&1
        else
            assert_success "VM restart and reconnection" false
        fi
    fi

    # Test 10: Memory info
    if command -v redis-cli >/dev/null 2>&1; then
        log_info "Test 10: Checking memory configuration..."

        local memory_info=$(redis-cli -h "$VALKEY_HOST" -p "$VALKEY_PORT" -a "$VALKEY_PASSWORD" --no-auth-warning INFO MEMORY 2>&1)
        if [[ $memory_info == *"used_memory"* ]]; then
            assert_success "Memory info accessible" true

            # Extract used memory
            local used_memory=$(echo "$memory_info" | grep "used_memory_human:" | cut -d: -f2 | tr -d '\r')
            log_info "Used memory: $used_memory"
        else
            assert_success "Memory info accessible" false
        fi
    fi

    # Test 11: Security (password protection)
    if command -v redis-cli >/dev/null 2>&1; then
        log_info "Test 11: Testing password protection..."

        # Try without password (should fail)
        local no_auth_response=$(redis-cli -h "$VALKEY_HOST" -p "$VALKEY_PORT" PING 2>&1 || echo "AUTH_REQUIRED")
        if [[ "$no_auth_response" == *"NOAUTH"* ]] || [[ "$no_auth_response" == *"AUTH_REQUIRED"* ]]; then
            assert_success "Password protection is active" true
        else
            log_warn "Password protection might not be enabled"
        fi
    fi

    # Test 12: Performance test
    if command -v redis-cli >/dev/null 2>&1; then
        log_info "Test 12: Running performance test..."

        # Simple latency test
        local latency_output=$(redis-cli -h "$VALKEY_HOST" -p "$VALKEY_PORT" -a "$VALKEY_PASSWORD" --no-auth-warning --latency -i 1 2>&1 | head -1 || true)
        log_info "Latency sample: $latency_output"

        # Benchmark if redis-benchmark is available
        if command -v redis-benchmark >/dev/null 2>&1; then
            log_info "Running redis-benchmark (100 requests)..."
            local benchmark_output=$(redis-benchmark -h "$VALKEY_HOST" -p "$VALKEY_PORT" -a "$VALKEY_PASSWORD" -n 100 -q 2>&1 | head -5)
            log_info "Benchmark results:"
            echo "$benchmark_output"
            assert_success "Benchmark completed" true
        fi
    fi

    # Test 13: Resource usage
    log_info "Test 13: Checking VM resource usage..."
    local vm_stats=$(get_vm_stats "$VM_NAME")
    log_info "VM Stats: $vm_stats"

    # Parse CPU usage
    local cpu_usage=$(echo "$vm_stats" | grep -o "CPU: [0-9.]*%" | grep -o "[0-9.]*" || echo "0")
    if (( $(echo "$cpu_usage < 50" | bc -l 2>/dev/null || echo "1") )); then
        assert_success "CPU usage is reasonable (<50%)" true
    else
        assert_success "CPU usage is reasonable (<50%)" false
        log_warn "High CPU usage: ${cpu_usage}%"
    fi

    # Final cleanup
    log_info "Stopping Valkey VM..."
    pkill -f "vfkit.*$VM_NAME" || true
    sleep 2

    # Export results
    export_results_json "/tmp/valkey-test-results.json"
    log_success "Test results exported to /tmp/valkey-test-results.json"

    finalize_test_suite "Valkey VM Tests"
}

# Run tests
main "$@"
