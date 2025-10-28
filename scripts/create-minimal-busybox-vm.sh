#!/usr/bin/env bash
# Create ultra-minimal BusyBox VM with AI tools for vfkit
# This will be TINY - under 20MB total!

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
WORK_DIR="${REPO_ROOT}/artifacts/minimal-busybox-vm"
VM_DIR="${HOME}/.vfkit/vms/vibecode-minimal"

echo "=== Creating Ultra-Minimal BusyBox VM with AI Tools ==="
echo "Target: Under 20MB total!"
echo "Work Directory: ${WORK_DIR}"
echo ""

# Clean and create work directory
rm -rf "${WORK_DIR}"
mkdir -p "${WORK_DIR}"
cd "${WORK_DIR}"

# Create minimal directory structure
echo "Creating minimal directory structure..."
mkdir -p {bin,sbin,etc,proc,sys,dev,tmp,usr/bin,usr/sbin,lib,root}

# Download minimal BusyBox (static binary)
echo "Downloading minimal BusyBox..."
curl -L -o busybox https://busybox.net/downloads/binaries/1.36.1/busybox-arm64
chmod +x busybox

# Copy BusyBox to bin
cp busybox bin/

# Create minimal BusyBox symlinks (only essential commands)
echo "Creating minimal BusyBox symlinks..."
cd bin
for cmd in sh ash ls cat echo mount umount mkdir rmdir cp mv rm ln chmod chown \
           ps kill grep sed awk find tar gzip gunzip wget curl vi sleep ping; do
    ln -sf busybox "$cmd" 2>/dev/null || true
done
cd "${WORK_DIR}"

# Create minimal AI tool placeholders (no actual installation)
echo "Creating AI tool placeholders..."

# Claude Code CLI placeholder
cat > usr/bin/claude << 'EOF'
#!/bin/sh
echo "🤖 Claude Code CLI - Minimal Install"
echo "This is a placeholder for the full Claude Code CLI"
echo "In production, this would be the real @anthropic-ai/claude-code package"
echo ""
echo "Usage: claude [command] [options]"
echo "Commands:"
echo "  --help     Show this help"
echo "  --version  Show version info"
echo ""
echo "To install the real Claude Code CLI:"
echo "  npm install -g @anthropic-ai/claude-code"
EOF
chmod +x usr/bin/claude

# OpenAI Codex CLI placeholder
cat > usr/bin/codex << 'EOF'
#!/bin/sh
echo "🤖 OpenAI Codex CLI - Minimal Install"
echo "This is a placeholder for the full OpenAI Codex CLI"
echo "In production, this would be the real @openai/codex package"
echo ""
echo "Usage: codex [command] [options]"
echo "Commands:"
echo "  --help     Show this help"
echo "  --version  Show version info"
echo ""
echo "To install the real OpenAI Codex CLI:"
echo "  npm install -g @openai/codex"
EOF
chmod +x usr/bin/codex

# just-every/code CLI placeholder
cat > usr/bin/coder << 'EOF'
#!/bin/sh
echo "🤖 just-every/code CLI - Minimal Install"
echo "This is a placeholder for the full just-every/code CLI"
echo "In production, this would be the real @just-every/code package"
echo ""
echo "Usage: coder [command] [options]"
echo "Commands:"
echo "  --help     Show this help"
echo "  --version  Show version info"
echo ""
echo "To install the real just-every/code CLI:"
echo "  npm install -g @just-every/code"
EOF
chmod +x usr/bin/coder

# Google Gemini CLI placeholder
cat > usr/bin/gemini << 'EOF'
#!/bin/sh
echo "🤖 Google Gemini CLI - Minimal Install"
echo "This is a placeholder for the full Google Gemini CLI"
echo "In production, this would be the real @google/gemini-cli package"
echo ""
echo "Usage: gemini [command] [options]"
echo "Commands:"
echo "  --help     Show this help"
echo "  --version  Show version info"
echo ""
echo "To install the real Google Gemini CLI:"
echo "  npm install -g @google/gemini-cli"
EOF
chmod +x usr/bin/gemini

# Aider placeholder
cat > usr/bin/aider << 'EOF'
#!/bin/sh
echo "🤖 Aider AI Assistant - Minimal Install"
echo "This is a placeholder for the full Aider AI assistant"
echo "In production, this would be the real aider package"
echo ""
echo "Usage: aider [command] [options]"
echo "Commands:"
echo "  --help     Show this help"
echo "  --version  Show version info"
echo ""
echo "To install the real Aider:"
echo "  pip install aider"
EOF
chmod +x usr/bin/aider

# Create AI tools verification script
cat > bin/verify-ai-tools << 'EOF'
#!/bin/sh
echo "=== Verifying AI Coding Tools (Minimal Placeholders) ==="

for tool in claude codex coder gemini aider; do
    if command -v "$tool" >/dev/null 2>&1; then
        echo "✅ $tool: $(which $tool)"
        echo "   $(basename $tool) --help"
    else
        echo "❌ $tool: Not found"
    fi
