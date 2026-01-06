#!/bin/bash

# Valkey VM Test Script
# Validates Valkey VM build and functionality

set -e

echo "=== Valkey VM Test ==="

AZURE_DIR="$HOME/vibecode-webgui/azure"
INITRAMFS="$AZURE_DIR/valkey-standalone-complete.cpio.gz"

# Check if initramfs exists
if [ ! -f "$INITRAMFS" ]; then
    echo "ERROR: Valkey initramfs not found: $INITRAMFS"
    echo "Run: bash ~/vibecode-webgui/scripts/build-valkey-vm.sh"
    exit 1
fi

echo "✓ Initramfs found"
ls -lh "$INITRAMFS"

# Extract and check contents
echo ""
echo "Checking initramfs contents..."
TEMP_DIR=$(mktemp -d)
cd "$TEMP_DIR"
gunzip -c "$INITRAMFS" | cpio -idm 2>/dev/null

# Check for Valkey binary
if [ -f "usr/local/bin/valkey-server" ] || [ -f "usr/bin/valkey-server" ]; then
    echo "✓ Valkey binary found"
else
    echo "WARNING: Valkey binary not found in expected locations"
fi

# Check for required libraries
echo ""
echo "Checking required libraries..."
LIBS_OK=true

for lib in libsystemd.so libgcrypt.so libssl.so libcrypto.so; do
    if find lib usr/lib -name "$lib*" 2>/dev/null | grep -q .; then
        echo "✓ $lib found"
    else
        echo "✗ $lib missing"
        LIBS_OK=false
    fi
done

# Check init script
if [ -f "init" ]; then
    echo "✓ Init script found"
    if grep -q "valkey" init 2>/dev/null; then
        echo "✓ Init script references Valkey"
    else
        echo "WARNING: Init script may not start Valkey"
    fi
else
    echo "✗ Init script missing"
    LIBS_OK=false
fi

# Cleanup
cd /
rm -rf "$TEMP_DIR"

echo ""
if [ "$LIBS_OK" = true ]; then
    echo "=== Valkey VM: PASS ==="
    exit 0
else
    echo "=== Valkey VM: FAIL (missing components) ==="
    exit 1
fi
