#!/usr/bin/env bash
# Launch VibeCode Alpine VM with Node.js 24 + OpenVSCode Server using vfkit

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VM_DIR="${HOME}/.vfkit/vms/vibecode-alpine"
KERNEL_DIR="${VM_DIR}/kernel"
ROOTFS_DIR="${VM_DIR}/rootfs"
DISK_DIR="${VM_DIR}/disk"
LOGS_DIR="${VM_DIR}/logs"

# VM Configuration
VFKIT_CPUS="${VFKIT_CPUS:-4}"
VFKIT_MEMORY="${VFKIT_MEMORY:-4096}"
VFKIT_DISK_SIZE="${VFKIT_DISK_SIZE:-20G}"
VM_NAME="vibecode-alpine-vscode"

echo "=== Launching VibeCode Alpine VM with VS Code Server ==="
echo ""

# Check for vfkit
if ! command -v vfkit &> /dev/null; then
    echo "❌ vfkit not found"
    echo ""
    echo "Install it:"
    echo "  brew install vfkit"
    echo ""
    exit 1
fi

echo "✅ vfkit found: $(which vfkit)"
echo ""

# Check for kernel
KERNEL_PATH="${KERNEL_DIR}/vmlinux"
if [[ ! -f "${KERNEL_PATH}" ]]; then
    echo "❌ Kernel not found: ${KERNEL_PATH}"
    echo ""
    echo "Run setup first:"
    echo "  ./scripts/vfkit/10-upgrade-to-alpine-3.22.sh"
    echo ""
    exit 1
fi

KERNEL_SIZE=$(du -h "${KERNEL_PATH}" | cut -f1)
echo "✅ Kernel: ${KERNEL_PATH} (${KERNEL_SIZE})"

# Check for rootfs
ROOTFS_PATH="${ROOTFS_DIR}/alpine-vscode-server-rootfs.cpio.gz"
if [[ ! -f "${ROOTFS_PATH}" ]]; then
    echo "❌ Rootfs not found: ${ROOTFS_PATH}"
    echo ""
    echo "Create it first:"
    echo "  ./scripts/vfkit/12-create-vscode-server-rootfs.sh"
    echo ""
    exit 1
fi

ROOTFS_SIZE=$(du -h "${ROOTFS_PATH}" | cut -f1)
echo "✅ Using rootfs with VS Code Server: ${ROOTFS_PATH} (${ROOTFS_SIZE})"
echo ""

# Note: We're booting from initramfs (entire rootfs in RAM), no persistent disk needed
# If you need persistent storage, add virtio-blk device manually

echo "ℹ️  Booting from initramfs (no persistent disk)"
echo ""

# Create logs directory
mkdir -p "${LOGS_DIR}"
CONSOLE_LOG="${LOGS_DIR}/console.log"
echo "📋 Console log: ${CONSOLE_LOG}"
echo ""

# VM Configuration Summary
echo "=== VM Configuration ==="
echo "Name:     ${VM_NAME}"
echo "CPUs:     ${VFKIT_CPUS}"
echo "Memory:   ${VFKIT_MEMORY} MB"
echo "Disk:     ${VFKIT_DISK_SIZE}"
echo ""

# Kernel command line
# Boot from initramfs and stay in it (don't try to mount root)
CMDLINE="console=hvc0 rw init=/sbin/init"
echo "Kernel cmdline: ${CMDLINE}"
echo ""

# vfkit command
echo "=== Starting VM ==="
echo ""
echo "Command:"
echo "vfkit \\"
echo "  --cpus ${VFKIT_CPUS} \\"
echo "  --memory ${VFKIT_MEMORY} \\"
echo "  --kernel ${KERNEL_PATH} \\"
echo "  --initrd ${ROOTFS_PATH} \\"
echo "  --kernel-cmdline \"${CMDLINE}\" \\"
echo "  --device virtio-net,nat,mac=52:54:00:12:34:56 \\"
echo "  --device virtio-serial,logFilePath=${CONSOLE_LOG} \\"
echo "  --device virtio-rng \\"
echo "  --device virtio-vsock,port=1024,socketURL=unix://${VM_DIR}/vsock.sock"
echo ""
echo "Press Ctrl+C to stop the VM"
echo ""
echo "-----------------------------------"
echo ""

# Cleanup function
cleanup() {
    echo ""
    echo ""
    echo "-----------------------------------"
    echo ""
    echo "VM stopped"
    echo ""
    echo "Console log: ${CONSOLE_LOG}"
    echo ""
    echo "To view logs: tail -f ${CONSOLE_LOG}"
    echo ""
    echo "To start OpenVSCode Server:"
    echo "  1. Boot VM again with this script"
    echo "  2. Login as root (no password)"
    echo "  3. Run: start-vscode"
    echo "  4. Access: http://localhost:3000"
    echo ""
}

trap cleanup EXIT

# Launch vfkit
vfkit \
    --cpus "${VFKIT_CPUS}" \
    --memory "${VFKIT_MEMORY}" \
    --kernel "${KERNEL_PATH}" \
    --initrd "${ROOTFS_PATH}" \
    --kernel-cmdline "${CMDLINE}" \
    --device virtio-net,nat,mac=52:54:00:12:34:56 \
    --device virtio-serial,logFilePath="${CONSOLE_LOG}" \
    --device virtio-rng \
    --device virtio-vsock,port=1024,socketURL=unix://${VM_DIR}/vsock.sock
