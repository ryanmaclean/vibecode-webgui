---
title: VM Management on Apple Silicon
description: Complete guide to managing macOS VMs with VirtualBuddy, vfkit, and native tools
category: Infrastructure
---

# VM Management on Apple Silicon

> **Last Updated:** October 25, 2025  
> **Status:** Production Ready  
> **Platform:** VibeCode macOS VM Testing

## Overview

Manage macOS virtual machines on Apple Silicon Macs for testing and development. Supports VirtualBuddy, native Virtualization Framework, and vfkit.

## Quick Start

```bash
# List VMs
./vm-menu.py list

# Clone a VM
./vm-menu.py clone "Source VM" "Test VM 1"

# Start VM
./vm-menu.py start "Test VM 1"

# Stop VM
./vm-menu.py stop "Test VM 1"
```

## Tools Available

### 1. Python CLI (`vm-menu.py`)
**Best for:** Interactive menu and automation

Features:
- Clone VMs with unique Machine IDs
- Start/stop VMs
- Backup to tank3
- VirtualBuddy + standalone support

### 2. Native Swift (`vm-native.swift`)
**Best for:** Apple Virtualization Framework

Features:
- IPSW-based creation
- Machine ID isolation
- Configuration persistence
- Native APIs like VirtualBuddy

### 3. Bash Scripts
- `vm-cli.sh` - Direct vfkit control
- `vm-ops.sh` - VM lifecycle management
- `standalone-vm.py` - Independent operation

## Architecture

### Virtualization Options

1. **VirtualBuddy** (GUI) - BSD licensed
   - Best for visual management
   - Can fork and customize

2. **Native Framework** (Swift) - Apple APIs
   - `VZVirtualMachineConfiguration`
   - Same as VirtualBuddy

3. **vfkit** (Command-line) - Direct control
   - Fast and lightweight
   - Scriptable

### The 2-VM Limit

Apple's EULA allows **2 macOS VMs running simultaneously**.

**Workarounds:**
- Use different macOS versions
- Stop one, start another
- Linux VMs (unlimited)

## Key Features

### Machine ID Isolation
Unique IDs per VM clone prevent conflicts:
```swift
let machineID = VZMacMachineIdentifier()
```

### IPSW-Based Creation
Create VMs from restore images:
```swift
VZMacOSRestoreImage.load(from: ipswURL) { ... }
```

### APFS Efficient Cloning
Use `ditto` for space-efficient clones:
```bash
ditto source.vbvm target.vbvm
# Shares underlying storage
```

## Testing Your App in VMs

### Setup code-server

```bash
# Install in VM
./scripts/setup-codeserver-in-vm.sh studios-virtual-machine.local

# Access at
http://studios-virtual-machine.local:8080
```

### Test Your VibeCode App

```bash
# Upload app to VM
./scripts/test-app-in-vm.sh studios-virtual-machine.local

# Access at
http://studios-virtual-machine.local:3000
```

## Best Practices

### From Viable/Vimy/Livable
- Bundle structure for VMs
- Minimal launcher overhead
- virtiofs for shared folders
- HiDPI support for Retina

### Configuration
```yaml
# code-server-config.yaml
bind-addr: 0.0.0.0:8080
auth: none
disable-telemetry: true
disable-update-check: true
```

## Troubleshooting

### Network Issues
```bash
# In VirtualBuddy: Settings → Network → NAT
```

### Disk Space
```bash
# Expand in VirtualBuddy: Settings → Storage
```

### Machine IDs
```bash
# Always generate new IDs for clones
echo "$(uuidgen)" > MachineIdentifier
```

## Related Documentation

- [VM Provider Abstraction](https://github.com/ryanmaclean/vibecode-webgui/blob/main/docs/vm-provider-migration-guide.md)
- [VFKit Features](https://github.com/ryanmaclean/vibecode-webgui/blob/main/docs/vfkit-features-investigation.md)
- [CLI Tools](../cli-tools/user-guide.md)

## References

- [Apple Virtualization Framework](https://developer.apple.com/documentation/virtualization/vzvirtualmachineconfiguration)
- [VirtualBuddy](https://github.com/insidegui/VirtualBuddy)
- [Eclectic Light Virtualization](https://eclecticlight.co/virtualisation-on-apple-silicon/)
