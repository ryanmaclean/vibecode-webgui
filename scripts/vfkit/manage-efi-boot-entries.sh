#!/usr/bin/env bash
# Manage EFI boot entries for Virtualization.framework VMs
# Inspired by Tart and UTM's EFI boot management
#
# Usage:
#   ./manage-efi-boot-entries.sh create <vm_name> <disk_path> <efi_store_path>
#   ./manage-efi-boot-entries.sh list <efi_store_path>
#   ./manage-efi-boot-entries.sh discover <disk_path> <efi_store_path>

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ACTION="${1:-}"
VM_NAME="${2:-}"
DISK_PATH="${3:-}"
EFI_STORE_PATH="${4:-}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

show_usage() {
    cat <<EOF
Manage EFI Boot Entries for Virtualization.framework VMs

Usage:
    $0 create <vm_name> <disk_path> <efi_store_path>
        Create EFI boot entry for a VM
        
    $0 discover <disk_path> <efi_store_path>
        Boot VM once to let EFI firmware discover boot entries
        
    $0 list <efi_store_path>
        List EFI boot entries (requires EFI variable inspection)

Examples:
    $0 create postgresql ~/.vfkit/vms/vibecode-postgresql/disk/root.img ~/.vfkit/vms/vibecode-postgresql/efi/efi.nvram
    $0 discover ~/.vfkit/vms/vibecode-postgresql/disk/root.img ~/.vfkit/vms/vibecode-postgresql/efi/efi.nvram
EOF
}

create_boot_entry() {
    if [[ -z "$VM_NAME" ]] || [[ -z "$DISK_PATH" ]] || [[ -z "$EFI_STORE_PATH" ]]; then
        echo -e "${RED}❌ Error: Missing required arguments${NC}"
        show_usage
        exit 1
    fi
    
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║  Creating EFI Boot Entry                                      ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${GREEN}✓${NC} VM name: $VM_NAME"
    echo -e "${GREEN}✓${NC} Disk: $DISK_PATH"
    echo -e "${GREEN}✓${NC} EFI store: $EFI_STORE_PATH"
    echo ""
    
    # Verify disk exists
    if [[ ! -f "$DISK_PATH" ]]; then
        echo -e "${RED}❌ Error: Disk image not found: $DISK_PATH${NC}"
        exit 1
    fi
    
    # Create EFI store directory if needed
    mkdir -p "$(dirname "$EFI_STORE_PATH")"
    
    # Use Swift helper to create boot entry
    SWIFT_HELPER="$PROJECT_DIR/VibeCodeSwift/Sources/EFIBootManager/create-boot-entry.swift"
    
    # Create temporary Swift script if helper doesn't exist
    if [[ ! -f "$SWIFT_HELPER" ]]; then
        TEMP_SWIFT="/tmp/create-boot-entry-$$.swift"
        cat > "$TEMP_SWIFT" <<'SWIFT'
import Foundation
import Virtualization

let args = CommandLine.arguments
guard args.count >= 4 else {
    print("Usage: create-boot-entry <disk_path> <efi_store_path> <label>")
    exit(1)
}

let diskPath = args[1]
let efiStorePath = args[2]
let label = args[3]

let diskURL = URL(fileURLWithPath: diskPath)
let efiStoreURL = URL(fileURLWithPath: efiStorePath)

do {
    // Create or load EFI variable store
    let efiStore: VZEFIVariableStore
    if FileManager.default.fileExists(atPath: efiStorePath) {
        efiStore = try VZEFIVariableStore(url: efiStoreURL)
    } else {
        efiStore = try VZEFIVariableStore(creatingVariableStoreAt: efiStoreURL)
    }
    
    print("✅ EFI variable store ready")
    print("✅ Boot entry will be created on first VM boot")
    print("")
    print("Next: Boot the VM once to let EFI firmware discover the bootloader")
    
} catch {
    print("❌ Error: \(error)")
    exit(1)
}
SWIFT
        
        swift "$TEMP_SWIFT" "$DISK_PATH" "$EFI_STORE_PATH" "$VM_NAME" || {
            echo -e "${YELLOW}⚠ Swift helper failed, using vfkit discovery method...${NC}"
            discover_boot_entries
        }
        
        rm -f "$TEMP_SWIFT"
    else
        swift "$SWIFT_HELPER" "$DISK_PATH" "$EFI_STORE_PATH" "$VM_NAME" || {
            discover_boot_entries
        }
    fi
    
    echo ""
    echo -e "${GREEN}✓${NC} Boot entry preparation complete"
    echo ""
    echo "Note: The actual EFI boot entry will be created when the VM boots"
    echo "      for the first time and EFI firmware discovers the bootloader."
}

