# Setup Troubleshooting Guide

Comprehensive troubleshooting guide for setup and installation issues across all VibeCode deployment modes.

## Table of Contents

- [Quick Diagnostics](#quick-diagnostics)
- [Common Prerequisites Issues](#common-prerequisites-issues)
- [Environment Configuration](#environment-configuration)
- [Docker Compose Setup](#docker-compose-setup)
- [KIND Kubernetes Setup](#kind-kubernetes-setup)
- [Tauri Desktop Setup](#tauri-desktop-setup)
- [Apple Virtualization Setup](#apple-virtualization-setup)
- [Dependency Installation](#dependency-installation)
- [Port Conflicts](#port-conflicts)
- [Permission Issues](#permission-issues)
- [Network and Connectivity](#network-and-connectivity)
- [Getting Help](#getting-help)

---

## Quick Diagnostics

Run these commands to verify your environment before setup:

```bash
# Check system requirements
node --version        # Should be v22.15.1+
npm --version         # Should be v10.9.4+
git --version         # Any recent version

# Check deployment-specific tools
docker --version      # For Docker Compose and KIND
kubectl version       # For KIND Kubernetes
kind version          # For KIND Kubernetes
rustc --version       # For Tauri and Apple Virtualization
cargo --version       # For Tauri and Apple Virtualization
swift --version       # For Apple Virtualization

# Check system resources
df -h                 # Disk space (need 5GB+ free)
free -h              # RAM (8GB+ recommended)
```

**macOS Quick Check:**
```bash
# Check system version
sw_vers

# Check Xcode Command Line Tools
xcode-select -p

# Check architecture (for Apple Silicon considerations)
uname -m
```

---

## Common Prerequisites Issues

### Issue: Node.js Version Mismatch

**Symptoms:**
- "Node version not supported" errors
- Build failures with cryptic messages
- Dependencies failing to install

**Diagnosis:**
```bash
# Check current Node version
node --version

# Check which Node version is active
which node
```

**Solutions:**

1. **Install nvm (Node Version Manager)**
   ```bash
   # Install nvm
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

   # Restart terminal or source profile
   source ~/.bashrc    # For bash
   source ~/.zshrc     # For zsh

   # Install required Node version
   nvm install 22.15.1
   nvm use 22.15.1
   nvm alias default 22.15.1

   # Verify
   node --version
   ```

2. **Switch Node Versions**
   ```bash
   # List installed versions
   nvm list

   # Use specific version
   nvm use 22.15.1

   # Set default for new shells
   nvm alias default 22.15.1
   ```

3. **System Node Conflicts**
   ```bash
   # Remove system Node (macOS Homebrew)
   brew uninstall --force node

   # Use nvm-installed version
   nvm install 22.15.1
   nvm use 22.15.1
   ```

### Issue: Git Not Installed or Outdated

**Symptoms:**
- "git: command not found"
- Unable to clone repository

**Solutions:**

**macOS:**
```bash
# Install Xcode Command Line Tools (includes Git)
xcode-select --install

# Or install via Homebrew
brew install git

# Verify
git --version
```

**Linux (Ubuntu/Debian):**
```bash
# Install Git
sudo apt-get update
sudo apt-get install -y git

# Verify
git --version
```

### Issue: Homebrew Not Installed (macOS)

**Symptoms:**
- "brew: command not found"
- Cannot install packages

**Solution:**
```bash
# Install Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Add to PATH (Apple Silicon)
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"

# Add to PATH (Intel)
echo 'eval "$(/usr/local/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/usr/local/bin/brew shellenv)"

# Verify
brew --version
```

---

## Environment Configuration

### Issue: Missing or Incorrect .env File

**Symptoms:**
- "DATABASE_URL is required" errors
- Services fail to connect
- "Missing required environment variable" errors

**Diagnosis:**
```bash
# Check if .env exists
ls -la .env

# Verify .env is not empty
cat .env | grep -v '^#' | grep -v '^$'

# Check for required variables
grep -E "(POSTGRES_PASSWORD|DATABASE_URL)" .env
```

**Solutions:**

1. **Create .env from Template**
   ```bash
   # Copy example file
   cp .env.example .env

   # Generate secure password
   openssl rand -base64 32

   # Edit .env file
   nano .env
   ```

2. **Minimum Required Variables**
   ```bash
   # Add to .env file
   POSTGRES_PASSWORD=your_secure_password_here
   DATABASE_URL=postgresql://postgres:your_secure_password_here@localhost:5432/vibecode
   ```

3. **Verify Environment Loading**
   ```bash
   # Test environment loading
   source .env
   echo $POSTGRES_PASSWORD

   # For Docker Compose
   docker-compose config | grep POSTGRES_PASSWORD
   ```

### Issue: Environment Variable Substitution Errors

**Symptoms:**
- Variables showing as "${VAR_NAME}" instead of values
- Services starting with incorrect configuration

**Solutions:**

1. **Export Variables Before Docker Compose**
   ```bash
   # Export required variables
   export POSTGRES_PASSWORD="your_password"

   # Or source .env file
   set -a
   source .env
   set +a

   # Then run Docker Compose
   docker-compose up -d
   ```

2. **Use .env File Directly**
   ```bash
   # Docker Compose automatically reads .env
   # Ensure it's in the same directory as docker-compose.yml

   # Verify
   docker-compose config
   ```

---

## Docker Compose Setup

### Issue: Docker Desktop Not Running

**Symptoms:**
- "Cannot connect to the Docker daemon"
- "docker: command not found"

**Diagnosis:**
```bash
# Check if Docker daemon is running
docker ps

# Check Docker status
docker info
```

**Solutions:**

**macOS:**
```bash
# Start Docker Desktop
open -a Docker

# Wait for Docker to start (check menu bar icon)
# Then retry:
docker ps
```

**Linux:**
```bash
# Start Docker service
sudo systemctl start docker

# Enable on boot
sudo systemctl enable docker

# Add user to docker group (to avoid sudo)
sudo usermod -aG docker $USER
newgrp docker

# Verify
docker ps
```

### Issue: Docker Compose Version Mismatch

**Symptoms:**
- "version is obsolete" warnings
- Syntax errors in docker-compose.yml
- Features not working

**Diagnosis:**
```bash
# Check Docker Compose version
docker-compose --version

# Check if using V2 syntax
head -n 5 config/docker/docker-compose.dev.yml | grep version
```

**Solutions:**

1. **Install Docker Compose V2**
   ```bash
   # macOS (Homebrew)
   brew install docker-compose

   # Linux
   sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
   sudo chmod +x /usr/local/bin/docker-compose

   # Verify
   docker-compose --version
   ```

2. **Use Docker Compose Plugin**
   ```bash
   # Use 'docker compose' (no hyphen) instead
   docker compose up -d
   docker compose ps
   ```

### Issue: Containers Not Starting

**Symptoms:**
- Services show as "Exited" or "Restarting"
- "Container exited with code 1"

**Diagnosis:**
```bash
# Check container status
docker-compose -f config/docker/docker-compose.dev.yml ps

# View logs for specific service
docker-compose -f config/docker/docker-compose.dev.yml logs vibecode
docker-compose -f config/docker/docker-compose.dev.yml logs postgres

# Check last 50 lines
docker-compose -f config/docker/docker-compose.dev.yml logs --tail=50
```

**Solutions:**

1. **Check Port Conflicts**
   ```bash
   # Check if port 3000 is in use
   lsof -i :3000

   # Kill conflicting process
   kill -9 <PID>

   # Or change port in docker-compose.yml
   # ports:
   #   - "3001:3000"  # Use 3001 instead
   ```

2. **Rebuild Containers**
   ```bash
   # Stop and remove containers
   docker-compose -f config/docker/docker-compose.dev.yml down

   # Rebuild images
   docker-compose -f config/docker/docker-compose.dev.yml build --no-cache

   # Start fresh
   docker-compose -f config/docker/docker-compose.dev.yml up -d
   ```

3. **Check Resource Limits**
   ```bash
   # Check Docker Desktop resource settings
   # macOS: Docker Desktop → Preferences → Resources

   # Increase CPU and Memory if needed
   # Recommended: 4 CPUs, 8GB RAM
   ```

### Issue: PostgreSQL Connection Failures

**Symptoms:**
- "Connection refused" errors
- "password authentication failed"
- "database does not exist"

**Diagnosis:**
```bash
# Check if PostgreSQL container is running
docker-compose -f config/docker/docker-compose.dev.yml ps postgres

# Check PostgreSQL logs
docker-compose -f config/docker/docker-compose.dev.yml logs postgres

# Test connection from host
docker-compose -f config/docker/docker-compose.dev.yml exec postgres psql -U postgres -c "SELECT version();"
```

**Solutions:**

1. **Wait for PostgreSQL Initialization**
   ```bash
   # PostgreSQL takes time to initialize on first start
   # Check logs for "database system is ready to accept connections"
   docker-compose -f config/docker/docker-compose.dev.yml logs -f postgres

   # Wait 30-60 seconds, then retry application
   ```

2. **Reset PostgreSQL Data**
   ```bash
   # Stop services
   docker-compose -f config/docker/docker-compose.dev.yml down

   # Remove PostgreSQL volume
   docker volume rm $(docker volume ls -q | grep postgres)

   # Or remove all volumes
   docker-compose -f config/docker/docker-compose.dev.yml down -v

   # Start fresh
   docker-compose -f config/docker/docker-compose.dev.yml up -d
   ```

3. **Verify Credentials**
   ```bash
   # Check environment variable
   echo $POSTGRES_PASSWORD

   # Ensure it matches in .env and docker-compose.yml
   # Test connection with correct password
   docker-compose -f config/docker/docker-compose.dev.yml exec postgres \
     psql -U postgres -c "SELECT current_database();"
   ```

---

## KIND Kubernetes Setup

### Issue: KIND Not Installed

**Symptoms:**
- "kind: command not found"
- Cannot create cluster

**Solutions:**

**macOS:**
```bash
# Install via Homebrew
brew install kind

# Verify installation
kind version
```

**Linux:**
```bash
# Install KIND binary
curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.20.0/kind-linux-amd64
chmod +x ./kind
sudo mv ./kind /usr/local/bin/kind

# Verify
kind version
```

### Issue: kubectl Not Installed

**Symptoms:**
- "kubectl: command not found"
- Cannot manage cluster

**Solutions:**

**macOS:**
```bash
# Install via Homebrew
brew install kubectl

# Verify
kubectl version --client
```

**Linux:**
```bash
# Install kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
chmod +x kubectl
sudo mv kubectl /usr/local/bin/

# Verify
kubectl version --client
```

### Issue: Cluster Creation Fails

**Symptoms:**
- "failed to create cluster"
- "context deadline exceeded"
- Cluster stuck in "Creating" state

**Diagnosis:**
```bash
# Check existing clusters
kind get clusters

# Check Docker containers
docker ps -a | grep kind

# Check logs
docker logs kind-control-plane
```

**Solutions:**

1. **Delete Existing Cluster**
   ```bash
   # Delete cluster if exists
   kind delete cluster --name vibecode-local

   # Verify deletion
   kind get clusters

   # Recreate
   kind create cluster --config=config/k8s/kind-config.yaml --name vibecode-local
   ```

2. **Increase Timeout**
   ```bash
   # Create with longer timeout
   kind create cluster \
     --config=config/k8s/kind-config.yaml \
     --name vibecode-local \
     --wait 5m
   ```

3. **Check Docker Resources**
   ```bash
   # Ensure Docker has enough resources
   # KIND needs at least:
   # - 4 CPUs
   # - 8GB RAM
   # - 20GB disk space

   # Check Docker Desktop settings
   # macOS: Docker Desktop → Preferences → Resources
   ```

### Issue: Pods Not Starting

**Symptoms:**
- Pods stuck in "Pending" or "CrashLoopBackOff"
- "ImagePullBackOff" errors

**Diagnosis:**
```bash
# Check pod status
kubectl get pods -n vibecode

# Describe specific pod
kubectl describe pod <pod-name> -n vibecode

# Check events
kubectl get events -n vibecode --sort-by='.lastTimestamp'

# View logs
kubectl logs <pod-name> -n vibecode
```

**Solutions:**

1. **Load Images into KIND**
   ```bash
   # Build Docker image
   docker build -t vibecode:latest .

   # Load into KIND cluster
   kind load docker-image vibecode:latest --name vibecode-local

   # Verify
   docker exec -it vibecode-local-control-plane crictl images | grep vibecode
   ```

2. **Fix ImagePullPolicy**
   ```bash
   # Edit deployment to use local image
   kubectl edit deployment vibecode -n vibecode

   # Change:
   # imagePullPolicy: Always
   # To:
   # imagePullPolicy: IfNotPresent
   ```

3. **Check Resource Limits**
   ```bash
   # Describe pod to see resource issues
   kubectl describe pod <pod-name> -n vibecode | grep -A 5 "Resources"

   # Adjust limits in deployment if needed
   ```

---

## Tauri Desktop Setup

### Issue: Rust Not Installed

**Symptoms:**
- "cargo: command not found"
- "rustc: command not found"

**Solutions:**

```bash
# Install Rust via rustup
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Follow prompts (usually option 1)

# Source environment
source $HOME/.cargo/env

# Verify
rustc --version
cargo --version

# Update to latest stable
rustup update stable
```

### Issue: Xcode Command Line Tools Missing (macOS)

**Symptoms:**
- "xcrun: error: invalid active developer path"
- Compilation errors mentioning missing headers
- "clang: command not found"

**Diagnosis:**
```bash
# Check if installed
xcode-select -p

# Expected: /Library/Developer/CommandLineTools
# or /Applications/Xcode.app/Contents/Developer
```

**Solutions:**

1. **Install Command Line Tools**
   ```bash
   # Install
   xcode-select --install

   # Click "Install" in the dialog that appears
   # Wait for installation to complete (5-10 minutes)

   # Verify
   xcode-select -p
   gcc --version
   ```

2. **Reset Developer Directory**
   ```bash
   # If installed but not recognized
   sudo xcode-select --reset

   # Or set explicitly
   sudo xcode-select --switch /Library/Developer/CommandLineTools
   ```

3. **Accept License**
   ```bash
   # If Xcode is installed
   sudo xcodebuild -license accept
   ```

### Issue: Tauri CLI Installation Fails

**Symptoms:**
- Cargo build errors during CLI install
- "failed to compile tauri-cli"

**Solutions:**

1. **Install via Cargo**
   ```bash
   # Update Rust first
   rustup update stable

   # Install Tauri CLI
   cargo install tauri-cli --version ^2.0.0

   # Verify
   cargo tauri --version
   ```

2. **Clear Cargo Cache**
   ```bash
   # Remove cached builds
   rm -rf ~/.cargo/registry
   rm -rf ~/.cargo/git

   # Retry installation
   cargo install tauri-cli --version ^2.0.0
   ```

3. **Use NPM Package**
   ```bash
   # Alternative: install via npm
   npm install -g @tauri-apps/cli

   # Verify
   npx tauri --version
   ```

### Issue: Tauri Dev Build Fails

**Symptoms:**
- "error: linking with `cc` failed"
- Compilation errors in Rust code
- "could not find `lib` in `core`"

**Diagnosis:**
```bash
# Check Rust toolchain
rustup show

# Check Cargo.toml
cat src-tauri/Cargo.toml

# Run with verbose output
cd src-tauri
cargo tauri dev --verbose
```

**Solutions:**

1. **Clean Build**
   ```bash
   cd src-tauri
   cargo clean

   # Rebuild
   cargo tauri dev
   ```

2. **Update Dependencies**
   ```bash
   cd src-tauri
   cargo update

   # Rebuild
   cargo tauri dev
   ```

3. **Check Tauri Configuration**
   ```bash
   # Validate tauri.conf.json
   cd src-tauri
   cargo tauri info

   # Fix any reported issues
   ```

### Issue: Next.js Build Not Found

**Symptoms:**
- "dist directory not found"
- "failed to bundle project"
- Tauri window opens but shows blank page

**Diagnosis:**
```bash
# Check if Next.js built output exists
ls -la out/

# Check Tauri config points to correct location
grep -A 3 '"frontendDist"' src-tauri/tauri.conf.json
```

**Solutions:**

1. **Build Next.js First**
   ```bash
   # From project root
   npm run build

   # Verify output
   ls -la out/

   # Then run Tauri dev
   cd src-tauri
   cargo tauri dev
   ```

2. **Fix Frontend Path**
   ```bash
   # Edit src-tauri/tauri.conf.json
   # Ensure "frontendDist" points to "../out"

   # Example:
   # "build": {
   #   "frontendDist": "../out"
   # }
   ```

3. **Use Automated Build**
   ```bash
   # Let Tauri run Next.js dev server
   # Edit src-tauri/tauri.conf.json

   # Add beforeDevCommand:
   # "build": {
   #   "beforeDevCommand": "npm run dev",
   #   "devUrl": "http://localhost:3000"
   # }
   ```

---

## Apple Virtualization Setup

### Issue: Swift Not Available

**Symptoms:**
- "swift: command not found"
- Cannot compile Swift code

**Solutions:**

```bash
# Install Xcode Command Line Tools (includes Swift)
xcode-select --install

# Verify Swift
swift --version

# If Xcode is installed
xcodebuild -version

# Switch to Xcode Swift
sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
```

### Issue: Insufficient RAM

**Symptoms:**
- VM fails to start
- "insufficient memory" errors
- System becomes unresponsive

**Diagnosis:**
```bash
# Check available RAM
sysctl hw.memsize

# Check RAM usage
top -l 1 | grep PhysMem

# Minimum requirement: 16GB total
# Recommended: 32GB for smooth operation
```

**Solutions:**

1. **Close Other Applications**
   ```bash
   # Free up memory before starting VM
   # Close browsers, IDEs, Docker Desktop

   # Check memory again
   top -l 1 | grep PhysMem
   ```

2. **Adjust VM Memory Allocation**
   ```bash
   # Edit VM configuration to use less RAM
   # Reduce from 8GB to 4GB if needed

   # In VM config:
   # memory = 4 * 1024 * 1024 * 1024  # 4GB instead of 8GB
   ```

3. **Enable Swap**
   ```bash
   # macOS manages swap automatically
   # But you can check swap usage
   sysctl vm.swapusage
   ```

### Issue: VM Image Download Fails

**Symptoms:**
- "failed to download restore image"
- Network timeout errors
- Partial download

**Solutions:**

1. **Manual Download**
   ```bash
   # Download directly from Apple
   # Visit: https://support.apple.com/macos/restore-images

   # Or use softwareupdate
   softwareupdate --list-full-installers

   # Download specific version
   softwareupdate --fetch-full-installer --full-installer-version 14.0
   ```

2. **Check Network Connection**
   ```bash
   # Test connection
   ping -c 5 swscan.apple.com

   # Check DNS
   nslookup swscan.apple.com

   # Try different network if on VPN
   ```

3. **Resume Failed Download**
   ```bash
   # If download was interrupted, retry
   # The script should resume from where it left off

   # Check downloaded chunks
   ls -lah ~/.cache/vibecode-vm/
   ```

### Issue: VM Fails to Boot

**Symptoms:**
- Black screen in VM window
- "kernel panic" errors
- VM crashes on startup

**Diagnosis:**
```bash
# Check VM logs
tail -f logs/vm-output.log

# Check system logs
log show --predicate 'process == "Virtualization"' --last 5m
```

**Solutions:**

1. **Recreate VM**
   ```bash
   # Stop VM
   pkill -f vibecode-vm

   # Remove VM state
   rm -rf ~/.local/share/vibecode-vm/

   # Reinstall VM
   npm run vm:setup
   ```

2. **Check macOS Version Compatibility**
   ```bash
   # Apple Virtualization requires:
   # - macOS 12.0+ (Monterey) for basic support
   # - macOS 13.0+ (Ventura) for full features

   sw_vers
   ```

3. **Verify Entitlements**
   ```bash
   # Ensure the binary has virtualization entitlements
   codesign -d --entitlements - path/to/binary

   # Should include:
   # <key>com.apple.security.virtualization</key>
   # <true/>
   ```

---

## Dependency Installation

### Issue: npm install Fails

**Symptoms:**
- "EACCES: permission denied"
- "peer dependency" warnings
- Package installation hangs

**Solutions:**

1. **Fix Permissions**
   ```bash
   # Never use sudo with npm!
   # Instead, fix npm permissions

   # Create npm global directory
   mkdir ~/.npm-global
   npm config set prefix '~/.npm-global'

   # Add to PATH
   echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
   source ~/.bashrc

   # Retry install
   npm install
   ```

2. **Clear npm Cache**
   ```bash
   # Clear cache
   npm cache clean --force

   # Remove node_modules
   rm -rf node_modules package-lock.json

   # Fresh install
   npm install
   ```

3. **Handle Peer Dependency Warnings**
   ```bash
   # For warnings (not errors), use legacy peer deps
   npm install --legacy-peer-deps

   # Or force (not recommended)
   npm install --force
   ```

### Issue: Native Module Compilation Fails

**Symptoms:**
- "gyp ERR! build error"
- "node-gyp rebuild" failures
- Python version errors

**Solutions:**

**macOS:**
```bash
# Install Python (node-gyp requires Python 3)
brew install python@3.11

# Set Python version for node-gyp
npm config set python python3

# Install build tools
xcode-select --install

# Retry installation
npm install
```

**Linux:**
```bash
# Install build essentials
sudo apt-get install -y build-essential python3

# Install node-gyp globally
npm install -g node-gyp

# Retry installation
npm install
```

---

## Port Conflicts

### Issue: Port Already in Use

**Symptoms:**
- "EADDRINUSE: address already in use"
- "Port 3000 is already allocated"
- Services fail to start

**Diagnosis:**
```bash
# Check what's using the port
lsof -i :3000

# Or on Linux
netstat -tulpn | grep 3000

# Check common ports
lsof -i :3000  # VibeCode web
lsof -i :5432  # PostgreSQL
lsof -i :6379  # Redis/Valkey
lsof -i :2222  # SSH
```

**Solutions:**

1. **Kill Conflicting Process**
   ```bash
   # Get PID from lsof output
   lsof -i :3000

   # Kill process
   kill -9 <PID>

   # Or kill all Node processes
   pkill -9 node
   ```

2. **Change Application Port**
   ```bash
   # For development
   PORT=3001 npm run dev

   # For Docker Compose
   # Edit docker-compose.yml:
   # ports:
   #   - "3001:3000"  # Map 3001 on host to 3000 in container
   ```

3. **Change Database Port**
   ```bash
   # Edit docker-compose.yml for PostgreSQL:
   # ports:
   #   - "5433:5432"  # Use 5433 on host

   # Update DATABASE_URL in .env:
   # DATABASE_URL=postgresql://postgres:password@localhost:5433/vibecode
   ```

---

## Permission Issues

### Issue: Permission Denied Errors

**Symptoms:**
- "EACCES: permission denied"
- "cannot create directory"
- Docker socket permission errors

**Solutions:**

1. **File Permissions**
   ```bash
   # Fix project directory permissions
   sudo chown -R $USER:$USER .

   # Make scripts executable
   chmod +x scripts/*.sh
   ```

2. **Docker Socket Permissions (Linux)**
   ```bash
   # Add user to docker group
   sudo usermod -aG docker $USER

   # Apply group changes
   newgrp docker

   # Verify
   docker ps
   ```

3. **npm Global Permissions**
   ```bash
   # Fix npm global directory
   mkdir ~/.npm-global
   npm config set prefix '~/.npm-global'

   # Add to PATH
   echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
   source ~/.bashrc
   ```

### Issue: Cannot Write to Logs Directory

**Symptoms:**
- "cannot write to logs/application.log"
- "ENOENT: no such file or directory"

**Solutions:**

```bash
# Create logs directory
mkdir -p logs

# Set correct permissions
chmod 755 logs

# Create log files if needed
touch logs/application.log
chmod 644 logs/application.log
```

---

## Network and Connectivity

### Issue: Cannot Reach External Services

**Symptoms:**
- "network unreachable"
- "connection timeout"
- Docker containers cannot access internet

**Diagnosis:**
```bash
# Test basic connectivity
ping -c 3 google.com

# Test DNS
nslookup github.com

# Test from Docker container
docker run --rm alpine ping -c 3 google.com
```

**Solutions:**

1. **DNS Issues**
   ```bash
   # macOS: Flush DNS cache
   sudo dscacheutil -flushcache
   sudo killall -HUP mDNSResponder

   # Linux: Check DNS settings
   cat /etc/resolv.conf
   ```

2. **Docker Network Issues**
   ```bash
   # Restart Docker
   # macOS: Restart Docker Desktop

   # Linux:
   sudo systemctl restart docker

   # Reset Docker networks
   docker network prune -f
   ```

3. **Firewall/VPN Issues**
   ```bash
   # Check if VPN is interfering
   # Try disconnecting VPN temporarily

   # Check firewall rules (macOS)
   sudo pfctl -s rules

   # Check firewall rules (Linux)
   sudo iptables -L
   ```

### Issue: Services Cannot Communicate

**Symptoms:**
- "connection refused" between containers
- Services timeout when calling each other
- DNS resolution fails in Docker network

**Diagnosis:**
```bash
# Check Docker network
docker network ls
docker network inspect vibecode_default

# Test connectivity between containers
docker-compose exec vibecode ping postgres
docker-compose exec vibecode nc -zv postgres 5432
```

**Solutions:**

1. **Verify Network Configuration**
   ```bash
   # Check docker-compose.yml networks section
   # Ensure all services are on same network

   # Recreate network
   docker-compose down
   docker network rm vibecode_default
   docker-compose up -d
   ```

2. **Use Service Names**
   ```bash
   # In Docker Compose, use service names as hostnames
   # Example DATABASE_URL:
   # postgresql://postgres:password@postgres:5432/vibecode
   #                                 ^^^^^^^^
   #                            Service name, not 'localhost'
   ```

---

## Getting Help

### Support Channels

- **Documentation**: [docs/setup/](.)
- **Main Troubleshooting**: [../TROUBLESHOOTING.md](../TROUBLESHOOTING.md)
- **GitHub Issues**: Report bugs and request features
- **Community**: Join discussions in project repository

### Before Asking for Help

Gather this information:

```bash
# System information
uname -a
sw_vers  # macOS only

# Software versions
node --version
npm --version
docker --version
docker-compose --version

# Project information
git rev-parse HEAD  # Current commit
git status          # Uncommitted changes

# Error logs
docker-compose logs --tail=100 > error-logs.txt
kubectl logs <pod-name> -n vibecode > pod-logs.txt
```

### Creating a Bug Report

Include:

1. **Environment**: OS, versions, deployment mode
2. **Steps to reproduce**: Exact commands run
3. **Expected behavior**: What should happen
4. **Actual behavior**: What actually happened
5. **Logs**: Relevant error messages and logs
6. **Configuration**: Sanitized .env and config files

---

## Additional Resources

- [Getting Started Guide](./GETTING_STARTED.md) - Initial setup walkthrough
- [Docker Compose Setup](./DOCKER_COMPOSE_SETUP.md) - Docker-specific issues
- [KIND Kubernetes Setup](./KIND_KUBERNETES_SETUP.md) - Kubernetes-specific issues
- [Tauri Desktop Setup](./TAURI_DESKTOP_SETUP.md) - Desktop app-specific issues
- [Apple Virtualization Setup](./APPLE_VIRTUALIZATION_SETUP.md) - VM-specific issues
- [Main Troubleshooting Guide](../TROUBLESHOOTING.md) - Operational issues

---

**Last Updated**: February 21, 2026
**Version**: 1.0
