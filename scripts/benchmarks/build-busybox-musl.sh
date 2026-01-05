#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
ARCH=${1:-x86_64}
VERSION=${BUSYBOX_VERSION:-1.36.1}
BUILD_ROOT="$ROOT_DIR/bench-images/busybox"
SRC_DIR="$BUILD_ROOT/busybox-${VERSION}"

mkdir -p "$BUILD_ROOT"
cd "$BUILD_ROOT"

TARBALL="busybox-${VERSION}.tar.bz2"
URL="https://busybox.net/downloads/${TARBALL}"
if [[ ! -f $TARBALL ]]; then
  curl -LO "$URL"
fi

if [[ ! -d "$SRC_DIR" ]]; then
  tar -xf "$TARBALL"
fi

pushd "$SRC_DIR" >/dev/null
make distclean >/dev/null 2>&1 || true
make defconfig >/dev/null

# Force tiny config for reproducible builds
cat > .config <<'EOF'
CONFIG_HAVE_DOT_CONFIG=y
CONFIG_STATIC=y
CONFIG_SUID=y
CONFIG_BUILD_LIBBUSYBOX=n
CONFIG_FEATURE_SHARED_BUSYBOX=n
CONFIG_FEATURE_CLEAN_UP=y
CONFIG_SH_IS_ASH=y
CONFIG_ASH=y
CONFIG_LS=y
CONFIG_CAT=y
CONFIG_ECHO=y
CONFIG_GREP=y
CONFIG_TAR=y
CONFIG_CP=y
CONFIG_MKDIR=y
CONFIG_MV=y
CONFIG_RM=y
CONFIG_PWD=y
CONFIG_SLEEP=y
CONFIG_INIT=y
CONFIG_PING=y
CONFIG_IP=y
CONFIG_UDHCPC=y
CONFIG_UDHCPC_DEFAULT_SCRIPT="/udhcpc.script"
CONFIG_UDHCP_WITHOUT_IFUPDOWN=y
CONFIG_IFUP=y
CONFIG_IFDOWN=y
# CONFIG_FEATURE_IPV6 is not set
# CONFIG_FEATURE_IP_TUNNEL is not set
# CONFIG_SYSLOGD is not set
# CONFIG_KLOGD is not set
# CONFIG_TC is not set
# CONFIG_FEATURE_SYSLOG is not set
EOF

set +o pipefail
yes "" | make oldconfig >/dev/null
set -o pipefail

# Determine build args
CROSS_ARGS=()
CC=clang
LD=ld.lld
if [[ "$ARCH" == "arm64" ]]; then
  if command -v aarch64-linux-gnu-gcc >/dev/null 2>&1; then
    CROSS_ARGS=(ARCH=arm64 CROSS_COMPILE=aarch64-linux-gnu-)
    CC="${CROSS_ARGS[1]}gcc"
    LD="${CROSS_ARGS[1]}ld"
  else
    echo "⚠️  aarch64-linux-gnu-gcc not found; building natively with clang" >&2
    CROSS_ARGS=(ARCH=arm64 CROSS_COMPILE="")
    CC="clang -target aarch64-apple-darwin"
    LD="ld.lld"
  fi
elif [[ "$ARCH" == "armv7" ]]; then
  if command -v arm-linux-gnueabihf-gcc >/dev/null 2>&1; then
    CROSS_ARGS=(ARCH=arm CROSS_COMPILE=arm-linux-gnueabihf-)
    CC="${CROSS_ARGS[1]}gcc"
    LD="${CROSS_ARGS[1]}ld"
  else
    echo "⚠️  arm-linux-gnueabihf-gcc not found; building natively with clang" >&2
    CROSS_ARGS=(ARCH=arm CROSS_COMPILE="")
    CC="clang -target armv7-apple-darwin"
    LD="ld.lld"
  fi
else
  CROSS_ARGS=(ARCH=x86_64)
fi

make -j"$(sysctl -n hw.ncpu 2>/dev/null || nproc)" "${CROSS_ARGS[@]}" CC="$CC" LD="$LD" LDFLAGS="-static"
make install "${CROSS_ARGS[@]}" CC="$CC" LD="$LD" LDFLAGS="-static" CONFIG_PREFIX="$BUILD_ROOT/rootfs"

popd >/dev/null

echo "BusyBox rootfs stored in $BUILD_ROOT/rootfs"

