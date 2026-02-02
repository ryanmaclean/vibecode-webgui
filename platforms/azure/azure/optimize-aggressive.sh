#!/bin/bash
set -e

echo "=== Aggressive optimization of bun-openvscode.cpio.gz ==="
du -h ~/vibecode-webgui/azure/bun-openvscode.cpio.gz

# Create temp directory
WORK_DIR=$(mktemp -d)
echo "Working in: $WORK_DIR"

# Extract existing initramfs
cd "$WORK_DIR"
gunzip -c ~/vibecode-webgui/azure/bun-openvscode.cpio.gz | cpio -idm 2>/dev/null

echo "Extracted size: $(du -sh . | cut -f1)"

# Remove unnecessary files for significant size reduction
echo "Removing unnecessary files..."

# Remove source maps (not needed for runtime)
find ./opt/openvscode -name "*.map" -delete 2>/dev/null || true

# Remove ThirdPartyNotices
find ./opt/openvscode -name "ThirdPartyNotices.txt" -delete 2>/dev/null || true
find ./opt/openvscode -name "ThirdPartyNotices*" -delete 2>/dev/null || true

# Remove TypeScript definition files (not needed at runtime)
find ./opt/openvscode -name "*.d.ts" -delete 2>/dev/null || true

# Remove markdown files
find ./opt/openvscode -name "*.md" -delete 2>/dev/null || true

# Remove documentation
rm -rf \
  ./opt/openvscode/extensions/*/out/test \
  ./opt/openvscode/extensions/*/test \
  ./opt/openvscode/extensions/*/src \
  2>/dev/null || true

# Strip all binaries
echo "Stripping binaries..."
find . -type f -executable -exec file {} \; 2>/dev/null | \
  grep -E 'ELF.*executable|ELF.*shared object' | \
  cut -d: -f1 | \
  while read f; do
    strip --strip-all "$f" 2>/dev/null || true
  done

echo "Optimized size: $(du -sh . | cut -f1)"

# Repack with gzip (best compatibility)
echo "Repacking with gzip..."
find . | cpio -o -H newc | gzip -9 > ~/vibecode-webgui/azure/bun-openvscode-slim.cpio.gz

cd ~/vibecode-webgui/azure
echo ""
echo "=== Results ==="
echo "Original:  $(du -h bun-openvscode.cpio.gz | cut -f1)"
echo "Optimized: $(du -h bun-openvscode-slim.cpio.gz | cut -f1)"

# Cleanup
rm -rf "$WORK_DIR"

echo ""
echo "Done! Test with:"
echo "vfkit --cpus 2 --memory 1024 --bootloader linux,kernel=\$HOME/.vfkit/vms/vibecode-alpine/kernel/vmlinux-raw,initrd=bun-openvscode-slim.cpio.gz,cmdline=\"console=hvc0\" --device virtio-serial,logFilePath=/tmp/slim-test.log --device virtio-net,nat,mac=72:20:43:d4:38:63"
