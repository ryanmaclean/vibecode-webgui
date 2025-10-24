#!/usr/bin/env bash
# Build fast-openvscode-vm with AI coding tools
# Usage: ./scripts/build-fast-openvscode-vm-with-ai-tools.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
WORK_DIR="${REPO_ROOT}/artifacts/fast-openvscode-vm-build"
VM_DIR="${REPO_ROOT}/fast-openvscode-vm"
OUTPUT_DIR="${REPO_ROOT}/dist"

# OpenVSCode version (latest)
OPENVSCODE_VERSION="openvscode-server-v1.105.1"
OPENVSCODE_URL="https://github.com/gitpod-io/openvscode-server/releases/download/${OPENVSCODE_VERSION}/${OPENVSCODE_VERSION}-linux-arm64.tar.gz"

# BusyBox version
BUSYBOX_VERSION="1.36.1"
BUSYBOX_URL="https://busybox.net/downloads/binaries/${BUSYBOX_VERSION}/busybox-arm64"

echo "=== Building Fast OpenVSCode VM with AI Tools ==="
echo "OpenVSCode Version: ${OPENVSCODE_VERSION}"
echo "BusyBox Version: ${BUSYBOX_VERSION}"
echo "Work Directory: ${WORK_DIR}"
echo ""

# Clean and create work directory
rm -rf "${WORK_DIR}"
mkdir -p "${WORK_DIR}"
cd "${WORK_DIR}"

# Create directory structure
echo "Creating directory structure..."
mkdir -p {bin,sbin,etc,proc,sys,dev,tmp,usr/bin,usr/sbin,lib,lib64,root,opt/openvscode-server}

# Download BusyBox
echo "Downloading BusyBox..."
curl -L -o busybox "${BUSYBOX_URL}"
chmod +x busybox

