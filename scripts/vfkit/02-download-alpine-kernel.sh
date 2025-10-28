#!/usr/bin/env bash
# Download Alpine Linux ARM64 kernel and initramfs for vfkit
# Uses Alpine virt variant optimized for virtualization

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VM_DIR="${HOME}/.vfkit/vms/vibecode-alpine"
KERNEL_DIR="${VM_DIR}/kernel"

# Alpine version - latest stable
ALPINE_VERSION="3.19"
ALPINE_RELEASE="3.19.1"
ALPINE_ARCH="aarch64"

# Download URLs
ALPINE_BASE_URL="https://dl-cdn.alpinelinux.org/alpine/v${ALPINE_VERSION}/releases/${ALPINE_ARCH}"
ALPINE_ISO="alpine-virt-${ALPINE_RELEASE}-${ALPINE_ARCH}.iso"
ALPINE_ISO_URL="${ALPINE_BASE_URL}/${ALPINE_ISO}"

echo "=== Downloading Alpine Linux ARM64 Kernel ==="
echo ""
echo "Alpine Version: ${ALPINE_RELEASE}"
echo "Architecture: ${ALPINE_ARCH}"
echo "Variant: virt (optimized for virtualization)"
echo ""

# Create kernel directory
mkdir -p "${KERNEL_DIR}"
cd "${KERNEL_DIR}"

# Download Alpine ISO if not exists
if [[ -f "${ALPINE_ISO}" ]]; then
    echo "✅ Alpine ISO already downloaded"
else
    echo "📥 Downloading Alpine ISO (${ALPINE_ISO})..."
    echo "   URL: ${ALPINE_ISO_URL}"
    echo ""

    if curl -L -o "${ALPINE_ISO}" "${ALPINE_ISO_URL}"; then
        ISO_SIZE=$(du -h "${ALPINE_ISO}" | cut -f1)
        echo "✅ Downloaded: ${ALPINE_ISO} (${ISO_SIZE})"
    else
        echo "❌ Failed to download Alpine ISO"
        exit 1
    fi
fi

echo ""

# Extract kernel and initramfs from ISO
echo "📦 Extracting kernel and initramfs from ISO..."

# Check if we have tools to extract ISO
if command -v 7z &> /dev/null; then
    EXTRACTOR="7z"
elif command -v bsdtar &> /dev/null; then
    EXTRACTOR="bsdtar"
else
    echo "❌ No ISO extraction tool found"
    echo "Install 7zip: brew install p7zip"
    echo "Or use built-in: bsdtar (should be pre-installed on macOS)"
    exit 1
fi

echo "Using extractor: ${EXTRACTOR}"
echo ""

# Extract boot directory
if [[ "$EXTRACTOR" == "7z" ]]; then
    7z x -y "${ALPINE_ISO}" boot/ > /dev/null 2>&1 || true

    # Find and copy kernel
    KERNEL_FILE=$(find boot -name "vmlinuz-*" -type f | head -1)
    INITRAMFS_FILE=$(find boot -name "initramfs-*" -type f | head -1)

    if [[ -n "$KERNEL_FILE" ]]; then
        cp "$KERNEL_FILE" vmlinuz
        echo "✅ Extracted kernel: vmlinuz"
        ls -lh vmlinuz
    fi

    if [[ -n "$INITRAMFS_FILE" ]]; then
        cp "$INITRAMFS_FILE" initramfs
        echo "✅ Extracted initramfs: initramfs"
        ls -lh initramfs
    fi

    # Cleanup
    rm -rf boot

elif [[ "$EXTRACTOR" == "bsdtar" ]]; then
    # bsdtar can read ISO directly
    bsdtar -xf "${ALPINE_ISO}" "boot/vmlinuz-virt" "boot/initramfs-virt" 2>/dev/null || \
    bsdtar -xf "${ALPINE_ISO}" "boot/" 2>/dev/null || true

    # Find and copy kernel
    if [[ -f "boot/vmlinuz-virt" ]]; then
        cp boot/vmlinuz-virt vmlinuz
    elif [[ -f "boot/vmlinuz-lts" ]]; then
        cp boot/vmlinuz-lts vmlinuz
    else
        KERNEL_FILE=$(find boot -name "vmlinuz-*" -type f 2>/dev/null | head -1)
        if [[ -n "$KERNEL_FILE" ]]; then
            cp "$KERNEL_FILE" vmlinuz
        fi
    fi

    # Find and copy initramfs
    if [[ -f "boot/initramfs-virt" ]]; then
        cp boot/initramfs-virt initramfs
    elif [[ -f "boot/initramfs-lts" ]]; then
        cp boot/initramfs-lts initramfs
    else
        INITRAMFS_FILE=$(find boot -name "initramfs-*" -type f 2>/dev/null | head -1)
        if [[ -n "$INITRAMFS_FILE" ]]; then
            cp "$INITRAMFS_FILE" initramfs
        fi
    fi

    # Cleanup
    rm -rf boot
