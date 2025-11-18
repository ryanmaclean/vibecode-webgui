# Tart and UTM VZ Implementation Research

**Research Date**: November 18, 2025  
**Purpose**: Study how Tart and UTM solve bootloader, VirtIO-FS, and Linux guest issues to improve VibeCode VM implementation

## Legal Notice

- **Tart**: Fair Source License (can study, cannot copy code)
- **UTM**: Apache 2.0 License (can study and reference)
- **VibeCode**: MIT License (all implementations will be original)

This document contains architectural patterns and API usage learned from studying these projects. No code has been copied. All recommendations are for implementing similar functionality using Apple's public Virtualization.framework APIs.

## Executive Summary

Both Tart and UTM are production-ready virtualization tools built on Apple's Virtualization.framework. They solve several key challenges that VibeCode currently faces:

1. **Bootloader Configuration**: Use VZEFIBootLoader with VZEFIVariableStore for persistent EFI state
2. **VirtIO-FS**: Implement VZVirtioFileSystemDeviceConfiguration for host-guest file sharing
3. **Networking**: Leverage VZNATNetworkDeviceAttachment with built-in DHCP for NAT networking
4. **Image Distribution**: Use OCI registries (like GHCR) for VM image distribution
5. **Linux Guest Support**: Configure GRUB bootloader on ARM64 with proper EFI setup

---

## 1. Bootloader Configuration and EFI Setup

### Current VibeCode Issue
Fresh Alpine/Linux images fail to boot with "invalid bootloader" error.

### How Tart and UTM Solve This

#### EFI Bootloader Pattern
Both projects use **VZEFIBootLoader** with **VZEFIVariableStore** to provide persistent EFI firmware state:

```swift
// Pattern learned from Tart and UTM implementations
let efi = VZEFIBootLoader()
let efiPath = "\(vmPath)/EFI.nvram"
let efiURL = URL(fileURLWithPath: efiPath)

// Create variable store if it doesn't exist
if !FileManager.default.fileExists(atPath: efiPath) {
    try VZEFIVariableStore(creatingVariableStoreAt: efiURL)
}

efi.variableStore = VZEFIVariableStore(url: efiURL)
config.bootLoader = efi
```

**Key Insights**:
- EFI variable store must be created once and persisted across VM boots
- The NVRAM file stores boot configuration, device UUIDs, and boot parameters
- For Linux VMs, use **VZGenericPlatformConfiguration** (not VZMacOSPlatformConfiguration)

#### Linux Boot Configuration
For ARM64 Linux guests (Alpine, Ubuntu):

1. **GRUB** is the standard UEFI bootloader
2. Bootloader files live in EFI System Partition (ESP, FAT32):
   - `/EFI/alpine/grubaa64.efi` (Alpine)
   - `/EFI/ubuntu/grubaa64.efi` (Ubuntu)  
   - `/EFI/boot/bootaa64.efi` (fallback)
3. Must use **aarch64** (ARM64) images on Apple Silicon

**VibeCode Recommendation**:
- Current LinuxVMStandalone.swift already uses VZEFIBootLoader correctly
- Ensure EFI variable store is created before first boot
- Pre-install GRUB in Alpine images or use pre-configured cloud images

---

## 2. VirtIO-FS Directory Sharing

### Current VibeCode Gap
No host-VM file sharing capability.

### How Tart and UTM Implement This

#### Tart's `--dir` Feature
Tart supports directory mounting with a simple CLI:
```bash
tart run --dir=project:~/src/project vm-name
```

#### Implementation Pattern
Both use **VZVirtioFileSystemDeviceConfiguration** from Apple's framework:

```swift
// Pattern for VirtioFS directory sharing
let sharedDirectory = VZSharedDirectory(
    url: URL(fileURLWithPath: hostPath),
    readOnly: false
)

let tag = VZVirtioFileSystemDeviceConfiguration.MacOSGuestAutomountTag
let sharingDevice = VZVirtioFileSystemDeviceConfiguration(tag: tag)
sharingDevice.share = VZSingleDirectorySharingDevice(directory: sharedDirectory)

config.directorySharingDevices = [sharingDevice]
```

#### Guest-Side Mounting

**macOS Guest** (macOS 13+):
```bash
mkdir -p /Volumes/Share
mount_virtiofs share /Volumes/Share
```

**Linux Guest**:
```bash
mkdir -p /mnt/share
mount -t virtiofs share /mnt/share
```

