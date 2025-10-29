# Proper VM Architecture: Read-Only Boot + Sparse Data Disks

## The Right Way (Apple's Pattern)

```
┌─────────────────────────────────────────────────────────────┐
│  VM Instance 1, 2, 3, ... N                                 │
├─────────────────────────────────────────────────────────────┤
│  READ-ONLY (shared across all VMs):                         │
│  ├─ kernel/vmlinux          (31MB, shared)                  │
│  ├─ kernel/initramfs        (8.3MB, shared)                 │
│  └─ base-rootfs.img         (2GB, read-only, shared)        │
│                                                              │
│  READ-WRITE (per-VM, sparse):                               │
│  └─ instance-1-data.sparseimage (starts small, grows)       │
└─────────────────────────────────────────────────────────────┘
```

## Why This Architecture?

### 1. Read-Only Boot Images (Shared)
- ✅ **One kernel for all VMs** - 31MB shared, not 31MB × N VMs
- ✅ **One initramfs for all VMs** - 8.3MB shared
- ✅ **One base rootfs for all VMs** - 2GB shared
- ✅ **Fast cloning** - APFS CoW makes new VMs instant
- ✅ **Safe updates** - Update base, all VMs get it
- ✅ **Immutable infrastructure** - Base never changes

### 2. Sparse Data Disks (Per-VM)
- ✅ **Starts tiny** - Initial size is minimal
- ✅ **Grows on demand** - Expands as VM writes data
- ✅ **APFS CoW efficient** - Only modified blocks use space
- ✅ **Isolated** - Each VM's data is separate
- ✅ **Snapshotable** - Easy VM state backups

## Proper VZ Configuration

### Read-Only Base Image

```swift
// Base rootfs - READ ONLY (shared across all VMs)
let baseImageURL = URL(fileURLWithPath: "~/.vfkit/images/alpine-base.img")
let baseAttachment = try VZDiskImageStorageDeviceAttachment(
    url: baseImageURL,
    readOnly: true  // ← Key: read-only!
)
let baseDevice = VZVirtioBlockDeviceConfiguration(
    attachment: baseAttachment
)

// This appears as /dev/vda in the VM (read-only root)
config.storageDevices.append(baseDevice)
```

### Per-VM Sparse Data Disk

```swift
// Per-VM data disk - READ WRITE (unique per instance)
let dataImageURL = URL(fileURLWithPath: "~/.vfkit/instances/vm-123-data.sparseimage")

// Create sparse image if it doesn't exist
if !FileManager.default.fileExists(atPath: dataImageURL.path) {
    try createSparseImage(at: dataImageURL, size: 10_000_000_000) // 10GB
}

let dataAttachment = try VZDiskImageStorageDeviceAttachment(
    url: dataImageURL,
    readOnly: false  // ← Read-write for runtime data
)
let dataDevice = VZVirtioBlockDeviceConfiguration(
    attachment: dataAttachment
)

// This appears as /dev/vdb in the VM (read-write data)
config.storageDevices.append(dataDevice)
```

## Creating Sparse Images Properly

### Using hdiutil (macOS Tool)

```bash
# Create APFS sparse bundle (recommended)
hdiutil create \
    -size 10g \
    -type SPARSEBUNDLE \
    -fs APFS \
    -volname "VM-Data" \
    vm-data.sparsebundle

# Or create sparse image (simpler)
hdiutil create \
    -size 10g \
    -type SPARSE \
    -fs APFS \
    vm-data.sparseimage

# Advantages:
# - Starts at ~10MB actual size
# - Grows to 10GB maximum
# - Only uses space for actual data
# - APFS CoW optimizations apply
```

### Using Swift/VZ Framework

```swift
func createSparseImage(at url: URL, size: UInt64) throws {
    // Create empty file
    try Data().write(to: url)

    // Set logical size (sparse)
    let attrs: [FileAttributeKey: Any] = [.size: NSNumber(value: size)]
    try FileManager.default.setAttributes(attrs, ofItemAtPath: url.path)

    // APFS makes this sparse automatically
}
```

## Complete VM Architecture

```swift
func createVM(instanceID: String) throws -> VZVirtualMachine {
    let config = VZVirtualMachineConfiguration()

    // CPU & Memory
    config.cpuCount = 2
    config.memorySize = 2 * 1024 * 1024 * 1024

    // Bootloader (shared kernel/initramfs)
    let bootLoader = VZLinuxBootLoader(
        kernelURL: URL(fileURLWithPath: "~/.vfkit/images/vmlinux")
    )
    bootLoader.initialRamdiskURL = URL(fileURLWithPath: "~/.vfkit/images/initramfs")
    bootLoader.commandLine = "console=hvc0 root=/dev/vda ro rootfstype=ext4"
    config.bootLoader = bootLoader

    // Storage Device 1: READ-ONLY base rootfs (shared)
    let baseURL = URL(fileURLWithPath: "~/.vfkit/images/alpine-base.img")
    let baseAttachment = try VZDiskImageStorageDeviceAttachment(
        url: baseURL,
        readOnly: true  // Read-only!
    )
    config.storageDevices.append(
        VZVirtioBlockDeviceConfiguration(attachment: baseAttachment)
    )

    // Storage Device 2: READ-WRITE data disk (per-VM sparse)
    let dataURL = URL(fileURLWithPath: "~/.vfkit/instances/\(instanceID)-data.sparseimage")
    if !FileManager.default.fileExists(atPath: dataURL.path) {
        try createSparseImage(at: dataURL, size: 10_000_000_000)
    }
    let dataAttachment = try VZDiskImageStorageDeviceAttachment(
        url: dataURL,
        readOnly: false  // Read-write
    )
    config.storageDevices.append(
        VZVirtioBlockDeviceConfiguration(attachment: dataAttachment)
    )

    // Network, entropy, etc.
    let networkDevice = VZVirtioNetworkDeviceConfiguration()
    networkDevice.attachment = VZNATNetworkDeviceAttachment()
    config.networkDevices = [networkDevice]
    config.entropyDevices = [VZVirtioEntropyDeviceConfiguration()]

    try config.validate()
    return VZVirtualMachine(configuration: config)
}
```

