# VM Bootloader Troubleshooting Guide

Troubleshooting guide for VM boot issues on Apple Virtualization.framework.

## Common Error: "Invalid Bootloader"

```
Error: Invalid virtual machine configuration. The boot loader is invalid.
```

### Cause
Fresh Alpine cloud images don't have GRUB pre-installed in the EFI partition.

### Solution

#### Step 1: Verify EFI Variable Store

Check that the EFI NVRAM file exists and is properly sized:

```swift
// In your VMManager
let efiVarsURL = vmDirectory.appendingPathComponent("efi-vars.nvram")

// Create if doesn't exist (64KB)
if !FileManager.default.fileExists(atPath: efiVarsURL.path) {
    let efiStore = VZEFIVariableStore(creatingVariableStoreAt: efiVarsURL)
}

// Use in boot loader
let bootLoader = VZEFIBootLoader()
bootLoader.variableStore = VZEFIVariableStore(url: efiVarsURL)
```

#### Step 2: Install GRUB in Guest

Boot the VM with serial console and install GRUB:

```bash
# In Alpine guest
apk update
apk add grub grub-efi efibootmgr

# Mount EFI partition
mkdir -p /boot/efi
mount /dev/vda1 /boot/efi

# Install GRUB for ARM64
grub-install --target=arm64-efi \
  --efi-directory=/boot/efi \
  --bootloader-id=alpine

# Generate config
grub-mkconfig -o /boot/grub/grub.cfg

# Verify
efibootmgr -v
```

#### Step 3: Verify Configuration

After GRUB installation, the EFI boot entry should show:

```
Boot0001* alpine  HD(1,GPT,...)/File(\EFI\alpine\grubaa64.efi)
```

## Swift Implementation

### Creating VMs with Proper EFI

```swift
import Virtualization

func createVMConfiguration(vmPath: URL, diskPath: URL) -> VZVirtualMachineConfiguration {
    let config = VZVirtualMachineConfiguration()

    // EFI Boot Loader with persistent variable store
    let efiVarsPath = vmPath.appendingPathComponent("efi-vars.nvram")
    let bootLoader = VZEFIBootLoader()

    if FileManager.default.fileExists(atPath: efiVarsPath.path) {
        bootLoader.variableStore = VZEFIVariableStore(url: efiVarsPath)
    } else {
        bootLoader.variableStore = try? VZEFIVariableStore(
            creatingVariableStoreAt: efiVarsPath
        )
    }

    config.bootLoader = bootLoader

    // Disk
    let diskAttachment = try! VZDiskImageStorageDeviceAttachment(
        url: diskPath,
        readOnly: false
    )
    config.storageDevices = [VZVirtioBlockDeviceConfiguration(attachment: diskAttachment)]

    // CPU and Memory
    config.cpuCount = 2
    config.memorySize = 2 * 1024 * 1024 * 1024  // 2GB

    return config
}
```

### Detecting Boot State

```swift
func isVMBootable(vmPath: URL) -> Bool {
    let efiVarsPath = vmPath.appendingPathComponent("efi-vars.nvram")

    guard FileManager.default.fileExists(atPath: efiVarsPath.path) else {
        return false
    }

    // Check if EFI vars have been initialized (> 1KB typically means valid)
    guard let attrs = try? FileManager.default.attributesOfItem(atPath: efiVarsPath.path),
          let size = attrs[.size] as? Int,
          size > 1024 else {
        return false
    }

    return true
}
```

## Working VMs Reference

The following VMs have valid bootloader configurations:
- `pgvector` - PostgreSQL with pgvector
- `ide` - OpenVSCode Server

Copy their EFI structure as reference (not the NVRAM directly, as boot entries are VM-specific).

## Prevention

### Use Pre-built Images

Build VM images with GRUB pre-installed using Packer or similar tools.

### Cloud-Init Bootstrap

Include GRUB installation in cloud-init user-data:

```yaml
#cloud-config
packages:
  - grub
  - grub-efi
  - efibootmgr

runcmd:
  - mkdir -p /boot/efi
  - mount /dev/vda1 /boot/efi
  - grub-install --target=arm64-efi --efi-directory=/boot/efi --bootloader-id=alpine
  - grub-mkconfig -o /boot/grub/grub.cfg
```

## Debugging

### Check VM Console Output

Enable serial console in VM configuration:

```swift
let serialPort = VZVirtioConsoleDeviceSerialPortConfiguration()
serialPort.attachment = VZFileHandleSerialPortAttachment(
    fileHandleForReading: FileHandle.standardInput,
    fileHandleForWriting: FileHandle.standardOutput
)
config.serialPorts = [serialPort]
```

### Verify Disk Partitions

From host, mount and inspect the disk:

```bash
# Attach disk image
hdiutil attach -nomount disk.raw

# List partitions
diskutil list

# Check EFI partition contents
mkdir /tmp/efi && mount -t msdos /dev/diskXs1 /tmp/efi
ls -la /tmp/efi/EFI/
```

## Related Documentation

- [Apple Virtualization.framework](https://developer.apple.com/documentation/virtualization)
- [GRUB Manual](https://www.gnu.org/software/grub/manual/)
- [Alpine Wiki: UEFI](https://wiki.alpinelinux.org/wiki/UEFI)
