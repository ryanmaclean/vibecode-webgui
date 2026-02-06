#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

echo "🚀 Starting VibeCode vfkit VM..."

# Check if vfkit is available

# Initialize log aggregation
init_log_aggregation

if ! command -v vfkit >/dev/null 2>&1; then
    echo "❌ vfkit not found"
    echo "   Install with: brew install vfkit"
    exit 1
fi

# Start vfkit with minimal configuration
echo "🍎 Starting vfkit VM..."
vfkit --cpus 2 --memory 2048 --gui --log-level debug &

VM_PID=$!
echo "🚀 VM started with PID: $VM_PID"

# Wait a moment
sleep 3

# Check if VM is running
if ps -p $VM_PID > /dev/null; then
    echo "✅ VibeCode VM is running (PID: $VM_PID)"
    echo "🔧 VM Details:"
    echo "  Memory: 2048 MiB"
    echo "  CPUs: 2"
    echo "  PID: $VM_PID"
    
    # Save PID for management scripts
    echo $VM_PID > "/Users/studio/VibeCode-VMs/VibeCode-Dev/vm.pid"
    
    echo "✅ VM management:"
    echo "  Stop: kill $VM_PID"
    echo "  Status: ps -p $VM_PID"
else
    echo "❌ VM failed to start"
    exit 1
fi
