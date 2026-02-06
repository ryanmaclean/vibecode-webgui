#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

# Boot all 6 VMs via GUI automation or API
# Agent 2: VM Operations Engineer

# Initialize log aggregation
init_log_aggregation


set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "=================================="
echo "Boot All VMs - Agent 2 Task"
echo "=================================="
echo ""

# Ensure app is running
if ! ps aux | grep -v grep | grep "VibeCode.*MacOS" > /dev/null; then
    echo "App not running, launching..."
    "$SCRIPT_DIR/launch-vibecode.sh" > /dev/null 2>&1
    sleep 10
fi

echo "App running, VMs discovered"
echo ""

# Wait for auto-start
echo "Waiting for auto-start (codeserver VM)..."
sleep 20

# Check logs for successful starts
echo ""
echo "Checking VM boot status..."
BOOTED=$(grep "VM started successfully" "$PROJECT_ROOT/logs/vibecode.log" 2>/dev/null | wc -l | tr -d ' ')
echo "VMs booted so far: $BOOTED/6"

if [ "$BOOTED" -gt 0 ]; then
    echo ""
    echo "Successfully booted VMs:"
    grep "VM started successfully" "$PROJECT_ROOT/logs/vibecode.log" | tail -5
fi

echo ""
echo "=================================="
echo "VM List Status:"
echo "=================================="

# List all VMs and their expected configuration
cat << 'VMLIST'

Expected VMs:
1. vibecode-postgresql (PostgreSQL database)
2. vibecode-valkey (Valkey cache)
3. vibecode-nodejs (Node.js runtime)
4. vibecode-nodejs-codeserver (OpenVSCode server) [AUTO-START]
5. vibecode-ide (IDE environment)
6. vibecode-pgvector (PostgreSQL with pgvector)

VMLIST

echo ""
echo "To manually start remaining VMs:"
echo "1. Open VibeCode app GUI"
echo "2. Click each VM in sidebar"
echo "3. Click 'Start VM' button"
echo ""
echo "Or wait for programmatic start implementation"

# Try to detect VM IPs from system
echo ""
echo "Checking for VM network activity..."
if arp -a | grep -q "192.168.64"; then
    echo "VMs detected on network:"
    arp -a | grep "192.168.64"
else
    echo "No VMs detected yet (they may still be booting)"
fi

echo ""
echo "Monitor boot progress with:"
echo "  tail -f $PROJECT_ROOT/logs/vibecode.log"

