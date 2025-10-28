#!/bin/bash
# Manual QEMU-based Alpine Linux ARM64 + VibeCode Builder
# This script automates the VM creation because Packer has ARM64 boot limitations

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
ALPINE_ISO="$HOME/VM-Demo/alpine-arm64/alpine-arm64.iso"
OUTPUT_DIR="output-alpine-vibecode"
VM_NAME="alpine-vibecode-arm64"
DISK_SIZE="20G"
MEMORY="4096"
CPUS="2"

echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Alpine Linux ARM64 + VibeCode Builder (Manual QEMU)${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Create disk image
echo -e "${YELLOW}Creating ${DISK_SIZE} disk image...${NC}"
qemu-img create -f qcow2 "$OUTPUT_DIR/$VM_NAME.qcow2" $DISK_SIZE
echo -e "${GREEN}✓ Disk created${NC}"
echo

# Check if Alpine ISO exists
if [ ! -f "$ALPINE_ISO" ]; then
    echo -e "${YELLOW}Alpine ISO not found. Downloading...${NC}"
    mkdir -p "$(dirname $ALPINE_ISO)"
    curl -L "https://dl-cdn.alpinelinux.org/alpine/v3.20/releases/aarch64/alpine-virt-3.20.3-aarch64.iso" \
        -o "$ALPINE_ISO"
    echo -e "${GREEN}✓ Alpine ISO downloaded${NC}"
    echo
fi

echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Phase 1: Alpine Installation${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo
echo -e "${YELLOW}Starting VM for installation...${NC}"
echo -e "${YELLOW}Follow these steps in the console:${NC}"
echo
echo -e "1. Login as ${GREEN}root${NC} (no password)"
echo -e "2. Run: ${GREEN}setup-alpine${NC}"
echo -e "3. Answer prompts:"
echo -e "   - Keyboard: ${GREEN}us${NC}"
echo -e "   - Variant: ${GREEN}us${NC}"
echo -e "   - Hostname: ${GREEN}vibecode-alpine${NC}"
echo -e "   - Network: ${GREEN}eth0${NC}"
echo -e "   - IP: ${GREEN}dhcp${NC}"
echo -e "   - Manual network config: ${GREEN}n${NC}"
echo -e "   - Root password: ${GREEN}vibecode${NC} (twice)"
echo -e "   - Timezone: ${GREEN}UTC${NC}"
echo -e "   - Proxy: ${GREEN}none${NC}"
echo -e "   - Mirror: ${GREEN}1${NC} (or press Enter)"
echo -e "   - SSH server: ${GREEN}openssh${NC}"
echo -e "   - Disk: ${GREEN}vda${NC}"
echo -e "   - How to use: ${GREEN}sys${NC}"
echo -e "   - Erase disk: ${GREEN}y${NC}"
echo -e "4. Wait for installation to complete"
echo -e "5. Type: ${GREEN}poweroff${NC}"
echo
read -p "Press Enter to start installation VM..."

# Boot from ISO for installation
qemu-system-aarch64 \
    -machine virt \
    -cpu host \
    -accel hvf \
    -smp $CPUS \
    -m $MEMORY \
    -bios /opt/homebrew/share/qemu/edk2-aarch64-code.fd \
    -drive file="$OUTPUT_DIR/$VM_NAME.qcow2",if=virtio,format=qcow2 \
    -cdrom "$ALPINE_ISO" \
    -device virtio-net-pci,netdev=net0 \
    -netdev user,id=net0,hostfwd=tcp::2222-:22 \
    -serial mon:stdio \
    -display cocoa

echo
echo -e "${GREEN}✓ Installation complete${NC}"
echo

echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Phase 2: VibeCode Setup${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo
echo -e "${YELLOW}Starting VM from installed disk...${NC}"
echo -e "${YELLOW}This will boot the installed system and set up VibeCode${NC}"
echo
read -p "Press Enter to continue..."

# Boot from disk (no CD) for setup
qemu-system-aarch64 \
    -machine virt \
    -cpu host \
    -accel hvf \
    -smp $CPUS \
    -m $MEMORY \
    -bios /opt/homebrew/share/qemu/edk2-aarch64-code.fd \
    -drive file="$OUTPUT_DIR/$VM_NAME.qcow2",if=virtio,format=qcow2 \
    -device virtio-net-pci,netdev=net0 \
    -netdev user,id=net0,hostfwd=tcp::2222-:22,hostfwd=tcp::3000-:3000 \
    -serial mon:stdio \
    -display cocoa

echo
echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✅ Build Complete!${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
echo
echo -e "${YELLOW}VM Image:${NC} $OUTPUT_DIR/$VM_NAME.qcow2"
echo -e "${YELLOW}Size:${NC} $(du -h $OUTPUT_DIR/$VM_NAME.qcow2 | cut -f1)"
echo
echo -e "${YELLOW}To launch the VM:${NC}"
echo "./launch-alpine-vibecode.sh"
echo
echo -e "${YELLOW}To access VibeCode:${NC}"
echo "1. Boot the VM"
echo "2. SSH: ssh -p 2222 root@localhost (password: vibecode)"
echo "3. Follow setup script in /root/setup-vibecode.sh"
echo "4. Access: http://localhost:3000"
echo
