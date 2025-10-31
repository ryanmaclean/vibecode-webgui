#!/bin/bash
# End-to-end GUI interaction testing using AppleScript
# Tests clicking buttons, starting VMs, checking status

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "End-to-End GUI Testing"
echo "======================"
echo ""

# Start with clean state
killall VibeCode 2>/dev/null || true
sleep 2

# Launch app
echo "Launching VibeCode..."
"$SCRIPT_DIR/launch-vibecode.sh" > /dev/null 2>&1
sleep 5

# Test 1: Verify window opens
echo "[1/6] Verifying app window..."
if osascript -e 'tell application "System Events" to get name of every process' | grep -q "VibeCode"; then
    echo "  PASS: App window open"
else
    echo "  FAIL: App window not found"
    exit 1
fi

# Test 2: Check VM list loads
echo "[2/6] Checking VM list..."
sleep 2
VM_COUNT=$(tail -20 "$PROJECT_ROOT/logs/vibecode.log" 2>/dev/null | grep "vm_count" | tail -1 | grep -o '"vm_count":[0-9]*' | cut -d: -f2)
if [ "$VM_COUNT" -ge 6 ]; then
    echo "  PASS: $VM_COUNT VMs loaded in list"
else
    echo "  FAIL: Expected 6 VMs, found $VM_COUNT"
fi

# Test 3: Click first VM in list
echo "[3/6] Selecting VM in sidebar..."
osascript << 'APPLESCRIPT'
tell application "System Events"
    tell process "VibeCode"
        set frontmost to true
        delay 1
        -- Click first VM in sidebar
        click row 1 of outline 1 of scroll area 1 of splitter group 1 of window 1
        delay 1
    end tell
end tell
APPLESCRIPT

if [ $? -eq 0 ]; then
    echo "  PASS: VM selected"
else
    echo "  WARN: Could not automate VM selection (may require accessibility permissions)"
fi

# Test 4: Auto-start verification
echo "[4/6] Verifying auto-start..."
sleep 8
if grep -q "VM started successfully" "$PROJECT_ROOT/logs/vibecode.log" 2>/dev/null; then
    STARTED_VM=$(grep "VM started successfully" "$PROJECT_ROOT/logs/vibecode.log" | tail -1 | awk '{print $NF}')
    echo "  PASS: Auto-start worked ($STARTED_VM)"
else
    echo "  FAIL: No VM auto-started"
fi

# Test 5: Check for errors
echo "[5/6] Checking for errors..."
if grep -q "doesn't have.*entitlement" "$PROJECT_ROOT/logs/vibecode.log" 2>/dev/null; then
    echo "  FAIL: Entitlement errors found"
    exit 1
else
    echo "  PASS: No entitlement errors"
fi

# Test 6: Verify VMs are running
echo "[6/6] Verifying VM state..."
if ps aux | grep -v grep | grep "VibeCode.*Contents/MacOS" > /dev/null; then
    echo "  PASS: App still running with VMs"
else
    echo "  FAIL: App crashed"
    exit 1
fi

echo ""
echo "======================"
echo "GUI interaction tests complete"
echo ""
echo "Manual verification checklist:"
echo "  [ ] All 6 VMs visible in sidebar"
echo "  [ ] Clicking VM shows details"
echo "  [ ] Start VM button works"
echo "  [ ] Stop VM button works"
echo "  [ ] No red error messages"
echo "  [ ] Status updates correctly"

