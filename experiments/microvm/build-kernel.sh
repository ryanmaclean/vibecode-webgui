#!/usr/bin/env bash
set -euo pipefail

# Dockerized Apple Virtualization Framework Kernel Builder
# Builds arm64 EFI-stub kernel for Apple VF (vfkit, macvz, etc.)
#
# Requirements: Docker/Colima on host, macOS with Apple Silicon
# Usage: ./build-kernel.sh [kernel_version]
# Output: bench-images/apple-vf/Image-arm64-<version>

PROJECT_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
KERNEL_VERSION=${KERNEL_VERSION:-${1:-6.12.10}}
ARTIFACT_DIR="${PROJECT_ROOT}/bench-images/apple-vf"
mkdir -p "$ARTIFACT_DIR"

IMAGE_NAME="apple-vf-kernel-builder"

echo "==> Apple VF Kernel Builder"
echo "    Kernel version: ${KERNEL_VERSION}"
echo "    Output dir: ${ARTIFACT_DIR}"

cat >"${ARTIFACT_DIR}/Dockerfile.kernel" <<'DOCKER'
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential bc bison flex libssl-dev libncurses-dev wget cpio rsync git python3 \
      device-tree-compiler kmod libelf-dev zstd lz4 curl ca-certificates xz-utils \
      gcc-aarch64-linux-gnu binutils-aarch64-linux-gnu && \
    rm -rf /var/lib/apt/lists/*
WORKDIR /workspace
DOCKER

if ! docker image inspect "${IMAGE_NAME}:latest" >/dev/null 2>&1; then
  echo "==> Building kernel builder image..."
  docker build -t "${IMAGE_NAME}:latest" -f "${ARTIFACT_DIR}/Dockerfile.kernel" "$PROJECT_ROOT"
fi

cat >"${ARTIFACT_DIR}/build-inside.sh" <<'BUILDSCRIPT'
#!/bin/bash
set -euo pipefail
KERNEL_VERSION=${KERNEL_VERSION:-6.12.10}
KERNEL_MAJOR=$(echo "$KERNEL_VERSION" | cut -d. -f1)
KERNEL_URL="https://cdn.kernel.org/pub/linux/kernel/v${KERNEL_MAJOR}.x/linux-${KERNEL_VERSION}.tar.xz"
cd /workspace
[[ ! -f "linux-${KERNEL_VERSION}.tar.xz" ]] && curl -LO "$KERNEL_URL"
[[ ! -d "linux-${KERNEL_VERSION}" ]] && tar -xf "linux-${KERNEL_VERSION}.tar.xz"
cd "linux-${KERNEL_VERSION}"
make ARCH=arm64 CROSS_COMPILE=aarch64-linux-gnu- defconfig
./scripts/config --enable CONFIG_VIRTIO --enable CONFIG_VIRTIO_PCI --enable CONFIG_VIRTIO_BLK
./scripts/config --enable CONFIG_VIRTIO_NET --enable CONFIG_VIRTIO_CONSOLE --enable CONFIG_VIRTIO_BALLOON
./scripts/config --enable CONFIG_HW_RANDOM_VIRTIO --enable CONFIG_VIRTIO_FS --enable CONFIG_FUSE_FS
./scripts/config --enable CONFIG_EFI_STUB --enable CONFIG_EFI --enable CONFIG_BLK_DEV_INITRD
./scripts/config --enable CONFIG_RD_GZIP --enable CONFIG_RD_LZ4 --enable CONFIG_HVC_DRIVER
./scripts/config --disable CONFIG_SOUND --disable CONFIG_DRM --disable CONFIG_FB --disable CONFIG_USB
./scripts/config --disable CONFIG_WLAN --disable CONFIG_BT --disable CONFIG_DEBUG_INFO
make ARCH=arm64 CROSS_COMPILE=aarch64-linux-gnu- olddefconfig
make ARCH=arm64 CROSS_COMPILE=aarch64-linux-gnu- -j"$(nproc)" Image
cp arch/arm64/boot/Image /output/Image-arm64-${KERNEL_VERSION}
echo "==> Kernel build complete: /output/Image-arm64-${KERNEL_VERSION}"
BUILDSCRIPT
chmod +x "${ARTIFACT_DIR}/build-inside.sh"

docker run --rm -v "${ARTIFACT_DIR}:/output" -v "${ARTIFACT_DIR}/build-inside.sh:/build.sh:ro" \
  -e "KERNEL_VERSION=${KERNEL_VERSION}" "${IMAGE_NAME}:latest" /build.sh

echo "==> Build complete: ${ARTIFACT_DIR}/Image-arm64-${KERNEL_VERSION}"
