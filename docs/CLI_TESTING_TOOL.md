# CLI Testing Tool for Initramfs Files

## Overview

Created a Swift CLI tool that tests initramfs/cpio files directly with Apple's Virtualization.framework **without requiring GUI apps**. This is perfect for automated testing and CI/CD.

## Files Created

1. **`scripts/test-initramfs-cli.swift`** - Main CLI tool
2. **`scripts/test-all-initramfs.sh`** - Batch testing script
3. **`scripts/README-TEST-INITRAMFS.md`** - Usage documentation

## Quick Start

### Test a single initramfs:

```bash
swift scripts/test-initramfs-cli.swift azure/valkey-standalone-complete.cpio.gz
```

### Test all initramfs files:

```bash
bash scripts/test-all-initramfs.sh 60
```

## Features

✅ **Direct Virtualization.framework usage** - No GUI overhead  
✅ **Automatic kernel detection** - Finds kernel from common locations  
✅ **Real-time console monitoring** - Shows boot progress as it happens  
✅ **IP detection** - Automatically detects when VM gets IP address  
✅ **Boot completion detection** - Detects service startup  
✅ **Console log capture** - Saves output to `/tmp/test-initramfs-console-*.log`  
✅ **Configurable timeout** - Default 60s, customizable  
✅ **Exit codes** - 0 for success, 1 for failure (CI/CD friendly)

## Usage

```bash
swift scripts/test-initramfs-cli.swift <initramfs-path> [kernel-path] [timeout-seconds]
```

**Parameters:**
- `initramfs-path` (required): Path to `.cpio.gz` file
- `kernel-path` (optional): Path to kernel. Auto-detected if not specified
- `timeout-seconds` (optional): Test timeout (default: 60)

## Examples

```bash
# Test Valkey initramfs (auto-detect kernel)
swift scripts/test-initramfs-cli.swift azure/valkey-standalone-complete.cpio.gz

# Test PostgreSQL with custom kernel
swift scripts/test-initramfs-cli.swift \
    azure/postgresql-standalone-final.cpio.gz \
    azure/SwiftUI-Apps/NodeJSVibeCode.app/Contents/Resources/vmlinux-raw

# Test with 90 second timeout
swift scripts/test-initramfs-cli.swift \
    azure/unified-services-restored.cpio.gz \
    "" \
    90
```

## What It Tests

1. ✅ File existence validation
2. ✅ VM configuration creation
3. ✅ Configuration validation
4. ✅ VM boot process
5. ✅ Console output capture
6. ✅ IP address detection
7. ✅ Boot completion indicators

## Output

The tool provides:
- Real-time console output
- IP address detection status
- Boot completion status
- Final summary with last 20 lines
- Console log file path

## Advantages Over GUI Apps

| Feature | GUI Apps | CLI Tool |
|---------|----------|----------|
| Speed | Slower (GUI overhead) | ✅ Faster |
| Scriptability | Limited | ✅ Fully scriptable |
| CI/CD | Difficult | ✅ Perfect for automation |
| Debugging | Harder | ✅ Direct console access |
| Batch testing | Manual | ✅ Automated |

## Requirements

- macOS 13.0+ (Virtualization.framework)
- Swift 5.5+
- Kernel file (auto-detected)

## Integration with Testing

This tool can be used by:
- **Agent 1**: Test all initramfs files to verify they boot
- **Agent 2**: Validate services after boot
- **CI/CD**: Automated testing pipeline
- **Development**: Quick validation during builds

## Next Steps

1. Use this tool to test all initramfs files systematically
2. Identify which initramfs files actually boot successfully
3. Fix any that fail to boot
4. Integrate into automated test suite

