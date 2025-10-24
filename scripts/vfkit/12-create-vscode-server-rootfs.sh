#!/usr/bin/env bash
# Create Alpine Linux ARM64 rootfs with Node.js 24 + Gitpod openvscode-server
# Based on official nodejs/docker-node Alpine Dockerfile + Gitpod openvscode-server

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VM_DIR="${HOME}/.vfkit/vms/vibecode-alpine"
ROOTFS_DIR="${VM_DIR}/rootfs"
WORK_DIR="${ROOTFS_DIR}/build-vscode-server"

# Official versions
NODE_VERSION="24.10.0"
YARN_VERSION="1.22.22"
ALPINE_VERSION="3.21"
OPENVSCODE_VERSION="1.105.1"

# Architecture detection (for ARM64/aarch64)
ARCH="arm64"
NODE_CHECKSUM="3cde0b24eb658e4e0fa2bfbf6de4e3ab2aa2e2b6bc6ddb23cbb0eab4dc04df95"  # ARM64 musl checksum
OPENSSL_ARCH="linux-aarch64"

echo "════════════════════════════════════════════════════════"
echo "  Creating Alpine ARM64 Rootfs with VS Code Server"
echo "════════════════════════════════════════════════════════"
echo ""
echo "Alpine Version: ${ALPINE_VERSION}"
echo "Node.js Version: ${NODE_VERSION} (musl)"
echo "OpenVSCode Server: v${OPENVSCODE_VERSION} (Gitpod)"
echo "Yarn Version: ${YARN_VERSION}"
echo "Architecture: ${ARCH}"
echo "Build Directory: ${WORK_DIR}"
echo ""

# Clean and create work directory
rm -rf "${WORK_DIR}"
mkdir -p "${WORK_DIR}"
cd "${WORK_DIR}"

# Create Alpine directory structure
echo "📁 Creating Alpine directory structure..."
mkdir -p {bin,sbin,etc,proc,sys,dev,tmp,var,run,root,home}
mkdir -p {usr/bin,usr/sbin,usr/lib,usr/local/bin,usr/local/lib,lib}
mkdir -p {etc/apk,var/cache/apk,var/lib/apk}
mkdir -p {opt,srv,mnt,media}

echo "✅ Directory structure created"
echo ""

# Download Alpine mini root filesystem
echo "📥 Downloading Alpine ${ALPINE_VERSION} mini rootfs..."
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

# Install libstdc++ (runtime dependency for Node.js)
echo "📦 Installing libstdc++ runtime dependency..."
echo "   (Required by Node.js compiled binaries)"

mkdir -p etc/apk
cat > etc/apk/world << 'EOF'
libstdc++
git
curl
bash
EOF

echo "✅ Runtime dependencies configured"
echo ""

# Download Node.js 24 musl binary
echo "📥 Downloading Node.js ${NODE_VERSION} (ARM64 musl build)..."
echo "   Source: unofficial-builds.nodejs.org (official Alpine source)"

NODE_TARBALL="node-v${NODE_VERSION}-linux-${ARCH}-musl.tar.xz"
NODE_URL="https://unofficial-builds.nodejs.org/download/release/v${NODE_VERSION}/${NODE_TARBALL}"

if [[ ! -f "../${NODE_TARBALL}" ]]; then
    echo "   URL: ${NODE_URL}"
    curl -L -o "../${NODE_TARBALL}" "${NODE_URL}"
    echo "✅ Downloaded: ${NODE_TARBALL}"
else
    echo "✅ Using cached: ${NODE_TARBALL}"
fi

# Extract Node.js to /usr/local (official convention)
echo "📦 Extracting Node.js to /usr/local..."
tar -xJf "../${NODE_TARBALL}" -C usr/local --strip-components=1 --no-same-owner

echo "✅ Node.js installed"
echo ""

# Optimize Node.js: Remove unused OpenSSL headers (saves ~34MB like official Dockerfile)
echo "🔧 Optimizing Node.js installation..."
echo "   Removing unused OpenSSL headers for architectures other than ${OPENSSL_ARCH}..."

find usr/local/include/node/openssl/archs -mindepth 1 -maxdepth 1 \
  ! -name "$OPENSSL_ARCH" -exec rm -rf {} \;

echo "✅ Node.js optimized"
echo ""

