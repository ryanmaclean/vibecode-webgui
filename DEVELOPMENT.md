# Development Guide for VibeCode VM

This guide provides comprehensive instructions for setting up your development environment, building VibeCode from source, and contributing to the project.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Development Environment Setup](#development-environment-setup)
- [Project Structure](#project-structure)
- [Building from Source](#building-from-source)
- [Running and Testing](#running-and-testing)
- [Debugging](#debugging)
- [Architecture Overview](#architecture-overview)
- [Coding Standards](#coding-standards)
- [Common Tasks](#common-tasks)
- [Troubleshooting](#troubleshooting)
- [Performance Profiling](#performance-profiling)

## Prerequisites

### Required Software

- **macOS**: 12.0 (Monterey) or later
- **Xcode Command Line Tools**: `xcode-select --install`
- **Homebrew**: `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`
- **vfkit**: `brew install vfkit` (v0.6.1+)
- **Docker**: Optional but recommended for reproducible builds
- **Git**: `brew install git`

### Development Tools

```bash
# Install essential development tools
brew install \
  coreutils \
  gnu-sed \
  grep \
  findutils \
  build-essential \
  wget \
  curl \
  python3

# For building kernel/initramfs
brew install \
  binutils \
  gcc
```

### Recommended Tools

```bash
# For development efficiency
brew install \
  git-flow \
  gh \
  fzf \
  ripgrep
```

### Minimum System Requirements

- **RAM**: 8GB available (4GB for VM, 4GB for host development)
- **Disk Space**: 30GB free (for build artifacts and VM images)
- **CPU**: Multi-core processor recommended for faster builds

## Development Environment Setup

### Clone the Repository

```bash
git clone https://github.com/yourusername/vibecode-vm.git
cd vibecode-vm

# Set up git hooks (optional)
git config core.hooksPath .git/hooks
chmod +x .git/hooks/*
```

### Configure Your Development Environment

```bash
# Set up environment variables
export VIBECODE_DEV=1
export VIBECODE_BUILD_TYPE=debug  # or 'release'

# Optional: Add to your shell profile (~/.zshrc or ~/.bash_profile)
echo 'export VIBECODE_DEV=1' >> ~/.zshrc
```

### Verify Setup

```bash
# Check vfkit installation
vfkit --version

# Check required tools
which git gcc make python3 docker

# Test Docker (if using)
docker run hello-world
```

## Project Structure

### Directory Layout

```
vibecode-vm/
├── azure/                                  # Build scripts and VM components
│   ├── build-unified-services-with-datadog.sh    # Main build script
│   ├── linux-kernel-arm64                # Compiled kernel (binary)
│   ├── linux-kernel-arm64-build/         # Kernel source/build (optional)
│   ├── unified-services-static.cpio.gz   # Compressed VM image
│   ├── test-volume-mounting.sh           # Volume mount tests
│   ├── test-unified-services.sh          # Service integration tests
│   └── SwiftUI-Apps/                     # macOS app & VM manager
│       ├── Apps/UnifiedServicesVibeCodeApp/
│       ├── Shared/
│       └── Tests/
│
├── scripts/                               # Utility scripts
│   ├── prepare-ssh-infrastructure.sh      # SSH setup
│   ├── install.sh                        # Installation script
│   └── ...
│
├── docs/                                  # Documentation
│   ├── architecture.md                   # System design
│   ├── datadog-extension.md              # Datadog integration
│   ├── volume-mounting.md                # VirtioFS guide
│   ├── optimization.md                   # Performance tuning
│   └── troubleshooting.md                # Common issues
│
├── config/                                # Configuration files
│   └── vfkit/demo-services.yaml          # Service configuration
│
├── .github/                              # GitHub configuration
│   ├── ISSUE_TEMPLATE/                  # Issue templates
│   └── workflows/                        # CI/CD workflows
│
├── README.md                             # User documentation
├── CONTRIBUTING.md                       # Contribution guidelines
├── DEVELOPMENT.md                        # This file
├── ROADMAP.md                            # Project roadmap
├── CHANGELOG.md                          # Version history
├── CODE_OF_CONDUCT.md                    # Community standards
├── SECURITY.md                           # Security policy
└── LICENSE                               # MIT License
```

### Key Files

- **build-unified-services-with-datadog.sh**: Main build automation script
- **linux-kernel-arm64**: Pre-compiled Linux kernel for ARM64
- **unified-services-static.cpio.gz**: Compressed VM image (boot environment)
- **SwiftUI-Apps**: macOS app source code

## Building from Source

### Quick Build

For most development, a quick build is sufficient:

```bash
cd azure
./build-unified-services-with-datadog.sh

# Build output
# - Creates/updates: unified-services-static.cpio.gz (~90MB compressed)
# - Time: 15-30 minutes depending on system
```

### Build Options

```bash
# Fast build (minimal services, for quick iteration)
./build-unified-services-with-datadog.sh --fast

# Clean rebuild from scratch
./build-unified-services-with-datadog.sh --clean

# Build with additional services
./build-unified-services-with-datadog.sh --with-extensions

# Verbose output for debugging
./build-unified-services-with-datadog.sh --verbose

# Dry run (show what would be done)
./build-unified-services-with-datadog.sh --dry-run
```

### Understanding the Build Process

The build script performs these steps:

1. **Preparation**: Creates temporary build directories, downloads dependencies
2. **Base Image**: Extracts or creates BusyBox base filesystem
3. **Service Compilation**: Builds PostgreSQL, Valkey, OpenVSCode, SSH server
4. **Init System**: Creates initialization scripts for service startup
5. **Packaging**: Creates compressed cpio image
6. **Optimization**: Compresses and deduplicates where possible

### Customizing the Build

#### Adding a New Service

1. Edit `build-unified-services-with-datadog.sh`
2. Add service compilation section
3. Update init script
4. Test thoroughly

Example:

```bash
# Add to build script
build_myservice() {
    echo "Building MyService..."
    # Download/compile steps
    # Copy to rootfs
}

# Add to init script
/path/to/myservice &
```

#### Modifying the Initramfs

1. Extract the existing image:
```bash
mkdir /tmp/vm-work
cd /tmp/vm-work
gunzip -c ../unified-services-static.cpio.gz | cpio -idm
```

2. Make changes to the filesystem (edit `init`, add files, etc.)

3. Rebuild:
```bash
find . | cpio -o -H newc | gzip -9 > ../custom-vm.cpio.gz
```

### Build Troubleshooting

#### Build Fails on Network Download

```bash
# Check network connectivity
curl -I https://github.com

# Use a different mirror or retry
./build-unified-services-with-datadog.sh --retry-count 5
```

#### Out of Disk Space

```bash
# Check available space
df -h

# Clean up old builds
rm -rf /tmp/vibecode-build-*
```

#### Memory Issues During Build

```bash
# Reduce parallel jobs
export MAKE_JOBS=2
./build-unified-services-with-datadog.sh
```

## Running and Testing

### Starting the VM for Development

```bash
# Method 1: Using the unified launcher
vibecode-vm start

# Method 2: Direct vfkit command (for more control)
vfkit \
  --cpus 2 \
  --memory 2048 \
  --kernel azure/linux-kernel-arm64 \
  --initrd azure/unified-services-static.cpio.gz \
  --device virtio-net,nat,mac=52:54:00:12:34:70 \
  --device virtio-serial,logFilePath=console.log \
  --device virtio-rng \
  --gui
```

### Checking Service Status

```bash
# Check all services
vibecode-vm status

# SSH into VM and check services manually
vibecode-vm ssh

# Inside VM
ps aux                           # See all processes
netstat -tlnp                    # See listening ports
dmesg | tail -50                 # See boot messages
```

### Running Tests

```bash
# Boot time test
./AGENT-Q-TIME-TO-EDITOR-TEST.sh

# Service connectivity test
cd azure
./test-unified-services.sh

# Volume mounting test
./test-volume-mounting.sh

# Full test suite
cd azure
for test in test-*.sh; do
    echo "Running $test..."
    ./$test || echo "FAILED: $test"
done
```

### Manual Testing Checklist

- [ ] VM boots successfully
- [ ] DHCP assigns IP address
- [ ] SSH access works: `vibecode-vm ssh`
- [ ] OpenVSCode loads: `open http://192.168.64.10:8080`
- [ ] PostgreSQL responds: `pg_isready -h 192.168.64.10`
- [ ] Valkey responds: `redis-cli -h 192.168.64.10 ping`
- [ ] Datadog extension appears in OpenVSCode
- [ ] Volume mounting works (if using)

## Debugging

### Viewing Logs

```bash
# View VM console output
vibecode-vm logs

# Follow logs in real-time
vibecode-vm logs -f

# Save logs to file
vibecode-vm logs > vm-output.log

# Inside VM, view service logs
vibecode-vm ssh
dmesg
tail -f /var/log/syslog  # If logging is configured
```

### SSH Debugging

```bash
# SSH with verbose output
ssh -vv root@192.168.64.10

# Check SSH server status in VM
vibecode-vm ssh
ps aux | grep sshd
netstat -tlnp | grep 22
```

### Network Debugging

```bash
# Check IP assignment
vibecode-vm ssh
ip addr show

# Test network connectivity from VM
vibecode-vm ssh
ping 8.8.8.8
ping google.com

# Check network from host
nmap -p 22,8080,5432,6379 192.168.64.10
```

### Performance Debugging

```bash
# Monitor VM resources during boot
watch -n 1 'vibecode-vm status'

# Inside VM, check resource usage
vibecode-vm ssh
top
free -m
df -h
```

### Using Console Output

Console output is saved to `console.log` when using vfkit. Check it for:

- Boot messages
- Service startup logs
- Error messages
- Network initialization

```bash
# Follow console output
tail -f console.log

# Search for errors
grep -i error console.log
grep -i fail console.log
```

## Architecture Overview

### System Design

VibeCode VM is built on these core components:

1. **Linux Kernel** (ARM64 optimized)
   - Minimal configuration for quick boot
   - VirtioFS support for volume mounting
   - DHCP client for network configuration

2. **BusyBox Base System**
   - Lightweight init system
   - Essential utilities
   - ~5MB footprint

3. **Service Stack**
   - **OpenVSCode Server**: Full VS Code IDE in browser
   - **PostgreSQL 16**: Relational database
   - **Valkey**: In-memory cache/data store
   - **Dropbear SSH**: Secure shell access

4. **Datadog Integration**
   - OpenVSCode extension v2.0.0
   - Log aggregation
   - Performance monitoring
   - Code quality analysis

### Startup Sequence

1. **Firmware** (vfkit): Boots kernel
2. **Kernel**: Initializes hardware, mounts root filesystem
3. **Init Script**: Runs as PID 1
   - Mounts filesystems (proc, sys, dev)
   - Initializes network (DHCP)
   - Starts services in parallel
4. **Services**: All services launch simultaneously (~3-5 seconds)
5. **Ready**: VM is ready to accept connections

### Service Dependencies

```
┌─────────────────────────────────────┐
│     OpenVSCode Server (8080)        │
├─────────────────────────────────────┤
│  Datadog Extension                  │
│  VS Code Built-in Extensions        │
├─────────────────────────────────────┤
│  PostgreSQL │ Valkey │ SSH Server   │
├─────────────────────────────────────┤
│      Linux Kernel + VirtioFS        │
└─────────────────────────────────────┘
```

## Coding Standards

### Shell Scripts

```bash
#!/bin/bash
set -euo pipefail  # Exit on error, undefined vars, pipe failures

# Use meaningful variable names
SERVICE_NAME="postgres"
SERVICE_PORT="5432"

# Quote variables
echo "Starting $SERVICE_NAME"

# Use functions for organization
start_service() {
    local service="$1"
    echo "Starting $service"
    # Implementation
}

# Error handling
if ! command -v "$SERVICE_NAME" &> /dev/null; then
    echo "ERROR: $SERVICE_NAME not found" >&2
    exit 1
fi
```

### Swift Code (for macOS app)

Follow standard Swift conventions:

- Use meaningful variable names (camelCase)
- Add documentation comments for public APIs
- Keep functions small and focused
- Use type safety and optionals correctly
- Follow Apple's Swift Style Guide

```swift
/// Starts the VibeCode VM with the specified configuration
/// - Parameter config: VM configuration to use
/// - Returns: Process handle or nil if failed
func startVM(config: VMConfiguration) -> Process? {
    // Implementation
}
```

### Documentation

- Use Markdown for all documentation
- Include code examples where helpful
- Keep README at root level concise
- Put detailed guides in `/docs`
- Update docs with code changes

## Common Tasks

### Adding a New Configuration Option

1. Update config schema in `config/vfkit/demo-services.yaml`
2. Update build script to read the option
3. Add documentation in `docs/`
4. Add validation in launcher app

### Adding a New Test

1. Create script in `azure/test-*.sh`
2. Add test discovery to test suite
3. Document test purpose and usage
4. Include in CI/CD pipeline

### Building a Release

```bash
# Update version
# Update CHANGELOG.md
# Create tag
git tag -a v3.3.0 -m "Version 3.3.0"
git push origin v3.3.0

# GitHub Actions will build and release automatically
```

### Profiling Boot Time

```bash
# Automated boot time measurement
./AGENT-Q-TIME-TO-EDITOR-TEST.sh

# Manual timing
time vibecode-vm start

# Detailed boot timeline
vibecode-vm ssh
dmesg | grep -E '^\[.*\]' | head -20
```

## Troubleshooting

### VM Won't Boot

Check kernel and initramfs exist:
```bash
ls -lh azure/linux-kernel-arm64
ls -lh azure/unified-services-static.cpio.gz
```

### Services Not Starting

1. Check logs: `vibecode-vm logs`
2. SSH and check manually: `vibecode-vm ssh && ps aux`
3. Verify service binaries exist in image
4. Check init script syntax

### Network Issues

```bash
# Check DHCP
vibecode-vm ssh
ps aux | grep dhcp
ip addr show
ip route show

# Test connectivity
ping 8.8.8.8
```

### Performance Issues

1. Increase VM resources: `--memory 4096 --cpus 4`
2. Check host system resources: `top`, `df -h`
3. Profile services: `vibecode-vm ssh && top`
4. Check for disk I/O bottlenecks

## Performance Profiling

### Boot Time Analysis

```bash
# Measure total boot time
time vibecode-vm start

# Expected: 26 seconds average

# Break down boot stages
vibecode-vm logs | grep -E '^\[.*\]'
```

### Memory Usage

```bash
# Before starting services
vibecode-vm ssh
free -m
ps aux --sort=-%mem | head -10

# During active use
watch -n 1 'vibecode-vm ssh && free -m'
```

### Service Startup Timing

Edit init script to add timestamps:

```bash
# In init script
echo "Service startup at $(date +%s)" >> /tmp/boot-times.log
# Start service
/path/to/service &
echo "Service started at $(date +%s)" >> /tmp/boot-times.log
```

## Getting Help

- **Documentation**: Check `/docs` directory
- **Issues**: Search [GitHub Issues](https://github.com/yourusername/vibecode-vm/issues)
- **Discussions**: Ask in [GitHub Discussions](https://github.com/yourusername/vibecode-vm/discussions)
- **Contributing**: See [CONTRIBUTING.md](CONTRIBUTING.md)

---

**Last Updated**: 2025-01-14

**For questions or issues with development setup, please open an issue or start a discussion on GitHub.**
