# EFI Bootloader Setup Guide for Alpine Linux VMs

This guide explains how to set up GRUB EFI bootloader on Alpine Linux VMs for use with Apple's Virtualization.framework, solving the bootloader issues that prevent VMs from booting.

## Problem Statement

Fresh Alpine cloud images do not come with GRUB pre-installed, and EFI NVRAM boot entries are missing or misconfigured. This causes "invalid bootloader" errors when trying to boot VMs using Virtualization.framework.

## Root Cause

1. **Missing GRUB**: Alpine cloud images are minimal and don't include GRUB EFI bootloader
2. **Missing EFI Boot Entries**: EFI NVRAM variable stores don't have valid boot entries pointing to the bootloader

## Solution Overview

Our solution follows a two-pronged approach inspired by Tart and UTM:

1. **Install GRUB**: Install GRUB EFI bootloader on Alpine disk images
2. **Manage EFI Boot Entries**: Create and manage EFI NVRAM boot entries

## Implementation

### Components

1. **`scripts/vfkit/install-grub-alpine.sh`**: Installs GRUB on Alpine disk images
2. **`scripts/vfkit/prepare-vm-with-grub.sh`**: Complete VM preparation workflow
3. **`scripts/vfkit/manage-efi-boot-entries.sh`**: Manages EFI boot entries
4. **`VibeCodeSwift/Sources/EFIBootManager/EFIBootManager.swift`**: Swift utility for EFI boot management

### Quick Start

#### Option 1: Automated Preparation (Recommended)

```bash
# Prepare a new VM with GRUB and EFI configuration
./scripts/vfkit/prepare-vm-with-grub.sh vibecode-postgresql 10
```

This script will:
1. Create a disk image
2. Partition it with GPT and EFI System Partition
3. Guide you through Alpine installation
4. Install GRUB bootloader
5. Create EFI variable store

#### Option 2: Manual GRUB Installation

If you already have an Alpine disk image:

```bash
# Install GRUB on existing disk image
./scripts/vfkit/install-grub-alpine.sh ~/.vfkit/vms/vibecode-postgresql/disk/root.img postgresql
```

#### Option 3: EFI Boot Entry Management

```bash
# Create EFI boot entry
./scripts/vfkit/manage-efi-boot-entries.sh create postgresql \
    ~/.vfkit/vms/vibecode-postgresql/disk/root.img \
    ~/.vfkit/vms/vibecode-postgresql/efi/efi.nvram

# Discover boot entries (boot VM once to let EFI discover bootloader)
./scripts/vfkit/manage-efi-boot-entries.sh discover \
    ~/.vfkit/vms/vibecode-postgresql/disk/root.img \
    ~/.vfkit/vms/vibecode-postgresql/efi/efi.nvram
```

## Detailed Workflow

### Step 1: Create Disk Image

```bash
# Create disk image (if not already created)
qemu-img create -f raw ~/.vfkit/vms/vibecode-postgresql/disk/root.img 10G
```

### Step 2: Partition Disk

The disk needs:
- **Partition 1**: EFI System Partition (FAT32, ~100MB)
- **Partition 2**: Root filesystem (ext4, remaining space)

You can use `gdisk` or let the preparation script handle it.

### Step 3: Install Alpine Linux

Boot from Alpine ISO and install to disk:

```bash
vfkit \
    --bootloader efi,variable-store=~/.vfkit/vms/vibecode-postgresql/efi/efi.nvram,create \
    --device virtio-blk,path=~/.vfkit/vms/vibecode-postgresql/disk/root.img \
    --device virtio-blk,path=alpine-virt-3.22.0-aarch64.iso,devName=cdrom \
    --device virtio-net,nat
```

Inside the VM, run:
```bash
setup-alpine
# Follow prompts to install Alpine to /dev/vda2
```

### Step 4: Install GRUB

After Alpine is installed, install GRUB:

```bash
./scripts/vfkit/install-grub-alpine.sh \
    ~/.vfkit/vms/vibecode-postgresql/disk/root.img \
    postgresql
```

This script offers two methods:
1. **VM-based installation**: Boots a temporary VM to install GRUB
2. **Chroot installation**: Mounts the disk and installs GRUB via chroot

