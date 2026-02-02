#!/bin/bash
set -e

echo "=== Optimizing existing bun-openvscode.cpio.gz ==="
echo "Current size:"
du -h bun-openvscode.cpio.gz

# Create temp directory
WORK_DIR=$(mktemp -d)
echo "Working in: $WORK_DIR"

# Extract existing initramfs
cd "$WORK_DIR"
gunzip -c ~/vibecode-webgui/azure/bun-openvscode.cpio.gz | cpio -idm 2>/dev/null

echo "Extracted size:"
du -sh .

# Strip all binaries
echo "Stripping binaries..."
find . -type f -executable -exec file {} \; | \
  grep -E 'ELF.*executable|ELF.*shared object' | \
  cut -d: -f1 | \
  while read f; do
    strip --strip-all "$f" 2>/dev/null || true
  done

# Remove unnecessary files
echo "Removing unnecessary files..."
rm -rf \
  ./*.md \
  ./usr/share/man \
  ./usr/share/doc \
  ./usr/share/info \
  ./var/cache \
  2>/dev/null || true

echo "Optimized size:"
du -sh .

# Repack with xz compression
echo "Repacking with xz compression..."
find . | cpio -o -H newc | xz -9 -T0 > ~/vibecode-webgui/azure/bun-openvscode-optimized.cpio.xz

cd ~/vibecode-webgui/azure
echo "=== Results ==="
echo "Original:"
du -h bun-openvscode.cpio.gz
echo "Optimized:"
du -h bun-openvscode-optimized.cpio.xz

# Cleanup
rm -rf "$WORK_DIR"

echo "Done! Optimized initramfs: bun-openvscode-optimized.cpio.xz"
