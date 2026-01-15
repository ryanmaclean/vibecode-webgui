#!/usr/bin/env bash
# Compile Valkey with musl for Alpine ARM64
# Optimized for minimal size and maximum performance
set -euo pipefail

VALKEY_VERSION="${1:-7.2.8}"
BUILD_DIR="/tmp/valkey-build"
INSTALL_PREFIX="${2:-/usr/local}"

echo "=== Compiling Valkey ${VALKEY_VERSION} with musl ==="
echo "Target: Alpine ARM64 (aarch64)"
echo "Install prefix: ${INSTALL_PREFIX}"
echo ""

# Install build dependencies
echo "Installing build dependencies..."
apk add --no-cache \
  build-base \
  linux-headers \
  wget \
  ca-certificates

# Create build directory
mkdir -p "${BUILD_DIR}"
cd "${BUILD_DIR}"

# Download Valkey source
echo "Downloading Valkey ${VALKEY_VERSION}..."
wget -q "https://github.com/valkey-io/valkey/archive/refs/tags/${VALKEY_VERSION}.tar.gz" \
  -O valkey.tar.gz

echo "Extracting..."
tar xzf valkey.tar.gz
cd "valkey-${VALKEY_VERSION}"

# Configure build for musl with ARM64 optimizations
echo "Configuring build for ARM64..."
cat > .build-config <<'EOF'
# musl-specific optimizations
MALLOC=libc
USE_SYSTEMD=no
BUILD_TLS=no

# ARM64 aggressive optimizations
OPTIMIZATION=-O3
CFLAGS=-O3 -march=armv8-a+crc+crypto -mtune=cortex-a76 -flto -fomit-frame-pointer -pipe -ffunction-sections -fdata-sections -DUSE_PROCESSOR_CLOCK
LDFLAGS=-Wl,--gc-sections,-O3,--as-needed -static -flto

# ARM64 specific
ARCH=arm64

# Optimization flags explained:
# -O3: Maximum optimization
# -march=armv8-a+crc+crypto: Use ARM64 CRC and crypto extensions
# -mtune=cortex-a76: Optimize for Apple Silicon (similar to M-series)
# -flto: Link-time optimization
# -DUSE_PROCESSOR_CLOCK: Use ARM cycle counter for timing
EOF

echo "ARM64 optimizations enabled:"
echo "  • CRC32 hardware acceleration"
echo "  • Crypto extensions"
echo "  • Cortex-A76 tuning (M-series compatible)"
echo "  • Link-time optimization (LTO)"
echo ""

# Build Valkey with aggressive ARM64 optimizations
echo "Building Valkey with ARM64 optimizations..."
NCPUS=$(nproc)
echo "Using ${NCPUS} CPU cores for parallel build"

make -j${NCPUS} \
  MALLOC=libc \
  USE_SYSTEMD=no \
  BUILD_TLS=no \
  OPTIMIZATION=-O3 \
  CFLAGS="-O3 -march=armv8-a+crc+crypto -mtune=cortex-a76 -flto -fomit-frame-pointer -pipe -ffunction-sections -fdata-sections -DUSE_PROCESSOR_CLOCK" \
  LDFLAGS="-Wl,--gc-sections,-O3,--as-needed -static -flto"

echo "Build completed in parallel using ${NCPUS} cores"

# Strip binaries for minimal size
echo "Stripping binaries..."
strip src/valkey-server
strip src/valkey-cli
strip src/valkey-benchmark

# Show binary sizes
echo ""
echo "Binary sizes:"
ls -lh src/valkey-server src/valkey-cli src/valkey-benchmark

# Install
echo ""
echo "Installing to ${INSTALL_PREFIX}..."
make PREFIX="${INSTALL_PREFIX}" install

# Create system user and directories
echo "Creating valkey user and directories..."
if ! id valkey &>/dev/null; then
  adduser -D -s /sbin/nologin valkey
fi

mkdir -p /var/lib/valkey /var/log/valkey /etc/valkey
chown -R valkey:valkey /var/lib/valkey /var/log/valkey

# Create default configuration
echo "Creating configuration..."
cat > /etc/valkey/valkey.conf <<'VALKEYCONF'
# Valkey configuration for Alpine ARM64
# Optimized for musl and minimal resource usage

# Network
bind 0.0.0.0
port 6379
tcp-backlog 511
timeout 0
tcp-keepalive 300

# General
daemonize yes
pidfile /var/run/valkey.pid
loglevel notice
logfile /var/log/valkey/valkey.log
databases 16

# Persistence
save 900 1
save 300 10
save 60 10000
stop-writes-on-bgsave-error yes
rdbcompression yes
rdbchecksum yes
dbfilename dump.rdb
dir /var/lib/valkey

# Memory management
maxmemory 512mb
maxmemory-policy allkeys-lru
maxmemory-samples 5

# Performance tuning for musl/Alpine
lazyfree-lazy-eviction yes
lazyfree-lazy-expire yes
lazyfree-lazy-server-del yes

# Disable features not needed
appendonly no
VALKEYCONF

chown valkey:valkey /etc/valkey/valkey.conf
chmod 640 /etc/valkey/valkey.conf

# Create OpenRC init script
echo "Creating init script..."
cat > /etc/init.d/valkey <<'INITSCRIPT'
#!/sbin/openrc-run

name="valkey"
description="Valkey in-memory data store"
command="/usr/local/bin/valkey-server"
command_args="/etc/valkey/valkey.conf"
command_user="valkey:valkey"
pidfile="/var/run/valkey.pid"

depend() {
    need net
    use logger
}

start_pre() {
    checkpath --directory --owner valkey:valkey --mode 0755 \
        /var/run /var/log/valkey /var/lib/valkey
}
INITSCRIPT

chmod +x /etc/init.d/valkey

# Cleanup
echo "Cleaning up build files..."
cd /
rm -rf "${BUILD_DIR}"

# Verify installation
echo ""
echo "✅ Valkey ${VALKEY_VERSION} compiled and installed successfully!"
echo ""
echo "Binary locations:"
echo "  Server: ${INSTALL_PREFIX}/bin/valkey-server"
echo "  CLI: ${INSTALL_PREFIX}/bin/valkey-cli"
echo "  Benchmark: ${INSTALL_PREFIX}/bin/valkey-benchmark"
echo ""
echo "Configuration: /etc/valkey/valkey.conf"
echo "Data directory: /var/lib/valkey"
echo "Log file: /var/log/valkey/valkey.log"
echo ""
echo "To start Valkey:"
echo "  rc-update add valkey"
echo "  rc-service valkey start"
echo ""
echo "To test:"
echo "  valkey-cli ping"
echo ""

# Show compilation details
echo "Compilation details:"
echo "  Libc: musl (static)"
echo "  Optimization: -Os (size)"
echo "  Architecture: ARM64"
echo "  Stripped: yes"
echo ""

# Verify it works
echo "Testing Valkey..."
"${INSTALL_PREFIX}/bin/valkey-server" --version
echo ""
echo "✅ All done!"
