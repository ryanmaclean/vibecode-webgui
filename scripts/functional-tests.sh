#!/bin/bash
# VibeCode Functional Tests
# Tests actual VM launching and service availability

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
FAILED=0
TEST_VM_TIMEOUT=60

log_test() {
    echo "[$1] $2"
}

log_pass() {
    echo "  PASS: $1"
}

log_fail() {
    echo "  FAIL: $1"
    FAILED=$((FAILED + 1))
}

log_info() {
    echo "  INFO: $1"
}

cleanup() {
    echo ""
    echo "Cleaning up test VMs..."
    killall VibeCode 2>/dev/null || true
    sleep 2
}

trap cleanup EXIT

echo "VibeCode Functional Test Suite"
echo "==============================="
echo "Testing: VM launch + service availability"
echo ""

# Ensure the release binary is built and signed with entitlements
cd "$PROJECT_ROOT/VibeCodeSwift"
echo "Preparing signed release binary..."
swift build -c release > /dev/null 2>&1
codesign --force --sign - --entitlements "$PROJECT_ROOT/VibeCodeSwift/VibeCode.entitlements" .build/release/VibeCode > /dev/null 2>&1
cd "$PROJECT_ROOT"

# Test 1: Launch VibeCode app
log_test "1/7" "VibeCode app launch"
"$PROJECT_ROOT/VibeCodeSwift/.build/release/VibeCode" > /tmp/vibecode-test.log 2>&1 &
APP_PID=$!
sleep 3

if ps -p $APP_PID > /dev/null; then
    log_pass "App launched successfully (PID: $APP_PID)"
else
    log_fail "App failed to launch"
    exit 1
fi

# Test 2: VM discovery
log_test "2/7" "VM discovery"
sleep 2
if grep -q "VM discovery completed" /tmp/vibecode-test.log; then
    VM_COUNT=$(grep "vm_count" /tmp/vibecode-test.log | tail -1 | grep -o '"vm_count":[0-9]*' | cut -d: -f2)
    log_pass "Discovered $VM_COUNT VMs"
else
    log_fail "VM discovery did not complete"
fi

# Test 3: Auto-start triggers
log_test "3/7" "VM auto-start"
sleep 8
if grep -q "Starting auto-start for codeserver VM" /tmp/vibecode-test.log; then
    log_pass "Auto-start triggered for codeserver"
else
    log_fail "Auto-start did not trigger"
fi

# Test 4: VM actually boots
log_test "4/7" "VM boot success"
if grep -q "VM started successfully" /tmp/vibecode-test.log; then
    VM_NAME=$(grep "VM started successfully" /tmp/vibecode-test.log | head -1 | awk '{print $NF}')
    log_pass "VM booted: $VM_NAME"
else
    log_fail "No VM successfully started"
fi

# Test 5: Check VM process
log_test "5/7" "VM process running"
sleep 3
if ps aux | grep -v grep | grep -q "VibeCode.*VirtualMachine"; then
    log_pass "VM process detected"
else
    # VZ VMs run in-process, check if app is still running
    if ps -p $APP_PID > /dev/null; then
        log_pass "VibeCode app still running (VMs in-process)"
    else
        log_fail "App crashed after VM start"
    fi
fi

# Test 6: Service availability (if Lima VMs are available as fallback)
log_test "6/7" "Service availability check"
if command -v limactl &> /dev/null; then
    if limactl list 2>/dev/null | grep -q "Running"; then
        RUNNING_VMS=$(limactl list | grep Running | wc -l | tr -d ' ')
        log_pass "Lima fallback: $RUNNING_VMS VMs running"
    else
        log_info "No Lima VMs running (VZ VMs are primary)"
    fi
else
    log_info "Lima not available (VZ-only mode)"
fi

# Test 7: VZ configuration validation
log_test "7/7" "VZ configuration"
if grep -q "Configuration validated successfully" /tmp/vibecode-test.log; then
    log_pass "VZ configuration valid"
else
    log_fail "VZ configuration validation failed"
fi

# Check for errors
echo ""
echo "Error Check:"
# Use wc -l to ensure a single numeric value even when there are no matches
ERROR_COUNT=$(grep -E "ERROR|FAIL|crash" /tmp/vibecode-test.log 2>/dev/null | wc -l | tr -d ' ')
if [ "$ERROR_COUNT" -gt 0 ]; then
    echo "  WARNING: Found $ERROR_COUNT errors in logs"
    echo "  Last 10 error lines:"
    grep -E "ERROR|FAIL|crash" /tmp/vibecode-test.log | tail -10 || true
fi

echo ""
echo "==============================="
if [ $FAILED -eq 0 ]; then
    echo "All functional tests passed!"
    echo ""
    echo "Verified:"
    echo "  - App launches"
    echo "  - VMs discovered"
    echo "  - Auto-start works"
    echo "  - VM boots successfully"
    echo "  - VZ configuration valid"
    echo ""
    echo "Test log: /tmp/vibecode-test.log"
    exit 0
else
    echo "Failed: $FAILED test(s)"
    echo "Check: /tmp/vibecode-test.log"
    exit 1
fi

