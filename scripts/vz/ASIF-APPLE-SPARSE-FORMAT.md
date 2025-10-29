# Apple Sparse Image Format (ASIF) for VMs

## What is ASIF?

**Apple Sparse Image Format (ASIF)** is Apple's native sparse disk image format specifically designed for virtual machine storage with the Virtualization framework.

Reference: macOS Release Notes (152040832)

## Why Use ASIF?

### ✅ Native VZ Framework Integration
- Designed specifically for `VZDiskImageStorageDeviceAttachment`
- Optimized for VM workloads
- Better performance than generic sparse images

### ✅ Space Efficient
- Only allocates blocks as data is written
- Grows dynamically up to maximum size
- Reclaims unused space automatically

### ✅ APFS Optimized
- Native APFS integration
- Copy-on-Write (CoW) support
- Fast cloning and snapshots

### ✅ Apple Recommended
- Official format for VM storage
- Maintained by Apple
- Future-proof

## Creating ASIF Images

### Using diskutil (Recommended)

```bash
# Create ASIF disk image (10GB max size)
diskutil image create \
    -size 10g \
    -format ASIF \
    -volname "VM-Data" \
    vm-data.asif

# The file starts small (~10MB) and grows to 10GB maximum
```

### Using Disk Utility (GUI)

1. Open **Disk Utility.app**
2. File → New Image → Blank Image...
3. Format: **Apple Sparse Image Format (ASIF)**
4. Size: 10 GB
5. Encryption: None (or as needed)
6. Click **Save**

### In Swift Code

```swift
import Foundation

func createASIFImage(at url: URL, sizeInBytes: UInt64) throws {
    let task = Process()
    task.executableURL = URL(fileURLWithPath: "/usr/sbin/diskutil")
    task.arguments = [
        "image",
        "create",
        "-size", "\(sizeInBytes)b",
        "-format", "ASIF",
        url.deletingPathExtension().path
    ]

    try task.run()
    task.waitUntilExit()

    guard task.terminationStatus == 0 else {
        throw NSError(
            domain: "ASIFCreation",
            code: Int(task.terminationStatus),
            userInfo: [NSLocalizedDescriptionKey: "Failed to create ASIF image"]
        )
    }
}

// Usage
let imageURL = URL(fileURLWithPath: "~/.vfkit/instances/vm-123-data.asif")
try createASIFImage(at: imageURL, sizeInBytes: 10_000_000_000) // 10GB
```

## Using ASIF with VZ Framework

### Read-Only Base + ASIF Data Disk

```swift
import Virtualization

@available(macOS 12.0, *)
func configureStorage(for config: VZVirtualMachineConfiguration) throws {
    // Device 1: Read-only base rootfs (shared)
    let baseURL = URL(fileURLWithPath: "~/.vfkit/images/alpine-base.img")
    let baseAttachment = try VZDiskImageStorageDeviceAttachment(
        url: baseURL,
        readOnly: true
    )
    config.storageDevices.append(
        VZVirtioBlockDeviceConfiguration(attachment: baseAttachment)
    )

    // Device 2: ASIF data disk (per-VM, sparse)
    let dataURL = URL(fileURLWithPath: "~/.vfkit/instances/vm-123-data.asif")

    // Create ASIF if it doesn't exist
    if !FileManager.default.fileExists(atPath: dataURL.path) {
        try createASIFImage(at: dataURL, sizeInBytes: 10_000_000_000)
    }

    let dataAttachment = try VZDiskImageStorageDeviceAttachment(
        url: dataURL,
        readOnly: false  // Read-write
    )
    config.storageDevices.append(
        VZVirtioBlockDeviceConfiguration(attachment: dataAttachment)
    )
}
```

## ASIF vs Other Formats

| Format | Use Case | Performance | Space Efficiency | VZ Integration |
|--------|----------|-------------|------------------|----------------|
| **ASIF** | VM storage | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Native |
| SPARSE | Generic sparse | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Compatible |
| SPARSEBUNDLE | Time Machine | ⭐⭐⭐ | ⭐⭐⭐⭐ | Compatible |
| Raw .img | Simple disk | ⭐⭐⭐ | ⭐ (no sparse) | Compatible |

## Complete VM Setup with ASIF

