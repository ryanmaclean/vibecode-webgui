# Tart and UTM VZ Implementation Research

Research findings on how Tart and UTM solve VM virtualization problems using Apple's Virtualization.framework.

**Legal Note**: Tart is Fair Source (study only), UTM is Apache 2.0 (can reference). All implementations must be our own code.

## 1. Bootloader / EFI Configuration

### Tart's Approach (Linux VMs)

Tart uses a platform abstraction pattern with protocol-based bootloader creation:

```swift
// Linux.swift - EFI bootloader for Linux guests
func bootLoader(nvramURL: URL) throws -> VZBootLoader {
    let result = VZEFIBootLoader()
    result.variableStore = VZEFIVariableStore(url: nvramURL)
    return result
}
```

**Key patterns:**
- `VZEFIBootLoader` for UEFI-based Linux boot
- `VZEFIVariableStore` persists firmware state at `nvram.bin`
- Platform protocol delegates bootloader creation to OS-specific implementations
- Linux VMs use `VZGenericPlatformConfiguration` (not Mac-specific)

### UTM's Approach

UTM supports both direct kernel boot and EFI boot:

```swift
// Direct kernel boot (legacy)
let linux = VZLinuxBootLoader(kernelURL: kernelURL)
linux.initialRamdiskURL = ramdiskURL
linux.commandLine = "console=hvc0"

// EFI boot (macOS 13+)
let efi = VZEFIBootLoader()
efi.variableStore = VZEFIVariableStore(url: efiVariableStorageURL)
```

**Key patterns:**
- Dual boot path: direct kernel vs UEFI
- `saveData()` creates EFI variable store file if missing
- macOS 13+ required for EFI Linux boot

### Recommendations for VibeCode

1. **Use VZEFIBootLoader** for Linux VMs (not VZLinuxBootLoader)
2. **Create NVRAM file** at VM creation time, not first boot
3. **Store nvram.bin** alongside disk image in VM directory
4. **Initialize EFI variable store** before first boot:
   ```swift
   try VZEFIVariableStore(creatingVariableStoreAt: nvramURL)
   ```

## 2. VirtIO-FS (Directory Sharing)

### Tart's Implementation

Tart's `--dir` option uses VirtIO-FS with a clean parsing pattern:

```swift
// DirectoryShare structure parses: [name:]path[:options]
struct DirectoryShare {
    let name: String?
    let path: URL
    let readOnly: Bool
    let tag: String  // defaults to "com.apple.virtio-fs.automount"
}

// Configuration
func directoryShares() throws -> [VZDirectorySharingDeviceConfiguration] {
    // Group shares by mount tag
    let config = VZVirtioFileSystemDeviceConfiguration(tag: share.tag)

    // Single directory
    config.share = VZSingleDirectoryShare(directory:
        VZSharedDirectory(url: path, readOnly: readOnly))

    // Multiple directories (requires names)
    config.share = VZMultipleDirectoryShare(directories: [
        "name1": VZSharedDirectory(url: path1, readOnly: false),
        "name2": VZSharedDirectory(url: path2, readOnly: true)
    ])
}
```

**Mount tags:**
- Default: `"com.apple.virtio-fs.automount"` - auto-mounts on macOS guests
- Custom tags require manual mounting in Linux guests

**Linux guest mounting:**
```bash
mount -t virtiofs com.apple.virtio-fs.automount /mnt/shared
# Or with custom tag:
mount -t virtiofs my-custom-tag /mnt/project
```

### UTM's Implementation

Similar approach with automatic tag selection:
- macOS guests: `macOSGuestAutomountTag`
- Linux guests: custom tag like "share"

### Recommendations for VibeCode

1. **Use VZVirtioFileSystemDeviceConfiguration** (macOS 12+)
2. **Support both single and multiple directory shares**
3. **Default tag for automation**, custom tags for programmatic control
4. **Document Linux mount command** for users
5. **Consider read-only option** for source code directories

## 3. VM Image Distribution

### Tart's OCI Approach

Tart stores VMs in OCI-compliant container registries:

```bash
# Pull from registry
tart clone ghcr.io/cirruslabs/ubuntu:latest

# Push to registry
tart push my-vm ghcr.io/myorg/my-vm:v1
```

**Implementation components:**
- `Registry.swift` - OCI registry communication
- `Manifest.swift` - OCI manifest handling
- `Layerizer/` - Disk image layer decomposition
- `Authentication.swift` - Registry auth (Docker config compatible)

**Image format:**
- VM stored as OCI layers
- Config, disk, NVRAM as separate blobs
- Standard OCI manifest for metadata

