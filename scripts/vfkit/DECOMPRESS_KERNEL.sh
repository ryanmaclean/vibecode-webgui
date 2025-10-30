#!/usr/bin/env bash
# Extract uncompressed kernel from vmlinuz for vfkit

set -euo pipefail

KERNEL_DIR="${HOME}/.vfkit/vms/vibecode-alpine/kernel"
VMLINUZ="${KERNEL_DIR}/vmlinuz"
VMLINUX_OUT="${KERNEL_DIR}/vmlinux-uncompressed"

echo "Extracting uncompressed kernel for vfkit..."

if [[ ! -f "$VMLINUZ" ]]; then
    echo "❌ vmlinuz not found: $VMLINUZ"
    exit 1
fi

# Try extraction methods
if command -v extract-vmlinux &>/dev/null; then
    echo "Using extract-vmlinux..."
    extract-vmlinux "$VMLINUZ" > "$VMLINUX_OUT"
elif strings "$VMLINUZ" | grep -q "gzip"; then
    echo "Kernel is gzip compressed, extracting..."
    # Skip to gzip magic bytes and decompress
    GZIP_OFFSET=$(grep -ab -o $'\x1f\x8b\x08' "$VMLINUZ" | head -n 1 | cut -d : -f 1)
    echo "Found gzip at offset: $GZIP_OFFSET"
    dd if="$VMLINUZ" bs=1 skip="$GZIP_OFFSET" 2>/dev/null | gunzip > "$VMLINUX_OUT"
else
    echo "Trying direct gunzip..."
    gunzip -c "$VMLINUZ" > "$VMLINUX_OUT" 2>/dev/null || {
        echo "❌ Cannot extract kernel"
        exit 1
    }
fi

if [[ -f "$VMLINUX_OUT" ]] && [[ -s "$VMLINUX_OUT" ]]; then
    echo "✅ Extracted: $(du -h "$VMLINUX_OUT" | cut -f1)"
    file "$VMLINUX_OUT"
    
    # Copy to all VM directories
    for vm_dir in ~/.vfkit/vms/vibecode-*/; do
        if [[ -d "${vm_dir}kernel" ]]; then
            cp "$VMLINUX_OUT" "${vm_dir}kernel/vmlinux"
            echo "✅ Copied to $(basename $vm_dir)"
        fi
    done
    
    echo ""
    echo "All VMs now have uncompressed kernel"
else
    echo "❌ Extraction failed"
    exit 1
fi

