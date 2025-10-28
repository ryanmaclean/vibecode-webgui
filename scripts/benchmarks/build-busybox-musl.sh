#!/usr/bin/env bash
# Build BusyBox with musl libc for minimal static binaries
# Emits Datadog metrics for build time and binary size tracking

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
WORK_DIR="${PROJECT_ROOT}/artifacts/busybox-musl/work"
OUTPUT_DIR="${PROJECT_ROOT}/bench-images/busybox"
BUSYBOX_VERSION="${BUSYBOX_VERSION:-1.36.1}"

# Datadog metrics helper
source "${SCRIPT_DIR}/_dogstatsd.py" 2>/dev/null || true

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $*"; }
success() { echo -e "${GREEN}✓${NC} $*"; }
warn() { echo -e "${YELLOW}⚠${NC} $*"; }

# Detect platform
PLATFORM="$(uname -s)"
case "$PLATFORM" in
    Darwin)
        NPROC=$(sysctl -n hw.logicalcpu)
        ;;
    Linux)
        NPROC=$(nproc)
        ;;
    *)
        NPROC=4
        ;;
esac

# Start timing
START_TIME=$(date +%s)

log "BusyBox musl build starting"
log "Version: ${BUSYBOX_VERSION}"
log "Platform: ${PLATFORM}"
log "Cores: ${NPROC}"

# Create working directory
mkdir -p "$WORK_DIR" "$OUTPUT_DIR"
cd "$WORK_DIR"

# Download BusyBox if not present
TARBALL="busybox-${BUSYBOX_VERSION}.tar.bz2"
if [ ! -f "$TARBALL" ]; then
    log "Downloading BusyBox ${BUSYBOX_VERSION}..."
    curl -L -o "$TARBALL" \
        "https://busybox.net/downloads/${TARBALL}"
    success "Downloaded ${TARBALL}"
fi

# Extract
log "Extracting BusyBox..."
rm -rf "busybox-${BUSYBOX_VERSION}"
tar xf "$TARBALL"
cd "busybox-${BUSYBOX_VERSION}"

# Configure for static musl build
log "Configuring for musl static build..."
make defconfig

# Enable static linking and optimizations
cat >> .config << 'EOF'
CONFIG_STATIC=y
CONFIG_STATIC_LIBGCC=y
CONFIG_INSTALL_NO_USR=y
CONFIG_FEATURE_PREFER_APPLETS=y
CONFIG_FEATURE_SH_STANDALONE=y
CONFIG_PIE=n
CONFIG_EXTRA_CFLAGS="-Os -ffunction-sections -fdata-sections -static"
CONFIG_EXTRA_LDFLAGS="-static -Wl,--gc-sections -Wl,--strip-all"
EOF

# If on macOS, try to use musl-cross if available
if [ "$PLATFORM" = "Darwin" ]; then
    if command -v x86_64-linux-musl-gcc >/dev/null 2>&1; then
        log "Using musl-cross toolchain on macOS..."
        cat >> .config << 'EOF'
CONFIG_CROSS_COMPILER_PREFIX="x86_64-linux-musl-"
EOF
    else
        warn "musl-cross not found. Install: brew install filosottile/musl-cross/musl-cross"
        warn "Continuing with native compiler (may not produce optimal binary)..."
    fi
fi

make oldconfig

# Build
log "Building BusyBox (using ${NPROC} cores)..."
BUILD_START=$(date +%s)

if ! make -j"${NPROC}" busybox; then
    log "Build failed, retrying with verbose output..."
    make V=1 busybox
fi

BUILD_END=$(date +%s)
BUILD_DURATION=$((BUILD_END - BUILD_START))

success "Build completed in ${BUILD_DURATION}s"

# Check binary
if [ ! -f busybox ]; then
    echo "Error: busybox binary not found after build!"
    exit 1
fi

# Get binary info
BINARY_SIZE=$(stat -f%z busybox 2>/dev/null || stat -c%s busybox)
BINARY_SIZE_MB=$(echo "scale=2; $BINARY_SIZE / 1024 / 1024" | bc)

# Strip (already done by --strip-all, but make sure)
strip busybox 2>/dev/null || true

STRIPPED_SIZE=$(stat -f%z busybox 2>/dev/null || stat -c%s busybox)
STRIPPED_SIZE_MB=$(echo "scale=2; $STRIPPED_SIZE / 1024 / 1024" | bc)

log "Binary analysis:"
log "  Original size: ${BINARY_SIZE_MB} MB"
log "  Stripped size: ${STRIPPED_SIZE_MB} MB"

# Check if it's statically linked
if file busybox | grep -q "statically linked"; then
    success "Binary is statically linked ✓"
    STATIC_LINKED="true"
else
    warn "Binary is NOT statically linked"
    STATIC_LINKED="false"
    file busybox
fi

# Check libc
if ldd busybox 2>&1 | grep -q "not a dynamic"; then
    success "No dynamic dependencies (static binary) ✓"
    LIBC_TYPE="static-musl"
else
    LIBC_TYPE=$(ldd busybox 2>&1 | grep -o "musl\|glibc" | head -1 || echo "unknown")
    log "libc type: ${LIBC_TYPE}"
fi

# Copy to output directory with metadata
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
OUTPUT_NAME="busybox-${BUSYBOX_VERSION}-musl-${TIMESTAMP}"
cp busybox "${OUTPUT_DIR}/${OUTPUT_NAME}"

