#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

# Automated VM Test Harness
# Staff Engineer Level: No manual testing required

# Initialize log aggregation
init_log_aggregation


set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Test results
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

test_result() {
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    if [ $1 -eq 0 ]; then
        echo "  ✅ PASS: $2"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        echo "  ❌ FAIL: $2"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

echo "=========================================="
echo "Automated VM Test Harness"
echo "Staff Engineer Level - Full Automation"
echo "=========================================="
echo ""

# Phase 1: Infrastructure
echo "[Phase 1] Infrastructure Validation"
echo "------------------------------------"

test -f "$PROJECT_ROOT/VibeCodeSwift/.build/debug/VibeCode"
test_result $? "App binary exists"

ls "$PROJECT_ROOT/dist/vm-images/"*.img 2>/dev/null | wc -l | grep -q "6"
test_result $? "All 6 VM images present"

ls "$PROJECT_ROOT/dist/vm-images/"*-efi.nvram 2>/dev/null | wc -l | grep -q "6"
test_result $? "All 6 EFI NVRAM files present"

echo ""

# Phase 2: Programmatic VM Start
echo "[Phase 2] Programmatic VM Testing"
echo "----------------------------------"

# Kill any existing instances
killall VibeCode 2>/dev/null || true
sleep 2

# Start app in background
echo "Starting app..."
"$SCRIPT_DIR/launch-vibecode.sh" > /dev/null 2>&1 &
APP_PID=$!
sleep 10

# Verify app is running
ps -p $APP_PID > /dev/null 2>&1
test_result $? "App launched successfully"

# Wait for VM discovery
sleep 5
VM_COUNT=$(tail -50 "$PROJECT_ROOT/logs/vibecode.log" 2>/dev/null | grep "vm_count" | tail -1 | grep -o '"vm_count":[0-9]*' | cut -d: -f2)
[ "$VM_COUNT" = "6" ]
test_result $? "All 6 VMs discovered (found $VM_COUNT)"

echo ""

# Phase 3: Test VMs that are already running
echo "[Phase 3] Running VM Validation"
echo "-------------------------------"

RUNNING_VMS=$(tail -100 "$PROJECT_ROOT/logs/vibecode.log" 2>/dev/null | grep -E "Running|started" | wc -l | tr -d ' ')
echo "Found $RUNNING_VMS running VMs (Pgvector and Ide auto-run)"

# Check network presence
echo ""
echo "Scanning for VMs on network..."
VM_IPS=$(arp -a | grep "192.168.64" | grep -v "192.168.64.1\|192.168.64.255" | wc -l | tr -d ' ')
test_result [ "$VM_IPS" -gt 0 ] "VMs present on bridge100 network ($VM_IPS VMs)"

echo ""

# Phase 4: Service Port Testing
echo "[Phase 4] Service Availability"
echo "------------------------------"

# Test all expected ports
declare -A SERVICES
SERVICES[5432]="PostgreSQL"
SERVICES[6379]="Valkey"
SERVICES[3000]="Node.js"
SERVICES[8080]="OpenVSCode"
SERVICES[8443]="IDE"
SERVICES[5433]="Pgvector"

for port in "${!SERVICES[@]}"; do
    if nc -z localhost "$port" 2>/dev/null; then
        test_result 0 "${SERVICES[$port]} accessible on localhost:$port"
    else
        test_result 1 "${SERVICES[$port]} not accessible on localhost:$port"
    fi
done

echo ""

# Phase 5: Service Functional Testing
echo "[Phase 5] Service Functional Tests"
echo "-----------------------------------"

# Test Valkey if accessible
if nc -z localhost 6379 2>/dev/null; then
    if echo "PING" | nc localhost 6379 2>/dev/null | grep -q "PONG\|AUTH"; then
        test_result 0 "Valkey responding to commands"
    else
        test_result 1 "Valkey not responding properly"
    fi
else
    echo "  ⏭️  SKIP: Valkey not accessible"
fi

# Test Node.js if accessible
if nc -z localhost 3000 2>/dev/null; then
    if curl -s -m 5 http://localhost:3000/ > /dev/null 2>&1; then
        test_result 0 "Node.js HTTP server responding"
    else
        test_result 1 "Node.js HTTP server not responding"
    fi
else
    echo "  ⏭️  SKIP: Node.js not accessible"
fi

# Test PostgreSQL if accessible
if nc -z localhost 5432 2>/dev/null; then
    if command -v psql &>/dev/null; then
        if psql -h localhost -p 5432 -U postgres -c "SELECT 1;" &>/dev/null; then
            test_result 0 "PostgreSQL accepting connections"
        else
            test_result 1 "PostgreSQL not accepting connections"
        fi
    else
        echo "  ⏭️  SKIP: psql not installed"
    fi
else
    echo "  ⏭️  SKIP: PostgreSQL not accessible"
fi

# Test OpenVSCode if accessible
if nc -z localhost 8080 2>/dev/null; then
    if curl -s -m 5 http://localhost:8080/ | grep -q "vscode\|code-server" 2>/dev/null; then
        test_result 0 "OpenVSCode web interface responding"
    else
        test_result 1 "OpenVSCode not responding properly"
    fi
else
    echo "  ⏭️  SKIP: OpenVSCode not accessible"
fi

echo ""

# Phase 6: EFI Configuration Validation
echo "[Phase 6] EFI Bootloader Validation"
echo "-----------------------------------"

for vm in postgresql valkey nodejs nodejs-codeserver; do
    EFI_SIZE=$(stat -f%z "$PROJECT_ROOT/dist/vm-images/vibecode-${vm}-efi.nvram" 2>/dev/null || echo "0")
    if [ "$EFI_SIZE" = "131072" ]; then
        test_result 0 "$vm EFI NVRAM valid (128K)"
    else
        test_result 1 "$vm EFI NVRAM invalid (size: $EFI_SIZE)"
    fi
done

echo ""

# Phase 7: Console Output Check
echo "[Phase 7] VM Console Output"
echo "---------------------------"

if ls "$PROJECT_ROOT/logs/"*-console.log &>/dev/null; then
    CONSOLE_COUNT=$(ls "$PROJECT_ROOT/logs/"*-console.log | wc -l | tr -d ' ')
    test_result 0 "Console logs created ($CONSOLE_COUNT VMs)"
    
    # Check for boot messages
    if grep -q "login\|Welcome\|Alpine" "$PROJECT_ROOT/logs/"*-console.log 2>/dev/null; then
        test_result 0 "VMs producing console output"
    else
        test_result 1 "No console output detected"
    fi
else
    test_result 1 "No console logs found"
fi

echo ""

# Phase 8: Datadog Integration
echo "[Phase 8] Observability"
echo "----------------------"

if datadog-agent status 2>&1 | grep -q "DogStatsD"; then
    test_result 0 "Datadog agent running"
else
    test_result 1 "Datadog agent not running"
fi

if tail -100 "$PROJECT_ROOT/logs/vibecode.log" | grep -q "vibecode.vm"; then
    test_result 0 "App sending Datadog metrics"
else
    echo "  ⏭️  SKIP: No metrics in logs yet"
fi

echo ""

# Cleanup
kill $APP_PID 2>/dev/null || true
sleep 2
killall VibeCode 2>/dev/null || true

# Final Report
echo "=========================================="
echo "Test Harness Results"
echo "=========================================="
echo ""
echo "Total Tests: $TOTAL_TESTS"
echo "Passed: $PASSED_TESTS ($((PASSED_TESTS * 100 / TOTAL_TESTS))%)"
echo "Failed: $FAILED_TESTS"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo "🎉 ALL TESTS PASSED - READY FOR MAIN"
    exit 0
else
    echo "⚠️  SOME TESTS FAILED"
    echo ""
    echo "Common Issues:"
    echo "  - VMs not starting: Check EFI NVRAM files"
    echo "  - Services not accessible: VMs may need services installed"
    echo "  - Boot loader invalid: Copy EFI from working VM"
    echo ""
    echo "Debug:"
    echo "  tail -100 $PROJECT_ROOT/logs/vibecode.log"
    echo "  ./scripts/find-vm-ips.sh"
    echo "  ./scripts/test-service-health.sh <ip>"
    exit 1
fi

