#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

# Staff Engineer Level - Comprehensive Automated Test Suite
# No manual intervention required

# Initialize log aggregation
init_log_aggregation


set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

TOTAL=0
PASSED=0
FAILED=0

test_check() {
    TOTAL=$((TOTAL + 1))
    if [ $1 -eq 0 ]; then
        echo "  ✅ PASS: $2"
        PASSED=$((PASSED + 1))
        return 0
    else
        echo "  ❌ FAIL: $2"
        FAILED=$((FAILED + 1))
        return 1
    fi
}

echo "=========================================="
echo "Staff Engineer Level Test Suite"
echo "Comprehensive Automated Validation"
echo "=========================================="
echo ""

# Test 1: Build System
echo "[1/8] Build System Validation"
echo "------------------------------"

cd "$PROJECT_ROOT/VibeCodeSwift"
swift build -c debug > /dev/null 2>&1
test_check $? "Swift build succeeds"

test -f .build/debug/VibeCode
test_check $? "Binary produced"

test -d .build/debug/VibeCode.app
test_check $? "App bundle created"

echo ""

# Test 2: VM Images
echo "[2/8] VM Image Validation"
echo "-------------------------"

for vm in postgresql valkey nodejs nodejs-codeserver ide pgvector; do
    test -f "$PROJECT_ROOT/dist/vm-images/vibecode-${vm}.img"
    test_check $? "$vm disk image exists"
    
    test -f "$PROJECT_ROOT/dist/vm-images/vibecode-${vm}-efi.nvram"
    test_check $? "$vm EFI NVRAM exists"
    
    # Check EFI size is valid (128K)
    SIZE=$(stat -f%z "$PROJECT_ROOT/dist/vm-images/vibecode-${vm}-efi.nvram" 2>/dev/null || echo "0")
    [ "$SIZE" = "131072" ]
    test_check $? "$vm EFI valid size (128K)"
done

echo ""

# Test 3: Code Signing
echo "[3/8] Code Signing Validation"
echo "-----------------------------"

cd "$PROJECT_ROOT/VibeCodeSwift"
codesign --force --sign - --entitlements VibeCode.entitlements .build/debug/VibeCode.app/Contents/MacOS/VibeCode > /dev/null 2>&1
test_check $? "Code signing succeeds"

codesign -d --entitlements - .build/debug/VibeCode.app 2>&1 | grep -q "com.apple.security.virtualization"
test_check $? "Virtualization entitlement present"

echo ""

# Test 4: App Launch
echo "[4/8] Application Launch"
echo "------------------------"

killall VibeCode 2>/dev/null || true
sleep 2

open .build/debug/VibeCode.app
sleep 8

ps aux | grep -v grep | grep "VibeCode.*MacOS" > /dev/null
test_check $? "App process running"

log show --predicate 'process == "VibeCode"' --last 10s 2>/dev/null | grep -q "VibeCode\|VM"
test_check $? "App generating logs"

echo ""

# Test 5: VM Discovery
echo "[5/8] VM Discovery"
echo "-----------------"

sleep 5
VM_COUNT=$(tail -50 "$PROJECT_ROOT/logs/vibecode.log" 2>/dev/null | grep "vm_count" | tail -1 | grep -o '"vm_count":[0-9]*' | cut -d: -f2)
[ "$VM_COUNT" = "6" ]
test_check $? "All 6 VMs discovered (found: $VM_COUNT)"

echo ""

# Test 6: VM Network Configuration
echo "[6/8] Network Configuration"
echo "---------------------------"

# Check bridge network exists
ifconfig bridge100 > /dev/null 2>&1
test_check $? "bridge100 network interface exists"

# Check for VMs on network
sleep 5
ARP_COUNT=$(arp -a | grep "192.168.64" | grep -v "192.168.64.1\|192.168.64.255\|incomplete" | wc -l | tr -d ' ')
[ "$ARP_COUNT" -gt 0 ]
test_check $? "VMs detected on network ($ARP_COUNT VMs)"

echo ""

# Test 7: Service Availability  
echo "[7/8] Service Availability"
echo "-------------------------"

# Test each service port
test_port() {
    local PORT=$1
    local SERVICE=$2
    
    # Try localhost first
    if nc -z localhost "$PORT" 2>/dev/null; then
        test_check 0 "$SERVICE accessible on localhost:$PORT"
        return 0
    fi
    
    # Try VM IPs
    for ip in 192.168.64.{2..10}; do
        if nc -z "$ip" "$PORT" 2>/dev/null; then
            test_check 0 "$SERVICE accessible on $ip:$PORT"
            return 0
        fi
    done
    
    test_check 1 "$SERVICE not accessible on any interface"
    return 1
}

test_port 5432 "PostgreSQL"
test_port 6379 "Valkey"
test_port 3000 "Node.js"
test_port 8080 "OpenVSCode"
test_port 8443 "IDE"
test_port 5433 "Pgvector"

echo ""

# Test 8: Observability
echo "[8/8] Observability Stack"
echo "------------------------"

# Datadog agent
datadog-agent status 2>&1 | grep -q "DogStatsD"
test_check $? "Datadog agent running"

# Log collection
datadog-agent status 2>&1 | grep -q "vibecode"
test_check $? "Vibecode logs being collected"

# Metrics instrumentation
grep -q "DogStatsDClient\|vibecode.vm" "$PROJECT_ROOT/VibeCodeSwift/Sources/ViewModels/VMManager.swift"
test_check $? "Metrics instrumented in code"

echo ""

# Cleanup
killall VibeCode 2>/dev/null || true

# Final Report
echo "=========================================="
echo "Test Suite Results"
echo "=========================================="
echo ""
echo "Total Tests: $TOTAL"
echo "Passed: $PASSED ($((PASSED * 100 / TOTAL))%)"
echo "Failed: $FAILED"
echo ""

if [ $FAILED -eq 0 ]; then
    echo "🎉 ALL TESTS PASSED"
    echo ""
    echo "Feature Status: PRODUCTION READY"
    echo "Ready to push to main"
    exit 0
else
    echo "⚠️  $FAILED TEST(S) FAILED"
    echo ""
    echo "Feature Status: $((PASSED * 100 / TOTAL))% COMPLETE"
    echo ""
    echo "Common fixes:"
    echo "  - VMs need services installed: See cloud-init configs"
    echo "  - EFI issues: All VMs now use working Ide EFI"
    echo "  - Network: VMs detected, may need port forwarding"
    echo ""
    echo "Detailed logs:"
    echo "  tail -100 $PROJECT_ROOT/logs/vibecode.log"
    exit 1
fi

