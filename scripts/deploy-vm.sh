#!/bin/bash

# VM Deployment Script
# Deploys any VM for testing or production use

VM_NAME=$1
INITRAMFS=$2

if [ -z "$VM_NAME" ] || [ -z "$INITRAMFS" ]; then
    echo "Usage: $0 <vm-name> <initramfs-file>"
    echo ""
    echo "Examples:"
    echo "  $0 valkey valkey-standalone-complete.cpio.gz"
    echo "  $0 postgresql postgresql-standalone-complete.cpio.gz"
    echo "  $0 unified unified-services-restored.cpio.gz"
    exit 1
fi

AZURE_DIR="$HOME/vibecode-webgui/azure"

if [ ! -f "$AZURE_DIR/$INITRAMFS" ]; then
    echo "ERROR: Initramfs not found: $AZURE_DIR/$INITRAMFS"
    exit 1
fi

echo "=== Deploying $VM_NAME VM ==="
echo "Initramfs: $INITRAMFS"
echo ""

# Use Node.js app as test harness
cd "$AZURE_DIR"
cp nodejs-complete.cpio.gz nodejs-backup.cpio.gz 2>/dev/null || true
cp "$INITRAMFS" nodejs-complete.cpio.gz

# Launch
killall NodeJSVibeCode 2>/dev/null || true
sleep 2

echo "Launching VM..."
~/vibecode-webgui/azure/SwiftUI-Apps/NodeJSVibeCode.app/Contents/MacOS/NodeJSVibeCode > /dev/null 2>&1 &

echo "VM launched (PID: $!)"
echo ""
echo "Wait 30-60 seconds for boot, then check:"
echo "  Console: tail -f /tmp/vibecode-console-*.log"
echo "  Network: for ip in 192.168.64.{1..10}; do ping -c 1 \$ip 2>/dev/null && echo \"Found: \$ip\"; done"
