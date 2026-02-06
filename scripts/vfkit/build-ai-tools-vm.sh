#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

# VibeCode vfkit AI Tools VM Builder
# Creates a vfkit VM with all AI coding tools installed

# Initialize log aggregation
init_log_aggregation


set -e

# Configuration
VM_NAME="vibecode-ai-tools"
VM_DIR="$HOME/.vfkit/vms/$VM_NAME"
ARCH="aarch64"
MEMORY="4096"  # 4GB
CPUS="4"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Building VibeCode vfkit AI Tools VM${NC}"
echo "================================================"

# Create VM directory
mkdir -p "$VM_DIR"

# Download Ubuntu 24.04 Server Cloud Image
echo -e "${YELLOW}📥 Downloading Ubuntu 24.04 Server Cloud Image...${NC}"
cd "$VM_DIR"
if [ ! -f "ubuntu-24.04-server-cloudimg-arm64.img" ]; then
    wget -O ubuntu-24.04-server-cloudimg-arm64.img \
        "https://cloud-images.ubuntu.com/releases/24.04/release/ubuntu-24.04-server-cloudimg-arm64.img"
else
    echo "Ubuntu image already exists, skipping download"
fi

# Create cloud-init user data
echo -e "${YELLOW}⚙️  Creating cloud-init configuration...${NC}"
cat > user-data << 'EOF'
#cloud-config
users:
  - name: studio
    groups: sudo
    shell: /bin/bash
    sudo: ['ALL=(ALL) NOPASSWD:ALL']
    ssh_authorized_keys:
      - ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQC7... # Add your SSH key here

package_update: true
package_upgrade: true

packages:
  - curl
  - wget
  - git
  - unzip
  - python3
  - python3-pip
  - nodejs
  - npm
  - build-essential

runcmd:
  # Install Node.js AI tools globally
  - npm install -g @anthropic-ai/claude-code
  - npm install -g @openai/codex
  - npm install -g @just-every/code
  - npm install -g @google/gemini-cli
  
  # Install Python AI tools
  - pip3 install aider
  
  # Install OpenCode
  - curl -fsSL https://opencode.ai/install | bash
  
  # Install Tailscale
  - curl -fsSL https://tailscale.com/install.sh | sh
  
  # Create verification script
  - cat > /usr/local/bin/verify-ai-tools << 'SCRIPT_EOF'
#!/bin/bash
echo "🤖 AI Coding Tools Verification"
echo "================================"
echo "📦 Checking Node.js AI Tools..."
if command -v claude &> /dev/null; then
    echo "✅ Claude Code CLI: $(claude --version 2>/dev/null || echo 'installed')"
else
    echo "❌ Claude Code CLI: not found"
fi

if command -v codex &> /dev/null; then
    echo "✅ OpenAI Codex CLI: $(codex --version 2>/dev/null || echo 'installed')"
else
    echo "❌ OpenAI Codex CLI: not found"
fi

if command -v coder &> /dev/null; then
    echo "✅ just-every/code (Coder) CLI: $(coder --version 2>/dev/null || echo 'installed')"
else
    echo "❌ just-every/code (Coder) CLI: not found"
fi

if command -v gemini &> /dev/null; then
    echo "✅ Google Gemini CLI: $(gemini --version 2>/dev/null || echo 'installed')"
else
    echo "❌ Google Gemini CLI: not found"
fi

echo ""
echo "🐍 Checking Python AI Tools..."
if command -v aider &> /dev/null; then
    echo "✅ Aider: $(aider --version 2>/dev/null || echo 'installed')"
else
    echo "❌ Aider: not found"
fi

echo ""
echo "🔧 Checking OpenCode..."
if command -v opencode &> /dev/null; then
    echo "✅ OpenCode: $(opencode --version 2>/dev/null || echo 'installed')"
else
    echo "❌ OpenCode: not found"
fi