```swift
@available(macOS 12.0, *)
class ProperVMWithASIF {
    func createVM(instanceID: String) throws -> VZVirtualMachine {
        let config = VZVirtualMachineConfiguration()

        // CPU & Memory
        config.cpuCount = min(4, VZVirtualMachineConfiguration.maximumAllowedCPUCount)
        config.memorySize = min(
            4 * 1024 * 1024 * 1024,
            VZVirtualMachineConfiguration.maximumAllowedMemorySize
        )

        // Bootloader
        let bootLoader = VZLinuxBootLoader(
            kernelURL: URL(fileURLWithPath: "~/.vfkit/images/vmlinux")
        )
        bootLoader.initialRamdiskURL = URL(fileURLWithPath: "~/.vfkit/images/initramfs")
        bootLoader.commandLine = "console=hvc0 root=/dev/vda ro rootfstype=ext4"
        config.bootLoader = bootLoader

        // Storage 1: Read-only base (shared across all VMs)
        let baseURL = URL(fileURLWithPath: "~/.vfkit/images/alpine-base.img")
        let baseAttachment = try VZDiskImageStorageDeviceAttachment(
            url: baseURL,
            readOnly: true
        )
        config.storageDevices.append(
            VZVirtioBlockDeviceConfiguration(attachment: baseAttachment)
        )

        // Storage 2: ASIF data disk (per-VM, sparse)
        let dataURL = URL(fileURLWithPath: "~/.vfkit/instances/\(instanceID)-data.asif")
        if !FileManager.default.fileExists(atPath: dataURL.path) {
            try createASIFImage(at: dataURL, sizeInBytes: 10_000_000_000)
        }
        let dataAttachment = try VZDiskImageStorageDeviceAttachment(
            url: dataURL,
            readOnly: false
        )
        config.storageDevices.append(
            VZVirtioBlockDeviceConfiguration(attachment: dataAttachment)
        )

        // Network
        let networkDevice = VZVirtioNetworkDeviceConfiguration()
        networkDevice.attachment = VZNATNetworkDeviceAttachment()
        config.networkDevices = [networkDevice]

        // Entropy
        config.entropyDevices = [VZVirtioEntropyDeviceConfiguration()]

        try config.validate()
        return VZVirtualMachine(configuration: config)
    }
}
```

## ASIF File Properties

```bash
# Check ASIF file size
ls -lh vm-data.asif
# Shows logical size (10GB)

du -h vm-data.asif
# Shows actual disk usage (~50MB with minimal data)

# Get detailed info
hdiutil imageinfo vm-data.asif
```

## Directory Structure with ASIF

```
~/.vfkit/
├── images/                           # Shared base images
│   ├── vmlinux                       # 31MB (shared)
│   ├── initramfs                     # 8.3MB (shared)
│   └── alpine-base.img               # 2GB (read-only, shared)
│
└── instances/                        # Per-VM ASIF data disks
    ├── dev-vm-data.asif              # 10GB max, ~50MB actual
    ├── test-vm-data.asif             # 10GB max, ~30MB actual
    └── staging-vm-data.asif          # 10GB max, ~100MB actual
```

## Benefits of ASIF for VMs

### 1. Space Efficiency Example

```
Traditional (non-sparse):
├─ VM 1: 10GB data disk = 10GB on disk
├─ VM 2: 10GB data disk = 10GB on disk
└─ VM 3: 10GB data disk = 10GB on disk
────────────────────────────────────────
Total: 30GB (all allocated immediately)

ASIF (sparse):
├─ VM 1: 10GB max, 50MB actual usage
├─ VM 2: 10GB max, 30MB actual usage
└─ VM 3: 10GB max, 100MB actual usage
────────────────────────────────────────
Total: ~180MB (only actual data)
Savings: 99.4% (180MB vs 30GB)
```

### 2. Fast VM Provisioning

```bash
# Old way: Pre-allocate 10GB
dd if=/dev/zero of=vm-data.img bs=1g count=10
# Takes minutes, uses 10GB immediately

# ASIF way: Create sparse 10GB
diskutil image create -size 10g -format ASIF vm-data
# Takes seconds, uses ~10MB initially
```

### 3. Dynamic Growth

```
Time    T0      T1      T2      T3
        ↓       ↓       ↓       ↓
Usage   10MB → 50MB → 500MB → 2GB

ASIF automatically grows as VM writes data
No pre-allocation needed
No manual resizing required
```

## Resizing ASIF Images

```bash
# Resize ASIF image (grow only, cannot shrink)
hdiutil resize -size 20g vm-data.asif

# Or in GB/TB notation
hdiutil resize -size 20g vm-data.asif    # 20 gigabytes
hdiutil resize -size 1t vm-data.asif     # 1 terabyte
```

