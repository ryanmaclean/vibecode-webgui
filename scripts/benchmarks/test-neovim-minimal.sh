#!/usr/bin/env bash
# Quick test to see if we can get Neovim in a minimal environment
# This tests locally without requiring kernel build

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

echo "=== MiniVim + Neovim Feasibility Test ==="
echo ""

# Check if Neovim is available
if command -v nvim &> /dev/null; then
    NVIM_VERSION=$(nvim --version | head -1)
    echo "✓ Neovim found: ${NVIM_VERSION}"
    
    # Get binary size
    NVIM_PATH=$(command -v nvim)
    NVIM_SIZE=$(du -h "${NVIM_PATH}" | cut -f1)
    echo "  Binary size: ${NVIM_SIZE}"
    
    # Check if it's statically linked
    if file "${NVIM_PATH}" | grep -q "statically linked"; then
        echo "  ✓ Statically linked (perfect for initramfs!)"
    else
        echo "  ⚠ Dynamically linked (will need libraries in initramfs)"
        echo ""
        echo "  Required libraries:"
        ldd "${NVIM_PATH}" 2>/dev/null | head -10 || true
    fi
else
    echo "✗ Neovim not found locally"
    echo ""
    echo "Installing Neovim for testing..."
    
    # Try to download static build
    NEOVIM_VERSION="v0.10.2"
    TEMP_DIR=$(mktemp -d)
    cd "${TEMP_DIR}"
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "  Downloading macOS build..."
        curl -L -o nvim-macos.tar.gz \
            "https://github.com/neovim/neovim/releases/download/${NEOVIM_VERSION}/nvim-macos-x86_64.tar.gz"
        tar xzf nvim-macos.tar.gz
        NVIM_PATH="${TEMP_DIR}/nvim-macos-x86_64/bin/nvim"
    else
        echo "  Downloading Linux static build..."
        curl -L -o nvim-linux.tar.gz \
            "https://github.com/neovim/neovim/releases/download/${NEOVIM_VERSION}/nvim-linux64.tar.gz"
        tar xzf nvim-linux.tar.gz
        NVIM_PATH="${TEMP_DIR}/nvim-linux64/bin/nvim"
    fi
    
    if [ -f "${NVIM_PATH}" ]; then
        NVIM_SIZE=$(du -h "${NVIM_PATH}" | cut -f1)
        echo "  ✓ Downloaded: ${NVIM_SIZE}"
    fi
fi

echo ""
echo "=== Size Analysis ==="
echo ""

# Estimate initramfs size
echo "Estimated initramfs components:"
echo "  - BusyBox: ~1-2 MB (static)"
echo "  - Neovim: ~${NVIM_SIZE:-10-15MB} (with runtime)"
echo "  - Libraries: ~5-10 MB (if dynamic)"
echo "  - Total: ~15-30 MB compressed"
echo ""

# Compare with current minimal initramfs
CURRENT_SIZE=$(du -h "${REPO_ROOT}/bench-images/busybox/busybox-initramfs.cpio.gz" 2>/dev/null | cut -f1 || echo "N/A")
echo "Current minimal initramfs: ${CURRENT_SIZE}"
echo ""

echo "=== Boot Time Estimate ==="
echo ""
echo "With MiniVim kernel + Neovim initramfs:"
echo "  - Kernel boot: ~1-2s"
echo "  - Initramfs load: ~0.5-1s"
echo "  - Neovim startup: ~0.1-0.3s"
echo "  - Total: ~2-4s to Neovim prompt"
echo ""

echo "=== Avante.nvim Compatibility ==="
echo ""
echo "Requirements for Avante.nvim:"
echo "  ✓ Neovim >= 0.10.0"
echo "  ✓ Lua support (built-in)"
echo "  ✓ Tree-sitter (built-in)"
echo "  ? Network access (for AI APIs)"
echo "  ? Git (optional, for version control)"
echo ""

echo "=== Next Steps ==="
echo ""
echo "To build the full Neovim initramfs:"
echo "  ./scripts/benchmarks/build-neovim-initramfs.sh"
echo ""
echo "To test with QEMU (after building kernel):"
echo "  qemu-system-x86_64 \\"
echo "    -kernel bench-images/minivim/bzImage-x86_64-6.17 \\"
echo "    -initrd bench-images/busybox/busybox-neovim-initrd.cpio.gz \\"
echo "    -m 512M -nographic \\"
echo "    -append 'console=ttyS0'"
echo ""

# Cleanup
if [ -n "${TEMP_DIR:-}" ] && [ -d "${TEMP_DIR}" ]; then
    rm -rf "${TEMP_DIR}"
fi
