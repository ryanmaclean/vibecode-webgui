#!/bin/bash
# VM Integration Test Suite
# Tests all VMs working together as a complete system

set -euo pipefail

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/test-framework.sh"

# Configuration
VALKEY_CONFIG="/Users/ryan.maclean/vibecode-webgui/config/vfkit/valkey-vm.yaml"
PG_CONFIG="/Users/ryan.maclean/vibecode-webgui/config/vfkit/postgresql-vm.yaml"
NODEJS_CONFIG="/Users/ryan.maclean/vibecode-webgui/config/vfkit/nodejs-dev-vm.yaml"

VALKEY_HOST="localhost"
VALKEY_PORT="6379"
VALKEY_PASSWORD="vibecode123"

PG_HOST="localhost"
PG_PORT="5432"
PG_USER="vibecode"
PG_PASSWORD="vibecode123"
PG_DATABASE="vibecode"

NODEJS_HOST="localhost"
NODEJS_SSH_PORT="2222"
NODEJS_APP_PORT="3000"

VFKIT_BIN="/Users/ryan.maclean/vibecode-webgui/src-tauri/resources/vfkit-aarch64-apple-darwin"

# VM PIDs (using indexed arrays for bash 3.2 compatibility)
VM_PID_NAMES=()
VM_PID_VALUES=()

