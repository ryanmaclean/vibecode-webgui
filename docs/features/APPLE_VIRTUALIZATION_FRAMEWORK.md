# Apple Virtualization Framework - Native macOS VM Support

**Version:** v1.5.0+  
**Status:** ✅ Production Ready  
**Platform:** macOS 12.0+ (Monterey and later)  
**Optimal:** macOS 26+ (Tahoe) with ASIF support

---

## Overview

VibeCode integrates **Apple's native Virtualization Framework** for high-performance, native macOS virtual machine support. This provides a first-class alternative to Docker/Podman on macOS with significantly better performance and tighter OS integration.

### Key Benefits

- **Native Performance**: Direct hardware virtualization without Docker overhead
- **Tight macOS Integration**: Uses system frameworks for optimal compatibility
- **ASIF Disk Format**: 2-3x faster I/O with sparse allocation on macOS 26+
- **Full VM Control**: Complete lifecycle management (start, stop, suspend, resume)
- **Multi-VM Support**: Run multiple VMs simultaneously with resource management

---

## Architecture

### Two-Layer Design

**TypeScript Layer** (High-level API):
- Container runtime abstraction
- VM lifecycle management
- JSON-RPC communication with Swift layer
- Integration with VibeCode services

**Swift Layer** (Native Framework Access):
- Direct Virtualization.framework integration
- VM creation and configuration
- Hardware resource management
- ASIF disk image support

### Communication Protocol

JSON-RPC 2.0 over stdio between TypeScript and Swift processes:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "vm.create",
  "params": {
    "vmId": "vibecode-dev",
    "cpus": 4,
    "memoryGB": 4,
    "diskSizeGB": 20,
    "kernelPath": "/path/to/vmlinuz",
    "initrdPath": "/path/to/initramfs"
  }
}
```

---

## Core Components

### TypeScript Implementation

| Component | Path | Purpose |
|-----------|------|---------|
| **AppleContainerRuntime** | `src/lib/container/apple-container.ts` | Main runtime wrapper |
| **AppleContainerV2** | `src/lib/container/apple-container-v2.ts` | Production runtime bridge |
| **NativeVMProvider** | `src/lib/vm/providers/native-vm.ts` | VM provider implementation |
| **Container Abstraction** | `src/lib/runtime/container-abstraction.ts` | Multi-runtime support |

### Swift Implementation

| Component | Path | Purpose |
|-----------|------|---------|
| **VMManager** | `platforms/macos/VibeCodeSwift/Sources/ViewModels/VMManager.swift` | Core VM orchestration |
| **LinuxGUIVM** | `platforms/macos/vz-swift/Sources/VibeCodeVM/LinuxGUIVM.swift` | GUI-capable Linux VMs |
| **DiskImageManager** | `platforms/macos/VibeCodeSwift/Sources/Utilities/DiskImageManager.swift` | ASIF disk management |
| **Specialized VMs** | `platforms/macos/VibeCodeSwift/Sources/Virtualization/` | PostgreSQL, Node.js, Valkey |

---

## Features

### Virtualization Framework Integration

- ✅ **VZVirtualMachine**: Core VM management
- ✅ **VZLinuxBootLoader**: Direct kernel boot
- ✅ **VZEFIBootLoader**: UEFI boot support
- ✅ **VZDiskImageStorageDeviceAttachment**: Disk image mounting
- ✅ **Thread Safety**: Dedicated serial dispatch queue

### Boot Configuration

- **EFI Boot**: UEFI-based boot with variable store
- **Direct Kernel Boot**: Fast boot with kernel/initrd
- **Boot Parameters**: Custom kernel command line arguments

### Graphics & Display (Linux GUI VMs)

- **VZVirtioGraphicsDevice**: VirtIO GPU support
- **Resolution**: Configurable (default 1920x1080@144DPI)
- **Input Devices**: USB keyboard and mouse support

### Networking

- **VZNATNetworkDevice**: Network Address Translation
- **Automatic IP Assignment**: DHCP-based networking
- **Host Connectivity**: Direct host-to-VM communication

### Storage

#### ASIF Disk Format (macOS 26+ Tahoe)

- **2-3x Faster**: Optimized I/O performance
- **Sparse Allocation**: Only uses space for actual data (87% efficiency)
- **Single File**: Easier management than sparse bundles
- **APFS Optimized**: Native filesystem integration

**Performance Benchmarks:**
- Write Speed: 1.6 GB/s
- Read Speed: 3.7 GB/s
- Storage Efficiency: 87% (13MB actual for 100MB logical)

#### Legacy Formats

- **RAW (UDRW)**: Universal compatibility
- **Sparse (UDSP)**: Basic sparse allocation

---

## Configuration

### Security Entitlements

**Required Entitlement:**
```xml
<key>com.apple.security.virtualization</key>
<true/>
```

**Additional Entitlements:**
- `com.apple.security.files.user-selected.read-write` - File system access
- `com.apple.security.network.client` - Network access

**Configuration Files:**
- `platforms/macos/VibeCodeSwift/VibeCode.entitlements`
- `platforms/macos/vz-swift/entitlements.plist`

### VM Configuration

```typescript
// TypeScript Example
import { NativeVMProvider } from '@/lib/vm/providers/native-vm';

