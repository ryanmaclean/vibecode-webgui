# VibeCode VM - Unified Tool Guide

**Version 1.0.0**

A simple, polished tool for managing complete development environments in lightweight VMs.

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Installation](#installation)
4. [Usage](#usage)
5. [Configuration](#configuration)
6. [Services](#services)
7. [Advanced Usage](#advanced-usage)
8. [Troubleshooting](#troubleshooting)
9. [Architecture](#architecture)

---

## Overview

VibeCode VM packages a complete development environment into a single, easy-to-use tool. It includes:

### What's Inside

- **SSH Server** (Dropbear) - Secure remote access
- **Valkey 8.0** - Redis-compatible in-memory cache
- **PostgreSQL 16** - Full-featured relational database
- **OpenVSCode Server 1.95** - Web-based IDE with VS Code experience
- **VirtioFS** - Fast file sharing between host and VM

### Key Features

- **Single Command**: Start everything with `vibecode-vm start`
- **Auto-Configuration**: Network and services configure automatically
- **Fast Boot**: ~5-10 seconds from start to ready
- **Lightweight**: Only 59MB initramfs, minimal memory overhead
- **Shared Storage**: Seamless file sharing with host
- **Optional Monitoring**: Built-in Datadog integration

### System Requirements

- **macOS** (Apple Silicon or Intel)
- **vfkit** (VM runtime)
- **2GB+ RAM** recommended
- **1GB+ disk space** for installation

---

## Quick Start

```bash
# 1. Install
./install.sh

# 2. Start the VM
vibecode-vm start

# 3. Check status
vibecode-vm status

# 4. Connect
vibecode-vm ssh          # SSH access
open http://<IP>:8080    # OpenVSCode in browser
```

That's it! All services are running and ready to use.

---

## Installation

### Prerequisites

Install vfkit (required):
```bash
brew install vfkit
```

Optional but recommended:
```bash
# For passwordless SSH
brew install hudochenkov/sshpass/sshpass

# For service status checks (usually pre-installed)
brew install netcat
```

### Install VibeCode VM

```bash
# Clone or download the repository
cd vibecode-webgui

# Run installation
./install.sh
```

The installer will:
1. Check prerequisites
2. Copy VM images to `~/.vibecode-vm/`
3. Install `vibecode-vm` command to `~/.local/bin/`
4. Create default configuration
5. Set up shared directory at `~/vibecode-shared/`

### Post-Install

Restart your shell or run:
```bash
export PATH="$HOME/.local/bin:$PATH"
```

Verify installation:
```bash
vibecode-vm version
```

---

## Usage

### Basic Commands

#### Start the VM
```bash
vibecode-vm start
```

Start with custom resources:
```bash
vibecode-vm start --cpus 4 --memory 4096
```

Start with GUI (visual console):
```bash
vibecode-vm start --gui
```

#### Stop the VM
```bash
vibecode-vm stop
```

#### Restart the VM
```bash
vibecode-vm restart
```

#### Check Status
```bash
vibecode-vm status
```

Output includes:
- VM running state
- IP address
- Service availability (SSH, Valkey, PostgreSQL, OpenVSCode)
- Connection details

#### SSH Access
```bash
vibecode-vm ssh
```

Default credentials:
- **Username**: `root`
- **Password**: `vibecode`

#### View Logs
```bash
# Show all console logs
vibecode-vm logs

# Follow logs in real-time
vibecode-vm logs -f
```

#### Configuration
```bash
# Show current config
vibecode-vm config show

# Edit config
vibecode-vm config edit

# Show config file path
vibecode-vm config path
```

#### Help & Version
```bash
vibecode-vm help
vibecode-vm version
```

---

## Configuration

### Configuration File

Location: `~/.vibecode-vm/config`

### Default Configuration

```bash
# VM Resources
VM_CPUS=2                 # CPU cores
VM_MEMORY=2048            # Memory in MB

# VM Images (auto-configured)
VM_KERNEL="~/.vibecode-vm/bin/linux-kernel-arm64"
VM_INITRAMFS="~/.vibecode-vm/bin/unified-services.cpio.gz"

# Shared Directory
VM_SHARED_DIR="~/vibecode-shared"

# Datadog Integration (optional)
# DD_API_KEY="your_api_key"
# DD_SITE="datadoghq.com"
# DD_HOSTNAME="vibecode-vm"
```

### Customization

Edit the config:
```bash
vibecode-vm config edit
```

Common customizations:

#### More Resources
```bash
VM_CPUS=4
VM_MEMORY=4096  # 4GB
```

#### Different Shared Directory
```bash
VM_SHARED_DIR="/path/to/your/projects"
```

#### Enable Datadog Monitoring
```bash
DD_API_KEY="your_datadog_api_key"
DD_SITE="datadoghq.com"
DD_HOSTNAME="my-vibecode-vm"
```

Changes take effect on next VM start.

---

## Services

### Service Overview

All services start automatically when the VM boots.

| Service | Port | Purpose | Access |
|---------|------|---------|--------|
| SSH | 22 | Secure shell access | `ssh root@<VM_IP>` |
| Valkey | 6379 | Redis-compatible cache | `redis-cli -h <VM_IP>` |
| PostgreSQL | 5432 | SQL database | `psql -h <VM_IP> -U postgres` |
| OpenVSCode | 8080 | Web IDE | `http://<VM_IP>:8080` |

### SSH Access

#### Using the convenience command:
```bash
vibecode-vm ssh
```

#### Manual SSH:
```bash
ssh root@<VM_IP>
# Password: vibecode
```

#### SSH Keys (recommended for automation):
```bash
# Copy your public key to VM
ssh-copy-id root@<VM_IP>
```

### Valkey (Redis)

Valkey is a Redis fork with full compatibility.

#### Connect with redis-cli:
```bash
redis-cli -h <VM_IP> -p 6379
```

#### Example usage:
```bash
# Set a key
SET mykey "Hello from VibeCode"

# Get a key
GET mykey

# Check info
INFO server
```

#### Inside the VM:
```bash
vibecode-vm ssh
valkey-cli
```

#### Configuration:
- Config file: `/etc/valkey.conf`
- Log file: `/tmp/valkey.log`
- Data persistence: `/tmp/dump.rdb` (or `/mnt/host/valkey/` if using shared storage)

### PostgreSQL 16

Full-featured PostgreSQL database.

#### Connect:
```bash
# Using psql
psql -h <VM_IP> -p 5432 -U postgres -d postgres
```

#### Connection string:
```
postgresql://postgres@<VM_IP>:5432/postgres
```

#### Inside the VM:
```bash
vibecode-vm ssh
psql -U postgres
```

#### Features:
- **Extensions**: vector, pg_trgm, hstore, uuid-ossp, and more
- **Authentication**: Trust mode (no password) for development
- **Data directory**: `/var/lib/postgresql/data` (or `/mnt/host/postgresql/` for persistence)

#### Common operations:
```sql
-- Create database
CREATE DATABASE myapp;

-- List databases
\l

-- Connect to database
\c myapp

-- Create table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name TEXT,
    email TEXT UNIQUE
);

-- Install extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

### OpenVSCode Server

Full VS Code experience in the browser.

#### Access:
```bash
# Get VM IP
vibecode-vm status

# Open in browser
open http://<VM_IP>:8080
```

#### Features:
- Full VS Code UI and features
- Terminal access (runs inside VM)
- Git integration
- Extension support
- File explorer

#### Default workspace:
- Inside VM: `/root/`
- Access shared files: `/mnt/host/`

#### Customization:
Settings are stored in `/tmp/vscode-data/` inside the VM.

---

## Advanced Usage

### Shared Directory

The shared directory allows seamless file exchange between host and VM.

#### Locations:
- **Host**: `~/vibecode-shared/`
- **VM**: `/mnt/host/`

#### Use Cases:

##### 1. Persistent Database Storage
```bash
# On host, create directory
mkdir -p ~/vibecode-shared/postgresql

# Inside VM, PostgreSQL will auto-detect and use:
# /mnt/host/postgresql/
```

##### 2. Application Development
```bash
# Develop on host
cd ~/vibecode-shared/myapp
echo "console.log('Hello');" > app.js

# Run inside VM
vibecode-vm ssh
cd /mnt/host/myapp
node app.js
```

##### 3. Configuration Files
```bash
# Share configs
cp myconfig.conf ~/vibecode-shared/config/

# Access in VM
vibecode-vm ssh
cat /mnt/host/config/myconfig.conf
```

##### 4. Log Collection
```bash
# Inside VM, write logs to shared dir
echo "log data" > /mnt/host/logs/app.log

# View on host
cat ~/vibecode-shared/logs/app.log
```

### Resource Management

#### Adjust Resources:
```bash
# Edit config
vibecode-vm config edit

# Set resources
VM_CPUS=4
VM_MEMORY=4096

# Restart to apply
vibecode-vm restart
```

#### Or use command-line flags:
```bash
vibecode-vm start --cpus 4 --memory 4096
```

### Monitoring with Datadog

Enable metrics collection and monitoring.

#### Setup:
1. Get Datadog API key from https://app.datadoghq.com
2. Edit config:
   ```bash
   vibecode-vm config edit
   ```
3. Set variables:
   ```bash
   DD_API_KEY="your_api_key_here"
   DD_SITE="datadoghq.com"
   DD_HOSTNAME="vibecode-vm"
   ```
4. Restart VM:
   ```bash
   vibecode-vm restart
   ```

#### Metrics Collection:
- StatsD endpoint: `127.0.0.1:8125` (inside VM)
- Metrics flush: Every 30 seconds
- Dashboard: https://app.datadoghq.com

### Multiple VM Instances

You can run multiple instances with different configurations.

```bash
# Use environment variable to change home directory
VIBECODE_HOME=~/.vibecode-vm-dev vibecode-vm start
VIBECODE_HOME=~/.vibecode-vm-prod vibecode-vm start

# Or create wrapper scripts
echo 'export VIBECODE_HOME=~/.vibecode-vm-dev' > ~/bin/vibecode-vm-dev
echo 'vibecode-vm "$@"' >> ~/bin/vibecode-vm-dev
chmod +x ~/bin/vibecode-vm-dev
```

---

## Troubleshooting

### VM Won't Start

#### Check vfkit:
```bash
which vfkit
vfkit --version
```

Install if missing:
```bash
brew install vfkit
```

#### Check logs:
```bash
cat ~/.vibecode-vm/vfkit.log
```

#### Verify files:
```bash
vibecode-vm config show
ls -lh ~/.vibecode-vm/bin/
```

### Can't Connect to Services

#### Check VM is running:
```bash
vibecode-vm status
```

#### Get VM IP:
```bash
vibecode-vm logs | grep "VM IP"
```

#### Test connectivity:
```bash
# Test SSH
nc -zv <VM_IP> 22

# Test OpenVSCode
nc -zv <VM_IP> 8080

# Test PostgreSQL
nc -zv <VM_IP> 5432
```

#### Check firewall:
macOS Firewall may block connections. Allow vfkit in System Preferences > Security & Privacy > Firewall.

### Services Not Starting

#### SSH into VM:
```bash
vibecode-vm ssh
```

#### Check service logs:
```bash
cat /tmp/valkey.log
cat /tmp/postgresql.log
cat /tmp/openvscode.log
```

#### Check processes:
```bash
ps aux | grep valkey
ps aux | grep postgres
ps aux | grep openvscode
```

### Network Issues

#### Check interface:
```bash
vibecode-vm ssh
ip addr show
```

#### Check routes:
```bash
ip route show
```

#### Test gateway:
```bash
ping -c 3 192.168.64.1
```

#### Check DHCP:
```bash
vibecode-vm logs | grep -i dhcp
```

### Performance Issues

#### Increase resources:
```bash
vibecode-vm config edit
# Set VM_CPUS=4 and VM_MEMORY=4096
vibecode-vm restart
```

#### Check host resources:
```bash
# Available memory
sysctl hw.memsize

# CPU info
sysctl hw.ncpu
```

### Shared Directory Not Working

#### Verify mount inside VM:
```bash
vibecode-vm ssh
mount | grep virtio
ls -la /mnt/host/
```

#### Check host directory exists:
```bash
ls -la ~/vibecode-shared/
```

#### Check config:
```bash
vibecode-vm config show | grep SHARED
```

---

## Architecture

### Components

```
┌─────────────────────────────────────────┐
│           Host System (macOS)           │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │      vibecode-vm launcher       │   │
│  └──────────────┬──────────────────┘   │
│                 │                       │
│  ┌──────────────▼──────────────────┐   │
│  │          vfkit (VM)              │   │
│  │  ┌──────────────────────────┐   │   │
│  │  │   Linux Kernel (ARM64)   │   │   │
│  │  └───────────┬──────────────┘   │   │
│  │              │                   │   │
│  │  ┌───────────▼──────────────┐   │   │
│  │  │  Initramfs (59MB)        │   │   │
│  │  │  ┌──────────────────┐    │   │   │
│  │  │  │  BusyBox         │    │   │   │
│  │  │  │  Dropbear SSH    │    │   │   │
│  │  │  │  Valkey          │    │   │   │
│  │  │  │  PostgreSQL      │    │   │   │
│  │  │  │  OpenVSCode      │    │   │   │
│  │  │  │  Datadog Bridge  │    │   │   │
│  │  │  └──────────────────┘    │   │   │
│  │  └──────────────────────────┘   │   │
│  └──────────────────────────────────┘   │
│                                         │
│  ~/vibecode-shared/ ←─VirtioFS─→ /mnt/host/
│                                         │
└─────────────────────────────────────────┘
```

### Boot Sequence

1. **vfkit launch** (~0s)
   - Load kernel
   - Load initramfs
   - Configure virtio devices

2. **Kernel initialization** (~2s)
   - Mount filesystems
   - Load kernel modules
   - Initialize hardware

3. **Network setup** (~3-5s)
   - Detect interface
   - DHCP configuration (3 attempts)
   - Static fallback if needed

4. **Parallel service startup** (~2-3s)
   - All services launch simultaneously
   - Independent health checks
   - Non-blocking initialization

5. **Ready** (~5-10s total)
   - All services online
   - Credentials displayed
   - System ready for connections

### File Structure

```
~/.vibecode-vm/
├── bin/
│   ├── linux-kernel-arm64           # VM kernel (45MB)
│   └── unified-services.cpio.gz     # Initramfs (59MB)
├── config                            # User configuration
├── config.example                    # Example config
├── README.md                         # Documentation
├── vm.pid                           # Running VM PID
├── console.log                      # VM console output
└── vfkit.log                        # vfkit runtime log

~/.local/bin/
└── vibecode-vm                      # Launcher script

~/vibecode-shared/                   # Shared directory
├── README.txt
└── (your files)
```

### Network Architecture

```
Host                    VM
────────────────────────────────────

              NAT
macOS ◄────────────────► eth0
                         │
                         ├─ SSH (22)
                         ├─ Valkey (6379)
                         ├─ PostgreSQL (5432)
                         └─ OpenVSCode (8080)

IP: DHCP (192.168.64.x) or Static (192.168.64.10)
```

### Storage Model

```
VM Filesystem (in-memory)
├── / (tmpfs)                    # Root filesystem
├── /tmp (tmpfs)                 # Temporary files
├── /dev/shm (tmpfs)             # Shared memory
└── /mnt/host/ (virtiofs)        # Host shared directory
    ├── config/                  # Configuration files
    ├── data/                    # Application data
    ├── logs/                    # Log files
    ├── postgresql/              # PostgreSQL data (persistent)
    └── valkey/                  # Valkey data (persistent)
```

---

## FAQ

### Is data persistent?

By default, the VM uses in-memory storage. Data is lost on restart.

For persistence, use the shared directory:
```bash
# Inside VM
mkdir -p /mnt/host/postgresql
# PostgreSQL will auto-detect and use this directory
```

### Can I use this in production?

VibeCode VM is designed for **development and testing**. For production:
- Use dedicated infrastructure
- Implement proper security
- Configure backups
- Use SSL/TLS
- Implement authentication

### How do I upgrade?

```bash
# Stop VM
vibecode-vm stop

# Backup config
cp ~/.vibecode-vm/config ~/.vibecode-vm/config.backup

# Run new installer
cd vibecode-webgui
./install.sh

# Config is preserved automatically
```

### Can I run on Linux?

Currently optimized for macOS with vfkit. For Linux, you could adapt to use:
- QEMU
- Firecracker
- Cloud Hypervisor

### How do I uninstall?

```bash
# Stop VM
vibecode-vm stop

# Remove installation
rm -rf ~/.vibecode-vm
rm ~/.local/bin/vibecode-vm

# Optional: Remove shared directory
rm -rf ~/vibecode-shared
```

### What about Windows support?

Windows is not currently supported. Consider:
- WSL2 with Linux VM stack
- Docker Desktop (different approach)
- VirtualBox/VMware with manual setup

---

## Contributing

VibeCode VM is open for contributions:
- Bug reports
- Feature requests
- Documentation improvements
- Performance optimizations

## License

Check repository for license information.

## Support

For issues:
1. Check troubleshooting section
2. Review logs: `vibecode-vm logs`
3. Check configuration: `vibecode-vm config show`
4. Verify versions: `vibecode-vm version`

---

**Happy Coding with VibeCode VM!**
