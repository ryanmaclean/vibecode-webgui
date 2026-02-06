#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

# Option 2: Use PostgreSQL 14 from Ubuntu 22.04 (matches glibc 2.35)

# Initialize log aggregation
init_log_aggregation

set -e

echo "=== Option 2: PostgreSQL 14 for Ubuntu 22.04 ==="

WORKDIR=/tmp/pg14-fix
rm -rf $WORKDIR
mkdir -p $WORKDIR
cd $WORKDIR

# Download PostgreSQL 14 and all its dependencies from Ubuntu 22.04
echo "Downloading PostgreSQL 14 and dependencies..."

# PostgreSQL 14
curl -L -o postgresql-14.deb "http://ports.ubuntu.com/pool/main/p/postgresql-14/postgresql-14_14.13-0ubuntu0.22.04.1_arm64.deb" || \
curl -L -o postgresql-14.deb "http://ports.ubuntu.com/pool/main/p/postgresql-14/postgresql-14_14.12-0ubuntu0.22.04.1_arm64.deb"

# Dependencies from 22.04
curl -L -o libldap.deb "http://ports.ubuntu.com/pool/main/o/openldap/libldap-2.5-0_2.5.16+dfsg-0ubuntu0.22.04.2_arm64.deb"
curl -L -o libsasl2.deb "http://ports.ubuntu.com/pool/main/c/cyrus-sasl2/libsasl2-2_2.1.27+dfsg2-3ubuntu1.2_arm64.deb"
curl -L -o libsystemd.deb "http://ports.ubuntu.com/pool/main/s/systemd/libsystemd0_249.11-0ubuntu3.12_arm64.deb"
curl -L -o libp11kit.deb "http://ports.ubuntu.com/pool/main/p/p11-kit/libp11-kit0_0.24.0-6build1_arm64.deb"
curl -L -o libtasn1.deb "http://ports.ubuntu.com/pool/main/libt/libtasn1-6/libtasn1-6_4.18.0-4build1_arm64.deb"
curl -L -o liblber.deb "http://ports.ubuntu.com/pool/main/o/openldap/liblber-2.5-0_2.5.16+dfsg-0ubuntu0.22.04.2_arm64.deb"

echo "Checking downloads..."
ls -la *.deb
for f in *.deb; do
    size=$(stat -f%z "$f" 2>/dev/null || stat -c%s "$f" 2>/dev/null)
    if [ "$size" -lt 1000 ]; then
        echo "WARNING: $f may be a 404 page (size: $size)"
        cat "$f" | head -3
    fi
done

echo "Extracting..."
mkdir -p extracted
cd extracted

for deb in ../*.deb; do
    echo "Processing $deb..."
    ar x "$deb" 2>/dev/null || continue
    if [ -f data.tar.zst ]; then
        zstd -d -f data.tar.zst && tar -xf data.tar
    elif [ -f data.tar.xz ]; then
        xz -d -f data.tar.xz && tar -xf data.tar
    elif [ -f data.tar.gz ]; then
        tar -xzf data.tar.gz
    fi
    rm -f data.tar* control.tar* debian-binary
done

echo "Found libraries:"
find . -name "*.so*" | head -20

echo "Copying to initramfs..."
# Restore original glibc 2.35
cp /tmp/initramfs-check/lib/libc.so.6 /tmp/glibc-check/lib/libc.so.6 2>/dev/null || true

# Copy PostgreSQL binaries
find . -name "postgres" -exec cp {} /tmp/glibc-check/usr/bin/postgres \; 2>/dev/null || true
find . -name "initdb" -exec cp {} /tmp/glibc-check/usr/bin/initdb \; 2>/dev/null || true

# Copy libraries
find . -name "*.so*" -exec cp {} /tmp/glibc-check/usr/lib/aarch64-linux-gnu/ \; 2>/dev/null || true

echo "Rebuilding initramfs..."
cd /tmp/glibc-check
find . -print0 | cpio --null -ov --format=newc 2>/dev/null | gzip -9 > /Users/ryan.maclean/vibecode-webgui/azure/unified-services-pg14.cpio.gz

echo "✅ Option 2 complete"
ls -lh /Users/ryan.maclean/vibecode-webgui/azure/unified-services-pg14.cpio.gz