const provider = new NativeVMProvider();

const vmConfig = {
  vmId: 'vibecode-dev',
  cpus: 4,
  memoryGB: 4,
  diskSizeGB: 20,
  kernelPath: '/path/to/vmlinuz',
  initrdPath: '/path/to/initramfs',
  diskPath: '/path/to/disk.img'
};

await provider.createVM(vmConfig);
await provider.startVM('vibecode-dev');
```

```swift
// Swift Example
import Virtualization

let config = VZVirtualMachineConfiguration()
config.cpuCount = 4
config.memorySize = 4 * 1024 * 1024 * 1024  // 4GB

// ASIF disk attachment
let diskURL = URL(fileURLWithPath: "/path/to/disk.asif")
let diskAttachment = try VZDiskImageStorageDeviceAttachment(
    url: diskURL,
    readOnly: false
)
let blockDevice = VZVirtioBlockDeviceConfiguration(attachment: diskAttachment)
config.storageDevices = [blockDevice]

// Create and start VM
let vm = VZVirtualMachine(configuration: config)
vm.start { result in
    print("VM started!")
}
```

---

## Testing

### Unit Tests

**Test Coverage:**
- `tests/unit/lib/container/apple-container.test.ts` - Core runtime tests
- `tests/unit/lib/container/apple-container-v2.test.ts` - v2 runtime tests
- `tests/unit/lib/container/vm-orchestration-bridge.test.ts` - VM orchestration

**Run Tests:**
```bash
npm run test:unit -- tests/unit/lib/container/apple-container.test.ts
```

### Benchmarks

**Performance Benchmarking:**
- `scripts/benchmarks/applevf_fastboot_bench.sh` - Fast boot benchmarks
- `scripts/benchmarks/applevf_fastboot_bench.py` - Python benchmark analysis

**Measured Performance:**
- VM boot time: Target <3 seconds (EFI-stub fast boot)
- Disk I/O: 1.6 GB/s write, 3.7 GB/s read
- Memory efficiency: Sparse allocation reduces overhead

---

## Documentation

### Technical Guides

| Document | Description |
|----------|-------------|
| **ASIF_VZ_STATUS.md** | Current implementation status and benchmarks |
| **apple-vf-fastboot.md** | EFI-stub fast boot optimization guide |
| **NATIVE_VM_README.md** | JSON-RPC protocol specification |
| **ASIF_DISK_FORMAT.md** | ASIF format technical details |
| **TAHOE_VIRTUALIZATION_STRATEGY.md** | macOS 26 optimization strategy |

### Configuration Guides

| Document | Description |
|----------|-------------|
| **config/macos/README.md** | Security entitlements and TCC policies |
| **VibeCodeSwift/README.md** | Swift application overview |

---

## Usage Examples

### Starting a VM

```typescript
import { AppleContainerRuntime } from '@/lib/container/apple-container';

const runtime = new AppleContainerRuntime();

// Check availability
const available = await runtime.isAvailable();
if (!available) {
  console.error('Apple Container Runtime not available');
  return;
}

// Start container
const result = await runtime.start('vibecode-dev', {
  name: 'vibecode-dev-1',
  ports: { '8080': '8080' },
  env: { NODE_ENV: 'development' },
  detached: true
});

console.log(`Container started: ${result.id}`);
```

### Runtime Detection

```typescript
import { detectRuntime, createRuntime } from '@/lib/runtime/container-abstraction';

// Auto-detect available runtime
const runtimeType = await detectRuntime();
console.log(`Detected runtime: ${runtimeType}`);

// Create runtime instance
const runtime = createRuntime(runtimeType);
await runtime.start('container-id');
```

### ASIF Disk Management

```swift
import Foundation

let mgr = DiskImageManager.shared