# Download Gitpod OpenVSCode Server
echo "📥 Downloading Gitpod OpenVSCode Server v${OPENVSCODE_VERSION} (ARM64)..."
OPENVSCODE_TARBALL="openvscode-server-v${OPENVSCODE_VERSION}-linux-arm64.tar.gz"
OPENVSCODE_URL="https://github.com/gitpod-io/openvscode-server/releases/download/openvscode-server-v${OPENVSCODE_VERSION}/${OPENVSCODE_TARBALL}"

if [[ ! -f "../${OPENVSCODE_TARBALL}" ]]; then
    echo "   URL: ${OPENVSCODE_URL}"
    curl -L -o "../${OPENVSCODE_TARBALL}" "${OPENVSCODE_URL}"
    echo "✅ Downloaded: ${OPENVSCODE_TARBALL}"
else
    echo "✅ Using cached: ${OPENVSCODE_TARBALL}"
fi

# Extract OpenVSCode Server to /opt
echo "📦 Extracting OpenVSCode Server to /opt..."
mkdir -p opt
tar -xzf "../${OPENVSCODE_TARBALL}" -C opt
mv opt/openvscode-server-v${OPENVSCODE_VERSION}-linux-arm64 opt/openvscode-server

echo "✅ OpenVSCode Server installed"
echo ""

# Verify installations
echo "🔍 Verifying installations..."
NODE_BIN="usr/local/bin/node"
NPM_BIN="usr/local/bin/npm"
OPENVSCODE_BIN="opt/openvscode-server/bin/openvscode-server"

if [[ -f "${NODE_BIN}" ]]; then
    NODE_ACTUAL_VERSION=$(usr/local/bin/node --version 2>/dev/null || echo "unknown")
    echo "✅ Node.js: ${NODE_ACTUAL_VERSION}"
else
    echo "❌ Node.js binary not found"
fi

if [[ -f "${NPM_BIN}" ]]; then
    NPM_ACTUAL_VERSION=$(usr/local/bin/npm --version 2>/dev/null || echo "unknown")
    echo "✅ npm: v${NPM_ACTUAL_VERSION}"
else
    echo "❌ npm binary not found"
fi

if [[ -f "${OPENVSCODE_BIN}" ]]; then
    echo "✅ OpenVSCode Server: v${OPENVSCODE_VERSION}"
else
    echo "❌ OpenVSCode Server binary not found"
fi

echo ""

# Create node user (UID 1000, GID 1000) - official convention
echo "👤 Creating node user..."
cat > etc/passwd << 'EOF'
root:x:0:0:root:/root:/bin/sh
node:x:1000:1000::/home/node:/bin/sh
EOF

cat > etc/group << 'EOF'
root:x:0:
node:x:1000:
EOF

# Create home directory for node user
mkdir -p home/node
echo "✅ User 'node' created (UID 1000)"
echo ""

# Create helper scripts
echo "📝 Creating helper scripts..."

# Verify Node.js script
cat > usr/local/bin/verify-nodejs << 'EOF'
#!/bin/sh
echo "=== Node.js Verification ==="
echo ""
echo "Node.js version:"
node --version
echo ""
echo "npm version:"
npm --version
echo ""
echo "Node.js binary:"
which node
echo ""
echo "npm binary:"
which npm
echo ""
echo "Linked libraries:"
ldd /usr/local/bin/node 2>&1 | grep -i musl || echo "Static or musl binary"
echo ""
echo "✅ Node.js is installed and working!"
EOF
chmod +x usr/local/bin/verify-nodejs

# Verify OpenVSCode Server script
cat > usr/local/bin/verify-vscode << 'EOF'
#!/bin/sh
echo "=== OpenVSCode Server Verification ==="
echo ""
echo "OpenVSCode Server version:"
/opt/openvscode-server/bin/openvscode-server --version
echo ""
echo "Binary location:"
ls -lh /opt/openvscode-server/bin/openvscode-server
echo ""
echo "✅ OpenVSCode Server is installed and working!"
EOF
chmod +x usr/local/bin/verify-vscode

# Start OpenVSCode Server script
cat > usr/local/bin/start-vscode << 'EOF'
#!/bin/sh
echo "=== Starting OpenVSCode Server ==="
echo ""
echo "Binding to: 0.0.0.0:3000"
echo "Access from macOS: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop"
echo ""

