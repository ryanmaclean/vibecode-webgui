#!/bin/bash

# VibeCode ARM64 VM Demonstration
# Shows how illumos/Alpine VMs work on Apple Silicon

set -e

echo "🚀 VibeCode ARM64 VM Demonstration"
echo "===================================="
echo ""

# Configuration
VM_NAME="vibecode-demo-arm64"
VM_MEMORY="2048"  # 2GB
VM_CPUS="2"
VM_DISK="demo-disk.qcow2"
ISO_FILE="alpine-arm64.iso"

# Check requirements
echo "✅ Checking requirements..."
if ! command -v qemu-system-aarch64 >/dev/null; then
    echo "❌ qemu-system-aarch64 not found"
    echo "   Install with: brew install qemu"
    exit 1
fi

if [ ! -f "/opt/homebrew/share/qemu/edk2-aarch64-code.fd" ]; then
    echo "❌ UEFI firmware not found"
    exit 1
fi

echo "   ✓ QEMU ARM64: $(qemu-system-aarch64 --version | head -1)"
echo "   ✓ UEFI firmware: /opt/homebrew/share/qemu/edk2-aarch64-code.fd"
echo ""

# Create disk if needed
if [ ! -f "$VM_DISK" ]; then
    echo "💾 Creating virtual disk (8GB)..."
    qemu-img create -f qcow2 "$VM_DISK" 8G
    echo "   ✓ Disk created: $VM_DISK"
fi
echo ""

# Check ISO
if [ ! -f "$ISO_FILE" ]; then
    echo "❌ Alpine ISO not found: $ISO_FILE"
    echo "   Download with:"
    echo "   curl -L https://dl-cdn.alpinelinux.org/alpine/v3.20/releases/aarch64/alpine-virt-3.20.3-aarch64.iso -o $ISO_FILE"
    exit 1
fi
echo "✅ Alpine ISO ready: $ISO_FILE ($(ls -lh $ISO_FILE | awk '{print $5}'))"
echo ""

# Launch VM
echo "🚀 Launching ARM64 VM..."
echo ""
echo "VM Configuration:"
echo "  Name: $VM_NAME"
echo "  Architecture: aarch64 (ARM64)"
echo "  CPUs: $VM_CPUS cores"
echo "  Memory: ${VM_MEMORY}MB"
echo "  Disk: $VM_DISK"
echo "  ISO: $ISO_FILE"
echo "  UEFI: /opt/homebrew/share/qemu/edk2-aarch64-code.fd"
echo "  Acceleration: Hypervisor.framework (macOS native)"
echo ""
echo "🎯 This demonstrates the same setup used for:"
echo "   • OmniOS ARM64 (production)"
echo "   • Alpine Linux (development)"
echo "   • Any illumos ARM64 distribution"
echo ""
echo "Press Ctrl+C to exit this message, then:"
echo "  • VM will boot in new window"
echo "  • Login as root (no password)"
echo "  • Type 'poweroff' to shutdown cleanly"
echo ""
read -p "Press Enter to start VM..." || true
echo ""

# Start QEMU with ARM64
qemu-system-aarch64 \
  -name "$VM_NAME" \
  -machine virt \
  -cpu host \
  -accel hvf \
  -smp $VM_CPUS \
  -m $VM_MEMORY \
  -bios /opt/homebrew/share/qemu/edk2-aarch64-code.fd \
  -drive file=$VM_DISK,if=none,id=hd0,format=qcow2 \
  -device virtio-blk-pci,drive=hd0 \
  -cdrom $ISO_FILE \
  -boot d \
  -device virtio-net-pci,netdev=net0 \
  -netdev user,id=net0,hostfwd=tcp::2222-:22 \
  -device virtio-gpu-pci \
  -device qemu-xhci \
  -device usb-kbd \
  -device usb-mouse \
  -display cocoa \
  -monitor stdio

echo ""
echo "✅ VM exited cleanly"