// Check ASIF support
if mgr.isASIFSupported() {
    print("✅ ASIF supported")
    
    // Create 10GB sparse disk
    try await mgr.createDiskImage(
        path: "/path/to/vm-disk.asif",
        size: "10G",
        volumeName: "vm-data",
        format: .asif
    )
    
    // Result: ~10MB actual size, grows to 10GB as needed
}
```

---

## Platform Support

### Minimum Requirements

- **macOS Version**: 12.0 (Monterey) or later
- **Architecture**: ARM64 (Apple Silicon) or x86_64 (Intel)
- **Virtualization**: Enabled in BIOS/firmware
- **Entitlements**: App must be signed with virtualization entitlement

### Optimal Configuration

- **macOS Version**: 26.0+ (Tahoe) for ASIF support
- **Architecture**: ARM64 (Apple Silicon) for best performance
- **Storage**: APFS volume with sufficient space
- **Memory**: 8GB+ for running multiple VMs

### Feature Availability by macOS Version

| Feature | macOS 12 | macOS 13 | macOS 14 | macOS 15 | macOS 26 |
|---------|----------|----------|----------|----------|----------|
| Basic Virtualization | ✅ | ✅ | ✅ | ✅ | ✅ |
| Linux Boot Loader | ✅ | ✅ | ✅ | ✅ | ✅ |
| EFI Boot | ✅ | ✅ | ✅ | ✅ | ✅ |
| VirtIO Graphics | ✅ | ✅ | ✅ | ✅ | ✅ |
| ASIF Read | ❌ | ❌ | ❌ | ✅ (15.5+) | ✅ |
| ASIF Create | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## Performance Optimization

### Best Practices

1. **Use ASIF on Tahoe**: 2-3x faster than traditional formats
2. **Sparse Allocation**: Start with small disks, grow as needed
3. **APFS Volumes**: Place VMs on fast APFS volumes
4. **Resource Allocation**: Match VM resources to workload
5. **Parallel VMs**: Run multiple VMs with careful resource planning

### Fast Boot Optimization

**EFI-Stub Fast Boot** (Target: <3 seconds):
- Use direct kernel boot instead of bootloader
- Minimize initramfs size
- Pre-allocate disk space for production VMs
- Use kernel boot parameters for fast init

See: `docs/guides/apple-vf-fastboot.md`

---

## Troubleshooting

### Common Issues

#### "doesn't have virtualization entitlement"
**Solution**: Ensure app is properly signed with virtualization entitlement. Run from VibeCodeSwift.app bundle, not standalone scripts.

#### ASIF disk creation fails
**Solution**: ASIF can only be created on macOS 26 Tahoe. Use RAW format on earlier versions.

#### VM fails to start
**Solution**: Check console logs for detailed error messages. Verify:
- Kernel and initrd paths are correct
- Disk image is accessible and not corrupted
- Sufficient memory and CPU resources available
- Network configuration is valid

#### Slow disk I/O
**Solution**: Ensure VM disk is on APFS volume, not network share. Consider using ASIF format on Tahoe for optimal performance.

---

## Migration Guide

### From Docker to Apple Virtualization

**Benefits:**
- **Performance**: Native virtualization, no emulation overhead
- **Integration**: Better macOS resource management
- **Efficiency**: Sparse disk allocation reduces storage usage

**Considerations:**
- **Platform-Specific**: Only works on macOS
- **Setup**: Requires Swift binary compilation
- **Learning Curve**: Different API than Docker

**Steps:**
1. Build Swift VM manager: `cd platforms/macos/vm && swift build -c release`
2. Update runtime detection to prefer native VMs
3. Migrate VM images to ASIF format (optional, Tahoe only)
4. Test VM lifecycle operations
5. Monitor performance and resource usage

---

## Roadmap

### Completed (v1.5.0)

- ✅ Virtualization Framework integration
- ✅ ASIF disk format support
- ✅ TypeScript/Swift communication protocol
- ✅ VM lifecycle management
- ✅ Linux GUI VM support
- ✅ Performance benchmarking
- ✅ Unit test coverage

### Planned (Future Releases)

- 🔄 GPU acceleration for compute workloads
- 🔄 VM snapshot and cloning
- 🔄 Live migration between hosts
- 🔄 Advanced resource scheduling
- 🔄 Container-to-VM compatibility layer
- 🔄 Web-based VM console access

---

## Resources

### Apple Documentation
- [Virtualization Framework](https://developer.apple.com/documentation/virtualization) - Official Apple docs
- [Running GUI Linux in a VM](https://developer.apple.com/documentation/virtualization/running-gui-linux-in-a-virtual-machine-on-a-mac) - GUI VM guide

### Third-Party Tools
- [vfkit](https://github.com/crc-org/vfkit) - Go wrapper for Virtualization.framework
- [Code-Hex vz](https://pkg.go.dev/github.com/Code-Hex/vz/v3) - Another Go wrapper

### Linux Resources
- [Alpine Linux](https://alpinelinux.org/downloads/) - Lightweight Linux distribution
- [Kernel.org](https://kernel.org) - Linux kernel releases

### Technical Articles
- [ASIF Research](https://eclecticlight.co/2025/06/12/macos-tahoe-brings-a-new-disk-image-format/) - ASIF format analysis

---

## Support

### Getting Help

1. **Documentation**: Check `docs/` directory for detailed guides
2. **GitHub Issues**: Search for "virtualization" or "apple" tags
3. **Test Failures**: Include full console output and macOS version
4. **Performance**: Run benchmarks before reporting issues

### Contributing

Contributions welcome! Areas of interest:
- Performance optimization
- Additional VM configurations
- Test coverage improvements
- Documentation enhancements

See `CONTRIBUTING.md` for guidelines.

---

## License

MIT License - See LICENSE file for details

---

**Last Updated**: February 2026  
**Maintained By**: VibeCode Team  
**Status**: ✅ Production Ready
