# Platform-Specific Prerequisites Guide

Complete installation guide for all VibeCode dependencies across macOS, Linux, and Windows.

## Overview

VibeCode requires different dependencies depending on your deployment mode. This guide covers installation for all supported platforms.

**Time to complete:** 15-30 minutes depending on your platform and chosen deployment mode.

---

## Quick Reference

### Core Dependencies (All Modes)

| Tool | Version | macOS | Linux | Windows |
|------|---------|-------|-------|---------|
| **Git** | Any recent | ✅ Pre-installed | ✅ Usually installed | ⚠️ Install required |
| **Node.js** | v18.0.0+ (v22.15.1+ recommended) | 🍺 Homebrew/nvm | 📦 nvm/apt | 🪟 nvm-windows/Chocolatey |
| **npm** | v10.9.4+ | ✅ Comes with Node | ✅ Comes with Node | ✅ Comes with Node |

### Mode-Specific Dependencies

| Tool | Docker Compose | KIND K8s | Tauri Desktop | Apple Virtualization |
|------|----------------|----------|---------------|---------------------|
| **Docker** | Required (20.10+) | Required (20.10+) | Optional | Optional |
| **Docker Compose** | Required (V2) | Required (V2) | Optional | Optional |
| **kubectl** | Optional | Required | Optional | Optional |
| **KIND** | Optional | Required | Optional | Optional |
| **Rust** | Optional | Optional | Required (1.90.0+) | Required (1.90.0+) |
| **Swift** | Optional | Optional | Optional | Required (5.0+) |
| **Xcode Tools** | Optional | N/A | Required (macOS) | Required (macOS) |

---

## macOS Installation

### 🍎 Prerequisites for macOS

Recommended for macOS 10.13 (High Sierra) or later. Apple Silicon (M1/M2/M3) and Intel both supported.

---

### 1. Install Homebrew (Package Manager)

**Recommended** for managing dependencies on macOS.

```bash
# Install Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Follow the post-installation instructions to add Homebrew to PATH

# Verify installation
brew --version
```

---

### 2. Install Git

```bash
# Usually pre-installed on macOS, verify first:
git --version

# If not installed, install via Homebrew:
brew install git

# Or install Xcode Command Line Tools (includes Git):
xcode-select --install

# Verify installation
git --version
```

---

### 3. Install Node.js and npm

#### Option A: Using nvm (Recommended)

```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Reload shell configuration
source ~/.zshrc  # or ~/.bash_profile for bash

# Install Node.js 22 LTS
nvm install 22
nvm use 22
nvm alias default 22

# Verify installation
node --version   # Should show v22.15.1 or later
npm --version    # Should show v10.9.4 or later
```

#### Option B: Using Homebrew

```bash
# Install Node.js
brew install node@22

# Add to PATH
echo 'export PATH="/opt/homebrew/opt/node@22/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc

# Verify installation
node --version
npm --version
```

---

### 4. Install Docker Desktop (for Docker Compose & KIND)

**Required for:** Docker Compose mode, KIND Kubernetes mode

```bash
# Using Homebrew Cask
brew install --cask docker

# Or download manually from:
# https://www.docker.com/products/docker-desktop

# Start Docker Desktop from Applications folder

# Verify installation
docker --version          # Should show 20.10.0 or later
docker-compose --version  # Should show V2 (e.g., v2.20.0)

# Test Docker
docker run hello-world
```

#### Docker Desktop Configuration (Apple Silicon)

```bash
# For M1/M2/M3 Macs, enable Rosetta 2 for x86_64 compatibility (optional)
# Docker Desktop → Settings → Features in Development
# ✓ Use Rosetta for x86/amd64 emulation

# Recommended settings:
# - Memory: 8 GB minimum (16 GB recommended)
# - CPUs: 4 minimum (8 recommended)
# - Disk: 50 GB minimum
```

---

### 5. Install kubectl (for KIND Kubernetes)

**Required for:** KIND Kubernetes mode

```bash
# Using Homebrew
brew install kubectl

# Verify installation
kubectl version --client

# Expected output:
# Client Version: v1.28.0 or later
```

---

### 6. Install KIND (for KIND Kubernetes)

**Required for:** KIND Kubernetes mode

```bash
# Using Homebrew
brew install kind

# Verify installation
kind version

# Expected output:
# kind v0.20.0 or later
```

---

### 7. Install Rust (for Tauri Desktop & Apple Virtualization)

**Required for:** Tauri Desktop mode, Apple Virtualization mode

