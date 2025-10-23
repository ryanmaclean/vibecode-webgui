#!/usr/bin/env bash
# Build a minimal kernel for MiniVim benchmarks
# Usage: ./build-minivim-kernel.sh <arch> <kernel_version>
# Example: ./build-minivim-kernel.sh x86_64 6.17

set -euo pipefail

ARCH="${1:-x86_64}"
KERNEL_VERSION="${2:-6.17.14}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
WORK_DIR="${REPO_ROOT}/artifacts/minivim/work"
OUTPUT_DIR="${REPO_ROOT}/bench-images/minivim"
CONFIG_DIR="${SCRIPT_DIR}/kernel-configs"

# Build configuration
SKIP_MRPROPER="${SKIP_MRPROPER:-0}"
MINIVIM_JOBS="${MINIVIM_JOBS:-$(nproc 2>/dev/null || echo 4)}"
CROSS_COMPILE="${CROSS_COMPILE:-}"

# Kernel download URL
KERNEL_MAJOR="${KERNEL_VERSION%%.*}"
KERNEL_URL="https://cdn.kernel.org/pub/linux/kernel/v${KERNEL_MAJOR}.x/linux-${KERNEL_VERSION}.tar.xz"

echo "=== MiniVim Kernel Build ==="
echo "Architecture: ${ARCH}"
echo "Kernel Version: ${KERNEL_VERSION}"
echo "Jobs: ${MINIVIM_JOBS}"
echo "Cross Compile: ${CROSS_COMPILE:-native}"
echo "Skip mrproper: ${SKIP_MRPROPER}"
echo ""

# Create directories
mkdir -p "${WORK_DIR}" "${OUTPUT_DIR}"

# Download and extract kernel if needed
KERNEL_SRC="${WORK_DIR}/linux-${KERNEL_VERSION}"
if [ ! -d "${KERNEL_SRC}" ]; then
    echo "Downloading kernel ${KERNEL_VERSION}..."
    cd "${WORK_DIR}"
    curl -L -o "linux-${KERNEL_VERSION}.tar.xz" "${KERNEL_URL}"
    echo "Extracting kernel..."
    tar -xf "linux-${KERNEL_VERSION}.tar.xz"
    rm "linux-${KERNEL_VERSION}.tar.xz"
fi

cd "${KERNEL_SRC}"

# Clean if requested
if [ "${SKIP_MRPROPER}" = "0" ]; then
    echo "Running make mrproper..."
    make mrproper
fi

# Determine kernel config fragments
BASE_CONFIG="${CONFIG_DIR}/minivim-base.config"
ARCH_CONFIG="${CONFIG_DIR}/minivim-${ARCH}.config"

if [ ! -f "${BASE_CONFIG}" ]; then
    echo "ERROR: Base config not found: ${BASE_CONFIG}"
    exit 1
fi

if [ ! -f "${ARCH_CONFIG}" ]; then
    echo "ERROR: Architecture config not found: ${ARCH_CONFIG}"
    exit 1
fi

# Start with minimal defconfig
echo "Creating minimal config..."
case "${ARCH}" in
    x86_64)
        make ARCH=x86_64 tinyconfig
        ;;
    arm64)
        make ARCH=arm64 tinyconfig
        ;;
    armv7)
        make ARCH=arm tinyconfig
        ;;
    *)
        echo "ERROR: Unsupported architecture: ${ARCH}"
        exit 1
        ;;
esac

# Merge config fragments
echo "Merging config fragments..."
./scripts/kconfig/merge_config.sh -m .config "${BASE_CONFIG}" "${ARCH_CONFIG}"

# Build the kernel
echo "Building kernel..."
BUILD_ARCH="${ARCH}"
if [ "${ARCH}" = "armv7" ]; then
    BUILD_ARCH="arm"
fi

# Determine output image name
case "${ARCH}" in
    x86_64)
        IMAGE_NAME="bzImage"
        IMAGE_PATH="arch/x86/boot/bzImage"
        ;;
    arm64)
        IMAGE_NAME="Image"
        IMAGE_PATH="arch/arm64/boot/Image"
        ;;
    armv7)
        IMAGE_NAME="zImage"
        IMAGE_PATH="arch/arm/boot/zImage"
        ;;
esac

# Build with clang if available, otherwise gcc
if command -v clang &> /dev/null; then
    echo "Building with clang..."
    make ARCH="${BUILD_ARCH}" \
         CROSS_COMPILE="${CROSS_COMPILE}" \
         LLVM=1 \
         CC="clang" \
         -j"${MINIVIM_JOBS}" \
         "${IMAGE_NAME}"
else
    echo "Building with gcc..."
    make ARCH="${BUILD_ARCH}" \
         CROSS_COMPILE="${CROSS_COMPILE}" \
         -j"${MINIVIM_JOBS}" \
         "${IMAGE_NAME}"
fi

# Copy output
OUTPUT_IMAGE="${OUTPUT_DIR}/${IMAGE_NAME}-${ARCH}-${KERNEL_VERSION}"
echo "Copying ${IMAGE_PATH} to ${OUTPUT_IMAGE}..."
cp "${IMAGE_PATH}" "${OUTPUT_IMAGE}"

# Capture CPU info for documentation
echo "Capturing CPU info..."
if command -v lscpu &> /dev/null; then
    lscpu > "${OUTPUT_DIR}/cpuinfo-${ARCH}.txt" 2>&1 || true
elif [ -f /proc/cpuinfo ]; then
    cat /proc/cpuinfo > "${OUTPUT_DIR}/cpuinfo-${ARCH}.txt" 2>&1 || true
elif command -v sysctl &> /dev/null; then
    sysctl -a | grep -i cpu > "${OUTPUT_DIR}/cpuinfo-${ARCH}.txt" 2>&1 || true
fi

echo ""
echo "=== Build Complete ==="
echo "Output: ${OUTPUT_IMAGE}"
echo "Size: $(du -h "${OUTPUT_IMAGE}" | cut -f1)"
echo ""
