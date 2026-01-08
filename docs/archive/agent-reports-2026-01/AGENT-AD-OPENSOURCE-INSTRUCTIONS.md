# Agent AD - Open Source Preparation Instructions

**Mission**: Create comprehensive open source distribution package

---

## Prerequisites

**Wait for**:
- Agent AC production build completion
- Production build verified working

**Input Files**:
- `azure/unified-services-production-v1.0.cpio.gz` (from Agent AC)
- `azure/linux-kernel-arm64` (kernel)
- Existing documentation (Agent X/Y/Z reports)

---

## Deliverables Required

### 1. README.md (Main Project README)

**Target audience**: First-time users, potential contributors
**Length**: 200-300 lines

**Structure**:

```markdown
# VibeCode VM - Unified Development Services

> Fast-booting VM with PostgreSQL, Valkey (Redis), OpenVSCode, and SSH

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Features

- 🚀 **Fast Boot**: ~13 seconds to all services ready
- 📦 **All-in-One**: PostgreSQL 16, Valkey 8, OpenVSCode, SSH
- 💾 **Tiny**: 64MB download, 2GB RAM
- 🔌 **Plug & Play**: Single command to launch
- 💽 **Persistent Storage**: Optional volume mounting for data persistence
- 🍎 **macOS Native**: Uses Apple Virtualization Framework (vfkit)

## Quick Start

### Prerequisites

- macOS with Apple Silicon
- [vfkit](https://github.com/crc-org/vfkit) installed: `brew install vfkit`
- 4GB+ RAM available
- 10GB+ disk space

### 5-Minute Setup

1. **Download**:
   ```bash
   curl -LO https://github.com/yourusername/vibecode-vm/releases/latest/download/vibecode-vm-v1.0.tar.gz
   tar xzf vibecode-vm-v1.0.tar.gz
   cd vibecode-vm-v1.0
   ```

2. **Launch**:
   ```bash
   ./scripts/launch-vm.sh
   ```

3. **Access Services**:
   ```bash
   # Wait for boot (look for "ACCESS CREDENTIALS" section)
   # Then connect:

   ssh root@192.168.64.10        # Password: vibecode
   redis-cli -h 192.168.64.10 PING
   psql -h 192.168.64.10 -U postgres
   open http://192.168.64.10:8080
   ```

## What's Included

| Service | Port | Credentials |
|---------|------|-------------|
| **SSH** (Dropbear) | 22 | root / vibecode |
| **Valkey** (Redis) | 6379 | No password |
| **PostgreSQL** 16 | 5432 | postgres / trust auth |
| **OpenVSCode** Server | 8080 | No auth |

## Usage

### Basic Launch

```bash
./scripts/launch-vm.sh
```

### With Persistent Storage

```bash
# Create shared directory
mkdir -p ~/vm-data

# Launch with volume mounting
vfkit \
  --cpus 4 \
  --memory 2048 \
  --kernel ./linux-kernel-arm64 \
  --initrd ./unified-services-production-v1.0.cpio.gz \
  --kernel-cmdline "console=hvc0" \
  --device virtio-net,nat \
  --device virtio-serial,logFilePath=/tmp/vm.log \
  --device virtio-rng \
  --device virtio-fs,sharedDir=$HOME/vm-data,mountTag=hostshare
```

Data persists in `~/vm-data/` across VM restarts!

See [Volume Mounting Guide](docs/VOLUME-MOUNTING-GUIDE.md) for details.

## Documentation

- [Quick Start Guide](QUICK-START.md) - 5-minute setup
- [Volume Mounting](docs/VOLUME-MOUNTING-GUIDE.md) - Persistent storage
- [Architecture](docs/ARCHITECTURE.md) - How it works
- [Contributing](CONTRIBUTING.md) - How to contribute
- [Examples](examples/) - Common use cases

## Examples

### Database Development

```bash
# PostgreSQL data persists in ~/vm-data/postgresql/
mkdir -p ~/vm-data/postgresql
./scripts/launch-vm.sh --volume ~/vm-data

