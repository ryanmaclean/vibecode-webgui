#!/bin/bash
echo "📊 VibeCode VM Status"
echo "===================="

if [ -f "/Users/studio/VibeCode-VMs/VibeCode-Dev/vm.pid" ]; then
    VM_PID=$(cat "/Users/studio/VibeCode-VMs/VibeCode-Dev/vm.pid")
    if ps -p $VM_PID > /dev/null; then
        echo "✅ VM is running (PID: $VM_PID)"
        echo "  Memory: 2048 MiB"
        echo "  CPUs: 2"
        echo "  Directory: /Users/studio/VibeCode-VMs/VibeCode-Dev"
    else
        echo "❌ VM is not running"
        rm -f "/Users/studio/VibeCode-VMs/VibeCode-Dev/vm.pid"
    fi
else
    echo "❌ No VM PID file found"
fi
