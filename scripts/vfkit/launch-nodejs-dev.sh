#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

# Node.js v22 Dev VM Launch Script for vfkit v0.6.1
#
# IMPORTANT: This script uses CLI flags, NOT --config YAML
# The YAML files in config/vfkit/ are documentation only
#
# Usage: ./scripts/vfkit/launch-nodejs-dev.sh
#
# Prerequisites:
# - Bootable Node.js dev disk image at ~/.vfkit/vms/nodejs-dev/disk/root.img
# - Alpine kernel and initramfs at ~/.vfkit/vms/vibecode-alpine/kernel/
# - vfkit v0.6.1 installed (brew install vfkit)
# - Workspace directory at ~/vibecode-workspace (or customize below)

# Initialize log aggregation
init_log_aggregation


set -euo pipefail

# Configuration
VM_NAME="vibecode-nodejs-dev"
CPUS=4
MEMORY=8192  # MB
MAC_ADDR="52:54:00:de:v0:01"

# Paths
KERNEL_PATH="${HOME}/.vfkit/vms/vibecode-alpine/kernel/vmlinuz"
INITRAMFS_PATH="${HOME}/.vfkit/vms/vibecode-alpine/kernel/initramfs"
DISK_PATH="${HOME}/.vfkit/vms/nodejs-dev/disk/root.img"
WORKSPACE_PATH="${HOME}/vibecode-webgui"
LOG_PATH="${HOME}/.vfkit/vms/nodejs-dev/logs/vm.log"

# Kernel command line
CMDLINE="console=hvc0 root=/dev/vda rootfstype=ext4 rw quiet"

# Validate prerequisites
echo "=== Node.js v22 Dev VM Launch ==="
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
    echo "Run scripts/vfkit/create-nodejs-dev-vm.sh first"
    exit 1
fi

if [ ! -d "$WORKSPACE_PATH" ]; then
    echo "WARNING: Workspace directory not found at $WORKSPACE_PATH"
    echo "Creating workspace directory..."
    mkdir -p "$WORKSPACE_PATH"
fi

if [ ! -x "$(command -v vfkit)" ]; then
    echo "ERROR: vfkit not found. Install with: brew install vfkit"
    exit 1
fi

# Check if already running
if pgrep -f "vfkit.*nodejs" > /dev/null; then
    echo "WARNING: Node.js dev VM appears to be already running"
    echo "To stop: pkill -f 'vfkit.*nodejs'"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Create log directory
mkdir -p "$(dirname "$LOG_PATH")"

echo ""
echo "Starting Node.js Dev VM with configuration:"
echo "  Name: $VM_NAME"
echo "  CPUs: $CPUS"
echo "  Memory: ${MEMORY}MB (8GB)"
echo "  Disk: $DISK_PATH"
echo "  Workspace (shared): $WORKSPACE_PATH"
echo "  Kernel: $KERNEL_PATH"
echo "  Initramfs: $INITRAMFS_PATH"
echo "  Log: $LOG_PATH"
echo ""
echo "Shared Filesystem:"
echo "  Host: $WORKSPACE_PATH"
echo "  Guest: mount -t virtiofs workspace /mnt/workspace"
echo "  Tag: workspace"
echo ""

# Launch vfkit with shared folder (NO --config flag!)
vfkit \
  --cpus "$CPUS" \
  --memory "$MEMORY" \
  --bootloader "linux,kernel=${KERNEL_PATH},initrd=${INITRAMFS_PATH},cmdline=${CMDLINE}" \
  --device "virtio-blk,path=${DISK_PATH}" \
  --device "virtio-net,nat,mac=${MAC_ADDR}" \
  --device "virtio-fs,sharedDir=${WORKSPACE_PATH},mountTag=workspace" \
  --device "virtio-serial,logFilePath=${LOG_PATH}" \
  --device "virtio-serial,stdio" &

VM_PID=$!
echo "VM started with PID: $VM_PID"
echo ""
echo "To view logs: tail -f $LOG_PATH"
echo "To stop VM: kill $VM_PID"
echo ""
echo "Development Environment:"
echo "  - Node.js: v22.22.0 (via nvm)"
echo "  - npm: 10.9+"
echo "  - pnpm: 9.x"
echo "  - TypeScript: 5.x"
echo "  - Build tools: gcc, g++, make, python3, rust"
echo ""
echo "Inside the VM, mount workspace:"
echo "  mkdir -p /mnt/workspace"
echo "  mount -t virtiofs workspace /mnt/workspace"
echo "  cd /mnt/workspace"
echo "  npm install"
echo "  npm run dev"
echo ""
echo "NOTE: Port forwarding must be configured separately:"
echo "  - Dev server (3000): ssh -L 3000:localhost:3000 root@<vm-ip>"
echo "  - Vite (5173): ssh -L 5173:localhost:5173 root@<vm-ip>"
echo "  - VSCode (8080): ssh -L 8080:localhost:8080 root@<vm-ip>"
echo "  - Debugger (9229): ssh -L 9229:localhost:9229 root@<vm-ip>"
echo ""
echo "See docs/VFKIT_ANALYSIS.md for pf rules (permanent forwarding)"
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
