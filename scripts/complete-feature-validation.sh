#!/bin/bash
# Complete feature validation for VibeCode
# Tests all critical functionality before declaring feature complete

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "=================================="
echo "VibeCode Feature Validation"
echo "=================================="
echo ""

# Track results
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

test_result() {
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    if [ $1 -eq 0 ]; then
        echo "  ✅ PASS: $2"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo "  ❌ FAIL: $2"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
}

# Phase 1: Infrastructure
echo "[Phase 1] Infrastructure Validation"
echo "-----------------------------------"

# Check app exists
test -f "$PROJECT_ROOT/VibeCodeSwift/.build/debug/VibeCode"
test_result $? "App binary exists"

# Check entitlements
codesign -d --entitlements - "$PROJECT_ROOT/VibeCodeSwift/.build/debug/VibeCode.app" 2>&1 | grep -q "com.apple.security.virtualization"
test_result $? "Entitlements configured"

# Check VM images
VM_COUNT=$(ls "$PROJECT_ROOT/dist/vm-images/"*.img 2>/dev/null | wc -l | tr -d ' ')
[ "$VM_COUNT" -eq 6 ]
test_result $? "All 6 VM images present"

# Check EFI NVRAM files
NVRAM_COUNT=$(ls "$PROJECT_ROOT/dist/vm-images/"*-efi.nvram 2>/dev/null | wc -l | tr -d ' ')
[ "$NVRAM_COUNT" -eq 6 ]
test_result $? "All 6 EFI NVRAM files present"

echo ""

# Phase 2: Application Launch
echo "[Phase 2] Application Launch"
echo "---------------------------"

# Kill existing instances
killall VibeCode 2>/dev/null || true
sleep 2

# Launch app
"$SCRIPT_DIR/launch-vibecode.sh" > /dev/null 2>&1
sleep 5

# Check if running
ps aux | grep -v grep | grep "VibeCode.*MacOS" > /dev/null
test_result $? "App launches successfully"

# Check for entitlement errors
! log show --predicate 'process == "VibeCode"' --last 10s 2>/dev/null | grep -q "doesn't have.*entitlement"
test_result $? "No entitlement errors"

# Check VM discovery
sleep 5
VM_DISCOVERED=$(tail -50 "$PROJECT_ROOT/logs/vibecode.log" 2>/dev/null | grep "vm_count" | tail -1 | grep -o '"vm_count":[0-9]*' | cut -d: -f2)
[ "$VM_DISCOVERED" -eq 6 ]
test_result $? "All 6 VMs discovered ($VM_DISCOVERED/6)"

echo ""

# Phase 3: VM Boot Test
echo "[Phase 3] VM Boot Validation"
echo "----------------------------"

# Wait for auto-start
sleep 15

# Check if any VM is running
if grep -q "VM started successfully" "$PROJECT_ROOT/logs/vibecode.log" 2>/dev/null; then
    BOOTED_VM=$(grep "VM started successfully" "$PROJECT_ROOT/logs/vibecode.log" | tail -1 | awk '{print $NF}')
    test_result 0 "At least one VM booted ($BOOTED_VM)"
else
    test_result 1 "No VMs booted"
fi

echo ""

# Phase 4: Network Connectivity
echo "[Phase 4] Network & Service Tests"
echo "---------------------------------"

# PostgreSQL
if nc -z localhost 5432 2>/dev/null; then
    test_result 0 "PostgreSQL port accessible"
else
    test_result 1 "PostgreSQL port not accessible"
fi

# Valkey
if nc -z localhost 6379 2>/dev/null; then
    test_result 0 "Valkey port accessible"
else
    test_result 1 "Valkey port not accessible"
fi

# Node.js
if nc -z localhost 3000 2>/dev/null; then
    test_result 0 "Node.js port accessible"
else
    test_result 1 "Node.js port not accessible"
fi

# OpenVSCode
if nc -z localhost 8080 2>/dev/null; then
    test_result 0 "OpenVSCode port accessible"
else
    test_result 1 "OpenVSCode port not accessible"
fi

echo ""

# Phase 5: Observability
echo "[Phase 5] Observability Validation"
echo "----------------------------------"

# Check DogStatsD
if nc -vzu localhost 8125 2>&1 | grep -q "succeeded"; then
    test_result 0 "DogStatsD port available"
else
    test_result 1 "DogStatsD not available"
fi

# Check Datadog agent
if datadog-agent status 2>&1 | grep -q "DogStatsD"; then
    test_result 0 "Datadog agent running"
else
    test_result 1 "Datadog agent not running"
fi

# Check log collection
if datadog-agent status 2>&1 | grep -q "vibecode"; then
    test_result 0 "Logs being collected"
else
    test_result 1 "Logs not being collected"
fi

echo ""

# Phase 6: Test Scripts
echo "[Phase 6] Test Script Validation"
echo "--------------------------------"

# Check test scripts exist
for script in regression-tests.sh test-vibecode-vms.sh functional-tests.sh test-gui.sh service-tests.sh test-e2e-with-datadog.sh; do
    if [ -x "$SCRIPT_DIR/$script" ]; then
        test_result 0 "$script executable"
    else
        test_result 1 "$script not executable"
    fi
done

echo ""

# Cleanup
killall VibeCode 2>/dev/null || true

# Summary
echo "=================================="
echo "Validation Summary"
echo "=================================="
echo ""
echo "Total Tests: $TOTAL_TESTS"
echo "Passed: $PASSED_TESTS"
echo "Failed: $FAILED_TESTS"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo "🎉 ALL TESTS PASSED!"
    echo ""
    echo "Feature Status: READY FOR MAIN"
    echo ""
    echo "✅ Infrastructure complete"
    echo "✅ Application working"
    echo "✅ Observability instrumented"
    echo "✅ Tests executable"
    echo ""
    echo "Next Steps:"
    echo "  1. Validate all 6 VMs boot individually"
    echo "  2. Confirm all services accessible"
    echo "  3. Verify Datadog metrics in dashboard"
    echo "  4. Run full E2E test suite"
    echo "  5. Create demo video"
    echo "  6. Push to main!"
    exit 0
else
    COMPLETION=$((PASSED_TESTS * 100 / TOTAL_TESTS))
    echo "⚠️  SOME TESTS FAILED"
    echo ""
    echo "Feature Status: $COMPLETION% COMPLETE"
    echo ""
    echo "Critical Gaps:"
    if ! nc -z localhost 5432 2>/dev/null; then
        echo "  - PostgreSQL not accessible"
    fi
    if ! nc -z localhost 6379 2>/dev/null; then
        echo "  - Valkey not accessible"
    fi
    if ! nc -z localhost 3000 2>/dev/null; then
        echo "  - Node.js not accessible"
    fi
    if ! nc -z localhost 8080 2>/dev/null; then
        echo "  - OpenVSCode not accessible"
    fi
    echo ""
    echo "See: FEATURE_COMPLETION_CHECKLIST.md"
    exit 1
fi

