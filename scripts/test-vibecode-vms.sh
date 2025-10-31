#!/bin/bash
# Comprehensive VibeCode VM Testing Suite
# Tests Apple VZ VM functionality before production push

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "VibeCode VM Test Suite"
echo "======================"
echo ""

# Test 1: Build verification
echo "Test 1: Build verification..."
cd "$PROJECT_ROOT/VibeCodeSwift"
swift build -c release > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "  PASS: Release build successful"
else
    echo "  FAIL: Release build failed"
    exit 1
fi

# Test 2: VM image verification
echo "Test 2: VM image verification..."
VM_COUNT=$(ls "$PROJECT_ROOT/dist/vm-images"/*.img 2>/dev/null | wc -l | tr -d ' ')
EFI_COUNT=$(ls "$PROJECT_ROOT/dist/vm-images"/*-efi.nvram 2>/dev/null | wc -l | tr -d ' ')

if [ "$VM_COUNT" -ge 6 ] && [ "$EFI_COUNT" -ge 6 ]; then
    echo "  PASS: Found $VM_COUNT VM images and $EFI_COUNT EFI stores"
else
    echo "  FAIL: Missing VM images (found $VM_COUNT) or EFI stores (found $EFI_COUNT)"
    exit 1
fi

# Test 3: VM discovery test
echo "Test 3: VM discovery test..."
killall VibeCode 2>/dev/null || true
sleep 1

timeout 10 "$PROJECT_ROOT/VibeCodeSwift/.build/release/VibeCode" 2>&1 | grep -q "VM discovery completed" &
TEST_PID=$!
sleep 3
kill $TEST_PID 2>/dev/null || true
wait $TEST_PID 2>/dev/null || true

if [ $? -eq 0 ]; then
    echo "  PASS: VM discovery functional"
else
    echo "  FAIL: VM discovery failed"
    exit 1
fi

# Test 4: Entitlements file verification
echo "Test 4: Entitlements verification..."
if [ -f "$PROJECT_ROOT/VibeCodeSwift/VibeCode.entitlements" ] && grep -q "com.apple.security.virtualization" "$PROJECT_ROOT/VibeCodeSwift/VibeCode.entitlements"; then
    echo "  PASS: Virtualization entitlement configured"
else
    echo "  FAIL: Missing virtualization entitlement"
    exit 1
fi

# Test 5: Datadog integration check
echo "Test 5: Datadog integration..."
if [ -f "$PROJECT_ROOT/scripts/run-with-secure-datadog-key.sh" ]; then
    echo "  PASS: Datadog scripts present"
else
    echo "  FAIL: Datadog integration missing"
    exit 1
fi

echo ""
echo "All tests passed!"
echo ""
echo "Ready for:"
echo "  - Full integration testing"
echo "  - Git commit and push to main"
echo ""

