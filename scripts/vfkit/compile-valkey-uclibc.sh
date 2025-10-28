#!/usr/bin/env bash
# Compile Valkey with uClibc for ultra-minimal footprint
# Alternative to musl for even smaller binaries
set -euo pipefail

VALKEY_VERSION="${1:-7.2.5}"
BUILD_DIR="/tmp/valkey-uclibc-build"

echo "=== Compiling Valkey ${VALKEY_VERSION} with uClibc ==="
echo "⚠️  Note: uClibc requires cross-compilation toolchain"
echo ""

# Check for uClibc toolchain
if ! command -v arm-linux-uclibcgnueabi-gcc &> /dev/null; then
  echo "❌ uClibc ARM64 toolchain not found"
  echo ""
  echo "Install options:"
  echo "1. Use Buildroot to create toolchain:"
  echo "   git clone https://github.com/buildroot/buildroot"
  echo "   make menuconfig  # Select uClibc, ARM64"
  echo "   make toolchain"
  echo ""
  echo "2. Use pre-built toolchain:"
  echo "   https://toolchains.bootlin.com/"
  echo ""
  echo "3. Use musl instead (recommended for Alpine):"
  echo "   ./compile-valkey-musl.sh"
  exit 1
fi

echo "✅ uClibc toolchain found"
echo ""

# Install dependencies
apk add --no-cache wget ca-certificates

# Create build directory
mkdir -p "${BUILD_DIR}"
cd "${BUILD_DIR}"

# Download Valkey
echo "Downloading Valkey ${VALKEY_VERSION}..."
wget -q "https://github.com/valkey-io/valkey/archive/refs/tags/${VALKEY_VERSION}.tar.gz"
tar xzf "${VALKEY_VERSION}.tar.gz"
cd "valkey-${VALKEY_VERSION}"

# Configure for uClibc cross-compilation
echo "Configuring for uClibc..."
export CC=arm-linux-uclibcgnueabi-gcc
export AR=arm-linux-uclibcgnueabi-ar
export RANLIB=arm-linux-uclibcgnueabi-ranlib
export STRIP=arm-linux-uclibcgnueabi-strip

# Build
echo "Building with uClibc..."
make -j$(nproc) \
  CC="${CC}" \
  AR="${AR}" \
  RANLIB="${RANLIB}" \
  MALLOC=libc \
  USE_SYSTEMD=no \
  BUILD_TLS=no \
  OPTIMIZATION=-Os \
  CFLAGS="-Os -fomit-frame-pointer -pipe -ffunction-sections -fdata-sections" \
  LDFLAGS="-Wl,--gc-sections -static"

# Strip for minimal size
echo "Stripping binaries..."
"${STRIP}" src/valkey-server
"${STRIP}" src/valkey-cli

echo ""
echo "Binary sizes (uClibc):"
ls -lh src/valkey-server src/valkey-cli

echo ""
echo "✅ Valkey compiled with uClibc"
echo ""
echo "Note: uClibc binaries are typically 20-30% smaller than musl"
echo "      but musl is recommended for Alpine Linux compatibility"
