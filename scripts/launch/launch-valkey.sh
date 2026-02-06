#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

# Quick Launch Script for Valkey VM

# Initialize log aggregation
init_log_aggregation


set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=================================${NC}"
echo -e "${BLUE}  Valkey VM Quick Launch${NC}"
echo -e "${BLUE}=================================${NC}"
echo ""

# Kill any running VMs
echo "Stopping any running VMs..."
killall ValkeyVibeCode 2>/dev/null || true
killall NodeJS 2>/dev/null || true
sleep 2

# Clean console logs
echo "Cleaning old console logs..."
rm -f /tmp/vibecode-console-*.log

# Check if initramfs exists
if [ ! -f ~/vibecode-webgui/azure/valkey-standalone-v2.cpio.gz ]; then
    echo "ERROR: Valkey initramfs not found!"
    exit 1
fi

# Launch VM
echo "Launching Valkey VM..."
cd ~/vibecode-webgui/azure

# Backup current nodejs initramfs and swap in Valkey
if [ -f nodejs-complete.cpio.gz ]; then
    cp nodejs-complete.cpio.gz nodejs-backup.cpio.gz
fi
cp valkey-standalone-v2.cpio.gz nodejs-complete.cpio.gz

# Start VM
~/vibecode-webgui/azure/SwiftUI-Apps/NodeJSVibeCode.app/Contents/MacOS/NodeJS > /dev/null 2>&1 &
VM_PID=$!

echo "VM PID: $VM_PID"
echo "Waiting for boot..."

# Wait for boot
sleep 30

# Get console log
CONSOLE_LOG=$(ls -t /tmp/vibecode-console-*.log 2>/dev/null | head -1)

if [ -z "$CONSOLE_LOG" ]; then
    echo "WARNING: No console log found"
else
    # Extract IP
    VM_IP=$(tail -100 "$CONSOLE_LOG" 2>/dev/null | grep -oE "inet [0-9]+\.[0-9]+\.[0-9]+\.[0-9]+" | awk '{print $2}' | head -1)

    if [ -n "$VM_IP" ]; then
        echo -e "${GREEN}✓${NC} VM booted successfully"
        echo ""
        echo "VM IP Address: $VM_IP"
        echo "Valkey Port: 6379"
        echo ""
        echo "Access Instructions:"
        echo "  redis-cli -h $VM_IP -p 6379"
        echo ""
        echo "Test Connection:"
        echo "  redis-cli -h $VM_IP -p 6379 PING"
        echo ""
    else
        echo "WARNING: Could not determine VM IP"
    fi

    # Tail console log
    echo "Console log: $CONSOLE_LOG"
    echo ""
    echo "Press Ctrl+C to stop tailing log..."
    tail -f "$CONSOLE_LOG"
fi
