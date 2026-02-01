# Console Logging Feature

**Status**: Partial Implementation
**Feature Audit**: #1530

## Overview

Console logging captures VM boot messages and runtime output to a log file for debugging and monitoring.

## Current Implementation Status

### Implementations with File Logging

| Component | VM Directory | Console Log Path | Method |
|-----------|--------------|------------------|--------|
| `launch_ubuntu_vm.py` | `~/VibeCode/VMs/{name}/` | `~/VibeCode/VMs/{name}/console.log` | Python logging module |
| `vfkit.ts` | `{vmDir}/` | `{vmDir}/logs/console.log` | virtio-serial device |
| `ContainerRuntime.swift` | `{containerDir}/` | `{containerDir}/console.log` | FileHandle write |

### Implementations WITHOUT File Logging

| Component | VM Directory | Console Output | Notes |
|-----------|--------------|----------------|-------|
| `build_gui_linux_vm_swift.py` | `~/VibeCode VMs/{name}.bundle/` | stdout only | Serial console writes to `FileHandle.standardOutput` |

## Details

### Python VM Launcher (`scripts/launch_ubuntu_vm.py`)

Console logging is fully implemented:

```python
# Line 163-174
vm_base_dir = Path.home() / "VibeCode" / "VMs"
vm_dir = vm_base_dir / vm_name
log_file = vm_dir / "console.log"
setup_logging(log_file)
```

Log location: `~/VibeCode/VMs/{vm_name}/console.log`

### TypeScript vfkit Provider (`src/lib/vm/providers/vfkit.ts`)

Uses virtio-serial device for console capture:

```typescript
// Lines 332-342
const consolePath = path.join(vmDir, 'logs/console.log');
'--device', `virtio-serial,logFilePath=${consolePath}`,
```

### Swift GUI Apps (`scripts/build_gui_linux_vm_swift.py`)

**Currently NOT logging to file.** Console output goes to stdout:

```swift
// Lines 286-292
let serialConfig = VZVirtioConsoleDeviceSerialPortConfiguration()
let serialPort = VZFileHandleSerialPortAttachment(
    fileHandleForReading: FileHandle.standardInput,
    fileHandleForWriting: FileHandle.standardOutput  // Goes to stdout, not file
)
```

To capture logs when running Swift GUI apps, launch from Terminal:
```bash
open ~/path/to/App.app 2>&1 | tee ~/VibeCode\ VMs/console.log
```

### Container Runtime (`AppleContainerRuntime/Sources/.../ContainerRuntime.swift`)

Implements log file read/stream operations:

```swift
// Lines 203, 223
let logFile = container.directory.appendingPathComponent("console.log")
```

## Path Discrepancy

There are two different VM directory conventions:

1. **`~/VibeCode VMs/`** (with space) - Used by Swift GUI apps for VM bundles
2. **`~/VibeCode/VMs/`** (no space) - Used by Python launcher for VM instances

The menubar app (`VibeCodeMenubarApp.swift`) references `~/VibeCode/VMs/default/console.log`.

## Kernel Configuration

Console output requires kernel command line parameter:
```
console=hvc0
```

This is configured in all VM launchers.

## Viewing Logs

### For Python-launched VMs
```bash
tail -f ~/VibeCode/VMs/default/console.log
```

### For vfkit-launched VMs
```bash
tail -f ~/.vfkit/vms/{vm_name}/logs/console.log
```

### For Swift GUI Apps
Console output is visible in Terminal if app is launched from command line.

## Related Files

- `scripts/launch_ubuntu_vm.py` - Python VM launcher with logging
- `src/lib/vm/providers/vfkit.ts` - TypeScript vfkit provider
- `scripts/build_gui_linux_vm_swift.py` - Swift GUI app generator
- `platforms/macos/VibeCodeMenubar/Sources/.../VibeCodeMenubarApp.swift` - Menubar console viewer
- `platforms/macos/AppleContainerRuntime/Sources/.../ContainerRuntime.swift` - Container log management
