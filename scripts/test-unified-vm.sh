#!/bin/bash

# Unified VM Test Script
# Validates Unified Services VM build and functionality

set -e

echo "=== Unified Services VM Test ==="

AZURE_DIR="$HOME/vibecode-webgui/azure"
INITRAMFS="$AZURE_DIR/unified-services-restored.cpio.gz"

# Check if initramfs exists
if [ ! -f "$INITRAMFS" ]; then
    echo "ERROR: Unified initramfs not found: $INITRAMFS"
    echo "Run: bash ~/vibecode-webgui/scripts/build-unified-vm.sh"
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

# Check for Valkey
echo ""
echo "Checking Valkey..."
if find usr/local/bin usr/bin -name "valkey-server" 2>/dev/null | grep -q .; then
    echo "✓ Valkey binary found"
    VALKEY_OK=true
else
    echo "✗ Valkey binary missing"
    VALKEY_OK=false
fi

# Check for PostgreSQL
echo ""
echo "Checking PostgreSQL..."
if find usr/local usr/bin -name "postgres" 2>/dev/null | grep -q .; then
    echo "✓ PostgreSQL binary found"
    PG_OK=true
else
    echo "✗ PostgreSQL binary missing"
    PG_OK=false
fi

# Check for required libraries
echo ""
echo "Checking required libraries..."
LIBS_OK=true

for lib in libssl.so libcrypto.so libz.so libsystemd.so; do
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

    has_valkey=false
    has_postgres=false

    if grep -q "valkey" init 2>/dev/null; then
        echo "✓ Init script references Valkey"
        has_valkey=true
    fi

    if grep -q "postgres\|postgresql" init 2>/dev/null; then
        echo "✓ Init script references PostgreSQL"
        has_postgres=true
    fi

    if [ "$has_valkey" = false ] && [ "$has_postgres" = false ]; then
        echo "WARNING: Init script may not start services"
    fi
else
    echo "✗ Init script missing"
    LIBS_OK=false
fi

# Cleanup
cd /
rm -rf "$TEMP_DIR"

echo ""
if [ "$VALKEY_OK" = true ] && [ "$PG_OK" = true ] && [ "$LIBS_OK" = true ]; then
    echo "=== Unified VM: PASS ==="
    exit 0
else
    echo "=== Unified VM: FAIL (missing components) ==="
    exit 1
fi
