#!/usr/bin/env bash
# Create Alpine Linux ARM64 rootfs for VibeCode
# Includes Node.js and custom init script for virtiofs mounting

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VM_DIR="${HOME}/.vfkit/vms/vibecode-alpine"
ROOTFS_DIR="${VM_DIR}/rootfs"
WORK_DIR="${ROOTFS_DIR}/build-vibecode"

ALPINE_VERSION="3.19"
NODE_VERSION="20.11.1"

echo "=== Creating VibeCode Alpine ARM64 Root Filesystem ==="
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
postgres:x:70:70:PostgreSQL:/var/lib/postgresql:/bin/sh
redis:x:71:71:Redis:/var/lib/redis:/bin/sh
EOF

# /etc/group
cat > etc/group << 'EOF'
root:x:0:
nobody:x:65534:
postgres:x:70:
redis:x:71:
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

Alpine Linux with Node.js
Optimized for Apple Silicon / ARM64

Quick Commands:
  node --version         - Check Node.js
  npm --version          - Check npm
  start-services         - Start PostgreSQL & Redis
  stop-services          - Stop all services

Project Directory:
  /mnt/vibecode          - Shared with host

Setup Guide:
  /mnt/vibecode/scripts/vfkit/vm-setup-services.sh

==========================================
EOF

echo "✅ Configuration files created"
echo ""

# Copy the VibeCode init script
echo "📝 Installing VibeCode init script..."
if [[ -f "${SCRIPT_DIR}/vibecode-init.sh" ]]; then
    cp "${SCRIPT_DIR}/vibecode-init.sh" init
    chmod +x init
    echo "✅ VibeCode init script installed"
else
    echo "⚠️  VibeCode init script not found, using default init"
    # Create startup script
    cat > init << 'EOF'
#!/bin/sh
# VibeCode Alpine VM initialization script

# Mount filesystems
mount -t proc none /proc
mount -t sysfs none /sys
mount -t devtmpfs none /dev
mkdir -p /dev/pts
mount -t devpts devpts /dev/pts
mount -t tmpfs tmpfs /tmp

# Set hostname
hostname -F /etc/hostname

# Configure networking (if virtio-net available)
if [ -d /sys/class/net/eth0 ]; then
    ip link set eth0 up
    udhcpc -i eth0 -f -q &
fi

# Mount VibeCode shared directory via virtiofs
echo "Mounting VibeCode shared directory..."
mkdir -p /mnt/vibecode
if mount -t virtiofs vibecode /mnt/vibecode 2>/dev/null; then
    echo "✅ VibeCode directory mounted at /mnt/vibecode"
else
    echo "⚠️  Failed to mount virtiofs share"
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
fi

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
echo "1. Setup services (first time only):"
echo "   /mnt/vibecode/scripts/vfkit/vm-setup-services.sh"
echo ""
echo "2. Start services:"
echo "   start-services"
echo ""
echo "3. Check services:"
echo "   supervisorctl status"
echo ""
echo "4. Setup VibeCode:"
echo "   cd /mnt/vibecode"
echo "   npm install"
echo "   cp .env.example .env"
echo "   # Edit .env with proper DATABASE_URL and REDIS_URL"
echo "   npx prisma migrate deploy"
echo "   npm run build"
echo ""
echo "5. Start VibeCode:"
echo "   npm start"
echo ""
echo "Access from host:"
echo "   http://localhost:3000"
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
echo "=== VibeCode Root Filesystem Build Complete ==="
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
echo "  ✅ VirtioFS mount support"
echo "  ✅ Helper scripts (verify-nodejs, quick-start)"
echo "  ✅ User accounts (postgres, redis)"
echo ""
echo "Next step:"
echo "  ./scripts/vfkit/05-launch-vibecode-vm.sh"
echo ""
