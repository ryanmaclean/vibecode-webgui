#!/usr/bin/env bash
# Launch Alpine Linux ARM64 VM with vfkit
# Boots the VM with kernel, initramfs, and networking

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VM_DIR="${HOME}/.vfkit/vms/vibecode-alpine"
KERNEL_DIR="${VM_DIR}/kernel"
ROOTFS_DIR="${VM_DIR}/rootfs"
DISK_DIR="${VM_DIR}/disk"
LOG_DIR="${VM_DIR}/logs"

# VM Configuration
VM_NAME="vibecode-alpine"
VM_CPUS="${VFKIT_CPUS:-4}"
VM_MEMORY="${VFKIT_MEMORY:-4096}"  # MB
VM_DISK_SIZE="${VFKIT_DISK_SIZE:-20G}"

# Files
KERNEL="${KERNEL_DIR}/vmlinux"  # Uncompressed kernel (required by vfkit)
KERNEL_COMPRESSED="${KERNEL_DIR}/vmlinuz"  # Compressed kernel from ISO
INITRAMFS_KERNEL="${KERNEL_DIR}/initramfs"  # From Alpine ISO
INITRAMFS_CUSTOM="${ROOTFS_DIR}/alpine-vibecode-rootfs.cpio.gz"  # Our custom rootfs
DISK_IMAGE="${DISK_DIR}/root.img"
CONSOLE_LOG="${LOG_DIR}/console.log"

echo "=== Launching VibeCode Alpine VM with vfkit ==="
echo ""

# Verify vfkit is installed
if ! command -v vfkit &> /dev/null; then
    echo "❌ vfkit is not installed"
    echo "Run: ./scripts/vfkit/01-setup-vfkit.sh"
    exit 1
fi

echo "✅ vfkit found: $(which vfkit)"
echo ""

# Verify kernel exists
if [[ ! -f "$KERNEL" ]]; then
    echo "❌ Kernel not found: $KERNEL"
    echo "Run: ./scripts/vfkit/02-download-alpine-kernel.sh"
    exit 1
fi

echo "✅ Kernel: $KERNEL ($(du -h "$KERNEL" | cut -f1))"

# Determine which initramfs to use
INITRAMFS=""
if [[ -f "$INITRAMFS_CUSTOM" ]]; then
    INITRAMFS="$INITRAMFS_CUSTOM"
    echo "✅ Using custom rootfs: $INITRAMFS ($(du -h "$INITRAMFS" | cut -f1))"
elif [[ -f "$INITRAMFS_KERNEL" ]]; then
    INITRAMFS="$INITRAMFS_KERNEL"
    echo "⚠️  Using Alpine initramfs: $INITRAMFS ($(du -h "$INITRAMFS" | cut -f1))"
    echo "   (Run 03-create-alpine-rootfs.sh for full VibeCode environment)"
else
    echo "❌ No initramfs found"
    echo "Run: ./scripts/vfkit/02-download-alpine-kernel.sh"
    exit 1
fi

echo ""

# Create disk image if it doesn't exist
mkdir -p "${DISK_DIR}"

if [[ ! -f "$DISK_IMAGE" ]]; then
    echo "📀 Creating disk image: ${VM_DISK_SIZE}"
    if command -v qemu-img &> /dev/null; then
        qemu-img create -f raw "$DISK_IMAGE" "$VM_DISK_SIZE"
    else
        # Create sparse file as fallback
        dd if=/dev/zero of="$DISK_IMAGE" bs=1 count=0 seek="$VM_DISK_SIZE" 2>/dev/null
    fi
    echo "✅ Disk image created: $DISK_IMAGE"
else
    echo "✅ Using existing disk: $DISK_IMAGE ($(du -h "$DISK_IMAGE" | cut -f1))"
fi

echo ""

# Prepare console log
mkdir -p "${LOG_DIR}"
: > "$CONSOLE_LOG"  # Truncate log file

echo "📋 Console log: $CONSOLE_LOG"
echo ""

# VM Configuration Summary
echo "=== VM Configuration ==="
echo "Name:     ${VM_NAME}"
echo "CPUs:     ${VM_CPUS}"
echo "Memory:   ${VM_MEMORY} MB"
echo "Disk:     ${VM_DISK_SIZE}"
echo ""

# Kernel command line
CMDLINE="console=hvc0 root=/dev/vda rw quiet"

# Additional options for debugging (uncomment if needed)
# CMDLINE="${CMDLINE} debug loglevel=7"

echo "Kernel cmdline: ${CMDLINE}"
echo ""

# Build vfkit command
VFKIT_CMD=(
    vfkit
    --cpus "$VM_CPUS"
    --memory "$VM_MEMORY"
    --kernel "$KERNEL"
    --initrd "$INITRAMFS"
    --kernel-cmdline "$CMDLINE"
)

# Add block device (disk)
VFKIT_CMD+=(
    --device
    "virtio-blk,path=$DISK_IMAGE"
)

# Add network device with NAT
VFKIT_CMD+=(
    --device
    "virtio-net,nat,mac=52:54:00:12:34:56"
)

# Add serial console for logging
VFKIT_CMD+=(
    --device
    "virtio-serial,logFilePath=$CONSOLE_LOG"
)

# Add random number generator
VFKIT_CMD+=(
    --device
    "virtio-rng"
)

# Add virtio vsock for host-guest communication
VFKIT_CMD+=(
    --device
    "virtio-vsock,port=1024,socketURL=unix://${VM_DIR}/vsock.sock"
)

# Port forwarding (code-server on 8080)
# Note: vfkit's NAT handles this automatically for outbound connections
# For inbound, we'll use port forwarding or direct access

echo "=== Starting VM ==="
echo ""
echo "Command:"
echo "${VFKIT_CMD[@]}"
echo ""
echo "Press Ctrl+C to stop the VM"
echo ""
echo "-----------------------------------"
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "-----------------------------------"
    echo ""
    echo "VM stopped"
    echo ""
    echo "Console log: $CONSOLE_LOG"
    echo ""
    echo "To view logs: tail -f $CONSOLE_LOG"
    echo ""
}

trap cleanup EXIT

# Launch VM
"${VFKIT_CMD[@]}"
