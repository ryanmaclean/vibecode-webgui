# VibeCode CLI - User Guide

**Version:** 3.2.0
**Author:** VibeCode Team
**Updated:** 2026-01-14

---

## Table of Contents

1. [Introduction](#introduction)
2. [Installation](#installation)
3. [Quick Start](#quick-start)
4. [Commands Reference](#commands-reference)
5. [Services Overview](#services-overview)
6. [Troubleshooting](#troubleshooting)
7. [Examples](#examples)
8. [FAQ](#faq)

---

## Introduction

The VibeCode CLI is a comprehensive command-line tool for managing the VibeCode Unified Services application. It provides a simple interface to:

- Build the menubar app from source
- Start, stop, and restart the VM
- Check service availability
- SSH into the VM
- Monitor VM status and resource usage
- Access Docker, Valkey, PostgreSQL, and OpenVSCode Server

### Features

- **Color-coded output** for easy reading
- **Service health checks** with detailed status
- **Auto-detection** of IDE type (code-server vs OpenVSCode Server)
- **Docker integration** with automatic DOCKER_HOST setup
- **SSH shortcuts** for quick access
- **Resource monitoring** (CPU, memory usage)
- **Tab completion** for Bash and Zsh

---

## Installation

### Automatic Installation

Run the installation script:

```bash
cd /Users/ryan.maclean/vibecode-webgui
./install-vibecode-cli.sh
```

This installs to `/usr/local/bin` (system-wide).

**User installation** (no sudo required):

```bash
./install-vibecode-cli.sh --user
```

This installs to `~/.local/bin`.

### Manual Installation

1. **Copy the CLI script:**
   ```bash
   sudo cp vibecode /usr/local/bin/vibecode
   sudo chmod +x /usr/local/bin/vibecode
   ```

2. **Install bash completion (optional):**
   ```bash
   sudo cp vibecode-completion.bash /usr/local/etc/bash_completion.d/vibecode
   ```

3. **Install zsh completion (optional):**
   ```bash
   sudo cp vibecode-completion.zsh /usr/local/share/zsh/site-functions/_vibecode
   ```

### Verify Installation

```bash
vibecode version
```

---

## Quick Start

### 1. Build the App

```bash
vibecode build
```

This compiles the Swift sources and creates the menubar app.

### 2. Start VibeCode

```bash
vibecode start
```

The app starts as a menubar application (look for the icon in your menubar).

### 3. Check Status

```bash
vibecode status
```

Shows VM status, services, and resource usage.

### 4. Check Services

```bash
vibecode check
```

Verifies all services are accessible:
- SSH (port 2222)
- Valkey (port 6379)
- PostgreSQL (port 5432)
- OpenVSCode (port 8080)
- Docker (port 2375)

### 5. Access Services

**SSH into VM:**
```bash
vibecode ssh
```

**List all services:**
```bash
vibecode services
```

**Check Docker:**
```bash
vibecode docker
```

---

## Commands Reference

### `vibecode build`

Build the menubar app from source.

**Requirements:**
- Xcode with Swift toolchain
- Xcode Command Line Tools

**Output:**
- Built app at: `Apps/UnifiedServicesVibeCodeApp.app`

**Example:**
```bash
vibecode build
```

---

### `vibecode start`

Start the VibeCode menubar app and VM.

**Behavior:**
- Opens the menubar app
- VM boots in background
- Takes 1-2 minutes to fully boot
- Check status with `vibecode status`

**Example:**
```bash
vibecode start
```

---

### `vibecode stop`

Stop the VibeCode app and VM.

**Behavior:**
- Gracefully stops the VM
- Terminates the app process

**Example:**
```bash
vibecode stop
```

---

### `vibecode restart`

Restart the app and VM.

**Behavior:**
- Stops the VM
- Waits 2 seconds
- Starts the VM

**Example:**
```bash
vibecode restart
```

---

### `vibecode status`

Show comprehensive status report.

**Output:**
- VM status (running/stopped)
- VM PID
- VM IP address
- Services status
- Resource usage (CPU, memory)
- IDE type detection

**Example:**
```bash
vibecode status
```

**Sample Output:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  VibeCode Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ VM Status: Running (PID: 12345)
→ VM IP: 192.168.64.3

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Services Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ SSH: localhost:2222
✓ Valkey: localhost:6379
✓ PostgreSQL: localhost:5432
✓ OpenVSCode: http://localhost:8080
✓ Docker: localhost:2375

→ IDE Type: OpenVSCode Server

✓ All services operational (5/5)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Resource Usage
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  RSS:  66 MB
  VSZ:  4123 MB
  CPU:  2.5%
  MEM:  0.8%
```

---

### `vibecode check`

Check all services availability.

**Output:**
- Service status (✓ accessible / ✗ not accessible)
- IDE type detection
- Success rate summary

**Example:**
```bash
vibecode check
```

---

### `vibecode services`

List all services with ports and connection commands.

**Output:**
- Service name
- Port number
- Connection command/URL

**Example:**
```bash
vibecode services
```

**Sample Output:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  VibeCode Services
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SERVICE       PORT   URL/CONNECTION
─────────────────────────────────────────────────────────────
SSH           2222   ssh root@localhost -p 2222
Valkey        6379   valkey-cli -h localhost -p 6379
PostgreSQL    5432   psql -h localhost -p 5432 -U postgres
OpenVSCode    8080   http://localhost:8080
Docker        2375   export DOCKER_HOST=tcp://localhost:2375
```

---

### `vibecode ssh`

SSH into the VM interactively.

**Default Credentials:**
- Username: `root`
- Password: `vibecode`

**Behavior:**
- Opens interactive SSH session
- Disables host key checking (for convenience)

**Example:**
```bash
vibecode ssh
```

**Inside VM:**
```bash
# Check running services
ps aux | grep -E "valkey|postgres|openvscode"

# Check network
ip addr show

# Test Valkey
valkey-cli ping

# Test PostgreSQL
psql -U postgres -c "SELECT version();"
```

---

### `vibecode logs`

Show VM console logs (if available).

**Note:** Logs may not be available depending on VM configuration.

**Example:**
```bash
vibecode logs
```

---

### `vibecode docker`

Check Docker status and display info.

**Behavior:**
- Sets `DOCKER_HOST` environment variable
- Checks Docker daemon accessibility
- Shows Docker version
- Shows Docker info

**Example:**
```bash
vibecode docker
```

**To use Docker:**
```bash
export DOCKER_HOST=tcp://localhost:2375
docker ps
docker images
docker run hello-world
```

---

### `vibecode ip`

Show VM IP address from ARP table.

**Output:**
- VM IP address
- SSH command to connect

**Example:**
```bash
vibecode ip
```

---

### `vibecode version`

Show version information.

**Output:**
- CLI version
- App version
- Project root
- App path

**Example:**
```bash
vibecode version
```

---

### `vibecode help`

Show help message with all commands.

**Example:**
```bash
vibecode help
```

---

## Services Overview

### SSH (Port 2222)

**Purpose:** Remote shell access to VM

**Connection:**
```bash
ssh root@localhost -p 2222
# Password: vibecode
```

**Or use CLI:**
```bash
vibecode ssh
```

---

### Valkey (Port 6379)

**Purpose:** Redis-compatible in-memory data store

**Connection:**
```bash
valkey-cli -h localhost -p 6379
```

**Test:**
```bash
valkey-cli -h localhost -p 6379 ping
# Expected: PONG
```

**Basic Commands:**
```bash
valkey-cli -h localhost -p 6379
127.0.0.1:6379> SET mykey "Hello"
127.0.0.1:6379> GET mykey
127.0.0.1:6379> KEYS *
```

---

### PostgreSQL (Port 5432)

**Purpose:** Relational database

**Connection:**
```bash
psql -h localhost -p 5432 -U postgres
```

**Test:**
```bash
psql -h localhost -p 5432 -U postgres -c "SELECT version();"
```

**Create Database:**
```bash
psql -h localhost -p 5432 -U postgres
postgres=# CREATE DATABASE myapp;
postgres=# \l
postgres=# \c myapp
myapp=# CREATE TABLE users (id SERIAL PRIMARY KEY, name VARCHAR(100));
```

---

### OpenVSCode Server (Port 8080)

**Purpose:** Web-based VS Code IDE

**Access:**
- Open browser: http://localhost:8080

**Features:**
- Full VS Code experience
- Extensions support
- Terminal access
- Git integration

**Persistent Data:**
- User data stored in: `~/Library/Application Support/VibeCode/vm-data/vscode-data`

---

### Docker (Port 2375)

**Purpose:** Container runtime

**Setup:**
```bash
export DOCKER_HOST=tcp://localhost:2375
```

**Or use CLI:**
```bash
vibecode docker
```

**Test:**
```bash
docker ps
docker images
docker run hello-world
```

**Build and Run:**
```bash
docker build -t myapp .
docker run -p 3000:3000 myapp
```

---

## Troubleshooting

### VM Won't Start

**Symptoms:**
- `vibecode start` completes but services not available
- `vibecode status` shows "VM Status: Stopped"

**Solutions:**

1. **Check if app exists:**
   ```bash
   ls -la /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/Apps/UnifiedServicesVibeCodeApp.app
   ```

   If not found, run:
   ```bash
   vibecode build
   ```

2. **Check for previous instances:**
   ```bash
   ps aux | grep UnifiedServicesVibeCode
   pkill -f UnifiedServicesVibeCode
   vibecode start
   ```

3. **Check system resources:**
   - Requires: 2GB RAM, 4 CPU cores
   - Free disk space: 500MB minimum

---

### Services Not Accessible

**Symptoms:**
- `vibecode check` shows ✗ for services
- Can't connect to ports

**Solutions:**

1. **Wait for VM to fully boot:**
   ```bash
   # VM takes 1-2 minutes to boot
   sleep 60
   vibecode check
   ```

2. **Check VM is running:**
   ```bash
   vibecode status
   ```

3. **Restart VM:**
   ```bash
   vibecode restart
   ```

4. **Check port conflicts:**
   ```bash
   # Check if ports are in use by other processes
   lsof -i :2222
   lsof -i :6379
   lsof -i :5432
   lsof -i :8080
   lsof -i :2375
   ```

---

### SSH Connection Fails

**Symptoms:**
- `vibecode ssh` can't connect
- "Connection refused" error

**Solutions:**

1. **Check SSH port is open:**
   ```bash
   nc -zv localhost 2222
   ```

2. **Wait for VM boot:**
   ```bash
   vibecode status
   # Wait until services show ✓
   ```

3. **Manual SSH with debug:**
   ```bash
   ssh -v root@localhost -p 2222
   ```

---

### Docker Not Working

**Symptoms:**
- `docker` commands fail
- "Cannot connect to Docker daemon" error

**Solutions:**

1. **Set DOCKER_HOST:**
   ```bash
   export DOCKER_HOST=tcp://localhost:2375
   docker ps
   ```

2. **Check Docker port:**
   ```bash
   nc -zv localhost 2375
   ```

3. **Use CLI helper:**
   ```bash
   vibecode docker
   ```

---

### Build Fails

**Symptoms:**
- `vibecode build` exits with error
- Swift compilation errors

**Solutions:**

1. **Check Swift installation:**
   ```bash
   swift --version
   swiftc --version
   ```

2. **Install Xcode Command Line Tools:**
   ```bash
   xcode-select --install
   ```

3. **Check disk space:**
   ```bash
   df -h
   ```

4. **Manual build:**
   ```bash
   cd /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps
   ./build-unified-menubar.sh
   ```

---

## Examples

### Example 1: Fresh Start

```bash
# Build the app
vibecode build

# Start VibeCode
vibecode start

# Wait for boot (1-2 minutes)
sleep 120

# Check all services
vibecode check

# Open OpenVSCode in browser
open http://localhost:8080
```

---

### Example 2: Development Workflow

```bash
# SSH into VM
vibecode ssh

# Inside VM: Install packages
apk add --no-cache curl wget

# Test Valkey
valkey-cli ping

# Exit SSH
exit

# Check Docker
vibecode docker
export DOCKER_HOST=tcp://localhost:2375
docker ps
```

---

### Example 3: Service Testing

```bash
# Start VM
vibecode start

# Wait for boot
sleep 120

# Test SSH
ssh root@localhost -p 2222 "hostname"

# Test Valkey
valkey-cli -h localhost -p 6379 ping

# Test PostgreSQL
psql -h localhost -p 5432 -U postgres -c "SELECT 1;"

# Test OpenVSCode
curl -I http://localhost:8080

# Test Docker
export DOCKER_HOST=tcp://localhost:2375
docker info
```

---

### Example 4: Monitoring

```bash
# Watch status in real-time
watch -n 5 vibecode status

# Or manual loop
while true; do
  clear
  vibecode status
  sleep 5
done
```

---

### Example 5: Debugging

```bash
# Check VM process
ps aux | grep UnifiedServicesVibeCode

# Check open ports
lsof -i -P | grep LISTEN | grep -E "2222|6379|5432|8080|2375"

# Check ARP table
arp -an | grep 192.168.64

# Get VM IP
vibecode ip

# SSH to VM IP
ssh root@$(vibecode ip | grep "VM IP:" | awk '{print $3}')
```

---

## FAQ

### Q: How long does the VM take to boot?

**A:** Typically 1-2 minutes. Use `vibecode status` to check progress.

---

### Q: Can I run multiple instances?

**A:** No, only one VM instance is supported at a time.

---

### Q: Where is data stored?

**A:** Persistent data is stored in:
```
~/Library/Application Support/VibeCode/vm-data/
├── postgresql/     (PostgreSQL data)
├── valkey/         (Valkey AOF files)
└── vscode-data/    (OpenVSCode settings)
```

---

### Q: How do I update the app?

**A:**
```bash
cd /Users/ryan.maclean/vibecode-webgui
git pull
vibecode build
vibecode restart
```

---

### Q: What's the difference between code-server and OpenVSCode Server?

**A:** Both provide VS Code in the browser. OpenVSCode Server is the official open-source version. Use `vibecode check` to see which one is running.

---

### Q: Can I change service ports?

**A:** Port forwarding is configured in the Swift app. You would need to modify `VMPortForwarder` configuration and rebuild.

---

### Q: How do I uninstall?

**A:**
```bash
sudo rm /usr/local/bin/vibecode
sudo rm /usr/local/etc/bash_completion.d/vibecode
sudo rm /usr/local/share/zsh/site-functions/_vibecode
```

Or for user installation:
```bash
rm ~/.local/bin/vibecode
rm ~/.local/share/bash-completion/completions/vibecode
rm ~/.local/share/zsh/site-functions/_vibecode
```

---

### Q: How much memory does the VM use?

**A:** Typically 66-128 MB RSS. Check with `vibecode status`.

---

### Q: Can I access services from other machines?

**A:** No, services are bound to localhost only. This is a security feature.

---

### Q: What if services conflict with existing services?

**A:** You'll need to stop conflicting services:
```bash
# Find what's using a port
lsof -i :6379
# Kill the process
kill <PID>
```

---

## Additional Resources

- **Project Repository:** https://github.com/ryanmaclean/vibecode-webgui
- **Build Script:** `azure/SwiftUI-Apps/build-unified-menubar.sh`
- **VM Manager:** `azure/SwiftUI-Apps/Apps/UnifiedServicesVibeCodeApp/UnifiedServicesVMManager.swift`
- **Port Forwarder:** `azure/SwiftUI-Apps/Shared/Networking/VMPortForwarder.swift`

---

**Last Updated:** 2026-01-14
**Version:** 3.2.0
**Author:** VibeCode Team