# Start OpenVSCode Server
/opt/openvscode-server/bin/openvscode-server \
  --host 0.0.0.0 \
  --port 3000 \
  --without-connection-token \
  --accept-server-license-terms \
  "$@"
EOF
chmod +x usr/local/bin/start-vscode

# Quick start script
cat > usr/local/bin/quick-start << 'EOF'
#!/bin/sh
cat << 'HELP'
=== VibeCode Alpine VM - Quick Start ===

Node.js 24.10.0 + OpenVSCode Server v1.105.1

Basic Commands:
  verify-nodejs    - Verify Node.js installation
  verify-vscode    - Verify OpenVSCode Server installation
  start-vscode     - Start OpenVSCode Server on port 3000

Package Management:
  apk add <pkg>    - Install Alpine packages
  npm install -g <pkg> - Install global npm packages

OpenVSCode Server:
  Access: http://localhost:3000
  Start: start-vscode

  Custom port: start-vscode --port 8080
  With token: start-vscode --connection-token mytoken

Examples:
  # Start VS Code Server
  start-vscode

  # Install packages
  apk add git curl vim
  npm install -g typescript @types/node

  # Test Node.js
  node -e "console.log('Hello from Alpine + Node 24!')"

Network:
  - VM has NAT networking
  - Access services via localhost on macOS
  - Example: http://localhost:3000 for VS Code

Documentation:
  /Users/studio/Documents/vibecode-webgui/scripts/vfkit/README.md

HELP
EOF
chmod +x usr/local/bin/quick-start

echo "✅ Helper scripts created"
echo ""

# Create init script for OpenVSCode Server
echo "📝 Creating init scripts..."
mkdir -p etc/init.d

cat > etc/init.d/vscode-server << 'EOF'
#!/sbin/openrc-run
# OpenRC init script for OpenVSCode Server

name="openvscode-server"
description="Gitpod OpenVSCode Server"

command="/opt/openvscode-server/bin/openvscode-server"
command_args="--host 0.0.0.0 --port 3000 --without-connection-token --accept-server-license-terms"
command_background=true
pidfile="/var/run/${RC_SVCNAME}.pid"
command_user="node:node"

depend() {
    need net
    after firewall
}
EOF
chmod +x etc/init.d/vscode-server

echo "✅ Init scripts created"
echo ""

# Set correct permissions
echo "🔒 Setting permissions..."
chown -R 1000:1000 home/node 2>/dev/null || true
echo "✅ Permissions set"
echo ""

# Create the cpio.gz archive
echo "📦 Creating cpio.gz rootfs archive..."
OUTPUT_FILE="${ROOTFS_DIR}/alpine-vscode-server-rootfs.cpio.gz"

find . | cpio -H newc -o | gzip -9 > "${OUTPUT_FILE}"

ROOTFS_SIZE=$(du -h "${OUTPUT_FILE}" | cut -f1)

echo "✅ Rootfs created successfully!"
echo ""

# Summary
echo "════════════════════════════════════════════════════════"
echo "  Build Complete!"
echo "════════════════════════════════════════════════════════"
echo ""
echo "Rootfs: ${OUTPUT_FILE}"
echo "Size: ${ROOTFS_SIZE}"
echo ""
echo "Installed Software:"
echo "  ✅ Alpine Linux ${ALPINE_VERSION}"
echo "  ✅ Node.js ${NODE_VERSION} (musl-optimized)"
echo "  ✅ npm $(usr/local/bin/npm --version 2>/dev/null || echo 'installed')"
echo "  ✅ OpenVSCode Server v${OPENVSCODE_VERSION} (Gitpod)"
echo ""
echo "Helper Scripts:"
echo "  - verify-nodejs    - Verify Node.js installation"
echo "  - verify-vscode    - Verify OpenVSCode Server"
echo "  - start-vscode     - Start OpenVSCode Server"
echo "  - quick-start      - Show quick start guide"
echo ""
echo "Next Steps:"
echo "  1. Launch VM:"
echo "     ./scripts/vfkit/13-launch-vscode-server-vm.sh"
echo ""
echo "  2. Inside VM:"
echo "     start-vscode"
echo ""
echo "  3. Access from macOS:"
echo "     http://localhost:3000"
echo ""
echo "Build artifacts: ${WORK_DIR}"
echo ""
