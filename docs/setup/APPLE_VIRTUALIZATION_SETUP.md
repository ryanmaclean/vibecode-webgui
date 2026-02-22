# Apple Virtualization Framework Setup Guide

This guide provides step-by-step instructions for setting up and using Apple's Virtualization Framework with VibeCode, including Swift environment setup, VM creation, and ASIF disk image management.

## Prerequisites

### System Requirements

**Minimum Requirements**:
- **macOS Version**: 12.0 (Monterey) or later
- **Architecture**: ARM64 (Apple Silicon) or x86_64 (Intel)
- **RAM**: 8GB (16GB+ recommended for running multiple VMs)
- **Disk**: 20GB+ free space for VM images and dependencies
- **Virtualization**: Enabled in firmware (usually enabled by default)

**Optimal Configuration**:
- **macOS Version**: 26.0+ (Tahoe) for ASIF disk format support
- **Architecture**: ARM64 (Apple Silicon) for best performance
- **Storage**: APFS volume with sufficient space
- **Memory**: 16GB+ for running multiple VMs simultaneously

### Feature Availability by macOS Version

| Feature | macOS 12 | macOS 13 | macOS 14 | macOS 15 | macOS 26 |
|---------|----------|----------|----------|----------|----------|
| Basic Virtualization | ✅ | ✅ | ✅ | ✅ | ✅ |
| Linux Boot Loader | ✅ | ✅ | ✅ | ✅ | ✅ |
| EFI Boot | ✅ | ✅ | ✅ | ✅ | ✅ |
| VirtIO Graphics | ✅ | ✅ | ✅ | ✅ | ✅ |
| ASIF Read | ❌ | ❌ | ❌ | ✅ (15.5+) | ✅ |
| ASIF Create | ❌ | ❌ | ❌ | ❌ | ✅ |

## Swift Environment Setup

### Step 1: Verify Xcode Installation

The Virtualization Framework requires Xcode or Xcode Command Line Tools.

**Option 1: Full Xcode (Recommended for development)**

```bash
# Check if Xcode is installed
xcodebuild -version
```

Expected output:
```
Xcode 15.0 (or higher)
Build version 15A240d
```