```bash
# Install Rust via rustup
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Follow prompts, select default installation

# Reload shell
source ~/.cargo/env

# Verify installation
rustc --version   # Should show 1.90.0 or later
cargo --version

# Update Rust (if already installed)
rustup update
```

---

### 8. Install Xcode Command Line Tools (for Tauri & Apple Virtualization)

**Required for:** Tauri Desktop mode, Apple Virtualization mode (macOS)

```bash
# Install Xcode Command Line Tools
xcode-select --install

# Accept license agreement
sudo xcodebuild -license accept

# Verify installation
xcode-select -p

# Expected output:
# /Library/Developer/CommandLineTools
```

---

### 9. Install Swift (for Apple Virtualization)

**Required for:** Apple Virtualization mode

```bash
# Swift comes with Xcode Command Line Tools
swift --version

# Expected output:
# Apple Swift version 5.x or later

# If not installed, install Xcode Command Line Tools:
xcode-select --install
```

---

### macOS Verification Checklist

Run these commands to verify your installation:

```bash
# Core dependencies
git --version
node --version       # v22.15.1+
npm --version        # v10.9.4+

# Docker mode dependencies
docker --version     # 20.10.0+
docker-compose --version  # v2.x

# KIND mode dependencies
kubectl version --client
kind version

# Tauri mode dependencies
rustc --version      # 1.90.0+
cargo --version
xcode-select -p

# Apple Virtualization mode dependencies
swift --version      # 5.0+
```

---

## Linux Installation

### 🐧 Prerequisites for Linux

Tested on Ubuntu 20.04+, Debian 11+, Fedora 35+, Arch Linux. Most commands shown for Ubuntu/Debian.

---

### 1. Update Package Manager

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get upgrade -y

# Fedora/RHEL
sudo dnf update -y

# Arch Linux
sudo pacman -Syu
```

---

### 2. Install Git

```bash
# Ubuntu/Debian
sudo apt-get install -y git

# Fedora/RHEL
sudo dnf install -y git

# Arch Linux
sudo pacman -S git

# Verify installation
git --version
```

---

### 3. Install Node.js and npm

#### Option A: Using nvm (Recommended)

```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Reload shell configuration
source ~/.bashrc  # or ~/.zshrc for zsh

# Install Node.js 22 LTS
nvm install 22
nvm use 22
nvm alias default 22

# Verify installation
node --version   # Should show v22.15.1 or later
npm --version    # Should show v10.9.4 or later
```

#### Option B: Using Package Manager

```bash
# Ubuntu/Debian - Install Node.js 22.x
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Fedora/RHEL
curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
sudo dnf install -y nodejs

# Arch Linux
sudo pacman -S nodejs npm

# Verify installation
node --version
npm --version
```

---

### 4. Install Docker (for Docker Compose & KIND)

**Required for:** Docker Compose mode, KIND Kubernetes mode

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release

# Add Docker's official GPG key
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Set up Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Fedora/RHEL
sudo dnf install -y dnf-plugins-core
sudo dnf config-manager --add-repo https://download.docker.com/linux/fedora/docker-ce.repo
sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Arch Linux
sudo pacman -S docker docker-compose

# Start and enable Docker
sudo systemctl start docker
sudo systemctl enable docker

# Add user to docker group (avoid using sudo)
sudo usermod -aG docker $USER
newgrp docker

# Verify installation
docker --version          # Should show 20.10.0 or later
docker compose version    # Should show v2.x (note: no hyphen in 'compose')

# Test Docker
docker run hello-world
```

---

### 5. Install kubectl (for KIND Kubernetes)

**Required for:** KIND Kubernetes mode

```bash
# Download latest stable release
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"

# Make executable
chmod +x kubectl

# Move to PATH
sudo mv kubectl /usr/local/bin/

# Verify installation
kubectl version --client

# Expected output:
# Client Version: v1.28.0 or later
```

---

### 6. Install KIND (for KIND Kubernetes)

**Required for:** KIND Kubernetes mode

```bash
# Download KIND binary
curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.20.0/kind-linux-amd64

# Make executable
chmod +x ./kind

# Move to PATH
sudo mv ./kind /usr/local/bin/kind

# Verify installation
kind version

# Expected output:
# kind v0.20.0 or later
```

---

### 7. Install Rust (for Tauri Desktop)

**Required for:** Tauri Desktop mode

