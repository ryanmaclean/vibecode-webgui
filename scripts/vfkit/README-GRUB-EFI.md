# GRUB EFI Bootloader Solution for Alpine Linux VMs

This directory contains scripts and utilities to solve the bootloader issue for Alpine Linux VMs running on macOS using Virtualization.framework.

## Problem

Fresh Alpine cloud images don't have GRUB pre-installed, and EFI NVRAM boot entries are missing, causing "invalid bootloader" errors when booting VMs.

## Solution

A comprehensive solution inspired by Tart and UTM that:
1. Installs GRUB EFI bootloader on Alpine disk images
2. Manages EFI boot entries using Virtualization.framework APIs
3. Provides automated workflows for VM preparation

## Files

### Scripts

- **`install-grub-alpine.sh`**: Installs GRUB on Alpine disk images using VM-based or chroot methods
- **`prepare-vm-with-grub.sh`**: Complete workflow to prepare a VM with GRUB and EFI configuration
- **`manage-efi-boot-entries.sh`**: Manages EFI boot entries (create, discover, list)
- **`integrate-grub-into-vm-creation.sh`**: Integration functions for existing VM creation scripts

### Swift Utilities

- **`VibeCodeSwift/Sources/EFIBootManager/EFIBootManager.swift`**: Swift library for EFI boot management

## Quick Start

### Prepare a New VM

```bash
./scripts/vfkit/prepare-vm-with-grub.sh vibecode-postgresql 10
```

### Install GRUB on Existing Disk

```bash
./scripts/vfkit/install-grub-alpine.sh ~/.vfkit/vms/vibecode-postgresql/disk/root.img postgresql
```

### Manage EFI Boot Entries

```bash
# Create boot entry
./scripts/vfkit/manage-efi-boot-entries.sh create postgresql \
    ~/.vfkit/vms/vibecode-postgresql/disk/root.img \
    ~/.vfkit/vms/vibecode-postgresql/efi/efi.nvram

# Discover boot entries (boot VM once)
./scripts/vfkit/manage-efi-boot-entries.sh discover \
    ~/.vfkit/vms/vibecode-postgresql/disk/root.img \
    ~/.vfkit/vms/vibecode-postgresql/efi/efi.nvram
```

## Integration

### In Bash Scripts

```bash
source ./scripts/vfkit/integrate-grub-into-vm-creation.sh

# Ensure GRUB is installed
ensure_grub_installed "$disk_image" "$vm_name"

# Ensure EFI store exists
ensure_efi_store "$efi_store_path"

# Complete VM preparation
prepare_vm_complete "$vm_name" "$disk_size_gb"
```

### In Swift Code

```swift
import EFIBootManager

// Create EFI variable store
let efiStore = try EFIBootManager.createEFIVariableStore(at: efiStoreURL)

// Create boot entry
try EFIBootManager.createBootEntry(
    diskPath: diskURL,
    efiStorePath: efiStoreURL,
    bootloaderPath: "/EFI/BOOT/BOOTAA64.EFI",
    label: "Alpine Linux"
)

// Discover boot entries
try await EFIBootManager.discoverBootEntries(
    diskPath: diskURL,
    efiStorePath: efiStoreURL,
    timeout: 30.0
)
```

## How It Works

### GRUB Installation

The `install-grub-alpine.sh` script offers two methods:

1. **VM-based**: Boots a temporary VM with cloud-init to install GRUB
2. **Chroot**: Mounts the disk and installs GRUB via chroot environment

Both methods:
- Install `grub-efi`, `efibootmgr`, `dosfstools`, `gptfdisk`
- Create EFI directory structure (`/boot/efi/EFI/BOOT`, `/boot/efi/EFI/ALPINE`)
- Run `grub-install` to install GRUB to EFI partition
- Generate GRUB configuration

### EFI Boot Entry Management

EFI boot entries are managed through:

1. **EFI Variable Store**: Created using `VZEFIVariableStore`
2. **Boot Discovery**: EFI firmware automatically discovers bootloaders on first boot
3. **Boot Entry Creation**: Happens automatically when VM boots

The `EFIBootManager` Swift utility provides programmatic access to:
- Create EFI variable stores
- Prepare disks for EFI boot
- Trigger boot discovery

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│              VM Creation Workflow                        │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  1. Create Disk Image                                   │
│     └─> prepare-vm-with-grub.sh                        │
│                                                          │
│  2. Partition Disk (GPT + ESP)                          │
│     └─> gdisk / manual partitioning                    │
│                                                          │
│  3. Install Alpine Linux                                 │
│     └─> setup-alpine (in VM)                           │
│                                                          │
│  4. Install GRUB                                        │
│     └─> install-grub-alpine.sh                         │
│         ├─> VM-based method (cloud-init)               │
│         └─> Chroot method (macOS mount)                │
│                                                          │
│  5. Create EFI Variable Store                          │
│     └─> EFIBootManager.createEFIVariableStore()       │
│                                                          │
│  6. Discover Boot Entries                               │
│     └─> manage-efi-boot-entries.sh discover           │
│         └─> Boot VM once, EFI discovers bootloader     │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## Comparison with Tart/UTM

### Tart
- Dynamically creates EFI boot entries
- Uses virtualized EFI environment
- Injects custom boot entries

### UTM
- Uses QEMU's EFI firmware
- Can specify boot entries directly
- Broad compatibility layer

### Our Solution
- Combines both approaches
- Uses Virtualization.framework native APIs
- Automated preparation scripts
- Swift utilities for programmatic access

## Troubleshooting

### "Invalid bootloader" Error

**Cause**: GRUB not installed or EFI boot entry missing

**Solution**:
```bash
./scripts/vfkit/prepare-vm-with-grub.sh <vm_name>
```

### Bootloader Not Found

**Cause**: EFI can't find bootloader on disk

**Solution**:
1. Verify GRUB installation: Check `/boot/efi/EFI/BOOT/BOOTAA64.EFI` exists
2. Verify partition structure: ESP should be partition 1, FAT32
3. Trigger boot discovery: `manage-efi-boot-entries.sh discover`

### EFI Variable Store Issues

**Cause**: Corrupted or missing EFI variable store

**Solution**:
1. Delete existing EFI store
2. Create new one: Use `EFIBootManager.createEFIVariableStore()`
3. Boot VM to let EFI initialize

## Requirements

- macOS 12.0+ (for Virtualization.framework)
- Swift 5.9+ (for Swift utilities)
- vfkit (optional, for VM-based GRUB installation)
- qemu-img or dd (for disk image creation)
- gdisk (for disk partitioning)
- Alpine Linux ISO (for Alpine installation)

## Documentation

- [EFI Bootloader Setup Guide](../../docs/guides/efi-bootloader-setup.md)
- [Virtualization.framework Documentation](https://developer.apple.com/documentation/virtualization)
- [GRUB EFI Documentation](https://www.gnu.org/software/grub/manual/grub/html_node/EFI-systems.html)

## License

MIT License - See LICENSE file in project root