**Key Insights**:
- Tag name must match between host configuration and guest mount command
- VirtioFS offers dramatically better performance than 9p or network shares
- Requires macOS 12+ host and compatible guest OS with VirtioFS drivers
- macOS 13+ guests support automatic mounting with MacOSGuestAutomountTag

**VibeCode Recommendations**:
1. Add VirtioFS support to vz-swift VMs
2. Provide CLI argument like `--share <host-path>:<guest-tag>`
3. Document guest-side mount commands for Linux and macOS
4. Consider auto-mount scripts for common use cases

---

## 3. VM Image Distribution

### Current VibeCode Issue
VM images too large for git, unclear distribution strategy.

### How Tart Solves This

#### OCI Container Registry Approach
Tart uses OCI (Open Container Initiative) registries to store and distribute VM images:

```bash
# Push VM image to registry
tart push ghcr.io/username/vm-name:tag

# Pull and clone VM image
tart clone ghcr.io/username/vm-name:tag local-vm-name
tart run local-vm-name
```

**Key Implementation Details**:
- VM images stored as OCI artifacts (not Docker containers)
- Works with GitHub Container Registry (GHCR), Docker Hub, etc.
- Uses GitHub Personal Access Token for authentication
- Integrates with CI/CD pipelines (GitHub Actions, etc.)

**Example GitHub Actions Workflow**:
```yaml
permissions:
  packages: write

steps:
  - name: Build VM
    run: tart create my-vm ...
  
  - name: Push to GHCR
    run: tart push ghcr.io/${{ github.repository }}:latest
```

**VibeCode Recommendations**:
1. Use GitHub Releases for distributing pre-built VM images (simpler start)
2. Consider OCI registry support for future enterprise use
3. Provide base images for Alpine, Ubuntu on GitHub Releases
4. Document image building process with Packer

---

## 4. Networking and IP Discovery

### Current VibeCode Gap
No easy way to discover VM IPs for SSH access.

### How Tart and UTM Handle Networking

#### NAT Networking (Default)
Both use **VZNATNetworkDeviceAttachment** for simple NAT networking:

```swift
let netDevice = VZVirtioNetworkDeviceConfiguration()
netDevice.attachment = VZNATNetworkDeviceAttachment()
config.networkDevices = [netDevice]
```

**How NAT Works**:
- Host runs built-in DHCP server (private subnet, e.g., 192.168.64.0/24)
- VMs get IPs from DHCP (default lease: 24 hours)
- Host acts as NAT gateway for internet access
- VMs not directly accessible from LAN (requires port forwarding)

#### IP Discovery
**Tart's `tart ip <vm>` Command**:
- Queries DHCP lease files on host: `/var/db/dhcpd_leases`
- Returns assigned IP address for a VM
- Falls back to link-local (169.254.x.x) if DHCP fails

**UTM Approach**:
- In guest: use `ip a` (Linux) or `ipconfig` (Windows)
- Gateway IP in guest points to host's virtual interface
- Port forwarding for host-to-guest communication

**Bridged Networking** (Alternative):
- VM appears as peer on physical network
- Gets IP from external DHCP server
- Requires additional entitlements: `com.apple.vm.networking`
- More complex setup, better for LAN integration

**VibeCode Recommendations**:
1. Add IP discovery utility (read DHCP leases or query via agent)
2. Provide `vibecode-vm ip <vm-name>` command
3. Document SSH access: `ssh user@$(vibecode-vm ip myvm)`
4. Consider port forwarding helper for common ports (SSH, HTTP)

---

## 5. Linux Guest Support

### Current VibeCode Challenge
Ensure reliable Linux boot across distributions.

### Best Practices from Tart and UTM

#### Supported Linux Distributions
- **Alpine Linux**: Lightweight, uses GRUB for UEFI on ARM64
- **Ubuntu**: Full support with pre-configured ARM64 images
- **Debian, Fedora**: Also supported with UEFI bootloaders

#### Key Requirements
1. **ARM64 Images**: Must use aarch64 builds on Apple Silicon
2. **UEFI Bootloader**: GRUB installed in EFI System Partition
3. **VirtIO Drivers**: Kernel modules for VirtIO block, network, filesystem
4. **Cloud-Init**: Optional but recommended for automation

#### Bootloader Setup
```
/boot/efi/
├── EFI/
│   ├── alpine/
│   │   └── grubaa64.efi
│   └── boot/
│       └── bootaa64.efi (fallback)
└── ...
```

