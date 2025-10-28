#!/usr/bin/env bash
# All-in-one installer for VibeCode Alpine VM with vfkit
# Runs all setup steps automatically

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
cat << 'EOF'
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   VibeCode Alpine VM Installer                           ║
║   Native macOS virtualization with vfkit                  ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

echo "This installer will:"
echo "  1. Install and verify vfkit"
echo "  2. Download Alpine ARM64 kernel and initramfs"
echo "  3. Create custom Alpine rootfs with Node.js"
echo "  4. Launch the VM"
echo ""

# Check if running on macOS
if [[ "$(uname)" != "Darwin" ]]; then
    echo -e "${YELLOW}❌ This installer only works on macOS${NC}"
    exit 1
fi

# Prompt for confirmation
read -p "Continue with installation? (Y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Nn]$ ]]; then
    echo "Installation cancelled"
    exit 0
fi

echo ""
echo -e "${GREEN}Starting installation...${NC}"
echo ""

# Step 1: Setup vfkit
echo -e "${BLUE}═══ Step 1/4: Setting up vfkit ═══${NC}"
echo ""

if bash "${SCRIPT_DIR}/01-setup-vfkit.sh"; then
    echo -e "${GREEN}✅ vfkit setup complete${NC}"
else
    echo -e "${YELLOW}❌ vfkit setup failed${NC}"
    exit 1
fi

echo ""
read -p "Press Enter to continue to Step 2..."
echo ""

# Step 2: Download Alpine kernel
echo -e "${BLUE}═══ Step 2/4: Downloading Alpine kernel ═══${NC}"
echo ""

if bash "${SCRIPT_DIR}/02-download-alpine-kernel.sh"; then
    echo -e "${GREEN}✅ Alpine kernel download complete${NC}"
else
    echo -e "${YELLOW}❌ Alpine kernel download failed${NC}"
    exit 1
fi

echo ""
read -p "Press Enter to continue to Step 3..."
echo ""

# Step 3: Create rootfs
echo -e "${BLUE}═══ Step 3/4: Creating Alpine rootfs ═══${NC}"
echo ""
echo -e "${YELLOW}⚠️  This step downloads ~200MB and takes 5-10 minutes${NC}"
echo ""

if bash "${SCRIPT_DIR}/03-create-alpine-rootfs.sh"; then
    echo -e "${GREEN}✅ Alpine rootfs creation complete${NC}"
else
    echo -e "${YELLOW}❌ Alpine rootfs creation failed${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}═══ Installation Complete! ═══${NC}"
echo ""
echo "VibeCode Alpine VM is ready to launch"
echo ""

# Ask if user wants to launch now
read -p "Launch VM now? (Y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Nn]$ ]]; then
    echo ""
    echo -e "${BLUE}═══ Step 4/4: Launching VM ═══${NC}"
    echo ""

    # Launch VM
    bash "${SCRIPT_DIR}/04-launch-alpine-vm.sh"
else
    echo ""
    echo "To launch the VM later, run:"
    echo "  ${SCRIPT_DIR}/04-launch-alpine-vm.sh"
    echo ""
fi

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                                                           ║${NC}"
echo -e "${GREEN}║   Installation Successful!                                ║${NC}"
echo -e "${GREEN}║                                                           ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""
