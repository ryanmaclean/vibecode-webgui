#!/usr/bin/env bash
# Upgrade to Alpine 3.22 with Linux kernel 6.12 LTS
# Optimized for M1/Apple Silicon with vfkit

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VM_DIR="${HOME}/.vfkit/vms/vibecode-alpine"
KERNEL_DIR="${VM_DIR}/kernel"

# Alpine 3.22 versions
ALPINE_VERSION="3.22"
ALPINE_RELEASE="3.22.2"
ALPINE_ARCH="aarch64"
ALPINE_ISO="alpine-virt-${ALPINE_RELEASE}-${ALPINE_ARCH}.iso"
ALPINE_BASE_URL="https://dl-cdn.alpinelinux.org/alpine/v${ALPINE_VERSION}/releases/${ALPINE_ARCH}"
ALPINE_ISO_URL="${ALPINE_BASE_URL}/${ALPINE_ISO}"

echo "════════════════════════════════════════════════════════"
echo "  Upgrading to Alpine 3.22 with Kernel 6.12 LTS"
echo "════════════════════════════════════════════════════════"
echo ""
echo "Current: Alpine 3.19.1 with Linux 6.6 LTS"
echo "Target:  Alpine ${ALPINE_RELEASE} with Linux 6.12 LTS"
echo ""
echo "Improvements:"
echo "  ✅ Latest kernel (6 months newer)"
echo "  ✅ Security patches"
echo "  ✅ Better ARM64 virtualization"
echo "  ✅ Updated virtio drivers"
echo "  ✅ Performance improvements"
echo ""

# Create backup of current kernel
if [[ -f "${KERNEL_DIR}/vmlinux" ]]; then
    echo "📦 Backing up current kernel..."
    BACKUP_DIR="${KERNEL_DIR}/backup-3.19"
    mkdir -p "${BACKUP_DIR}"
    cp "${KERNEL_DIR}/vmlinuz" "${BACKUP_DIR}/" 2>/dev/null || true
    cp "${KERNEL_DIR}/vmlinux" "${BACKUP_DIR}/" 2>/dev/null || true
    cp "${KERNEL_DIR}/initramfs" "${BACKUP_DIR}/" 2>/dev/null || true
    echo "✅ Backed up to: ${BACKUP_DIR}"
    echo ""
fi

# Create kernel directory
mkdir -p "${KERNEL_DIR}"
cd "${KERNEL_DIR}"

# Download Alpine 3.22 ISO
echo "📥 Downloading Alpine ${ALPINE_RELEASE} ISO..."
echo "   URL: ${ALPINE_ISO_URL}"

if [[ -f "${ALPINE_ISO}" ]]; then
    echo "⚠️  ISO already exists: ${ALPINE_ISO}"
    read -p "Re-download? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Using existing ISO"
    else
        rm -f "${ALPINE_ISO}"
        curl -L -o "${ALPINE_ISO}" "${ALPINE_ISO_URL}"
    fi
else
    curl -L -o "${ALPINE_ISO}" "${ALPINE_ISO_URL}"
fi

ISO_SIZE=$(du -h "${ALPINE_ISO}" | cut -f1)
echo "✅ Downloaded: ${ALPINE_ISO} (${ISO_SIZE})"
echo ""

# Extract kernel and initramfs
echo "📦 Extracting kernel and initramfs from ISO..."

# Detect extraction method
if command -v bsdtar &> /dev/null; then
    EXTRACTOR="bsdtar"
    echo "Using extractor: bsdtar"

    # Extract vmlinuz-virt
    bsdtar -xf "${ALPINE_ISO}" boot/vmlinuz-virt
    mv boot/vmlinuz-virt vmlinuz-3.22

    # Extract initramfs-virt
    bsdtar -xf "${ALPINE_ISO}" boot/initramfs-virt
    mv boot/initramfs-virt initramfs-3.22

    rm -rf boot

elif command -v 7z &> /dev/null; then
    EXTRACTOR="7z"
    echo "Using extractor: 7z"

    7z x "${ALPINE_ISO}" boot/vmlinuz-virt boot/initramfs-virt
    mv boot/vmlinuz-virt vmlinuz-3.22
    mv boot/initramfs-virt initramfs-3.22
    rm -rf boot

else
    echo "❌ No extraction tool found (need bsdtar or 7z)"
    echo "Install: brew install libarchive  # for bsdtar"
    exit 1
fi

echo "✅ Extracted kernel and initramfs"
echo ""

