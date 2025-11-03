---
name: Fix VM Bootloader Issues
about: Get all 6 VMs to boot successfully
title: 'Fix EFI bootloader configuration for 4 non-booting VMs'
labels: critical, vm-infrastructure, help wanted
assignees: ''
---

## Problem

4 of 6 VMs won't boot due to "invalid bootloader" errors.

**Affected VMs**:
- postgresql
- valkey
- nodejs
- nodejs-codeserver

**Working VMs** (for reference):
- pgvector
- ide

## Current Behavior

When clicking "Start VM" in the GUI:
```
Error: Invalid virtual machine configuration. The boot loader is invalid.
```

## Root Cause

Fresh Alpine cloud images don't have GRUB pre-installed in the EFI partition. The EFI NVRAM files either:
1. Don't have valid boot entries
2. Point to bootloader that doesn't exist
3. Are corrupted/incorrectly initialized

## What We've Tried

1. Copying EFI from working VMs - Didn't work (boot entries are VM-specific)
2. Creating EFI with `dd if=/dev/zero` - Creates empty NVRAM
3. Using Alpine cloud images directly - No bootloader installed

## Possible Solutions

### Option 1: Use Pre-Booted Alpine Images
Download Alpine images that already have bootloader installed.

**Pros**: Clean, reproducible  
**Cons**: Need to find or create these

### Option 2: Boot VMs Once with vfkit
Use vfkit to boot VMs once, install GRUB, then use with VZ.

**Pros**: Automate the process  
**Cons**: Complex, requires vfkit

### Option 3: Extract Boot Files from Working VMs
Copy the actual boot files (not just EFI) from pgvector/ide VMs.

**Pros**: Might work immediately  
**Cons**: Not reproducible, fragile

### Option 4: Build VMs with Packer
Use Packer to build VMs with proper bootloader.

**Pros**: Industry standard, repeatable  
**Cons**: Adds complexity

## Acceptance Criteria

- [ ] All 6 VMs boot without "invalid bootloader" error
- [ ] Boot process is reproducible (documented script)
- [ ] EFI NVRAM files are valid
- [ ] VMs boot in under 30 seconds
- [ ] Solution is documented in docs/guides/

## Resources

**Existing code**:
- `VibeCodeSwift/Sources/ViewModels/VMManager.swift` - VM configuration
- `scripts/rebuild-all-vms-with-services.sh` - VM build script
- `config/cloud-init/` - Cloud-init configurations

**Research**:
- `docs/PODMAN_RESEARCH.md` - How Podman does it
- `docs/guides/DISTRIBUTION_VM_STRATEGY.md` - VM distribution approach
- VirtualBuddy source code (uses VZ successfully)

## Testing

After fixing:
```bash
./scripts/staff-level-test-suite.sh
# Should show all VMs boot successfully
```

## Priority

**Critical** - Blocks service installation and all downstream work.

