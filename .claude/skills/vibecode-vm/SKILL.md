---
name: vibecode-vm
description: Build and manage native macOS VMs using Apple Virtualization Framework. Create Alpine Linux ARM64 rootfs images, download kernels, launch VMs with Valkey/PostgreSQL/OpenVSCode services, and manage VM lifecycle. Use when building VM images, testing containers natively, or running isolated Linux development environments on Apple Silicon.
---

# VibeCode VM Skill

Build and manage native macOS VMs using Apple's Virtualization Framework (vfkit).

## Quick Setup

```bash
# Install vfkit and create directories
python3 scripts/vfkit/01-setup-vfkit.py

# Download Alpine Linux kernel
python3 scripts/vfkit/02-download-alpine-kernel.py

# Create Alpine rootfs with Node.js
python3 scripts/vfkit/03-create-alpine-rootfs.py

# Launch VM
python3 scripts/vfkit/04-launch-alpine-vm.py
```

## Prerequisites

- macOS 13+ (Ventura or later)
- Apple Silicon (ARM64) or Intel Mac
- Homebrew (for vfkit installation)
- Python 3.10+

## VM Manager CLI

The Python VM manager provides full lifecycle management:

```bash
# List all VMs and their status
python3 scripts/vfkit/vm-manager.py list

# Start specific VM
python3 scripts/vfkit/vm-manager.py start valkey
python3 scripts/vfkit/vm-manager.py start postgresql
python3 scripts/vfkit/vm-manager.py start nodejs-dev

# Start all VMs
python3 scripts/vfkit/vm-manager.py start-all

# Stop VMs
python3 scripts/vfkit/vm-manager.py stop valkey
python3 scripts/vfkit/vm-manager.py stop-all

# Health check
python3 scripts/vfkit/vm-manager.py health

# Monitor resource usage
python3 scripts/vfkit/vm-manager.py monitor

# View/follow logs
python3 scripts/vfkit/vm-manager.py logs valkey
python3 scripts/vfkit/vm-manager.py follow valkey
```

## Quick Reference

### Setup Scripts

| Script | Purpose | Command |
|--------|---------|---------|
| `01-setup-vfkit.py` | Install vfkit, create directories | `python3 scripts/vfkit/01-setup-vfkit.py` |
| `02-download-alpine-kernel.py` | Download Alpine Linux kernel | `python3 scripts/vfkit/02-download-alpine-kernel.py` |
| `03-create-alpine-rootfs.py` | Create Alpine rootfs with Node.js | `python3 scripts/vfkit/03-create-alpine-rootfs.py` |
| `06-create-vibecode-rootfs.py` | Create full VibeCode rootfs | `python3 scripts/vfkit/06-create-vibecode-rootfs.py` |
| `07-create-persistent-vm.py` | Create persistent disk VM | `python3 scripts/vfkit/07-create-persistent-vm.py` |

### Launch Scripts

| Script | Purpose | Command |
|--------|---------|---------|
| `04-launch-alpine-vm.py` | Launch basic Alpine VM | `python3 scripts/vfkit/04-launch-alpine-vm.py` |
| `05-launch-vibecode-vm.py` | Launch full VibeCode VM | `python3 scripts/vfkit/05-launch-vibecode-vm.py` |
| `start-all-vms.py` | Start all configured VMs | `python3 scripts/vfkit/start-all-vms.py` |
| `stop-all-vms.py` | Stop all running VMs | `python3 scripts/vfkit/stop-all-vms.py` |

### Service VMs

| Script | Purpose | Port | Command |
|--------|---------|------|---------|
| `start-valkey.py` | In-memory cache (Redis-compatible) | 6379 | `python3 scripts/vfkit/start-valkey.py` |
| `start-postgresql.py` | PostgreSQL + pgvector | 5432 | `python3 scripts/vfkit/start-postgresql.py` |
| `start-nodejs-dev.py` | Node.js dev environment | 3000/5173/8080 | `python3 scripts/vfkit/start-nodejs-dev.py` |

### Testing & Validation