# Extract uncompressed kernel for vfkit
echo "📦 Extracting uncompressed kernel for vfkit..."
echo "   (vfkit requires uncompressed ARM64 kernel)"

if command -v python3 &> /dev/null; then
    python3 << 'PYEOF'
with open('vmlinuz-3.22', 'rb') as f:
    data = f.read()
offset = data.find(b'\x1f\x8b')  # Find gzip magic bytes
if offset >= 0:
    with open('vmlinuz-3.22.gz', 'wb') as f:
        f.write(data[offset:])
    print(f"Found gzip payload at offset {offset}")
else:
    print("ERROR: No gzip payload found")
    exit(1)
PYEOF

    if [[ -f "vmlinuz-3.22.gz" ]]; then
        gunzip -c vmlinuz-3.22.gz > vmlinux-3.22 2>/dev/null || true
        rm -f vmlinuz-3.22.gz

        if [[ -f "vmlinux-3.22" ]] && [[ -s "vmlinux-3.22" ]]; then
            echo "✅ Extracted uncompressed kernel: vmlinux-3.22"
        else
            echo "❌ Failed to extract vmlinux"
            exit 1
        fi
    fi
else
    echo "❌ python3 not found"
    exit 1
fi

# Verify kernel
echo ""
echo "🔍 Verifying kernel..."
KERNEL_TYPE=$(file vmlinux-3.22)
echo "${KERNEL_TYPE}"

if echo "${KERNEL_TYPE}" | grep -q "Linux kernel ARM64 boot executable"; then
    echo "✅ Kernel type verified: ARM64 boot executable"
else
    echo "⚠️  Unexpected kernel type"
fi

echo ""

# Get file sizes
VMLINUZ_SIZE=$(du -h vmlinuz-3.22 | cut -f1)
VMLINUX_SIZE=$(du -h vmlinux-3.22 | cut -f1)
INITRAMFS_SIZE=$(du -h initramfs-3.22 | cut -f1)

# Check kernel version
echo "📊 Kernel Information:"
echo "   Compressed (vmlinuz): ${VMLINUZ_SIZE}"
echo "   Uncompressed (vmlinux): ${VMLINUX_SIZE}"
echo "   Initramfs: ${INITRAMFS_SIZE}"
echo "   Expected: Linux 6.12 LTS"
echo ""

# Replace current kernel
echo "🔄 Replacing current kernel with Alpine 3.22..."

if [[ -f "vmlinux" ]]; then
    mv vmlinux vmlinux-backup-3.19 2>/dev/null || true
fi
if [[ -f "vmlinuz" ]]; then
    mv vmlinuz vmlinuz-backup-3.19 2>/dev/null || true
fi
if [[ -f "initramfs" ]]; then
    mv initramfs initramfs-backup-3.19 2>/dev/null || true
fi

# Link new kernel files
ln -sf vmlinux-3.22 vmlinux
ln -sf vmlinuz-3.22 vmlinuz
ln -sf initramfs-3.22 initramfs

echo "✅ Kernel updated!"
echo ""

# Summary
echo "════════════════════════════════════════════════════════"
echo "  Upgrade Complete!"
echo "════════════════════════════════════════════════════════"
echo ""
echo "New kernel files:"
echo "  ✅ ${KERNEL_DIR}/vmlinux (${VMLINUX_SIZE})"
echo "  ✅ ${KERNEL_DIR}/initramfs (${INITRAMFS_SIZE})"
echo "  ✅ ${KERNEL_DIR}/${ALPINE_ISO}"
echo ""
echo "Backup files (Alpine 3.19):"
if [[ -d "${KERNEL_DIR}/backup-3.19" ]]; then
    echo "  📦 ${KERNEL_DIR}/backup-3.19/"
fi
echo ""
echo "Next steps:"
echo "  1. Rebuild rootfs with Alpine 3.22:"
echo "     ./scripts/vfkit/08-create-node24-rootfs.sh"
echo ""
echo "  2. Launch VM with new kernel:"
echo "     ./scripts/vfkit/09-launch-node24-vm.sh"
echo ""
echo "  3. Verify kernel version in VM:"
echo "     uname -r  # Should show 6.12.x"
echo ""
echo "Rollback (if needed):"
echo "  cd ${KERNEL_DIR}"
echo "  ln -sf vmlinux-backup-3.19 vmlinux"
echo "  ln -sf vmlinuz-backup-3.19 vmlinuz"
echo "  ln -sf initramfs-backup-3.19 initramfs"
echo ""
