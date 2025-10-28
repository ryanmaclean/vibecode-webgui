# GenAI VM Setup with Tailscale

This document describes how to set up and access a dedicated GenAI development VM using Lima (macOS virtualization) and Tailscale for secure remote access.

## 🎯 Overview

We've created an **isolated GenAI VM** that provides:
- **Secure remote access** via Tailscale
- **All major AI coding tools** pre-installed
- **Lightweight virtualization** using Lima (no Docker Desktop needed)
- **Cross-platform access** from any device on your Tailscale network

## 🚀 VM Details

- **Name**: `vibecode-minimal`
- **OS**: Ubuntu 25.04 ARM64
- **Resources**: 4 CPU, 4GB RAM, 100GB disk
- **Tailscale IP**: `100.81.117.81`
- **Hostname**: `lima-vibecode-minimal`

## 🛠️ Installed AI Tools

All major AI coding tools are pre-installed and ready to use:

- ✅ **Claude Code CLI** (`claude`) - v2.0.26
- ✅ **OpenAI Codex CLI** (`codex`) - v0.48.0  
- ✅ **just-every/code** (`coder`) - v0.2.188
- ✅ **Google Gemini CLI** (`gemini`) - v0.10.0
- ✅ **OpenCode** (`opencode`) - v0.15.16
- ✅ **Aider** (`aider`) - v0.2.6 (Python AI assistant)

### Additional Tools
- **Node.js**: v20.19.5
- **Python**: v3.13.3
- **Git**: Latest version
- **Build tools**: GCC, Make, etc.

## 🔗 Access Methods

### 1. Local Lima Access (Primary)
```bash
# Access the VM locally
limactl shell vibecode-minimal

# Check VM status
limactl list

# Start/stop VM
limactl start vibecode-minimal
limactl stop vibecode-minimal
```

### 2. Tailscale Remote Access
```bash
# SSH access from any device on your Tailscale network
ssh studio@100.81.117.81

# Note: SSH keys need to be set up for passwordless access
# Currently requires Lima access to set up SSH keys
```

### 3. From snas.local
The VM is accessible from snas.local via Tailscale IP `100.81.117.81`.

## 🧪 Testing AI Tools

Once connected to the VM, test all AI tools:

```bash
# Test Claude Code CLI
claude --version
claude --help

# Test OpenAI Codex CLI  
codex --version
codex --help

# Test just-every/code CLI
coder --version
coder --help

# Test Google Gemini CLI
gemini --version
gemini --help

# Test OpenCode
opencode --version
opencode --help

# Test Aider (Python AI assistant)
~/ai-tools/bin/python3 -m aider --version
```

## 🔧 VM Management

### Starting the VM
```bash
limactl start vibecode-minimal
```

### Stopping the VM
```bash
limactl stop vibecode-minimal
```

### Checking Status
```bash
# List all Lima VMs
limactl list

# Check Tailscale status in VM
limactl shell vibecode-minimal -- tailscale status
limactl shell vibecode-minimal -- tailscale ip
```

### Updating AI Tools
```bash
# Update Node.js AI tools
limactl shell vibecode-minimal -- sudo npm update -g @anthropic-ai/claude-code @openai/codex @just-every/code @google/gemini-cli

# Update Python AI tools
limactl shell vibecode-minimal -- ~/ai-tools/bin/pip install --upgrade aider
```

## 🌐 Tailscale Configuration

The VM is connected to your Tailscale network with:
- **Tailscale IP**: `100.81.117.81`
- **IPv6**: `fd7a:115c:a1e0::b01:756b`
- **Hostname**: `lima-vibecode-minimal`

### Tailscale Commands in VM
```bash
# Check Tailscale status
tailscale status

# Get Tailscale IP
tailscale ip

# Disconnect from Tailscale
sudo tailscale down

# Reconnect to Tailscale
sudo tailscale up
```

## 💡 Use Cases

This isolated GenAI VM is perfect for:

1. **Secure AI Development**: Work with AI tools without affecting your main system
2. **Cross-Platform Access**: Access from macOS, Windows, Linux, mobile devices
3. **Team Collaboration**: Share VM access via Tailscale
4. **Testing AI Tools**: Safe environment to test new AI coding assistants
5. **Remote Development**: Code from anywhere with full AI tool access
6. **Isolated Environment**: Keep AI tools separate from your main development setup

## 🔒 Security Benefits

- **Network Isolation**: VM runs in isolated Lima environment
- **Secure Access**: Tailscale provides encrypted, authenticated access
- **No Docker Desktop**: Avoids Docker Desktop security and stability issues
- **Minimal Attack Surface**: Only essential tools installed
- **Easy Cleanup**: Can be destroyed and recreated easily

## 📊 Resource Usage

Compared to Docker Desktop:
- **Lower Memory Usage**: ~4GB vs Docker Desktop's 8GB+
- **Faster Boot**: Lima VMs boot in seconds
- **Better Stability**: No Docker Desktop crashes
- **Native Performance**: Uses Apple's Virtualization.framework

## 🚨 Troubleshooting

### VM Won't Start
```bash
# Check Lima status
limactl list

# Restart Lima service
limactl stop vibecode-minimal
limactl start vibecode-minimal
```

### Tailscale Connection Issues
```bash
# Check Tailscale status in VM
limactl shell vibecode-minimal -- tailscale status

# Restart Tailscale in VM
limactl shell vibecode-minimal -- sudo systemctl restart tailscaled
```

### AI Tools Not Working
```bash
# Check tool installation
limactl shell vibecode-minimal -- which claude codex coder gemini

# Reinstall if needed
limactl shell vibecode-minimal -- sudo npm install -g @anthropic-ai/claude-code @openai/codex @just-every/code @google/gemini-cli
```

## 📝 Notes

- **VM Location**: `~/.lima/vibecode-minimal/`
- **Tailscale Auth**: VM is authenticated with your Tailscale account
- **Updates**: VM can be updated independently of host system
- **Backup**: VM state is preserved between restarts
- **Scaling**: Can increase CPU/memory if needed

## 🎉 Success!

Your GenAI VM is ready! Access it via:
- **Local**: `limactl shell vibecode-minimal`
- **Remote**: `ssh studio@100.81.117.81` (after SSH setup)
- **Tailscale IP**: `100.81.117.81`

This setup provides a secure, isolated environment for AI development with all major coding assistants ready to use!