**Alpine Specific**:
- setup-disk script creates UEFI bootloader
- Default uses syslinux (BIOS), must specify UEFI during install
- Alpine docs: https://wiki.alpinelinux.org/wiki/Alpine_and_UEFI

**Ubuntu Specific**:
- Pre-configured ARM64 cloud images available
- GRUB2 installed by default
- Customizable via `/etc/default/grub` → `update-grub`

**VibeCode Recommendations**:
1. **Use Pre-Built Cloud Images**:
   - Ubuntu: https://cloud-images.ubuntu.com/
   - Alpine: Build with Packer using cloud-init ISO
2. **Document Setup Process**:
   - How to create bootable Alpine VM
   - Where to get ARM64 ISOs
   - GRUB installation commands
3. **Provide Templates**:
   - Base VM configs for Alpine, Ubuntu
   - Cloud-init configs for automated setup
4. **Test with Multiple Distributions**:
   - Verify boot on Alpine, Ubuntu, Debian

---

## 6. Additional Architectural Patterns

### VM Configuration Structure
Both Tart and UTM use a structured approach:

```swift
class VMConfiguration {
    var platform: VZPlatformConfiguration  // Generic or macOS
    var bootLoader: VZBootLoader            // EFI or macOS bootloader
    var cpuCount: Int
    var memorySize: UInt64
    var storageDevices: [VZStorageDeviceConfiguration]
    var networkDevices: [VZNetworkDeviceConfiguration]
    var directorySharingDevices: [VZDirectorySharingDeviceConfiguration]
    var entropyDevices: [VZEntropyDeviceConfiguration]
    var serialPorts: [VZSerialPortConfiguration]
}
```

**VibeCode Current State**:
- LinuxVMStandalone.swift has basic structure
- Missing: directory sharing, structured configuration management
- Opportunity: Create reusable configuration builder

### Serial Console Access
Both provide serial console for debugging:

```swift
let serial = VZVirtioConsoleDeviceSerialPortConfiguration()
serial.attachment = VZFileHandleSerialPortAttachment(
    fileHandleForReading: .standardInput,
    fileHandleForWriting: .standardOutput
)
config.serialPorts = [serial]
```

**VibeCode Status**: Already implemented ✅

### Entropy Device
Required for secure random number generation:

```swift
config.entropyDevices = [VZVirtioEntropyDeviceConfiguration()]
```

**VibeCode Status**: Already implemented ✅

---

## 7. Implementation Priorities for VibeCode

### High Priority
1. **VirtioFS Directory Sharing** 
   - Enables code development workflows
   - High user value
   - API: 20-30 lines of Swift code

2. **IP Discovery Utility**
   - Essential for SSH access
   - Can read DHCP leases or implement guest agent
   - Command: `vibecode-vm ip <name>`

3. **Linux Guest Documentation**
   - Step-by-step Alpine setup
   - Pre-built image distribution
   - Bootloader troubleshooting guide

### Medium Priority
4. **VM Image Distribution**
   - GitHub Releases for initial approach
   - OCI registry support for scale
   - Automated builds with Packer

5. **Bridged Networking Option**
   - For advanced users needing LAN access
   - Requires entitlement management
   - More complex setup

### Low Priority (Future)
6. **macOS Guest Support**
   - Requires VZMacOSBootLoader, IPSW files
   - More complex licensing and setup
   - Lower priority for development workloads

---

## 8. Code Examples and API Usage

### Complete Linux VM Configuration (Recommended Pattern)

