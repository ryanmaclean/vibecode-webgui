# Installation Guide

Complete installation instructions for VibeCode VM on macOS with Apple Silicon.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installing vfkit](#installing-vfkit)
- [Downloading VibeCode VM](#downloading-vibecode-vm)
- [First Launch](#first-launch)
- [Verification](#verification)
- [Troubleshooting](#troubleshooting)
- [Advanced Configuration](#advanced-configuration)

## Prerequisites

### System Requirements

- **Operating System**: macOS 12.0 (Monterey) or later
- **Processor**: Apple Silicon (M1, M2, M3, or later ARM64 chip)
- **RAM**: 4GB minimum (2GB for VM, 2GB for host)
- **Disk Space**: 1GB free space minimum
- **Network**: Internet connection for initial download

### Verify Your System

Check your macOS version:
```bash
sw_vers
```

Expected output:
```
ProductName:    macOS
ProductVersion: 12.0 (or higher)
BuildVersion:   ...
```

Check your processor architecture:
```bash
uname -m
```

Expected output:
```
arm64
```

If you see `x86_64`, you have an Intel Mac and this VM is not compatible.

## Installing vfkit

vfkit is Apple's virtualization toolkit that VibeCode VM uses to run on macOS.

### Option 1: Install with Homebrew (Recommended)

```bash
brew tap cfergeau/crc
brew install vfkit
```

### Option 2: Install from Binary

1. Download the latest vfkit release:
```bash
curl -LO https://github.com/crc-org/vfkit/releases/download/v0.6.1/vfkit-0.6.1-darwin-arm64.tar.gz
```

2. Extract the archive:
```bash
tar -xzf vfkit-0.6.1-darwin-arm64.tar.gz
```

3. Move to a directory in your PATH:
```bash
sudo mv vfkit /usr/local/bin/
sudo chmod +x /usr/local/bin/vfkit
```

### Verify vfkit Installation

```bash
vfkit --version
```

Expected output:
```
vfkit version 0.6.1 (or higher)
```

## Downloading VibeCode VM

### Option 1: Download from GitHub Releases (Recommended)

1. Create a directory for VibeCode VM:
```bash
mkdir -p ~/vibecode-vm
cd ~/vibecode-vm
```

2. Download the kernel and initramfs:
```bash
# Download kernel
curl -LO https://github.com/yourusername/vibecode-vm/releases/latest/download/linux-kernel-arm64

# Download VM image
curl -LO https://github.com/yourusername/vibecode-vm/releases/latest/download/unified-services-static.cpio.gz
```

3. Verify the downloads:
```bash
ls -lh
```

Expected output:
```
-rw-r--r--  1 user  staff    25M Jan  6 10:00 linux-kernel-arm64
-rw-r--r--  1 user  staff    59M Jan  6 10:00 unified-services-static.cpio.gz
```

### Option 2: Build from Source

If you want to customize the VM or build it yourself, see [CONTRIBUTING.md](CONTRIBUTING.md#building-from-source).

## First Launch

### Basic Launch

Launch the VM with default settings:

```bash
cd ~/vibecode-vm

vfkit \
  --cpus 2 \
  --memory 2048 \
  --kernel linux-kernel-arm64 \
  --initrd unified-services-static.cpio.gz \
  --device virtio-net,nat,mac=52:54:00:12:34:70 \
  --device virtio-serial,logFilePath=console.log \
  --device virtio-rng \
  --gui
```

### Understanding the Launch Options

| Option | Description |
|--------|-------------|
| `--cpus 2` | Allocate 2 CPU cores to the VM |
| `--memory 2048` | Allocate 2GB RAM (2048 MB) |
| `--kernel` | Path to the Linux kernel |
| `--initrd` | Path to the initial ramdisk (VM filesystem) |
| `--device virtio-net` | Network interface with NAT |
| `--device virtio-serial` | Console output logging |
| `--device virtio-rng` | Random number generator for security |
| `--gui` | Show the VM console window |

### Boot Process

When you launch the VM, you'll see:

1. **Kernel boot messages** (2-5 seconds)
2. **Network configuration** (5-10 seconds)
   - DHCP attempt (may fail, gracefully falls back to static IP)
   - Static IP assigned: 192.168.64.10
3. **Service startup** (10-20 seconds)
   - SSH Server (port 22)
   - Valkey (port 6379)
   - PostgreSQL (port 5432)
   - OpenVSCode Server (port 8080)
4. **Ready message** (25-30 seconds total)

## Verification

### Check VM Status

Wait for the boot process to complete (about 26 seconds). You should see messages like:

```
✓ SSH server responding on port 22
✓ Valkey server responding on port 6379
✓ PostgreSQL server responding on port 5432
✓ OpenVSCode running on port 8080
```

### Access Services

#### 1. OpenVSCode (Web IDE)

Open your browser and navigate to:
```
http://192.168.64.10:8080
```

You should see the VS Code interface. Try:
- Opening the integrated terminal (Terminal → New Terminal)
- Creating a new file
- Using the editor

#### 2. SSH Access

Connect via SSH:
```bash
ssh root@192.168.64.10
```

Password: `vibecode`

Once connected, try:
```bash
# Check hostname
hostname

# Check running services
ps aux | grep -E "sshd|valkey|postgres|openvscode"

# Check network
ip addr show
```

Type `exit` to disconnect.

#### 3. PostgreSQL Database

Connect to PostgreSQL:
```bash
psql -h 192.168.64.10 -U postgres
```

Try some commands:
```sql
-- List databases
\l

-- Create a test database
CREATE DATABASE testdb;

-- List databases again
\l

-- Quit
\q
```

#### 4. Valkey (Redis-compatible cache)

Connect to Valkey:
```bash
redis-cli -h 192.168.64.10 -p 6379
```

Try some commands:
```
# Set a key
SET mykey "Hello VibeCode"

# Get the key
GET mykey

# Exit
exit
```

## Troubleshooting

### VM Won't Start

**Problem**: vfkit command fails immediately

**Solution**:
1. Check that vfkit is installed: `vfkit --version`
2. Verify files exist: `ls -l linux-kernel-arm64 unified-services-static.cpio.gz`
3. Check you have enough RAM: `vm_stat | head -n 5`
4. Try running without `--gui`: remove the `--gui` flag

### Can't Connect to Services

**Problem**: Cannot access http://192.168.64.10:8080

**Solution**:
1. Wait a full 30 seconds for boot to complete
2. Check the console log: `tail -f console.log`
3. Verify the IP address: look for "Static IP assigned" in console.log
4. Try SSH first: `ssh root@192.168.64.10` to confirm network is working
5. Check your firewall settings

### SSH Connection Refused

**Problem**: `ssh root@192.168.64.10` times out or is refused

**Solution**:
1. Wait for the "SSH server responding" message in console
2. Check console.log for errors: `grep -i ssh console.log`
3. Verify the VM has assigned IP 192.168.64.10: `grep "Static IP" console.log`
4. Try pinging the VM: `ping 192.168.64.10`

### Services Fail to Start

**Problem**: Services show errors in console.log

**Solution**:
1. Check available memory: increase `--memory` to 3072 or 4096
2. Check available disk space: `df -h`
3. Try increasing CPUs: `--cpus 4`
4. Check console.log for specific error messages

### Slow Performance

**Problem**: VM is slow or unresponsive

**Solution**:
1. Increase RAM: `--memory 4096`
2. Increase CPUs: `--cpus 4`
3. Close other applications to free resources
4. Check Activity Monitor for CPU/RAM usage

### Network Issues

**Problem**: VM has no network connectivity

**Solution**:
1. The VM should fall back to static IP 192.168.64.10 automatically
2. Try connecting via SSH to verify: `ssh root@192.168.64.10`
3. Check console.log for network messages: `grep -i "network\|ip" console.log`
4. Verify the MAC address in vfkit command matches: `mac=52:54:00:12:34:70`

## Advanced Configuration

### Increasing Resources

For better performance, allocate more resources:

```bash
vfkit \
  --cpus 4 \
  --memory 4096 \
  --kernel linux-kernel-arm64 \
  --initrd unified-services-static.cpio.gz \
  --device virtio-net,nat,mac=52:54:00:12:34:70 \
  --device virtio-serial,logFilePath=console.log \
  --device virtio-rng \
  --gui
```

### Headless Mode

Run without GUI (for servers or background use):

```bash
vfkit \
  --cpus 2 \
  --memory 2048 \
  --kernel linux-kernel-arm64 \
  --initrd unified-services-static.cpio.gz \
  --device virtio-net,nat,mac=52:54:00:12:34:70 \
  --device virtio-serial,logFilePath=console.log \
  --device virtio-rng
```

Monitor via console log:
```bash
tail -f console.log
```

### Volume Mounting

Share files between host and VM:

```bash
vfkit \
  --cpus 2 \
  --memory 2048 \
  --kernel linux-kernel-arm64 \
  --initrd unified-services-static.cpio.gz \
  --device virtio-net,nat,mac=52:54:00:12:34:70 \
  --device virtio-serial,logFilePath=console.log \
  --device virtio-rng \
  --device virtio-fs,sharedDir=/path/to/your/project,mountTag=hostshare \
  --gui
```

Inside the VM, files will be at `/mnt/host`.

See [docs/volume-mounting.md](docs/volume-mounting.md) for complete documentation.

### Custom Network Configuration

Use a different IP address:

**Note**: This requires modifying the init script in the initramfs. See [CONTRIBUTING.md](CONTRIBUTING.md#customizing-the-vm) for details.

### Persistent Storage

By default, the VM uses in-memory storage. All data is lost when the VM stops.

To persist data:
1. Use volume mounting (above) for application data
2. Configure PostgreSQL to store data in `/mnt/host/postgresql`
3. Configure Valkey to store data in `/mnt/host/valkey`

See [docs/volume-mounting.md#persistent-storage](docs/volume-mounting.md#persistent-storage) for configuration details.

## Creating a Launcher Script

For convenience, create a launcher script:

```bash
cat > ~/vibecode-vm/start-vm.sh << 'EOF'
#!/bin/bash
cd ~/vibecode-vm

vfkit \
  --cpus 2 \
  --memory 2048 \
  --kernel linux-kernel-arm64 \
  --initrd unified-services-static.cpio.gz \
  --device virtio-net,nat,mac=52:54:00:12:34:70 \
  --device virtio-serial,logFilePath=console.log \
  --device virtio-rng \
  --gui

echo "VibeCode VM has stopped"
EOF

chmod +x ~/vibecode-vm/start-vm.sh
```

Now you can start the VM with:
```bash
~/vibecode-vm/start-vm.sh
```

## Next Steps

- Read [docs/volume-mounting.md](docs/volume-mounting.md) to set up file sharing
- Check [docs/architecture.md](docs/architecture.md) to understand how it works
- See [CONTRIBUTING.md](CONTRIBUTING.md) to customize or build your own VM
- Join the community at [GitHub Discussions](https://github.com/yourusername/vibecode-vm/discussions)

## Getting Help

If you encounter issues not covered here:

1. Check [docs/troubleshooting.md](docs/troubleshooting.md) for more detailed solutions
2. Search [existing issues](https://github.com/yourusername/vibecode-vm/issues)
3. Open a [new issue](https://github.com/yourusername/vibecode-vm/issues/new) with:
   - Your macOS version (`sw_vers`)
   - Your CPU model (About This Mac)
   - Console log output (`cat console.log`)
   - Steps to reproduce the problem

## Additional Resources

- [vfkit documentation](https://github.com/crc-org/vfkit)
- [OpenVSCode Server](https://github.com/gitpod-io/openvscode-server)
- [PostgreSQL documentation](https://www.postgresql.org/docs/)
- [Valkey documentation](https://valkey.io/docs/)
