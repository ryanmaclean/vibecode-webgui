# Apple Virtualization Framework Best Practices

## Why Follow Apple's Way?

Following Apple's recommended patterns gives you:
- ✅ **APFS Copy-on-Write Cloning** - Instant disk image clones
- ✅ **Sparse Disk Images** - Only allocated space uses disk
- ✅ **Optimized I/O** - Direct integration with APFS
- ✅ **Fast Snapshots** - Instant VM state snapshots
- ✅ **Efficient Storage** - CoW reduces disk usage

## Disk Image Best Practices

### 1. Use Sparse Disk Images on APFS

```swift
// Create sparse disk image (Apple's way)
let diskPath = "vm-disk.img"
let diskSize: UInt64 = 10 * 1024 * 1024 * 1024 // 10GB

// Option 1: Use VZDiskImageStorageDeviceAttachment directly
// It automatically creates sparse images on APFS
let diskURL = URL(fileURLWithPath: diskPath)
let attachment = try VZDiskImageStorageDeviceAttachment(
    url: diskURL,
    readOnly: false
)

// Option 2: Pre-create with proper size
// macOS automatically makes these sparse on APFS
try Data().write(to: diskURL)
try FileManager.default.setAttributes(
    [.size: diskSize],
    ofItemAtPath: diskPath
)
```

### 2. Enable APFS Cloning for VM Templates

```bash
# Clone a VM disk instantly (APFS copy-on-write)
cp -c base-vm.img new-vm.img

# Or in Swift:
try FileManager.default.copyItem(
    at: baseVM,
    to: newVM,
    // APFS will use CoW automatically
)
```

Benefits:
- **Instant cloning** (metadata copy only)
- **Space efficient** (shared blocks)
- **Fast provisioning** (no data copying)

### 3. Use Apple's Storage Device Types

```swift
// ✅ GOOD: Use VZVirtioBlockDeviceConfiguration (Apple recommended)
let blockDevice = VZVirtioBlockDeviceConfiguration(
    attachment: diskAttachment
)
config.storageDevices = [blockDevice]

// ❌ AVOID: Using raw file descriptors or custom I/O
// This bypasses Apple's APFS optimizations
```

## Network Best Practices

### 1. Use VZNATNetworkDeviceAttachment (Default)

```swift
// ✅ GOOD: NAT networking (Apple managed)
let networkDevice = VZVirtioNetworkDeviceConfiguration()
networkDevice.attachment = VZNATNetworkDeviceAttachment()
config.networkDevices = [networkDevice]
```

Benefits:
- Automatic DHCP
- DNS resolution
- No host network configuration needed
- Works out of the box

### 2. Use VZBridgedNetworkDeviceAttachment (Advanced)

```swift
// For VMs that need direct network access
let interface = VZBridgedNetworkInterface.networkInterfaces[0]
let attachment = VZBridgedNetworkDeviceAttachment(
    interface: interface
)
networkDevice.attachment = attachment
```

## Boot Configuration Best Practices

### Linux VMs

```swift
// ✅ GOOD: Direct kernel + initramfs boot
let bootLoader = VZLinuxBootLoader(
    kernelURL: kernelURL
)
bootLoader.initialRamdiskURL = initramfsURL
bootLoader.commandLine = "console=hvc0 root=/dev/vda rw"
config.bootLoader = bootLoader
```

### macOS VMs

```swift
// ✅ GOOD: Use VZMacOSBootLoader
let bootLoader = VZMacOSBootLoader()
config.bootLoader = bootLoader

// Use VZMacOSRestoreImage for provisioning
let restoreImage = try await VZMacOSRestoreImage.image(from: ipswURL)
```

## Memory & CPU Best Practices

### 1. Use Recommended Minimums

