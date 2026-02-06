#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

echo "🛑 Stopping VibeCode VM..."


# Initialize log aggregation
init_log_aggregation

if [ -f "/Users/studio/VibeCode-VMs/VibeCode-Dev/vm.pid" ]; then
    VM_PID=$(cat "/Users/studio/VibeCode-VMs/VibeCode-Dev/vm.pid")
    if ps -p $VM_PID > /dev/null; then
        echo "🛑 Stopping VM (PID: $VM_PID)..."
        kill $VM_PID
        echo "✅ VM stopped"
    else
        echo "❌ VM not running"
    fi
    rm -f "/Users/studio/VibeCode-VMs/VibeCode-Dev/vm.pid"
else
    echo "❌ No VM PID file found"
fi
