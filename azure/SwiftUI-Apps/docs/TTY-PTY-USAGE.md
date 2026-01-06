# TTY/PTY Terminal Access for VMs

## Overview

VibeCode now supports interactive terminal access to VMs through PTY (pseudo-terminal) functionality. This enables bidirectional terminal communication between the host and VM guest, allowing for:

- **Interactive shell sessions** - Full terminal access to the VM
- **Terminal emulation** - Support for xterm, vt100, and other terminal types
- **Control sequences** - Proper handling of Ctrl+C, Ctrl+Z, and other terminal controls
- **Terminal resize** - Dynamic window size updates
- **Debugging and administration** - Direct access to VM for troubleshooting

## Architecture

### Components

1. **PTYManager.swift** - Core PTY management class
   - Creates and manages master/slave PTY pairs
   - Handles terminal I/O operations
   - Supports terminal resize events
   - Provides file handles for VM serial port attachment

2. **BaseVMManager.swift** - Enhanced with PTY support
   - Template method `enablePTY()` for subclasses to enable PTY mode
   - Automatic PTY configuration when enabled
   - Provides `getPTYPath()` to retrieve PTY device path

3. **connect-vm-terminal.sh** - Terminal connection script
   - Auto-detects PTY devices
   - Supports multiple terminal tools (screen, tmux, minicom)
   - Interactive device selection
   - Terminal resize handling

4. **vm-terminal-resize.sh** - Terminal resize helper
   - Monitors for SIGWINCH signals
   - Propagates terminal size changes to VM PTY

## Usage

### Enabling PTY in Your VM Manager

To enable PTY mode, override the `enablePTY()` method in your VM manager:

```swift
final class MyVMManager: BaseVMManager {
    override func enablePTY() -> Bool {
        return true  // Enable PTY for interactive terminal
    }
}
```

### Starting a VM with PTY

```swift
let vmManager = MyVMManager()
vmManager.startVM()

// After VM starts, get PTY path
if let ptyPath = vmManager.getPTYPath() {
    print("Connect to VM: screen \(ptyPath)")
}
```

### Connecting to VM Console

#### Method 1: Using the connect-vm-terminal.sh script (Recommended)

```bash
# Auto-detect and connect
bash scripts/connect-vm-terminal.sh --auto

# Connect to specific PTY
bash scripts/connect-vm-terminal.sh /dev/ttys001

# List available PTY devices
bash scripts/connect-vm-terminal.sh --list

# Use tmux instead of screen
bash scripts/connect-vm-terminal.sh --tmux --auto
```

#### Method 2: Direct screen connection

```bash
screen /dev/ttys001
```

#### Method 3: Direct tmux connection

```bash
tmux new-session -s vm-console "cat /dev/ttys001"
```

### Terminal Controls

#### With GNU screen (default)
- **Ctrl+A, D** - Detach from screen session (leave VM running)
- **Ctrl+A, K** - Kill screen session
- **Ctrl+C** - Send interrupt to VM
- **Ctrl+D** - Send EOF to VM

#### With tmux
- **Ctrl+B, D** - Detach from tmux session
- **Ctrl+B, X** - Kill tmux pane
- **Ctrl+C** - Send interrupt to VM
- **Ctrl+D** - Send EOF to VM

### Terminal Resize

Terminal resize is handled automatically by most terminal emulators. The PTY manager supports the `setWindowSize()` method:

```swift
// Set terminal size (rows x cols)
try ptyManager.setWindowSize(rows: 24, cols: 80)
```

For manual resize monitoring, use the helper script:

```bash
bash scripts/vm-terminal-resize.sh /dev/ttys001 &
```

## Examples

### Example 1: Basic PTY VM Manager

```swift
// PTYTestVMManager.swift
final class PTYTestVMManager: BaseVMManager {
    override func enablePTY() -> Bool {
        return true
    }

    override func onVMStarted() {
        super.onVMStarted()

        if let ptyPath = getPTYPath() {
            print("VM console: \(ptyPath)")
            print("Connect with: screen \(ptyPath)")
        }
    }
}
```

### Example 2: SwiftUI App with PTY

```swift
// PTYTestVibeCodeApp.swift
@main
struct PTYTestVibeCodeApp: App {
    @StateObject private var vmManager = PTYTestVMManager()

    var body: some Scene {
        WindowGroup {
            VStack {
                if let ptyPath = vmManager.getPTYPath() {
                    Text("PTY: \(ptyPath)")
                        .textSelection(.enabled)
                }

                Button("Start VM") {
                    vmManager.startVM()
                }
            }
        }
    }
}
```

### Example 3: Programmatic PTY Access

```swift
// Create and open PTY
let ptyManager = PTYManager()
try ptyManager.openPTY()

// Get file handles for VM
let readHandle = ptyManager.getSlaveReadHandle()
let writeHandle = ptyManager.getSlaveWriteHandle()

// Configure VM serial port
let serial = VZVirtioConsoleDeviceSerialPortConfiguration()
serial.attachment = VZFileHandleSerialPortAttachment(
    fileHandleForReading: readHandle,
    fileHandleForWriting: writeHandle
)

// Start terminal session
ptyManager.startSession { data in
    print("Received from VM: \(String(data: data, encoding: .utf8) ?? "")")
}

// Write to VM
try ptyManager.writeToVM("ls -la\n")

// Clean up
ptyManager.closePTY()
```

## PTY vs File-Based Logging

### File-Based Logging (Default)

