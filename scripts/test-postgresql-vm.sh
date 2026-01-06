#!/bin/bash

# PostgreSQL VM Test Script
# Validates PostgreSQL VM build and functionality

set -e

echo "=== PostgreSQL VM Test ==="

AZURE_DIR="$HOME/vibecode-webgui/azure"
INITRAMFS="$AZURE_DIR/postgresql-standalone-complete.cpio.gz"

# Check if initramfs exists
if [ ! -f "$INITRAMFS" ]; then
    echo "ERROR: PostgreSQL initramfs not found: $INITRAMFS"
    echo "Run: bash ~/vibecode-webgui/scripts/rebuild-postgresql-docker.sh"
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

# Check for PostgreSQL binaries
echo ""
echo "Checking PostgreSQL binaries..."
BINS_OK=true

for bin in postgres psql initdb pg_ctl; do
    if find usr/local usr/bin -name "$bin" 2>/dev/null | grep -q .; then
        echo "✓ $bin found"
    else
        echo "✗ $bin missing"
        BINS_OK=false
    fi
done

# Check for required libraries
echo ""
echo "Checking required libraries..."

for lib in libpq.so libssl.so libcrypto.so libz.so; do
    if find lib usr/lib -name "$lib*" 2>/dev/null | grep -q .; then
        echo "✓ $lib found"
    else
        echo "WARNING: $lib missing (may be statically linked)"
    fi
done

# Check init script
if [ -f "init" ]; then
    echo "✓ Init script found"
    if grep -q "postgres\|postgresql" init 2>/dev/null; then
        echo "✓ Init script references PostgreSQL"
    else
        echo "WARNING: Init script may not start PostgreSQL"
    fi
else
    echo "✗ Init script missing"
    BINS_OK=false
fi

# Check data directory setup
if [ -d "var/lib/postgresql" ] || [ -d "var/lib/postgres" ] || [ -d "data/postgresql" ]; then
    echo "✓ PostgreSQL data directory structure found"
else
    echo "WARNING: PostgreSQL data directory not found"
fi

# Cleanup
cd /
rm -rf "$TEMP_DIR"

echo ""
if [ "$BINS_OK" = true ]; then
    echo "=== PostgreSQL VM: PASS ==="
    exit 0
else
    echo "=== PostgreSQL VM: FAIL (missing components) ==="
    exit 1
fi
