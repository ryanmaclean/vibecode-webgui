#!/usr/bin/env bash
# Setup and verify vfkit for Alpine ARM64 VMs
# This script installs vfkit and prepares the environment

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
VM_DIR="${HOME}/.vfkit/vms/vibecode-alpine"

echo "=== vfkit Setup for Alpine ARM64 ==="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if running on macOS
if [[ "$(uname)" != "Darwin" ]]; then
    echo -e "${RED}❌ Error: This script requires macOS${NC}"
    exit 1
fi

# Check if running on Apple Silicon
ARCH="$(uname -m)"
if [[ "$ARCH" != "arm64" ]]; then
    echo -e "${YELLOW}⚠️  Warning: Not running on Apple Silicon (detected: $ARCH)${NC}"
    echo "vfkit works best on Apple Silicon M1/M2/M3"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo "✅ Platform: macOS on $ARCH"
echo ""

# Check if Homebrew is installed
if ! command -v brew &> /dev/null; then
    echo -e "${RED}❌ Homebrew is not installed${NC}"
    echo "Install Homebrew from: https://brew.sh"
    echo ""
    echo "Run this command:"
    echo '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
    exit 1
fi

echo "✅ Homebrew installed: $(brew --version | head -1)"
echo ""

# Check if vfkit is installed
if ! command -v vfkit &> /dev/null; then
    echo -e "${YELLOW}⚠️  vfkit is not installed${NC}"
    echo "Installing vfkit via Homebrew..."
    echo ""

    if brew install vfkit; then
        echo -e "${GREEN}✅ vfkit installed successfully${NC}"
    else
        echo -e "${RED}❌ Failed to install vfkit${NC}"
        echo "Try manually: brew install vfkit"
        exit 1
    fi
else
    echo "✅ vfkit already installed"
    VFKIT_VERSION=$(vfkit --version 2>&1 || echo "unknown")
    echo "   Version: $VFKIT_VERSION"
fi

echo ""

# Verify vfkit can run
echo "Verifying vfkit..."
if vfkit --help &> /dev/null; then
    echo -e "${GREEN}✅ vfkit is working${NC}"
else
    echo -e "${RED}❌ vfkit is installed but not working${NC}"
    echo "Try: brew reinstall vfkit"
    exit 1
fi

echo ""

# Create VM directory structure
echo "Creating VM directories..."
mkdir -p "${VM_DIR}"/{kernel,rootfs,disk,logs}

echo -e "${GREEN}✅ Created VM directories:${NC}"
echo "   ${VM_DIR}/kernel  - Kernel and initramfs"
echo "   ${VM_DIR}/rootfs  - Root filesystem builds"
echo "   ${VM_DIR}/disk    - VM disk images"
echo "   ${VM_DIR}/logs    - VM console and error logs"

echo ""

# Check available disk space
AVAILABLE_GB=$(df -g "$HOME" | tail -1 | awk '{print $4}')
echo "Available disk space: ${AVAILABLE_GB}GB"

if [[ $AVAILABLE_GB -lt 5 ]]; then
    echo -e "${YELLOW}⚠️  Warning: Less than 5GB available${NC}"
    echo "Recommended: At least 10GB free space"
fi

echo ""

# Summary
echo "=== Setup Complete ==="
echo ""
echo "✅ vfkit installed and verified"
echo "✅ VM directories created at: ${VM_DIR}"
echo ""
echo "Next steps:"
echo "  1. Run: ./scripts/vfkit/02-download-alpine-kernel.sh"
echo "  2. Run: ./scripts/vfkit/03-create-alpine-rootfs.sh"
echo "  3. Run: ./scripts/vfkit/04-launch-alpine-vm.sh"
echo ""
echo "Or run the all-in-one installer:"
echo "  ./scripts/vfkit/install-alpine-vm.sh"
echo ""
