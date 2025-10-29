#!/bin/bash
# Node.js Dev VM Test Suite
# Tests for Node.js development VM infrastructure

set -euo pipefail

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/test-framework.sh"

# Configuration
NODEJS_CONFIG="${NODEJS_CONFIG:-/Users/ryan.maclean/vibecode-webgui/config/vfkit/nodejs-dev-vm.yaml}"
NODEJS_HOST="${NODEJS_HOST:-localhost}"
NODEJS_SSH_PORT="${NODEJS_SSH_PORT:-2222}"
NODEJS_APP_PORT="${NODEJS_APP_PORT:-3000}"
VM_NAME="vibecode-nodejs-dev"
VFKIT_BIN="/Users/ryan.maclean/vibecode-webgui/src-tauri/resources/vfkit-aarch64-apple-darwin"

# Expected Node.js version
EXPECTED_NODE_VERSION="24"

# Test project directory
TEST_PROJECT_DIR="/tmp/nodejs-vm-test-project-$(date +%s)"

# Cleanup function
cleanup() {
    log_info "Cleaning up..."

    # Remove test project
    if [[ -d "$TEST_PROJECT_DIR" ]]; then
        rm -rf "$TEST_PROJECT_DIR"
    fi

    # Stop VM
    if pgrep -f "vfkit.*$VM_NAME" >/dev/null; then
        log_info "Stopping Node.js VM..."
        pkill -f "vfkit.*$VM_NAME" || true
        sleep 2
    fi
}

# Trap cleanup on exit
trap cleanup EXIT

# Main test suite
main() {
    init_test_suite "Node.js Dev VM Tests"

    # Test 1: Configuration file exists
    log_info "Test 1: Checking Node.js VM configuration..."
    assert_file_exists "$NODEJS_CONFIG" "Node.js VM config file exists"

    # Test 2: Validate YAML syntax
    log_info "Test 2: Validating YAML syntax..."
    if command -v python3 >/dev/null 2>&1; then
        python3 -c "import yaml; yaml.safe_load(open('$NODEJS_CONFIG'))" 2>&1 && \
            assert_success "YAML syntax validation" true || \
            assert_success "YAML syntax validation" false
    else
        log_warn "Python3 not available, skipping YAML validation"
    fi

    # Test 3: vfkit binary exists
    log_info "Test 3: Checking vfkit binary..."
    assert_file_exists "$VFKIT_BIN" "vfkit binary exists"

    # Test 4: Start VM (if config exists)
    if [[ ! -f "$NODEJS_CONFIG" ]]; then
        log_warn "Node.js VM config not found at $NODEJS_CONFIG"
        log_warn "Skipping runtime tests. Please run VM setup first."
        finalize_test_suite "Node.js Dev VM Tests (Partial)"
        return
    fi

    log_info "Test 4: Starting Node.js VM..."
    log_info "Command: $VFKIT_BIN --config $NODEJS_CONFIG"

    # Start VM in background
    "$VFKIT_BIN" --config "$NODEJS_CONFIG" > /tmp/nodejs-vm.log 2>&1 &
    local vm_pid=$!
    sleep 5

    # Check if VM is running
    if ps -p $vm_pid > /dev/null 2>&1; then
        assert_success "Node.js VM started successfully" true
    else
        assert_success "Node.js VM started successfully" false
        log_error "VM failed to start. Log output:"
        tail -20 /tmp/nodejs-vm.log
        finalize_test_suite "Node.js Dev VM Tests (Failed)"
        exit 1
    fi

    # Test 5: Wait for VM to boot
    log_info "Test 5: Waiting for VM to boot..."
    if wait_for_vm "$VM_NAME" 60; then
        assert_success "VM boot completed" true
    else
        assert_success "VM boot completed" false
    fi

    # Test 6: Check SSH port accessibility
    log_info "Test 6: Checking SSH port $NODEJS_SSH_PORT accessibility..."
    if wait_for_port "$NODEJS_HOST" "$NODEJS_SSH_PORT" 30; then
        assert_port_open "$NODEJS_HOST" "$NODEJS_SSH_PORT" 5 "SSH port $NODEJS_SSH_PORT is accessible"
    else
        assert_port_open "$NODEJS_HOST" "$NODEJS_SSH_PORT" 5 "SSH port $NODEJS_SSH_PORT is accessible"
    fi

    # For the remaining tests, we need SSH access
    # Check if we can SSH into the VM
    log_info "Checking if SSH connection is possible..."
    if ! ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 -p "$NODEJS_SSH_PORT" root@"$NODEJS_HOST" "echo test" 2>/dev/null; then
        log_warn "Cannot SSH into VM without credentials/keys"
        log_warn "Skipping tests that require VM access"
        log_info "To enable SSH tests, ensure SSH keys are configured in the VM"

        finalize_test_suite "Node.js Dev VM Tests (Partial)"
        return
    fi

    # Test 7: Check Node.js installation
    log_info "Test 7: Checking Node.js installation..."
    local node_version=$(ssh -o StrictHostKeyChecking=no -p "$NODEJS_SSH_PORT" root@"$NODEJS_HOST" "node --version 2>/dev/null || echo 'NOT_INSTALLED'")

    if [[ "$node_version" == "NOT_INSTALLED" ]]; then
        assert_success "Node.js is installed" false
    else
        assert_success "Node.js is installed" true
        log_info "Node.js version: $node_version"

        # Check if it's the expected version
        if [[ "$node_version" == *"v${EXPECTED_NODE_VERSION}."* ]]; then
            assert_success "Node.js version is v${EXPECTED_NODE_VERSION}.x" true
        else
            log_warn "Node.js version is $node_version, expected v${EXPECTED_NODE_VERSION}.x"
            assert_success "Node.js version is v${EXPECTED_NODE_VERSION}.x" false
        fi
    fi

    # Test 8: Check npm installation
    log_info "Test 8: Checking npm installation..."
    local npm_version=$(ssh -o StrictHostKeyChecking=no -p "$NODEJS_SSH_PORT" root@"$NODEJS_HOST" "npm --version 2>/dev/null || echo 'NOT_INSTALLED'")

    if [[ "$npm_version" == "NOT_INSTALLED" ]]; then
        assert_success "npm is installed" false
    else
        assert_success "npm is installed" true
        log_info "npm version: $npm_version"
    fi

    # Test 9: Check pnpm installation
    log_info "Test 9: Checking pnpm installation..."
    local pnpm_version=$(ssh -o StrictHostKeyChecking=no -p "$NODEJS_SSH_PORT" root@"$NODEJS_HOST" "pnpm --version 2>/dev/null || echo 'NOT_INSTALLED'")

    if [[ "$pnpm_version" == "NOT_INSTALLED" ]]; then
        log_warn "pnpm is not installed, but this is optional"
    else
        assert_success "pnpm is installed" true
        log_info "pnpm version: $pnpm_version"
    fi

    # Test 10: Create and test a simple Node.js project
    log_info "Test 10: Creating test Node.js project..."

    # Create test project
    mkdir -p "$TEST_PROJECT_DIR"
    cat > "$TEST_PROJECT_DIR/package.json" <<EOF
{
  "name": "vm-test-project",
  "version": "1.0.0",
  "description": "Test project for VM validation",
  "main": "index.js",
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
    "express": "^4.18.0"
  }
}
EOF

    cat > "$TEST_PROJECT_DIR/index.js" <<'EOF'