# Use normally
psql -h 192.168.64.10 -U postgres -c "CREATE DATABASE myapp;"
```

### Redis Caching

```bash
redis-cli -h 192.168.64.10
SET mykey "Hello World"
GET mykey
```

### VS Code in Browser

```bash
open http://192.168.64.10:8080
# Edit code, open terminals, install extensions
```

## Performance

- **Boot Time**: ~13 seconds
- **Memory**: 2GB RAM (configurable)
- **Disk**: 64MB download, ~200MB extracted
- **Services**: All 4 start in parallel

## Requirements

- macOS 12.0+ (Monterey or later)
- Apple Silicon (M1/M2/M3) or Intel with VT-x
- vfkit 0.5.0+
- 4GB+ RAM
- 10GB+ disk space

## Troubleshooting

**VM won't start?**
```bash
# Check vfkit is installed
which vfkit

# Check console log
tail -f /tmp/vm-console.log
```

**Services not accessible?**
```bash
# Verify VM is running
ps aux | grep vfkit

# Check IP address
# Look for "DHCP IP: x.x.x.x" in console log
tail /tmp/vm-console.log | grep "DHCP IP"
```

See [Troubleshooting Guide](docs/TROUBLESHOOTING.md) for more.

## Architecture

This VM uses:
- **Alpine Linux** (musl libc) for minimal size
- **Apple Virtualization Framework** via vfkit
- **VirtioFS** for host directory sharing
- **Parallel service startup** for fast boot
- **Initramfs-only** (no root filesystem) for simplicity

See [Architecture Documentation](docs/ARCHITECTURE.md) for details.

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for:
- Development setup
- Building from source
- Testing guidelines
- Pull request process

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Credits

Built with:
- [Alpine Linux](https://alpinelinux.org/)
- [vfkit](https://github.com/crc-org/vfkit)
- [PostgreSQL](https://www.postgresql.org/)
- [Valkey](https://valkey.io/)
- [OpenVSCode Server](https://github.com/gitpod-io/openvscode-server)
- [Dropbear SSH](https://matt.ucc.asn.au/dropbear/dropbear.html)

## Support

- [Documentation](docs/)
- [GitHub Issues](https://github.com/yourusername/vibecode-vm/issues)
- [Discussions](https://github.com/yourusername/vibecode-vm/discussions)

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history.

---

**Status**: ✅ Production Ready
**Version**: 1.0.0
**Last Updated**: 2026-01-05
```

### 2. LICENSE (MIT License recommended)

```text
MIT License

Copyright (c) 2026 VibeCode VM Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### 3. CONTRIBUTING.md

```markdown
# Contributing to VibeCode VM

Thank you for your interest in contributing!

## Getting Started

1. Fork the repository
2. Clone your fork
3. Create a feature branch
4. Make your changes
5. Test thoroughly
6. Submit a pull request

## Development Setup

### Prerequisites

- macOS with vfkit installed
- Alpine Linux knowledge helpful
- Bash scripting skills

### Building from Source

```bash
git clone https://github.com/yourusername/vibecode-vm.git
cd vibecode-vm
./azure/build-unified-services-with-datadog.sh
```

This creates `azure/unified-services-static.cpio.gz`.

### Testing

```bash
# Launch VM for testing
./azure/test-unified-vm-boot.sh

# Wait for boot and verify all services
ssh root@192.168.64.10
```

## Code Style

- Use consistent indentation (2 spaces for scripts)
- Add comments for non-obvious code
- Follow existing patterns in build scripts
- Test all changes before submitting

## Pull Request Process

1. Update documentation if needed
2. Add tests if applicable
3. Ensure all services still work
4. Update CHANGELOG.md
5. Submit PR with clear description

## Reporting Issues

Please include:
- OS version and hardware
- vfkit version
- Console log (`/tmp/vm-console.log`)
- Steps to reproduce
- Expected vs actual behavior

## Questions?