```swift
import Foundation
import Virtualization

@available(macOS 13.0, *)
func createLinuxVM(vmPath: String, shareDir: String? = nil) throws -> VZVirtualMachine {
    let config = VZVirtualMachineConfiguration()
    
    // Platform (Generic for Linux)
    config.platform = VZGenericPlatformConfiguration()
    
    // CPU & Memory
    config.cpuCount = min(ProcessInfo.processInfo.processorCount, 4)
    config.memorySize = 2 * 1024 * 1024 * 1024 // 2GB
    
    // UEFI Boot with persistent NVRAM
    let efi = VZEFIBootLoader()
    let efiPath = "\(vmPath)/EFI.nvram"
    let efiURL = URL(fileURLWithPath: efiPath)
    
    if !FileManager.default.fileExists(atPath: efiPath) {
        try VZEFIVariableStore(creatingVariableStoreAt: efiURL)
    }
    efi.variableStore = VZEFIVariableStore(url: efiURL)
    config.bootLoader = efi
    
    // Storage
    let diskPath = "\(vmPath)/disk.img"
    let diskURL = URL(fileURLWithPath: diskPath)
    let diskAttachment = try VZDiskImageStorageDeviceAttachment(
        url: diskURL,
        readOnly: false
    )
    let blockDevice = VZVirtioBlockDeviceConfiguration(attachment: diskAttachment)
    config.storageDevices = [blockDevice]
    
    // Network (NAT)
    let net = VZVirtioNetworkDeviceConfiguration()
    net.attachment = VZNATNetworkDeviceAttachment()
    config.networkDevices = [net]
    
    // Directory Sharing (VirtioFS)
    if let shareDir = shareDir {
        let sharedDirectory = VZSharedDirectory(
            url: URL(fileURLWithPath: shareDir),
            readOnly: false
        )
        let tag = "vibecode-share"  // Used in guest mount command
        let sharingDevice = VZVirtioFileSystemDeviceConfiguration(tag: tag)
        sharingDevice.share = VZSingleDirectorySharingDevice(directory: sharedDirectory)
        config.directorySharingDevices = [sharingDevice]
    }
    
    // Entropy for RNG
    config.entropyDevices = [VZVirtioEntropyDeviceConfiguration()]
    
    // Serial Console
    let serial = VZVirtioConsoleDeviceSerialPortConfiguration()
    serial.attachment = VZFileHandleSerialPortAttachment(
        fileHandleForReading: .standardInput,
        fileHandleForWriting: .standardOutput
    )
    config.serialPorts = [serial]
    
    // Validate
    try config.validate()
    
    return VZVirtualMachine(configuration: config)
}
```

### Guest-Side Mount Script (Linux)

```bash
#!/bin/bash
# Auto-mount VirtioFS share in Linux guest
# Save as /etc/profile.d/vibecode-mount.sh

MOUNT_TAG="vibecode-share"
MOUNT_POINT="/mnt/vibecode"

if ! mount | grep -q "$MOUNT_POINT"; then
    mkdir -p "$MOUNT_POINT"
    mount -t virtiofs "$MOUNT_TAG" "$MOUNT_POINT" 2>/dev/null || true
fi
```

---

## 9. Apple Virtualization.framework APIs Summary

### Key Classes Used by Tart and UTM

| API | Purpose | VibeCode Status |
|-----|---------|-----------------|
| `VZVirtualMachine` | Main VM object | ✅ Used |
| `VZVirtualMachineConfiguration` | VM configuration | ✅ Used |
| `VZGenericPlatformConfiguration` | Linux/generic platform | ✅ Used |
| `VZEFIBootLoader` | UEFI bootloader | ✅ Used |
| `VZEFIVariableStore` | Persistent NVRAM | ✅ Used |
| `VZVirtioBlockDeviceConfiguration` | Disk attachment | ✅ Used |
| `VZNATNetworkDeviceAttachment` | NAT networking | ✅ Used |
| `VZVirtioEntropyDeviceConfiguration` | RNG | ✅ Used |
| `VZVirtioConsoleDeviceSerialPortConfiguration` | Serial console | ✅ Used |
| `VZVirtioFileSystemDeviceConfiguration` | VirtioFS sharing | ❌ **Missing** |
| `VZSharedDirectory` | Shared directory config | ❌ **Missing** |
| `VZSingleDirectorySharingDevice` | Single directory share | ❌ **Missing** |