| Script | Purpose | Command |
|--------|---------|---------|
| `vm-health-check.py` | Check VM health status | `python3 scripts/vfkit/vm-health-check.py` |
| `test_all_vms.py` | Run VM test suite | `python3 scripts/vfkit/test_all_vms.py` |
| `verify_services.py` | Verify services are running | `python3 scripts/vfkit/verify_services.py` |
| `test-valkey.py` | Test Valkey connectivity | `python3 scripts/vfkit/test-valkey.py` |

## Interactive TUI Menu

For a guided experience, use the interactive menu:

```bash
python3 scripts/vibecode_vm_menu.py
```

This provides:
- VM status overview
- Build initramfs (Ansible)
- Build Swift app
- Start/stop VMs
- SSH connectivity
- VSCode browser access
- Network scanning

### CLI Mode (Non-Interactive)

The menu also supports direct CLI commands:

```bash
# Show VM status
python3 scripts/vibecode_vm_menu.py status -n

# Show help
python3 scripts/vibecode_vm_menu.py help -n

# Available commands
python3 scripts/vibecode_vm_menu.py --help
```

Commands: `status`, `build`, `build-app`, `start`, `stop`, `ssh`, `vscode`, `clean`, `help`, `menu`

### Testing the TUI

```bash
# Run TUI component tests
python3 scripts/vibecode_vm_menu.py --test
```

## Build Scripts

### Build Initramfs

```bash
# Python initramfs builder (for Docker)
python3 scripts/build_initramfs.py

# K3s-enabled initramfs
python3 scripts/build_k3s_initramfs.py
```

### Build VM Disk Images

```bash
python3 scripts/create_vm_disk_images.py
```

### Build Swift VM Manager

```bash
# Compile Swift binary with entitlements
python3 scripts/build_vm_manager.py
```

## Workflows

### Create Development VM

```bash
# Setup and create Alpine VM with Node.js
python3 scripts/vfkit/01-setup-vfkit.py
python3 scripts/vfkit/02-download-alpine-kernel.py
python3 scripts/vfkit/03-create-alpine-rootfs.py
python3 scripts/vfkit/04-launch-alpine-vm.py
```

### Start Full Service Stack

```bash
# Start Valkey, PostgreSQL, and Node.js dev VM
python3 scripts/vfkit/vm-manager.py start-all
python3 scripts/vfkit/vm-manager.py health
```

### Test VM Performance

```bash
python3 scripts/vfkit/basic_performance_test.py
```

## Directory Structure

```
~/.vfkit/vms/vibecode-alpine/
├── kernel/     # Linux kernel files
├── rootfs/     # Root filesystem builds
│   └── build/  # Build working directory
├── disk/       # Persistent disk images
└── logs/       # VM console and error logs

~/VibeCode VMs/
└── *.bundle    # macOS VM bundles (SwiftUI apps)
```

## Services Available in VMs

| Service | Port | Credentials |
|---------|------|-------------|
| SSH | 22 | root / vibecode |
| Valkey (Redis) | 6379 | No auth |
| PostgreSQL | 5432 | vibecode / vibecode |
| OpenVSCode | 8080 | No auth |
| Vite Dev Server | 5173 | N/A |
| Node.js App | 3000 | N/A |

## Network

VMs use NAT networking on the `192.168.64.x` subnet. DHCP assigns IPs automatically.

Scan for VM IPs:
```bash
for i in {2..20}; do nc -zw1 192.168.64.$i 22 && echo "192.168.64.$i"; done
```

## Troubleshooting

### vfkit not found
```bash
brew install vfkit
```

### VM not starting
```bash
# Check logs
python3 scripts/vfkit/vm-manager.py logs <vm-name>

# Check port availability
lsof -i :6379  # Valkey
lsof -i :5432  # PostgreSQL
```

### Permission denied
Ensure vfkit has Virtualization entitlements:
```bash
codesign -dv $(which vfkit)
```

## Notes

- **Apple Silicon recommended** - Native ARM64 VMs with near-native performance
- **Intel Macs** - Supported but use x86_64 emulation
- **Persistent storage** - Use `07-create-persistent-vm.py` for disk-backed VMs
- **Ansible integration** - Full Ansible playbooks in `ansible/` directory