```swift
// Check system capabilities
let minMemory = VZVirtualMachineConfiguration.minimumAllowedMemorySize
let maxMemory = VZVirtualMachineConfiguration.maximumAllowedMemorySize
let minCPUs = VZVirtualMachineConfiguration.minimumAllowedCPUCount
let maxCPUs = VZVirtualMachineConfiguration.maximumAllowedCPUCount

// Set reasonable values
config.cpuCount = min(4, maxCPUs) // 4 CPUs or max available
config.memorySize = min(4 * 1024 * 1024 * 1024, maxMemory) // 4GB or max
```

### 2. Enable Memory Balloon (If Supported)

```swift
// Allows dynamic memory adjustment
if #available(macOS 13.0, *) {
    let balloonDevice = VZVirtioTraditionalMemoryBalloonDeviceConfiguration()
    config.memoryBalloonDevices = [balloonDevice]
}
```

## Graphics & Display Best Practices

### For Linux VMs with GUI

```swift
// Use VirtIO GPU
let graphicsDevice = VZVirtioGraphicsDeviceConfiguration()
graphicsDevice.scanouts = [
    VZVirtioGraphicsScanoutConfiguration(
        widthInPixels: 1920,
        heightInPixels: 1080
    )
]
config.graphicsDevices = [graphicsDevice]
```

### For macOS VMs

```swift
// Use VZMacGraphicsDeviceConfiguration
let graphicsDevice = VZMacGraphicsDeviceConfiguration()
graphicsDevice.displays = [
    VZMacGraphicsDisplayConfiguration(
        widthInPixels: 1920,
        heightInPixels: 1080,
        pixelsPerInch: 144
    )
]
config.graphicsDevices = [graphicsDevice]
```

## Console & Serial Best Practices

### For Headless VMs

```swift
// VirtIO console for serial output
let consoleDevice = VZVirtioConsoleDeviceConfiguration()

// Attach to file for logging
let logURL = URL(fileURLWithPath: "vm-console.log")
let fileHandle = try FileHandle(forWritingTo: logURL)
let serialPort = VZFileHandleSerialPortAttachment(
    fileHandleForReading: nil,
    fileHandleForWriting: fileHandle
)

let port = VZVirtioConsolePortConfiguration()
port.attachment = serialPort
consoleDevice.ports[0] = port

config.consoleDevices = [consoleDevice]
```

## Entitlements (Required)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
    "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <!-- REQUIRED for VZ framework -->
    <key>com.apple.security.virtualization</key>
    <true/>

    <!-- For network access -->
    <key>com.apple.security.network.client</key>
    <true/>
    <key>com.apple.security.network.server</key>
    <true/>

    <!-- For bridged networking (if needed) -->
    <key>com.apple.vm.networking</key>
    <true/>

    <!-- For file access to disk images -->
    <key>com.apple.security.files.user-selected.read-write</key>
    <true/>
</dict>
</plist>
```

## Proper VM Lifecycle Management

### 1. Use Async/Await (Modern Swift)

```swift
@available(macOS 12.0, *)
func startVM() async throws {
    try await withCheckedThrowingContinuation { continuation in
        virtualMachine.start { result in
            switch result {
            case .success:
                continuation.resume()
            case .failure(let error):
                continuation.resume(throwing: error)
            }
        }
    }
}
```

### 2. Handle Delegate Callbacks

```swift
extension VMController: VZVirtualMachineDelegate {
    nonisolated func guestDidStop(_ vm: VZVirtualMachine) {
        // Handle clean shutdown
    }

    nonisolated func virtualMachine(
        _ vm: VZVirtualMachine,
        didStopWithError error: Error
    ) {
        // Handle errors
    }

    nonisolated func virtualMachine(
        _ vm: VZVirtualMachine,
        networkDevice: VZNetworkDevice,
        attachmentWasDisconnectedWithError error: Error
    ) {
        // Handle network errors
    }
}
```

## Storage Performance Tips

### 1. Use APFS-Formatted Disk Images

```bash
# Create APFS disk image (sparse, CoW-enabled)
hdiutil create -size 10g -type SPARSE -fs APFS vm-disk.sparseimage

