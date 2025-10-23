#!/usr/bin/env bash
# Build kernel in Lima Alpine instance with Datadog metrics

set -euo pipefail

LIMA_INSTANCE="${LIMA_INSTANCE:-alpine-dd}"
ARCH="${1:-x86_64}"
KERNEL_VERSION="${2:-6.17.4}"

echo "Building kernel ${KERNEL_VERSION} in Lima instance ${LIMA_INSTANCE}..."

limactl shell "$LIMA_INSTANCE" ARCH="$ARCH" KERNEL_VERSION="$KERNEL_VERSION" WORK_DIR="/Users/string/vibecode-webgui" bash <<'LIMA_EOF'
set -euo pipefail

cd "$WORK_DIR"
mkdir -p artifacts/minivim/work bench-images/minivim

cd artifacts/minivim/work

# Download kernel if needed
if [ ! -d "linux-${KERNEL_VERSION}" ]; then
  echo "Downloading kernel ${KERNEL_VERSION}..."
  wget -q "https://cdn.kernel.org/pub/linux/kernel/v6.x/linux-${KERNEL_VERSION}.tar.xz"
  tar xf "linux-${KERNEL_VERSION}.tar.xz"
  rm "linux-${KERNEL_VERSION}.tar.xz"
fi

cd "linux-${KERNEL_VERSION}"

echo "Configuring kernel..."
# Kernel tree extracted fresh; skip mrproper to avoid Documentation/Kbuild cleanup bug
make ARCH=${ARCH} tinyconfig

# Merge kernel configs
scripts/kconfig/merge_config.sh -m .config \
  "$WORK_DIR/scripts/benchmarks/kernel-configs/minivim-base.config" \
  "$WORK_DIR/scripts/benchmarks/kernel-configs/minivim-${ARCH}.config"

KCONFIG_NONINTERACTIVE=y make ARCH=${ARCH} olddefconfig

echo "Building kernel..."
START_TIME=$(date +%s)
make ARCH=${ARCH} -j$(nproc) bzImage

END_TIME=$(date +%s)
BUILD_DURATION=$((END_TIME - START_TIME))

# Copy output
cp arch/x86/boot/bzImage "$WORK_DIR/bench-images/minivim/vmlinuz-${KERNEL_VERSION}-musl"

echo "=== Build Complete ==="
echo "Duration: ${BUILD_DURATION}s"
ls -lh "$WORK_DIR/bench-images/minivim/vmlinuz-${KERNEL_VERSION}-musl"

# Send metric to Datadog if configured
if [ "${DD_API_KEY}" != "dummy-key-for-local-dev" ] && command -v python3 >/dev/null; then
  python3 "$WORK_DIR/scripts/benchmarks/_dogstatsd.py" \
    "kernel.build.duration" \
    "$BUILD_DURATION" \
    "version:${KERNEL_VERSION},arch:${ARCH},libc:musl" || true
  echo "Metrics sent to Datadog"
fi
LIMA_EOF

echo "Kernel build complete!"
