#!/usr/bin/env bash
# Launch Node.js Development VM with vfkit
# Alpine Linux with Node.js v22 LTS, Rust, and development tools

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
VM_DIR="${HOME}/.vfkit/vms/vibecode-nodejs-dev"
KERNEL_DIR="${HOME}/.vfkit/vms/vibecode-alpine/kernel"
DISK_DIR="${VM_DIR}/disk"
LOG_DIR="${HOME}/.vibecode/vm-logs"

# VM Configuration
VM_NAME="vibecode-nodejs-dev"
VM_CPUS=4
VM_MEMORY=8192  # 8GB RAM for npm/pnpm builds

# Files
KERNEL="${KERNEL_DIR}/vmlinux"
INITRAMFS="${KERNEL_DIR}/initramfs"
DISK_IMAGE="${DISK_DIR}/root.img"
CONSOLE_LOG="${LOG_DIR}/${VM_NAME}.log"

# vfkit binary from Tauri resources
VFKIT_BIN="${REPO_ROOT}/src-tauri/resources/vfkit-aarch64-apple-darwin"

echo "=== Launching VibeCode Node.js Dev VM ==="
echo ""

# Verify vfkit binary
if [[ ! -x "$VFKIT_BIN" ]]; then
    echo "❌ vfkit binary not found: $VFKIT_BIN"
    exit 1
fi

echo "✅ vfkit: $VFKIT_BIN"

# Verify kernel exists
if [[ ! -f "$KERNEL" ]]; then
    echo "❌ Kernel not found: $KERNEL"
    exit 1
fi

echo "✅ Kernel: $KERNEL ($(du -h "$KERNEL" | cut -f1))"

# Verify initramfs
if [[ ! -f "$INITRAMFS" ]]; then
    echo "❌ Initramfs not found: $INITRAMFS"
    exit 1
fi

echo "✅ Initramfs: $INITRAMFS ($(du -h "$INITRAMFS" | cut -f1))"

# Verify disk
if [[ ! -f "$DISK_IMAGE" ]]; then
    echo "❌ Disk image not found: $DISK_IMAGE"
    exit 1
fi

echo "✅ Disk: $DISK_IMAGE ($(du -h "$DISK_IMAGE" | cut -f1))"
echo ""

# Prepare console log
mkdir -p "${LOG_DIR}"
: > "$CONSOLE_LOG"

echo "📋 Console log: $CONSOLE_LOG"
echo ""

# VM Configuration Summary
echo "=== VM Configuration ==="
echo "Name:     ${VM_NAME}"
echo "CPUs:     ${VM_CPUS}"
echo "Memory:   ${VM_MEMORY} MB"
echo "Ports:    3000 (Next.js), 5173 (Vite), 8080 (OpenVSCode), 9229 (Debugger)"
echo ""

# Kernel command line
CMDLINE="console=hvc0 root=/dev/vda rw quiet"

echo "Kernel cmdline: ${CMDLINE}"
echo ""

# Build vfkit command
VFKIT_CMD=(
    "$VFKIT_BIN"
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

# Add network device with NAT and port forwarding
VFKIT_CMD+=(
    --device
    "virtio-net,nat,mac=52:54:00:de:01:01"
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

# Add shared directory for workspace (virtiofs)
# Note: vfkit may need rosetta for virtiofs on some versions
# VFKIT_CMD+=(
#     --device
#     "virtio-fs,sharedDir=${HOME}/vibecode-workspace,mountTag=workspace"
# )

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
}

trap cleanup EXIT

# Launch VM
"${VFKIT_CMD[@]}"
