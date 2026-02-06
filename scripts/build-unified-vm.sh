#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

set -e


# Initialize log aggregation
init_log_aggregation

echo "=== Building Unified VM ==="

# Use optimized base from Agent D3
if [ ! -f ~/vibecode-webgui/azure/unified-services-optimized.cpio.gz ]; then
    echo "ERROR: Optimized base not found"
    exit 1
fi

# Extract and add missing libraries
rm -rf /tmp/unified-vm-build
mkdir -p /tmp/unified-vm-build
cd /tmp/unified-vm-build

gunzip -c ~/vibecode-webgui/azure/unified-services-optimized.cpio.gz | cpio -idm

# Add dependencies from Agent D3's work
mkdir -p /tmp/unified-libs
cd /tmp/unified-libs

curl -s -L -O http://ports.ubuntu.com/pool/main/r/readline/libreadline8_8.2-1.3build1_arm64.deb
curl -s -L -O http://ports.ubuntu.com/pool/main/s/systemd/libsystemd0_249.11-0ubuntu3_arm64.deb
curl -s -L -O http://ports.ubuntu.com/pool/main/o/openssl/libssl3_3.0.2-0ubuntu1_arm64.deb

for deb in *.deb; do
    ar x "$deb" 2>/dev/null
    tar xf data.tar.* 2>/dev/null || true
    rm -f control.tar.* debian-binary data.tar.*
done

cp -a lib/aarch64-linux-gnu/*.so* /tmp/unified-vm-build/lib/aarch64-linux-gnu/ 2>/dev/null || true
cp -a usr/lib/aarch64-linux-gnu/*.so* /tmp/unified-vm-build/usr/lib/aarch64-linux-gnu/ 2>/dev/null || true

# Build
cd /tmp/unified-vm-build
find . | cpio -o -H newc | gzip > ~/vibecode-webgui/azure/unified-services-restored.cpio.gz

echo "✓ Unified VM built: unified-services-restored.cpio.gz"
ls -lh ~/vibecode-webgui/azure/unified-services-restored.cpio.gz
