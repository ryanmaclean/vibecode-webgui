#!/bin/bash
# Valkey VM Launch Script for vfkit v0.6.1
#
# IMPORTANT: This script uses CLI flags, NOT --config YAML
# The YAML files in config/vfkit/ are documentation only
#
# Usage: ./scripts/vfkit/launch-valkey.sh
#
# Prerequisites:
# - Bootable Valkey disk image at ~/.vfkit/vms/valkey/disk/root.img
# - Alpine kernel and initramfs at ~/.vfkit/vms/vibecode-alpine/kernel/
# - vfkit v0.6.1 installed (brew install vfkit)

set -euo pipefail

# Configuration
VM_NAME="vibecode-valkey"
CPUS=2
MEMORY=1024  # MB
MAC_ADDR="52:54:00:12:34:59"

# Paths
KERNEL_PATH="${HOME}/.vfkit/vms/vibecode-alpine/kernel/vmlinuz"
INITRAMFS_PATH="${HOME}/.vfkit/vms/vibecode-alpine/kernel/initramfs"
DISK_PATH="${HOME}/.vfkit/vms/valkey/disk/root.img"
LOG_PATH="${HOME}/.vfkit/vms/valkey/logs/vm.log"

# Kernel command line
CMDLINE="console=hvc0 root=/dev/vda rootfstype=ext4 rw quiet"

# Validate prerequisites
echo "=== Valkey VM Launch ==="
echo "Validating prerequisites..."

if [ ! -f "$KERNEL_PATH" ]; then
    echo "ERROR: Kernel not found at $KERNEL_PATH"
    exit 1
fi

if [ ! -f "$INITRAMFS_PATH" ]; then
    echo "ERROR: Initramfs not found at $INITRAMFS_PATH"
    exit 1
fi

if [ ! -f "$DISK_PATH" ]; then
    echo "ERROR: Disk image not found at $DISK_PATH"
    echo "Run scripts/vfkit/create-valkey-vm.sh first to create the disk image"
    exit 1
fi

if [ ! -x "$(command -v vfkit)" ]; then
    echo "ERROR: vfkit not found. Install with: brew install vfkit"
    exit 1
fi

# Check if already running
if pgrep -f "vfkit.*valkey" > /dev/null; then
    echo "WARNING: Valkey VM appears to be already running"
    echo "To stop: pkill -f 'vfkit.*valkey'"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Create log directory
mkdir -p "$(dirname "$LOG_PATH")"

echo ""
echo "Starting Valkey VM with configuration:"
echo "  Name: $VM_NAME"
echo "  CPUs: $CPUS"
echo "  Memory: ${MEMORY}MB"
echo "  Disk: $DISK_PATH"
echo "  Kernel: $KERNEL_PATH"
echo "  Initramfs: $INITRAMFS_PATH"
echo "  Log: $LOG_PATH"
echo ""

# Launch vfkit with correct CLI flags (NO --config flag!)
vfkit \
  --cpus "$CPUS" \
  --memory "$MEMORY" \
  --bootloader "linux,kernel=${KERNEL_PATH},initrd=${INITRAMFS_PATH},cmdline=${CMDLINE}" \
  --device "virtio-blk,path=${DISK_PATH}" \
  --device "virtio-net,nat,mac=${MAC_ADDR}" \
  --device "virtio-serial,logFilePath=${LOG_PATH}" \
  --device "virtio-serial,stdio" &

VM_PID=$!
echo "VM started with PID: $VM_PID"
echo ""
echo "To view logs: tail -f $LOG_PATH"
echo "To stop VM: kill $VM_PID"
echo "To connect: Once networking is up, Valkey will be accessible"
echo ""
echo "NOTE: Port forwarding must be configured separately:"
echo "  Option 1 (SSH tunnel): ssh -L 6379:localhost:6379 root@<vm-ip>"
echo "  Option 2 (pf rules): See docs/VFKIT_ANALYSIS.md"
echo ""

# Wait a moment and check if still running
sleep 2
if ps -p $VM_PID > /dev/null; then
    echo "✓ VM is running"
else
    echo "✗ VM failed to start. Check logs:"
    tail -20 "$LOG_PATH"
    exit 1
fi