# Cleanup function
cleanup() {
    log_info "Cleaning up all VMs..."

    for ((i=0; i<${#VM_PID_NAMES[@]}; i++)); do
        vm_name="${VM_PID_NAMES[$i]}"
        pid="${VM_PID_VALUES[$i]}"
        if ps -p "$pid" > /dev/null 2>&1; then
            log_info "Stopping $vm_name (PID: $pid)..."
            kill "$pid" 2>/dev/null || true
        fi
    done

    # Additional cleanup
    pkill -f "vfkit.*vibecode-valkey" 2>/dev/null || true
    pkill -f "vfkit.*vibecode-postgresql" 2>/dev/null || true
    pkill -f "vfkit.*vibecode-nodejs-dev" 2>/dev/null || true

    sleep 2
}

# Trap cleanup on exit
trap cleanup EXIT

# Start a VM
start_vm() {
    local config_file="$1"
    local vm_name="$2"
    local log_file="/tmp/${vm_name}.log"

    log_info "Starting $vm_name..."

    if [[ ! -f "$config_file" ]]; then
        log_error "Config file not found: $config_file"
        return 1
    fi

    "$VFKIT_BIN" --config "$config_file" > "$log_file" 2>&1 &
    local pid=$!
    VM_PID_NAMES+=("$vm_name")
    VM_PID_VALUES+=($pid)

    sleep 3

    if ps -p $pid > /dev/null 2>&1; then
        log_success "$vm_name started (PID: $pid)"
        return 0
    else
        log_error "$vm_name failed to start. Log:"
        tail -20 "$log_file"
        return 1
    fi
}

# Main test suite
main() {
    init_test_suite "VM Integration Tests"

    # Test 1: Check all configuration files exist
    log_info "Test 1: Checking all VM configurations..."
    local configs_found=0

    if [[ -f "$VALKEY_CONFIG" ]]; then
        configs_found=$((configs_found + 1))
        log_success "Valkey config found"
    else
        log_warn "Valkey config not found at $VALKEY_CONFIG"
    fi

    if [[ -f "$PG_CONFIG" ]]; then
        configs_found=$((configs_found + 1))
        log_success "PostgreSQL config found"
    else
        log_warn "PostgreSQL config not found at $PG_CONFIG"
    fi

    if [[ -f "$NODEJS_CONFIG" ]]; then
        configs_found=$((configs_found + 1))
        log_success "Node.js config found"
    else
        log_warn "Node.js config not found at $NODEJS_CONFIG"
    fi

    if [[ $configs_found -lt 3 ]]; then
        log_error "Not all VM configurations are present. Found $configs_found/3"
        log_error "Please ensure all VMs are configured before running integration tests."
        finalize_test_suite "VM Integration Tests (Incomplete Setup)"
        exit 1
    fi

    assert_equals "3" "$configs_found" "All VM configurations exist"

    # Test 2: Start all VMs
    log_info "Test 2: Starting all VMs..."

    local start_success=0

    if start_vm "$VALKEY_CONFIG" "vibecode-valkey"; then
        start_success=$((start_success + 1))
    fi

    if start_vm "$PG_CONFIG" "vibecode-postgresql"; then
        start_success=$((start_success + 1))
    fi

    if start_vm "$NODEJS_CONFIG" "vibecode-nodejs-dev"; then
        start_success=$((start_success + 1))
    fi

    assert_equals "3" "$start_success" "All VMs started successfully"

    # Test 3: Wait for all VMs to boot
    log_info "Test 3: Waiting for all VMs to boot..."

    wait_for_vm "vibecode-valkey" 60 && log_success "Valkey VM booted" || log_error "Valkey VM boot timeout"
    wait_for_vm "vibecode-postgresql" 60 && log_success "PostgreSQL VM booted" || log_error "PostgreSQL VM boot timeout"
    wait_for_vm "vibecode-nodejs-dev" 60 && log_success "Node.js VM booted" || log_error "Node.js VM boot timeout"

    sleep 10  # Give services time to initialize

    # Test 4: Check port conflicts
    log_info "Test 4: Checking for port conflicts..."

    local ports_ok=true
    if ! netstat -an | grep -q "LISTEN.*[.:]${VALKEY_PORT}"; then
        log_warn "Valkey port $VALKEY_PORT not listening"
        ports_ok=false
    fi

    if ! netstat -an | grep -q "LISTEN.*[.:]${PG_PORT}"; then
        log_warn "PostgreSQL port $PG_PORT not listening"
        ports_ok=false
    fi

    if ! netstat -an | grep -q "LISTEN.*[.:]${NODEJS_SSH_PORT}"; then
        log_warn "Node.js SSH port $NODEJS_SSH_PORT not listening"
        ports_ok=false
    fi

    if $ports_ok; then
        assert_success "No port conflicts detected" true
    else
        assert_success "No port conflicts detected" false
    fi

    # Test 5: Check all services are accessible
    log_info "Test 5: Checking all services are accessible..."

    assert_port_open "$VALKEY_HOST" "$VALKEY_PORT" 5 "Valkey service accessible"
    assert_port_open "$PG_HOST" "$PG_PORT" 5 "PostgreSQL service accessible"
    assert_port_open "$NODEJS_HOST" "$NODEJS_SSH_PORT" 5 "Node.js SSH accessible"

    # Test 6: Test inter-service communication
    if command -v redis-cli >/dev/null 2>&1 && command -v psql >/dev/null 2>&1; then
        log_info "Test 6: Testing inter-service communication..."

        # Store data in Valkey
        local session_key="session:test:$(date +%s)"
        local session_data="integration_test_session"
        redis-cli -h "$VALKEY_HOST" -p "$VALKEY_PORT" -a "$VALKEY_PASSWORD" --no-auth-warning \
            SET "$session_key" "$session_data" >/dev/null 2>&1

        # Store data in PostgreSQL
        PGPASSWORD="$PG_PASSWORD" psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DATABASE" \
            -c "CREATE TABLE IF NOT EXISTS integration_test (id SERIAL PRIMARY KEY, data TEXT, created_at TIMESTAMP DEFAULT NOW());" 2>&1 >/dev/null

        PGPASSWORD="$PG_PASSWORD" psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DATABASE" \
            -c "INSERT INTO integration_test (data) VALUES ('integration_test_data');" 2>&1 >/dev/null

        # Verify data
        local valkey_result=$(redis-cli -h "$VALKEY_HOST" -p "$VALKEY_PORT" -a "$VALKEY_PASSWORD" --no-auth-warning \
            GET "$session_key" 2>&1)

        local pg_result=$(PGPASSWORD="$PG_PASSWORD" psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DATABASE" \
            -t -c "SELECT COUNT(*) FROM integration_test WHERE data='integration_test_data';" 2>&1 | tr -d ' ')

        if [[ "$valkey_result" == "$session_data" ]] && [[ "$pg_result" == "1" ]]; then
            assert_success "Inter-service data storage and retrieval" true
        else
            assert_success "Inter-service data storage and retrieval" false
        fi

        # Cleanup
        redis-cli -h "$VALKEY_HOST" -p "$VALKEY_PORT" -a "$VALKEY_PASSWORD" --no-auth-warning \
            DEL "$session_key" >/dev/null 2>&1
        PGPASSWORD="$PG_PASSWORD" psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DATABASE" \
            -c "DROP TABLE IF EXISTS integration_test;" 2>&1 >/dev/null
    else
        log_warn "redis-cli or psql not installed, skipping inter-service tests"
    fi

    # Test 7: Test application can connect to all services
    log_info "Test 7: Testing application connectivity to all services..."

    # Create a test Node.js app that connects to both Valkey and PostgreSQL
    local test_app_dir="/tmp/integration-test-app-$(date +%s)"
    mkdir -p "$test_app_dir"

    cat > "$test_app_dir/package.json" <<EOF
{
  "name": "integration-test-app",
  "version": "1.0.0",
  "dependencies": {
    "redis": "^4.6.0",
    "pg": "^8.11.0",
    "express": "^4.18.0"
  }
}
EOF

    cat > "$test_app_dir/test.js" <<EOF
const redis = require('redis');
const { Pool } = require('pg');
const express = require('express');

const app = express();

// Redis client
const redisClient = redis.createClient({
  socket: { host: '$VALKEY_HOST', port: $VALKEY_PORT },
  password: '$VALKEY_PASSWORD'
});

// PostgreSQL client
const pgPool = new Pool({
  host: '$PG_HOST',
  port: $PG_PORT,
  user: '$PG_USER',
  password: '$PG_PASSWORD',
  database: '$PG_DATABASE'
});

app.get('/health', async (req, res) => {
  try {
    // Test Redis
    await redisClient.connect();
    await redisClient.ping();
    await redisClient.disconnect();

    // Test PostgreSQL
    const pgResult = await pgPool.query('SELECT NOW()');

    res.json({
      status: 'ok',
      redis: 'connected',
      postgresql: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

app.listen(3100, () => {
  console.log('Integration test app running on port 3100');
});
EOF

    log_info "Installing test app dependencies (this may take a minute)..."
    cd "$test_app_dir" && npm install --silent >/dev/null 2>&1

    if [[ $? -eq 0 ]]; then
        log_success "Test app dependencies installed"

        # Run the test app
        node test.js > /tmp/integration-app.log 2>&1 &
        local app_pid=$!
        sleep 5

        if wait_for_port "localhost" "3100" 10; then
            local health_response=$(curl -s http://localhost:3100/health 2>&1)

            if [[ "$health_response" == *"\"status\":\"ok\""* ]]; then
                assert_success "Application can connect to all services" true
                log_info "Health check response: $health_response"
            else
                assert_success "Application can connect to all services" false
                log_error "Health check response: $health_response"
            fi

            kill $app_pid 2>/dev/null || true
        else
            assert_success "Test application started" false
        fi
    else
        log_warn "Failed to install test app dependencies, skipping app connectivity test"
    fi

    rm -rf "$test_app_dir"

    # Test 8: Resource usage of all VMs
    log_info "Test 8: Checking total resource usage..."

    local total_cpu=0
    local total_mem=0

    for vm_name in vibecode-valkey vibecode-postgresql vibecode-nodejs-dev; do
        local stats=$(get_vm_stats "$vm_name" 2>/dev/null || echo "CPU: 0% | MEM: 0% | RSS: 0MB")
        log_info "$vm_name: $stats"

        local cpu=$(echo "$stats" | grep -o "CPU: [0-9.]*%" | grep -o "[0-9.]*" || echo "0")
        local mem=$(echo "$stats" | grep -o "RSS: [0-9.]*MB" | grep -o "[0-9.]*" || echo "0")

        total_cpu=$(echo "$total_cpu + $cpu" | bc 2>/dev/null || echo "0")
        total_mem=$(echo "$total_mem + $mem" | bc 2>/dev/null || echo "0")
    done

    log_info "Total CPU usage: ${total_cpu}%"
    log_info "Total Memory usage: ${total_mem}MB"

    # Check if resource usage is reasonable
    if (( $(echo "$total_cpu < 150" | bc -l 2>/dev/null || echo "1") )); then
        assert_success "Total CPU usage reasonable (<150%)" true
    else
        assert_success "Total CPU usage reasonable (<150%)" false
        log_warn "High total CPU usage: ${total_cpu}%"
    fi

    if (( $(echo "$total_mem < 8192" | bc -l 2>/dev/null || echo "1") )); then
        assert_success "Total memory usage reasonable (<8GB)" true
    else
        assert_success "Total memory usage reasonable (<8GB)" false
        log_warn "High total memory usage: ${total_mem}MB"
    fi

    # Test 9: Simultaneous operations
    log_info "Test 9: Testing simultaneous operations across all VMs..."

    if command -v redis-cli >/dev/null 2>&1 && command -v psql >/dev/null 2>&1; then
        # Perform operations in parallel
        (
            for i in {1..10}; do
                redis-cli -h "$VALKEY_HOST" -p "$VALKEY_PORT" -a "$VALKEY_PASSWORD" --no-auth-warning \
                    SET "parallel:test:$i" "value$i" >/dev/null 2>&1
            done
        ) &

        (
            for i in {1..10}; do
                PGPASSWORD="$PG_PASSWORD" psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DATABASE" \
                    -c "SELECT NOW();" >/dev/null 2>&1
            done
        ) &

        wait

        assert_success "Simultaneous operations completed" true

        # Cleanup
        for i in {1..10}; do
            redis-cli -h "$VALKEY_HOST" -p "$VALKEY_PORT" -a "$VALKEY_PASSWORD" --no-auth-warning \
                DEL "parallel:test:$i" >/dev/null 2>&1
        done
    fi

    # Test 10: VM stability check
    log_info "Test 10: Checking VM stability..."

    sleep 5

    local stable_count=0
    for vm_name in vibecode-valkey vibecode-postgresql vibecode-nodejs-dev; do
        if pgrep -f "vfkit.*$vm_name" >/dev/null; then
            stable_count=$((stable_count + 1))
        else
            log_error "$vm_name is not running!"
        fi
    done

    if [[ $stable_count -eq 3 ]]; then
        assert_success "All VMs remain stable" true
    else
        assert_success "All VMs remain stable" false
        log_error "Only $stable_count/3 VMs are stable"
    fi

    # Export results
    export_results_json "/tmp/integration-test-results.json"
    log_success "Test results exported to /tmp/integration-test-results.json"

    # Cleanup
    cleanup

    finalize_test_suite "VM Integration Tests"
}

# Run tests
main "$@"