# Or use raw sparse file (APFS handles CoW automatically)
touch vm-disk.img
```

### 2. Enable Trim/Discard

```swift
// Tell the guest OS to send TRIM commands
// Add to kernel command line:
bootLoader.commandLine = "console=hvc0 root=/dev/vda rw discard"
```

### 3. Use Appropriate Disk Options

```swift
// Read-only for base images (templates)
let baseAttachment = try VZDiskImageStorageDeviceAttachment(
    url: baseImageURL,
    readOnly: true  // Allows APFS CoW cloning
)

// Read-write for VM instances
let vmAttachment = try VZDiskImageStorageDeviceAttachment(
    url: vmImageURL,
    readOnly: false
)
```

## Key Takeaways

1. **Use VZ framework APIs directly** - No custom I/O, let Apple handle optimization
2. **Store on APFS volumes** - Automatic CoW, sparse files, fast cloning
3. **Follow VZ configuration patterns** - Use recommended device types
4. **Enable proper entitlements** - Required for VZ framework access
5. **Use async/await** - Modern Swift concurrency patterns
6. **Handle delegates properly** - nonisolated callbacks

## Benefits You Get

When following these practices:
- ✅ **10GB VM disk uses <1GB** initially (sparse)
- ✅ **Clone VM in milliseconds** (APFS CoW)
- ✅ **Fast disk I/O** (VZ framework optimizations)
- ✅ **Efficient snapshots** (APFS snapshots)
- ✅ **Native integration** (macOS hypervisor)

## Example: Complete VM Setup

```swift
@available(macOS 12.0, *)
class ProperVM: NSObject, VZVirtualMachineDelegate {
    private var vm: VZVirtualMachine!

    func createVM() throws -> VZVirtualMachine {
        let config = VZVirtualMachineConfiguration()

        // CPU & Memory (check limits)
        config.cpuCount = min(4, VZVirtualMachineConfiguration.maximumAllowedCPUCount)
        config.memorySize = min(
            4 * 1024 * 1024 * 1024,
            VZVirtualMachineConfiguration.maximumAllowedMemorySize
        )

        // Bootloader
        let bootLoader = VZLinuxBootLoader(kernelURL: kernelURL)
        bootLoader.initialRamdiskURL = initramfsURL
        bootLoader.commandLine = "console=hvc0 root=/dev/vda rw discard"
        config.bootLoader = bootLoader

        // Storage (APFS-optimized)
        let diskAttachment = try VZDiskImageStorageDeviceAttachment(
            url: diskURL,
            readOnly: false
        )
        let blockDevice = VZVirtioBlockDeviceConfiguration(
            attachment: diskAttachment
        )
        config.storageDevices = [blockDevice]

        // Network (NAT)
        let networkDevice = VZVirtioNetworkDeviceConfiguration()
        networkDevice.attachment = VZNATNetworkDeviceAttachment()
        config.networkDevices = [networkDevice]

        // Entropy
        config.entropyDevices = [VZVirtioEntropyDeviceConfiguration()]

        // Validate
        try config.validate()

        // Create VM
        vm = VZVirtualMachine(configuration: config)
        vm.delegate = self

        return vm
    }

    func start() async throws {
        try await withCheckedThrowingContinuation { continuation in
            vm.start { result in
                continuation.resume(with: result)
            }
        }
    }

    // Delegate methods
    nonisolated func guestDidStop(_ vm: VZVirtualMachine) {
        print("VM stopped cleanly")
    }

    nonisolated func virtualMachine(
        _ vm: VZVirtualMachine,
        didStopWithError error: Error
    ) {
        print("VM error: \(error)")
    }
}
```

## References

- [Apple Virtualization Framework Documentation](https://developer.apple.com/documentation/virtualization)
- [WWDC Sessions on Virtualization](https://developer.apple.com/videos/)
- [Virtual Buddy](https://github.com/insidegui/VirtualBuddy) - Reference implementation
- [APFS Copy-on-Write](https://developer.apple.com/documentation/foundation/filemanager/1413329-copyitem)
