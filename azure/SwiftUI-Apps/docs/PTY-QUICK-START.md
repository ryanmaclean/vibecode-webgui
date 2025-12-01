# PTY Terminal Access - Quick Start Guide

## 5-Minute Setup

### 1. Enable PTY in Your VM Manager

```swift
// YourVMManager.swift
final class YourVMManager: BaseVMManager {
    override func enablePTY() -> Bool {
        return true  // ← Add this line
    }
}
```

### 2. Start Your VM

```swift
let vm = YourVMManager()
vm.startVM()
```

### 3. Connect to VM Console

```bash
# Auto-connect to VM terminal
bash scripts/connect-vm-terminal.sh --auto
```

That's it! You now have an interactive terminal to your VM.

---

## Common Commands

### Connection

```bash
# Auto-detect and connect
./scripts/connect-vm-terminal.sh --auto

# Connect to specific device
./scripts/connect-vm-terminal.sh /dev/ttys001

# List available devices
./scripts/connect-vm-terminal.sh --list

# Use tmux instead of screen
./scripts/connect-vm-terminal.sh --tmux --auto
```

### Terminal Controls

| Action | Screen | tmux |
|--------|--------|------|
| Detach | `Ctrl+A, D` | `Ctrl+B, D` |
| Kill | `Ctrl+A, K` | `Ctrl+B, X` |
| Interrupt VM | `Ctrl+C` | `Ctrl+C` |
| EOF to VM | `Ctrl+D` | `Ctrl+D` |

### Get PTY Path in Swift

```swift
if let ptyPath = vmManager.getPTYPath() {
    print("Connect with: screen \(ptyPath)")
}
```

---

## Example Output

```
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║         VibeCode VM Terminal Connection               ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝

[SUCCESS] Using PTY device: /dev/ttys002
[INFO] Connecting to /dev/ttys002 with GNU screen...

[    0.000000] Linux version 6.1.0
[    0.010000] BIOS-provided physical RAM map:
...
login: root
Password:
# █
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "PTY device not found" | Ensure VM is started with `enablePTY() = true` |
| "Permission denied" | Run with `sudo` or fix device permissions |
| "No output from VM" | Check kernel command line includes `console=hvc0` |
| Terminal size wrong | Use `stty rows 24 cols 80 < /dev/ttysXXX` |

---

## Full Documentation

See [TTY-PTY-USAGE.md](./TTY-PTY-USAGE.md) for complete documentation.

## Example Apps

- **PTYTestVibeCodeApp** - Full example with SwiftUI interface
- See: `Apps/PTYTestVibeCodeApp/`

## Support

- File issues on GitHub
- Check logs: `ls -l /tmp/vibecode-*`
- View VM logs: `./scripts/view-vm-logs.sh`
