# EFI Boot Configuration for VibeCode VMs

## Overview

This guide explains how VibeCode VMs are configured for UEFI boot using Apple's Virtualization.framework, and how to troubleshoot bootloader issues.

## Architecture

### Boot Flow

```
VZVirtualMachine Start
    ↓
VZEFIBootLoader reads EFI NVRAM
    ↓
UEFI Firmware initializes
    ↓
Boot entries scanned in EFI NVRAM
    ↓
GRUB bootloader loaded from ESP (EFI System Partition)
    ↓
Linux kernel + initramfs loaded
    ↓
Alpine Linux boots
```

### Components

1. **VZEFIBootLoader** - Apple's UEFI firmware implementation
2. **EFI NVRAM** - Variable store containing boot configuration
3. **Disk Image** - RAW format with GPT partition table
4. **EFI System Partition (ESP)** - FAT32 partition with bootloader
5. **GRUB** - Bootloader installed in ESP

## EFI NVRAM Initialization

### Proper Method (Current)

Uses Apple's `VZEFIVariableStore` API to create properly initialized NVRAM:

```swift
// Create EFI variable store
try VZEFIVariableStore(creatingVariableStoreAt: url)

// Use with bootloader
let bootloader = VZEFIBootLoader()
bootloader.variableStore = try VZEFIVariableStore(url: url)
```

**Advantages:**
- ✅ Creates valid NVRAM structure
- ✅ Compatible with VZEFIBootLoader
- ✅ Proper initialization by Apple's framework
- ✅ Reproducible across VMs

### Incorrect Methods (Old)

#### Method 1: Empty NVRAM with dd
```bash
dd if=/dev/zero of=vm-efi.nvram bs=1m count=64
```
**Problem:** Creates empty file with no valid EFI structure - VZ cannot boot

#### Method 2: Copy System Template
```bash
cp /System/Library/Frameworks/Virtualization.framework/Resources/UEFI/OVMF_VARS.fd vm-efi.nvram
```
**Problem:** Template has no boot entries for this VM - VZ cannot find bootloader

## Tools

### 1. EFI Initialization Tool

Create new EFI NVRAM:
```bash
./scripts/init-efi-nvram.sh vm-efi.nvram
```

Validate existing NVRAM:
```bash
./scripts/init-efi-nvram.sh --validate vm-efi.nvram
```

Recreate (force overwrite):
```bash
./scripts/init-efi-nvram.sh --force vm-efi.nvram
```

### 2. Fix Existing VMs

Fix all VMs with invalid EFI:
```bash
./scripts/fix-vm-efi.sh
```

This script:
1. Scans for all VM EFI NVRAM files
2. Validates each one
3. Backs up and recreates invalid ones
4. Preserves valid ones

### 3. Rebuild VMs

Build all VMs with proper EFI:
```bash
./scripts/rebuild-all-vms-with-services.sh
```

Now uses proper EFI initialization instead of dd/cp methods.

## Disk Image Requirements

For UEFI boot to work, disk images must have:

1. **GPT Partition Table** (not MBR)
2. **EFI System Partition** (FAT32, ~100MB)
   - Located at `/dev/vda1` or first partition
   - Type: EF00 (EFI System)
   - Contains: `EFI/BOOT/BOOTAA64.EFI` (GRUB for ARM64)
3. **Root Partition** (ext4 or other)
   - Contains Alpine Linux filesystem
   - Configured in GRUB

### Alpine Cloud Images

**Problem:** Alpine cloud images (`nocloud_alpine-*.qcow2`) may not have GRUB pre-installed in the EFI partition.

**Solution:** Use Alpine standard installation ISO to install with GRUB:

```bash
# Download Alpine installation ISO
curl -LO "https://dl-cdn.alpinelinux.org/alpine/v3.19/releases/aarch64/alpine-standard-3.19.0-aarch64.iso"

# Boot VM with ISO attached (see TEAM1_EFI_BOOT_MISSION_REPORT.md)
# Install Alpine with setup-alpine
# Choose "sys" mode for full disk installation with bootloader
```

## Troubleshooting

### Error: "Invalid bootloader"

**Symptoms:**
- VM fails to start immediately
- Error message: "Invalid virtual machine configuration. The boot loader is invalid."

**Cause:** EFI NVRAM file is invalid or corrupted

**Solution:**
```bash
./scripts/fix-vm-efi.sh
```

### Error: "No bootable device"

