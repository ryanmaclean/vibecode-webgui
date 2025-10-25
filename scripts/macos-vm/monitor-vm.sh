#!/bin/bash
# scripts/macos-vm/monitor-vm.sh
# Real-time health monitoring for VibeCode VM

echo "🔍 VibeCode VM Health Monitor"
echo "Press Ctrl+C to exit"
echo ""

while true; do
    # Move cursor to top
    tput home
    tput ed
    
    echo "VibeCode VM Health Monitor - $(date '+%Y-%m-%d %H:%M:%S')"
    echo "==============================================="
    echo ""
    
    # Check if running (capture PID once)
    VM_PID=$(pgrep vibecode-vm || echo "")
    
    if [ -n "$VM_PID" ]; then
        echo "Status:     ✅ Running"
        echo "PID:        $VM_PID"
        
        # Memory usage
        VM_MEM=$(ps -o rss= -p $VM_PID 2>/dev/null | awk '{print $1/1024}')
        printf "Memory:     %.0f MB\n" "$VM_MEM"
        
        # CPU usage
        VM_CPU=$(ps -o %cpu= -p $VM_PID)
        printf "CPU:        %s%%\n" "$VM_CPU"
        
        # Uptime
        VM_START=$(ps -o lstart= -p $VM_PID)
        echo "Started:    $VM_START"
        
        # Network test
        if curl -s -f http://localhost:8080 > /dev/null 2>&1; then
            echo "Code-Server: ✅ http://localhost:8080"
        else
            echo "Code-Server: ⚠️  Not responding"
        fi
        
        # Log file size
        if [ -f "$HOME/.vibecode/vm/stdout.log" ]; then
            LOG_SIZE=$(du -h "$HOME/.vibecode/vm/stdout.log" 2>/dev/null | awk '{print $1}')
            echo "Log Size:   $LOG_SIZE"
        fi
    else
        echo "Status:     ❌ Not running"
        echo ""
        echo "Start VM with: ./bin/vibecode-vm"
    fi
    
    echo ""
    echo "Refreshing in 5 seconds..."
    sleep 5
done
