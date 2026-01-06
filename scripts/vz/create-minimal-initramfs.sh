#!/usr/bin/env bash
# Create ultra-minimal initramfs for ASIF test VM
# Size target: <5MB
# Contains: busybox + minimal init script

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_DIR="/tmp/asif-test"
INITRAMFS_DIR="${TEST_DIR}/initramfs-build"

echo "=== Creating Minimal Initramfs ==="
echo ""
echo "Target: ${TEST_DIR}/initramfs"
echo ""

# Create initramfs directory structure
mkdir -p "${INITRAMFS_DIR}"
cd "${INITRAMFS_DIR}"

# Check if initramfs already exists
if [[ -f "${TEST_DIR}/initramfs" ]]; then
    EXISTING_SIZE=$(du -h "${TEST_DIR}/initramfs" | cut -f1)
    echo "✅ Initramfs already exists: ${TEST_DIR}/initramfs (${EXISTING_SIZE})"
    echo ""
    exit 0
fi

echo "📦 Building initramfs structure..."

# Create directory structure
mkdir -p bin sbin etc proc sys dev tmp run

# Create init script
cat > init << 'EOINIT'
#!/bin/sh
# Minimal init script for test VM

# Mount essential filesystems
mount -t proc proc /proc
mount -t sysfs sysfs /sys
mount -t devtmpfs devtmpfs /dev
mount -t tmpfs tmpfs /tmp
mount -t tmpfs tmpfs /run

# Print boot message
echo ""
echo "==================================="
echo "  ASIF Test VM - Boot Successful"
echo "==================================="
echo ""
echo "Kernel: $(uname -r)"
echo "System: $(uname -a)"
echo ""

# Test disk device
if [ -e /dev/vda ]; then
    echo "✅ Disk device detected: /dev/vda"
    echo "   Size: $(blockdev --getsize64 /dev/vda 2>/dev/null || echo 'unknown')"
else
    echo "⚠️  Disk device not found"
fi

echo ""
echo "VM boot complete. Running for 5 seconds..."
echo ""

# Keep running for test duration
sleep 5

echo "Shutting down..."
poweroff -f
EOINIT

chmod +x init

# Try to get busybox binary
echo ""
echo "📥 Getting busybox..."

# Check if we can get busybox from Alpine
BUSYBOX_URL="https://dl-cdn.alpinelinux.org/alpine/v3.20/main/aarch64/busybox-1.36.1-r29.apk"

if command -v curl &>/dev/null; then
    # Download busybox APK
    if curl -sL "${BUSYBOX_URL}" -o busybox.apk; then
        echo "✅ Downloaded busybox.apk"

        # Extract busybox binary (APK is just a tar.gz)
        if command -v tar &>/dev/null; then
            tar -xzf busybox.apk 2>/dev/null || true

            # Find busybox binary
            if [[ -f "bin/busybox" ]]; then
                cp bin/busybox ./busybox-bin
                chmod +x ./busybox-bin
                echo "✅ Extracted busybox"
            elif [[ -f "sbin/busybox" ]]; then
                cp sbin/busybox ./busybox-bin
                chmod +x ./busybox-bin
                echo "✅ Extracted busybox"
            fi
        fi

        # Cleanup
        rm -f busybox.apk
        rm -rf bin sbin usr lib etc 2>/dev/null || true
        mkdir -p bin
    fi
fi

# If we couldn't get busybox, create a warning
if [[ ! -f "busybox-bin" ]]; then
    echo "⚠️  Could not download busybox"
    echo "   Creating minimal shell-only initramfs"

    # Create minimal shell scripts as replacements
    cat > bin/sh << 'EOSH'
#!/bin/sh
echo "Minimal shell stub"
EOSH
    chmod +x bin/sh

    cat > bin/mount << 'EOMOUNT'
#!/bin/sh
# Stub mount command
EOMOUNT
    chmod +x bin/mount

    cat > bin/poweroff << 'EOPOWEROFF'
#!/bin/sh
# Stub poweroff
EOPOWEROFF
    chmod +x bin/poweroff
else
    # Install busybox and create symlinks
    mv busybox-bin bin/busybox

    # Create essential symlinks
    cd bin
    for cmd in sh mount umount poweroff reboot sleep echo cat ls; do
        ln -sf busybox "$cmd"
    done
    cd ..

    echo "✅ Installed busybox with symlinks"
fi

# Create device nodes (if we can't use devtmpfs)
mkdir -p dev
if command -v mknod &>/dev/null && [[ $(id -u) -eq 0 ]]; then
    mknod dev/console c 5 1
    mknod dev/null c 1 3
    mknod dev/zero c 1 5
    echo "✅ Created device nodes"
else
    echo "⚠️  Skipping device nodes (will use devtmpfs)"
fi

# Create the initramfs archive
echo ""
echo "📦 Creating initramfs archive..."

find . | cpio -o -H newc 2>/dev/null | gzip -9 > "${TEST_DIR}/initramfs"

# Check size
INITRAMFS_SIZE=$(du -h "${TEST_DIR}/initramfs" | cut -f1)

echo ""
echo "=== Initramfs Complete ==="
echo ""
echo "✅ Initramfs: ${TEST_DIR}/initramfs (${INITRAMFS_SIZE})"
echo ""

# Cleanup build directory
cd "${TEST_DIR}"
rm -rf "${INITRAMFS_DIR}"

echo "Next steps:"
echo "  1. ./scripts/vz/create-asif-disk.sh"
echo "  2. ./scripts/vz/asif-test-vm.swift"
echo ""
