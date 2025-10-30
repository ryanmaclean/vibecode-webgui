#!/usr/bin/env bash
# Unified VM Launcher for Apple VZ
# Launches all VMs using native Virtualization.framework

set -euo pipefail

VZ_BIN="/Users/ryan.maclean/vibecode-webgui/vz-swift/.build/debug/vibecode-vm"
LOG_DIR="/Users/ryan.maclean/vibecode-webgui/logs/vz"

mkdir -p "$LOG_DIR"

echo "🚀 Launching VMs with Apple Virtualization.framework"
echo "====================================================="
echo ""

# VM definitions
declare -A VMS=(
    ["valkey"]="linux vibecode-valkey"
    ["postgresql"]="linux vibecode-postgresql"
    ["pgvector"]="linux vibecode-pgvector"
    ["nodejs"]="linux vibecode-nodejs-dev"
)

# Launch each VM in background
for name in "${!VMS[@]}"; do
    cmd="${VMS[$name]}"
    log_file="$LOG_DIR/$name.log"
    
    echo "Starting $name VM..."
    $VZ_BIN $cmd > "$log_file" 2>&1 &
    pid=$!
    echo "  ✅ Started (PID: $pid, log: $log_file)"
    sleep 2
done

echo ""
echo "✅ All VMs launched!"
echo ""
echo "View logs:"
echo "  tail -f $LOG_DIR/*.log"
echo ""
echo "Check running VMs:"
echo "  ps aux | grep vibecode-vm"
echo ""
echo "Stop all VMs:"
echo "  pkill -f vibecode-vm"