### Apple Documentation References
- [Virtualization Framework](https://developer.apple.com/documentation/virtualization)
- [VZEFIBootLoader](https://developer.apple.com/documentation/virtualization/vzefibootloader)
- [VZVirtioFileSystemDeviceConfiguration](https://developer.apple.com/documentation/virtualization/vzvirtiofilesystemdeviceconfiguration)
- [VZDirectorySharingDevice](https://developer.apple.com/documentation/virtualization/vzdirectorysharingdevice)
- [VZNATNetworkDeviceAttachment](https://developer.apple.com/documentation/virtualization/vznatnetworkdeviceattachment)

---

## 10. Testing Strategy

### Recommended Tests
1. **Bootloader Tests**:
   - Fresh Alpine VM boots successfully
   - Ubuntu cloud image boots successfully
   - EFI variables persist across reboots

2. **VirtioFS Tests**:
   - Host directory visible in guest
   - File read/write from guest
   - Performance with large files

3. **Networking Tests**:
   - VM gets IP via DHCP
   - VM can reach internet
   - SSH from host to guest works

4. **Image Distribution Tests**:
   - Download base image from releases
   - Verify checksums
   - Boot downloaded image

---

## 11. Security Considerations

### Learned from Tart and UTM

1. **Entitlements**:
   - NAT networking: No special entitlements
   - Bridged networking: Requires `com.apple.vm.networking`
   - Sandbox: Tart runs unsandboxed for full access

2. **Directory Sharing Permissions**:
   - Consider read-only mounts for sensitive directories
   - VirtioFS respects host filesystem permissions
   - Guest can only access explicitly shared directories

3. **Network Isolation**:
   - NAT mode provides basic isolation (VMs behind host NAT)
   - Bridged mode exposes VMs to LAN (security tradeoff)
   - Consider firewall rules for multi-VM scenarios

**VibeCode Recommendations**:
- Default to read-only VirtioFS mounts for security
- Provide clear warnings about bridged networking risks
- Document entitlement requirements

---

## 12. Performance Optimizations

### Insights from Production Tools

1. **VirtioFS vs Alternatives**:
   - VirtioFS: Fastest, recommended for file-heavy workloads
   - 9p: Slower, fallback for older systems
   - Network shares (SMB/NFS): Much slower, avoid

2. **CPU Allocation**:
   - Tart default: Match host CPU count
   - VibeCode current: 2 CPUs (reasonable for lightweight VMs)
   - Recommendation: Make configurable, default to host_cpus/2

3. **Memory Sizing**:
   - Tart: User-specified
   - VibeCode current: 1GB (good for Alpine)
   - Recommendation: 2GB minimum for Ubuntu, configurable

---

## 13. References and Further Reading

### Tart Resources
- Tart Website: https://tart.run/
- Tart GitHub: https://github.com/cirruslabs/tart
- Tart Quick Start: https://tart.run/quick-start/
- Tart VM Management: https://tart.run/integrations/vm-management/

### UTM Resources
- UTM GitHub: https://github.com/utmapp/UTM
- UTM Documentation: https://docs.getutm.app/
- UTM macOS Guest Support: https://docs.getutm.app/guest-support/macos/
- UTM Directory Sharing: https://docs.getutm.app/guest-support/sharing/directory/

### Apple Documentation
- Virtualization Framework: https://developer.apple.com/documentation/virtualization
- Running Intel Binaries (Rosetta): https://developer.apple.com/documentation/virtualization/running_intel_binaries_in_linux_vms_with_rosetta

### Linux Resources
- Alpine UEFI Guide: https://wiki.alpinelinux.org/wiki/Alpine_and_UEFI
- Ubuntu Cloud Images: https://cloud-images.ubuntu.com/

---

## 14. Conclusion

Both Tart and UTM demonstrate mature, production-ready patterns for Apple Silicon virtualization. Key takeaways for VibeCode:

### Immediate Actions
1. **Add VirtioFS support** (20-30 lines of Swift)
2. **Implement IP discovery** (read DHCP leases)
3. **Document Linux guest setup** (Alpine + Ubuntu guides)

### Short-Term Goals
4. Distribute base VM images via GitHub Releases
5. Add CPU/memory configuration options
6. Create automated testing for boot and networking

### Long-Term Vision
7. OCI registry support for enterprise deployments
8. Bridged networking option for advanced users
9. Multi-VM management and orchestration

**All patterns learned are based on public Apple APIs. VibeCode remains fully MIT-licensed with original implementations.**

---

## Appendix: License Compatibility Summary

| Project | License | Can Copy Code? | Can Reference? | Can Distribute? |
|---------|---------|----------------|----------------|-----------------|
| **Tart** | Fair Source v0.9 | ❌ No | ✅ Yes (patterns only) | ❌ No |
| **UTM** | Apache 2.0 | ⚠️ With attribution | ✅ Yes | ✅ Yes (with attribution) |
| **VirtualBuddy** | MIT | ✅ Yes | ✅ Yes | ✅ Yes |
| **Apple VZ Framework** | Public API | ✅ Yes | ✅ Yes | ✅ Yes |
| **VibeCode** | MIT | N/A | N/A | ✅ Yes |

**VibeCode Implementation**: All code written from scratch using Apple's public APIs, informed by architectural patterns (not code) from Tart and UTM.
