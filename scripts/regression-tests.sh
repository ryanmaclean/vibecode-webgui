#!/bin/bash
# VibeCode Regression Test Suite
# Run before commits to ensure no functionality breaks

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
FAILED=0

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

echo "VibeCode Regression Test Suite"
echo "==============================="
echo ""

# Test 1: Swift build (release)
log_test "1/8" "Release build"
if (cd "$PROJECT_ROOT/VibeCodeSwift" && swift build -c release) > /dev/null 2>&1; then
    log_pass "Release build successful"
else
    log_fail "Release build failed"
fi

# Test 2: Swift build (debug)
log_test "2/8" "Debug build"
if (cd "$PROJECT_ROOT/VibeCodeSwift" && swift build -c debug) > /dev/null 2>&1; then
    log_pass "Debug build successful"
else
    log_fail "Debug build failed"
fi

# Test 3: VM images present
log_test "3/8" "VM images"
VM_COUNT=$(ls "$PROJECT_ROOT/dist/vm-images"/*.img 2>/dev/null | wc -l | tr -d ' ')
if [ "$VM_COUNT" -ge 6 ]; then
    log_pass "Found $VM_COUNT VM images"
else
    log_fail "Expected 6+ VMs, found $VM_COUNT"
fi

# Test 4: EFI NVRAM files
log_test "4/8" "EFI NVRAM files"
EFI_COUNT=$(ls "$PROJECT_ROOT/dist/vm-images"/*-efi.nvram 2>/dev/null | wc -l | tr -d ' ')
if [ "$EFI_COUNT" -ge 6 ]; then
    log_pass "Found $EFI_COUNT EFI stores"
else
    log_fail "Expected 6+ NVRAM files, found $EFI_COUNT"
fi

# Test 5: Entitlements
log_test "5/8" "Entitlements"
if grep -q "com.apple.security.virtualization" "$PROJECT_ROOT/VibeCodeSwift/VibeCode.entitlements"; then
    log_pass "Virtualization entitlement present"
else
    log_fail "Missing virtualization entitlement"
fi

# Test 6: Launch script
log_test "6/8" "Launch script"
if [ -x "$PROJECT_ROOT/scripts/launch-vibecode.sh" ]; then
    log_pass "Launch script executable"
else
    log_fail "Launch script missing or not executable"
fi

# Test 7: Datadog integration
log_test "7/8" "Datadog integration"
if [ -f "$PROJECT_ROOT/scripts/run-with-secure-datadog-key.sh" ]; then
    log_pass "Datadog scripts present"
else
    log_fail "Datadog integration missing"
fi

# Test 8: VM discovery (quick app start)
log_test "8/8" "VM discovery"
killall VibeCode 2>/dev/null || true
timeout 5 "$PROJECT_ROOT/VibeCodeSwift/.build/release/VibeCode" 2>&1 | grep -q "VM discovery" &
TEST_PID=$!
sleep 2
kill $TEST_PID 2>/dev/null || true
wait $TEST_PID 2>/dev/null
if [ $? -eq 0 ]; then
    log_pass "VM discovery functional"
else
    log_fail "VM discovery not working"
fi

echo ""
echo "==============================="
if [ $FAILED -eq 0 ]; then
    echo "All tests passed!"
    echo "Ready for commit."
    exit 0
else
    echo "Failed: $FAILED test(s)"
    echo "Fix issues before committing."
    exit 1
fi