discover_boot_entries() {
    if [[ -z "$DISK_PATH" ]] || [[ -z "$EFI_STORE_PATH" ]]; then
        echo -e "${RED}❌ Error: Missing required arguments${NC}"
        show_usage
        exit 1
    fi
    
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║  Discovering EFI Boot Entries                               ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${GREEN}✓${NC} Disk: $DISK_PATH"
    echo -e "${GREEN}✓${NC} EFI store: $EFI_STORE_PATH"
    echo ""
    
    if [[ ! -f "$DISK_PATH" ]]; then
        echo -e "${RED}❌ Error: Disk image not found: $DISK_PATH${NC}"
        exit 1
    fi
    
    # Check if vfkit is available
    if ! command -v vfkit &> /dev/null; then
        echo -e "${RED}❌ Error: vfkit not found${NC}"
        echo "Install with: brew install vfkit"
        exit 1
    fi
    
    echo "Booting VM to let EFI firmware discover boot entries..."
    echo "This will start the VM, wait for EFI discovery, then stop it."
    echo ""
    
    # Create EFI store if it doesn't exist
    if [[ ! -f "$EFI_STORE_PATH" ]]; then
        echo "Creating EFI variable store..."
        mkdir -p "$(dirname "$EFI_STORE_PATH")"
        # vfkit will create it, but we can pre-create with Swift
        TEMP_SWIFT="/tmp/create-efi-$$.swift"
        cat > "$TEMP_SWIFT" <<'SWIFT'
import Foundation
import Virtualization
let efiURL = URL(fileURLWithPath: CommandLine.arguments[1])
let _ = try VZEFIVariableStore(creatingVariableStoreAt: efiURL)
SWIFT
        swift "$TEMP_SWIFT" "$EFI_STORE_PATH" 2>/dev/null || true
        rm -f "$TEMP_SWIFT"
    fi
    
    # Boot VM with vfkit to discover boot entries
    echo "Starting VM for boot discovery..."
    vfkit \
        --cpus 2 \
        --memory 2048 \
        --bootloader efi,variable-store="$EFI_STORE_PATH" \
        --device virtio-blk,path="$DISK_PATH" \
        --device virtio-net,nat \
        --device virtio-serial,logFilePath=/tmp/vfkit-boot-discovery.log \
        --device virtio-rng &
    
    VFKIT_PID=$!
    
    echo "VM started (PID: $VFKIT_PID)"
    echo "Waiting 30 seconds for EFI boot discovery..."
    echo "Check logs at: /tmp/vfkit-boot-discovery.log"
    
    sleep 30
    
    # Stop VM
    echo "Stopping VM..."
    kill $VFKIT_PID 2>/dev/null || true
    wait $VFKIT_PID 2>/dev/null || true
    
    echo ""
    echo -e "${GREEN}✓${NC} Boot discovery complete"
    echo ""
    echo "The EFI firmware should have discovered and registered boot entries."
    echo "You can now boot the VM normally."
}

list_boot_entries() {
    if [[ -z "$EFI_STORE_PATH" ]]; then
        echo -e "${RED}❌ Error: EFI store path required${NC}"
        show_usage
        exit 1
    fi
    
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║  Listing EFI Boot Entries                                     ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    if [[ ! -f "$EFI_STORE_PATH" ]]; then
        echo -e "${YELLOW}⚠ EFI variable store not found: $EFI_STORE_PATH${NC}"
        echo "Boot entries are stored in the EFI variable store."
        echo "Virtualization.framework doesn't expose a direct API to read them."
        echo ""
        echo "To verify boot entries, boot the VM and check the EFI boot menu."
        exit 0
    fi
    
    echo -e "${GREEN}✓${NC} EFI store: $EFI_STORE_PATH"
    echo ""
    echo "Note: Virtualization.framework doesn't provide a direct API to read"
    echo "      EFI boot entries. Boot entries are managed by the EFI firmware"
    echo "      and are discovered automatically when the VM boots."
    echo ""
    echo "To verify boot entries are working:"
    echo "1. Boot the VM: vfkit --bootloader efi,variable-store=$EFI_STORE_PATH --device virtio-blk,path=<disk>"
    echo "2. Check the EFI boot menu during boot"
    echo "3. Verify the bootloader is discovered and listed"
}

# Main command dispatcher
case "${ACTION}" in
    create)
        create_boot_entry
        ;;
    discover)
        discover_boot_entries
        ;;
    list)
        list_boot_entries
        ;;
    *)
        show_usage
        exit 1
        ;;
esac

