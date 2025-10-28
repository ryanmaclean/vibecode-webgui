#!/usr/bin/env bash
# Create Alpine Linux ARM64 rootfs with musl compatibility
# Includes Node.js, AI tools, and code-server

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VM_DIR="${HOME}/.vfkit/vms/vibecode-alpine"
ROOTFS_DIR="${VM_DIR}/rootfs"
WORK_DIR="${ROOTFS_DIR}/build"

ALPINE_VERSION="3.19"
NODE_VERSION="20.11.1"

echo "=== Creating Alpine ARM64 Root Filesystem ==="
echo ""
echo "Alpine Version: ${ALPINE_VERSION}"
echo "Node.js Version: ${NODE_VERSION}"
echo "Build Directory: ${WORK_DIR}"
echo ""

# Clean and create work directory
rm -rf "${WORK_DIR}"
mkdir -p "${WORK_DIR}"
cd "${WORK_DIR}"

# Create Alpine directory structure
echo "📁 Creating Alpine directory structure..."
mkdir -p {bin,sbin,etc,proc,sys,dev,tmp,var,run,root,home}
mkdir -p {usr/bin,usr/sbin,usr/lib,usr/share,lib}
mkdir -p {etc/apk,var/cache/apk,var/lib/apk}
mkdir -p {opt,srv,mnt,media}

echo "✅ Directory structure created"
echo ""

# Download Alpine mini root filesystem
echo "📥 Downloading Alpine mini rootfs..."
ALPINE_MINIROOTFS="alpine-minirootfs-${ALPINE_VERSION}.0-aarch64.tar.gz"
ALPINE_MINIROOTFS_URL="https://dl-cdn.alpinelinux.org/alpine/v${ALPINE_VERSION}/releases/aarch64/${ALPINE_MINIROOTFS}"

if [[ ! -f "../${ALPINE_MINIROOTFS}" ]]; then
    curl -L -o "../${ALPINE_MINIROOTFS}" "${ALPINE_MINIROOTFS_URL}"
    echo "✅ Downloaded: ${ALPINE_MINIROOTFS}"
else
    echo "✅ Using cached: ${ALPINE_MINIROOTFS}"
fi

# Extract Alpine mini rootfs
echo "📦 Extracting Alpine mini rootfs..."
tar -xzf "../${ALPINE_MINIROOTFS}" -C .
echo "✅ Alpine mini rootfs extracted"
echo ""

# Configure APK (Alpine Package Manager)
echo "⚙️  Configuring APK repositories..."
cat > etc/apk/repositories << EOF
https://dl-cdn.alpinelinux.org/alpine/v${ALPINE_VERSION}/main
https://dl-cdn.alpinelinux.org/alpine/v${ALPINE_VERSION}/community
EOF

echo "✅ APK repositories configured"
echo ""

# Download Node.js musl binary
echo "📥 Downloading Node.js ${NODE_VERSION} (musl)..."
NODE_TARBALL="node-v${NODE_VERSION}-linux-arm64-musl.tar.xz"
NODE_URL="https://unofficial-builds.nodejs.org/download/release/v${NODE_VERSION}/${NODE_TARBALL}"

if curl -f -L -o "../${NODE_TARBALL}" "${NODE_URL}" 2>/dev/null; then
    echo "✅ Downloaded Node.js musl build"

    echo "📦 Extracting Node.js..."
    tar -xJf "../${NODE_TARBALL}" -C usr/local --strip-components=1
    echo "✅ Node.js installed"
else
    echo "⚠️  Musl build not available, using standard build"
    NODE_TARBALL="node-v${NODE_VERSION}-linux-arm64.tar.xz"
    NODE_URL="https://nodejs.org/dist/v${NODE_VERSION}/${NODE_TARBALL}"

    curl -L -o "../${NODE_TARBALL}" "${NODE_URL}"
    tar -xJf "../${NODE_TARBALL}" -C usr/local --strip-components=1
    echo "✅ Node.js installed (standard build)"
fi

# Verify Node.js
if [[ -f "usr/local/bin/node" ]]; then
    NODE_ACTUAL=$(usr/local/bin/node --version 2>/dev/null || echo "unknown")
    echo "   Node version: ${NODE_ACTUAL}"
fi

echo ""

# Create essential configuration files
echo "⚙️  Creating configuration files..."

# /etc/passwd
cat > etc/passwd << 'EOF'
root:x:0:0:root:/root:/bin/sh
nobody:x:65534:65534:nobody:/:/sbin/nologin
EOF

# /etc/group
cat > etc/group << 'EOF'
root:x:0:
nobody:x:65534:
EOF

# /etc/hostname
echo "vibecode-alpine" > etc/hostname