### Step 5: Create EFI Boot Entry

The EFI boot entry is automatically created when the VM boots for the first time and EFI firmware discovers the bootloader. You can also trigger discovery:

```bash
./scripts/vfkit/manage-efi-boot-entries.sh discover \
    ~/.vfkit/vms/vibecode-postgresql/disk/root.img \
    ~/.vfkit/vms/vibecode-postgresql/efi/efi.nvram
```

## How It Works

### GRUB Installation

The `install-grub-alpine.sh` script:

1. **VM Method**: Creates a temporary VM with cloud-init script that:
   - Installs `grub-efi`, `efibootmgr`, `dosfstools`, `gptfdisk`
   - Creates EFI directory structure (`/boot/efi/EFI/BOOT`, `/boot/efi/EFI/ALPINE`)
   - Runs `grub-install` to install GRUB to EFI partition
   - Generates GRUB configuration

2. **Chroot Method**: Mounts the disk image and:
   - Sets up chroot environment
   - Installs GRUB packages
   - Runs GRUB installation commands

### EFI Boot Entry Management

The EFI boot entry management follows Tart/UTM patterns:

1. **EFI Variable Store**: Created using `VZEFIVariableStore(creatingVariableStoreAt:)`
2. **Boot Discovery**: EFI firmware automatically discovers bootloaders when VM boots
3. **Boot Entry Creation**: Happens automatically during first boot

The `EFIBootManager.swift` utility provides:
- `createBootEntry()`: Prepares disk and EFI store for boot
- `createEFIVariableStore()`: Creates properly initialized EFI variable store
- `discoverBootEntries()`: Boots VM once to trigger EFI boot discovery

## Integration with VMManager

The VMManager.swift already uses EFI boot:

```swift
let bootloader = VZEFIBootLoader()
let efiStore = try VZEFIVariableStore(url: vmInfo.efiPath)
bootloader.variableStore = efiStore
config.bootLoader = bootloader
```

Ensure your VM images have:
1. GRUB installed on the disk
2. Valid EFI variable store file
3. Proper partition structure

## Troubleshooting

### "Invalid bootloader" Error

This usually means:
1. GRUB is not installed on the disk
2. EFI variable store is empty or corrupted
3. Disk partition structure is incorrect

**Solution**: Run the preparation script:
```bash
./scripts/vfkit/prepare-vm-with-grub.sh <vm_name>
```

### Bootloader Not Found

If EFI can't find the bootloader:
1. Verify GRUB is installed: Check `/boot/efi/EFI/BOOT/BOOTAA64.EFI` exists
2. Verify partition structure: ESP should be partition 1, FAT32
3. Trigger boot discovery: Run `manage-efi-boot-entries.sh discover`

### EFI Variable Store Issues

If EFI variable store is corrupted:
1. Delete the existing EFI store file
2. Create a new one: `swift -e "import Virtualization; let _ = try VZEFIVariableStore(creatingVariableStoreAt: URL(fileURLWithPath: \"path/to/efi.nvram\"))"`
3. Boot the VM to let EFI initialize it

## Comparison with Tart/UTM

### Tart Approach
- Dynamically creates EFI boot entries
- Uses virtualized EFI environment
- Injects custom boot entries

### UTM Approach
- Uses QEMU's EFI firmware capabilities
- Can specify boot entries directly
- Broad compatibility layer

### Our Approach
- Combines both: Install GRUB + Manage EFI entries
- Uses Virtualization.framework native APIs
- Automated preparation scripts
- Swift utilities for programmatic management

## Best Practices

1. **Always use the preparation script** for new VMs
2. **Keep EFI variable stores** separate from disk images
3. **Verify GRUB installation** before first boot
4. **Test boot discovery** if VMs fail to boot
5. **Document VM configurations** for reproducibility

## References

- [Virtualization.framework Documentation](https://developer.apple.com/documentation/virtualization)
- [GRUB EFI Documentation](https://www.gnu.org/software/grub/manual/grub/html_node/EFI-systems.html)
- [Tart GitHub](https://github.com/cirruslabs/tart)
- [UTM GitHub](https://github.com/utmapp/UTM)

