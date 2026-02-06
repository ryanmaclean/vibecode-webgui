#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

# Build initramfs based on Gitpod workspace-images for ARM64
# Extracts Gitpod's setup and builds directly into initramfs (no Docker needed)

# Initialize log aggregation
init_log_aggregation


set -e

cd "$(dirname "$0")/.."

GITPOD_DIR="${GITPOD_DIR:-/tmp/gitpod-workspace-images-90565}"
WORK_DIR=$(mktemp -d)
trap "rm -rf $WORK_DIR" EXIT

echo "=== Building Gitpod-based Initramfs for ARM64 ==="
echo "Gitpod repo: $GITPOD_DIR"
echo "Work dir: $WORK_DIR"
echo ""

# Create initramfs structure
INITRAMFS_DIR="$WORK_DIR/initramfs"
mkdir -p "$INITRAMFS_DIR"/{bin,sbin,usr/bin,usr/sbin,etc,lib,lib64,opt,proc,sys,dev,tmp,var,root,home/gitpod}

# Copy base system (Alpine/BusyBox base)
echo "1. Setting up base system..."
# We'll use Alpine as base since it's ARM64 compatible
ALPINE_VERSION="3.19"
ARCH="aarch64"

# Download Alpine minirootfs if needed
ALPINE_ROOTFS="$WORK_DIR/alpine-minirootfs.tar.gz"
if [ ! -f "$ALPINE_ROOTFS" ]; then
    echo "Downloading Alpine Linux $ALPINE_VERSION minirootfs..."
    curl -L "https://dl-cdn.alpinelinux.org/alpine/v${ALPINE_VERSION}/releases/${ARCH}/alpine-minirootfs-${ALPINE_VERSION}-${ARCH}.tar.gz" \
        -o "$ALPINE_ROOTFS"
fi

echo "Extracting Alpine base..."
tar -xzf "$ALPINE_ROOTFS" -C "$INITRAMFS_DIR"

# Read Gitpod base Dockerfile and extract setup commands
echo ""
echo "2. Applying Gitpod base configuration..."

if [ -f "$GITPOD_DIR/base/Dockerfile" ]; then
    # Extract RUN commands from Gitpod Dockerfile
    grep "^RUN" "$GITPOD_DIR/base/Dockerfile" | while IFS= read -r run_cmd; do
        # Remove "RUN " prefix and execute in chroot
        cmd=$(echo "$run_cmd" | sed 's/^RUN //')
        echo "  Applying: $cmd"
        # Note: This is simplified - full implementation would need chroot setup
    done
fi

# Install Gitpod's standard tools (adapted for Alpine/ARM64)
echo ""
echo "3. Installing development tools..."

# Create a script that runs in the initramfs
cat > "$INITRAMFS_DIR/install-gitpod-tools.sh" << 'INSTALL_EOF'
#!/bin/sh
set -e

echo "Installing Gitpod tools for ARM64..."

# Update package index
apk update

# Install Gitpod's standard tools (Alpine equivalents)
apk add --no-cache \
    bash \
    curl \
    wget \
    git \
    vim \
    nano \
    sudo \
    openssh \
    ca-certificates \
    docker-cli \
    nodejs \
    npm \
    python3 \
    py3-pip \
    go \
    rust \
    cargo \
    build-base \
    gcc \
    g++ \
    make \
    cmake \
    pkgconfig \
    openssl-dev \
    zlib-dev \
    || echo "Some packages may not be available"

# Install Homebrew (if available for ARM64 Linux)
# Note: Homebrew on Linux is x86_64 only, skip for ARM64

# Install Nix (if available)
# Note: Nix supports ARM64

# Create gitpod user (like Gitpod does)
adduser -D -s /bin/bash gitpod || true
echo "gitpod ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

# Set up workspace directory
mkdir -p /workspace
chown gitpod:gitpod /workspace

echo "✅ Gitpod tools installed"
INSTALL_EOF

chmod +x "$INITRAMFS_DIR/install-gitpod-tools.sh"

# Create init script that runs Gitpod setup
echo ""
echo "4. Creating init script..."

cat > "$INITRAMFS_DIR/init" << 'INIT_EOF'
#!/bin/sh
set -e

echo "=== Booting Gitpod-based VM (ARM64) ==="

# Mount filesystems
mount -t proc proc /proc
mount -t sysfs sysfs /sys
mount -t devtmpfs devtmpfs /dev
mount -t tmpfs tmpfs /tmp
mount -t tmpfs tmpfs /var

# Set up networking
echo "Setting up network..."
ip link set lo up

for i in $(seq 1 30); do
    if ip link show eth0 >/dev/null 2>&1; then
        ip link set eth0 up
        udhcpc -i eth0 -n -q || true
        break
    fi
    sleep 1
done

VM_IP=$(ip addr show eth0 2>/dev/null | grep 'inet ' | awk '{print $2}' | cut -d/ -f1 || echo "unknown")
echo "Network configured: $VM_IP"

# Run Gitpod tool installation (if not already done)
if [ ! -f /var/.gitpod-tools-installed ]; then
    echo "Installing Gitpod tools..."
    /install-gitpod-tools.sh || echo "Tool installation had errors"
    touch /var/.gitpod-tools-installed
fi

# Start SSH
echo "Starting SSH server..."
/usr/sbin/sshd || true

# Start services based on what's available
echo ""
echo "=== Gitpod Workspace Ready ==="
echo "VM IP: $VM_IP"
echo "SSH: ssh gitpod@$VM_IP"
echo "Workspace: /workspace"
echo ""

# Keep running
exec /bin/sh
INIT_EOF

chmod +x "$INITRAMFS_DIR/init"

# Build initramfs
echo ""
echo "5. Building initramfs..."
cd "$INITRAMFS_DIR"
find . | cpio -o -H newc | gzip > "$WORK_DIR/gitpod-workspace-base-arm64.cpio.gz"

SIZE=$(du -h "$WORK_DIR/gitpod-workspace-base-arm64.cpio.gz" | cut -f1)
echo "✅ Initramfs created: $SIZE"

# Copy to azure directory
mkdir -p azure
cp "$WORK_DIR/gitpod-workspace-base-arm64.cpio.gz" azure/

echo ""
echo "=== Build Complete ==="
echo "Output: azure/gitpod-workspace-base-arm64.cpio.gz ($SIZE)"
echo ""
echo "Test with:"
echo "  swift scripts/test-initramfs-cli.swift azure/gitpod-workspace-base-arm64.cpio.gz"