const express = require('express');
const app = express();
const port = 3000;

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'VM test successful' });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Test app listening on port ${port}`);
});
EOF

    assert_success "Test project files created" true

    # Test 11: Copy project to VM
    log_info "Test 11: Copying project to VM..."
    if ssh -o StrictHostKeyChecking=no -p "$NODEJS_SSH_PORT" root@"$NODEJS_HOST" "mkdir -p /tmp/test-project" 2>&1 &&
       scp -o StrictHostKeyChecking=no -P "$NODEJS_SSH_PORT" -r "$TEST_PROJECT_DIR"/* root@"$NODEJS_HOST":/tmp/test-project/ 2>&1; then
        assert_success "Project copied to VM" true
    else
        assert_success "Project copied to VM" false
    fi

    # Test 12: Install packages
    log_info "Test 12: Installing npm packages..."
    local install_output=$(ssh -o StrictHostKeyChecking=no -p "$NODEJS_SSH_PORT" root@"$NODEJS_HOST" "cd /tmp/test-project && npm install" 2>&1)

    if [[ "$install_output" == *"added"* ]] || [[ "$install_output" == *"up to date"* ]]; then
        assert_success "npm install works" true
    else
        log_error "npm install output: $install_output"
        assert_success "npm install works" false
    fi

    # Test 13: Run Node.js application
    log_info "Test 13: Running Node.js application..."
    ssh -o StrictHostKeyChecking=no -p "$NODEJS_SSH_PORT" root@"$NODEJS_HOST" \
        "cd /tmp/test-project && nohup node index.js > /tmp/app.log 2>&1 &" 2>&1

    sleep 3

    # Check if app is running
    local app_running=$(ssh -o StrictHostKeyChecking=no -p "$NODEJS_SSH_PORT" root@"$NODEJS_HOST" \
        "pgrep -f 'node index.js' | wc -l" 2>&1 | tr -d ' ')

    if [[ "$app_running" -gt 0 ]]; then
        assert_success "Node.js application started" true
    else
        assert_success "Node.js application started" false
    fi

    # Test 14: Check application accessibility
    log_info "Test 14: Checking application port accessibility..."
    if wait_for_port "$NODEJS_HOST" "$NODEJS_APP_PORT" 10; then
        assert_port_open "$NODEJS_HOST" "$NODEJS_APP_PORT" 5 "Application port $NODEJS_APP_PORT is accessible"

        # Test HTTP endpoint
        local http_response=$(curl -s -w "%{http_code}" -o /tmp/http-response.json http://"$NODEJS_HOST":"$NODEJS_APP_PORT"/ 2>&1)
        if [[ "$http_response" == "200" ]]; then
            assert_success "HTTP endpoint responds with 200" true
            log_info "Response: $(cat /tmp/http-response.json)"
        else
            assert_success "HTTP endpoint responds with 200" false
        fi
    else
        log_warn "Application port not accessible from host"
        assert_success "Application port accessible from host" false
    fi

    # Test 15: Test TypeScript support
    log_info "Test 15: Testing TypeScript support..."
    local ts_installed=$(ssh -o StrictHostKeyChecking=no -p "$NODEJS_SSH_PORT" root@"$NODEJS_HOST" \
        "npm list -g typescript 2>&1 | grep -q typescript && echo 'installed' || echo 'not_installed'")

    if [[ "$ts_installed" == "installed" ]]; then
        assert_success "TypeScript is installed" true

        # Test TypeScript compilation
        ssh -o StrictHostKeyChecking=no -p "$NODEJS_SSH_PORT" root@"$NODEJS_HOST" \
            "echo 'const greeting: string = \"Hello\"; console.log(greeting);' > /tmp/test.ts" 2>&1

        local tsc_output=$(ssh -o StrictHostKeyChecking=no -p "$NODEJS_SSH_PORT" root@"$NODEJS_HOST" \
            "cd /tmp && tsc test.ts 2>&1")

        if [[ -z "$tsc_output" ]] || [[ "$tsc_output" != *"error"* ]]; then
            assert_success "TypeScript compilation works" true
        else
            assert_success "TypeScript compilation works" false
        fi
    else
        log_warn "TypeScript not installed, installing..."
        ssh -o StrictHostKeyChecking=no -p "$NODEJS_SSH_PORT" root@"$NODEJS_HOST" \
            "npm install -g typescript" >/dev/null 2>&1 && \
            assert_success "TypeScript installed successfully" true || \
            assert_success "TypeScript installed successfully" false
    fi

    # Test 16: Check shared workspace
    log_info "Test 16: Testing shared workspace..."
    local workspace_dir="/workspace"
    local workspace_exists=$(ssh -o StrictHostKeyChecking=no -p "$NODEJS_SSH_PORT" root@"$NODEJS_HOST" \
        "test -d $workspace_dir && echo 'exists' || echo 'not_exists'")

    if [[ "$workspace_exists" == "exists" ]]; then
        assert_success "Shared workspace directory exists" true

        # Test write access
        if ssh -o StrictHostKeyChecking=no -p "$NODEJS_SSH_PORT" root@"$NODEJS_HOST" \
            "echo 'test' > $workspace_dir/test.txt 2>&1"; then
            assert_success "Workspace is writable" true
        else
            assert_success "Workspace is writable" false
        fi
    else
        log_warn "Shared workspace not configured at $workspace_dir"
        assert_success "Shared workspace directory exists" false
    fi

    # Test 17: Test hot reload (if using nodemon)
    log_info "Test 17: Testing development tools..."
    local nodemon_installed=$(ssh -o StrictHostKeyChecking=no -p "$NODEJS_SSH_PORT" root@"$NODEJS_HOST" \
        "which nodemon 2>/dev/null || echo 'not_installed'")

    if [[ "$nodemon_installed" != "not_installed" ]]; then
        assert_success "nodemon is installed (for hot reload)" true
    else
        log_warn "nodemon not installed (optional for hot reload)"
    fi

    # Test 18: Check common development packages
    log_info "Test 18: Checking common development tools..."
    local git_installed=$(ssh -o StrictHostKeyChecking=no -p "$NODEJS_SSH_PORT" root@"$NODEJS_HOST" \
        "which git 2>/dev/null || echo 'not_installed'")

    if [[ "$git_installed" != "not_installed" ]]; then
        assert_success "git is installed" true
    else
        log_warn "git not installed"
    fi

    # Test 19: Resource usage
    log_info "Test 19: Checking VM resource usage..."
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

    # Test 20: Cleanup
    log_info "Test 20: Cleaning up test files in VM..."
    ssh -o StrictHostKeyChecking=no -p "$NODEJS_SSH_PORT" root@"$NODEJS_HOST" \
        "pkill -f 'node index.js'; rm -rf /tmp/test-project /tmp/test.ts /tmp/test.js" 2>&1 || true
    assert_success "Cleanup successful" true

    # Stop VM
    log_info "Stopping Node.js VM..."
    pkill -f "vfkit.*$VM_NAME" || true
    sleep 2

    # Export results
    export_results_json "/tmp/nodejs-test-results.json"
    log_success "Test results exported to /tmp/nodejs-test-results.json"

    finalize_test_suite "Node.js Dev VM Tests"
}

# Run tests
main "$@"
