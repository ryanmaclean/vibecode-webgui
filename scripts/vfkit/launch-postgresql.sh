#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

# PostgreSQL + pgvector VM Launch Script for vfkit v0.6.1
#
# IMPORTANT: This script uses CLI flags, NOT --config YAML
# The YAML files in config/vfkit/ are documentation only
#
# Usage: ./scripts/vfkit/launch-postgresql.sh
#
# Prerequisites:
# - Bootable PostgreSQL disk images:
#   - root.img (20GB) - OS and PostgreSQL binaries
#   - data.img (100GB) - PostgreSQL data directory
#   - backup.img (50GB) - Backup storage
# - Alpine kernel and initramfs at ~/.vfkit/vms/vibecode-alpine/kernel/
# - vfkit v0.6.1 installed (brew install vfkit)

# Initialize log aggregation
init_log_aggregation


set -euo pipefail

# Configuration
VM_NAME="vibecode-postgresql"
CPUS=4
MEMORY=8192  # MB
MAC_ADDR="52:54:00:12:34:58"

# Paths
KERNEL_PATH="${HOME}/.vfkit/vms/vibecode-alpine/kernel/vmlinuz"
INITRAMFS_PATH="${HOME}/.vfkit/vms/vibecode-alpine/kernel/initramfs"
ROOT_DISK="${HOME}/.vfkit/vms/postgresql/disk/root.img"
DATA_DISK="${HOME}/.vfkit/vms/postgresql/disk/data.img"
BACKUP_DISK="${HOME}/.vfkit/vms/postgresql/disk/backup.img"
LOG_PATH="${HOME}/.vfkit/vms/postgresql/logs/vm.log"

# Kernel command line
CMDLINE="console=hvc0 root=/dev/vda rootfstype=ext4 rw quiet"

# Validate prerequisites
echo "=== PostgreSQL + pgvector VM Launch ==="
echo "Validating prerequisites..."

if [ ! -f "$KERNEL_PATH" ]; then
    echo "ERROR: Kernel not found at $KERNEL_PATH"
    exit 1
fi

if [ ! -f "$INITRAMFS_PATH" ]; then
    echo "ERROR: Initramfs not found at $INITRAMFS_PATH"
    exit 1
fi

if [ ! -f "$ROOT_DISK" ]; then
    echo "ERROR: Root disk not found at $ROOT_DISK"
    echo "Run scripts/vfkit/create-postgresql-vm.sh first"
    exit 1
fi

if [ ! -f "$DATA_DISK" ]; then
    echo "ERROR: Data disk not found at $DATA_DISK"
    echo "Run scripts/vfkit/create-postgresql-vm.sh first"
    exit 1
fi

if [ ! -f "$BACKUP_DISK" ]; then
    echo "ERROR: Backup disk not found at $BACKUP_DISK"
    echo "Run scripts/vfkit/create-postgresql-vm.sh first"
    exit 1
fi

if [ ! -x "$(command -v vfkit)" ]; then
    echo "ERROR: vfkit not found. Install with: brew install vfkit"
    exit 1
fi

# Check if already running
if pgrep -f "vfkit.*postgresql" > /dev/null; then
    echo "WARNING: PostgreSQL VM appears to be already running"
    echo "To stop: pkill -f 'vfkit.*postgresql'"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Create log directory
mkdir -p "$(dirname "$LOG_PATH")"

echo ""
echo "Starting PostgreSQL VM with configuration:"
echo "  Name: $VM_NAME"
echo "  CPUs: $CPUS"
echo "  Memory: ${MEMORY}MB (8GB)"
echo "  Root Disk: $ROOT_DISK"
echo "  Data Disk: $DATA_DISK (will be mounted at /var/lib/postgresql)"
echo "  Backup Disk: $BACKUP_DISK (will be mounted at /mnt/backup)"
echo "  Kernel: $KERNEL_PATH"
echo "  Initramfs: $INITRAMFS_PATH"
echo "  Log: $LOG_PATH"
echo ""
echo "Disk device mapping:"
echo "  /dev/vda = root.img (OS and binaries)"
echo "  /dev/vdb = data.img (PostgreSQL data)"
echo "  /dev/vdc = backup.img (backup storage)"
echo ""

# Launch vfkit with multiple disks (NO --config flag!)
vfkit \
  --cpus "$CPUS" \
  --memory "$MEMORY" \
  --bootloader "linux,kernel=${KERNEL_PATH},initrd=${INITRAMFS_PATH},cmdline=${CMDLINE}" \
  --device "virtio-blk,path=${ROOT_DISK}" \
  --device "virtio-blk,path=${DATA_DISK}" \
  --device "virtio-blk,path=${BACKUP_DISK}" \
  --device "virtio-net,nat,mac=${MAC_ADDR}" \
  --device "virtio-serial,logFilePath=${LOG_PATH}" \
  --device "virtio-serial,stdio" &

VM_PID=$!
echo "VM started with PID: $VM_PID"
echo ""
echo "To view logs: tail -f $LOG_PATH"
echo "To stop VM: kill $VM_PID"
echo ""
echo "PostgreSQL Configuration:"
echo "  - Database: vibecode"
echo "  - User: vibecode"
echo "  - Port: 5432 (requires port forwarding)"
echo "  - Extensions: pgvector"
echo ""
echo "NOTE: Port forwarding must be configured separately:"
echo "  Option 1 (SSH tunnel): ssh -L 5432:localhost:5432 root@<vm-ip>"
echo "  Option 2 (pf rules): See docs/VFKIT_ANALYSIS.md"
echo ""

# Wait a moment and check if still running
sleep 2
if ps -p $VM_PID > /dev/null; then
    echo "✓ VM is running"
    echo ""
    echo "Inside the VM, data disk should be mounted:"
    echo "  mount /dev/vdb /var/lib/postgresql"
    echo "  mount /dev/vdc /mnt/backup"
else
    echo "✗ VM failed to start. Check logs:"
    tail -20 "$LOG_PATH"
    exit 1
fi
