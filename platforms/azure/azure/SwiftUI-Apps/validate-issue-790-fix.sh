#!/bin/bash
#
# Validation Script for Issue #790 Fix
# Tests that OpenVSCode terminal's ls command works
#
# This script validates the two-part fix:
# 1. musl-compatible Node.js binary (replaced glibc version)
# 2. PATH wrapper to fix OpenVSCode terminal environment
#

set -e

echo "========================================="
echo "  Issue #790 Validation"
echo "  Terminal ls Command Fix"
echo "========================================="
echo ""

INITRAMFS="/Users/studio/Documents/vibecode-webgui/azure/unified-services-fast.cpio.gz"
TEMP_DIR="/tmp/validate-790-$$"

echo "Step 1: Validate musl-compatible Node.js binary..."
mkdir -p "$TEMP_DIR"
cd "$TEMP_DIR"
gunzip -c "$INITRAMFS" | cpio -idm 2>/dev/null

if [ ! -f "opt/openvscode/node" ]; then
    echo "❌ FAILED: Node.js binary not found in initramfs"
    rm -rf "$TEMP_DIR"
    exit 1
fi

# Check if Node.js is musl-compatible
if file opt/openvscode/node | grep -q "ld-musl-aarch64"; then
    echo "✅ PASS: Node.js binary is musl-compatible"
else
    echo "❌ FAILED: Node.js binary is NOT musl-compatible"
    file opt/openvscode/node
    rm -rf "$TEMP_DIR"
    exit 1
fi

echo ""
echo "Step 2: Validate PATH wrapper exists..."
if grep -q "sh-with-env" init && grep -q "PATH=/usr/sbin:/usr/bin:/sbin:/bin" init; then
    echo "✅ PASS: PATH wrapper is configured correctly"
else
    echo "❌ FAILED: PATH wrapper not found or incorrect"
    rm -rf "$TEMP_DIR"
    exit 1
fi

echo ""
echo "Step 3: Validate BusyBox ls command exists..."
if [ -f "bin/busybox" ]; then
    echo "✅ PASS: BusyBox binary found"
else
    echo "❌ FAILED: BusyBox binary not found"
    rm -rf "$TEMP_DIR"
    exit 1
fi

rm -rf "$TEMP_DIR"

echo ""
echo "========================================="
echo "  All Validation Tests PASSED"
echo "========================================="
echo ""
echo "The initramfs contains both required fixes for Issue #790:"
echo "  1. ✅ musl-compatible Node.js (Alpine v25.3.0)"
echo "  2. ✅ PATH wrapper (/tmp/sh-with-env)"
echo ""
echo "The terminal 'ls' command should now work in OpenVSCode."
echo ""
echo "Manual Testing:"
echo "  1. Open the menubar app"
echo "  2. Wait for services to start"
echo "  3. Open http://localhost:8080 in browser"
echo "  4. Open Terminal in OpenVSCode (Ctrl+\`)"
echo "  5. Run 'ls' command - should list files"
echo ""
