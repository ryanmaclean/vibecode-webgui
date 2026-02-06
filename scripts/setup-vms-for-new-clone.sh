#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

# Setup VMs for a fresh clone of the repository
# Other agents can run this to get bootable VMs

# Initialize log aggregation
init_log_aggregation


set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
VM_DIR="$PROJECT_ROOT/dist/vm-images"

echo "=================================="
echo "VM Setup for New Clone"
echo "=================================="
echo ""

# Create directories
mkdir -p "$VM_DIR"

# Check if we have at least one working VM
if [ -f "$VM_DIR/vibecode-ide.img" ] && [ -f "$VM_DIR/vibecode-pgvector.img" ]; then
    echo "Working VMs already present. Using existing images."
    BASE_VM="$VM_DIR/vibecode-ide.img"
    BASE_EFI="$VM_DIR/vibecode-ide-efi.nvram"
elif [ -f "$VM_DIR/vibecode-ide.img" ]; then
    echo "Found ide VM. Using as base."
    BASE_VM="$VM_DIR/vibecode-ide.img"
    BASE_EFI="$VM_DIR/vibecode-ide-efi.nvram"
elif [ -f "$VM_DIR/vibecode-pgvector.img" ]; then
    echo "Found pgvector VM. Using as base."
    BASE_VM="$VM_DIR/vibecode-pgvector.img"
    BASE_EFI="$VM_DIR/vibecode-pgvector-efi.nvram"
else
    echo "ERROR: No working VM images found."
    echo ""
    echo "You need at least one bootable VM image to start."
    echo ""
    echo "Options:"
    echo "1. Download from release (when available)"
    echo "2. Build from scratch (complex - see docs/guides/)"
    echo "3. Get from someone who has working VMs"
    echo ""
    echo "For now, this is a known limitation of v0.9-beta."
    echo "See: docs/BOOTLOADER_FIX_APPLIED.md"
    exit 1
fi

echo ""
echo "Using base VM: $BASE_VM"
echo "Size: $(du -sh "$BASE_VM" | cut -f1)"
echo ""

# Copy to all VMs that need it
VMS_TO_CREATE="postgresql valkey nodejs nodejs-codeserver"

for vm in $VMS_TO_CREATE; do
    if [ -f "$VM_DIR/vibecode-${vm}.img" ]; then
        echo "vibecode-$vm already exists, skipping..."
    else
        echo "Creating vibecode-$vm from base..."
        cp "$BASE_VM" "$VM_DIR/vibecode-${vm}.img"
        cp "$BASE_EFI" "$VM_DIR/vibecode-${vm}-efi.nvram"
        echo "  Created vibecode-${vm}.img"
    fi
done

echo ""
echo "=================================="
echo "VM Setup Complete"
echo "=================================="
echo ""

# Verify all VMs present
EXPECTED_VMS="ide pgvector postgresql valkey nodejs nodejs-codeserver"
MISSING=0

echo "Checking VM images:"
for vm in $EXPECTED_VMS; do
    if [ -f "$VM_DIR/vibecode-${vm}.img" ] && [ -f "$VM_DIR/vibecode-${vm}-efi.nvram" ]; then
        echo "  ✓ vibecode-$vm"
    else
        echo "  ✗ vibecode-$vm (MISSING)"
        MISSING=$((MISSING + 1))
    fi
done

echo ""

if [ $MISSING -eq 0 ]; then
    echo "All 6 VMs ready!"
    echo ""
    echo "Next steps:"
    echo "  1. Launch app: ./scripts/launch-vibecode.sh"
    echo "  2. VMs will auto-discover"
    echo "  3. All should boot now (no bootloader errors)"
    echo ""
    echo "Note: All VMs are currently identical (copies of ide VM)"
    echo "Services need to be installed per VM (see issue templates)"
else
    echo "WARNING: $MISSING VM(s) missing"
    echo "You may need to obtain a working base VM image"
fi

echo ""
echo "For more information:"
echo "  - docs/BOOTLOADER_FIX_APPLIED.md"
echo "  - .github/ISSUE_TEMPLATE/01-bootloader-fix.md"

