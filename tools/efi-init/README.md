# EFI NVRAM Initialization Tool

Creates properly initialized EFI variable stores for VMs using Apple's Virtualization.framework.

## Requirements

- macOS 13.0 (Ventura) or later
- Swift 5.9+
- Apple Virtualization.framework (included with macOS)

## Building

```bash
cd tools/efi-init
swift build -c release
```

The binary will be at `.build/release/efi-init`.

## Usage

### Create New EFI NVRAM

```bash
swift run efi-init vm-efi.nvram
```

Or use the wrapper script:
```bash
./scripts/init-efi-nvram.sh vm-efi.nvram
```

### Validate Existing EFI NVRAM

```bash
swift run efi-init --validate vm-efi.nvram
```

### Force Recreate

```bash
swift run efi-init --force vm-efi.nvram
```

## How It Works

This tool uses Apple's `VZEFIVariableStore` API to create properly initialized EFI NVRAM files:

```swift
// Create valid EFI variable store
try VZEFIVariableStore(creatingVariableStoreAt: url)
```

This is the **correct** way to create NVRAM files for use with `VZEFIBootLoader`.

### Why Not dd or cp?

**DON'T** use these methods:

```bash
# ❌ WRONG - Creates empty file with no EFI structure
dd if=/dev/zero of=vm-efi.nvram bs=1m count=64

# ❌ WRONG - Template has no boot entries for this VM
cp /System/Library/Frameworks/Virtualization.framework/Resources/UEFI/OVMF_VARS.fd vm-efi.nvram
```

These create invalid NVRAM files that cause "invalid bootloader" errors.

## Output

```
🔧 Creating EFI variable store...
✅ EFI variable store created successfully
   Path: /path/to/vm-efi.nvram
   Size: 131072 bytes (128 KB)
✅ EFI variable store validated - ready for use with VZEFIBootLoader
```

## Integration

This tool is used by:
- `scripts/rebuild-all-vms-with-services.sh` - VM build script
- `scripts/fix-vm-efi.sh` - Fix existing VMs
- `scripts/init-efi-nvram.sh` - Wrapper script

## Notes

- Creates 128KB EFI variable store files
- Files are compatible with VZEFIBootLoader
- Works with Alpine Linux, Fedora, Ubuntu, etc.
- NVRAM stores boot configuration and variables

## See Also

- [EFI Boot Configuration Guide](../../docs/guides/EFI_BOOT_CONFIGURATION.md)
- [TEAM1 EFI Boot Mission Report](../../docs/TEAM1_EFI_BOOT_MISSION_REPORT.md)
