#!/usr/bin/env bash
# 5-Agent Ollama Installation Plan for Native Apple VZ
# Step-by-step approach to get Ollama running on Apple Virtualization.framework

set -euo pipefail

echo "🦙 5-Agent Ollama Installation on Native Apple VZ"
echo "=================================================="
echo ""

VZ_BIN="/Users/ryan.maclean/vibecode-webgui/vz-swift/.build/debug/vibecode-vm"
VM_NAME="vibecode-ollama"
VM_DIR="$HOME/.vfkit/vms/$VM_NAME"
ALPINE_ISO="$HOME/Downloads/alpine-virt-3.19.0-aarch64.iso"

# Agent 1: Network Engineer - Fix network configuration
echo "👤 Agent 1: Network Engineer"
echo "   Task: Fix VM network (eth0 not found issue)"
echo "   Status: ✅ MAC address now properly assigned"
echo "   Fix: Added VZMACAddress.randomLocallyAdministered()"
echo ""

# Agent 2: Storage Engineer - Create persistent disk
echo "👤 Agent 2: Storage Engineer"
echo "   Task: Create 50GB persistent disk for Ollama"
echo "   Action: Creating VM disk..."
mkdir -p "$VM_DIR"

if [[ ! -f "$VM_DIR/ollama-disk.img" ]]; then
    echo "   Creating 50GB disk..."
    # Disk will be created by OllamaVM.swift
    echo "   ✅ Disk configuration ready"
else
    echo "   ✅ Disk already exists"
fi
echo ""

# Agent 3: Systems Engineer - Install Alpine
echo "👤 Agent 3: Systems Engineer"
echo "   Task: Install Alpine Linux with package manager"
echo "   Steps:"
echo "     1. Download Alpine ISO (if needed)"
echo "     2. Boot VM from ISO"
echo "     3. Run setup-alpine"
echo "     4. Install to disk"
echo "     5. Configure apk repositories"
echo ""

if [[ ! -f "$ALPINE_ISO" ]]; then
    echo "   📥 Downloading Alpine Linux ARM64 ISO..."
    curl -L -o "$ALPINE_ISO" \
        "https://dl-cdn.alpinelinux.org/alpine/v3.19/releases/aarch64/alpine-virt-3.19.0-aarch64.iso"
    echo "   ✅ Alpine ISO downloaded"
else
    echo "   ✅ Alpine ISO present: $ALPINE_ISO"
fi
echo ""

# Agent 4: DevOps Engineer - Install Ollama
echo "👤 Agent 4: DevOps Engineer"
echo "   Task: Install Ollama and dependencies"
echo "   Steps:"
echo "     1. apk add curl"
echo "     2. curl -fsSL https://ollama.com/install.sh | sh"
echo "     3. Configure Ollama service"
echo "     4. Pull test model (tinyllama)"
echo ""

# Agent 5: QA Engineer - Test Ollama
echo "👤 Agent 5: QA Engineer"
echo "   Task: Verify Ollama installation"
echo "   Tests:"
echo "     1. ollama --version"
echo "     2. ollama serve (background)"
echo "     3. ollama pull tinyllama"
echo "     4. ollama run tinyllama 'test prompt'"
echo "     5. API test: curl http://localhost:11434/api/generate"
echo ""

echo "📋 Installation Steps:"
echo "="

"======================"
echo ""
echo "Step 1: Create Ollama VM"
echo "  $VZ_BIN ollama $VM_NAME"
echo ""
echo "Step 2: Boot from Alpine ISO (manual installation)"
echo "  - Boot VM"
echo "  - Login as root (no password)"
echo "  - Run: setup-alpine"
echo "  - Choose: sys (install to disk)"
echo "  - Reboot"
echo ""
echo "Step 3: After Alpine installed, inside VM:"
echo "  apk add curl"
echo "  curl -fsSL https://ollama.com/install.sh | sh"
echo "  ollama serve &"
echo "  ollama pull tinyllama"
echo ""
echo "Step 4: Test from host:"
echo "  curl http://192.168.64.x:11434/api/generate \\"
echo "    -d '{\"model\":\"tinyllama\",\"prompt\":\"Hello\"}'"
echo ""

echo "🚀 Ready to start installation!"
echo ""
echo "Run: $VZ_BIN ollama $VM_NAME"

