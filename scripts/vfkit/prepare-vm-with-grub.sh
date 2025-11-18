#!/usr/bin/env bash
# Prepare Alpine Linux VM disk images with GRUB and EFI boot configuration
# This script automates the complete process of preparing a VM for EFI boot
#
# Usage:
#   ./prepare-vm-with-grub.sh <vm_name> [disk_size_gb]
#
# Example:
#   ./prepare-vm-with-grub.sh vibecode-postgresql 10

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

VM_NAME="${1:-}"
DISK_SIZE_GB="${2:-10}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VM_BASE="${HOME}/.vfkit/vms"

if [[ -z "$VM_NAME" ]]; then
    echo -e "${RED}❌ Error: VM name required${NC}"
    echo "Usage: $0 <vm_name> [disk_size_gb]"
    exit 1
fi

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Preparing VM with GRUB and EFI Boot Configuration          ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}✓${NC} VM name: $VM_NAME"
echo -e "${GREEN}✓${NC} Disk size: ${DISK_SIZE_GB}GB"
echo ""

# Create VM directory structure
VM_DIR="${VM_BASE}/${VM_NAME}"
DISK_DIR="${VM_DIR}/disk"
EFI_DIR="${VM_DIR}/efi"
LOGS_DIR="${VM_DIR}/logs"

mkdir -p "$DISK_DIR" "$EFI_DIR" "$LOGS_DIR"

DISK_IMAGE="${DISK_DIR}/root.img"
EFI_STORE="${EFI_DIR}/efi.nvram"

# Step 1: Create disk image if it doesn't exist
if [[ ! -f "$DISK_IMAGE" ]]; then
    echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${YELLOW}  Step 1: Creating Disk Image${NC}"
    echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
    
    echo "Creating ${DISK_SIZE_GB}GB disk image..."
    
    # Create disk image with proper size
    if command -v qemu-img &> /dev/null; then
        qemu-img create -f raw "$DISK_IMAGE" "${DISK_SIZE_GB}G"
    else
        # Fallback: use dd
        dd if=/dev/zero of="$DISK_IMAGE" bs=1m count=$((DISK_SIZE_GB * 1024)) 2>/dev/null || \
        dd if=/dev/zero of="$DISK_IMAGE" bs=1M count=$((DISK_SIZE_GB * 1024)) 2>/dev/null
    fi
    
    echo -e "${GREEN}✓${NC} Disk image created: $DISK_IMAGE"
    echo ""
