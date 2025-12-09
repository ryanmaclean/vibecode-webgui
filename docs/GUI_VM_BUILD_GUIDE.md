# VibeCode GUI VM Build Guide

## Quick Start

### Prerequisites
- macOS 14.0+ (Sonoma or later)
- Apple Silicon Mac (ARM64)
- Xcode Command Line Tools: `xcode-select --install`

### Build the App

```bash
cd /Users/ryan.maclean/vibecode-webgui

# Generate the Swift app
python3 scripts/build_gui_linux_vm_swift.py --name VibeCodeServices

# Compile and sign
bash azure/SwiftUI-Apps/build_vibecodeservices.sh

# Run the app
open azure/SwiftUI-Apps/VibeCodeServicesVibeCode.app
```

### What Gets Created

| File | Location | Description |
|------|----------|-------------|
| App Bundle | `azure/SwiftUI-Apps/VibeCodeServicesVibeCode.app` | 188KB macOS app |
| Swift Source | `azure/SwiftUI-Apps/VibeCodeServicesVibeCode.swift` | Generated source |
| Entitlements | `azure/SwiftUI-Apps/VibeCodeServicesVibeCode.entitlements` | Virtualization permissions |
| Build Script | `azure/SwiftUI-Apps/build_vibecodeservices.sh` | Compile + sign script |
| VM Bundle | `~/VibeCode VMs/VibeCodeServices VM.bundle/` | Created at runtime |
| Disk Image | `~/VibeCode VMs/.../Disk.img` | 1GB sparse (0B actual) |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    VibeCodeServicesVibeCode.app              │
│                         (188KB)                              │
├─────────────────────────────────────────────────────────────┤
│  VZLinuxBootLoader                                          │
│  ├── Kernel: azure/linux-kernel-arm64 (45MB)                │
│  └── Initramfs: azure/unified-services-with-datadog.cpio.gz │
├─────────────────────────────────────────────────────────────┤
│  VZVirtualMachineConfiguration                              │
│  ├── CPUs: Half of host (min 1, max allowed)                │
│  ├── Memory: 8GB                                            │
│  ├── Disk: 1GB sparse (ASIF-like)                           │
│  ├── Network: NAT (vmnet)                                   │
│  ├── Graphics: VZVirtioGraphicsDeviceConfiguration          │
│  └── Console: VZVirtioConsoleDeviceSerialPortConfiguration  │
└─────────────────────────────────────────────────────────────┘
```

## Customization

### Change VM Name
```bash
python3 scripts/build_gui_linux_vm_swift.py --name MyCustomVM
bash azure/SwiftUI-Apps/build_mycustomvm.sh
```

### Change Disk Size
Edit `scripts/build_gui_linux_vm_swift.py`, find:
```swift
try diskFileHandle.truncate(atOffset: 1 * 1024 * 1024 * 1024)  // 1GB
```
Change to desired size (e.g., `10 * 1024 * 1024 * 1024` for 10GB).

### Use Different Initramfs
Edit `scripts/build_gui_linux_vm_swift.py`, find:
```swift
private var initramfsPath: String { projectRoot + "/azure/unified-services-with-datadog.cpio.gz" }
```
Change to your preferred initramfs.

## Available Initramfs Images

| Image | Size | Services |
|-------|------|----------|
| `unified-services-with-datadog.cpio.gz` | 81MB | Node.js, Valkey, PostgreSQL, Datadog |
| `unified-services-glibc-fixed.cpio.gz` | 147MB | Full glibc stack |
| `docker-vm.cpio.gz` | 3.1MB | Docker daemon |
| `k3s-base.cpio.gz` | 60MB | K3s Kubernetes |
| `nodejs-backup-*.cpio.gz` | 121MB | Node.js only |

## Troubleshooting

### App doesn't create window
- Ensure `static func main()` is present in the generated Swift
- Check Console.app for errors

### VM doesn't boot
- Verify kernel exists: `ls -la azure/linux-kernel-arm64`
- Verify initramfs exists: `ls -la azure/unified-services-with-datadog.cpio.gz`
- Check entitlements: `codesign -d --entitlements - azure/SwiftUI-Apps/VibeCodeServicesVibeCode.app/Contents/MacOS/VibeCodeServicesVibeCode`

### Disk not sparse
- APFS automatically creates sparse files with `truncate()`
- Verify: `du -sh ~/VibeCode\ VMs/VibeCodeServices\ VM.bundle/Disk.img`
- Should show much less than 1GB

### Network not working
- Check DHCP leases: `cat /var/db/dhcpd_leases`
- VM should get IP in 192.168.64.x range

## Comparison with Apple's Ubuntu.app

| Metric | VibeCodeServices | Ubuntu.app |
|--------|------------------|------------|
| App Size | **188KB** | 276KB |
| Binary Size | **177KB** | ~253KB |
| Disk Format | Sparse (0B actual) | Fixed |
| Boot Method | VZLinuxBootLoader | EFI |
| Installation | None needed | Requires ISO |

## Files Reference

### Generated Files (outside app bundle for signing)
- `azure/SwiftUI-Apps/VibeCodeServicesVibeCode.swift` - Swift source
- `azure/SwiftUI-Apps/VibeCodeServicesVibeCode.entitlements` - Entitlements
- `azure/SwiftUI-Apps/build_vibecodeservices.sh` - Build script

### App Bundle Contents
```
VibeCodeServicesVibeCode.app/
├── Contents/
│   ├── Info.plist
│   ├── MacOS/
│   │   └── VibeCodeServicesVibeCode (177KB binary)
│   └── Resources/
│       └── (empty)
```

### Runtime VM Bundle
```
~/VibeCode VMs/VibeCodeServices VM.bundle/
└── Disk.img (1GB sparse, 0B actual)
```

## Development

### Rebuild After Changes
```bash
# Clean and rebuild
rm -rf azure/SwiftUI-Apps/VibeCodeServicesVibeCode.app
rm -rf ~/VibeCode\ VMs/VibeCodeServices\ VM.bundle/
python3 scripts/build_gui_linux_vm_swift.py --name VibeCodeServices
bash azure/SwiftUI-Apps/build_vibecodeservices.sh
open azure/SwiftUI-Apps/VibeCodeServicesVibeCode.app
```

### Debug Mode
Run from terminal to see output:
```bash
azure/SwiftUI-Apps/VibeCodeServicesVibeCode.app/Contents/MacOS/VibeCodeServicesVibeCode
```

### Check VM Process
```bash
ps aux | grep -E "VibeCodeServices|Virtualization.VirtualMachine"
```

## Key Fixes Applied

1. **NSApplication Run Loop**: Added `static func main()` to start the app
2. **Disk Creation**: Create empty file before `truncate()` for sparse disk
3. **Code Signing**: Move source/entitlements outside app bundle
4. **Entitlements**: Removed sandbox (needs filesystem access)
5. **Serial Console**: Added for boot output debugging

---

*Generated by `scripts/build_gui_linux_vm_swift.py` with Datadog tracing*


