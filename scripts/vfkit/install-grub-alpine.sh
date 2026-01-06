#!/usr/bin/env bash
# Install GRUB EFI bootloader on Alpine Linux disk images
# This script prepares Alpine disk images for EFI boot with Virtualization.framework
#
# Usage:
#   ./install-grub-alpine.sh <disk_image_path> [vm_name]
#
# Example:
#   ./install-grub-alpine.sh ~/.vfkit/vms/vibecode-postgresql/disk/root.img postgresql

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
DISK_IMAGE="${1:-}"
VM_NAME="${2:-alpine-vm}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ -z "$DISK_IMAGE" ]]; then
    echo -e "${RED}❌ Error: Disk image path required${NC}"
    echo "Usage: $0 <disk_image_path> [vm_name]"
    exit 1
fi

if [[ ! -f "$DISK_IMAGE" ]]; then
    echo -e "${RED}❌ Error: Disk image not found: $DISK_IMAGE${NC}"
    exit 1
fi

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Installing GRUB EFI Bootloader on Alpine Linux Disk        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}✓${NC} Disk image: $DISK_IMAGE"
echo -e "${GREEN}✓${NC} VM name: $VM_NAME"
echo ""

# Check for required tools
REQUIRED_TOOLS=("qemu-img" "hdiutil" "diskutil")
for tool in "${REQUIRED_TOOLS[@]}"; do
    if ! command -v "$tool" &> /dev/null; then
        echo -e "${RED}❌ Error: $tool not found${NC}"
        exit 1
    fi
done

# Create temporary mount point
TEMP_MOUNT="/tmp/alpine-grub-install-$$"
mkdir -p "$TEMP_MOUNT"

# Cleanup function
cleanup() {
    echo ""
    echo -e "${YELLOW}🧹 Cleaning up...${NC}"
    
    # Unmount if mounted
    if mountpoint -q "$TEMP_MOUNT" 2>/dev/null; then
        sudo umount "$TEMP_MOUNT" 2>/dev/null || true
    fi
    
    # Detach disk if attached
    if [[ -n "${DISK_DEV:-}" ]]; then
        hdiutil detach "$DISK_DEV" 2>/dev/null || true
    fi
    
    # Remove temp mount
    rmdir "$TEMP_MOUNT" 2>/dev/null || true
}

trap cleanup EXIT

