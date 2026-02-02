# VibeCode VM - Native macOS Implementation

Native macOS virtual machine using Apple's Virtualization.framework for running VibeCode workspaces.

## Features

- **Native Apple Silicon**: Uses Virtualization.framework (no Docker required)
- **Fast Boot**: Sub-2-second startup with optimized Linux kernel
- **Lightweight**: 4GB RAM, 4 CPU cores, 20GB disk
- **Integrated**: Seamless macOS integration with launchd service

## Requirements

- macOS 13.0 (Ventura) or later
- Apple Silicon (M1/M2/M3) or Intel with VT-x
- Xcode Command Line Tools: `xcode-select --install`

## Quick Start

```bash
# One-command install
./scripts/macos-vm/install.sh

# Manual start
./bin/vibecode-vm

# Access code-server
open http://localhost:8080
```

## Installation Steps

### 1. Download Kernel Components
```bash
./scripts/macos-vm/download-kernel.sh
```

Downloads Linux kernel (34MB) and initramfs (8.3MB) to `~/.vibecode/vm/`

### 2. Build Native Binary
```bash
./scripts/macos-vm/build.sh
```

Compiles Swift code to `bin/vibecode-vm`

### 3. Run VM
```bash
./bin/vibecode-vm
```

## Service Management

### Install as LaunchAgent
```bash
launchctl load ~/Library/LaunchAgents/com.vibecode.vm.plist
launchctl start com.vibecode.vm
```

### Check Status
```bash
launchctl list | grep vibecode
tail -f ~/.vibecode/vm/stdout.log
```

### Stop Service
```bash
launchctl stop com.vibecode.vm
launchctl unload ~/Library/LaunchAgents/com.vibecode.vm.plist
```

## Architecture

```text
┌─────────────────────────────────────┐
│  Code-Server (Port 8080)            │
│  - VS Code Web Interface            │
├─────────────────────────────────────┤
│  Linux Guest (Alpine/Ubuntu)        │
│  - Container filesystem             │
├─────────────────────────────────────┤
│  Virtualization.framework           │
│  - Native Apple hypervisor          │
│  - VirtIO devices                   │
├─────────────────────────────────────┤
│  macOS Host (Ventura+)              │
│  - Apple Silicon / Intel            │
└─────────────────────────────────────┘
```

## Configuration

VM settings in `Sources/main.swift`:

```swift
config.cpuCount = 4              // CPU cores
config.memorySize = 4GB          // RAM
diskSizeGB = 20                  // Disk size
```

## Files

- `~/.vibecode/vm/vmlinuz` - Linux kernel (34MB)
- `~/.vibecode/vm/initramfs` - Initial ramdisk (8.3MB)
- `~/.vibecode/vm/disk.img` - VM disk image (20GB)
- `~/.vibecode/vm/*.log` - VM logs

## Troubleshooting

### VM won't start
```bash
# Check logs
cat ~/.vibecode/vm/stderr.log

# Verify kernel files
ls -lh ~/.vibecode/vm/vmlinuz ~/.vibecode/vm/initramfs

# Re-download kernel
rm -rf ~/.vibecode/vm
./scripts/macos-vm/download-kernel.sh
```

### Port 8080 already in use
```bash
# Find process
lsof -ti:8080

# Kill process
kill $(lsof -ti:8080)
```

### Rebuild from scratch
```bash
# Clean build
rm -rf macos-vm/.build bin/vibecode-vm

# Rebuild
./scripts/macos-vm/build.sh
```

## Development

### Build for debugging
```bash
swift build --package-path macos-vm
macos-vm/.build/debug/vibecode-vm
```

### Run directly with Swift
```bash
swift run --package-path macos-vm
```

### Modify VM configuration
Edit `macos-vm/Sources/main.swift` and rebuild.

## Performance

Expected metrics on Apple Silicon:

- **Boot Time**: < 2 seconds
- **Memory**: 4GB (configurable)
- **CPU Overhead**: < 5%
- **Disk I/O**: Native NVMe speeds

## Comparison

| Feature | Docker Desktop | VibeCode VM |
|---------|---------------|-------------|
| Hypervisor | HyperKit/QEMU | Virtualization.framework |
| Boot Time | 10-30s | < 2s |
| Memory | 6-8GB | 4GB |
| Native | No | Yes |
| License | Proprietary | MIT |

## License

MIT - See root LICENSE file
