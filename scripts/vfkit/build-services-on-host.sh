#!/usr/bin/env bash
# Build ALL services directly using the working Alpine VM
# Then extract binaries for deployment

set -euo pipefail

VM_BASE="${HOME}/.vfkit/vms"
BUILD_DIR="/tmp/vibecode-builds"

mkdir -p "$BUILD_DIR"

echo "======================================================================"
echo "  Building ALL Tiny Services Using Alpine VM"
echo "======================================================================"
echo ""
echo "Strategy:"
echo "  1. Use the EXISTING working Alpine VM (has networking)"
echo "  2. SSH into it and run builds there"
echo "  3. Extract binaries via shared directory"
echo "  4. Create minimal service VMs with binaries"
echo ""

# Check if we have a working Alpine VM
if [[ ! -d "${VM_BASE}/vibecode-alpine" ]]; then
    echo "❌ No working Alpine VM found"
    echo "   Run: ./scripts/vfkit/03-create-alpine-vm.sh"
    exit 1
fi

# Check if Alpine VM is running
ALPINE_PID=$(ps aux | grep "vibecode-alpine" | grep vfkit | grep -v grep | awk '{print $2}' | head -1)
if [[ -z "$ALPINE_PID" ]]; then
    echo "Starting Alpine VM..."
    "${VM_BASE}/vibecode-alpine/launch.sh" > /tmp/alpine-vm.log 2>&1 &
    sleep 10
    echo "✅ Alpine VM started"
else
    echo "✅ Alpine VM already running (PID: $ALPINE_PID)"
fi

echo ""
echo "======================================================================"
echo "  Building Services in Alpine VM"
echo "======================================================================"
echo ""

# Create a master build script that builds everything
cat > "${BUILD_DIR}/build-all.sh" <<'BUILD_ALL'
#!/bin/sh
# Master build script - runs inside Alpine VM
set -e

BUILD_OUTPUT="/tmp/builds"
mkdir -p "$BUILD_OUTPUT"

echo "======================================================================"
echo "  1/4: Building Valkey"
echo "======================================================================"
echo ""

cd /tmp
apk add --no-cache build-base linux-headers wget

# Download and build Valkey
wget -q https://github.com/valkey-io/valkey/archive/refs/tags/8.1.0.tar.gz
tar -xzf 8.1.0.tar.gz
cd valkey-8.1.0

make -j$(nproc) \
    MALLOC=libc \
    USE_SYSTEMD=no \
    BUILD_TLS=no \
    OPTIMIZATION=-O3 \
    CFLAGS="-O3 -march=armv8-a -flto -fomit-frame-pointer" \
    LDFLAGS="-Wl,--gc-sections,--as-needed -static -flto"

make install PREFIX="$BUILD_OUTPUT/valkey"
strip --strip-unneeded "$BUILD_OUTPUT/valkey/bin/"*

echo "✅ Valkey built: $(du -sh $BUILD_OUTPUT/valkey)"
echo ""

echo "======================================================================"
echo "  2/4: Building PostgreSQL + pgvector"
echo "======================================================================"
echo ""

cd /tmp
apk add --no-cache postgresql16 postgresql16-dev git clang

# Build pgvector
git clone --depth 1 --branch v0.8.0 https://github.com/pgvector/pgvector.git
cd pgvector
make -j$(nproc) CC=clang CFLAGS="-O3 -march=armv8-a -flto"
make install

# Package PostgreSQL + pgvector
mkdir -p "$BUILD_OUTPUT/postgresql"
cp -r /usr/lib/postgresql16 "$BUILD_OUTPUT/postgresql/"
cp -r /usr/share/postgresql16 "$BUILD_OUTPUT/postgresql/"
cp /usr/bin/postgres "$BUILD_OUTPUT/postgresql/"
cp /usr/bin/psql "$BUILD_OUTPUT/postgresql/"

echo "✅ PostgreSQL + pgvector built: $(du -sh $BUILD_OUTPUT/postgresql)"
echo ""

echo "======================================================================"
echo "  3/4: Installing Node.js 24"
echo "======================================================================"
echo ""

apk add --no-cache nodejs npm

mkdir -p "$BUILD_OUTPUT/nodejs"
cp /usr/bin/node "$BUILD_OUTPUT/nodejs/"
cp /usr/bin/npm "$BUILD_OUTPUT/nodejs/"

echo "✅ Node.js installed: $(du -sh $BUILD_OUTPUT/nodejs)"
echo ""

echo "======================================================================"
echo "  4/4: Building openvscode-server + RAG Extension"
echo "======================================================================"
echo ""

cd /tmp
apk add --no-cache aria2 ca-certificates

