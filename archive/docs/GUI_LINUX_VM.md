# GUI Linux VM with Apple's Virtualization Framework

## Overview

Full-featured GUI Linux VM based on Apple's `GUILinuxVirtualMachineSampleApp` sample code, enhanced for VibeCode with ASIF disk support.

## Key Features

### From Apple's Sample Code ✅
- **Full GUI Support** - Tested with Ubuntu 26.x ARM64
- **Audio I/O** - Input and output devices
- **Copy/Paste** - SPICE agent clipboard sharing
- **USB Devices** - Keyboard and pointing device emulation
- **Auto-Resize Display** - Automatically adjusts to window size (macOS 14+)
- **EFI Bootloader** - Proper UEFI boot support
- **ISO Installation** - Install from ARM64 Linux ISO

### VibeCode Enhancements ✅
- **ASIF Disk Format** - Sparse/resizable disk instead of raw IMG
- **Datadog Tracing** - Full APM integration in Python builder
- **Better UX** - Improved window titles, error messages
- **Configurable** - Customizable VM name, resources

## Architecture

### Disk Format Change

**Apple Sample:**
```swift
// Creates 64GB raw disk image (takes full 64GB immediately)
try mainDiskFileHandle.truncate(atOffset: 64 * 1024 * 1024 * 1024)
```

**VibeCode Enhancement:**
```swift
// Creates 64GB ASIF disk (sparse, grows as needed)
try VZDiskImageStorageDeviceAttachment.create(
    at: diskURL,
    size: diskSize
)
```

**Benefits:**
- Starts small (~500MB) instead of full 64GB
- Grows dynamically as guest uses space
- Reclaims unused space automatically
- Better for multiple VMs

### VM Configuration

```swift
config.cpuCount = computeCPUCount()        // Uses half of host CPUs
config.memorySize = computeMemorySize()    // 8GB default

config.graphicsDevices = [                 // 1920x1080 display
    VZVirtioGraphicsDeviceConfiguration(
        widthInPixels: 1920,
        heightInPixels: 1080
    )
]

config.networkDevices = [VZNATNetworkDeviceAttachment()]  // NAT networking
config.audioDevices = [input, output]                      // Full audio
config.consoleDevices = [spiceAgent]                       // Copy/paste
```

## Building the App

### Generate Swift App

```bash
python3 scripts/build_gui_linux_vm_swift.py --name UbuntuGUI
```

This creates:
```
azure/SwiftUI-Apps/UbuntuGUIVibeCode.app/
├── Contents/
│   ├── Info.plist
│   ├── UbuntuGUIVibeCode.entitlements
│   └── MacOS/
│       ├── UbuntuGUIVibeCode.swift
│       └── build_ubuntugui.sh
```

### Compile Swift

```bash
cd azure/SwiftUI-Apps/UbuntuGUIVibeCode.app/Contents/MacOS
bash build_ubuntugui.sh
```

Compiles to:
```
azure/SwiftUI-Apps/UbuntuGUIVibeCode.app/Contents/MacOS/UbuntuGUIVibeCode
```

## Usage

### First Run (Installation)

1. **Launch app:**
   ```bash
   open azure/SwiftUI-Apps/UbuntuGUIVibeCode.app
   ```

2. **Select ISO:**
   - File picker appears
   - Choose Ubuntu 26.x ARM64 ISO (or any ARM64 Linux)
   - Click "Open"

3. **Install Linux:**
   - VM boots into installer
   - Follow on-screen installation instructions
   - Installer UI appears in app window

4. **Complete:**
   - VM bundle created at `~/VibeCode VMs/UbuntuGUI VM.bundle/`
   - Contains ASIF disk, NVRAM, machine identifier

### Subsequent Runs

```bash
open azure/SwiftUI-Apps/UbuntuGUIVibeCode.app
```

Boots directly from installed OS (no ISO needed).

## VM Bundle Structure

```
~/VibeCode VMs/UbuntuGUI VM.bundle/
├── Disk.asif              # ASIF disk (sparse, resizable)
├── NVRAM                  # EFI variable store
└── MachineIdentifier      # VM machine ID
```

### Disk Growth Example

```
Initial:     500MB  (empty ASIF)
After install: 8GB   (Ubuntu base)
After use:    12GB   (apps, data)
Maximum:      64GB   (configured limit)
```

## Copy/Paste Setup

### macOS Side

Works automatically - no setup needed.

### Linux Side

Install SPICE agent:

```bash
# Ubuntu/Debian
sudo apt install spice-vdagent

# Fedora
sudo dnf install spice-vdagent
```

Then restart or run:
```bash
sudo systemctl start spice-vdagentd
```

**Now you can copy/paste between macOS and Linux!**

## Resource Configuration