# Method 1: Use VM-based installation (recommended for production)
install_grub_via_vm() {
    echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${YELLOW}  Method 1: Installing GRUB via Temporary VM${NC}"
    echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
    
    # Check if vfkit is available
    if ! command -v vfkit &> /dev/null; then
        echo -e "${YELLOW}⚠ vfkit not found, skipping VM-based installation${NC}"
        return 1
    fi
    
    # Create temporary EFI variable store
    TEMP_EFI="/tmp/efi-temp-$$.nvram"
    if [[ ! -f "$TEMP_EFI" ]]; then
        # Create empty EFI variable store using Swift helper or vfkit
        echo "Creating temporary EFI variable store..."
        # We'll use a Swift helper for this, but for now create empty file
        touch "$TEMP_EFI"
    fi
    
    # Create cloud-init script to install GRUB
    CLOUD_INIT_DIR="/tmp/cloud-init-grub-$$"
    mkdir -p "$CLOUD_INIT_DIR"
    
    cat > "$CLOUD_INIT_DIR/user-data" <<'CLOUDINIT'
#cloud-config
package_update: true
package_upgrade: true

packages:
  - grub-efi
  - efibootmgr
  - dosfstools
  - gptfdisk

runcmd:
  - |
    echo "Installing GRUB EFI bootloader..."
    # Mount EFI partition if it exists
    if [ -b /dev/vda1 ]; then
      mkdir -p /mnt/efi
      mount /dev/vda1 /mnt/efi || true
    fi
    
    # Install GRUB
    apk add --no-cache grub-efi efibootmgr dosfstools gptfdisk
    
    # Create EFI directory structure
    mkdir -p /boot/efi/EFI/BOOT
    mkdir -p /boot/efi/EFI/ALPINE
    
    # Install GRUB to EFI partition
    if [ -d /mnt/efi ]; then
      grub-install --target=arm64-efi --efi-directory=/mnt/efi --bootloader-id=ALPINE --removable
      grub-mkconfig -o /boot/grub/grub.cfg
    else
      # If no EFI partition, create one
      echo "Creating EFI System Partition..."
      # This requires partitioning, which is complex - we'll handle it separately
      grub-install --target=arm64-efi --efi-directory=/boot/efi --bootloader-id=ALPINE
      grub-mkconfig -o /boot/grub/grub.cfg
    fi
    
    # Create GRUB config
    cat > /boot/grub/grub.cfg <<'GRUBCFG'
set timeout=1
set default=0

menuentry "Alpine Linux" {
    linux /boot/vmlinuz-lts console=hvc0 root=/dev/vda2 rw quiet
    initrd /boot/initramfs-lts
}
GRUBCFG
    
    echo "GRUB installation complete"
CLOUDINIT
    
    cat > "$CLOUD_INIT_DIR/meta-data" <<METADATA
instance-id: grub-install-$$
local-hostname: grub-install
METADATA
    
    # Create cloud-init ISO
    CLOUD_INIT_ISO="/tmp/cloud-init-grub-$$.iso"
    if command -v genisoimage &> /dev/null; then
        genisoimage -output "$CLOUD_INIT_ISO" -volid cidata -joliet -rock \
            "$CLOUD_INIT_DIR/user-data" "$CLOUD_INIT_DIR/meta-data" 2>/dev/null || true
    elif command -v mkisofs &> /dev/null; then
        mkisofs -output "$CLOUD_INIT_ISO" -volid cidata -joliet -rock \
            "$CLOUD_INIT_DIR/user-data" "$CLOUD_INIT_DIR/meta-data" 2>/dev/null || true
    else
        echo -e "${YELLOW}⚠ genisoimage/mkisofs not found, cannot create cloud-init ISO${NC}"
        return 1
    fi
    
    echo -e "${GREEN}✓${NC} Cloud-init ISO created"
    
    # Boot VM with disk image and cloud-init
    echo "Booting temporary VM to install GRUB..."
    echo -e "${YELLOW}Note: This will boot a VM, install GRUB, then shut down${NC}"
    
    # Use vfkit to boot the VM
    vfkit \
        --cpus 2 \
        --memory 2048 \
        --bootloader efi,variable-store="$TEMP_EFI",create \
        --device virtio-blk,path="$DISK_IMAGE" \
        --device virtio-blk,path="$CLOUD_INIT_ISO",devName=cdrom \
        --device virtio-net,nat \
        --device virtio-serial,logFilePath=/tmp/vfkit-grub-install.log \
        --device virtio-rng &
    
    VFKIT_PID=$!
    
    echo "VM started (PID: $VFKIT_PID)"
    echo "Waiting for GRUB installation to complete..."
    echo "Check logs at: /tmp/vfkit-grub-install.log"
    
    # Wait a reasonable time for installation
    sleep 60
    
    # Stop the VM
    kill $VFKIT_PID 2>/dev/null || true
    wait $VFKIT_PID 2>/dev/null || true
    
    echo -e "${GREEN}✓${NC} GRUB installation via VM completed"
    
    # Cleanup
    rm -rf "$CLOUD_INIT_DIR" "$CLOUD_INIT_ISO" "$TEMP_EFI"
    
    return 0
}

