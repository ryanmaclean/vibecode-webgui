#!/bin/bash
# Agent 1: Download Alpine Linux kernel for networking test
set -e

ALPINE_VERSION="3.19"
ARCH="aarch64"
VM_DIR="$HOME/.vfkit/vms/test-networking"
KERNEL_DIR="$VM_DIR/kernel"

echo "=== Agent 1: Downloading Alpine Kernel ==="
mkdir -p "$KERNEL_DIR"

# Download Alpine kernel
echo "Downloading Alpine Linux $ALPINE_VERSION kernel..."
cd "$KERNEL_DIR"

# Try to download from Alpine CDN
KERNEL_URL="https://dl-cdn.alpinelinux.org/alpine/v${ALPINE_VERSION}/releases/${ARCH}/alpine-virt-${ALPINE_VERSION}.1-${ARCH}.iso"

echo "Kernel URL: $KERNEL_URL"
echo "Downloading (this may take a minute)..."

if command -v curl &> /dev/null; then
    curl -L -o alpine.iso "$KERNEL_URL" || echo "⚠️  Direct download failed, may need manual download"
else
    echo "⚠️  curl not found, please download manually"
fi

echo ""
echo "Next: Extract kernel and initramfs from ISO"
echo "Then: Create VM and test networking"
