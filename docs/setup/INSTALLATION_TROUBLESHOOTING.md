# Installation Troubleshooting Flowchart

Step-by-step troubleshooting guide for common installation issues. Follow the flowchart to diagnose and resolve problems with Docker, KIND Kubernetes, Node.js, and other dependencies.

## Table of Contents

- [Quick Start: Installation Diagnostic Flowchart](#quick-start-installation-diagnostic-flowchart)
- [Node.js Installation Issues](#nodejs-installation-issues)
- [Docker Installation Issues](#docker-installation-issues)
- [KIND Kubernetes Installation Issues](#kind-kubernetes-installation-issues)
- [Build Tool Installation Issues](#build-tool-installation-issues)
- [System-Specific Installation Issues](#system-specific-installation-issues)
- [Post-Installation Verification](#post-installation-verification)

---

## Quick Start: Installation Diagnostic Flowchart

```
START: Installation Failure
          ↓
    ┌─────────────────────────────────┐
    │ What type of error occurred?    │
    └─────────────────────────────────┘
          ↓
    ┌─────┴─────┬──────────┬──────────┬──────────┐
    ↓           ↓          ↓          ↓          ↓
[Node.js]   [Docker]   [KIND]   [npm/deps]  [Other]
    ↓           ↓          ↓          ↓          ↓
 Section 1   Section 2  Section 3  Section 4  Section 5
```

### Step 1: Identify Your Error Type

**Error Message Contains:**
- `node: command not found` OR `Node version not supported` → [Node.js Issues](#nodejs-installation-issues)
- `docker: command not found` OR `Cannot connect to Docker daemon` → [Docker Issues](#docker-installation-issues)
- `kind: command not found` OR `kubectl: command not found` → [KIND Issues](#kind-kubernetes-installation-issues)
- `npm install failed` OR `gyp ERR!` OR `EACCES` → [Build Tool Issues](#build-tool-installation-issues)
- `brew: command not found` OR `xcode-select` → [System-Specific Issues](#system-specific-installation-issues)

### Step 2: Follow the Relevant Section

Each section below provides a decision tree to resolve specific installation issues.

---

## Node.js Installation Issues

### Diagnostic Flowchart

```
Is Node.js installed?
   ↓
   ├─ NO → Install Node.js
   │       ↓
   │   Use nvm (recommended) or system package manager
   │       ↓
   │   Verify: node --version
   │
   └─ YES → Check version
           ↓
       Is version 22.15.1+?
           ↓
       ├─ NO → Upgrade/Switch version
       │       ↓
       │   Use nvm to install correct version
       │
       └─ YES → Check npm
               ↓
           Is npm 10.9.4+?
               ↓
           ├─ NO → Update npm
           └─ YES → Node.js setup complete ✓
```

### Issue 1: Node.js Not Installed

**Symptoms:**
- `node: command not found`
- `bash: node: command not found`

**Solution Steps:**

1. **Check if Node.js is installed:**
   ```bash
   node --version
   ```

2. **If not installed, install using nvm (recommended):**

   **macOS/Linux:**
   ```bash
   # Install nvm
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

   # Restart terminal or reload profile
   source ~/.bashrc  # For bash
   source ~/.zshrc   # For zsh

   # Install required Node version
   nvm install 22.15.1
   nvm use 22.15.1
   nvm alias default 22.15.1

   # Verify
   node --version  # Should show v22.15.1
   npm --version   # Should show 10.9.4+
   ```

3. **Alternative: System package manager (not recommended)**

   **macOS (Homebrew):**
   ```bash
   brew install node@22
   brew link node@22
   ```

   **Linux (Ubuntu/Debian):**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

4. **Verify installation:**
   ```bash
   node --version
   npm --version
   which node
   ```

**Next Step:** ✓ Proceed to [Post-Installation Verification](#post-installation-verification)

---

### Issue 2: Wrong Node.js Version

**Symptoms:**
- `Node version not supported`
- `Error: The engine "node" is incompatible`
- Build failures with version mismatch errors

**Solution Steps:**

1. **Check current version:**
   ```bash
   node --version
   ```

2. **If version < 22.15.1, upgrade using nvm:**

   **Option A: nvm already installed:**
   ```bash
   # Install required version
   nvm install 22.15.1
   nvm use 22.15.1
   nvm alias default 22.15.1

   # Verify switch
   node --version
   ```

   **Option B: nvm not installed:**
   ```bash
   # Follow steps in "Node.js Not Installed" above
   # Then install correct version
   nvm install 22.15.1
   nvm use 22.15.1
   ```

3. **Handle system Node conflicts:**
   ```bash
   # If system Node interferes, uninstall it
   # macOS:
   brew uninstall --force node

   # Then use nvm exclusively
   nvm install 22.15.1
   nvm use 22.15.1
   ```

4. **Make version persistent:**
   ```bash
   # Set default for all new shells
   nvm alias default 22.15.1

   # Create .nvmrc in project root (optional)
   echo "22.15.1" > .nvmrc

   # Auto-switch when entering directory
   nvm use
   ```

**Next Step:** ✓ Proceed to [Post-Installation Verification](#post-installation-verification)

---

### Issue 3: npm Command Not Found

**Symptoms:**
- `npm: command not found`
- npm missing despite Node.js installed

**Solution Steps:**

1. **Verify Node.js installation:**
   ```bash
   node --version
   ```

2. **If Node.js installed but npm missing:**
   ```bash
   # Reinstall Node.js with nvm
   nvm uninstall <current-version>
   nvm install 22.15.1

   # Verify both are present
   node --version
   npm --version
   ```

3. **If using system Node.js:**
   ```bash
   # macOS:
   brew reinstall node

   # Linux (Ubuntu/Debian):
   sudo apt-get install --reinstall nodejs npm
   ```

**Next Step:** ✓ Proceed to [Post-Installation Verification](#post-installation-verification)

---

## Docker Installation Issues

### Diagnostic Flowchart

```
Is Docker installed?
   ↓
   ├─ NO → Install Docker Desktop (macOS/Windows)
   │       or Docker Engine (Linux)
   │       ↓
   │   Verify: docker --version
   │
   └─ YES → Is Docker running?
           ↓
       ├─ NO → Start Docker daemon
       │       ↓
       │   macOS: Open Docker Desktop
       │   Linux: systemctl start docker
       │
       └─ YES → Can you run 'docker ps'?
               ↓
           ├─ NO → Check permissions
           │       ↓
           │   Add user to docker group (Linux)
           │
           └─ YES → Docker setup complete ✓
```

### Issue 1: Docker Not Installed

**Symptoms:**
- `docker: command not found`
- `bash: docker: command not found`

**Solution Steps:**

1. **Check if Docker is installed:**
   ```bash
   docker --version
   ```

2. **Install Docker based on your OS:**

   **macOS:**
   ```bash
   # Option 1: Homebrew (recommended)
   brew install --cask docker

   # Option 2: Manual download
   # Visit: https://docs.docker.com/desktop/install/mac-install/
   # Download and install Docker Desktop

   # Start Docker Desktop
   open -a Docker

   # Wait for Docker to start (menu bar icon shows status)
   ```

   **Linux (Ubuntu/Debian):**
   ```bash
   # Update package index
   sudo apt-get update

   # Install prerequisites
   sudo apt-get install -y \
     ca-certificates \
     curl \
     gnupg \
     lsb-release

   # Add Docker's GPG key
   sudo mkdir -p /etc/apt/keyrings
   curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
     sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

   # Add Docker repository
   echo \
     "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
     https://download.docker.com/linux/ubuntu \
     $(lsb_release -cs) stable" | \
     sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

   # Install Docker Engine
   sudo apt-get update
   sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

   # Start Docker service
   sudo systemctl start docker
   sudo systemctl enable docker
   ```

3. **Verify installation:**
   ```bash
   docker --version
   docker ps
   ```

**Next Step:** Continue to "Docker Daemon Not Running" if `docker ps` fails.

---

### Issue 2: Docker Daemon Not Running

**Symptoms:**
- `Cannot connect to the Docker daemon`
- `Is the docker daemon running?`
- `docker ps` fails with connection error

**Solution Steps:**

1. **Check Docker daemon status:**
   ```bash
   docker info
   ```

2. **Start Docker daemon based on OS:**

   **macOS:**
   ```bash
   # Start Docker Desktop application
   open -a Docker

   # Wait 30-60 seconds for startup
   # Check menu bar for Docker icon (whale)

   # Verify daemon is running
   docker ps
   ```

   **Linux:**
   ```bash
   # Start Docker service
   sudo systemctl start docker

   # Check status
   sudo systemctl status docker

   # Enable on boot (optional)
   sudo systemctl enable docker

   # Verify
   docker ps
   ```

3. **If daemon still not running (Linux):**
   ```bash
   # Check for errors
   sudo journalctl -u docker --no-pager | tail -50

   # Restart daemon
   sudo systemctl restart docker

   # Check status again
   sudo systemctl status docker
   ```

**Next Step:** ✓ Proceed to [Post-Installation Verification](#post-installation-verification)

---

### Issue 3: Docker Permission Denied (Linux)

**Symptoms:**
- `Got permission denied while trying to connect`
- Must use `sudo` for docker commands
- `permission denied` errors

**Solution Steps:**

1. **Add your user to docker group:**
   ```bash
   # Create docker group if not exists
   sudo groupadd docker

   # Add current user to docker group
   sudo usermod -aG docker $USER

   # Apply group changes
   newgrp docker
   ```

2. **Verify permissions:**
   ```bash
   # Should work without sudo
   docker ps

   # Check groups
   groups
   # Should show 'docker' in the list
   ```

3. **If still not working, log out and back in:**
   ```bash
   # Or reboot system
   sudo reboot
   ```

4. **Alternative: Fix socket permissions (temporary):**
   ```bash
   sudo chmod 666 /var/run/docker.sock
   ```

**Next Step:** ✓ Proceed to [Post-Installation Verification](#post-installation-verification)

---

### Issue 4: Docker Compose Not Available

**Symptoms:**
- `docker-compose: command not found`
- `docker compose` commands fail

**Solution Steps:**

1. **Check Docker Compose version:**
   ```bash
   docker-compose --version
   # Or try V2 plugin syntax:
   docker compose version
   ```

2. **Install Docker Compose:**

   **macOS:**
   ```bash
   # If using Docker Desktop, Compose is included
   # Otherwise:
   brew install docker-compose

   # Verify
   docker-compose --version
   ```

   **Linux:**
   ```bash
   # Install Compose plugin (recommended)
   sudo apt-get update
   sudo apt-get install docker-compose-plugin

   # Or install standalone
   sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" \
     -o /usr/local/bin/docker-compose
   sudo chmod +x /usr/local/bin/docker-compose

   # Verify
   docker-compose --version
   ```

3. **Use Docker Compose V2 syntax (if V1 not available):**
   ```bash
   # Use 'docker compose' instead of 'docker-compose'
   docker compose up -d
   docker compose ps
   docker compose logs
   ```

**Next Step:** ✓ Proceed to [Post-Installation Verification](#post-installation-verification)

---

## KIND Kubernetes Installation Issues

### Diagnostic Flowchart

```
Is KIND installed?
   ↓
   ├─ NO → Install KIND
   │       ↓
   │   macOS: brew install kind
   │   Linux: Download binary
   │       ↓
   │   Verify: kind version
   │
   └─ YES → Is kubectl installed?
           ↓
       ├─ NO → Install kubectl
       │       ↓
       │   macOS: brew install kubectl
       │   Linux: Download binary
       │
       └─ YES → Is Docker running?
               ↓
           ├─ NO → Start Docker
           │       (KIND requires Docker)
           │
           └─ YES → KIND setup complete ✓
```

### Issue 1: KIND Not Installed

**Symptoms:**
- `kind: command not found`
- `bash: kind: command not found`

**Solution Steps:**

1. **Check if KIND is installed:**
   ```bash
   kind version
   ```

2. **Install KIND based on OS:**

   **macOS:**
   ```bash
   # Using Homebrew (recommended)
   brew install kind

   # Verify
   kind version
   ```

   **Linux:**
   ```bash
   # Download KIND binary
   curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.20.0/kind-linux-amd64

   # Make executable and move to PATH
   chmod +x ./kind
   sudo mv ./kind /usr/local/bin/kind

   # Verify
   kind version
   ```

   **Windows (WSL2):**
   ```bash
   # Download KIND binary
   curl -Lo kind-windows-amd64.exe https://kind.sigs.k8s.io/dl/v0.20.0/kind-windows-amd64

   # Move to PATH location
   # Then verify
   kind version
   ```

3. **Verify Docker is running (required for KIND):**
   ```bash
   docker ps
   # If this fails, go to Docker Installation Issues section
   ```

**Next Step:** Continue to "kubectl Not Installed" or proceed to verification.

---

### Issue 2: kubectl Not Installed

**Symptoms:**
- `kubectl: command not found`
- Cannot manage KIND cluster
- `kind create cluster` succeeds but can't access cluster

**Solution Steps:**

1. **Check if kubectl is installed:**
   ```bash
   kubectl version --client
   ```

2. **Install kubectl based on OS:**

   **macOS:**
   ```bash
   # Using Homebrew (recommended)
   brew install kubectl

   # Verify
   kubectl version --client
   ```

   **Linux:**
   ```bash
   # Download latest stable version
   curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"

   # Make executable and move to PATH
   chmod +x kubectl
   sudo mv kubectl /usr/local/bin/

   # Verify
   kubectl version --client
   ```

3. **Configure kubectl for KIND:**
   ```bash
   # KIND automatically configures kubectl context
   # Verify configuration
   kubectl config current-context

   # Should show: kind-vibecode-local (or your cluster name)
   ```

**Next Step:** ✓ Proceed to [Post-Installation Verification](#post-installation-verification)

---

### Issue 3: KIND Cluster Creation Fails

**Symptoms:**
- `failed to create cluster`
- `context deadline exceeded`
- Cluster creation hangs or times out

**Solution Steps:**

1. **Check Docker is running:**
   ```bash
   docker ps
   # If this fails, start Docker first
   ```

2. **Delete any existing cluster:**
   ```bash
   # List existing clusters
   kind get clusters

   # Delete if exists
   kind delete cluster --name vibecode-local

   # Clean up Docker containers
   docker ps -a | grep kind | awk '{print $1}' | xargs docker rm -f
   ```

3. **Check Docker resources:**
   ```bash
   # KIND needs minimum:
   # - 4 CPUs
   # - 8GB RAM
   # - 20GB disk space

   # macOS: Check Docker Desktop → Preferences → Resources
   # Linux: Check system resources
   free -h
   df -h
   ```

4. **Create cluster with extended timeout:**
   ```bash
   # Create with config file and longer wait time
   kind create cluster \
     --config=config/k8s/kind-config.yaml \
     --name vibecode-local \
     --wait 5m

   # Monitor progress
   docker logs kind-control-plane -f
   ```

5. **Verify cluster creation:**
   ```bash
   # Check cluster exists
   kind get clusters

   # Check nodes are ready
   kubectl get nodes

   # Verify cluster info
   kubectl cluster-info --context kind-vibecode-local
   ```

**Common Errors:**

- **"failed to pull image"**: Check internet connection and Docker Hub access
- **"port is already allocated"**: Another service is using required ports (see Port Conflicts in TROUBLESHOOTING_GUIDE.md)
- **"no space left on device"**: Free up disk space

**Next Step:** ✓ Proceed to [Post-Installation Verification](#post-installation-verification)

---

## Build Tool Installation Issues

### Diagnostic Flowchart

```
Does 'npm install' work?
   ↓
   ├─ NO → What error appears?
   │       ↓
   │   ├─ EACCES (permission) → Fix npm permissions
   │   ├─ gyp ERR! → Install build tools
   │   ├─ Network error → Check connectivity/proxy
   │   └─ Other → Clear cache and retry
   │
   └─ YES → Dependencies installed ✓
```

### Issue 1: npm install Permission Errors

**Symptoms:**
- `EACCES: permission denied`
- `npm ERR! code EACCES`
- `checkPermissions Missing write access`

**Solution Steps:**

1. **NEVER use sudo with npm!** Fix permissions instead:

   ```bash
   # Create npm global directory in home
   mkdir ~/.npm-global

   # Configure npm to use new directory
   npm config set prefix '~/.npm-global'

   # Add to PATH
   echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
   source ~/.bashrc  # Or ~/.zshrc for zsh

   # Verify configuration
   npm config get prefix
   # Should show: /home/username/.npm-global
   ```

2. **Fix node_modules permissions (if already exists):**
   ```bash
   # Remove existing node_modules
   rm -rf node_modules package-lock.json

   # Clean npm cache
   npm cache clean --force

   # Fresh install
   npm install
   ```

3. **Alternative: Use nvm (recommended long-term):**
   ```bash
   # nvm handles permissions correctly by default
   # No sudo ever needed with nvm

   # Install nvm (if not already)
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

   # Install Node with nvm
   nvm install 22.15.1
   nvm use 22.15.1

   # Install dependencies (no permission issues)
   npm install
   ```

**Next Step:** Retry `npm install`

---

### Issue 2: Native Module Build Failures

**Symptoms:**
- `gyp ERR! build error`
- `node-gyp rebuild failed`
- `No Xcode or CLT version detected` (macOS)
- `Python not found` errors

**Solution Steps:**

1. **Install build tools for your OS:**

   **macOS:**
   ```bash
   # Install Xcode Command Line Tools
   xcode-select --install

   # If already installed, reset it
   sudo rm -rf /Library/Developer/CommandLineTools
   xcode-select --install

   # Install Python 3 (required by node-gyp)
   brew install python@3.11

   # Configure npm to use Python 3
   npm config set python python3

   # Verify
   xcode-select -p
   python3 --version
   ```

   **Linux (Ubuntu/Debian):**
   ```bash
   # Install build essentials
   sudo apt-get update
   sudo apt-get install -y build-essential python3 make g++

   # Verify installations
   gcc --version
   g++ --version
   make --version
   python3 --version
   ```

2. **Install node-gyp globally:**
   ```bash
   npm install -g node-gyp

   # Verify
   node-gyp --version
   ```

3. **Clear and reinstall:**
   ```bash
   # Remove existing installation
   rm -rf node_modules package-lock.json

   # Clean npm cache
   npm cache clean --force

   # Rebuild native modules
   npm install
   ```

4. **For specific module issues:**
   ```bash
   # Rebuild specific module
   npm rebuild <module-name>

   # Example:
   npm rebuild node-sass
   ```

**Next Step:** ✓ Proceed to [Post-Installation Verification](#post-installation-verification)

---

### Issue 3: Peer Dependency Warnings/Errors

**Symptoms:**
- `ERESOLVE unable to resolve dependency tree`
- `peer dependency warnings`
- `npm ERR! conflicting peer dependency`

**Solution Steps:**

1. **Understand the difference:**
   - **Warnings**: Usually safe to ignore
   - **Errors**: Block installation

2. **For warnings (non-blocking):**
   ```bash
   # Warnings don't prevent installation
   # If install completes, you can proceed
   npm install

   # To silence warnings, use legacy peer deps
   npm install --legacy-peer-deps
   ```

3. **For errors (blocking):**
   ```bash
   # Option 1: Use legacy peer deps (recommended)
   npm install --legacy-peer-deps

   # Option 2: Force (use with caution)
   npm install --force

   # Option 3: Update conflicting packages
   npm update <package-name>
   ```

4. **Create .npmrc to make setting permanent:**
   ```bash
   # Add to .npmrc file
   echo "legacy-peer-deps=true" >> .npmrc

   # Now npm install uses this by default
   npm install
   ```

**Next Step:** ✓ Proceed to [Post-Installation Verification](#post-installation-verification)

---

### Issue 4: npm install Hangs or Times Out

**Symptoms:**
- Installation freezes
- No progress for several minutes
- Network timeout errors

**Solution Steps:**

1. **Check network connectivity:**
   ```bash
   # Test npm registry access
   npm ping

   # Check specific package
   npm view react versions
   ```

2. **Clear npm cache:**
   ```bash
   # Clear cache
   npm cache clean --force

   # Verify cache cleared
   npm cache verify
   ```

3. **Increase timeout:**
   ```bash
   # Set longer timeout
   npm config set fetch-timeout 60000
   npm config set fetch-retry-maxtimeout 120000

   # Retry installation
   npm install
   ```

4. **Use different registry (if corporate firewall):**
   ```bash
   # Check current registry
   npm config get registry

   # Try different registry
   npm config set registry https://registry.npmjs.org/

   # Or use HTTP instead of HTTPS (not recommended for production)
   npm config set registry http://registry.npmjs.org/
   ```

5. **Configure proxy (if behind corporate proxy):**
   ```bash
   # Set proxy
   npm config set proxy http://proxy.company.com:8080
   npm config set https-proxy http://proxy.company.com:8080

   # With authentication
   npm config set proxy http://username:password@proxy.company.com:8080
   ```

**Next Step:** Retry `npm install`

---

## System-Specific Installation Issues

### Issue 1: macOS - Homebrew Not Installed

**Symptoms:**
- `brew: command not found`
- Cannot install packages via Homebrew

**Solution Steps:**

1. **Install Homebrew:**
   ```bash
   # Install Homebrew
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```

2. **Add Homebrew to PATH:**

   **Apple Silicon (M1/M2/M3):**
   ```bash
   echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
   eval "$(/opt/homebrew/bin/brew shellenv)"
   ```

   **Intel Macs:**
   ```bash
   echo 'eval "$(/usr/local/bin/brew shellenv)"' >> ~/.zprofile
   eval "$(/usr/local/bin/brew shellenv)"
   ```

3. **Verify installation:**
   ```bash
   brew --version
   brew doctor
   ```

4. **Update Homebrew:**
   ```bash
   brew update
   brew upgrade
   ```

**Next Step:** Return to the installation step that required Homebrew.

---

### Issue 2: macOS - Command Line Tools Not Installed

**Symptoms:**
- `xcode-select: error: command line tools are not installed`
- `xcrun: error: invalid active developer path`
- Git, make, or gcc not found

**Solution Steps:**

1. **Install Xcode Command Line Tools:**
   ```bash
   xcode-select --install
   ```

2. **Click "Install" in the dialog that appears**

3. **Wait for installation to complete** (may take 10-30 minutes)

4. **Verify installation:**
   ```bash
   xcode-select -p
   # Should show: /Library/Developer/CommandLineTools

   # Verify tools are available
   git --version
   make --version
   gcc --version
   ```

5. **If already installed but broken:**
   ```bash
   # Remove existing installation
   sudo rm -rf /Library/Developer/CommandLineTools

   # Reinstall
   xcode-select --install
   ```

**Next Step:** Return to the installation step that failed.

---

### Issue 3: Linux - Missing System Dependencies

**Symptoms:**
- `apt-get: command not found` (non-Debian systems)
- Various "not found" errors for system tools
- Compilation failures

**Solution Steps:**

**Ubuntu/Debian:**
```bash
# Update package index
sudo apt-get update

# Install essential build tools
sudo apt-get install -y \
  build-essential \
  curl \
  wget \
  git \
  ca-certificates \
  gnupg \
  lsb-release

# For development
sudo apt-get install -y \
  python3 \
  python3-pip \
  libssl-dev \
  pkg-config
```

**RHEL/CentOS/Fedora:**
```bash
# Update package index
sudo yum update -y  # or 'dnf' on newer systems

# Install essential build tools
sudo yum groupinstall -y "Development Tools"
sudo yum install -y \
  curl \
  wget \
  git \
  openssl-devel

# For development
sudo yum install -y \
  python3 \
  python3-pip
```

**Arch Linux:**
```bash
# Update package index
sudo pacman -Syu

# Install essential build tools
sudo pacman -S --needed base-devel git curl wget
```

**Next Step:** Return to the installation step that failed.

---

## Post-Installation Verification

After resolving installation issues, verify your setup is complete:

### Complete Environment Check

```bash
# Node.js and npm
node --version        # Should be v22.15.1+
npm --version         # Should be v10.9.4+

# Docker (if using Docker Compose or KIND)
docker --version      # Any recent version
docker ps             # Should not error

# Docker Compose (if using Docker Compose mode)
docker-compose --version  # V2.0+
# Or:
docker compose version

# KIND (if using KIND Kubernetes mode)
kind version          # v0.20.0+
kubectl version --client  # Any recent version

# Git
git --version         # Any recent version

# Verify Docker daemon
docker run hello-world  # Should download and run successfully
```

### Installation Success Criteria

✅ **All checks pass if:**
1. All required commands are found (no "command not found" errors)
2. Versions meet minimum requirements
3. `docker ps` runs without errors (if using Docker)
4. `npm install` completes successfully in project directory

### Next Steps After Successful Installation

1. **Clone or navigate to VibeCode repository:**
   ```bash
   git clone <repository-url>
   cd vibecode
   ```

2. **Install project dependencies:**
   ```bash
   npm install
   ```

3. **Follow deployment-specific setup:**
   - Docker Compose: See `docs/setup/DOCKER_COMPOSE_SETUP.md`
   - KIND Kubernetes: See `docs/setup/KIND_KUBERNETES_SETUP.md`
   - Tauri Desktop: See `docs/setup/TAURI_DESKTOP_SETUP.md`
   - Apple Virtualization: See `docs/setup/APPLE_VIRTUALIZATION_SETUP.md`

---

## Still Having Issues?

If you've followed the flowcharts and still experience problems:

### 1. Collect Diagnostic Information

```bash
# System information
uname -a
sw_vers  # macOS only

# Version information
node --version
npm --version
docker --version
docker-compose --version
kind version
kubectl version

# Environment check
echo $PATH
echo $SHELL

# Docker status (if applicable)
docker info
docker ps -a

# KIND status (if applicable)
kind get clusters
kubectl get nodes
```

### 2. Check Detailed Logs

- **npm errors**: Check `npm-debug.log` in project directory
- **Docker errors**: Run `docker logs <container-name>`
- **KIND errors**: Run `kubectl describe pod <pod-name> -n vibecode`

### 3. Consult Additional Resources

- **Full Troubleshooting Guide**: See `docs/setup/TROUBLESHOOTING_GUIDE.md` for comprehensive issue coverage
- **Setup Guides**: Check deployment-specific guides in `docs/setup/`
- **Prerequisites**: Verify all requirements in `docs/setup/PREREQUISITES.md`

### 4. Get Help

- **Create GitHub Issue**: Include diagnostic information and error messages
- **Check Existing Issues**: Search for similar problems
- **Community Support**: Join project Discord/Slack for real-time help

---

## Quick Reference: Common Command Patterns

### Diagnostic Commands
```bash
# Check installations
node --version && npm --version && docker --version

# Check running services
docker ps
kubectl get pods -n vibecode

# Check system resources
df -h  # Disk space
free -h  # RAM (Linux)
top  # CPU usage
```

### Recovery Commands
```bash
# Clean npm
rm -rf node_modules package-lock.json
npm cache clean --force
npm install

# Clean Docker
docker system prune -a
docker volume prune

# Reset KIND cluster
kind delete cluster --name vibecode-local
kind create cluster --config=config/k8s/kind-config.yaml --name vibecode-local
```

### Permission Fixes
```bash
# npm (Linux/macOS)
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc

# Docker (Linux)
sudo usermod -aG docker $USER
newgrp docker
```

---

**Document Version**: 1.0
**Last Updated**: 2026-02-28
**Related Guides**: TROUBLESHOOTING_GUIDE.md, PREREQUISITES.md, GETTING_STARTED.md