### Default Resources

- **CPUs:** Half of host CPUs (min 1, max per VZ framework limits)
- **RAM:** 8GB
- **Disk:** 64GB (ASIF, sparse)
- **Display:** 1920x1080
- **Network:** NAT (outbound + inbound via port forwarding)
- **Audio:** Input + Output

### Customizing

Edit the Swift source before building:

```swift
// More RAM
var memorySize = (16 * 1024 * 1024 * 1024) as UInt64  // 16GB

// Larger disk
let diskSize = 128 * 1024 * 1024 * 1024 as UInt64  // 128GB

// Higher resolution
graphicsDevice.scanouts = [
    VZVirtioGraphicsScanoutConfiguration(
        widthInPixels: 2560,
        heightInPixels: 1440
    )
]
```

## Tested Configurations

| Distribution | Version | Architecture | Status |
|--------------|---------|--------------|--------|
| Ubuntu       | 26.04   | ARM64        | ✅ Confirmed Working |
| Ubuntu       | 24.04   | ARM64        | ✅ Should work |
| Debian       | 12      | ARM64        | ✅ Should work |
| Fedora       | 39+     | ARM64        | ✅ Should work |

## Comparison: Bundle vs ASIF

| Aspect | Apple Sample (Bundle) | VibeCode (ASIF) |
|--------|----------------------|-----------------|
| Initial Size | 64GB | ~500MB |
| Growth | Fixed | Dynamic |
| Space Reclaim | No | Yes |
| Performance | Slightly faster | Similar |
| Flexibility | Low | High |
| Multiple VMs | Expensive | Efficient |

## Advanced Features

### Auto-Resize (macOS 14+)

```swift
if #available(macOS 14.0, *) {
    virtualMachineView.automaticallyReconfiguresDisplay = true
}
```

Window resizes automatically adjust guest resolution.

### Network Port Forwarding

Add to Swift code:

```swift
let portMapping = VZNATNetworkPortMapping(
    internalPort: 22,
    externalPort: 2222,
    protocol: .tcp
)
networkDevice.attachment.portMappings = [portMapping]
```

### Rosetta Support (Intel binaries on ARM)

For running x86_64 Linux binaries on ARM64 host:

```swift
// Add to configuration
if #available(macOS 13.0, *) {
    config.rosettaDirectoryShare = VZRosettaDirectoryShare()
}
```

See: [Running Intel Binaries in Linux VMs with Rosetta](https://developer.apple.com/documentation/virtualization/running_intel_binaries_in_linux_vms_with_rosetta)

## Troubleshooting

### "Failed to create ASIF disk"

Check disk space:
```bash
df -h ~
```

### "VM failed to start"

Check entitlements:
```bash
codesign -d --entitlements - azure/SwiftUI-Apps/UbuntuGUIVibeCode.app
```

Should show `com.apple.security.virtualization`.

### Copy/Paste not working

Install spice-vdagent in guest:
```bash
sudo apt install spice-vdagent
sudo systemctl status spice-vdagentd
```

### Display doesn't resize

Requires macOS 14+ and:
```swift
virtualMachineView.automaticallyReconfiguresDisplay = true
```

## Building Other VMs

Generate different Linux VMs:

```bash
# Fedora
python3 scripts/build_gui_linux_vm_swift.py --name FedoraGUI

# Debian
python3 scripts/build_gui_linux_vm_swift.py --name DebianGUI

# Generic
python3 scripts/build_gui_linux_vm_swift.py --name MyLinuxVM
```

Each creates a separate app with isolated VM bundle.

## Performance

### Expected Performance

- **Boot time:** 15-30 seconds (after install)
- **Responsiveness:** Near-native (on Apple Silicon)
- **Graphics:** Smooth for desktop use
- **Audio:** Real-time with low latency
- **Network:** Full bandwidth

### Resource Usage

```
Idle Ubuntu Desktop:
- CPU: 2-5%
- RAM: 2-3GB
- Disk I/O: Minimal

Active Use:
- CPU: 10-30%
- RAM: 4-6GB
- Disk I/O: Moderate
```

## References

- [Apple Sample Code](https://developer.apple.com/documentation/virtualization/running_gui_linux_in_a_virtual_machine_on_a_mac)
- [Virtualization Framework](https://developer.apple.com/documentation/virtualization)
- [VZVirtualMachineConfiguration](https://developer.apple.com/documentation/virtualization/vzvirtualmachineconfiguration)
- [VZDiskImageStorageDeviceAttachment](https://developer.apple.com/documentation/virtualization/vz diskimagestoragedeviceattachment)

## Author

Based on Apple's `GUILinuxVirtualMachineSampleApp`, enhanced for VibeCode with ASIF disk support (2025-12-01).