# Download openvscode-server
aria2c --max-connection-per-server=16 --split=16 \
    https://github.com/gitpod-io/openvscode-server/releases/download/openvscode-server-v1.105.1/openvscode-server-v1.105.1-linux-arm64.tar.gz

tar -xzf openvscode-server-v1.105.1-linux-arm64.tar.gz
mv openvscode-server-v1.105.1-linux-arm64 "$BUILD_OUTPUT/openvscode-server"

# Install Continue extension (RAG)
cd "$BUILD_OUTPUT/openvscode-server"
./bin/openvscode-server --install-extension Continue.continue --extensions-dir=./extensions || echo "Will install at runtime"

# Strip binaries
find "$BUILD_OUTPUT/openvscode-server" -name "*.node" -exec strip --strip-unneeded {} \; 2>/dev/null || true

echo "✅ openvscode-server built: $(du -sh $BUILD_OUTPUT/openvscode-server)"
echo ""

echo "======================================================================"
echo "  ✅ ALL BUILDS COMPLETE!"
echo "======================================================================"
echo ""
echo "Build outputs:"
ls -lh "$BUILD_OUTPUT"
echo ""
echo "Total sizes:"
du -sh "$BUILD_OUTPUT"/*
echo ""
echo "Creating tarball for export..."
cd "$BUILD_OUTPUT"
tar -czf /tmp/all-services.tar.gz *
echo "✅ Tarball created: /tmp/all-services.tar.gz"
ls -lh /tmp/all-services.tar.gz
BUILD_ALL

echo "📝 Created master build script"
echo ""

# Now we need to get this script into the VM and run it
# Since the VM uses initramfs and we can't easily SSH, let's use a different approach:
# Create a new VM with the build script embedded in a persistent disk

echo "======================================================================"
echo "  Approach: Use Shared Host Directory"
echo "======================================================================"
echo ""
echo "Since vfkit VMs can't easily share files, let's:"
echo "  1. Create build scripts that write to /tmp"
echo "  2. Monitor console output for completion"
echo "  3. Access built binaries through VM disk images"
echo ""
echo "Alternative: Use the EXISTING Alpine VM interactively"
echo ""

cat <<MANUAL_STEPS
====================================================================
  MANUAL BUILD STEPS (FASTEST APPROACH)
====================================================================

The Alpine VM is running. To build services:

1. Open VM console in another terminal:
   tail -f ~/.vfkit/vms/vibecode-alpine/logs/console.log

2. In the console, login and run these commands:

   # Update packages
   apk update && apk add build-base linux-headers wget aria2 git postgresql16-dev clang nodejs npm ca-certificates

   # Build Valkey (~3 min)
   cd /tmp
   wget https://github.com/valkey-io/valkey/archive/refs/tags/8.1.0.tar.gz
   tar -xzf 8.1.0.tar.gz && cd valkey-8.1.0
   make -j\$(nproc) MALLOC=libc USE_SYSTEMD=no BUILD_TLS=no OPTIMIZATION=-O3 LDFLAGS="-static"
   make install PREFIX=/opt/valkey
   du -sh /opt/valkey

   # Build pgvector (~1 min)
   cd /tmp
   git clone --depth 1 --branch v0.8.0 https://github.com/pgvector/pgvector.git
   cd pgvector
   make -j\$(nproc) && make install
   echo "✅ pgvector installed"

   # Download openvscode-server (~2 min)
   cd /opt
   aria2c --max-connection-per-server=16 --split=16 \
     https://github.com/gitpod-io/openvscode-server/releases/download/openvscode-server-v1.105.1/openvscode-server-v1.105.1-linux-arm64.tar.gz
   tar -xzf openvscode-server-v1.105.1-linux-arm64.tar.gz
   mv openvscode-server-v1.105.1-linux-arm64 openvscode-server
   du -sh /opt/openvscode-server

3. Verify builds:
   /opt/valkey/bin/valkey-server --version
   node --version
   /opt/openvscode-server/node --version

4. Start services:
   /opt/valkey/bin/valkey-server --daemonize yes
   /opt/openvscode-server/bin/openvscode-server --host 0.0.0.0 --port 3000 &

====================================================================
  Or: Use This Automated Script
====================================================================

Copy/paste this entire block into the Alpine VM console:

$(cat "${BUILD_DIR}/build-all.sh")

====================================================================

MANUAL_STEPS

echo ""
echo "Would you like me to:"
echo "  A) Create an automated solution (will take more setup time)"
echo "  B) Provide detailed manual steps to run in the Alpine VM (faster)"
echo ""
echo "Recommendation: Use manual steps in the working Alpine VM"
echo "This is the FASTEST way to get working tiny builds!"
echo ""

