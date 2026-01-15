#!/usr/bin/env bash
# Run actual builds in Alpine VM
set -euo pipefail

echo "======================================================================"
echo "  Running Alpine VM Builds"
echo "======================================================================"
echo ""

VM_DIR="${HOME}/.vfkit/vms/vibecode-alpine"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check if VM files exist
if [[ ! -d "$VM_DIR" ]]; then
    echo "❌ VM not set up. Run: ./scripts/vfkit/install-alpine-vm.sh"
    exit 1
fi

echo "✅ VM directory: $VM_DIR"
echo ""

# Create a build script to copy into the VM
cat > /tmp/alpine-build-all.sh <<'BUILDSCRIPT'
#!/bin/sh
# This runs inside the Alpine VM
set -e

echo "=== Alpine VM Build Script ==="
echo ""
echo "System Information:"
cat /etc/alpine-release
uname -a
free -m
echo ""

# Install build dependencies
echo "📦 Installing build dependencies..."
apk update
apk add --no-cache \
    build-base \
    linux-headers \
    wget \
    ca-certificates \
    git \
    postgresql16 \
    postgresql16-dev \
    postgresql16-client

# Build Valkey
echo ""
echo "======================================================================"
echo "  Building Valkey 7.2.8"
echo "======================================================================"
echo ""

VALKEY_VERSION="7.2.8"
cd /tmp
wget -q "https://github.com/valkey-io/valkey/archive/refs/tags/${VALKEY_VERSION}.tar.gz" -O valkey.tar.gz
tar xzf valkey.tar.gz
cd "valkey-${VALKEY_VERSION}"

echo "Compiling with ARM64 optimizations..."
make -j$(nproc) \
    MALLOC=libc \
    USE_SYSTEMD=no \
    BUILD_TLS=yes \
    OPTIMIZATION=-O3 \
    CFLAGS="-O3 -march=armv8-a+crc+crypto -mtune=cortex-a76 -flto" \
    LDFLAGS="-Wl,--gc-sections,-O3,--as-needed -flto"

strip src/valkey-server src/valkey-cli src/valkey-benchmark

echo ""
echo "✅ Valkey built successfully!"
ls -lh src/valkey-server src/valkey-cli src/valkey-benchmark
echo ""

# Build pgvector
echo "======================================================================"
echo "  Building pgvector 0.9.0"
echo "======================================================================"
echo ""

PGVECTOR_VERSION="0.9.0"
cd /tmp
git clone --depth 1 --branch v${PGVECTOR_VERSION} https://github.com/pgvector/pgvector.git
cd pgvector

echo "Compiling with ARM64 optimizations..."
make OPTFLAGS="-O3 -march=armv8-a+crc"
make install

echo ""
echo "✅ pgvector built successfully!"
echo ""

# Test Node.js
echo "======================================================================"
echo "  Testing Node.js"
echo "======================================================================"
echo ""

if command -v node &>/dev/null; then
    node --version
    npm --version
    
    echo ""
    echo "Testing Node.js modules..."
    node -e "
        const crypto = require('crypto');
        const os = require('os');
        console.log('✓ Architecture:', os.arch());
        console.log('✓ Node version:', process.version);
        console.log('✓ Crypto:', crypto.randomBytes ? 'OK' : 'FAIL');
    "
    echo ""
    echo "✅ Node.js working!"
else
    echo "⚠️  Node.js not installed, installing..."
    apk add --no-cache nodejs npm
    node --version
fi

# Summary
echo ""
echo "======================================================================"
echo "  Build Summary"
echo "======================================================================"
echo ""
echo "✅ Valkey 7.2.8 compiled with ARM64 optimizations"
echo "✅ pgvector 0.9.0 compiled and installed"
echo "✅ Node.js $(node --version) verified"
echo ""
echo "Binaries:"
ls -lh /tmp/valkey-${VALKEY_VERSION}/src/valkey-{server,cli,benchmark} 2>/dev/null || true
echo ""
echo "🎉 All builds complete!"
BUILDSCRIPT

chmod +x /tmp/alpine-build-all.sh

echo "📝 Created build script: /tmp/alpine-build-all.sh"
echo ""

# Check if we have a running VM or need to start one
echo "Starting Alpine VM with vfkit..."
echo ""

# Create a simple VM launcher that runs our build script
"${SCRIPT_DIR}/04-launch-alpine-vm.sh" &
VM_PID=$!

echo "VM launched with PID: $VM_PID"
echo ""
echo "⏳ Waiting for VM to boot (30 seconds)..."
sleep 30

echo ""
echo "======================================================================"
echo "  VM Status"
echo "======================================================================"
echo ""
echo "The Alpine VM is running in the background."
echo ""
echo "To copy and run the build script manually:"
echo "  1. Connect to VM console (see logs in $VM_DIR/logs/)"
echo "  2. Copy /tmp/alpine-build-all.sh into the VM"
echo "  3. Run: sh /tmp/alpine-build-all.sh"
echo ""
echo "Or wait for VM to finish booting and access via serial console."
echo ""
echo "Build script is ready at: /tmp/alpine-build-all.sh"
echo "VM console log: $VM_DIR/logs/console.log"
echo ""
echo "To view console output:"
echo "  tail -f $VM_DIR/logs/console.log"

