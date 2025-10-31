# VM Distribution Strategy for VibeCode

**Goal**: Ship VibeCode desktop app with embedded VMs using native Apple Virtualization.framework

## The Problem

Current approach uses:
- ❌ **Direct kernel boot** (VZLinuxBootLoader + raw kernel)
- ❌ **EFI kernels** (Alpine ARM64 only ships EFI format)
- ❌ Incompatible: VZLinuxBootLoader needs raw kernel, we have EFI

## The Solution: UEFI Boot with Disk Images

### Approach 1: Full UEFI Disk Images (Recommended)

Ship pre-configured VM disk images with UEFI boot.

**Advantages:**
- ✅ Works with any Linux distro (Ubuntu, Fedora, Alpine)
- ✅ Full OS with package management
- ✅ UEFI boot supported by VZEFIBootLoader
- ✅ Can pre-install Valkey, PostgreSQL, Node.js, Ollama
- ✅ Users get working VMs out of the box

**Implementation:**

```swift
// Use VZEFIBootLoader instead of VZLinuxBootLoader
let efiBootLoader = VZEFIBootLoader()
let efiURL = URL(fileURLWithPath: "\(vmDir)/EFI.nvram")
efiBootLoader.variableStore = try VZEFIVariableStore(url: efiURL)
config.bootLoader = efiBootLoader

// Use disk attachment instead of kernel+initramfs
let diskURL = URL(fileURLWithPath: "\(vmDir)/disk.qcow2")
let diskAttachment = try VZDiskImageStorageDeviceAttachment(
    url: diskURL,
    readOnly: false
)
let blockDevice = VZVirtioBlockDeviceConfiguration(attachment: diskAttachment)
config.storageDevices = [blockDevice]
```

**Disk Format Options:**
1. **QCOW2** - Compressed, smaller download
2. **Raw** - Faster performance
3. **On-demand download** - Download VMs when needed

### Approach 2: Rosetta Linux (x86_64 on ARM)

Use Apple's Rosetta to run x86_64 Linux on Apple Silicon.

```swift
if VZLinuxRosettaDirectoryShare.availability == .supported {
    let rosettaShare = try! VZLinuxRosettaDirectoryShare()
    let sharedDir = VZSharedDirectory(
        url: rosettaURL,
        readOnly: true
    )
    let shareConfig = VZVirtioFileSystemDeviceConfiguration(
        tag: "rosetta"
    )
    shareConfig.share = VZSingleDirectoryShare(directory: sharedDir)
    config.directorySharingDevices = [shareConfig]
}
```

**Advantages:**
- ✅ Run x86_64 Linux containers
- ✅ Broader package compatibility
- ✅ Docker Desktop uses this approach

### Approach 3: Minimal Cloud Images

Use cloud-init ready images (Ubuntu Cloud, Alpine Cloud).

**Advantages:**
- ✅ Small download size
- ✅ Auto-configuration via cloud-init
- ✅ Official vendor images
- ✅ Regular security updates

## Recommended Architecture for Distribution

### Phase 1: Bundle Base VMs (Tauri App)

```
VibeCode.app/
├── Contents/
│   ├── MacOS/
│   │   └── vibecode-vm (Swift binary)
│   ├── Resources/
│   │   ├── vms/
│   │   │   ├── alpine-base.qcow2 (500MB)
│   │   │   ├── alpine-base.efi.nvram
│   │   │   └── ubuntu-server.qcow2 (2GB)
│   │   └── vm-configs/
│   │       ├── valkey.json
│   │       ├── postgresql.json
│   │       └── ollama.json
```

### Phase 2: On-Demand VM Downloads

```swift
// Download VMs when user requests them
struct VMDownloader {
    func downloadVM(name: String) async throws {
        let url = "https://vms.vibecode.dev/\(name).qcow2"
        // Download with progress
        // Verify checksum
        // Extract to ~/Library/Application Support/VibeCode/vms/
    }
}
```

### Phase 3: Swift VM Manager API

```swift
class VMManager {
    func createVM(config: VMConfig) async throws -> VZVirtualMachine {
        // Create VM from config
        // Use UEFI boot
        // Set up networking (NAT + port forwarding)
        // Configure shared folders
        return vm
    }
    
    func startVM(name: String) async throws {
        // Load VM from disk
        // Start with Virtualization.framework
        // Handle errors gracefully
    }
    
    func stopVM(name: String) async throws {
        // Graceful shutdown
        // Save state
    }
}
```

## VM Image Preparation Script (Python)

