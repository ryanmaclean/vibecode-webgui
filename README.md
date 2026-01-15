TEST PROJECT!!!


# VibeCode VM

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-3.3.0-blue.svg)](https://github.com/ryanmaclean/vibecode-webgui/releases)

**Lightweight, Fast Development VMs with Full IDE Support**

VibeCode VM is an ultra-lightweight virtual machine platform that boots a complete development environment in under 30 seconds. Built with Firecracker-style parallel service startup, it provides SSH access, PostgreSQL database, Valkey cache, and a full VS Code editor in a VM that compresses to just 59MB.

## Features

- **Lightning Fast Boot**: 26-second average boot time from cold start to ready IDE
- **Ultra Compact**: 59MB compressed VM image (175MB uncompressed)
- **Full Development Stack**:
  - OpenVSCode Server - Full VS Code editor in your browser
  - PostgreSQL 16 - Production-ready relational database
  - Valkey - High-performance in-memory data store
  - SSH Server - Secure remote access with Dropbear
- **Volume Mounting**: VirtioFS support for persistent storage and file sharing
- **Network Ready**: Automatic DHCP with static IP fallback (192.168.64.10)
- **Parallel Startup**: All services launch simultaneously for minimal boot time
- **macOS Native**: Optimized for Apple Silicon using vfkit

## Quick Start

### Prerequisites

- macOS with Apple Silicon (ARM64) or Intel
- [vfkit](https://github.com/crc-org/vfkit) v0.6.1 or later: `brew install vfkit`
- 2GB RAM available
- 500MB disk space

### Installation (Recommended Method)

Use the unified launcher tool for the best experience:

```bash
# 1. Install vfkit
brew install vfkit

# 2. Run the installer
./install.sh

# 3. Start the VM
vibecode-vm start

# 4. Check status
vibecode-vm status

# 5. Access services (use IP from status)
vibecode-vm ssh              # SSH access
open http://<VM_IP>:8080     # OpenVSCode in browser
```

See [QUICK-START.md](QUICK-START.md) for more details.

### Manual Launch (Alternative)

If you prefer to manage vfkit directly:

```bash
vfkit \
  --cpus 2 \
  --memory 2048 \
  --kernel azure/linux-kernel-arm64 \
  --initrd azure/unified-services-static-optimized.cpio.gz \
  --device virtio-net,nat,mac=52:54:00:12:34:70 \
  --device virtio-serial,logFilePath=console.log \
  --device virtio-rng \
  --device virtio-fs,sharedDir=$HOME/vibecode-shared,mountTag=hostshare \
  --gui
```

Access services:
- **OpenVSCode**: http://192.168.64.10:8080
- **SSH**: `ssh root@192.168.64.10` (password: `vibecode`)
- **PostgreSQL**: `psql -h 192.168.64.10 -U postgres`
- **Valkey**: `redis-cli -h 192.168.64.10 -p 6379`

## What's Inside

### Services

| Service | Port | Description |
|---------|------|-------------|
| OpenVSCode Server | 8080 | Full VS Code editor with terminal |
| SSH (Dropbear) | 22 | Secure shell access |
| PostgreSQL 16 | 5432 | Relational database |
| Valkey | 6379 | In-memory cache and data store |

### Performance

- **Boot Time**: 26 seconds average (25-29s range)
- **Memory Usage**: ~400MB baseline
- **Disk Size**: 59MB compressed, 175MB uncompressed
- **Services**: Parallel startup for maximum efficiency

## Volume Mounting

Share files between your host and the VM using VirtioFS:

```bash
vfkit \
  --cpus 2 \
  --memory 2048 \
  --kernel linux-kernel-arm64 \
  --initrd unified-services-static.cpio.gz \
  --device virtio-net,nat,mac=52:54:00:12:34:70 \
  --device virtio-serial,logFilePath=console.log \
  --device virtio-rng \
  --device virtio-fs,sharedDir=/path/to/project,mountTag=hostshare \
  --gui
```

Files will be mounted at `/mnt/host` inside the VM. See [Volume Mounting Guide](docs/volume-mounting.md) for details.

## Use Cases

- **Development Environments**: Full-stack development with code editor, database, and cache
- **Testing**: Isolated environments for integration testing
- **Education**: Learn Linux, databases, and web development
- **Prototyping**: Rapid application development with persistent storage
- **CI/CD**: Lightweight build and test environments

## Unified Launcher Tool

VibeCode VM includes a polished command-line tool for easy VM management:

```bash
# Start/stop/restart
vibecode-vm start              # Start the VM
vibecode-vm stop               # Stop the VM
vibecode-vm restart            # Restart the VM

# Status and access
vibecode-vm status             # Show VM and service status
vibecode-vm ssh                # SSH into the VM
vibecode-vm logs               # View console logs
vibecode-vm logs -f            # Follow logs in real-time

# Configuration
vibecode-vm config show        # Show current configuration
vibecode-vm config edit        # Edit configuration

# Help
vibecode-vm help               # Show help
vibecode-vm version            # Show version info
```

### Features

- Single command to start/stop/restart VM
- Automatic service status checking
- Built-in SSH with password handling
- Log viewing and following
- Configuration management
- Shared directory setup
- Optional Datadog monitoring integration

See [UNIFIED-TOOL-GUIDE.md](UNIFIED-TOOL-GUIDE.md) for complete documentation.

## Documentation

- [Quick Start Guide](QUICK-START.md) - Get up and running in 5 minutes
- [Unified Tool Guide](UNIFIED-TOOL-GUIDE.md) - Complete launcher documentation
- [Volume Mounting](docs/volume-mounting.md) - File sharing between host and VM
- [Performance & Optimization](docs/optimization.md) - Boot time and size optimizations
- [Architecture](docs/architecture.md) - Technical details and design decisions
- [Troubleshooting](docs/troubleshooting.md) - Common issues and solutions

## Building from Source

Want to customize the VM or build it yourself? See [CONTRIBUTING.md](CONTRIBUTING.md) for build instructions.

## Performance Benchmarks

Tested on Apple Silicon (M-series processors):

- **Boot to IDE Ready**: 26 seconds average
- **Cold Start**: 25 seconds minimum
- **Service Startup**: Parallel (all services launch simultaneously)
- **Network Ready**: 5-10 seconds
- **Memory Footprint**: ~400MB baseline, ~800MB with active workload

## Technical Highlights

- **Firecracker-Style Init**: Parallel service startup for minimal boot time
- **BusyBox Base**: Minimal Linux environment (~5MB)
- **Static Binaries**: No dynamic library dependencies for core services
- **Optimized Build**: Aggressive size reduction (89MB → 59MB)
- **VirtioFS Ready**: Kernel module support for volume mounting

## System Requirements

### Host System
- macOS 12.0 (Monterey) or later
- Apple Silicon (M1, M2, M3, or later)
- 4GB RAM (2GB for VM, 2GB for host)
- 1GB free disk space

### VM Resources
- 2 CPU cores (configurable)
- 2GB RAM (configurable, minimum 1GB)
- ~200MB disk space for runtime

## Community & Support

- **Issues**: [GitHub Issues](https://github.com/ryanmaclean/vibecode-webgui/issues)
- **Discussions**: [GitHub Discussions](https://github.com/ryanmaclean/vibecode-webgui/discussions)
- **Contributing**: See [CONTRIBUTING.md](CONTRIBUTING.md)

## License

VibeCode VM is open source software licensed under the [MIT License](LICENSE).

## Acknowledgments

Built with:
- [vfkit](https://github.com/crc-org/vfkit) - Virtualization toolkit for macOS
- [OpenVSCode Server](https://github.com/gitpod-io/openvscode-server) - VS Code in the browser
- [PostgreSQL](https://www.postgresql.org/) - World's most advanced open source database
- [Valkey](https://valkey.io/) - High-performance in-memory data store
- [Dropbear SSH](https://matt.ucc.asn.au/dropbear/dropbear.html) - Lightweight SSH server
- [BusyBox](https://busybox.net/) - Minimal Linux utilities

## Project Status

VibeCode VM is currently in **active development**. The core functionality is stable and ready for use, with ongoing improvements to documentation, testing, and features.

Current Version: **v1.0.0**

---

**Made with care for developers who value speed and simplicity.**