```bash
# Install build dependencies first
# Ubuntu/Debian
sudo apt-get install -y \
    build-essential \
    libssl-dev \
    pkg-config \
    libwebkit2gtk-4.0-dev \
    libgtk-3-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev

# Fedora/RHEL
sudo dnf groupinstall -y "Development Tools"
sudo dnf install -y \
    openssl-devel \
    webkit2gtk4.0-devel \
    gtk3-devel \
    libappindicator-gtk3-devel \
    librsvg2-devel

# Arch Linux
sudo pacman -S \
    base-devel \
    webkit2gtk \
    gtk3 \
    libappindicator-gtk3 \
    librsvg

# Install Rust via rustup
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Follow prompts, select default installation

# Reload shell
source ~/.cargo/env

# Verify installation
rustc --version   # Should show 1.90.0 or later
cargo --version
```

---

### Linux Verification Checklist

Run these commands to verify your installation:

```bash
# Core dependencies
git --version
node --version       # v22.15.1+ or v18.0.0+
npm --version        # v10.9.4+

# Docker mode dependencies
docker --version     # 20.10.0+
docker compose version  # v2.x

# KIND mode dependencies
kubectl version --client
kind version

# Tauri mode dependencies
rustc --version      # 1.90.0+
cargo --version
```

---

## Windows Installation

### 🪟 Prerequisites for Windows

Recommended for Windows 10 (build 19041+) or Windows 11. **WSL2 strongly recommended** for best compatibility.

---

### 1. Enable WSL2 (Windows Subsystem for Linux)

**Highly Recommended** for running VibeCode on Windows.

```powershell
# Open PowerShell as Administrator

# Enable WSL
wsl --install

# Set WSL 2 as default version
wsl --set-default-version 2

# Install Ubuntu (recommended distribution)
wsl --install -d Ubuntu

# Restart your computer when prompted
```

After restart, launch Ubuntu from Start Menu and create a user account.

**For the rest of the Windows setup, you can follow the Linux instructions inside WSL2.**

---

### 2. Install Git

#### Native Windows (PowerShell as Administrator)

```powershell
# Using Chocolatey
choco install git -y

# Or download Git for Windows:
# https://git-scm.com/download/win

# Verify installation (restart PowerShell first)
git --version
```

#### WSL2 (Inside Ubuntu)

```bash
# Follow Linux instructions
sudo apt-get update
sudo apt-get install -y git
git --version
```

---

### 3. Install Node.js and npm

#### Native Windows (PowerShell as Administrator)

```powershell
# Option A: Using nvm-windows
# Download and install from: https://github.com/coreybutler/nvm-windows/releases
# After installation, restart PowerShell

nvm install 22
nvm use 22

# Option B: Using Chocolatey
choco install nodejs-lts -y

# Option C: Download installer
# https://nodejs.org/en/download/

# Verify installation (restart PowerShell first)
node --version
npm --version
```

#### WSL2 (Inside Ubuntu) - Recommended

```bash
# Follow Linux nvm instructions
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc

nvm install 22
nvm use 22
nvm alias default 22

node --version
npm --version
```

---

### 4. Install Docker Desktop (for Docker Compose & KIND)

**Required for:** Docker Compose mode, KIND Kubernetes mode

```powershell
# Prerequisites:
# - WSL2 must be installed and enabled
# - Hyper-V must be enabled in BIOS

# Download Docker Desktop for Windows:
# https://www.docker.com/products/docker-desktop

# Install and follow setup wizard
# ✓ Use WSL 2 instead of Hyper-V (recommended)
# ✓ Enable WSL 2 integration with Ubuntu

# After installation, restart computer

# Verify installation (PowerShell)
docker --version
docker-compose --version  # Or: docker compose version

# Test Docker
docker run hello-world
```

#### Docker Desktop Configuration (Windows)

```
Settings → Resources → WSL Integration
✓ Enable integration with my default WSL distro
✓ Enable integration with additional distros: Ubuntu

Settings → Resources
- Memory: 8 GB minimum (16 GB recommended)
- CPUs: 4 minimum (8 recommended)
- Disk: 50 GB minimum
```

---

### 5. Install kubectl (for KIND Kubernetes)

**Required for:** KIND Kubernetes mode

#### Native Windows (PowerShell as Administrator)

```powershell
# Using Chocolatey
choco install kubernetes-cli -y

# Or download manually
curl.exe -LO "https://dl.k8s.io/release/v1.28.0/bin/windows/amd64/kubectl.exe"

# Add to PATH (if manual install)
$env:Path += ";C:\kubectl"
[Environment]::SetEnvironmentVariable("Path", $env:Path, [System.EnvironmentVariableTarget]::User)

# Verify installation (restart PowerShell first)
kubectl version --client
```