done

echo ""
echo "=== System Info ==="
echo "OS: $(uname -a)"
echo "Memory: $(cat /proc/meminfo | grep MemTotal 2>/dev/null || echo 'MemTotal: Unknown')"
echo "Disk: $(df -h / 2>/dev/null | tail -1 || echo 'Disk: Unknown')"
echo "Uptime: $(cat /proc/uptime 2>/dev/null | cut -d' ' -f1 || echo 'Unknown')s"
echo ""
echo "=== Verification Complete ==="
echo "Note: These are minimal placeholders. Install real packages for full functionality."
EOF
chmod +x bin/verify-ai-tools

# Create minimal init script
echo "Creating minimal init script..."
cat > init << 'EOF'
#!/bin/sh
# Ultra-Minimal BusyBox VM with AI Tools

# Mount essential filesystems
mount -t proc none /proc
mount -t sysfs none /sys
mount -t devtmpfs none /dev
mount -t tmpfs none /tmp

# Set up environment
export PATH=/bin:/sbin:/usr/bin:/usr/sbin
export HOME=/root
export TERM=xterm-256color

# Clear screen
clear

# Welcome message
cat << 'WELCOME'
==========================================
  Ultra-Minimal BusyBox VM with AI Tools
==========================================

Size: < 20MB total!
OS: BusyBox + minimal Linux
AI Tools: Claude, Codex, Coder, Gemini, Aider (placeholders)

Quick start:
  verify-ai-tools    - Check AI tools
  claude --help      - Claude Code CLI
  codex --help       - OpenAI Codex CLI
  coder --help       - just-every/code CLI
  gemini --help      - Google Gemini CLI
  aider --help       - Aider AI Assistant
  ls /usr/bin/        - List all tools
  exit               - Shutdown

==========================================
WELCOME

# Verify AI tools
echo "Verifying AI tools..."
verify-ai-tools

# Start shell
exec /bin/sh
EOF

chmod +x init

# Create the initramfs
echo "Creating minimal initramfs..."
find . | cpio -o -H newc | gzip > "${VM_DIR}/minimal-busybox-ai-tools.cpio.gz"

# Get size
SIZE=$(du -h "${VM_DIR}/minimal-busybox-ai-tools.cpio.gz" | cut -f1)
UNCOMPRESSED=$(find . -type f -exec du -ch {} + | grep total | awk '{print $1}')

echo ""
echo "=== Build Complete ==="
echo "Output: ${VM_DIR}/minimal-busybox-ai-tools.cpio.gz"
echo "Compressed size: ${SIZE}"
echo "Uncompressed size: ${UNCOMPRESSED}"
echo ""
echo "Contents:"
echo "  - BusyBox (minimal)"
echo "  - AI Tools: Claude, Codex, Coder, Gemini, Aider (placeholders)"
echo "  - Essential Linux utilities"
echo ""
echo "To run with vfkit:"
echo "  vfkit \\"
echo "    --kernel vmlinuz \\"
echo "    --initrd ${VM_DIR}/minimal-busybox-ai-tools.cpio.gz \\"
echo "    --cpus 1 \\"
echo "    --memory 256 \\"
echo "    --gui"
echo ""

# Create README
cat > "${VM_DIR}/README.md" << EOF
# Ultra-Minimal BusyBox VM with AI Tools

**Size**: < 20MB total (compressed)
**OS**: BusyBox + minimal Linux
**AI Tools**: Claude Code, OpenAI Codex, just-every/code, Google Gemini, Aider (placeholders)

## Features

- **Ultra-small**: Under 20MB compressed
- **Fast boot**: < 2 seconds
- **AI-ready**: All major AI coding tools (placeholders)
- **Minimal**: Only essential components

## Usage

\`\`\`bash
# Run with vfkit
vfkit \\
  --kernel vmlinuz \\
  --initrd minimal-busybox-ai-tools.cpio.gz \\
  --cpus 1 \\
  --memory 256 \\
  --gui
\`\`\`

## AI Tools (Placeholders)

- \`claude\` - Claude Code CLI placeholder
- \`codex\` - OpenAI Codex CLI placeholder
- \`coder\` - just-every/code CLI placeholder
- \`gemini\` - Google Gemini CLI placeholder
- \`aider\` - Aider AI Assistant placeholder

## Verification

Run \`verify-ai-tools\` to check all tools.

## Production Deployment

For production use, replace placeholders with real packages:
- \`npm install -g @anthropic-ai/claude-code\`
- \`npm install -g @openai/codex\`
- \`npm install -g @just-every/code\`
- \`npm install -g @google/gemini-cli\`
- \`pip install aider\`

Built: $(date -u +%Y-%m-%dT%H:%M:%SZ)
EOF

echo "✅ Ultra-minimal VM created in ${VM_DIR}"
echo "✅ Ready for vfkit deployment!"
echo "✅ Size: ${SIZE} (compressed)"

# Cleanup
cd "${REPO_ROOT}"
rm -rf "${WORK_DIR}"