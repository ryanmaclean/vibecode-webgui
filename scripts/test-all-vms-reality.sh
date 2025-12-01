#!/bin/bash
# Reality Check: Test all VMs systematically
# Agent 1: Test & Fix VM Launches

set -e

cd "$(dirname "$0")/.."

echo "=== Agent 1: Testing All VMs Systematically ==="
echo ""

# Clean up
echo "1. Cleaning up..."
killall -9 ValkeyVibeCode PostgreSQLVibeCode UnifiedServicesVibeCode NodeJSVibeCode 2>/dev/null || true
rm -f /tmp/vibecode-console-*.log /tmp/vibecode-vm.log 2>/dev/null || true
sleep 2

# Test function
test_vm() {
    local app_name=$1
    local app_path=$2
    local expected_initramfs=$3
    local wait_time=${4:-30}
    
    echo ""
    echo "=== Testing $app_name ==="
    echo "App: $app_path"
    echo "Expected initramfs: $expected_initramfs"
    
    # Check if app exists
    if [ ! -d "$app_path" ]; then
        echo "❌ App not found: $app_path"
        return 1
    fi
    
    # Check if initramfs exists in bundle
    local initramfs_path="$app_path/Contents/Resources/${expected_initramfs}.cpio.gz"
    if [ ! -f "$initramfs_path" ]; then
        echo "❌ Initramfs not found: $initramfs_path"
        echo "Available initramfs files:"
        ls -lh "$app_path/Contents/Resources/"*.cpio.gz 2>/dev/null | awk '{print "  -", $9}' || echo "  None found"
        return 1
    fi
    
    echo "✅ App and initramfs found"
    
    # Launch app
    echo "Launching app..."
    open "$app_path"
    sleep $wait_time
    
    # Check if process is running
    local process_name=$(basename "$app_path" .app)
    if ps aux | grep -E "$process_name" | grep -v grep > /dev/null; then
        echo "✅ Process running"
    else
        echo "⚠️ Process not running"
    fi
    
    # Check console logs
    local console_log=$(ls -t /tmp/vibecode-console-*.log 2>/dev/null | head -1)
    if [ -n "$console_log" ]; then
        echo "✅ Console log found: $console_log"
        echo "Last 10 lines:"
        tail -10 "$console_log" | sed 's/^/  /'
        
        # Check for success indicators
        if grep -q "VM IP address:" "$console_log" 2>/dev/null; then
            echo "✅ VM booted successfully"
            grep "VM IP address:" "$console_log" | tail -1 | sed 's/^/  IP: /'
        else
            echo "⚠️ VM may not have booted (no IP detected)"
        fi
    else
        echo "❌ No console log found"
    fi
    
    # Check VM logger
    if [ -f /tmp/vibecode-vm.log ]; then
        echo "✅ VM logger found"
        echo "Last 5 lines:"
        tail -5 /tmp/vibecode-vm.log | sed 's/^/  /'
    fi
    
    echo ""
}

# Test each VM
echo "2. Testing VMs..."
echo ""

test_vm "Valkey" \
    "azure/SwiftUI-Apps/ValkeyVibeCode.app" \
    "valkey-standalone" \
    25

test_vm "PostgreSQL" \
    "azure/SwiftUI-Apps/PostgreSQLVibeCode.app" \
    "postgresql-test" \
    30

test_vm "Unified Services" \
    "azure/SwiftUI-Apps/UnifiedServicesVibeCode.app" \
    "unified-vm-initramfs" \
    40

test_vm "Node.js" \
    "azure/SwiftUI-Apps/NodeJSVibeCode.app" \
    "nodejs-complete" \
    25

echo ""
echo "=== Summary ==="
echo ""
echo "Console logs:"
ls -lh /tmp/vibecode-console-*.log 2>/dev/null | awk '{print "  -", $9, "(" $5 ")"}' || echo "  None"
echo ""
echo "Running processes:"
ps aux | grep -E "ValkeyVibeCode|PostgreSQLVibeCode|UnifiedServicesVibeCode|NodeJSVibeCode" | grep -v grep | awk '{print "  -", $11}' || echo "  None"
echo ""
echo "=== Done ==="

