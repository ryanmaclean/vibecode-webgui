#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

set -e


# Initialize log aggregation
init_log_aggregation

echo "=== Building Valkey VM ==="

# Extract base initramfs
rm -rf /tmp/valkey-vm-build
mkdir -p /tmp/valkey-vm-build
cd /tmp/valkey-vm-build

# Use working base (Node.js or BasicVibeCode)
if [ -f ~/vibecode-webgui/azure/nodejs-complete.cpio.gz ]; then
    gunzip -c ~/vibecode-webgui/azure/nodejs-complete.cpio.gz | cpio -idm
else
    echo "ERROR: Base initramfs not found"
    exit 1
fi

# Download and add Valkey binary + dependencies
echo "Adding Valkey and dependencies..."

# Add libsystemd and dependencies (from Agent D1's work)
mkdir -p /tmp/valkey-libs
cd /tmp/valkey-libs

curl -s -L -O http://ports.ubuntu.com/pool/main/s/systemd/libsystemd0_249.11-0ubuntu3_arm64.deb
curl -s -L -O http://ports.ubuntu.com/pool/main/x/xz-utils/liblzma5_5.2.5-2ubuntu1_arm64.deb
curl -s -L -O http://ports.ubuntu.com/pool/main/l/lz4/liblz4-1_1.9.3-2build2_arm64.deb
curl -s -L -O http://ports.ubuntu.com/pool/main/g/gnutls28/libgnutls30_3.7.3-4ubuntu1_arm64.deb

for deb in *.deb; do
    ar x "$deb" 2>/dev/null
    tar xf data.tar.* 2>/dev/null || true
    rm -f control.tar.* debian-binary data.tar.*
done

cp -a lib/aarch64-linux-gnu/*.so* /tmp/valkey-vm-build/lib/aarch64-linux-gnu/ 2>/dev/null || true
cp -a usr/lib/aarch64-linux-gnu/*.so* /tmp/valkey-vm-build/lib/aarch64-linux-gnu/ 2>/dev/null || true

# Build initramfs
cd /tmp/valkey-vm-build
find . | cpio -o -H newc | gzip > ~/vibecode-webgui/azure/valkey-standalone-complete.cpio.gz

echo "✓ Valkey VM built: valkey-standalone-complete.cpio.gz"
ls -lh ~/vibecode-webgui/azure/valkey-standalone-complete.cpio.gz
