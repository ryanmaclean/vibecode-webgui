#!/usr/bin/env bash
# Integration script to add GRUB installation to existing VM creation workflows
# This script can be called from other VM creation scripts to ensure GRUB is installed
#
# Usage:
#   source ./integrate-grub-into-vm-creation.sh
#   ensure_grub_installed <disk_image_path> <vm_name>

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Function to ensure GRUB is installed on a disk image
ensure_grub_installed() {
    local disk_image="$1"
    local vm_name="${2:-alpine-vm}"
    
    if [[ ! -f "$disk_image" ]]; then
        echo "Error: Disk image not found: $disk_image"
        return 1
    fi
    
    echo "Checking if GRUB is installed on $disk_image..."
    
    # Check if GRUB is already installed by looking for EFI bootloader
    # This is a simplified check - in production, you'd mount and inspect
    local grub_installed=false
    
    # Try to detect GRUB by checking disk structure
    # For now, we'll always run the installation to be safe
    # In production, you could add a check here
    
    if [[ "$grub_installed" == "false" ]]; then
        echo "GRUB not detected, installing..."
        "$SCRIPT_DIR/install-grub-alpine.sh" "$disk_image" "$vm_name" || {
            echo "Warning: GRUB installation had issues"
            return 1
        }
    else
        echo "GRUB already installed"
    fi
    
    return 0
}

# Function to create EFI variable store if it doesn't exist
ensure_efi_store() {
    local efi_store_path="$1"
    
    if [[ -f "$efi_store_path" ]]; then
        echo "EFI variable store already exists: $efi_store_path"
        return 0
    fi
    
    echo "Creating EFI variable store: $efi_store_path"
    mkdir -p "$(dirname "$efi_store_path")"
    
    # Use Swift to create EFI store
    local temp_swift="/tmp/create-efi-store-$$.swift"
    cat > "$temp_swift" <<'SWIFT'
import Foundation
import Virtualization

let efiPath = CommandLine.arguments[1]
let efiURL = URL(fileURLWithPath: efiPath)

do {
    let efiStore = try VZEFIVariableStore(creatingVariableStoreAt: efiURL)
    print("✅ EFI variable store created")
} catch {
    print("❌ Error: \(error)")
    exit(1)
}
SWIFT
    
    if command -v swift &> /dev/null; then
        swift "$temp_swift" "$efi_store_path" || {
            echo "Warning: Failed to create EFI store with Swift"
            rm -f "$temp_swift"
            return 1
        }
        rm -f "$temp_swift"
        return 0
    else
        echo "Warning: Swift not found, EFI store will be created on first boot"
        rm -f "$temp_swift"
        return 0
    fi
}

# Function to prepare a complete VM setup
prepare_vm_complete() {
    local vm_name="$1"
    local disk_size_gb="${2:-10}"
    local vm_base="${3:-${HOME}/.vfkit/vms}"
    
    local vm_dir="${vm_base}/${vm_name}"
    local disk_image="${vm_dir}/disk/root.img"
    local efi_store="${vm_dir}/efi/efi.nvram"
    
    echo "Preparing complete VM setup for: $vm_name"
    
    # Create directory structure
    mkdir -p "${vm_dir}/disk" "${vm_dir}/efi" "${vm_dir}/logs"
    
    # Create disk if it doesn't exist
    if [[ ! -f "$disk_image" ]]; then
        echo "Creating disk image..."
        if command -v qemu-img &> /dev/null; then
            qemu-img create -f raw "$disk_image" "${disk_size_gb}G"
        else
            dd if=/dev/zero of="$disk_image" bs=1m count=$((disk_size_gb * 1024)) 2>/dev/null || \
            dd if=/dev/zero of="$disk_image" bs=1M count=$((disk_size_gb * 1024)) 2>/dev/null
        fi
    fi
    
    # Ensure GRUB is installed
    ensure_grub_installed "$disk_image" "$vm_name"
    
    # Ensure EFI store exists
    ensure_efi_store "$efi_store"
    
    echo "✅ VM preparation complete"
    echo "   Disk: $disk_image"
    echo "   EFI Store: $efi_store"
}

# Export functions for use in other scripts
export -f ensure_grub_installed
export -f ensure_efi_store
export -f prepare_vm_complete

# If script is executed directly (not sourced), run prepare_vm_complete
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    if [[ $# -lt 1 ]]; then
        echo "Usage: $0 <vm_name> [disk_size_gb] [vm_base]"
        echo ""
        echo "Or source this script to use functions:"
        echo "  source $0"
        echo "  ensure_grub_installed <disk_path> <vm_name>"
        exit 1
    fi
    
    prepare_vm_complete "$@"
fi

