# ASIF Disk Image Format for VibeCode VMs

## What is ASIF?

ASIF (Apple Sparse Image Format) is a new disk image format introduced in macOS 26 Tahoe that provides **near-native performance** for virtual machine disk operations.

Source: [The Eclectic Light Company - macOS Tahoe brings a new disk image format](https://eclecticlight.co/2025/06/12/macos-tahoe-brings-a-new-disk-image-format/)

## Performance Comparison

Based on testing on Apple silicon Macs with 2TB internal SSDs:

| Format | Read Speed | Write Speed | Use Case |
|--------|-----------|-------------|----------|
| **ASIF** | 5.5-5.8 GB/s | 6.6-8.3 GB/s | **Recommended for Tahoe VMs** |
| RAW (UDRW) | 2-3 GB/s | 1-2 GB/s | Standard, compatible |
| UDSP (Sparse) | ~1 GB/s | ~100 MB/s | Legacy, slow |

**ASIF is 2-3x faster than RAW images!**

## Key Features

1. **Sparse File in APFS**
   - Only uses disk space for actual data
   - Grows automatically as needed
   - Benefits from APFS filesystem features

2. **Near-Native Performance**
   - 5.8 GB/s read, 6.6 GB/s write (unencrypted)
   - 4.8 GB/s read, 4.6 GB/s write (encrypted)
   - Much faster than previous formats

3. **Single File Backing Store**
   - Unlike sparse bundles (multiple files)
   - Easier to manage and transfer
   - Better performance

4. **Backward Compatibility**
   - Can be read on macOS Sequoia 15.5+
   - Can only be created on Tahoe (26+)
   - UTI type: `com.apple.disk-image-sparse`

## Creating ASIF Images

### Using diskutil (Tahoe only)

```bash
diskutil image create blank \
  --format ASIF \
  --size 100G \
  --volumeName myVolume \
  imagePath
```

### Converting from RAW

```bash
diskutil image create \
  --format ASIF \
  --from /path/to/existing.img \
  /path/to/new.asif
```

## VibeCode Implementation

### Automatic Format Detection

VibeCode will automatically use the best format for your macOS version:

- **macOS 26 Tahoe+**: ASIF format (fastest)
- **macOS 15 Sequoia and earlier**: RAW format (compatible)

### Code Implementation

```swift
let diskManager = DiskImageManager.shared

// Check what format to use
let format = diskManager.recommendedFormat()
print("Using: \(format.description)")

// Create a new VM disk
try await diskManager.createDiskImage(
    path: "/path/to/vm.asif",
    size: "10G",
    volumeName: "PostgreSQL",
    format: .asif
)

// Convert existing RAW to ASIF
try await diskManager.convertToASIF(
    sourcePath: "/path/to/old.img",
    destinationPath: "/path/to/new.asif"
)
```

### VM Configuration

No changes needed in VZ configuration! ASIF images work transparently:

```swift
let diskAttachment = try VZDiskImageStorageDeviceAttachment(
    url: diskImageURL,  // Can be .img or .asif
    readOnly: false,
    cachingMode: .automatic,
    synchronizationMode: .full
)
```

## Migration Strategy

### For New Installations (Tahoe)

1. Build VMs with ASIF format automatically
2. Enjoy 2-3x faster disk performance
3. No additional configuration needed

### For Existing Installations

1. Keep using RAW images (compatible)
2. Optionally convert to ASIF:
   ```bash
   ./scripts/convert-to-asif.sh
   ```
3. Benefit from faster performance

### Distribution

- **Ship ASIF images** for Tahoe users (fastest)
- **Ship RAW images** for Sequoia users (compatible)
- **Auto-detect** and use appropriate format

## Technical Details

### File Characteristics

- **UTI Type**: `com.apple.disk-image-sparse`
- **Format**: Sparse file in APFS
- **Initial Size**: ~1 GB (empty 100 GB image)
- **Growth**: Automatic as data is written
- **Compression**: Not needed (APFS sparse)

### Virtualization.framework Support

ASIF works with:
- `VZDiskImageStorageDeviceAttachment`
- `VZEFIBootLoader`
- All virtio devices
- Both encrypted and unencrypted volumes

### Storage Efficiency

Empty 100 GB ASIF image:
- **Initial**: < 1 GB on disk
- **After use**: 1.9-3.2 GB
- **With data**: Grows as needed

No manual compaction required (unlike UDSP).

## Compatibility Matrix

| macOS Version | Create ASIF | Read ASIF | Use RAW |
|---------------|-------------|-----------|---------|
| Tahoe 26+ | ✅ Yes | ✅ Yes | ✅ Yes |
| Sequoia 15.5+ | ❌ No | ✅ Yes | ✅ Yes |
| Sequoia 15.0-15.4 | ❌ No | ❌ No | ✅ Yes |
| Sonoma 14.x | ❌ No | ❌ No | ✅ Yes |

## Recommendations

### For VibeCode Development

1. **Primary format in Tahoe**: ASIF
2. **Fallback for older macOS**: RAW
3. **Auto-detect** at build time
4. **Provide conversion tool** for upgrades

### For Distribution

1. **Detect macOS version** on first launch
2. **Use ASIF** if Tahoe or later
3. **Use RAW** for older systems
4. **Provide upgrade path** when user updates macOS

## Performance Benefits for VibeCode

### VM Boot Time
- Faster disk I/O = faster boot
- Better kernel loading
- Quicker service startup

### Database Operations (PostgreSQL)
- 2-3x faster writes
- Better transaction performance
- Improved query execution

### Cache Operations (Valkey)
- Faster persistence
- Better AOF/RDB performance
- Improved snapshot speed

### Development Workflow
- Faster npm install
- Quicker file operations
- Better build performance

## Future Considerations

### When to Use ASIF

✅ **Use ASIF when:**
- Running on macOS 26 Tahoe+
- Need maximum performance
- Building new VMs
- VM is local to Mac

❌ **Use RAW when:**
- Need compatibility with older macOS
- Sharing VMs with pre-Tahoe systems
- VM storage on non-APFS filesystem
- Maximum compatibility required

### API Availability

Currently ASIF requires `diskutil` command:
- No direct API in Virtualization.framework yet
- Apple may add native API in future
- We use `diskutil` via Process()

## References

- [Eclectic Light: ASIF disk image format](https://eclecticlight.co/2025/06/12/macos-tahoe-brings-a-new-disk-image-format/)
- Apple Virtualization.framework documentation
- [Podman comparison](docs/PODMAN_RESEARCH.md) - Uses RAW (older format)

## Conclusion

ASIF is a **major improvement** for VM performance on macOS. VibeCode should:

1. ✅ Use ASIF on Tahoe and later
2. ✅ Fall back to RAW on older systems
3. ✅ Provide automatic detection
4. ✅ Document the performance benefits

**Result**: 2-3x faster VM disk operations for Tahoe users!