If not installed, download from the [Mac App Store](https://apps.apple.com/us/app/xcode/id497799835).

**Option 2: Command Line Tools (Minimal)**

```bash
# Install Command Line Tools
xcode-select --install

# Verify installation
xcode-select -p
```

Expected output:
```
/Library/Developer/CommandLineTools
```

### Step 2: Install Swift

Swift is included with Xcode. Verify your installation:

```bash
# Check Swift version
swift --version
```

Expected output:
```
swift-driver version: 1.87.1 (or higher)
Apple Swift version 5.9 (or higher)
Target: arm64-apple-macosx14.0 (or your macOS version)
```

### Step 3: Clone VibeCode Repository

```bash
# Clone the repository
git clone https://github.com/ryanmaclean/vibecode-webgui.git
cd vibecode-webgui

# Navigate to Swift platform code
cd platforms/macos
```

### Step 4: Build Swift VM Manager

Build the native VM manager that interfaces with the Virtualization Framework.

```bash
# Build in release mode for best performance
cd platforms/macos/vm
swift build -c release

# Verify build succeeded
ls -la .build/release/
```

Expected output should include executable binaries.

**Alternative: Build with Xcode**

```bash
# Open in Xcode
cd platforms/macos/VibeCodeSwift
open VibeCodeSwift.xcodeproj

# Build via Xcode: Product > Build (⌘+B)
```

### Step 5: Configure Security Entitlements

The Virtualization Framework requires specific security entitlements.

**Check existing entitlements**:

```bash
# View entitlements file
cat platforms/macos/VibeCodeSwift/VibeCode.entitlements
```

**Required entitlement**:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.virtualization</key>
    <true/>
    <key>com.apple.security.files.user-selected.read-write</key>
    <true/>
    <key>com.apple.security.network.client</key>
    <true/>
</dict>
</plist>
```

**Note**: For development, run the app from within the Xcode project or signed .app bundle to ensure entitlements are applied.

## VM Creation

### Understanding VM Components

A VM requires several components:
1. **Configuration**: CPU, memory, disk settings
2. **Boot Loader**: Either EFI or direct kernel boot
3. **Storage**: Disk image for the VM filesystem
4. **Networking**: NAT or bridged network configuration
5. **Display** (optional): For GUI Linux VMs

### Method 1: Using TypeScript API (Recommended)

The high-level TypeScript API provides the easiest way to create VMs.

#### Create a Basic VM

```typescript
import { NativeVMProvider } from '@/lib/vm/providers/native-vm';

const provider = new NativeVMProvider();

// Define VM configuration
const vmConfig = {
  vmId: 'vibecode-dev',
  cpus: 4,                          // Number of CPU cores
  memoryGB: 4,                      // RAM in GB
  diskSizeGB: 20,                   // Disk size in GB
  kernelPath: '/path/to/vmlinuz',   // Linux kernel
  initrdPath: '/path/to/initramfs', // Initial ramdisk
  diskPath: '/path/to/disk.img'     // Disk image path
};

// Create the VM
await provider.createVM(vmConfig);

// Start the VM
await provider.startVM('vibecode-dev');

// Check VM status
const status = await provider.getVMStatus('vibecode-dev');
console.log(`VM State: ${status.state}`);
```

#### Create VM with Custom Boot Parameters

```typescript
const vmConfig = {
  vmId: 'vibecode-custom',
  cpus: 2,
  memoryGB: 2,
  diskSizeGB: 10,
  kernelPath: '/path/to/vmlinuz',
  initrdPath: '/path/to/initramfs',
  diskPath: '/path/to/disk.img',
  bootParams: 'console=hvc0 root=/dev/vda rw'  // Custom kernel args
};

await provider.createVM(vmConfig);
```

### Method 2: Using Swift API (Advanced)

For advanced use cases, use the Swift API directly.

#### Create Swift VM Configuration

```swift
import Virtualization
import Foundation

class VMCreator {
    func createVM() throws -> VZVirtualMachine {
        let config = VZVirtualMachineConfiguration()

        // CPU Configuration
        config.cpuCount = 4

        // Memory Configuration (4GB)
        config.memorySize = 4 * 1024 * 1024 * 1024

        // Boot Loader - Direct Kernel Boot
        let bootLoader = VZLinuxBootLoader(kernelURL: URL(fileURLWithPath: "/path/to/vmlinuz"))
        bootLoader.initialRamdiskURL = URL(fileURLWithPath: "/path/to/initramfs")
        bootLoader.commandLine = "console=hvc0 root=/dev/vda rw"
        config.bootLoader = bootLoader

        // Storage Device
        let diskURL = URL(fileURLPath: "/path/to/disk.img")
        let diskAttachment = try VZDiskImageStorageDeviceAttachment(
            url: diskURL,
            readOnly: false
        )
        let blockDevice = VZVirtioBlockDeviceConfiguration(attachment: diskAttachment)
        config.storageDevices = [blockDevice]

        // Network Device
        let networkDevice = VZVirtioNetworkDeviceConfiguration()
        networkDevice.attachment = VZNATNetworkDeviceAttachment()
        config.networkDevices = [networkDevice]

        // Serial Console
        let serialPort = VZVirtioConsoleDeviceSerialPortConfiguration()
        let consoleDevice = VZVirtioConsoleDeviceConfiguration()
        consoleDevice.ports[0] = serialPort
        config.consoleDevices = [consoleDevice]

        // Validate configuration
        try config.validate()

        // Create VM
        return VZVirtualMachine(configuration: config)
    }
}
```

#### Start and Manage VM

```swift
let vm = try VMCreator().createVM()

// Start VM
vm.start { result in
    switch result {
    case .success:
        print("✅ VM started successfully")
    case .failure(let error):
        print("❌ VM start failed: \(error)")
    }
}

// Stop VM
vm.stop { error in
    if let error = error {
        print("❌ VM stop failed: \(error)")
    } else {
        print("✅ VM stopped successfully")
    }
}
```

### Method 3: Using Specialized VM Classes

VibeCode provides pre-configured VM classes for common use cases.

#### PostgreSQL VM

```swift
import VibeCodeVM

let postgresVM = PostgreSQLVM(
    vmId: "postgres-dev",
    cpus: 2,
    memoryGB: 4,
    diskSizeGB: 20
)

try await postgresVM.create()
try await postgresVM.start()

// PostgreSQL is now accessible on configured port
```

#### Node.js Development VM

```swift
let nodeVM = NodeJSVM(
    vmId: "nodejs-dev",
    cpus: 4,
    memoryGB: 4,
    diskSizeGB: 15
)

try await nodeVM.create()
try await nodeVM.start()
```

#### Valkey (Redis) VM

```swift
let valkeyVM = ValkeyVM(
    vmId: "valkey-cache",
    cpus: 2,
    memoryGB: 2,
    diskSizeGB: 10
)

try await valkeyVM.create()
try await valkeyVM.start()
```

## ASIF Disk Image Management

ASIF (Apple Sparse Image Format) provides superior performance on macOS 26+ (Tahoe).

### Understanding ASIF Benefits

- **2-3x Faster I/O**: Optimized for APFS filesystem
- **Sparse Allocation**: Only uses space for actual data (87% efficiency)
- **Single File**: Easier management than sparse bundles
- **Native Integration**: Tight macOS filesystem integration

**Performance Comparison**:

| Format | Write Speed | Read Speed | Storage Efficiency |
|--------|-------------|------------|-------------------|
| **ASIF** | 1.6 GB/s | 3.7 GB/s | 87% (13MB for 100MB logical) |
| RAW (UDRW) | 0.8 GB/s | 1.5 GB/s | 0% (100MB for 100MB) |
| Sparse (UDSP) | 0.9 GB/s | 1.6 GB/s | 65% (35MB for 100MB) |

### Creating ASIF Disk Images

#### Method 1: Using Swift DiskImageManager (Recommended)

```swift
import Foundation
import DiskImageManager

let mgr = DiskImageManager.shared

// Check ASIF support
if mgr.isASIFSupported() {
    print("✅ ASIF supported on this system")

    // Create 10GB ASIF disk
    try await mgr.createDiskImage(
        path: "/path/to/vm-disk.asif",
        size: "10G",
        volumeName: "vm-data",
        format: .asif
    )

    print("✅ ASIF disk created")
} else {
    print("⚠️  ASIF not supported, using RAW format")

    // Fallback to RAW format
    try await mgr.createDiskImage(
        path: "/path/to/vm-disk.img",
        size: "10G",
        volumeName: "vm-data",
        format: .raw
    )
}
```

#### Method 2: Using hdiutil Command Line

**macOS 26+ (Tahoe) - ASIF Format**:

```bash
# Create 20GB ASIF sparse disk image
hdiutil create \
    -size 20g \
    -format ASIF \
    -volname "VM-Disk" \
    -fs APFS \
    /path/to/vm-disk.asif

# Verify creation
ls -lh /path/to/vm-disk.asif
hdiutil imageinfo /path/to/vm-disk.asif
```

**macOS 15 and Earlier - Sparse Format**:

```bash
# Create 20GB sparse disk image
hdiutil create \
    -size 20g \
    -format UDSP \
    -volname "VM-Disk" \
    -fs APFS \
    /path/to/vm-disk.sparseimage

# Verify creation
ls -lh /path/to/vm-disk.sparseimage
```

**Cross-Compatible - RAW Format**:

```bash
# Create 20GB raw disk image (works on all macOS versions)
hdiutil create \
    -size 20g \
    -format UDRW \
    -volname "VM-Disk" \
    /path/to/vm-disk.img

# Convert to raw if needed
hdiutil convert vm-disk.dmg -format UDRW -o vm-disk.img
```

### Attaching ASIF Disks to VMs

#### Swift Example

```swift
import Virtualization

let config = VZVirtualMachineConfiguration()

// Attach ASIF disk
let diskURL = URL(fileURLWithPath: "/path/to/vm-disk.asif")
let diskAttachment = try VZDiskImageStorageDeviceAttachment(
    url: diskURL,
    readOnly: false  // Set to true for read-only access
)

// Create VirtIO block device
let blockDevice = VZVirtioBlockDeviceConfiguration(attachment: diskAttachment)
config.storageDevices = [blockDevice]
```

#### TypeScript Example

```typescript
const vmConfig = {
  vmId: 'asif-vm',
  cpus: 4,
  memoryGB: 4,
  diskSizeGB: 20,
  kernelPath: '/path/to/vmlinuz',
  initrdPath: '/path/to/initramfs',
  diskPath: '/path/to/vm-disk.asif',  // ASIF disk
  diskFormat: 'asif'
};

await provider.createVM(vmConfig);
```

### ASIF Disk Operations

#### Resize ASIF Disk

```bash
# Resize ASIF disk to 30GB
hdiutil resize -size 30g /path/to/vm-disk.asif

# Verify new size
hdiutil imageinfo /path/to/vm-disk.asif | grep "Total Bytes"
```

#### Check ASIF Disk Usage

```bash
# Show actual disk usage vs logical size
du -h /path/to/vm-disk.asif     # Actual usage
hdiutil imageinfo /path/to/vm-disk.asif | grep "Total Bytes"  # Logical size
```

#### Convert Between Formats

```bash
# Convert ASIF to RAW (for compatibility)
hdiutil convert /path/to/vm-disk.asif \
    -format UDRW \
    -o /path/to/vm-disk.img

# Convert RAW to ASIF (macOS 26+ only)
hdiutil convert /path/to/vm-disk.img \
    -format ASIF \
    -o /path/to/vm-disk.asif
```

### ASIF Performance Benchmarking

Test ASIF disk performance:

```bash
# Run benchmark script
./scripts/benchmarks/applevf_fastboot_bench.sh

# Analyze results
python3 ./scripts/benchmarks/applevf_fastboot_bench.py
```

Expected performance (macOS 26+ on Apple Silicon):
- Write Speed: 1.4-1.8 GB/s
- Read Speed: 3.0-4.0 GB/s
- Storage Efficiency: 80-90%

## Complete Setup Example

### End-to-End VM Setup with ASIF

```bash
#!/bin/bash
# Complete VM setup script

# Configuration
VM_NAME="vibecode-dev"
VM_DISK_PATH="$HOME/VMs/${VM_NAME}.asif"
VM_KERNEL_PATH="$HOME/VMs/vmlinuz"
VM_INITRD_PATH="$HOME/VMs/initramfs"

# Step 1: Create VM directory
mkdir -p "$HOME/VMs"

# Step 2: Download kernel and initramfs
# (Example using Alpine Linux)
curl -L -o "$VM_KERNEL_PATH" \
    https://dl-cdn.alpinelinux.org/alpine/v3.19/releases/aarch64/vmlinuz-lts

curl -L -o "$VM_INITRD_PATH" \
    https://dl-cdn.alpinelinux.org/alpine/v3.19/releases/aarch64/initramfs-lts

# Step 3: Create ASIF disk (macOS 26+)
if sw_vers -productVersion | grep -q "^26"; then
    echo "Creating ASIF disk..."
    hdiutil create -size 20g -format ASIF -volname "$VM_NAME" "$VM_DISK_PATH"
else
    echo "ASIF not available, using UDSP..."
    hdiutil create -size 20g -format UDSP -volname "$VM_NAME" "${VM_DISK_PATH%.asif}.sparseimage"
fi

# Step 4: Create VM using TypeScript API
node -e "
const { NativeVMProvider } = require('./src/lib/vm/providers/native-vm');

async function createVM() {
    const provider = new NativeVMProvider();

    const config = {
        vmId: '$VM_NAME',
        cpus: 4,
        memoryGB: 4,
        diskSizeGB: 20,
        kernelPath: '$VM_KERNEL_PATH',
        initrdPath: '$VM_INITRD_PATH',
        diskPath: '$VM_DISK_PATH'
    };

    await provider.createVM(config);
    await provider.startVM('$VM_NAME');
    console.log('✅ VM created and started');
}

createVM().catch(console.error);
"

echo "✅ VM setup complete"
```

## Troubleshooting

### Common Issues

#### Issue: "doesn't have virtualization entitlement"

**Cause**: App not properly signed with virtualization entitlement

**Solution**:
```bash
# Option 1: Run from Xcode
cd platforms/macos/VibeCodeSwift
open VibeCodeSwift.xcodeproj
# Run via Xcode (Product > Run or ⌘+R)

# Option 2: Check entitlements
codesign -d --entitlements - /path/to/YourApp.app

# Option 3: Re-sign with entitlements
codesign --force --sign - \
    --entitlements platforms/macos/VibeCodeSwift/VibeCode.entitlements \
    /path/to/YourApp.app
```

#### Issue: ASIF disk creation fails

**Cause**: ASIF only supported on macOS 26+ (Tahoe)

**Solution**:
```bash
# Check macOS version
sw_vers -productVersion

# If < 26.0, use sparse format instead
hdiutil create -size 20g -format UDSP -volname "VM" disk.sparseimage

# Or use RAW format for compatibility
hdiutil create -size 20g -format UDRW -volname "VM" disk.img
```

#### Issue: VM fails to start

**Cause**: Invalid configuration or missing files

**Solution**:
```bash
# Check kernel and initrd exist
ls -lh /path/to/vmlinuz
ls -lh /path/to/initramfs

# Check disk image is accessible
ls -lh /path/to/disk.asif

# Verify configuration in logs
tail -f ~/Library/Logs/VibeCode/vm-manager.log

# Test with minimal config
swift run -- create-vm --cpus 1 --memory 1 --disk 5
```

#### Issue: Slow disk I/O performance

**Cause**: Not using ASIF format or disk on slow volume

**Solution**:
```bash
# Check disk format
hdiutil imageinfo /path/to/disk.img | grep "Format:"

# If not ASIF and on macOS 26+, convert
hdiutil convert disk.img -format ASIF -o disk.asif

# Ensure disk is on fast APFS volume, not network share
df -h /path/to/disk.asif
```

#### Issue: Out of memory errors

**Cause**: VM memory exceeds available RAM

**Solution**:
```swift
// Reduce VM memory allocation
config.memorySize = 2 * 1024 * 1024 * 1024  // 2GB instead of 4GB

// Check available memory
let physicalMemory = ProcessInfo.processInfo.physicalMemory
let availableMemory = physicalMemory / (1024 * 1024 * 1024)  // Convert to GB
print("Available memory: \(availableMemory) GB")
```

### Build Issues

#### Swift Build Fails

```bash
# Clean build artifacts
cd platforms/macos/vm
swift package clean

# Update Swift toolchain
xcode-select --install

# Rebuild
swift build -c release --verbose
```

#### Xcode Build Fails

```bash
# Clean build folder
cd platforms/macos/VibeCodeSwift
rm -rf ~/Library/Developer/Xcode/DerivedData/*

# Clean in Xcode
# Product > Clean Build Folder (⇧⌘K)

# Rebuild
# Product > Build (⌘+B)
```

### Runtime Issues

#### VM Console Not Responding

```swift
// Ensure serial console is attached
let serialPort = VZVirtioConsoleDeviceSerialPortConfiguration()
let inputStream = Pipe()
let outputStream = Pipe()

serialPort.attachment = VZFileHandleSerialPortAttachment(
    fileHandleForReading: inputStream.fileHandleForReading,
    fileHandleForWriting: outputStream.fileHandleForWriting
)
```

#### Network Not Working

```swift
// Use NAT networking (simpler, more reliable)
let networkDevice = VZVirtioNetworkDeviceConfiguration()
networkDevice.attachment = VZNATNetworkDeviceAttachment()
config.networkDevices = [networkDevice]

// For bridged networking, ensure permissions
// System Settings > Privacy & Security > Network
```

## Verification Checklist

After completing setup, verify everything works:

- [ ] macOS version compatible (12.0+, 26.0+ for ASIF)
- [ ] Xcode or Command Line Tools installed
- [ ] `swift --version` returns 5.9+
- [ ] VibeCode repository cloned
- [ ] Swift VM manager builds successfully
- [ ] Security entitlements configured
- [ ] Can create disk images (ASIF or UDSP)
- [ ] Test VM creates successfully
- [ ] Test VM starts successfully
- [ ] VM console accessible
- [ ] Network connectivity working

## Next Steps

Once your Apple Virtualization environment is set up:

1. **Feature Documentation**: Review [Apple Virtualization Framework](../features/APPLE_VIRTUALIZATION_FRAMEWORK.md)
2. **Fast Boot Optimization**: See [EFI Fast Boot Guide](../guides/apple-vf-fastboot.md)
3. **ASIF Technical Details**: Read [ASIF Disk Format](../ASIF_DISK_FORMAT.md)
4. **VM Management**: Consult [VM Management Guide](../VM_MANAGEMENT.md)
5. **Development Guide**: See [Development Guide](../DEVELOPMENT.md)

## Additional Resources

### Official Documentation

- [Apple Virtualization Framework](https://developer.apple.com/documentation/virtualization)
- [Running GUI Linux in a VM](https://developer.apple.com/documentation/virtualization/running-gui-linux-in-a-virtual-machine-on-a-mac)
- [Swift Documentation](https://www.swift.org/documentation/)

### VibeCode Documentation

- [ASIF Status Report](../ASIF_VZ_STATUS.md)
- [Tahoe Virtualization Strategy](../TAHOE_VIRTUALIZATION_STRATEGY.md)
- [Native VM Protocol](../NATIVE_VM_README.md)

### Community Resources

- [vfkit](https://github.com/crc-org/vfkit) - Go wrapper for Virtualization Framework
- [Lima](https://github.com/lima-vm/lima) - Linux VMs on macOS
- [UTM](https://mac.getutm.app/) - GUI for virtual machines

## Getting Help

If you encounter issues:

1. Check [Troubleshooting Guide](../TROUBLESHOOTING.md)
2. Review console logs: `~/Library/Logs/VibeCode/`
3. Search [GitHub issues](https://github.com/ryanmaclean/vibecode-webgui/issues)
4. Open a new issue with:
   - macOS version (`sw_vers`)
   - Swift version (`swift --version`)
   - Error messages and logs
   - Steps to reproduce

---

**Last Updated**: 2025-02-21
**macOS Version**: 12.0+ (26.0+ for ASIF)
**Status**: Production Ready
