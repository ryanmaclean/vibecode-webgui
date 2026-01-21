#!/bin/bash
# Quick launch script for ARM64 VM demo
# Part of VibeCode ARM64 VMs Release v1.0

set -e  # Exit on error

# Change to script directory
cd "$(dirname "$0")"

# Configuration
UEFI_FIRMWARE="/opt/homebrew/share/qemu/edk2-aarch64-code.fd"
ISO_FILE="alpine-arm64.iso"
DISK_FILE="demo-disk.qcow2"

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

# Check ISO file
if [ ! -f "$ISO_FILE" ]; then
    echo "❌ Error: Alpine ISO not found: $ISO_FILE"
    echo "   See DOWNLOAD-ALPINE.md for download instructions"
    exit 1
fi

# Create disk if needed
if [ ! -f "$DISK_FILE" ]; then
    echo "💾 Creating virtual disk (8GB)..."
    qemu-img create -f qcow2 "$DISK_FILE" 8G
    echo "   ✓ Disk created: $DISK_FILE"
    echo ""
fi

echo "🚀 Launching ARM64 VM (Alpine Linux)"
echo "===================================="
echo ""
echo "This demonstrates the same technology used for:"
echo "  • OmniOS ARM64 (production illumos)"
echo "  • Alpine Linux (lightweight development)"
echo "  • Any ARM64 operating system"
echo ""
echo "VM Details:"
echo "  Architecture: aarch64 (ARM64) - same as Apple Silicon M1/M2/M3"
echo "  Acceleration: Hypervisor.framework (macOS native)"
echo "  CPU: 2 cores (host passthrough)"
echo "  Memory: 2GB"
echo "  Disk: 8GB qcow2"
echo "  Network: NAT with port forwarding (SSH on 2222)"
echo ""
echo "Once VM boots:"
echo "  1. Login as 'root' (no password needed)"
echo "  2. Try commands: uname -m, cat /etc/os-release"
echo "  3. Type 'poweroff' to shutdown cleanly"
echo ""
echo "Starting VM in 3 seconds..."
sleep 3

qemu-system-aarch64 \
  -name "vibecode-arm64-demo" \
  -machine virt \
  -cpu host \
  -accel hvf \
  -smp 2 \
  -m 2048 \
  -bios "$UEFI_FIRMWARE" \
  -drive file="$DISK_FILE",if=none,id=hd0,format=qcow2 \
  -device virtio-blk-pci,drive=hd0 \
  -cdrom "$ISO_FILE" \
  -boot d \
  -device virtio-net-pci,netdev=net0 \
  -netdev user,id=net0,hostfwd=tcp::2222-:22 \
  -nographic \
  -serial mon:stdio

echo ""
echo "✅ VM exited"
