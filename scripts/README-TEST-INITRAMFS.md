# Testing Initramfs Files with CLI Tool

Quick CLI way to test initramfs/cpio files with Apple's Virtualization.framework without GUI apps.

## Quick Start

### Test a single initramfs file:

```bash
swift scripts/test-initramfs-cli.swift azure/valkey-standalone-complete.cpio.gz
```

### Test with custom kernel and timeout:

```bash
swift scripts/test-initramfs-cli.swift \
    azure/postgresql-standalone-final.cpio.gz \
    azure/SwiftUI-Apps/NodeJSVibeCode.app/Contents/Resources/vmlinux-raw \
    90
```

### Test all initramfs files:

```bash
bash scripts/test-all-initramfs.sh 60
```

## Usage

```
swift scripts/test-initramfs-cli.swift <initramfs-path> [kernel-path] [timeout-seconds]
```

**Parameters:**
- `initramfs-path` (required): Path to the `.cpio.gz` file to test
- `kernel-path` (optional): Path to kernel file. If not specified, searches common locations
- `timeout-seconds` (optional): Test timeout in seconds (default: 60)

## What It Does

1. ✅ Validates initramfs and kernel files exist
2. ✅ Creates VM configuration using Virtualization.framework
3. ✅ Boots the VM with the initramfs
4. ✅ Captures console output to `/tmp/test-initramfs-console-*.log`
5. ✅ Monitors for:
   - IP address detection
   - Boot completion indicators
   - Service startup messages
6. ✅ Reports test results

## Output

The tool shows:
- Real-time console output as VM boots
- IP address detection
- Boot completion status
- Final summary with last 20 lines of console

## Examples

### Test Valkey initramfs:
```bash
swift scripts/test-initramfs-cli.swift azure/valkey-standalone-complete.cpio.gz
```

### Test PostgreSQL initramfs with 90s timeout:
```bash
swift scripts/test-initramfs-cli.swift \
    azure/postgresql-standalone-final.cpio.gz \
    "" \
    90
```

### Test Unified VM initramfs:
```bash
swift scripts/test-initramfs-cli.swift azure/unified-services-restored.cpio.gz
```

## Advantages Over GUI Apps

- ✅ **Faster**: No GUI overhead
- ✅ **Scriptable**: Can be used in CI/CD
- ✅ **Automated**: Test multiple initramfs files in batch
- ✅ **Direct**: Uses Virtualization.framework directly
- ✅ **Debuggable**: Console output captured to file

## Requirements

- macOS 13.0+ (for Virtualization.framework)
- Swift 5.5+
- Kernel file (auto-detected from common locations)

## Exit Codes

- `0`: Test passed (IP detected or boot complete)
- `1`: Test failed (VM didn't boot, errors, etc.)

## Console Logs

Console output is saved to:
```
/tmp/test-initramfs-console-<UUID>.log
```

Each test run creates a new log file with a unique UUID.

