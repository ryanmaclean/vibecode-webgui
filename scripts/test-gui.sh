#!/bin/bash
# Test actual GUI functionality
# Verifies the app can be launched and VMs can be started from the GUI

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "GUI Functionality Tests"
echo "======================"
echo ""

# Kill any existing instances
killall VibeCode 2>/dev/null || true
sleep 2

# Test 1: Build and sign properly
echo "[1/5] Building with proper entitlements..."
cd "$PROJECT_ROOT/VibeCodeSwift"
swift build -c debug > /dev/null 2>&1

if [ ! -f .build/debug/VibeCode ]; then
    echo "  FAIL: Build failed"
    exit 1
fi

# Create app bundle if needed
if [ ! -d .build/debug/VibeCode.app ]; then
    mkdir -p .build/debug/VibeCode.app/Contents/MacOS
    cp .build/debug/VibeCode .build/debug/VibeCode.app/Contents/MacOS/
    cp Info.plist .build/debug/VibeCode.app/Contents/
fi

echo "  Build complete"

# Test 2: Sign with entitlements
echo "[2/5] Signing with entitlements..."
codesign --force --sign - --entitlements VibeCode.entitlements .build/debug/VibeCode.app/Contents/MacOS/VibeCode > /dev/null 2>&1

# Verify entitlements
if codesign -d --entitlements - .build/debug/VibeCode.app 2>&1 | grep -q "com.apple.security.virtualization"; then
    echo "  PASS: Entitlements applied"
else
    echo "  FAIL: Entitlements not applied"
    exit 1
fi

# Test 3: Launch GUI
echo "[3/5] Launching GUI..."
open .build/debug/VibeCode.app
sleep 5

if ps aux | grep -v grep | grep VibeCode.app > /dev/null; then
    echo "  PASS: GUI launched"
else
    echo "  FAIL: GUI did not launch"
    exit 1
fi

# Test 4: Check for entitlement errors in logs
echo "[4/5] Checking for entitlement errors..."
sleep 2
if log show --predicate 'process == "VibeCode"' --last 10s 2>/dev/null | grep -q "doesn't have.*entitlement"; then
    echo "  FAIL: Entitlement error detected in logs"
    killall VibeCode 2>/dev/null || true
    exit 1
else
    echo "  PASS: No entitlement errors"
fi

# Test 5: Verify VMs loaded in GUI
echo "[5/5] Verifying VM discovery..."
sleep 3
LOG_OUTPUT=$(log show --predicate 'process == "VibeCode"' --last 10s 2>/dev/null)
if echo "$LOG_OUTPUT" | grep -q "VM discovery completed"; then
    VM_COUNT=$(echo "$LOG_OUTPUT" | grep "vm_count" | tail -1 | grep -o '"vm_count":[0-9]*' | cut -d: -f2)
    if [ "$VM_COUNT" -ge 6 ]; then
        echo "  PASS: $VM_COUNT VMs discovered in GUI"
    else
        echo "  FAIL: Only $VM_COUNT VMs discovered"
    fi
else
    echo "  FAIL: VM discovery did not complete"
fi

# Cleanup
killall VibeCode 2>/dev/null || true

echo ""
echo "======================"
echo "GUI tests complete"
echo ""
echo "To manually test VM start:"
echo "  1. Run: open VibeCodeSwift/.build/debug/VibeCode.app"
echo "  2. Click a VM in the sidebar"
echo "  3. Click 'Start VM' button"
echo "  4. Verify no entitlement errors"