- Open a [Discussion](https://github.com/yourusername/vibecode-vm/discussions)
- Check existing [Issues](https://github.com/yourusername/vibecode-vm/issues)

## Code of Conduct

Be respectful, inclusive, and constructive. See CODE_OF_CONDUCT.md.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
```

### 4. QUICK-START.md

```markdown
# Quick Start - VibeCode VM

Get running in 5 minutes!

## 1. Install Prerequisites

```bash
# Install vfkit
brew install vfkit

# Verify installation
vfkit --version
```

## 2. Download and Extract

```bash
# Download latest release
curl -LO https://github.com/yourusername/vibecode-vm/releases/latest/download/vibecode-vm-v1.0.tar.gz

# Extract
tar xzf vibecode-vm-v1.0.tar.gz
cd vibecode-vm-v1.0
```

## 3. Launch VM

```bash
./scripts/launch-vm.sh
```

Wait for boot (~13 seconds). Look for this output:

```
===========================================
  ACCESS CREDENTIALS
===========================================

SSH Access:
  ssh root@192.168.64.10
  Password: vibecode

Valkey Access:
  redis-cli -h 192.168.64.10 -p 6379

PostgreSQL Access:
  psql -h 192.168.64.10 -p 5432 -U postgres

OpenVSCode Access:
  http://192.168.64.10:8080
===========================================
```

## 4. Test Services

```bash
# SSH
ssh root@192.168.64.10
# Password: vibecode

# Redis/Valkey
redis-cli -h 192.168.64.10 PING
# Should return: PONG

# PostgreSQL
psql -h 192.168.64.10 -U postgres -c "SELECT version();"

# VS Code
open http://192.168.64.10:8080
```

## Done!

All services are running. See [README.md](README.md) for more details.

## Next Steps

- [Add Persistent Storage](docs/VOLUME-MOUNTING-GUIDE.md)
- [View Examples](examples/)
- [Read Architecture Docs](docs/ARCHITECTURE.md)
```

### 5. scripts/launch-vm.sh

```bash
#!/bin/bash
# Simple VM launcher script

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

KERNEL="$PROJECT_DIR/linux-kernel-arm64"
INITRAMFS="$PROJECT_DIR/unified-services-production-v1.0.cpio.gz"
LOG_FILE="/tmp/vibecode-vm-console.log"

# Check files exist
if [ ! -f "$KERNEL" ]; then
    echo "Error: Kernel not found at $KERNEL"
    exit 1
fi

if [ ! -f "$INITRAMFS" ]; then
    echo "Error: Initramfs not found at $INITRAMFS"
    exit 1
fi

# Check vfkit
if ! command -v vfkit >/dev/null 2>&1; then
    echo "Error: vfkit not installed"
    echo "Install with: brew install vfkit"
    exit 1
fi

echo "Starting VibeCode VM..."
echo ""
echo "Console log: $LOG_FILE"
echo ""

# Launch VM
vfkit \
    --cpus 4 \
    --memory 2048 \
    --kernel "$KERNEL" \
    --initrd "$INITRAMFS" \
    --kernel-cmdline "console=hvc0" \
    --device virtio-net,nat,mac=52:54:00:12:34:70 \
    --device virtio-serial,logFilePath="$LOG_FILE" \
    --device virtio-rng \
    --gui

echo ""
echo "VM stopped"
```

### 6. Distribution Package Structure

```
vibecode-vm-v1.0/
├── README.md
├── LICENSE
├── QUICK-START.md
├── CONTRIBUTING.md
├── CHANGELOG.md
├── linux-kernel-arm64
├── unified-services-production-v1.0.cpio.gz
├── unified-services-production-v1.0.cpio.gz.sha256
├── scripts/
│   ├── launch-vm.sh
│   ├── launch-with-volumes.sh
│   └── test-services.sh
├── docs/
│   ├── ARCHITECTURE.md
│   ├── VOLUME-MOUNTING-GUIDE.md
│   ├── VOLUME-MOUNTING-QUICK-START.md
│   └── TROUBLESHOOTING.md
└── examples/
    ├── basic-launch.sh
    ├── with-postgresql.sh
    ├── with-valkey.sh
    └── development-setup.sh
```

### 7. Create Distribution Archives

```bash
# Create tar.gz
tar czf vibecode-vm-v1.0.tar.gz vibecode-vm-v1.0/

# Create zip (for non-Unix users)
zip -r vibecode-vm-v1.0.zip vibecode-vm-v1.0/

# Generate checksums
sha256sum vibecode-vm-v1.0.tar.gz > vibecode-vm-v1.0.tar.gz.sha256
sha256sum vibecode-vm-v1.0.zip > vibecode-vm-v1.0.zip.sha256
```

---

## Agent AD Task Summary

1. Create README.md (comprehensive, ~250 lines)
2. Add LICENSE file (MIT recommended)
3. Create CONTRIBUTING.md
4. Create QUICK-START.md
5. Create launch scripts (scripts/)
6. Organize existing docs (docs/)
7. Create example scripts (examples/)
8. Package distribution directory
9. Create tar.gz and zip archives
10. Generate SHA256 checksums
11. Write AGENT-AD-OSS-PREPARATION-REPORT.md

**Estimated time**: 30-40 minutes
**Expected output**: Complete open source distribution package ready for GitHub release