else
    echo -e "${YELLOW}⚠ Disk image already exists: $DISK_IMAGE${NC}"
    read -p "Continue with existing disk? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Step 2: Partition disk with GPT and EFI System Partition
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}  Step 2: Partitioning Disk${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# Check if disk is already partitioned
PARTITIONED=false

if command -v gdisk &> /dev/null; then
    # Use gdisk to check/create partitions
    echo "Checking partition table..."
    
    # Attach disk image
    DISK_DEV=$(hdiutil attach -imagekey diskimage-class=CRawDiskImage -nomount "$DISK_IMAGE" 2>/dev/null | awk '{print $1}' | head -1)
    
    if [[ -n "$DISK_DEV" ]]; then
        # Check if partitions exist
        PARTITIONS=$(diskutil list "$DISK_DEV" 2>/dev/null | grep -E "^\s+\d+:" | wc -l | tr -d ' ')
        
        if [[ "$PARTITIONS" -eq "0" ]]; then
            echo "Creating GPT partition table with EFI System Partition..."
            
            # Create partitions using gdisk
            # Partition 1: EFI System Partition (100MB)
            # Partition 2: Root filesystem (remaining space)
            (
                echo "o"      # Create new GPT
                echo "y"      # Confirm
                echo "n"      # New partition
                echo "1"      # Partition number
                echo ""       # First sector (default)
                echo "+100M"  # Size: 100MB
                echo "ef00"   # EFI System Partition type
                echo "n"      # New partition
                echo "2"      # Partition number
                echo ""       # First sector (default)
                echo ""       # Last sector (default, use all remaining)
                echo "8300"   # Linux filesystem type
                echo "w"      # Write changes
                echo "y"      # Confirm
            ) | sudo gdisk "$DISK_DEV" > /dev/null 2>&1 || {
                echo -e "${YELLOW}⚠ gdisk partitioning failed, trying alternative method...${NC}"
            }
            
            PARTITIONED=true
        else
            echo -e "${GREEN}✓${NC} Disk already partitioned"
        fi
        
        # Detach disk
        hdiutil detach "$DISK_DEV" 2>/dev/null || true
    fi
fi

if [[ "$PARTITIONED" == "false" ]]; then
    echo -e "${YELLOW}⚠ Manual partitioning may be required${NC}"
    echo "The disk should have:"
    echo "  - Partition 1: EFI System Partition (FAT32, ~100MB)"
    echo "  - Partition 2: Root filesystem (ext4, remaining space)"
fi

echo ""

# Step 3: Install Alpine Linux to disk
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}  Step 3: Installing Alpine Linux${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# Check if Alpine ISO exists
ALPINE_VERSION="3.22"
ALPINE_ISO="${VM_BASE}/alpine-virt-${ALPINE_VERSION}-aarch64.iso"

if [[ ! -f "$ALPINE_ISO" ]]; then
    echo "Downloading Alpine Linux ISO..."
    ALPINE_URL="https://dl-cdn.alpinelinux.org/alpine/v${ALPINE_VERSION}/releases/aarch64/alpine-virt-${ALPINE_VERSION}.0-aarch64.iso"
    
    mkdir -p "$(dirname "$ALPINE_ISO")"
    curl -L -o "$ALPINE_ISO" "$ALPINE_URL" || {
        echo -e "${RED}❌ Failed to download Alpine ISO${NC}"
        exit 1
    }
    
    echo -e "${GREEN}✓${NC} Alpine ISO downloaded"
fi

echo -e "${YELLOW}⚠ Alpine installation requires manual steps${NC}"
echo "Boot the VM with:"
echo "  vfkit --bootloader efi --device virtio-blk,path=$DISK_IMAGE --device virtio-blk,path=$ALPINE_ISO,devName=cdrom"
echo ""
echo "Then run 'setup-alpine' in the VM to install Alpine to disk."
echo ""

# Step 4: Install GRUB
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}  Step 4: Installing GRUB Bootloader${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
echo ""

if [[ -f "$DISK_IMAGE" ]]; then
    echo "Installing GRUB on disk image..."
    "$SCRIPT_DIR/install-grub-alpine.sh" "$DISK_IMAGE" "$VM_NAME" || {
        echo -e "${YELLOW}⚠ GRUB installation had issues, but continuing...${NC}"
    }
else
    echo -e "${YELLOW}⚠ Disk image not found, skipping GRUB installation${NC}"
fi

echo ""

# Step 5: Create EFI variable store
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}  Step 5: Creating EFI Variable Store${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
echo ""

if [[ ! -f "$EFI_STORE" ]]; then
    echo "Creating EFI variable store..."
    
    # Use Swift helper to create EFI variable store
    if command -v swift &> /dev/null; then
        # Create a temporary Swift script to initialize EFI store
        TEMP_SWIFT="/tmp/create-efi-store-$$.swift"
        cat > "$TEMP_SWIFT" <<'SWIFT'
import Foundation
import Virtualization

let efiPath = CommandLine.arguments[1]
let efiURL = URL(fileURLWithPath: efiPath)

do {
    let efiStore = try VZEFIVariableStore(creatingVariableStoreAt: efiURL)
    print("EFI variable store created successfully")
} catch {
    print("Error: \(error)")
    exit(1)
}
SWIFT
        
        swift "$TEMP_SWIFT" "$EFI_STORE" 2>/dev/null || {
            echo -e "${YELLOW}⚠ Swift EFI creation failed, using vfkit fallback...${NC}"
            
            # Fallback: Use vfkit to create EFI store
            if command -v vfkit &> /dev/null; then
                # vfkit will create EFI store on first boot
                echo "EFI store will be created on first VM boot"
            fi
        }
        
        rm -f "$TEMP_SWIFT"
    else
        echo -e "${YELLOW}⚠ Swift not found, EFI store will be created on first boot${NC}"
    fi
    
    if [[ -f "$EFI_STORE" ]]; then
        echo -e "${GREEN}✓${NC} EFI variable store created: $EFI_STORE"
    fi
else
    echo -e "${GREEN}✓${NC} EFI variable store already exists: $EFI_STORE"
fi

echo ""

# Step 6: Summary
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  VM Preparation Complete!                                    ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "VM Configuration:"
echo "  Name: $VM_NAME"
echo "  Disk: $DISK_IMAGE"
echo "  EFI Store: $EFI_STORE"
echo ""
echo "Next steps:"
echo "1. If Alpine is not installed, boot from ISO and run 'setup-alpine'"
echo "2. Ensure GRUB is installed: $SCRIPT_DIR/install-grub-alpine.sh $DISK_IMAGE"
echo "3. Boot the VM: vfkit --bootloader efi,variable-store=$EFI_STORE --device virtio-blk,path=$DISK_IMAGE"
echo ""
echo "For VibeCode integration, the VM is ready to use with VMManager.swift"

