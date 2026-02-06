#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

# Install GRUB bootloader in Alpine VM
# Issue #955: Fix VM bootloader for Alpine images
#
# Usage: Run this script inside an Alpine VM to install GRUB

# Initialize log aggregation
init_log_aggregation


set -euo pipefail

echo "=== Alpine GRUB Bootloader Installation ==="

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo "Error: This script must be run as root"
   exit 1
fi

# Detect architecture
ARCH=$(uname -m)
case $ARCH in
  aarch64) GRUB_TARGET="arm64-efi" ;;
  x86_64)  GRUB_TARGET="x86_64-efi" ;;
  *)       echo "Unsupported architecture: $ARCH"; exit 1 ;;
esac

echo "Architecture: $ARCH"
echo "GRUB target: $GRUB_TARGET"

# Install required packages
echo "Installing GRUB packages..."
apk update
apk add grub grub-efi efibootmgr

# Create and mount EFI partition
echo "Setting up EFI partition..."
mkdir -p /boot/efi

# Find EFI partition (usually first partition)
EFI_PART=""
for disk in /dev/vda /dev/sda /dev/nvme0n1; do
  if [[ -b "${disk}1" ]]; then
    EFI_PART="${disk}1"
    break
  elif [[ -b "${disk}p1" ]]; then
    EFI_PART="${disk}p1"
    break
  fi
done

if [[ -z "$EFI_PART" ]]; then
  echo "Error: Could not find EFI partition"
  exit 1
fi

echo "EFI partition: $EFI_PART"

# Mount EFI partition if not already mounted
if ! mountpoint -q /boot/efi; then
  mount "$EFI_PART" /boot/efi
fi

# Install GRUB
echo "Installing GRUB for $GRUB_TARGET..."
grub-install \
  --target="$GRUB_TARGET" \
  --efi-directory=/boot/efi \
  --bootloader-id=alpine \
  --removable

# Generate GRUB configuration
echo "Generating GRUB configuration..."
grub-mkconfig -o /boot/grub/grub.cfg

# Verify installation
echo "Verifying installation..."
if [[ -f /boot/efi/EFI/alpine/grub${ARCH:0:4}.efi ]] || [[ -f /boot/efi/EFI/BOOT/BOOT${ARCH^^}.EFI ]]; then
  echo "✓ GRUB EFI binary installed"
else
  echo "Warning: GRUB EFI binary not found in expected location"
fi

# Show boot entries
echo ""
echo "=== EFI Boot Entries ==="
efibootmgr -v 2>/dev/null || echo "efibootmgr not available (normal for first boot)"

# Add to fstab if not present
if ! grep -q "/boot/efi" /etc/fstab; then
  echo "Adding EFI partition to fstab..."
  echo "$EFI_PART /boot/efi vfat defaults 0 2" >> /etc/fstab
fi

echo ""
echo "=== Installation Complete ==="
echo "GRUB bootloader has been installed."
echo "The VM should now boot properly with Apple Virtualization.framework."
echo ""
echo "If this is the first boot, shutdown and restart the VM."