fi

echo ""

# Verify extracted files
if [[ ! -f "vmlinuz" ]]; then
    echo "❌ Failed to extract kernel"
    echo "Trying alternative method..."

    # Mount ISO and copy (macOS specific)
    MOUNT_POINT="/tmp/alpine-mount-$$"
    mkdir -p "$MOUNT_POINT"

    if hdiutil attach -mountpoint "$MOUNT_POINT" "${ALPINE_ISO}" &> /dev/null; then
        echo "✅ Mounted ISO at ${MOUNT_POINT}"

        # Copy kernel
        if [[ -f "${MOUNT_POINT}/boot/vmlinuz-virt" ]]; then
            cp "${MOUNT_POINT}/boot/vmlinuz-virt" vmlinuz
            cp "${MOUNT_POINT}/boot/initramfs-virt" initramfs
        fi

        # Unmount
        hdiutil detach "$MOUNT_POINT" &> /dev/null
        rm -rf "$MOUNT_POINT"
    fi
fi

# Final verification
if [[ ! -f "vmlinuz" ]] || [[ ! -f "initramfs" ]]; then
    echo "❌ Failed to extract kernel and initramfs"
    echo ""
    echo "Manual extraction steps:"
    echo "1. Mount the ISO: hdiutil attach ${ALPINE_ISO}"
    echo "2. Copy files: cp /Volumes/ALPINE/boot/vmlinuz-virt vmlinuz"
    echo "3. Copy files: cp /Volumes/ALPINE/boot/initramfs-virt initramfs"
    echo "4. Unmount: hdiutil detach /Volumes/ALPINE"
    exit 1
fi

# Extract uncompressed kernel for vfkit
echo ""
echo "📦 Extracting uncompressed kernel for vfkit..."
echo "   (vfkit requires an uncompressed kernel)"

if command -v python3 &> /dev/null; then
    python3 << 'PYEOF'
with open('vmlinuz', 'rb') as f:
    data = f.read()
offset = data.find(b'\x1f\x8b')
if offset >= 0:
    with open('vmlinuz.gz', 'wb') as f:
        f.write(data[offset:])
PYEOF

    if [[ -f "vmlinuz.gz" ]]; then
        gunzip -c vmlinuz.gz > vmlinux 2>/dev/null || true
        rm -f vmlinuz.gz

        if [[ -f "vmlinux" ]] && [[ -s "vmlinux" ]]; then
            echo "✅ Extracted uncompressed kernel: vmlinux"
        else
            echo "⚠️  Failed to extract vmlinux - will try at launch time"
        fi
    fi
else
    echo "⚠️  python3 not found - will extract vmlinux at launch time"
fi

# Get file sizes
KERNEL_SIZE=$(du -h vmlinuz | cut -f1)
INITRAMFS_SIZE=$(du -h initramfs | cut -f1)
VMLINUX_SIZE=""
if [[ -f "vmlinux" ]]; then
    VMLINUX_SIZE=" (uncompressed: $(du -h vmlinux | cut -f1))"
fi

echo ""
echo "=== Download Complete ==="
echo ""
echo "✅ Kernel: ${KERNEL_DIR}/vmlinuz (${KERNEL_SIZE})${VMLINUX_SIZE}"
echo "✅ Initramfs: ${KERNEL_DIR}/initramfs (${INITRAMFS_SIZE})"
echo "✅ ISO: ${KERNEL_DIR}/${ALPINE_ISO}"
echo ""
echo "Total size: $(du -sh ${KERNEL_DIR} | cut -f1)"
echo ""
echo "Next step:"
echo "  ./scripts/vfkit/03-create-alpine-rootfs.sh"
echo ""