#### WSL2 (Inside Ubuntu) - Recommended

```bash
# Follow Linux instructions
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
chmod +x kubectl
sudo mv kubectl /usr/local/bin/

kubectl version --client
```

---

### 6. Install KIND (for KIND Kubernetes)

**Required for:** KIND Kubernetes mode

#### Native Windows (PowerShell as Administrator)

```powershell
# Download KIND for Windows
curl.exe -Lo kind-windows-amd64.exe https://kind.sigs.k8s.io/dl/v0.20.0/kind-windows-amd64

# Move to system path
Move-Item .\kind-windows-amd64.exe C:\Windows\System32\kind.exe

# Verify installation
kind version
```

#### WSL2 (Inside Ubuntu) - Recommended

```bash
# Follow Linux instructions
curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.20.0/kind-linux-amd64
chmod +x ./kind
sudo mv ./kind /usr/local/bin/kind

kind version
```

---

### 7. Install Rust (for Tauri Desktop)

**Note:** Tauri Desktop is primarily designed for macOS and Linux. Windows support is limited.

#### Native Windows (PowerShell as Administrator)

```powershell
# Download and run rustup-init.exe from:
# https://www.rust-lang.org/tools/install

# Follow installation prompts

# Verify installation (restart PowerShell first)
rustc --version
cargo --version

# Install Microsoft C++ Build Tools (required for Rust on Windows)
# Download from: https://visualstudio.microsoft.com/visual-cpp-build-tools/
# Install "Desktop development with C++" workload
```

#### WSL2 (Inside Ubuntu)

```bash
# Follow Linux Rust installation instructions
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env

rustc --version
cargo --version
```

---

### Windows Verification Checklist

#### Native Windows (PowerShell)

```powershell
# Core dependencies
git --version
node --version       # v22.15.1+ or v18.0.0+
npm --version        # v10.9.4+

# Docker mode dependencies
docker --version     # 20.10.0+
docker-compose --version  # v2.x

# KIND mode dependencies
kubectl version --client
kind version

# Tauri mode dependencies (if installed natively)
rustc --version      # 1.90.0+
cargo --version
```

#### WSL2 Ubuntu (Bash)

```bash
# Follow Linux verification checklist
```

---

## System Requirements Summary

### Minimum Hardware Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| **CPU** | 2 cores | 4+ cores |
| **RAM** | 8 GB | 16 GB |
| **Storage** | 20 GB free | 50 GB+ SSD |
| **Network** | Broadband | Stable broadband |

### Platform-Specific Requirements

#### macOS
- **OS:** macOS 10.13 (High Sierra) or later
- **Architecture:** Apple Silicon (M1/M2/M3) or Intel x86_64
- **RAM:** 16 GB minimum for Apple Virtualization mode
- **Disk:** 50 GB+ for Apple Virtualization mode

#### Linux
- **Distributions:** Ubuntu 20.04+, Debian 11+, Fedora 35+, Arch Linux
- **Kernel:** 5.10+ recommended for Docker
- **Architecture:** x86_64, arm64 (for some modes)

#### Windows
- **OS:** Windows 10 (build 19041+) or Windows 11
- **WSL2:** Strongly recommended for best compatibility
- **Hyper-V:** Required if not using WSL2 backend
- **Virtualization:** Must be enabled in BIOS

---

## Optional Tools (Recommended)

### Version Managers

```bash
# Node Version Manager (nvm)
# macOS/Linux
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Windows
# Download nvm-windows from: https://github.com/coreybutler/nvm-windows
```

### Package Managers

```bash
# Homebrew (macOS)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Chocolatey (Windows PowerShell as Administrator)
Set-ExecutionPolicy Bypass -Scope Process -Force
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
```

### Development Tools

```bash
# Visual Studio Code (all platforms)
# macOS
brew install --cask visual-studio-code

# Linux (Ubuntu/Debian)
sudo snap install code --classic

# Windows
choco install vscode -y

# Or download from: https://code.visualstudio.com/
```

---

## Common Installation Issues

### macOS

**Issue:** "xcrun: error: invalid active developer path"
```bash
# Solution: Install or reinstall Xcode Command Line Tools
xcode-select --install
sudo xcodebuild -license accept
```

