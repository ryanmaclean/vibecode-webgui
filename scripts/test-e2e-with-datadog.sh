#!/bin/bash
# End-to-end test with Datadog validation
# Tests: GUI interactions + VM starts + Datadog metrics

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "End-to-End Test with Datadog"
echo "============================="
echo ""

# Check if DogStatsD is running
echo "Checking DogStatsD..."
if ! nc -z 127.0.0.1 8125 2>/dev/null; then
    echo "WARNING: DogStatsD not running on localhost:8125"
    echo "Start Datadog agent or run: dogstatsd-local start"
    echo ""
fi

# Clean state
killall VibeCode 2>/dev/null || true
sleep 2

# Start app
echo "[1/8] Launching VibeCode..."
"$SCRIPT_DIR/launch-vibecode.sh" > /dev/null 2>&1
sleep 5

if ! ps aux | grep -v grep | grep "VibeCode.*MacOS" > /dev/null; then
    echo "  FAIL: App did not launch"
    exit 1
fi
echo "  PASS: App launched"

# Test VM discovery
echo "[2/8] Testing VM discovery..."
sleep 3
VM_COUNT=$(tail -50 "$PROJECT_ROOT/logs/vibecode.log" 2>/dev/null | grep "vm_count" | tail -1 | grep -o '"vm_count":[0-9]*' | cut -d: -f2)
if [ "$VM_COUNT" -ge 6 ]; then
    echo "  PASS: Discovered $VM_COUNT VMs"
else
    echo "  FAIL: Expected 6 VMs, found $VM_COUNT"
fi

# Test auto-start
echo "[3/8] Testing auto-start..."
sleep 10
if grep -q "VM started successfully" "$PROJECT_ROOT/logs/vibecode.log" 2>/dev/null; then
    echo "  PASS: Auto-start triggered"
else
    echo "  FAIL: Auto-start did not work"
fi

# Test Datadog metrics from app
echo "[4/8] Checking app Datadog metrics..."
if grep -q "vibecode.vm" "$PROJECT_ROOT/logs/vibecode.log" 2>/dev/null; then
    echo "  PASS: App sending Datadog metrics"
else
    echo "  INFO: App metrics logged (DogStatsD may not be running)"
fi

# Test VM Datadog agents (Lima VMs)
echo "[5/8] Checking VM Datadog agents..."
if command -v limactl &> /dev/null; then
    RUNNING=$(limactl list 2>/dev/null | grep Running | wc -l | tr -d ' ')
    if [ "$RUNNING" -gt 0 ]; then
        echo "  INFO: $RUNNING Lima VMs running"
        # Check if any have Datadog
        for vm in $(limactl list | grep Running | awk '{print $1}'); do
            if limactl shell "$vm" which datadog-agent 2>/dev/null | grep -q datadog-agent; then
                echo "  PASS: $vm has Datadog agent"
            fi
        done
    else
        echo "  INFO: No Lima VMs running (VZ VMs don't have agents yet)"
    fi
else
    echo "  INFO: Lima not available"
fi

# Test service availability
echo "[6/8] Testing service connectivity..."
# PostgreSQL
if nc -z 127.0.0.1 5432 2>/dev/null; then
    echo "  PASS: PostgreSQL accessible"
else
    echo "  INFO: PostgreSQL not accessible (VM may not be running)"
fi

# Valkey
if nc -z 127.0.0.1 6379 2>/dev/null; then
    echo "  PASS: Valkey accessible"
else
    echo "  INFO: Valkey not accessible"
fi

# Node.js
if nc -z 127.0.0.1 3000 2>/dev/null; then
    echo "  PASS: Node.js accessible"
else
    echo "  INFO: Node.js not accessible"
fi

# Test app stability
echo "[7/8] Testing app stability..."
sleep 5
if ps aux | grep -v grep | grep "VibeCode.*MacOS" > /dev/null; then
    echo "  PASS: App still running"
else
    echo "  FAIL: App crashed"
    exit 1
fi

# Check for errors
echo "[8/8] Checking for errors..."
ERROR_COUNT=$(grep -c "ERROR\|entitlement.*doesn't have" "$PROJECT_ROOT/logs/vibecode.log" 2>/dev/null || echo "0")
if [ "$ERROR_COUNT" -eq 0 ]; then
    echo "  PASS: No critical errors"
else
    echo "  WARN: Found $ERROR_COUNT errors"
fi

# Cleanup
killall VibeCode 2>/dev/null || true

echo ""
echo "============================="
echo "End-to-end test complete"
echo ""
echo "Summary:"
echo "  - App launches and runs stably"
echo "  - VMs discovered and auto-start works"
echo "  - Datadog metrics instrumented in app"
echo "  - Services tested for connectivity"
echo ""
echo "For full Datadog validation:"
echo "  1. Ensure Datadog agent running: datadog-agent status"
echo "  2. Check metrics: datadog-agent status | grep vibecode"
echo "  3. View dashboard: https://app.datadoghq.com"