## Converting Existing Images to ASIF

```bash
# Convert raw .img to ASIF
hdiutil convert \
    existing-vm.img \
    -format ASIF \
    -o vm-data.asif

# Reclaim unused space after conversion
hdiutil compact vm-data.asif
```

## Best Practices with ASIF

### 1. Use for VM Data Disks
```
✅ Per-VM data disks (read-write)
❌ Shared base images (use raw .img read-only)
```

### 2. Set Reasonable Maximum Sizes
```swift
// Good: Realistic maximum
try createASIFImage(at: url, sizeInBytes: 10_000_000_000) // 10GB

// Better: Based on use case
let size: UInt64
switch vmType {
case .development: size = 20 * 1024 * 1024 * 1024  // 20GB
case .testing:     size = 10 * 1024 * 1024 * 1024  // 10GB
case .production:  size = 50 * 1024 * 1024 * 1024  // 50GB
}
try createASIFImage(at: url, sizeInBytes: size)
```

### 3. Store on APFS Volumes
- ASIF requires APFS for optimal performance
- Will work on HFS+ but with reduced benefits
- Always use APFS when possible

### 4. Periodic Compaction
```bash
# Reclaim unused space (like TRIM for SSDs)
hdiutil compact vm-data.asif

# Can save significant space after deleting files in VM
```

## Monitoring ASIF Space Usage

```swift
func checkASIFUsage(at url: URL) throws -> (logical: UInt64, actual: UInt64) {
    let attrs = try FileManager.default.attributesOfItem(atPath: url.path)

    let logicalSize = attrs[.size] as? UInt64 ?? 0

    let resourceValues = try url.resourceValues(forKeys: [.fileSizeKey])
    let actualSize = UInt64(resourceValues.fileSize ?? 0)

    return (logical: logicalSize, actual: actualSize)
}

// Usage
let (logical, actual) = try checkASIFUsage(at: asifURL)
print("Logical size: \(logical / 1_000_000_000)GB")  // Max size
print("Actual usage: \(actual / 1_000_000)MB")        // Disk usage
print("Efficiency: \(100 - (actual * 100 / logical))%")
```

## Integration with VM Manager

```swift
@available(macOS 12.0, *)
class VMManager {
    func provisionVM(name: String, dataSize: UInt64) throws -> VZVirtualMachine {
        let dataPath = "~/.vfkit/instances/\(name)-data.asif"
        let dataURL = URL(fileURLWithPath: dataPath)

        // Create ASIF data disk
        if !FileManager.default.fileExists(atPath: dataURL.path) {
            print("Creating ASIF data disk (\(dataSize / 1_000_000_000)GB max)...")
            try createASIFImage(at: dataURL, sizeInBytes: dataSize)
            print("Created in seconds with minimal disk usage!")
        }

        // Create VM with read-only base + ASIF data
        return try createVM(
            baseImage: "~/.vfkit/images/alpine-base.img",  // Read-only
            dataImage: dataURL.path                         // ASIF, read-write
        )
    }
}
```

## Summary

### Why ASIF is the Right Choice

1. **Apple's Recommended Format** - Designed for VZ framework
2. **Native Integration** - Optimized for VM workloads
3. **Space Efficient** - 99%+ savings vs pre-allocated disks
4. **Fast Provisioning** - Seconds to create, not minutes
5. **Dynamic Growth** - Grows automatically as needed
6. **APFS Optimized** - CoW, snapshots, cloning support

### When to Use ASIF

- ✅ Per-VM data disks (read-write)
- ✅ VM swap/temp storage
- ✅ VM persistent volumes
- ✅ Any VM-specific writable storage

### When NOT to Use ASIF

- ❌ Shared base images (use raw .img read-only)
- ❌ Non-VM storage needs (use APFS volumes)
- ❌ Portable images (ASIF is macOS-specific)

## References

- macOS Release Notes (152040832)
- `man diskutil`
- Apple Virtualization Framework Documentation
- VZDiskImageStorageDeviceAttachment Documentation

## Next Steps

1. Create read-only base Alpine image
2. Use ASIF for per-VM data disks
3. Update VM configuration to use both
4. Test provisioning speed and space efficiency
5. Demonstrate instant cloning with APFS CoW

This is the Apple-recommended way for VM storage!