**Issue:** Docker Desktop won't start on Apple Silicon
```bash
# Solution: Enable Rosetta 2
softwareupdate --install-rosetta

# Then restart Docker Desktop
```

### Linux

**Issue:** "permission denied" when running Docker
```bash
# Solution: Add user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Or use sudo (not recommended for regular use)
sudo docker run hello-world
```

**Issue:** kubectl/kind not in PATH after installation
```bash
# Solution: Ensure /usr/local/bin is in PATH
echo 'export PATH="/usr/local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

### Windows

**Issue:** WSL2 installation fails
```powershell
# Solution: Enable Virtual Machine Platform
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart

# Enable WSL
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart

# Restart computer and try again
```

**Issue:** Docker Desktop requires Hyper-V but you want WSL2
```
# Solution: In Docker Desktop Settings
Settings → General
✓ Use the WSL 2 based engine
```

**Issue:** "The requested operation requires elevation" when installing packages
```powershell
# Solution: Right-click PowerShell → Run as Administrator
# Always run PowerShell as Administrator for system-wide installations
```

---

## Verification Script

### All-in-One Verification (Linux/macOS)

Save this as `verify-prerequisites.sh`:

```bash
#!/bin/bash

echo "=== VibeCode Prerequisites Verification ==="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

check_command() {
    if command -v $1 &> /dev/null; then
        echo -e "${GREEN}✓${NC} $1 is installed: $($1 --version | head -n1)"
    else
        echo -e "${RED}✗${NC} $1 is NOT installed"
    fi
}

check_version() {
    if command -v $1 &> /dev/null; then
        VERSION=$($1 --version 2>&1 | grep -oP "$2" | head -n1)
        if [ ! -z "$VERSION" ]; then
            echo -e "${GREEN}✓${NC} $1 version: $VERSION"
        else
            echo -e "${YELLOW}⚠${NC} $1 is installed but version check failed"
        fi
    else
        echo -e "${RED}✗${NC} $1 is NOT installed"
    fi
}

echo "Core Dependencies:"
check_command git
check_version node '\d+\.\d+\.\d+'
check_version npm '\d+\.\d+\.\d+'

echo ""
echo "Docker Dependencies:"
check_command docker
check_command docker-compose
docker compose version &> /dev/null && echo -e "${GREEN}✓${NC} Docker Compose V2 is available"

echo ""
echo "Kubernetes Dependencies:"
check_command kubectl
check_command kind

echo ""
echo "Tauri/Apple Virtualization Dependencies:"
check_command rustc
check_command cargo
check_command swift

echo ""
echo "=== Verification Complete ==="
```

Run it:
```bash
chmod +x verify-prerequisites.sh
./verify-prerequisites.sh
```

---

## Next Steps

After installing prerequisites:

1. **Choose your deployment mode:**
   - [Docker Compose Setup](./DOCKER_COMPOSE_SETUP.md) - Fastest way to get started
   - [KIND Kubernetes Setup](./KIND_KUBERNETES_SETUP.md) - For learning K8s
   - [Tauri Desktop Setup](./TAURI_DESKTOP_SETUP.md) - For native macOS app
   - [Apple Virtualization Setup](./APPLE_VIRTUALIZATION_SETUP.md) - For VM isolation

2. **Read the Getting Started guide:**
   - [Getting Started](./GETTING_STARTED.md) - Complete walkthrough

3. **If you encounter issues:**
   - [Troubleshooting Guide](./TROUBLESHOOTING_GUIDE.md) - Common problems and solutions

---

## Additional Resources

### Official Documentation

- **Docker:** https://docs.docker.com/get-docker/
- **Kubernetes:** https://kubernetes.io/docs/tasks/tools/
- **KIND:** https://kind.sigs.k8s.io/docs/user/quick-start/
- **Rust:** https://www.rust-lang.org/tools/install
- **Node.js:** https://nodejs.org/en/download/
- **nvm:** https://github.com/nvm-sh/nvm

### Platform-Specific Guides

- **macOS Homebrew:** https://brew.sh/
- **WSL2 Setup:** https://docs.microsoft.com/en-us/windows/wsl/install
- **Docker Desktop (Windows):** https://docs.docker.com/desktop/windows/install/

### Community Support

- **GitHub Issues:** Report installation problems
- **GitHub Discussions:** Ask questions about setup
- **Documentation:** Check other setup guides in `docs/setup/`

---

**Installation complete?** Proceed to [Getting Started](./GETTING_STARTED.md) to launch VibeCode! 🚀
