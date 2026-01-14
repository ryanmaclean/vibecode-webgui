# VibeCode VM

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-3.2.1-blue.svg)](https://github.com/ryanmaclean/vibecode-webgui/releases)
[![CI](https://github.com/ryanmaclean/vibecode-webgui/actions/workflows/ci.yml/badge.svg)](https://github.com/ryanmaclean/vibecode-webgui/actions/workflows/ci.yml)
[![E2E Tests](https://github.com/ryanmaclean/vibecode-webgui/actions/workflows/e2e.yml/badge.svg)](https://github.com/ryanmaclean/vibecode-webgui/actions/workflows/e2e.yml)
[![macOS Build](https://github.com/ryanmaclean/vibecode-webgui/actions/workflows/build-macos.yml/badge.svg)](https://github.com/ryanmaclean/vibecode-webgui/actions/workflows/build-macos.yml)
[![Release](https://github.com/ryanmaclean/vibecode-webgui/actions/workflows/release.yml/badge.svg)](https://github.com/ryanmaclean/vibecode-webgui/actions/workflows/release.yml)

**Lightweight, Fast Development VMs with Full IDE Support & Datadog Integration**

VibeCode VM is an ultra-lightweight virtual machine platform that boots a complete development environment in under 30 seconds. Built with Firecracker-style parallel service startup, it provides SSH access, PostgreSQL database, Valkey cache, and a full VS Code editor with integrated Datadog extension in a VM that compresses to just 59MB.

## What's New in v3.2.1

- **Datadog VSCode Extension v2.0.0** - Full observability integration with 19+ commands
  - Real-time log aggregation and analysis
  - Static analysis and code quality insights
  - Cloud platform integration
  - Seamless authentication within the IDE
- **Enhanced Unified Tool** - Improved VM management and service orchestration
- **Performance Optimizations** - Further boot time reductions

## Features

- **Lightning Fast Boot**: 26-second average boot time from cold start to ready IDE
- **Ultra Compact**: 59MB compressed VM image (175MB uncompressed)
- **Full Development Stack**:
  - OpenVSCode Server - Full VS Code editor in your browser
  - PostgreSQL 16 - Production-ready relational database
  - Valkey - High-performance in-memory data store
  - SSH Server - Secure remote access with Dropbear
  - **Datadog VSCode Extension v2.0.0** - Integrated observability and monitoring
- **Volume Mounting**: VirtioFS support for persistent storage and file sharing
- **Network Ready**: Automatic DHCP with static IP fallback (192.168.64.10)
- **Parallel Startup**: All services launch simultaneously for minimal boot time
- **macOS Native**: Optimized for Apple Silicon using vfkit
- **Comprehensive Monitoring**: Real-time logs, metrics, and code quality insights

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
open http://<VM_IP>:8080     # OpenVSCode with Datadog extension in browser
```

See [QUICK-START.md](QUICK-START.md) for more details.

### Quick Access to Datadog Extension

Once OpenVSCode is running, the Datadog extension will be available in the Extensions sidebar:

1. Open the OpenVSCode interface at `http://<VM_IP>:8080`
2. Click the Extensions icon in the left sidebar (or press `Ctrl+Shift+X`)
3. Search for "Datadog" - the extension will appear in the installed extensions list
4. Click to activate and explore 19+ powerful commands for logs, metrics, and analysis

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
| OpenVSCode Server | 8080 | Full VS Code editor with Datadog extension and terminal |
| SSH (Dropbear) | 22 | Secure shell access |
| PostgreSQL 16 | 5432 | Relational database |
| Valkey | 6379 | In-memory cache and data store |

### Integrated Extensions

The OpenVSCode environment comes pre-configured with:

- **Datadog VSCode Extension v2.0.0**
  - 19+ powerful commands for logs, metrics, and monitoring
  - Real-time log aggregation and search
  - Distributed tracing visualization
  - Cloud integration (AWS, Azure, GCP)
  - Security analysis and compliance insights
  - Built-in authentication for Datadog platform

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
- Integrated Datadog extension access
- Service health monitoring

See [UNIFIED-TOOL-GUIDE.md](UNIFIED-TOOL-GUIDE.md) for complete documentation.

## Documentation

- [Quick Start Guide](QUICK-START.md) - Get up and running in 5 minutes
- [Unified Tool Guide](UNIFIED-TOOL-GUIDE.md) - Complete launcher documentation
- [Datadog Extension Guide](docs/datadog-extension.md) - Using the Datadog VSCode extension (19+ commands, authentication, features)
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

## Contributing

We welcome contributions from the community! Whether you're fixing bugs, improving documentation, or suggesting features, your help makes VibeCode better.

### Quick Start for Contributors

New to contributing? Our [Quick Start Guide for Contributors](CONTRIBUTORS_GUIDE.md) gets you started in minutes with:
- Finding issues to work on
- Making your first contribution
- Understanding our development process
- Common workflows

### Full Contribution Guidelines

See [CONTRIBUTING.md](CONTRIBUTING.md) for comprehensive guidelines on:
- Code of Conduct and community standards
- Development environment setup
- Project structure and architecture
- Testing requirements
- Commit message conventions (Conventional Commits)
- Pull request process
- Review timelines
- Reporting bugs and suggesting features

### Development

Want to build from source or set up a dev environment?

See [DEVELOPMENT.md](DEVELOPMENT.md) for detailed instructions:
- Prerequisites and system requirements
- Building from source
- Running and testing
- Debugging techniques
- Architecture overview
- Coding standards
- Performance profiling

### What We're Building Next

Check our [Roadmap](ROADMAP.md) to see:
- Current version status (v3.2.1)
- Planned features for upcoming versions
- Long-term vision and direction
- Technical debt items
- Community wishlist

## Community & Support

### Get Help

- **Questions?** Ask in [GitHub Discussions](https://github.com/yourusername/vibecode-vm/discussions) - best for questions and getting community support
- **Found a bug?** Open an [issue](https://github.com/yourusername/vibecode-vm/issues) with the bug report template
- **Have an idea?** Start a [discussion](https://github.com/yourusername/vibecode-vm/discussions) or open a feature request issue
- **Security concern?** Email security@vibecode.dev (do not use public issues)

### Community Standards

We are committed to providing a welcoming and inclusive community. All participants are expected to follow our [Code of Conduct](CODE_OF_CONDUCT.md).

### How You Can Help

Even if you don't code, there are many ways to contribute:

- **Report bugs**: Help us identify and fix issues
- **Improve documentation**: Fix typos, clarify guides, add examples
- **Test features**: Try new features and provide feedback
- **Answer questions**: Help other community members in discussions
- **Suggest features**: Share ideas for improvements
- **Share your experience**: Blog posts, tutorials, videos

### Recognition

Contributors are recognized in:
- Release notes for each version
- Contributors section in README
- Community hall of fame (coming soon)

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

## Datadog Extension Features (v3.2.1)

The integrated Datadog VSCode extension provides powerful development and monitoring capabilities:

### Available Commands

- **19+ integrated commands** for logs, metrics, and trace data access
- Real-time log search and filtering
- Distributed trace visualization
- Metrics browsing and analysis
- Service dependency mapping
- Security and compliance scanning
- Code quality insights

### Quick Start with Datadog Extension

1. **Launch VibeCode VM**: `vibecode-vm start`
2. **Open OpenVSCode**: Visit `http://<VM_IP>:8080`
3. **Access Extensions**: Click Extensions icon (Ctrl+Shift+X)
4. **Find Datadog**: Installed extensions will show "Datadog"
5. **Authenticate**: Click to open extension and follow OAuth flow (optional but recommended)
6. **Start Monitoring**: Use command palette (Cmd+Shift+P) and search "Datadog" for available commands

### Platform Integration

- Works seamlessly with Datadog SaaS platform
- Supports multiple cloud providers (AWS, Azure, GCP)
- Secure token-based authentication
- Full audit trail and compliance tracking

## Project Status

VibeCode VM is currently in **active development**. The core functionality is stable and ready for use, with ongoing improvements to documentation, testing, and features.

Current Version: **v3.2.1**

---

**Made with care for developers who value speed, simplicity, and observability.**
