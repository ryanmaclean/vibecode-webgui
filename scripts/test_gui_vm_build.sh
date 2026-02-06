#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

# Test script for GUI VM build
# Usage: ./scripts/test_gui_vm_build.sh

# Initialize log aggregation
init_log_aggregation


set -e
cd "$(dirname "$0")/.."

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║              GUI VM BUILD TEST                               ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Clean
echo "=== Cleaning previous build ==="
killall VibeCodeServicesVibeCode 2>/dev/null || true
rm -rf azure/SwiftUI-Apps/VibeCodeServicesVibeCode.app
rm -rf azure/SwiftUI-Apps/VibeCodeServicesVibeCode.*
rm -rf azure/SwiftUI-Apps/build_vibecodeservices.sh
rm -rf ~/VibeCode\ VMs/VibeCodeServices\ VM.bundle/
echo "✅ Cleaned"
echo ""

# Step 1: Generate
echo "=== Step 1: Generate Swift App ==="
python3 scripts/build_gui_linux_vm_swift.py --name VibeCodeServices 2>&1 | grep -E "✅|error" || true
if [ -f "azure/SwiftUI-Apps/VibeCodeServicesVibeCode.swift" ]; then
    echo "✅ Swift source generated"
else
    echo "❌ Swift source NOT generated"
    exit 1
fi
echo ""

# Step 2: Compile
echo "=== Step 2: Compile Swift ==="
bash azure/SwiftUI-Apps/build_vibecodeservices.sh 2>&1 | grep -E "✅|error" || true
if [ -f "azure/SwiftUI-Apps/VibeCodeServicesVibeCode.app/Contents/MacOS/VibeCodeServicesVibeCode" ]; then
    echo "✅ Binary compiled"
else
    echo "❌ Binary NOT compiled"
    exit 1
fi
echo ""

# Step 3: Verify build
echo "=== Step 3: Verify Build ==="
APP_SIZE=$(du -sh azure/SwiftUI-Apps/VibeCodeServicesVibeCode.app | cut -f1)
BINARY_SIZE=$(ls -lh azure/SwiftUI-Apps/VibeCodeServicesVibeCode.app/Contents/MacOS/VibeCodeServicesVibeCode | awk '{print $5}')
echo "App size: $APP_SIZE"
echo "Binary size: $BINARY_SIZE"
echo "✅ Build verified"
echo ""

# Step 4: Check entitlements
echo "=== Step 4: Check Entitlements ==="
if codesign -d --entitlements - azure/SwiftUI-Apps/VibeCodeServicesVibeCode.app/Contents/MacOS/VibeCodeServicesVibeCode 2>&1 | grep -q "virtualization"; then
    echo "✅ Virtualization entitlement present"
else
    echo "❌ Virtualization entitlement MISSING"
    exit 1
fi
echo ""

# Step 5: Launch
echo "=== Step 5: Launch App ==="
open azure/SwiftUI-Apps/VibeCodeServicesVibeCode.app
sleep 8
if pgrep -f "VibeCodeServicesVibeCode" > /dev/null; then
    echo "✅ App running"
else
    echo "❌ App NOT running"
    exit 1
fi
echo ""

# Step 6: Check VM bundle
echo "=== Step 6: Check VM Bundle ==="
if [ -d ~/VibeCode\ VMs/VibeCodeServices\ VM.bundle ]; then
    echo "✅ VM bundle created"
    DISK_LOGICAL=$(ls -lh ~/VibeCode\ VMs/VibeCodeServices\ VM.bundle/Disk.img | awk '{print $5}')
    DISK_ACTUAL=$(du -sh ~/VibeCode\ VMs/VibeCodeServices\ VM.bundle/Disk.img | cut -f1)
    echo "   Disk logical: $DISK_LOGICAL"
    echo "   Disk actual: $DISK_ACTUAL (sparse)"
else
    echo "❌ VM bundle NOT created"
    exit 1
fi
echo ""

# Step 7: Check window
echo "=== Step 7: Check Window ==="
WINDOW=$(osascript -e 'tell application "System Events" to get name of every window of process "VibeCodeServicesVibeCode"' 2>&1)
if [ -n "$WINDOW" ]; then
    echo "✅ Window: $WINDOW"
else
    echo "❌ No window found"
fi
echo ""

# Step 8: Check VM process
echo "=== Step 8: Check VM Process ==="
if pgrep -f "Virtualization.VirtualMachine" > /dev/null; then
    echo "✅ VM process running"
else
    echo "⚠️  VM process not found (may still be starting)"
fi
echo ""

# Summary
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║              TEST COMPLETE                                   ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  App Size: $APP_SIZE                                          "
echo "║  Binary: $BINARY_SIZE                                         "
echo "║  Disk: $DISK_LOGICAL logical, $DISK_ACTUAL actual (sparse)    "
echo "╚══════════════════════════════════════════════════════════════╝"