### Alternative for VibeCode

Since we use GitHub, consider:

1. **GitHub Releases** for VM images
   - Upload `.tar.gz` of VM directory
   - Use release assets API for downloads

2. **Git LFS** for smaller images
   - Track `*.img` files
   - Works with existing git workflow

3. **S3/Cloud Storage** for large images
   - Pre-signed URLs for download
   - CDN for global distribution

## 4. SSH / IP Discovery

### Tart's Three-Strategy Approach

```swift
enum IPResolutionStrategy {
    case dhcp   // Parse /var/db/dhcpd_leases
    case arp    // Parse `arp` command output
    case agent  // Query guest agent via socket
}
```

**DHCP Strategy (Default):**
```swift
// Read macOS DHCP lease file
let leaseFile = "/var/db/dhcpd_leases"
// Parse for VM's MAC address
// Return associated IP
```

Lease file format:
```
{
    ip_address=192.168.64.2
    hw_address=1,aa:bb:cc:dd:ee:ff
    identifier=...
    lease=0x12345678
}
```

**ARP Strategy:**
- Runs `arp -a` and parses output
- Works for bridged networking
- Requires network activity to populate ARP table

**Guest Agent Strategy:**
- Most reliable across all networking modes
- Requires agent installed in VM
- Communicates via Unix socket (`control.sock`)

### Recommendations for VibeCode

1. **Primary: DHCP lease parsing**
   ```swift
   func resolveIP(macAddress: String) -> String? {
       let leases = try String(contentsOfFile: "/var/db/dhcpd_leases")
       // Parse lease entries, match MAC, return IP
   }
   ```

2. **Fallback: ARP table**
   ```swift
   let output = shell("arp -a")
   // Parse: "? (192.168.64.2) at aa:bb:cc:dd:ee:ff"
   ```

3. **Retry with timeout**
   - VM may take time to get DHCP lease
   - Poll every 1 second, timeout after 60 seconds

4. **Expose via CLI**
   ```bash
   vibecode vm ip <vm-name>
   ```

## 5. Linux Guest Support

### Tart's Linux Configuration

**Platform setup:**
```swift
struct Linux: Platform {
    func platform(nvramURL: URL, needsNestedVirtualization: Bool)
        throws -> VZPlatformConfiguration
    {
        let config = VZGenericPlatformConfiguration()
        if needsNestedVirtualization {
            // macOS 15+ only
            config.isNestedVirtualizationSupported = true
        }
        return config
    }
}
```

**Device configuration:**
- Graphics: `VZVirtioGraphicsDeviceConfiguration`
- Input: USB keyboard + screen coordinate pointing device
- Storage: Virtio block device with `.cached` mode (prevents corruption)
- Network: `VZNATNetworkDeviceAttachment` or bridged

**Cache mode note:**
```swift
// Linux VMs default to cached mode
caching ?? (vmConfig.os == .linux ? .cached : .automatic)
```

### UTM's Linux Support

- NVMe storage controller (macOS 14+) for better performance
- Multiple display configurations
- Rosetta support for x86 binaries (macOS 13+)

### Recommendations for VibeCode

1. **Use VZGenericPlatformConfiguration** (not Mac platform)
2. **Set disk caching to `.cached`** for Linux
3. **Pre-configure cloud-init** in images for:
   - SSH key injection
   - Network configuration
   - Package installation
4. **Consider Rosetta** for running x86 tools

## Implementation Priority

Based on research, recommended implementation order:

### Phase 1: Boot Reliability
- [ ] Implement proper EFI bootloader initialization
- [ ] Create NVRAM file at VM creation
- [ ] Test with Alpine, Ubuntu, Fedora images

### Phase 2: Directory Sharing
- [ ] Add VirtIO-FS configuration
- [ ] Support `--dir` flag in run command
- [ ] Document Linux mount instructions

### Phase 3: IP Discovery
- [ ] Implement DHCP lease parser
- [ ] Add `vm ip` command
- [ ] Integrate with SSH helper

### Phase 4: Image Distribution
- [ ] Design image format (tarball of VM directory)
- [ ] Implement GitHub Release download
- [ ] Add `vm pull` command

## References

- [Tart Source Code](https://github.com/cirruslabs/tart) (Fair Source - study only)
- [UTM Source Code](https://github.com/utmapp/UTM) (Apache 2.0)
- [Apple Virtualization.framework Documentation](https://developer.apple.com/documentation/virtualization)
- [Tart FAQ - IP Discovery](https://tart.run/faq/)

## Credits

Research conducted to understand patterns used by production VZ tools.
All VibeCode implementations are original MIT-licensed code.
