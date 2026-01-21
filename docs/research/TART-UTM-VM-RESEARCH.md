# Research: Tart and UTM VZ Implementations

Study of how Tart and UTM solve bootloader, VirtIO-FS, and Linux guest issues.

## License Summary

| Project | License | Can Study | Can Copy Code |
|---------|---------|-----------|---------------|
| Tart | Fair Source | Yes | No |
| UTM | Apache 2.0 | Yes | Yes (with attribution) |

## Tart (cirruslabs/tart)

**Repository**: https://github.com/cirruslabs/tart

### Architecture
- Native macOS Virtualization.framework wrapper
- Focus on macOS and Linux ARM64 guests
- Optimized for CI/CD (GitHub Actions, GitLab CI)

### Key Patterns

#### 1. Boot Configuration
```swift
// Tart uses EFI boot with specific configuration
let bootLoader = VZEFIBootLoader()
let variableStore = VZEFIVariableStore(url: efiVarsURL)
bootLoader.variableStore = variableStore
```

#### 2. VirtIO-FS (File Sharing)
```swift
// VirtioFS for host-guest file sharing
let sharedDir = VZSharedDirectory(url: hostPath, readOnly: false)
let share = VZVirtioFileSystemDeviceConfiguration(tag: "shared")
share.share = VZSingleDirectoryShare(directory: sharedDir)
```

#### 3. Network Configuration
- Uses NAT networking by default
- Bridged networking available
- macOS guest requires specific network setup

### Lessons for VibeCode
1. **EFI Variables**: Persist EFI variable store between boots
2. **VirtIO-FS**: Use consistent mount tags
3. **Guest Tools**: Required for optimal performance

## UTM (utmapp/UTM)

**Repository**: https://github.com/utmapp/UTM

### Architecture
- QEMU backend with native UI
- Supports x86_64 emulation on Apple Silicon
- Virtualization.framework for ARM64 native
- Full GUI application

### Key Patterns

#### 1. VM Configuration
```swift
// UTM separates configuration from runtime
struct UTMQemuConfiguration {
    var system: UTMQemuConfigurationSystem
    var drives: [UTMQemuConfigurationDrive]
    var network: [UTMQemuConfigurationNetwork]
    var sharing: UTMQemuConfigurationSharing
}
```

#### 2. Boot Order
- Supports multiple boot devices
- CD-ROM, HDD, Network boot
- EFI and legacy BIOS modes

#### 3. VirtIO Devices
- VirtIO-net for networking
- VirtIO-blk for storage
- VirtIO-fs for file sharing
- VirtIO-gpu for graphics

### Lessons for VibeCode
1. **Configuration Separation**: Keep VM config separate from runtime state
2. **Multiple Backends**: Support both QEMU and Virtualization.framework
3. **Drive Management**: Handle multiple storage devices cleanly

## Common Solutions

### Bootloader Issues

**Problem**: Fresh Alpine images don't boot
**Solution from Tart/UTM**:
1. Create EFI variable store on first boot
2. Install bootloader to EFI partition
3. Persist EFI vars across boots

```bash
# Alpine EFI setup
apk add grub grub-efi efibootmgr
grub-install --target=arm64-efi --efi-directory=/boot/efi
grub-mkconfig -o /boot/grub/grub.cfg
```

### VirtIO-FS Setup

**Problem**: File sharing not working
**Solution**:
1. Enable virtiofs in VM config
2. Mount in guest with consistent tag
3. Handle permissions correctly

```bash
# Guest mount command
mount -t virtiofs shared /mnt/shared
```

### Linux Guest Optimization

**Problem**: Poor performance in Linux guests
**Solution**:
1. Install VirtIO drivers
2. Enable balloon driver for memory
3. Use paravirtualized devices

```bash
# Alpine optimization
apk add qemu-guest-agent
rc-update add qemu-guest-agent
```

## Recommendations for VibeCode

### 1. EFI Management
- Create persistent EFI variable store per VM
- Use VZEFIVariableStore with dedicated file
- Handle first-boot vs subsequent boots

### 2. File Sharing
- Standardize on VirtIO-FS
- Use consistent mount tags ("vibecode-share")
- Document guest setup requirements

### 3. Network
- Default to NAT for simplicity
- Provide bridged option for advanced users
- Handle IP assignment consistently

### 4. Guest Tools
- Create guest agent package
- Auto-configure on supported distros
- Provide manual setup documentation

## Implementation Priority

1. **P0**: Fix EFI bootloader persistence (blocks other work)
2. **P1**: VirtIO-FS file sharing (needed for workspaces)
3. **P2**: Network configuration options
4. **P3**: Guest tools package

## References

- [Apple Virtualization.framework](https://developer.apple.com/documentation/virtualization)
- [Tart Documentation](https://tart.run/docs/)
- [UTM Documentation](https://docs.getutm.app/)
- [VirtIO Specification](https://docs.oasis-open.org/virtio/virtio/v1.1/virtio-v1.1.html)

---

**Research Completed**: 2026-01-20
**Status**: Patterns identified, ready for implementation