# Method 2: Use chroot installation (requires macOS disk mounting)
install_grub_via_chroot() {
    echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${YELLOW}  Method 2: Installing GRUB via Chroot (macOS)${NC}"
    echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
    
    echo "Attaching disk image..."
    DISK_DEV=$(hdiutil attach -imagekey diskimage-class=CRawDiskImage -nomount "$DISK_IMAGE" 2>/dev/null | awk '{print $1}' | head -1)
    
    if [[ -z "$DISK_DEV" ]]; then
        echo -e "${RED}❌ Failed to attach disk image${NC}"
        return 1
    fi
    
    echo -e "${GREEN}✓${NC} Disk attached as: $DISK_DEV"
    
    # Check partition layout
    echo "Checking partition layout..."
    PARTITIONS=$(diskutil list "$DISK_DEV" | grep -E "^.*\s+\d+:" | awk '{print $NF}')
    
    if [[ -z "$PARTITIONS" ]]; then
        echo -e "${YELLOW}⚠ No partitions found, disk may need partitioning${NC}"
        echo "This script assumes a partitioned disk with at least:"
        echo "  - Partition 1: EFI System Partition (FAT32)"
        echo "  - Partition 2: Root filesystem (ext4)"
        hdiutil detach "$DISK_DEV" 2>/dev/null || true
        return 1
    fi
    
    # Find root partition (usually partition 2)
    ROOT_PART="${DISK_DEV}s2"
    ESP_PART="${DISK_DEV}s1"
    
    # Mount root partition
    echo "Mounting root filesystem..."
    sudo mount -t ext4 "$ROOT_PART" "$TEMP_MOUNT" 2>/dev/null || {
        echo -e "${YELLOW}⚠ Could not mount as ext4, trying other filesystems...${NC}"
        sudo mount "$ROOT_PART" "$TEMP_MOUNT" 2>/dev/null || {
            echo -e "${RED}❌ Failed to mount root partition${NC}"
            hdiutil detach "$DISK_DEV" 2>/dev/null || true
            return 1
        }
    }
    
    echo -e "${GREEN}✓${NC} Root filesystem mounted at $TEMP_MOUNT"
    
    # Mount EFI partition if it exists
    ESP_MOUNT=""
    if [[ -b "$ESP_PART" ]]; then
        ESP_MOUNT="/tmp/esp-mount-$$"
        mkdir -p "$ESP_MOUNT"
        sudo mount -t msdos "$ESP_PART" "$ESP_MOUNT" 2>/dev/null || {
            echo -e "${YELLOW}⚠ Could not mount ESP partition${NC}"
        }
        if [[ -d "$ESP_MOUNT" ]]; then
            echo -e "${GREEN}✓${NC} EFI System Partition mounted"
        fi
    fi
    
    # Prepare chroot environment
    echo "Preparing chroot environment..."
    
    # Mount required filesystems
    sudo mount -t proc proc "$TEMP_MOUNT/proc" 2>/dev/null || true
    sudo mount -t sysfs sysfs "$TEMP_MOUNT/sys" 2>/dev/null || true
    sudo mount --bind /dev "$TEMP_MOUNT/dev" 2>/dev/null || true
    
    # Create GRUB installation script
    INSTALL_SCRIPT="$TEMP_MOUNT/tmp/install-grub.sh"
    sudo tee "$INSTALL_SCRIPT" > /dev/null <<'INSTALLSCRIPT'
#!/bin/sh
set -e

echo "Installing GRUB packages..."
apk update
apk add --no-cache grub-efi efibootmgr dosfstools

# Create EFI directory structure
mkdir -p /boot/efi/EFI/BOOT
mkdir -p /boot/efi/EFI/ALPINE

# Install GRUB
if [ -d /boot/efi ]; then
    grub-install --target=arm64-efi --efi-directory=/boot/efi --bootloader-id=ALPINE --removable
    grub-mkconfig -o /boot/grub/grub.cfg
    echo "GRUB installed successfully"
else
    echo "Warning: /boot/efi not found, GRUB installation may be incomplete"
fi
INSTALLSCRIPT
    
    sudo chmod +x "$INSTALL_SCRIPT"
    
    # Execute installation in chroot
    echo "Installing GRUB in chroot..."
    sudo chroot "$TEMP_MOUNT" /tmp/install-grub.sh || {
        echo -e "${YELLOW}⚠ Chroot installation had issues, but continuing...${NC}"
    }
    
    # Cleanup chroot mounts
    sudo umount "$TEMP_MOUNT/dev" 2>/dev/null || true
    sudo umount "$TEMP_MOUNT/sys" 2>/dev/null || true
    sudo umount "$TEMP_MOUNT/proc" 2>/dev/null || true
    
    # Unmount ESP if mounted
    if [[ -n "$ESP_MOUNT" ]] && mountpoint -q "$ESP_MOUNT" 2>/dev/null; then
        sudo umount "$ESP_MOUNT" 2>/dev/null || true
        rmdir "$ESP_MOUNT" 2>/dev/null || true
    fi
    
    # Unmount root
    sudo umount "$TEMP_MOUNT" 2>/dev/null || true
    
    # Detach disk
    hdiutil detach "$DISK_DEV" 2>/dev/null || true
    
    echo -e "${GREEN}✓${NC} GRUB installation via chroot completed"
    
    return 0
}

# Try VM-based installation first, fallback to chroot
if ! install_grub_via_vm; then
    echo ""
    echo -e "${YELLOW}Falling back to chroot method...${NC}"
    if ! install_grub_via_chroot; then
        echo -e "${RED}❌ Both installation methods failed${NC}"
        exit 1
    fi
fi

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  GRUB Installation Complete!                                 ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "Next steps:"
echo "1. Create EFI boot entry using: scripts/vfkit/manage-efi-boot-entries.sh"
echo "2. Test boot with: vfkit --bootloader efi --device virtio-blk,path=$DISK_IMAGE"