# /etc/hosts
cat > etc/hosts << 'EOF'
127.0.0.1   localhost vibecode-alpine
::1         localhost vibecode-alpine
EOF

# /etc/resolv.conf
cat > etc/resolv.conf << 'EOF'
nameserver 8.8.8.8
nameserver 8.8.4.4
EOF

# /etc/fstab
cat > etc/fstab << 'EOF'
proc    /proc   proc    defaults        0 0
sysfs   /sys    sysfs   defaults        0 0
devpts  /dev/pts devpts  gid=5,mode=620  0 0
tmpfs   /tmp    tmpfs   defaults        0 0
EOF

# /etc/profile
cat > etc/profile << 'EOF'
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
export HOME=/root
export TERM=xterm-256color
export LANG=C.UTF-8

# Welcome message
if [ -f /etc/motd ]; then
    cat /etc/motd
fi
EOF

# /etc/motd (Message of the day)
cat > etc/motd << 'EOF'
==========================================
  VibeCode Alpine ARM64 Development VM
==========================================

Alpine Linux with Node.js and AI Tools
Optimized for Apple Silicon / ARM64

Quick Commands:
  node --version     - Check Node.js
  npm --version      - Check npm
  code-server        - Start code-server (port 8080)
  apk add <package>  - Install packages

==========================================
EOF

echo "✅ Configuration files created"
echo ""

# Create startup script
echo "📝 Creating init script..."
cat > init << 'EOF'
#!/bin/sh
# VibeCode Alpine VM initialization script

# Mount filesystems
mount -t proc none /proc
mount -t sysfs none /sys
mount -t devtmpfs none /dev
mount -t devpts devpts /dev/pts
mount -t tmpfs tmpfs /tmp

# Set hostname
hostname -F /etc/hostname

# Configure networking (if virtio-net available)
if [ -d /sys/class/net/eth0 ]; then
    ip link set eth0 up
    udhcpc -i eth0 -f -q &
fi

# Run startup scripts if any
if [ -d /etc/init.d ]; then
    for script in /etc/init.d/S*; do
        if [ -x "$script" ]; then
            $script start
        fi
    done
fi

# Start shell
exec /bin/sh
EOF

chmod +x init

echo "✅ Init script created"
echo ""

# Create helper scripts
echo "📝 Creating helper scripts..."

# Create Node.js verification script
cat > usr/local/bin/verify-nodejs << 'EOF'
#!/bin/sh
echo "=== Node.js Verification ==="
echo "Node.js: $(node --version)"
echo "npm: $(npm --version)"
echo "Architecture: $(uname -m)"
echo "Libc: $(ldd /usr/local/bin/node 2>&1 | grep -o 'musl\|glibc' || echo 'static')"
echo ""
echo "Testing Node.js..."
node -e "console.log('✅ Node.js is working!')"
echo ""
echo "Installed global packages:"
npm list -g --depth=0 2>/dev/null || echo "None"
EOF

chmod +x usr/local/bin/verify-nodejs

# Create quick-start script
cat > usr/local/bin/quick-start << 'EOF'
#!/bin/sh
echo "=== VibeCode Quick Start ==="
echo ""
echo "1. Verify Node.js:"
echo "   verify-nodejs"
echo ""
echo "2. Install code-server:"
echo "   npm install -g code-server"
echo ""
echo "3. Start code-server:"
echo "   code-server --bind-addr 0.0.0.0:8080 --auth none"
echo ""
echo "4. Access from host:"
echo "   http://localhost:8080"
echo ""
EOF

chmod +x usr/local/bin/quick-start

echo "✅ Helper scripts created"
echo ""

# Create the initramfs
echo "📦 Creating initramfs (cpio.gz)..."
INITRAMFS_FILE="${ROOTFS_DIR}/alpine-vibecode-rootfs.cpio.gz"

find . -print0 | cpio --null -o -H newc | gzip -9 > "${INITRAMFS_FILE}"

INITRAMFS_SIZE=$(du -h "${INITRAMFS_FILE}" | cut -f1)
echo "✅ Initramfs created: ${INITRAMFS_SIZE}"
echo ""

# Summary
echo "=== Root Filesystem Build Complete ==="
echo ""
echo "Output: ${INITRAMFS_FILE}"
echo "Size: ${INITRAMFS_SIZE}"
echo ""
echo "Contents:"
echo "  ✅ Alpine Linux ${ALPINE_VERSION} base system"
echo "  ✅ Node.js ${NODE_VERSION}"
echo "  ✅ npm package manager"
echo "  ✅ APK package manager"
echo "  ✅ Network configuration"
echo "  ✅ Helper scripts (verify-nodejs, quick-start)"
echo ""
echo "Next step:"
echo "  ./scripts/vfkit/04-launch-alpine-vm.sh"
echo ""
