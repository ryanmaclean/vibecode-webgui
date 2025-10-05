#!/bin/bash
set -e

VM_DIR="$HOME/.vibecode/vm"
KERNEL_VERSION="6.6.68"

echo "🔽 Downloading Linux kernel for macOS Virtualization.framework..."

mkdir -p "$VM_DIR"
cd "$VM_DIR"

# Download kernel and initramfs from the cloud-hypervisor release
echo "📦 Fetching kernel components..."
curl -sL https://github.com/ryanmaclean/vibecode-webgui/releases/download/cloud-hypervisor-v1.0.0-alpha/vibecode-cloud-hypervisor-binaries-v1.0.0.tar.gz | \
  tar xz --strip-components=0 vmlinuz-${KERNEL_VERSION}-mseries initramfs

# Rename for consistency
mv "vmlinuz-${KERNEL_VERSION}-mseries" vmlinuz 2>/dev/null || true

echo "✅ Kernel components downloaded:"
ls -lh "$VM_DIR/vmlinuz" "$VM_DIR/initramfs"

echo ""
echo "📍 Files installed to: $VM_DIR"
echo "🚀 Ready to run: swift run --package-path macos-vm"
