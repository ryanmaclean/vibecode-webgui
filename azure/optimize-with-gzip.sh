#!/bin/bash
set -e

echo "=== Creating gzip-compressed optimized initramfs ==="

# Create temp directory
WORK_DIR=$(mktemp -d)
echo "Working in: $WORK_DIR"

# Extract existing initramfs
cd "$WORK_DIR"
echo "Extracting original..."
gunzip -c ~/vibecode-webgui/azure/bun-openvscode.cpio.gz | cpio -idm 2>/dev/null

echo "Original extracted size:"
du -sh .

# Verify init exists
if [ -f ./init ]; then
    echo "✓ Init script found"
    ls -lh ./init
else
    echo "✗ WARNING: No init script found!"
fi

# Strip all ELF binaries
echo "Stripping binaries..."
find . -type f | while read f; do
    if file "$f" 2>/dev/null | grep -qE 'ELF.*executable|ELF.*shared object'; then
        strip --strip-all "$f" 2>/dev/null || strip "$f" 2>/dev/null || true
    fi
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

# Repack with gzip compression
echo "Repacking with gzip compression..."
find . | cpio -o -H newc 2>/dev/null | gzip -9 > ~/vibecode-webgui/azure/bun-openvscode-optimized.cpio.gz

cd ~/vibecode-webgui/azure
echo ""
echo "=== Results ==="
echo "Original:  $(du -h bun-openvscode.cpio.gz | cut -f1)"
echo "Optimized: $(du -h bun-openvscode-optimized.cpio.gz | cut -f1)"

# Cleanup
rm -rf "$WORK_DIR"

echo ""
echo "✓ Done! Optimized initramfs: bun-openvscode-optimized.cpio.gz"
