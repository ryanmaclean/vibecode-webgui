#!/bin/bash
# Build minimal OpenVSCode container from scratch
# For: LFS/Gentoo/Arch users who want TINY
# Result: ~120 MB container (75% smaller than stock)

set -e

WORK_DIR="/tmp/minimal-openvscode-$$"
KERNEL_VERSION="6.6.58"
BUSYBOX_VERSION="1.36.1"
NODE_VERSION="v20.18.0"
OPENVSCODE_VERSION="1.95.3"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +%H:%M:%S)]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

check_deps() {
    log "Checking dependencies..."

    local missing=()
    for cmd in wget tar make gcc g++ flex bison bc; do
        if ! command -v $cmd &>/dev/null; then
            missing+=($cmd)
        fi
    done

    if [ ${#missing[@]} -gt 0 ]; then
        error "Missing dependencies: ${missing[*]}"
    fi

    log "✓ All dependencies present"
}

build_kernel() {
    log "=== Building Minimal Kernel ==="

    mkdir -p "$WORK_DIR/kernel"
    cd "$WORK_DIR/kernel"

    if [ ! -f "linux-${KERNEL_VERSION}.tar.xz" ]; then
        log "Downloading Linux ${KERNEL_VERSION}..."
        wget -q "https://cdn.kernel.org/pub/linux/kernel/v6.x/linux-${KERNEL_VERSION}.tar.xz"
    fi

    log "Extracting kernel source..."
    tar xf "linux-${KERNEL_VERSION}.tar.xz"
    cd "linux-${KERNEL_VERSION}"

    log "Applying minimal config..."
    cp "$SCRIPT_DIR/minimal-kernel.config" .config

    # Adjust for current arch
    ARCH=$(uname -m)
    if [ "$ARCH" = "x86_64" ]; then
        sed -i 's/CONFIG_ARM64=y/# CONFIG_ARM64 is not set/' .config
        sed -i 's/# CONFIG_X86_64=y/CONFIG_X86_64=y/' .config
    fi

    make olddefconfig

    log "Compiling kernel (this may take 10-20 minutes)..."
    make -j$(nproc) 2>&1 | grep -E "error|warning" || true

    if [ ! -f "vmlinux" ]; then
        error "Kernel compilation failed"
    fi

    log "Stripping kernel..."
    strip --strip-debug vmlinux

    local size=$(du -h vmlinux | cut -f1)
    log "✓ Kernel built: $size"

    cp vmlinux "$WORK_DIR/vmlinux"
}

build_busybox() {
    log "=== Building Static Busybox ==="

    mkdir -p "$WORK_DIR/busybox"
    cd "$WORK_DIR/busybox"

    if [ ! -f "busybox-${BUSYBOX_VERSION}.tar.bz2" ]; then
        log "Downloading Busybox ${BUSYBOX_VERSION}..."
        wget -q "https://busybox.net/downloads/busybox-${BUSYBOX_VERSION}.tar.bz2"
    fi

    log "Extracting busybox..."
    tar xf "busybox-${BUSYBOX_VERSION}.tar.bz2"
    cd "busybox-${BUSYBOX_VERSION}"

    log "Configuring busybox..."
    make allnoconfig

    # Enable essential commands
    cat >> .config << 'EOF'
CONFIG_STATIC=y
CONFIG_INSTALL_NO_USR=y
CONFIG_ASH=y
CONFIG_MOUNT=y
CONFIG_UMOUNT=y
CONFIG_MKDIR=y
CONFIG_MKNOD=y
CONFIG_CHROOT=y
CONFIG_SWITCH_ROOT=y
CONFIG_MDEV=y
CONFIG_IFCONFIG=y
CONFIG_ROUTE=y
CONFIG_UDHCPC=y
CONFIG_WGET=y
CONFIG_SH_IS_ASH=y
CONFIG_FEATURE_SH_STANDALONE=y
CONFIG_LS=y
CONFIG_CP=y
CONFIG_MV=y
CONFIG_RM=y
CONFIG_CAT=y
CONFIG_ECHO=y
CONFIG_GREP=y
CONFIG_SED=y
CONFIG_TAR=y
CONFIG_GZIP=y
EOF

    make oldconfig

    log "Compiling busybox..."
    make -j$(nproc)

    if [ ! -f "busybox" ]; then
        error "Busybox compilation failed"
    fi

    strip busybox

    local size=$(du -h busybox | cut -f1)
    log "✓ Busybox built: $size"

    cp busybox "$WORK_DIR/busybox"
}

build_initramfs() {
    log "=== Building Minimal Initramfs ==="

    mkdir -p "$WORK_DIR/initramfs"/{bin,dev,proc,sys,mnt/root,etc,lib}
    cd "$WORK_DIR/initramfs"

    log "Installing busybox..."
    cp "$WORK_DIR/busybox" bin/

    # Create symlinks
    for cmd in sh mount umount mkdir mknod chroot switch_root mdev \
               ifconfig route udhcpc wget ls cp mv rm cat echo grep sed tar gzip; do
        ln -sf busybox bin/$cmd
    done

    log "Creating init script..."
    cat > init << 'EOF'
#!/bin/sh
# Minimal init - mount essentials and switch to real root

mount -t proc proc /proc
mount -t sysfs sys /sys
mount -t devtmpfs dev /dev
mdev -s

# Mount root filesystem
echo "Mounting root..."
mount -o rw /dev/vda /mnt/root || {
    echo "Failed to mount root"
    exec /bin/sh
}

# Switch to real root
echo "Switching to root..."
exec switch_root /mnt/root /sbin/init
EOF
    chmod +x init

    log "Packing initramfs..."
    find . | cpio -H newc -o 2>/dev/null | gzip -9 > "$WORK_DIR/initramfs.cpio.gz"

    local size=$(du -h "$WORK_DIR/initramfs.cpio.gz" | cut -f1)
    log "✓ Initramfs built: $size"
}

build_rootfs() {
    log "=== Building Minimal Rootfs ==="

    mkdir -p "$WORK_DIR/rootfs"
    cd "$WORK_DIR/rootfs"

    log "Downloading Alpine minirootfs..."
    wget -q "http://dl-cdn.alpinelinux.org/alpine/v3.19/releases/x86_64/alpine-minirootfs-3.19.1-x86_64.tar.gz"

    log "Extracting rootfs..."
    tar xf alpine-minirootfs-3.19.1-x86_64.tar.gz
    rm alpine-minirootfs-3.19.1-x86_64.tar.gz

    log "Installing essential packages..."
    if command -v chroot &>/dev/null; then
        chroot . /bin/sh << 'CHROOT_EOF'
apk update
apk add --no-cache musl ca-certificates libstdc++ libgcc
apk del apk-tools
rm -rf /var/cache/apk/* /tmp/*
CHROOT_EOF
    else
        warn "Cannot chroot (running on macOS?), skipping package install"
    fi

    local size=$(du -sh . | cut -f1)
    log "✓ Rootfs built: $size"
}

optimize_openvscode() {
    log "=== Downloading and Optimizing OpenVSCode ==="

    mkdir -p "$WORK_DIR/openvscode"
    cd "$WORK_DIR/openvscode"

    log "Downloading OpenVSCode ${OPENVSCODE_VERSION}..."
    local arch=$(uname -m)
    [ "$arch" = "arm64" ] && arch="aarch64"
    [ "$arch" = "aarch64" ] && arch="arm64"

    wget -q "https://github.com/gitpod-io/openvscode-server/releases/download/openvscode-server-v${OPENVSCODE_VERSION}/openvscode-server-v${OPENVSCODE_VERSION}-linux-${arch}.tar.gz"

    log "Extracting..."
    tar xf "openvscode-server-v${OPENVSCODE_VERSION}-linux-${arch}.tar.gz"
    cd "openvscode-server-v${OPENVSCODE_VERSION}-linux-${arch}"

    log "Removing unnecessary components..."
    rm -rf \
        extensions/ms-vscode.js-debug-* \
        extensions/vscode-*test* \
        extensions/*/images \
        extensions/*/out/**/*.map \
        resources/app/out/**/*.map \
        resources/app/node_modules/@types \
        resources/app/node_modules/typescript/lib/*.d.ts \
        node_modules/@types \
        node_modules/typescript/lib/*.d.ts

    log "Stripping binaries..."
    find . -type f -executable -exec strip --strip-unneeded {} + 2>/dev/null || true

    local size=$(du -sh . | cut -f1)
    log "✓ OpenVSCode optimized: $size"

    mv "$WORK_DIR/openvscode/openvscode-server-v${OPENVSCODE_VERSION}-linux-${arch}" \
       "$WORK_DIR/openvscode-final"
}

create_dockerfile() {
    log "=== Creating Dockerfile ==="

    cd "$WORK_DIR"

    cat > Dockerfile << 'EOF'
FROM scratch

# Copy minimal Alpine rootfs
COPY rootfs/ /

# Copy optimized OpenVSCode
COPY openvscode-final/ /opt/openvscode/

# Create workspace
RUN mkdir -p /workspace || true

# Startup script
COPY startup.sh /startup.sh
RUN chmod +x /startup.sh || true

WORKDIR /workspace
EXPOSE 3000

CMD ["/bin/sh", "/startup.sh"]
EOF

    cat > startup.sh << 'EOF'
#!/bin/sh
echo "Starting OpenVSCode Server..."
exec /opt/openvscode/bin/openvscode-server \
    --host 0.0.0.0 \
    --port 3000 \
    --without-connection-token \
    --accept-server-license-terms
EOF
    chmod +x startup.sh

    log "✓ Dockerfile created"
}

build_container() {
    log "=== Building Docker Container ==="

    cd "$WORK_DIR"

    if ! command -v docker &>/dev/null; then
        warn "Docker not available, skipping container build"
        return
    fi

    log "Building image..."
    docker build -t openvscode-minimal:latest .

    local size=$(docker images openvscode-minimal:latest --format "{{.Size}}")
    log "✓ Container built: $size"

    log ""
    log "========================================="
    log "  Build Complete!"
    log "========================================="
    log "Container: openvscode-minimal:latest"
    log "Size: $size"
    log ""
    log "Run with:"
    log "  docker run --rm -p 3000:3000 openvscode-minimal:latest"
    log "========================================="
}

show_summary() {
    log ""
    log "=== Build Summary ==="
    log "Kernel:     $(du -h $WORK_DIR/vmlinux | cut -f1)"
    log "Initramfs:  $(du -h $WORK_DIR/initramfs.cpio.gz | cut -f1)"
    log "Rootfs:     $(du -sh $WORK_DIR/rootfs | cut -f1)"
    log "OpenVSCode: $(du -sh $WORK_DIR/openvscode-final | cut -f1)"
    log ""
    log "Files saved to: $WORK_DIR"
}

cleanup() {
    if [ "$KEEP_BUILD" != "1" ]; then
        log "Cleaning up build directory..."
        rm -rf "$WORK_DIR"
    else
        log "Build files kept at: $WORK_DIR"
    fi
}

# Main
main() {
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

    log "=== Minimal OpenVSCode Build ==="
    log "Target: ~120 MB container"
    log "Working directory: $WORK_DIR"
    log ""

    check_deps

    mkdir -p "$WORK_DIR"

    # Build components
    build_kernel
    build_busybox
    build_initramfs
    build_rootfs
    optimize_openvscode

    # Create container
    create_dockerfile
    build_container

    # Summary
    show_summary

    # Cleanup
    # cleanup

    log ""
    log "✓ All done!"
}

# Handle interrupts
trap 'error "Build interrupted"' INT TERM

# Run
main "$@"
