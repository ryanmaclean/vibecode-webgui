#!/bin/bash
set -e

echo "=== Initramfs Builder (Linux-native) ==="
echo ""

# Check source directory exists
if [ ! -d /build/source ]; then
    echo "ERROR: /build/source not found"
    echo "Mount with: docker run -v /path/to/initramfs:/build/source"
    exit 1
fi

cd /build/source

echo "Checking initramfs structure..."
ls -la

echo ""
echo "Checking critical files..."
[ -f init ] && echo "✓ init script found" || (echo "✗ init script missing" && exit 1)
[ -f usr/bin/postgres ] && echo "✓ postgres binary found" || (echo "✗ postgres binary missing" && exit 1)
[ -f usr/bin/psql ] && echo "✓ psql binary found" || (echo "✗ psql binary missing" && exit 1)

echo ""
echo "Checking dependencies..."
[ -f usr/lib/aarch64-linux-gnu/libicuuc.so.74 ] && echo "✓ libicuuc.so.74 found" || echo "⚠ libicuuc.so.74 missing"
[ -f usr/lib/aarch64-linux-gnu/libzstd.so.1 ] && echo "✓ libzstd.so.1 found" || echo "⚠ libzstd.so.1 missing"

echo ""
echo "Building initramfs with Linux-native tools..."
find . -print0 | cpio --null -o -H newc | gzip -9 > /build/output/postgresql-standalone-complete.cpio.gz

echo ""
echo "Verifying output..."
ls -lh /build/output/postgresql-standalone-complete.cpio.gz

echo ""
echo "Testing extraction..."
mkdir -p /build/test
cd /build/test
gunzip -c /build/output/postgresql-standalone-complete.cpio.gz | cpio -idm

echo "✓ Extraction successful"
echo "File count: $(find . -type f | wc -l)"
echo "Total size: $(du -sh . | cut -f1)"

echo ""
echo "Checking magic bytes (should be gzip)..."
file /build/output/postgresql-standalone-complete.cpio.gz

echo ""
echo "=== Build Complete ==="