## Guest OS Configuration

### Mount Strategy in VM

```bash
# /dev/vda - read-only root filesystem
mount -o ro /dev/vda /mnt/root

# /dev/vdb - read-write data disk
mount -o rw /dev/vdb /mnt/data

# Use overlayfs to combine (optional)
mount -t overlay overlay \
    -o lowerdir=/mnt/root,upperdir=/mnt/data/upper,workdir=/mnt/data/work \
    /
```

### Or Use kernel command line

```swift
bootLoader.commandLine = """
    console=hvc0 \
    root=/dev/vda \
    ro \
    rootfstype=ext4 \
    data=/dev/vdb
    """
```

## Directory Structure

```
~/.vfkit/
├── images/                    # Shared, read-only base images
│   ├── vmlinux               # Kernel (31MB, shared)
│   ├── initramfs             # Initial ramdisk (8.3MB, shared)
│   └── alpine-base.img       # Base rootfs (2GB, read-only, shared)
│
└── instances/                 # Per-VM data disks
    ├── dev-vm-data.sparseimage       (~50MB actual)
    ├── test-vm-data.sparseimage      (~30MB actual)
    └── staging-vm-data.sparseimage   (~100MB actual)
```

## Space Savings Example

### Old Way (Read-Write Everything)
```
VM 1: kernel (31MB) + initramfs (8.3MB) + rootfs (2GB) = 2.04GB
VM 2: kernel (31MB) + initramfs (8.3MB) + rootfs (2GB) = 2.04GB
VM 3: kernel (31MB) + initramfs (8.3MB) + rootfs (2GB) = 2.04GB
─────────────────────────────────────────────────────────────
Total: 6.12GB (all duplicated)
```

### New Way (Read-Only Base + Sparse Data)
```
Shared:
  kernel:   31MB
  initramfs: 8.3MB
  base:      2GB
  ─────────────
  Total:     2.04GB (shared once)

Per-VM:
  VM 1 data: 50MB (sparse)
  VM 2 data: 30MB (sparse)
  VM 3 data: 100MB (sparse)
  ─────────────
  Total:     180MB (only deltas)

Grand Total: 2.22GB (not 6.12GB!)
Savings: 63% less disk usage
```

## Fast VM Provisioning

```bash
# Old way: Copy entire 2GB rootfs
cp base.img vm-new.img          # Slow, copies 2GB

# New way: Create sparse data disk only
hdiutil create -size 10g -type SPARSE vm-new-data.sparseimage
# Fast, creates ~10MB file

# Base rootfs is shared (read-only)
# New VM starts in seconds!
```

## Benefits Summary

| Aspect | Old Way | New Way (Proper) |
|--------|---------|------------------|
| Disk per VM | 2GB+ each | ~50MB each (sparse) |
| Provision time | Minutes (copy 2GB) | Seconds (create sparse) |
| Shared base | No (duplicated) | Yes (CoW) |
| Update base | Update each VM | Update once, all VMs benefit |
| Snapshots | Slow (full copy) | Fast (APFS snapshots) |
| Space efficiency | Low | High (63%+ savings) |

## Real-World Usage

```swift
// Create base image once
let baseImage = "~/.vfkit/images/alpine-base.img"

// Provision 10 VMs instantly
for i in 1...10 {
    let dataImage = "~/.vfkit/instances/vm-\(i)-data.sparseimage"
    try createSparseImage(at: URL(fileURLWithPath: dataImage), size: 10_000_000_000)

    let vm = try createVM(
        baseImage: baseImage,    // Read-only, shared
        dataImage: dataImage     // Read-write, per-VM
    )

    try await vm.start()
}

// Result:
// - 10 VMs running
// - Base: 2GB (shared)
// - Data: ~500MB total (sparse, only actual usage)
// - Total: 2.5GB (not 20GB!)
```

## Kernel Command Line for Proper Setup

```swift
// Root filesystem read-only, data disk read-write
bootLoader.commandLine = """
    console=hvc0 \
    root=/dev/vda \
    ro \
    rootfstype=ext4 \
    init=/sbin/init
    """

// Guest OS mounts:
// /dev/vda → / (read-only root)
// /dev/vdb → /data (read-write data)
// Use overlayfs or bind mounts as needed
```

## Migration Plan

1. **Create base image** (read-only)
   - Extract Alpine root filesystem
   - Make it immutable
   - Store in `~/.vfkit/images/`

2. **Create sparse data disks** (per-VM)
   - Use hdiutil or Swift
   - Store in `~/.vfkit/instances/`

3. **Update VZ configuration**
   - First device: base (read-only)
   - Second device: data (read-write)

4. **Update boot command line**
   - Root on /dev/vda (ro)
   - Data on /dev/vdb (rw)

## Next Steps

Once initramfs kernel module work is complete:
1. Create proper read-only base image
2. Create sparse data disk template
3. Test VM boot with proper architecture
4. Demonstrate fast cloning
5. Show space savings

This is the Apple way - and it's dramatically more efficient!
