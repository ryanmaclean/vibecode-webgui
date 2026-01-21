# Direct Virtualization.framework Integration (Swift 5)

**Layer 3: Pure Apple VZ with Swift**

Going deeper than vfkit - direct Apple Virtualization.framework access.

## Architecture Layers

```
┌─────────────────────────────────────┐
│   Lima (limactl)                    │ ← Layer 1: Done ✅
├─────────────────────────────────────┤
│   vfkit (Go wrapper)                │ ← Layer 2: Done ✅
├─────────────────────────────────────┤
│   Virtualization.framework (Swift)  │ ← Layer 3: Next 🎯
├─────────────────────────────────────┤
│   Apple Silicon Hypervisor          │ ← Hardware
└─────────────────────────────────────┘
```

## Why Go Direct to VZ?

### Benefits
1. **Zero overhead** - No Go wrapper (vfkit)
2. **Full API access** - All Virtualization.framework features
3. **M4 Max optimization** - Direct hardware access
4. **Custom integration** - Tauri/Rust bridge
5. **Learning** - Understanding Apple's VM architecture

### What We Bypass
- vfkit CLI parsing
- vfkit device abstraction
- Go runtime overhead

## Swift 5 + Virtualization.framework

### Prerequisites
```bash
# Xcode Command Line Tools
xcode-select --install

# Swift 5.9+ (comes with Xcode)
swift --version
```

### Framework Overview

```swift
import Virtualization

// Core Classes:
// - VZVirtualMachine: VM instance
// - VZVirtualMachineConfiguration: VM setup
// - VZLinuxBootLoader: Boot kernel/initramfs
// - VZVirtioBlockDeviceConfiguration: Disk
// - VZVirtioNetworkDeviceConfiguration: Network
// - VZVirtioConsoleDeviceSerialPortConfiguration: Serial
```

## Project Structure

```
vz-swift/
├── Sources/
│   └── VibeCodeVM/
│       ├── main.swift                    # CLI entry
│       ├── VMManager.swift                # VM lifecycle
│       ├── VMConfiguration.swift          # Setup
│       └── Devices/
│           ├── NetworkDevice.swift
│           ├── StorageDevice.swift
│           └── ConsoleDevice.swift
├── Package.swift                          # Swift Package Manager
├── README.md
└── Examples/
    ├── valkey-vm.json                     # VM configs
    ├── postgresql-vm.json
    ├── pgvector-vm.json
    └── nodejs-vm.json
```

## Next Steps

### Phase 1: Basic VM (30 min)
- Create Swift Package
- Boot single VM with kernel/initramfs
- Console output

### Phase 2: 4 VMs (1 hour)
- Configure all 4 VMs
- Network devices
- Storage devices
- Parallel launch

### Phase 3: Tauri Integration (2 hours)
- Rust FFI bridge
- IPC with Swift process
- VM control from Tauri

## Status

- [x] Lima layer tested
- [x] vfkit layer tested  
- [ ] Swift VZ layer (next)
- [ ] Tauri integration (after)

Ready to build?

