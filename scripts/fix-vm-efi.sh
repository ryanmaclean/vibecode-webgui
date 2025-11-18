#!/bin/bash
# Fix EFI NVRAM for existing VMs
# Recreates EFI variable stores using proper Apple Virtualization.framework API

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "=========================================="
echo "Fix EFI NVRAM for Existing VMs"
echo "=========================================="
echo ""

# Check if VM images directory exists
if [ ! -d "$PROJECT_ROOT/dist/vm-images" ]; then
    echo "❌ VM images directory not found: $PROJECT_ROOT/dist/vm-images"
    echo "   Run rebuild-all-vms-with-services.sh first to create VMs"
    exit 1
fi

# Find all EFI NVRAM files
echo "🔍 Scanning for EFI NVRAM files..."
NVRAM_FILES=$(find "$PROJECT_ROOT/dist/vm-images" -name "*-efi.nvram" 2>/dev/null)

if [ -z "$NVRAM_FILES" ]; then
    echo "❌ No EFI NVRAM files found"
    exit 1
fi

echo "Found $(echo "$NVRAM_FILES" | wc -l) EFI NVRAM file(s)"
echo ""

# Process each NVRAM file
for NVRAM_PATH in $NVRAM_FILES; do
    VM_NAME=$(basename "$NVRAM_PATH" | sed 's/-efi.nvram$//')
    echo "Processing: $VM_NAME"
    echo "----------------------------------------"
    
    # Validate current NVRAM
    echo "🔍 Validating current EFI NVRAM..."
    if "$SCRIPT_DIR/init-efi-nvram.sh" --validate "$NVRAM_PATH" 2>&1 | grep -q "✅"; then
        echo "✅ $VM_NAME EFI NVRAM is already valid - skipping"
        echo ""
        continue
    fi
    
    # Backup old NVRAM
    BACKUP_PATH="${NVRAM_PATH}.backup.$(date +%Y%m%d_%H%M%S)"
    echo "💾 Backing up to: $(basename "$BACKUP_PATH")"
    cp "$NVRAM_PATH" "$BACKUP_PATH"
    
    # Recreate NVRAM
    echo "🔧 Recreating EFI variable store..."
    "$SCRIPT_DIR/init-efi-nvram.sh" --force "$NVRAM_PATH"
    
    if [ $? -eq 0 ]; then
        echo "✅ $VM_NAME EFI NVRAM fixed successfully"
    else
        echo "❌ Failed to fix $VM_NAME EFI NVRAM"
        echo "   Backup preserved at: $BACKUP_PATH"
    fi
    
    echo ""
done

echo "=========================================="
echo "EFI NVRAM Fix Complete"
echo "=========================================="
echo ""
echo "Next steps:"
echo "  1. Launch VibeCode app"
echo "  2. Try starting the VMs"
echo "  3. If VMs still don't boot, check:"
echo "     - Disk images exist and are valid"
echo "     - Disk images have bootable Alpine Linux installed"
echo "     - Console logs for boot errors"
echo ""