**Symptoms:**
- VM starts but shows UEFI shell or "no bootable device" message
- Console shows: "Failed to load bootloader"

**Cause:** Disk image doesn't have bootable EFI partition

**Solution:**
1. Install Alpine Linux properly with `setup-alpine` in "sys" mode
2. Or use pre-built images with GRUB installed
3. Or manually create EFI partition with GRUB (see TEAM1_EFI_BOOT_MISSION_REPORT.md)

### Verify EFI NVRAM

Check if NVRAM is valid:
```bash
./scripts/init-efi-nvram.sh --validate dist/vm-images/vibecode-postgresql-efi.nvram
```

Expected output:
```
✅ EFI variable store is valid and can be used with VZEFIBootLoader
```

### Verify Disk Image

Check disk structure:
```bash
# On macOS
hdiutil attach -nomount dist/vm-images/vibecode-postgresql.img

# List partitions
diskutil list /dev/diskX

# Should show:
#   1: EFI EFI              100.0 MB   disk3s1
#   2: Linux Filesystem     9.9 GB     disk3s2

# Detach
hdiutil detach /dev/diskX
```

## VM Configuration in Swift

Example from VMManager.swift:

```swift
// Boot loader - UEFI
let bootloader = VZEFIBootLoader()

// EFI variable store
let efiStore = try VZEFIVariableStore(url: vmInfo.efiPath)
bootloader.variableStore = efiStore
config.bootLoader = bootloader

// Storage - Disk image
let diskAttachment = try VZDiskImageStorageDeviceAttachment(
    url: vmInfo.diskPath,
    readOnly: false,
    cachingMode: .automatic,
    synchronizationMode: .full
)
let storageDevice = VZVirtioBlockDeviceConfiguration(attachment: diskAttachment)
config.storageDevices = [storageDevice]
```

## Best Practices

### For Development

1. **Always use proper EFI initialization:**
   ```bash
   ./scripts/init-efi-nvram.sh vm-efi.nvram
   ```

2. **Test NVRAM before use:**
   ```bash
   ./scripts/init-efi-nvram.sh --validate vm-efi.nvram
   ```

3. **Keep backups:**
   - Working NVRAM files are precious
   - Backup before making changes
   - fix-vm-efi.sh creates automatic backups

### For Distribution

1. **Pre-build VMs with proper EFI:**
   - Use rebuild-all-vms-with-services.sh
   - Test all VMs boot successfully
   - Include both .img and -efi.nvram files

2. **Document boot requirements:**
   - Specify macOS version (13.0+)
   - List dependencies (none for EFI tool)
   - Include troubleshooting steps

3. **Provide validation tools:**
   - Include init-efi-nvram.sh
   - Include fix-vm-efi.sh
   - Document usage clearly

## Testing

### Test Suite

The staff-level-test-suite.sh includes EFI validation:

```bash
./scripts/staff-level-test-suite.sh
```

Checks:
- EFI NVRAM files exist
- EFI NVRAM files are valid size (128KB)
- EFI NVRAM files can be loaded by VZ
- VMs boot successfully

### Manual Testing

Test individual VM:
```bash
# Validate EFI
./scripts/init-efi-nvram.sh --validate dist/vm-images/vibecode-postgresql-efi.nvram

# Start VM (via GUI or script)
# Check console logs for boot progress
tail -f ~/vibecode-webgui/logs/vibecode-postgresql-console.log
```

## References

- [Apple Virtualization Framework Documentation](https://developer.apple.com/documentation/virtualization)
- [VZEFIBootLoader API](https://developer.apple.com/documentation/virtualization/vzefibootloader)
- [TEAM1_EFI_BOOT_MISSION_REPORT.md](./TEAM1_EFI_BOOT_MISSION_REPORT.md) - Detailed research
- [PODMAN_RESEARCH.md](./PODMAN_RESEARCH.md) - How Podman does EFI boot

## Contributing

If you encounter EFI boot issues:

1. Check existing issues: [01-bootloader-fix.md](../.github/ISSUE_TEMPLATE/01-bootloader-fix.md)
2. Validate your NVRAM files
3. Check disk images have bootable EFI partition
4. Share console logs for debugging
5. Test with known-working VMs (ide, pgvector) for comparison

## Support

For help with EFI boot issues:
- See troubleshooting section above
- Check TEAM1_EFI_BOOT_MISSION_REPORT.md for in-depth details
- Run fix-vm-efi.sh to automatically fix common issues
- Open an issue with console logs and validation output
