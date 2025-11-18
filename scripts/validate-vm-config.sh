#!/bin/bash
# Validate VM EFI and Disk Configuration
# Checks that VMs are properly configured for UEFI boot

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "=========================================="
echo "VM EFI and Disk Validation"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0

check() {
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ PASS${NC}: $2"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
        return 0
    else
        echo -e "${RED}❌ FAIL${NC}: $2"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
        return 1
    fi
}

warn() {
    echo -e "${YELLOW}⚠️  WARN${NC}: $1"
}

# Check if VM images directory exists
echo "Checking VM Configuration..."
echo "----------------------------------------"

if [ ! -d "$PROJECT_ROOT/dist/vm-images" ]; then
    check 1 "VM images directory exists"
    echo ""
    echo "No VMs found. Run: ./scripts/rebuild-all-vms-with-services.sh"
    exit 1
else
    check 0 "VM images directory exists"
fi

# Expected VMs
EXPECTED_VMS=(
    "vibecode-postgresql"
    "vibecode-valkey"
    "vibecode-nodejs"
    "vibecode-nodejs-codeserver"
)

echo ""
echo "Validating VM Files..."
echo "----------------------------------------"

for VM_NAME in "${EXPECTED_VMS[@]}"; do
    echo ""
    echo "VM: $VM_NAME"
    
    DISK_PATH="$PROJECT_ROOT/dist/vm-images/$VM_NAME.img"
    EFI_PATH="$PROJECT_ROOT/dist/vm-images/$VM_NAME-efi.nvram"
    
    # Check disk exists
    if [ -f "$DISK_PATH" ]; then
        check 0 "Disk image exists"
        
        # Check disk size
        DISK_SIZE=$(stat -f%z "$DISK_PATH" 2>/dev/null || stat -c%s "$DISK_PATH" 2>/dev/null || echo "0")
        DISK_SIZE_MB=$((DISK_SIZE / 1024 / 1024))
        if [ "$DISK_SIZE_MB" -gt 100 ]; then
            check 0 "Disk size is reasonable ($DISK_SIZE_MB MB)"
        else
            check 1 "Disk size is reasonable ($DISK_SIZE_MB MB - too small)"
        fi
    else
        check 1 "Disk image exists"
    fi
    
    # Check EFI exists
    if [ -f "$EFI_PATH" ]; then
        check 0 "EFI NVRAM exists"
        
        # Check EFI size (should be 128KB for VZEFIVariableStore)
        EFI_SIZE=$(stat -f%z "$EFI_PATH" 2>/dev/null || stat -c%s "$EFI_PATH" 2>/dev/null || echo "0")
        EFI_SIZE_KB=$((EFI_SIZE / 1024))
        
        if [ "$EFI_SIZE" -eq 131072 ]; then
            check 0 "EFI NVRAM size is correct (128 KB)"
            
            # Try to validate with tool if on macOS
            if [ -f "$SCRIPT_DIR/init-efi-nvram.sh" ]; then
                if "$SCRIPT_DIR/init-efi-nvram.sh" --validate "$EFI_PATH" 2>&1 | grep -q "✅"; then
                    check 0 "EFI NVRAM is valid (VZEFIVariableStore check)"
                else
                    check 1 "EFI NVRAM is valid (VZEFIVariableStore check)"
                    warn "Run: ./scripts/fix-vm-efi.sh to recreate"
                fi
            else
                warn "Cannot validate EFI (tool not available)"
            fi
        elif [ "$EFI_SIZE" -eq 67108864 ]; then
            check 1 "EFI NVRAM size is correct ($EFI_SIZE_KB KB - likely created with dd)"
            warn "This NVRAM was created with 'dd if=/dev/zero' - invalid for VZ"
            warn "Run: ./scripts/fix-vm-efi.sh to recreate properly"
        else
            check 1 "EFI NVRAM size is correct ($EFI_SIZE_KB KB - unexpected size)"
            warn "Expected 128 KB for valid VZEFIVariableStore"
        fi
    else
        check 1 "EFI NVRAM exists"
        warn "Create with: ./scripts/init-efi-nvram.sh $EFI_PATH"
    fi
    
    # Check for cloud-init ISO (optional but recommended)
    CLOUD_INIT_ISO="$PROJECT_ROOT/tmp/cloud-init/$VM_NAME-seed.iso"
    if [ -f "$CLOUD_INIT_ISO" ]; then
        check 0 "Cloud-init ISO exists (optional)"
    else
        warn "Cloud-init ISO not found (optional, used for first boot only)"
    fi
done

# Summary
echo ""
echo "=========================================="
echo "Validation Summary"
echo "=========================================="
echo "Total Checks: $TOTAL_CHECKS"
echo -e "${GREEN}Passed: $PASSED_CHECKS${NC}"
echo -e "${RED}Failed: $FAILED_CHECKS${NC}"
echo ""

if [ "$FAILED_CHECKS" -eq 0 ]; then
    echo -e "${GREEN}✅ All checks passed!${NC}"
    echo ""
    echo "Your VMs are properly configured for UEFI boot."
    echo ""
    echo "Next steps:"
    echo "  1. Launch VibeCode app: open VibeCodeSwift/.build/debug/VibeCode.app"
    echo "  2. Start VMs from the GUI"
    echo "  3. Check console logs if VMs don't boot"
    exit 0
else
    echo -e "${RED}❌ Some checks failed${NC}"
    echo ""
    echo "Fix suggestions:"
    echo "  - For invalid EFI NVRAM: ./scripts/fix-vm-efi.sh"
    echo "  - For missing VMs: ./scripts/rebuild-all-vms-with-services.sh"
    echo "  - For more details: docs/guides/EFI_BOOT_CONFIGURATION.md"
    exit 1
fi