echo ""
echo "Environment Variables (API Keys):"
echo "ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY:+Set}"
echo "OPENAI_API_KEY: ${OPENAI_API_KEY:+Set}"
echo "GOOGLE_API_KEY: ${GOOGLE_API_KEY:+Set}"
echo "OPENCODE_API_KEY: ${OPENCODE_API_KEY:+Set}"
SCRIPT_EOF
  
  - chmod +x /usr/local/bin/verify-ai-tools
  
  # Set up environment variables
  - echo 'export ANTHROPIC_API_KEY=""' >> /home/studio/.bashrc
  - echo 'export OPENAI_API_KEY=""' >> /home/studio/.bashrc
  - echo 'export GOOGLE_API_KEY=""' >> /home/studio/.bashrc
  - echo 'export OPENCODE_API_KEY=""' >> /home/studio/.bashrc
  - echo 'export PATH=$HOME/.opencode/bin:$PATH' >> /home/studio/.bashrc

final_message: "VibeCode AI Tools VM setup complete! Run 'verify-ai-tools' to check installation."
EOF

# Create meta-data
cat > meta-data << 'EOF'
instance-id: vibecode-ai-tools
local-hostname: vibecode-ai-tools
EOF

# Create cloud-init ISO
echo -e "${YELLOW}📦 Creating cloud-init ISO...${NC}"
cloud-localds cloud-init.iso user-data meta-data

# Create VM launch script
echo -e "${YELLOW}🚀 Creating VM launch script...${NC}"
cat > launch-vm.sh << 'EOF'
#!/bin/bash
# Launch VibeCode AI Tools VM

VM_DIR="$HOME/.vfkit/vms/vibecode-ai-tools"

echo "🚀 Starting VibeCode AI Tools VM..."
echo "VM will be accessible via SSH once booted"
echo ""

vfkit \
  --device "disk,path=$VM_DIR/ubuntu-24.04-server-cloudimg-arm64.img" \
  --device "disk,path=$VM_DIR/cloud-init.iso" \
  --cpus 4 \
  --memory 4096 \
  --device "virtio-net,nat,mac=52:54:00:12:34:57" \
  --device "virtio-serial,logFilePath=$VM_DIR/console.log" \
  --device "virtio-rng" \
  --device "virtio-vsock,port=1024,socketURL=unix://$VM_DIR/vsock.sock" \
  --gui
EOF

chmod +x launch-vm.sh

# Create verification script
echo -e "${YELLOW}✅ Creating verification script...${NC}"
cat > verify-installation.sh << 'EOF'
#!/bin/bash
# Verify AI tools installation in vfkit VM

echo "🔍 Verifying AI Tools Installation"
echo "=================================="

# Check if VM is running
if pgrep -f "vibecode-ai-tools" > /dev/null; then
    echo "✅ VM is running"
    
    # Check console log
    if [ -f "$HOME/.vfkit/vms/vibecode-ai-tools/console.log" ]; then
        echo "📋 Console log available"
        echo "Last 10 lines:"
        tail -10 "$HOME/.vfkit/vms/vibecode-ai-tools/console.log"
    fi
    
    # Check vsock connection
    if [ -f "$HOME/.vfkit/vms/vibecode-ai-tools/vsock.sock" ]; then
        echo "🔌 VSock available for communication"
    fi
    
else
    echo "❌ VM is not running"
    echo "Run: $HOME/.vfkit/vms/vibecode-ai-tools/launch-vm.sh"
fi

echo ""
echo "🎯 Next Steps:"
echo "1. Start VM: $HOME/.vfkit/vms/vibecode-ai-tools/launch-vm.sh"
echo "2. Wait for boot completion"
echo "3. SSH into VM (check console log for IP)"
echo "4. Run: verify-ai-tools"
EOF

chmod +x verify-installation.sh

echo -e "${GREEN}✅ VibeCode vfkit AI Tools VM built successfully!${NC}"
echo ""
echo "📁 VM Location: $VM_DIR"
echo "🚀 Launch VM: $VM_DIR/launch-vm.sh"
echo "🔍 Verify: $VM_DIR/verify-installation.sh"
echo ""
echo "🎯 Features:"
echo "  ✅ All 6 AI coding tools (Claude, Codex, Coder, Gemini, OpenCode, Aider)"
echo "  ✅ Ubuntu 24.04 Server"
echo "  ✅ Tailscale ready"
echo "  ✅ 4 CPU cores, 4GB RAM"
echo "  ✅ Cloud-init configuration"
echo ""
echo "🚀 Ready for apples-to-apples comparison with Lima VM!"