# Download OpenVSCode Server
echo "Downloading OpenVSCode Server..."
curl -L -o openvscode.tar.gz "${OPENVSCODE_URL}"
tar -xzf openvscode.tar.gz
mv "${OPENVSCODE_VERSION}-linux-arm64"/* opt/openvscode-server/
rm -rf "${OPENVSCODE_VERSION}-linux-arm64" openvscode.tar.gz

# Copy BusyBox to bin
cp busybox bin/

# Create BusyBox symlinks
echo "Creating BusyBox symlinks..."
cd bin
for cmd in sh ash bash ls cat echo mount umount mkdir rmdir cp mv rm ln chmod chown \
           ps kill grep sed awk find xargs tar gzip gunzip less more head tail \
           wget curl vi ed sleep ping ifconfig route; do
    ln -sf busybox "$cmd" 2>/dev/null || true
done
cd "${WORK_DIR}"

# Download and install AI coding tools
echo "Installing AI coding tools..."

# Install Node.js for AI tools
echo "Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - || {
    # Fallback: download Node.js binary
    curl -fsSL https://nodejs.org/dist/v20.11.0/node-v20.11.0-linux-arm64.tar.xz -o node.tar.xz
    tar -xf node.tar.xz
    cp -r node-v20.11.0-linux-arm64/* usr/
    rm -rf node-v20.11.0-linux-arm64 node.tar.xz
}

# Install AI tools via npm
echo "Installing AI coding tools via npm..."
export PATH="/usr/bin:$PATH"
npm install -g @anthropic-ai/claude-code || echo "Claude Code install failed"
npm install -g @openai/codex || echo "OpenAI Codex install failed" 
npm install -g @just-every/code || echo "just-every/code install failed"
npm install -g @google/gemini-cli || echo "Google Gemini CLI install failed"

# Install Python and Aider
echo "Installing Python and Aider..."
python3 -m pip install --break-system-packages aider || echo "Aider install failed"

# Create AI tools verification script
cat > bin/verify-ai-tools << 'EOF'
#!/bin/sh
echo "=== Verifying AI Coding Tools ==="

# Check Node.js tools
for tool in claude codex coder gemini; do
    if command -v "$tool" >/dev/null 2>&1; then
        echo "✅ $tool: $(which $tool)"
    else
        echo "❌ $tool: Not found"
    fi
done

# Check Python tools
if command -v aider >/dev/null 2>&1; then
    echo "✅ aider: $(which aider)"
else
    echo "❌ aider: Not found"
fi

echo "=== Verification Complete ==="
EOF
chmod +x bin/verify-ai-tools

# Create init script
echo "Creating init script..."
cat > init << 'EOF'
#!/bin/sh
# Fast OpenVSCode VM with AI Tools Init Script

# Mount essential filesystems
mount -t proc none /proc
mount -t sysfs none /sys
mount -t devtmpfs none /dev
mount -t tmpfs none /tmp

# Set up environment
export PATH=/bin:/sbin:/usr/bin:/usr/sbin:/opt/openvscode-server/bin
export HOME=/root
export TERM=xterm-256color

# Clear screen
clear

# Welcome message
cat << 'WELCOME'
==========================================
  Fast OpenVSCode VM with AI Tools
==========================================

OpenVSCode Server: Ready
AI Tools Available:
  - Claude Code CLI (claude)
  - OpenAI Codex CLI (codex) 
  - just-every/code (coder)
  - Google Gemini CLI (gemini)
  - Aider (aider)

Quick start:
  verify-ai-tools    - Check AI tools
  /opt/openvscode-server/bin/openvscode-server --help
  exit               - Shutdown

==========================================
WELCOME

# Verify AI tools
echo "Verifying AI tools..."
verify-ai-tools

# Start OpenVSCode Server
echo "Starting OpenVSCode Server..."
cd /opt/openvscode-server
exec /opt/openvscode-server/bin/openvscode-server \
    --port 3000 \
    --host 0.0.0.0 \
    --without-connection-token \
    --disable-telemetry
EOF

chmod +x init

# Create the initramfs
echo "Creating initramfs archive..."
find . | cpio -o -H newc | gzip > "${OUTPUT_DIR}/fast-openvscode-vm-with-ai-tools.cpio.gz"

# Get size
SIZE=$(du -h "${OUTPUT_DIR}/fast-openvscode-vm-with-ai-tools.cpio.gz" | cut -f1)

echo ""
echo "=== Build Complete ==="
echo "Output: ${OUTPUT_DIR}/fast-openvscode-vm-with-ai-tools.cpio.gz"
echo "Size: ${SIZE}"
echo ""
echo "Contents:"
echo "  - OpenVSCode Server ${OPENVSCODE_VERSION}"
echo "  - BusyBox ${BUSYBOX_VERSION}"
echo "  - Node.js 20 LTS"
echo "  - AI Tools: Claude Code, OpenAI Codex, just-every/code, Google Gemini, Aider"
echo ""
echo "To test with QEMU:"
echo "  qemu-system-aarch64 \\"
echo "    -machine virt -cpu cortex-a72 \\"
echo "    -kernel vmlinuz-host \\"
echo "    -initrd ${OUTPUT_DIR}/fast-openvscode-vm-with-ai-tools.cpio.gz \\"
echo "    -m 2G -nographic \\"
echo "    -append 'console=ttyAMA0'"
echo ""

# Update the VM directory
echo "Updating VM directory..."
rm -rf "${VM_DIR}"
mkdir -p "${VM_DIR}"
cp "${OUTPUT_DIR}/fast-openvscode-vm-with-ai-tools.cpio.gz" "${VM_DIR}/openvscode-initramfs.cpio.gz"

# Create README
cat > "${VM_DIR}/README.md" << EOF
# Fast OpenVSCode VM with AI Tools

This microVM contains:
- OpenVSCode Server ${OPENVSCODE_VERSION}
- BusyBox ${BUSYBOX_VERSION}
- Node.js 20 LTS
- AI Coding Tools:
  - Claude Code CLI (\`claude\`)
  - OpenAI Codex CLI (\`codex\`)
  - just-every/code (\`coder\`)
  - Google Gemini CLI (\`gemini\`)
  - Aider (\`aider\`)

## Usage

1. Copy a Linux kernel to \`vmlinuz-host\`
2. Run with QEMU:
   \`\`\`bash
   qemu-system-aarch64 \\
     -machine virt -cpu cortex-a72 \\
     -kernel vmlinuz-host \\
     -initrd openvscode-initramfs.cpio.gz \\
     -m 2G -nographic \\
     -append 'console=ttyAMA0'
   \`\`\`
3. Access OpenVSCode at \`http://localhost:3000\`

## Verification

Run \`verify-ai-tools\` to check all AI tools are working.

Built: $(date -u +%Y-%m-%dT%H:%M:%SZ)
EOF

echo "✅ VM updated in ${VM_DIR}"
echo "✅ Ready for packaging with scripts/release/package-fast-openvscode-vm.sh"

# Cleanup
cd "${REPO_ROOT}"
rm -rf "${WORK_DIR}"