- **Use case:** Passive monitoring, log collection
- **Direction:** Unidirectional (VM → Host)
- **Access:** Read log files in `/tmp/vibecode-console-*.log`
- **Pros:** Simple, persistent logs, no terminal required
- **Cons:** No input to VM, delayed output

### PTY Mode

- **Use case:** Interactive sessions, debugging, administration
- **Direction:** Bidirectional (VM ↔ Host)
- **Access:** Direct terminal connection via PTY device
- **Pros:** Interactive, real-time, full terminal features
- **Cons:** No persistent logs (unless using screen -L)

## Troubleshooting

### PTY device not found

```bash
# List available PTY devices
ls -l /dev/ttys*

# Check for recent devices
ls -lt /dev/ttys* | head -10
```

### Permission denied

```bash
# Check permissions
ls -l /dev/ttys001

# Fix permissions (if needed)
sudo chmod 666 /dev/ttys001
```

### Cannot connect to PTY

1. Verify VM is running with PTY enabled
2. Check that `getPTYPath()` returns a valid path
3. Ensure PTY device exists: `ls -l /dev/ttysXXX`
4. Try different terminal tool: screen, tmux, or minicom

### No output from VM

1. Check kernel command line includes `console=hvc0`
2. Verify VM is booting correctly (check logs)
3. Try sending input: `echo "ls" > /dev/ttysXXX`
4. Check VM serial port configuration

### Terminal resize not working

1. Ensure terminal emulator supports SIGWINCH
2. Use `stty size` to verify terminal dimensions
3. Try manual resize: `stty rows 24 cols 80 < /dev/ttysXXX`
4. Use resize helper script: `bash scripts/vm-terminal-resize.sh /dev/ttysXXX`

## API Reference

### PTYManager

```swift
class PTYManager {
    // Open PTY pair
    func openPTY() throws

    // Close PTY pair
    func closePTY()

    // Start terminal session with callback
    func startSession(onDataReceived: @escaping (Data) -> Void)

    // Stop terminal session
    func stopSession()

    // Write data to VM
    func writeToVM(_ data: Data) throws
    func writeToVM(_ string: String) throws

    // Get file handles for VM configuration
    func getSlaveReadHandle() -> FileHandle?
    func getSlaveWriteHandle() -> FileHandle?

    // Get PTY device path
    func getSlavePath() -> String?

    // Set terminal window size
    func setWindowSize(rows: UInt16, cols: UInt16) throws
}
```

### BaseVMManager

```swift
class BaseVMManager {
    // Template method: Enable PTY mode
    func enablePTY() -> Bool

    // Get PTY device path (nil if PTY not enabled)
    func getPTYPath() -> String?
}
```

## Security Considerations

1. **PTY Permissions** - PTY devices should have appropriate permissions (600 or 660)
2. **Input Validation** - Be cautious with user input sent to VM
3. **Session Management** - Always close PTY sessions when done
4. **Access Control** - Restrict access to PTY devices to authorized users
5. **Logging** - Consider logging PTY sessions for audit purposes

## Performance

- **Latency:** PTY provides near real-time communication (<1ms typical)
- **Throughput:** Limited by serial console speed (typically 115200 baud equivalent)
- **CPU Impact:** Minimal overhead (<1% CPU for typical terminal I/O)
- **Memory:** ~4KB buffer per PTY pair

## Limitations

1. **Single Console** - Each VM has one serial console (one PTY)
2. **No Graphics** - Text-only terminal interface
3. **No Copy/Paste** - Depends on terminal emulator support
4. **Terminal Type** - VM must support the terminal type (xterm, vt100, etc.)

## Advanced Topics

### Custom Terminal Handlers

You can implement custom terminal handlers by extending PTYManager:

```swift
class CustomPTYManager: PTYManager {
    override func handleMasterInput() {
        // Custom input processing
        super.handleMasterInput()
    }
}
```

### Multiple Serial Ports

While BaseVMManager supports one console, you can add additional serial ports:

```swift
// Add second serial port for custom communication
let serial2 = VZVirtioConsoleDeviceSerialPortConfiguration()
serial2.attachment = VZFileHandleSerialPortAttachment(...)
config.serialPorts.append(serial2)
```

### PTY Logging

Capture PTY session to file:

```bash
# With screen (automatic with -L flag)
screen -L -S vm-session /dev/ttys001

# With script command
script -q /tmp/vm-session.log
screen /dev/ttys001
```

## Related Scripts

- **connect-vm-terminal.sh** - Main terminal connection script
- **vm-terminal-resize.sh** - Terminal resize handler
- **view-vm-logs.sh** - View file-based console logs

## References

- Apple Virtualization Framework: [VZVirtioConsoleDeviceSerialPortConfiguration](https://developer.apple.com/documentation/virtualization/vzvirtioconsoledeviceserialportconfiguration)
- Apple Virtualization Framework: [VZFileHandleSerialPortAttachment](https://developer.apple.com/documentation/virtualization/vzfilehandleserialportattachment)
- POSIX PTY: `man 4 pty`
- Terminal Control: `man termios`

## See Also

- `Shared/Core/PTYManager.swift` - PTY implementation
- `Shared/Core/BaseVMManager.swift` - VM manager with PTY support
- `Apps/PTYTestVibeCodeApp/` - Example PTY application
- `scripts/connect-vm-terminal.sh` - Connection script
- `docs/ARCHITECTURE.md` - Overall system architecture