```python
#!/usr/bin/env python3
"""
Prepare VM disk images for distribution

Copyright (c) 2025 VibeCode Contributors
MIT License
"""

import subprocess
from pathlib import Path

def create_alpine_vm(output_dir: Path):
    """Create Alpine Linux VM with pre-installed services."""
    
    # 1. Download Alpine Cloud image
    # 2. Create QCOW2 disk
    # 3. Boot with cloud-init
    # 4. Install packages: valkey, postgresql, node
    # 5. Configure services
    # 6. Shrink disk image
    # 7. Compress for distribution
    
    pass

def create_ubuntu_vm(output_dir: Path):
    """Create Ubuntu VM with Docker and Ollama."""
    
    # 1. Download Ubuntu Cloud image
    # 2. Create QCOW2 disk (50GB)
    # 3. Install Docker
    # 4. Install Ollama
    # 5. Pull common models
    # 6. Create snapshot
    
    pass
```

## Distribution Sizes

| VM Type | Uncompressed | Compressed | Use Case |
|---------|--------------|------------|----------|
| Alpine Base | 500MB | 150MB | Valkey, PostgreSQL, lightweight services |
| Ubuntu Server | 2GB | 600MB | Docker, Ollama, full Linux |
| Windows 11 ARM | Download on demand | N/A | Optional, user-provided ISO |
| macOS | Download on demand | N/A | Optional, user-provided IPSW |

## Implementation Priority

### P0: Core VM Infrastructure
- [ ] **Swift UEFI boot loader** (replace VZLinuxBootLoader)
- [ ] **QCOW2 disk support** 
- [ ] **Network with port forwarding**
- [ ] **VM state management** (start/stop/pause)

### P1: Distribution
- [ ] **Create Alpine base image** (Valkey, PostgreSQL, Node.js)
- [ ] **Bundle in Tauri app**
- [ ] **VM download manager**
- [ ] **Auto-start VMs on app launch**

### P2: Advanced
- [ ] **Rosetta Linux support** (x86_64 compatibility)
- [ ] **Shared folders** (VZVirtioFileSystemDevice)
- [ ] **GUI VMs** (VirtIO graphics)
- [ ] **Snapshots and cloning**

## Code Changes Needed

### 1. Update `vz-swift/Sources/VibeCodeVM/main.swift`

Replace `VZLinuxBootLoader` with `VZEFIBootLoader`:

```swift
static func createLinuxVM(name: String) async throws -> VZVirtualMachine {
    let config = VZVirtualMachineConfiguration()
    
    // CPU & Memory
    config.cpuCount = 2
    config.memorySize = UInt64(1024 * 1024 * 1024)
    
    // UEFI Boot Loader (instead of direct kernel boot)
    let efiBootLoader = VZEFIBootLoader()
    let vmDir = "\(homeDirectory)/.vfkit/vms/\(name)"
    let efiURL = URL(fileURLWithPath: "\(vmDir)/EFI.nvram")
    
    if !FileManager.default.fileExists(atPath: efiURL.path) {
        // Create new EFI variable store
        try VZEFIVariableStore(creatingVariableStoreAt: efiURL)
    }
    efiBootLoader.variableStore = VZEFIVariableStore(url: efiURL)
    config.bootLoader = efiBootLoader
    
    // Disk (instead of kernel+initramfs)
    let diskURL = URL(fileURLWithPath: "\(vmDir)/disk.qcow2")
    let diskAttachment = try VZDiskImageStorageDeviceAttachment(
        url: diskURL,
        readOnly: false
    )
    let blockDevice = VZVirtioBlockDeviceConfiguration(attachment: diskAttachment)
    config.storageDevices = [blockDevice]
    
    // Network, Serial, Entropy remain the same
    // ...
    
    return VZVirtualMachine(configuration: config)
}
```

### 2. Create VM Preparation Script

`scripts/prepare_distribution_vms.py`:
- Download cloud images
- Customize with cloud-init
- Install services
- Compress for distribution

### 3. Update Tauri Config

```json
{
  "bundle": {
    "resources": [
      "vms/*.qcow2",
      "vms/*.nvram",
      "vm-configs/*.json"
    ],
    "externalBin": [
      "vz-swift/.build/release/vibecode-vm"
    ]
  }
}
```

## Testing Strategy

1. ✅ Test UEFI boot with Alpine cloud image
2. ✅ Test UEFI boot with Ubuntu cloud image
3. ✅ Verify networking and port forwarding
4. ✅ Test VM in bundled Tauri app
5. ✅ Test on clean macOS install (no Lima)

## Timeline

- **Week 1**: UEFI boot + disk images working
- **Week 2**: Create distribution VMs (Alpine + Ubuntu)
- **Week 3**: Bundle in Tauri app
- **Week 4**: Testing and optimization

## Success Criteria

✅ User downloads VibeCode.app  
✅ VMs start without any setup  
✅ Valkey, PostgreSQL, Node.js accessible on localhost  
✅ No Lima or external dependencies required  
✅ Works on clean macOS install  
✅ Total app size < 1GB  

---

**Next Step**: Implement UEFI boot in Swift VZ code