# Create symlink to latest
ln -sf "${OUTPUT_NAME}" "${OUTPUT_DIR}/busybox-musl-latest"

# Create metadata file
cat > "${OUTPUT_DIR}/${OUTPUT_NAME}.json" << EOF
{
  "version": "${BUSYBOX_VERSION}",
  "build_time": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "build_duration_seconds": ${BUILD_DURATION},
  "binary_size_bytes": ${STRIPPED_SIZE},
  "binary_size_mb": ${STRIPPED_SIZE_MB},
  "static_linked": ${STATIC_LINKED},
  "libc": "${LIBC_TYPE}",
  "platform": "${PLATFORM}",
  "cores_used": ${NPROC},
  "compiler": "$(${CC:-gcc} --version | head -1 || echo 'unknown')"
}
EOF

# Create initramfs
log "Creating initramfs..."
INITRAMFS_DIR="${WORK_DIR}/initramfs"
rm -rf "$INITRAMFS_DIR"
mkdir -p "$INITRAMFS_DIR"/{bin,sbin,etc,proc,sys,dev,usr/bin,usr/sbin,tmp,root}

# Copy busybox
cp busybox "$INITRAMFS_DIR/bin/"

# Create symlinks for common commands
cd "$INITRAMFS_DIR"
for cmd in sh ash ls cat echo mount umount mkdir rmdir cp mv rm ln \
           chmod chown ps kill sleep vi sed grep find wget tar gzip; do
    ln -sf /bin/busybox "bin/$cmd"
done

# Create init script
cat > init << 'INITEOF'
#!/bin/sh
# BusyBox musl initramfs init script

mount -t proc none /proc
mount -t sysfs none /sys
mount -t devtmpfs none /dev
mount -t tmpfs none /tmp

# Print system info
echo "BusyBox musl initramfs ready"
echo "Kernel: $(uname -r)"
echo "Uptime: $(cat /proc/uptime | cut -d' ' -f1)s"

# Start shell
exec /bin/sh
INITEOF
chmod +x init

# Create initramfs archive
log "Packing initramfs..."
find . | cpio -o -H newc 2>/dev/null | gzip > "${OUTPUT_DIR}/busybox-musl-initramfs-${TIMESTAMP}.cpio.gz"
ln -sf "busybox-musl-initramfs-${TIMESTAMP}.cpio.gz" "${OUTPUT_DIR}/busybox-musl-initramfs-latest.cpio.gz"

INITRAMFS_SIZE=$(stat -f%z "${OUTPUT_DIR}/busybox-musl-initramfs-${TIMESTAMP}.cpio.gz" 2>/dev/null || \
                 stat -c%s "${OUTPUT_DIR}/busybox-musl-initramfs-${TIMESTAMP}.cpio.gz")
INITRAMFS_SIZE_MB=$(echo "scale=2; $INITRAMFS_SIZE / 1024 / 1024" | bc)

success "Initramfs created: ${INITRAMFS_SIZE_MB} MB"

# Total time
END_TIME=$(date +%s)
TOTAL_DURATION=$((END_TIME - START_TIME))

# Summary
echo ""
log "═══════════════════════════════════════════════════════"
log "Build Summary:"
log "  BusyBox version: ${BUSYBOX_VERSION}"
log "  Binary size: ${STRIPPED_SIZE_MB} MB (${STRIPPED_SIZE} bytes)"
log "  Initramfs size: ${INITRAMFS_SIZE_MB} MB (${INITRAMFS_SIZE} bytes)"
log "  Build time: ${BUILD_DURATION}s"
log "  Total time: ${TOTAL_DURATION}s"
log "  Static linked: ${STATIC_LINKED}"
log "  libc: ${LIBC_TYPE}"
log "  Output: ${OUTPUT_DIR}/${OUTPUT_NAME}"
log "═══════════════════════════════════════════════════════"

# Send metrics to Datadog if available
if command -v python3 >/dev/null 2>&1 && [ -f "${SCRIPT_DIR}/_dogstatsd.py" ]; then
    log "Sending metrics to Datadog..."

    python3 "${SCRIPT_DIR}/_dogstatsd.py" \
        "busybox.build.duration" \
        "$BUILD_DURATION" \
        "version:${BUSYBOX_VERSION},libc:musl,platform:${PLATFORM}"

    python3 "${SCRIPT_DIR}/_dogstatsd.py" \
        "busybox.binary.size" \
        "$STRIPPED_SIZE" \
        "version:${BUSYBOX_VERSION},libc:musl,type:stripped"

    python3 "${SCRIPT_DIR}/_dogstatsd.py" \
        "busybox.initramfs.size" \
        "$INITRAMFS_SIZE" \
        "version:${BUSYBOX_VERSION},libc:musl"

    success "Metrics sent to Datadog"
fi

success "All done! 🚀"
echo ""
echo "Test the binary:"
echo "  ${OUTPUT_DIR}/${OUTPUT_NAME} --help"
echo ""
echo "Boot with QEMU:"
echo "  qemu-system-x86_64 -kernel <kernel> -initrd ${OUTPUT_DIR}/busybox-musl-initramfs-latest.cpio.gz -append 'console=ttyS0' -nographic"

exit 0
