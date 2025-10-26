#!/bin/bash
# vm-cli.sh - Command-line tool to manage VirtualBuddy VMs with vfkit

set -e

VB_VMS="$HOME/Library/Application Support/VirtualBuddy"

usage() {
    cat << EOF
🍎 VirtualBuddy VM CLI Tool
===========================

Launch VirtualBuddy VMs from the command line using vfkit.

Commands:
  list               - List all VirtualBuddy VMs
  start <name>        - Start a VM with vfkit
  stop <name>         - Stop a running VM
  status <name>       - Check VM status
  backup <name>       - Backup a VM to tank3
  restore <backup>   - Restore VM from backup

Examples:
  $0 list
  $0 start "Supporting Anteater"
  $0 stop "Supporting Anteater"
  $0 status "Supporting Anteater"
  $0 backup "Supporting Anteater"

EOF
}

start_vm() {
    local vm_name="$1"
    local vm_path="$VB_VMS/${vm_name}.vbvm"
    
    if [ ! -d "$vm_path" ]; then
        echo "❌ VM not found: $vm_name"
        exit 1
    fi
    
    echo "🚀 Starting VM: $vm_name"
    
    # Extract VM files
    local disk="$vm_path/Disk.img"
    local hw="$vm_path/HardwareModel"
    local mid="$vm_path/MachineIdentifier"
    local aux="$vm_path/AuxiliaryStorage"
    
    # Check files exist
    for file in "$disk" "$hw" "$mid" "$aux"; do
        if [ ! -e "$file" ]; then
            echo "❌ Missing file: $file"
            exit 1
        fi
    done
    
    # Get network type (NAT or bridged)
    local net="nat"
    
    # Build vfkit command
    local args=(
        --cpus 4
        --memory 8192
        --bootloader "macos,machineIdentifierPath=$mid,hardwareModelPath=$hw,auxImagePath=$aux"
        --device "virtio-blk,path=$disk"
        --device "virtio-net,$net"
        --gui
        --log-level "info"
    )
    
    echo "📝 Command: vfkit ${args[*]}"
    echo ""
    
    # Start vfkit in background
    vfkit "${args[@]}" &
    
    local pid=$!
    echo "$pid" > "/tmp/vm-${vm_name}.pid"
    
    echo "✅ VM started (PID: $pid)"
    echo "📱 Check VirtualBuddy GUI for VM window"
    echo ""
    echo "💡 To stop: $0 stop \"$vm_name\""
}

stop_vm() {
    local vm_name="$1"
    local pid_file="/tmp/vm-${vm_name}.pid"
    
    if [ ! -f "$pid_file" ]; then
        echo "❌ No PID file found for $vm_name"
        echo "   VM may not be running"
        exit 1
    fi
    
    local pid=$(cat "$pid_file")
    
    if ps -p "$pid" > /dev/null 2>&1; then
        echo "🛑 Stopping VM: $vm_name (PID: $pid)"
        kill "$pid"
        sleep 2
        
        if ps -p "$pid" > /dev/null 2>&1; then
            echo "⚠️  Force stopping..."
            kill -9 "$pid"
        fi
        
        echo "✅ VM stopped"
    else
        echo "⚠️  VM not running (stale PID file)"
    fi
    
    rm -f "$pid_file"
}

status_vm() {
    local vm_name="$1"
    local pid_file="/tmp/vm-${vm_name}.pid"
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if ps -p "$pid" > /dev/null 2>&1; then
            echo "✅ VM is running (PID: $pid)"
        else
            echo "❌ VM is not running (stale PID file)"
            rm -f "$pid_file"
        fi
    else
        echo "❌ VM is not running"
    fi
}

list_vms() {
    echo "📋 VirtualBuddy VMs:"
    echo ""
    
    local vm_count=0
    for vm in "$VB_VMS"/*.vbvm; do
        if [ -d "$vm" ]; then
            vm_name=$(basename "$vm" .vbvm)
            vm_size=$(du -sh "$vm" | awk '{print $1}')
            echo "  • $vm_name ($vm_size)"
            ((vm_count++))
        fi
    done
    
    echo ""
    echo "Total: $vm_count VM(s)"
}

backup_vm() {
    local vm_name="$1"
    local vm_path="$VB_VMS/${vm_name}.vbvm"
    
    if [ ! -d "$vm_path" ]; then
        echo "❌ VM not found: $vm_name"
        exit 1
    fi
    
    local backup_dir="/Volumes/tank3/vm-backups"
    mkdir -p "$backup_dir"
    
    local timestamp=$(date +%Y%m%d-%H%M%S)
    local backup_name="${vm_name}-${timestamp}.vbvm"
    local backup_path="$backup_dir/$backup_name"
    
    echo "📦 Backing up: $vm_name"
    
    # Stop VM if running
    status_vm "$vm_name" > /dev/null 2>&1 || true
    
    # Create backup
    ditto "$vm_path" "$backup_path"
    
    local size=$(du -sh "$backup_path" | awk '{print $1}')
    echo "✅ Backup created: $backup_name ($size)"
}

# Main
case "${1:-}" in
    list)
        list_vms
        ;;
    start)
        if [ -z "$2" ]; then
            echo "❌ VM name required"
            usage
            exit 1
        fi
        start_vm "$2"
        ;;
    stop)
        if [ -z "$2" ]; then
            echo "❌ VM name required"
            usage
            exit 1
        fi
        stop_vm "$2"
        ;;
    status)
        if [ -z "$2" ]; then
            echo "❌ VM name required"
            usage
            exit 1
        fi
        status_vm "$2"
        ;;
    backup)
        if [ -z "$2" ]; then
            echo "❌ VM name required"
            usage
            exit 1
        fi
        backup_vm "$2"
        ;;
    *)
        usage
        exit 1
        ;;
esac
