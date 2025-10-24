#!/usr/bin/env bash
# Build custom minimal Linux kernel for M1/vfkit using Alpine container
# Linux From Scratch style - proper build environment

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_DIR="${HOME}/.vfkit/vms/vibecode-alpine/kernel"
KERNEL_VERSION="6.12.7"

echo "════════════════════════════════════════════════════════"
echo "  Building Minimal Kernel for M1/vfkit (Docker)"
echo "════════════════════════════════════════════════════════"
echo ""
echo "Using Alpine Linux container for native ARM64 build"
echo "Target: Linux ${KERNEL_VERSION}"
echo "Goal: ~8-12MB (vs 33MB stock)"
echo ""

# Check for Docker/Colima/OrbStack
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found"
    echo "Install: brew install docker colima"
    echo "   or use OrbStack"
    exit 1
fi

# Create temporary build script for container
cat > /tmp/build-kernel.sh << 'BUILDSCRIPT'
#!/bin/sh
set -e

KERNEL_VERSION="6.12.7"

echo "=== Installing build dependencies ==="
apk add build-base bc bison flex openssl-dev elfutils-dev linux-headers perl \
        xz findutils

cd /build

echo "=== Downloading kernel source ==="
if [ ! -f "linux-${KERNEL_VERSION}.tar.xz" ]; then
    wget https://cdn.kernel.org/pub/linux/kernel/v6.x/linux-${KERNEL_VERSION}.tar.xz
fi

echo "=== Extracting ==="
tar -xJf linux-${KERNEL_VERSION}.tar.xz
cd linux-${KERNEL_VERSION}

echo "=== Creating minimal config ==="

# Start with virt defconfig
make ARCH=arm64 defconfig

# Create our ultra-minimal config overlay
cat > .config.minimal << 'EOF'
# Minimal kernel for M1/vfkit
CONFIG_LOCALVERSION="-vfkit-minimal"

# Optimize for size
CONFIG_CC_OPTIMIZE_FOR_SIZE=y
CONFIG_KERNEL_XZ=y

# Disable debugging
# CONFIG_DEBUG_KERNEL is not set
# CONFIG_DEBUG_INFO is not set
# CONFIG_FTRACE is not set
# CONFIG_KPROBES is not set

# Disable modules we don't need
# CONFIG_KVM is not set
# CONFIG_USB_SUPPORT is not set
# CONFIG_MMC is not set
# CONFIG_DRM is not set
# CONFIG_FB is not set
# CONFIG_SOUND is not set
# CONFIG_WLAN is not set
# CONFIG_BT is not set
# CONFIG_WIRELESS is not set

# Enable only virtio
CONFIG_VIRTIO=y
CONFIG_VIRTIO_PCI=y
CONFIG_VIRTIO_MMIO=y
CONFIG_VIRTIO_BLK=y
CONFIG_VIRTIO_NET=y
CONFIG_VIRTIO_CONSOLE=y
CONFIG_VIRTIO_RNG=y
CONFIG_VIRTIO_BALLOON=y
CONFIG_VIRTIO_VSOCKETS=y
CONFIG_VIRTIO_FS=y

# Minimal filesystems
CONFIG_EXT4_FS=y
CONFIG_TMPFS=y
CONFIG_PROC_FS=y
CONFIG_SYSFS=y

# Basic networking
CONFIG_INET=y
CONFIG_TCP_CONG_CUBIC=y
EOF

# Merge configs
./scripts/kconfig/merge_config.sh -m .config .config.minimal

echo "=== Building kernel ==="
NCORES=$(nproc)
echo "Using ${NCORES} cores"

time make ARCH=arm64 -j${NCORES} Image

if [ ! -f "arch/arm64/boot/Image" ]; then
    echo "Build failed"
    exit 1
fi

# Copy to output
cp arch/arm64/boot/Image /output/vmlinux-minimal

echo "=== Build complete ==="
ls -lh /output/vmlinux-minimal

BUILDSCRIPT

chmod +x /tmp/build-kernel.sh

# Create output directory
mkdir -p "${OUTPUT_DIR}"

echo "🐳 Starting Alpine container build..."
echo ""

# Run build in Alpine ARM64 container
docker run --rm --platform linux/arm64 \
    -v /tmp/build-kernel.sh:/build-kernel.sh:ro \
    -v "${OUTPUT_DIR}:/output" \
    -v "${HOME}/.vfkit/kernel-build:/build" \
    alpine:edge \
    /build-kernel.sh

if [[ ! -f "${OUTPUT_DIR}/vmlinux-minimal" ]]; then
    echo "❌ Build failed"
    exit 1
fi

echo ""
echo "════════════════════════════════════════════════════════"
echo "  Build Complete!"
echo "════════════════════════════════════════════════════════"
echo ""

# Compare sizes
STOCK_SIZE=$(du -h "${OUTPUT_DIR}/vmlinux-3.22" 2>/dev/null | cut -f1 || echo "N/A")
MINIMAL_SIZE=$(du -h "${OUTPUT_DIR}/vmlinux-minimal" | cut -f1)

echo "Stock Alpine virt kernel:  ${STOCK_SIZE}"
echo "Custom minimal kernel:     ${MINIMAL_SIZE}"
echo ""

if [[ -f "${OUTPUT_DIR}/vmlinux-3.22" ]]; then
    STOCK_BYTES=$(stat -f%z "${OUTPUT_DIR}/vmlinux-3.22" 2>/dev/null || stat -c%s "${OUTPUT_DIR}/vmlinux-3.22")
    MINIMAL_BYTES=$(stat -f%z "${OUTPUT_DIR}/vmlinux-minimal" 2>/dev/null || stat -c%s "${OUTPUT_DIR}/vmlinux-minimal")
    SAVED_BYTES=$((STOCK_BYTES - MINIMAL_BYTES))
    SAVED_MB=$((SAVED_BYTES / 1024 / 1024))
    PERCENT=$((100 * (STOCK_BYTES - MINIMAL_BYTES) / STOCK_BYTES))

    echo "Savings: ${SAVED_MB}MB (${PERCENT}%)"
fi

echo ""
echo "Minimal kernel: ${OUTPUT_DIR}/vmlinux-minimal"
echo ""
echo "To use:"
echo "  cd ${OUTPUT_DIR} && ln -sf vmlinux-minimal vmlinux"
echo ""
echo "To test:"
echo "  ./scripts/vfkit/09-launch-node24-vm.sh"
echo ""

rm -f /tmp/build-kernel.sh
