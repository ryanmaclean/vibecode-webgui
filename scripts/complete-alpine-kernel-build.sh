#!/bin/bash
# Complete Alpine Linux Kernel Build for Apple Silicon M-Series
# Agent 30 - Senior Kernel Engineer (Apple Darwin Team)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BUILD_DIR="/tmp/alpine-kernel-mseries"
OUTPUT_DIR="$PROJECT_ROOT/config/macos/kernels"

echo "=== Apple Silicon Kernel Build Completion ==="
echo "Build directory: $BUILD_DIR"
echo "Output directory: $OUTPUT_DIR"
echo ""

# Check if build directory exists
if [ ! -d "$BUILD_DIR" ]; then
    echo "ERROR: Build directory not found: $BUILD_DIR"
    echo "Run the preparation script first:"
    echo "  cd /tmp/alpine-kernel-mseries && ./build-kernel.sh"
    exit 1
fi

# Check if kernel source is extracted
if [ ! -d "$BUILD_DIR/linux-6.6.68" ]; then
    echo "ERROR: Kernel source not found: $BUILD_DIR/linux-6.6.68"
    exit 1
fi

cd "$BUILD_DIR/linux-6.6.68"

# Ensure configuration is applied
echo "Step 1: Validating kernel configuration..."
if [ ! -f .config ]; then
    echo "Creating ARM64 defconfig..."
    make ARCH=arm64 defconfig

    echo "Applying M-Series optimizations..."
    cat >> .config << 'EOF'
# Apple Silicon M-Series Optimizations
CONFIG_ARM64_AMU_EXTN=y
CONFIG_ARM64_SVE=y
CONFIG_TRANSPARENT_HUGEPAGE=y
CONFIG_TRANSPARENT_HUGEPAGE_ALWAYS=y
CONFIG_COMPACTION=y
CONFIG_MIGRATION=y
CONFIG_CMA=y
CONFIG_CMA_AREAS=7
CONFIG_VIRTIO=y
CONFIG_VIRTIO_PCI=y
CONFIG_VIRTIO_BALLOON=y
CONFIG_VIRTIO_BLK=y
CONFIG_VIRTIO_NET=y
CONFIG_VIRTIO_CONSOLE=y
CONFIG_VIRTIO_VSOCKETS=y
CONFIG_VIRTIO_VSOCKETS_COMMON=y
CONFIG_VHOST=y
CONFIG_VHOST_VSOCK=y
CONFIG_VHOST_NET=y
CONFIG_BLK_WBT=y
CONFIG_BLK_CGROUP_IOLATENCY=y
CONFIG_IOSCHED_BFQ=y
CONFIG_BFQ_GROUP_IOSCHED=y
CONFIG_SCHED_MC=y
CONFIG_SCHED_SMT=y
CONFIG_SCHED_CLUSTER=y
CONFIG_FAIR_GROUP_SCHED=y
CONFIG_CFS_BANDWIDTH=y
CONFIG_THERMAL=y
CONFIG_THERMAL_HWMON=y
CONFIG_THERMAL_GOV_POWER_ALLOCATOR=y
CONFIG_CPU_FREQ=y
CONFIG_CPU_FREQ_DEFAULT_GOV_SCHEDUTIL=y
CONFIG_CPUFREQ_DT=y
CONFIG_ZSWAP=y
CONFIG_ARM64_SW_TTBR0_PAN=y
CONFIG_UNMAP_KERNEL_AT_EL0=y
CONFIG_HARDEN_BRANCH_PREDICTOR=y
CONFIG_HARDEN_EL2_VECTORS=y
CONFIG_PERF_EVENTS=y
CONFIG_HW_PERF_EVENTS=y
EOF

    echo "Finalizing configuration..."
    make ARCH=arm64 olddefconfig
fi

echo "✓ Configuration ready"

# Check for cross-compilation toolchain
echo ""
echo "Step 2: Checking build dependencies..."

if ! command -v aarch64-linux-gnu-gcc >/dev/null 2>&1; then
    echo "ERROR: ARM64 cross-compiler not found"
    echo ""
    echo "Install with Homebrew:"
    echo "  brew install aarch64-linux-gnu-gcc"
    echo ""
    echo "Or use Docker-based build (recommended):"
    echo "  docker run --rm -v \$(pwd):/kernel -w /kernel/linux-6.6.68 alpine:edge sh -c '"
    echo "    apk add build-base bc bison flex openssl-dev elfutils-dev && "
    echo "    make ARCH=arm64 -j\$(nproc) Image"
    echo "  '"
    exit 1
fi

# Compile kernel
echo ""
echo "Step 3: Compiling kernel..."
echo "This will take 4-6 hours on M2 Pro, 2-3 hours on M3 Max"
echo ""
echo "Starting compilation at $(date)"

NPROC=$(sysctl -n hw.ncpu)
echo "Using $NPROC CPU cores"

make ARCH=arm64 CROSS_COMPILE=aarch64-linux-gnu- -j$NPROC Image

echo ""
echo "✓ Kernel compilation complete at $(date)"

# Verify kernel image
if [ ! -f arch/arm64/boot/Image ]; then
    echo "ERROR: Kernel image not found: arch/arm64/boot/Image"
    exit 1
fi

# Check kernel size
KERNEL_SIZE=$(du -h arch/arm64/boot/Image | cut -f1)
echo ""
echo "Kernel image size: $KERNEL_SIZE"

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Copy kernel to output
echo ""
echo "Step 4: Installing kernel..."
cp arch/arm64/boot/Image "$OUTPUT_DIR/vmlinuz-6.6.68-mseries"
cp .config "$OUTPUT_DIR/kernel-config-6.6.68-mseries"

# Create kernel metadata
cat > "$OUTPUT_DIR/kernel-info.json" <<EOF
{
  "version": "6.6.68",
  "arch": "arm64",
  "build_date": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "optimizations": [
    "AMX/SVE support",
    "Transparent hugepages",
    "VirtIO VSOCK zero-copy",
    "CPU cluster scheduling",
    "BFQ I/O scheduler",
    "Thermal management",
    "PTI security mitigations"
  ],
  "config_file": "kernel-config-6.6.68-mseries",
  "size_bytes": $(stat -f%z arch/arm64/boot/Image),
  "build_host": "$(hostname)",
  "compiler": "$(aarch64-linux-gnu-gcc --version | head -n1)"
}
EOF

echo "✓ Kernel installed to: $OUTPUT_DIR/vmlinuz-6.6.68-mseries"
echo "✓ Config saved to: $OUTPUT_DIR/kernel-config-6.6.68-mseries"
echo "✓ Metadata: $OUTPUT_DIR/kernel-info.json"

# Cleanup build directory (optional)
echo ""
read -p "Delete build directory to save space? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Cleaning up build directory..."
    cd /tmp
    rm -rf "$BUILD_DIR"
    echo "✓ Build directory removed"
fi

echo ""
echo "=== Kernel Build Complete ==="
echo ""
echo "Next steps:"
echo "1. Test kernel in VM:"
echo "   apple-container-runtime run alpine:latest --kernel $OUTPUT_DIR/vmlinuz-6.6.68-mseries"
echo ""
echo "2. Run performance benchmarks:"
echo "   cd tests/performance/kernel-optimizations"
echo "   ./benchmark.sh"
echo ""
echo "3. Update configuration:"
echo "   Edit config/macos/kernel-parameters.json"
