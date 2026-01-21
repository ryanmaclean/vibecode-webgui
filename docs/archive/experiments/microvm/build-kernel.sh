#!/usr/bin/env bash
set -euo pipefail

# Build arm64 EFI-stub kernel + BusyBox initramfs inside a Debian container
# Requires Docker/Colima running on host.

PROJECT_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
ARTIFACT_DIR="${PROJECT_ROOT}/bench-images/apple-vf"
mkdir -p "$ARTIFACT_DIR"

IMAGE_NAME="deb-busybox-kernel"
CONTAINER_NAME="apple-vf-kernel-build"

cat >"${ARTIFACT_DIR}/Dockerfile.kernel" <<'DOCKER'
FROM debian:bookworm-slim
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      build-essential bc bison flex libssl-dev \
      libncurses-dev wget cpio rsync git python3 \
      device-tree-compiler kmod && \
    rm -rf /var/lib/apt/lists/*
WORKDIR /workspace
DOCKER

# Build image
if ! docker image ls | awk '{print $1":"$2}' | grep -q "${IMAGE_NAME}:latest"; then
  docker build -t ${IMAGE_NAME}:latest -f "${ARTIFACT_DIR}/Dockerfile.kernel" "$PROJECT_ROOT"
fi

# Prepare workspace tarball for container (kernel scripts rely on repo layout)
WORK_TAR="${ARTIFACT_DIR}/repo.tar"
tar --exclude='node_modules' --exclude='bench-images' -C "$PROJECT_ROOT" -cf "$WORK_TAR" .

# Run container build
cat <<'SCRIPT' | docker run --rm -i -v "$WORK_TAR":/tmp/repo.tar -v "$ARTIFACT_DIR":/output ${IMAGE_NAME}:latest bash
set -euo pipefail
mkdir -p /workspace
cd /workspace
 tar -xf /tmp/repo.tar
export MINIVIM_JOBS=$(nproc)
./scripts/benchmarks/build-minivim-kernel.sh arm64 6.12.10
SCRIPT

# TODO: copy resulting Image/initramfs to /bench-images/apple-vf and clean up

