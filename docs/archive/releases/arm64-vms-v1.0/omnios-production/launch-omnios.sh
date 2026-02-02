#!/bin/bash
# Launch OmniOS ARM64 on QEMU with Hypervisor.framework
# For VibeCode production deployment testing
# Part of VibeCode ARM64 VMs Release v1.0

set -e  # Exit on error

# Change to script directory
cd "$(dirname "$0")"

# Configuration
UEFI_FIRMWARE="/opt/homebrew/share/qemu/edk2-aarch64-code.fd"
DISK_IMAGE="omnios-arm64.qcow2"
VM_NAME="omnios-arm64-production"
VM_CPUS=4
VM_MEMORY=8192
SSH_PORT=2222

# Check QEMU installation
if ! command -v qemu-system-aarch64 &> /dev/null; then
    echo "❌ Error: qemu-system-aarch64 not found"
    echo "   Install with: brew install qemu"
    exit 1
fi

# Check UEFI firmware
if [ ! -f "$UEFI_FIRMWARE" ]; then
    echo "❌ Error: UEFI firmware not found at $UEFI_FIRMWARE"
    echo "   Install QEMU with: brew install qemu"
    exit 1
fi

# Check disk image
if [ ! -f "$DISK_IMAGE" ]; then
    echo "❌ Error: OmniOS disk image not found: $DISK_IMAGE"
    echo "   See DOWNLOAD-OMNIOS.md for setup instructions"
    exit 1
fi

echo "🚀 Starting OmniOS ARM64 Virtual Machine"
echo "=========================================="
echo ""
echo "Configuration:"
echo "  • OmniOS r151055 (ARM64/aarch64)"
echo "  • $VM_CPUS CPU cores, ${VM_MEMORY}MB RAM"
echo "  • 58GB virtual disk (qcow2)"
echo "  • Hypervisor.framework acceleration"
echo "  • SSH: localhost:$SSH_PORT"
echo ""
echo "Boot time: ~15-20 seconds"
echo "To exit: Type 'poweroff' or Ctrl-A then X"
echo ""
echo "Starting boot..."
echo ""

qemu-system-aarch64 \
  -name "$VM_NAME" \
  -machine virt \
  -cpu host \
  -accel hvf \
  -smp "$VM_CPUS" \
  -m "$VM_MEMORY" \
  -bios "$UEFI_FIRMWARE" \
  -drive file="$DISK_IMAGE",if=virtio,format=qcow2 \
  -device virtio-net-pci,netdev=net0 \
  -netdev user,id=net0,hostfwd=tcp::"$SSH_PORT"-:22 \
  -nographic \
  -serial mon:stdio

echo ""
echo "VM has shut down."
echo ""
