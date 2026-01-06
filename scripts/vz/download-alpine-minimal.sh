#!/usr/bin/env bash
# Download minimal Alpine Linux kernel for ASIF test VM
# Downloads ONLY vmlinuz-virt (~8-10MB) - no ISO needed
# For ultra-low disk space environments (<100MB free)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_DIR="/tmp/asif-test"

# Alpine version - use latest stable
ALPINE_VERSION="3.20"
ALPINE_ARCH="aarch64"

# Direct kernel download URL
KERNEL_BASE_URL="https://dl-cdn.alpinelinux.org/alpine/v${ALPINE_VERSION}/releases/${ALPINE_ARCH}"
KERNEL_FILE="vmlinuz-virt"

echo "=== Downloading Minimal Alpine Kernel ==="
echo ""
echo "Alpine Version: ${ALPINE_VERSION}"
echo "Architecture: ${ALPINE_ARCH}"
echo "Target: ${TEST_DIR}"
echo ""

# Create test directory
mkdir -p "${TEST_DIR}"
cd "${TEST_DIR}"

# Check if kernel already exists
if [[ -f "vmlinuz" ]]; then
    EXISTING_SIZE=$(du -h vmlinuz | cut -f1)
    echo "✅ Kernel already exists: vmlinuz (${EXISTING_SIZE})"
    echo ""
else
    # Download kernel directly from Alpine release
    echo "📥 Downloading Alpine kernel..."
    echo "   Note: Trying direct kernel download (no ISO needed)"
    echo ""

    # Try to get latest release info
    if command -v curl &>/dev/null; then
        echo "🔍 Finding latest Alpine ${ALPINE_VERSION} release..."

        # Get latest release directory listing
        RELEASE_URL="${KERNEL_BASE_URL}/"
        if curl -sL "${RELEASE_URL}" > /tmp/alpine-releases.html; then
            # Parse for latest version
            LATEST=$(grep -o 'alpine-virt-[0-9.]*-aarch64.iso' /tmp/alpine-releases.html | \
                     sed 's/alpine-virt-\(.*\)-aarch64.iso/\1/' | \
                     sort -V | tail -1)

            if [[ -n "$LATEST" ]]; then
                echo "   Latest version: ${LATEST}"
                ALPINE_RELEASE="${LATEST}"
            else
                # Fallback to a known good version
                ALPINE_RELEASE="3.20.3"
                echo "   Using fallback: ${ALPINE_RELEASE}"
            fi
        else
            ALPINE_RELEASE="3.20.3"
            echo "   Using fallback: ${ALPINE_RELEASE}"
        fi

        rm -f /tmp/alpine-releases.html

        # Download ISO (we need it to extract kernel)
        ALPINE_ISO="alpine-virt-${ALPINE_RELEASE}-${ALPINE_ARCH}.iso"
        ALPINE_ISO_URL="${KERNEL_BASE_URL}/${ALPINE_ISO}"

        echo ""
        echo "📥 Downloading: ${ALPINE_ISO}"
        echo "   URL: ${ALPINE_ISO_URL}"
        echo "   This is ~60MB but we'll delete it after extracting kernel"
        echo ""

        # Download ISO
        if curl -L -o "${ALPINE_ISO}" "${ALPINE_ISO_URL}"; then
            ISO_SIZE=$(du -h "${ALPINE_ISO}" | cut -f1)
            echo "✅ Downloaded: ${ALPINE_ISO} (${ISO_SIZE})"
        else
            echo "❌ Failed to download Alpine ISO"
            exit 1
        fi

        # Extract kernel using bsdtar (built into macOS)
        echo ""
        echo "📦 Extracting kernel from ISO..."

        if command -v bsdtar &>/dev/null; then
            # Extract boot directory
            bsdtar -xf "${ALPINE_ISO}" "boot/" 2>/dev/null || true

            # Find and copy kernel
            if [[ -f "boot/vmlinuz-virt" ]]; then
                cp boot/vmlinuz-virt vmlinuz
                echo "✅ Extracted: vmlinuz-virt"
            elif [[ -f "boot/vmlinuz-lts" ]]; then
                cp boot/vmlinuz-lts vmlinuz
                echo "✅ Extracted: vmlinuz-lts"
            else
                KERNEL=$(find boot -name "vmlinuz-*" -type f | head -1)
                if [[ -n "$KERNEL" ]]; then
                    cp "$KERNEL" vmlinuz
                    echo "✅ Extracted: $(basename $KERNEL)"
                fi
            fi

            # Cleanup
            rm -rf boot
        else
            echo "❌ bsdtar not found (should be built into macOS)"
            exit 1
        fi

        # Delete ISO to save space
        echo ""
        echo "🧹 Cleaning up ISO to save space..."
        rm -f "${ALPINE_ISO}"
        echo "✅ Deleted ISO"
    else
        echo "❌ curl not found"
        exit 1
    fi
fi

# Verify kernel exists
if [[ ! -f "vmlinuz" ]]; then
    echo ""
    echo "❌ Failed to download/extract kernel"
    exit 1
fi

KERNEL_SIZE=$(du -h vmlinuz | cut -f1)
echo ""
echo "=== Download Complete ==="
echo ""
echo "✅ Kernel: ${TEST_DIR}/vmlinuz (${KERNEL_SIZE})"
echo ""
echo "Next steps:"
echo "  1. ./scripts/vz/create-minimal-initramfs.sh"
echo "  2. ./scripts/vz/create-asif-disk.sh"
echo "  3. ./scripts/vz/asif-test-vm.swift"
echo ""
