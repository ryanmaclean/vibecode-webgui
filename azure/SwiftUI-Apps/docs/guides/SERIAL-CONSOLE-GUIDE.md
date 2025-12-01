# Bidirectional Serial Console Guide

## Overview

BasicVibeCodeApp now includes a fully bidirectional serial console that allows interactive shell access to the VM. This enables you to send commands to the VM and receive responses in real-time.

## Implementation Details

### Changes Made

The serial console implementation has been upgraded from write-only to bidirectional using PTY (pseudo-terminal) pairs:

**File: BasicVibeCodeApp.swift**

1. **PTY Creation (lines 177-218)**: Added `createPTY()` method that creates a master/slave PTY pair using POSIX functions:
   - `posix_openpt()` - Opens PTY master
   - `grantpt()` - Grants access to slave
   - `unlockpt()` - Unlocks slave for use
   - `ptsname()` - Gets slave device path (e.g., `/dev/ttys000`)

2. **Serial Port Configuration (lines 246-266)**: Modified to use PTY for bidirectional communication:
   - Changed from `VZFileHandleSerialPortAttachment(fileHandleForReading: nil, fileHandleForWriting: consoleFileHandle)`
   - To: `VZFileHandleSerialPortAttachment(fileHandleForReading: pty.master, fileHandleForWriting: pty.master)`
   - Both reading and writing now use the same PTY master handle

3. **PTY Reading Thread (lines 205-242)**: Added `startPTYReading()` method:
   - Uses GCD's `DispatchSourceRead` to monitor PTY for VM output
   - Reads VM output from PTY and writes to console log file
   - Runs on background queue for non-blocking operation
   - Allows UI to continue displaying console output via timer

4. **Command Sending (lines 185-203)**: Added `sendCommand()` method:
   - Public method to send commands to VM
   - Writes command string + newline to PTY master
   - VM receives input via its serial console

5. **Cleanup (lines 159-183)**: Enhanced `stopVM()` to properly close PTY resources:
   - Cancels PTY read source
   - Closes PTY master and slave file handles

## How to Use

### Method 1: Using `screen` (Built-in macOS Tool)

When you start the VM, look for output like:
```
===========================================
Interactive console available at: /dev/ttys001
Connect using: screen /dev/ttys001
Or use: socat - /dev/ttys001,raw,echo=0
===========================================
```

Connect to the console:
```bash
screen /dev/ttys001
```

To exit screen:
- Press `Ctrl-A` then `k` to kill the session
- Or press `Ctrl-A` then `d` to detach (keeps session running)

### Method 2: Using `socat` (More Control)

Install socat if needed:
```bash
brew install socat
```

Connect to the console:
```bash
socat - /dev/ttys001,raw,echo=0
```

To exit:
- Press `Ctrl-C`

### Method 3: Using `cu` (Classic Unix Tool)

```bash
cu -l /dev/ttys001
```

To exit:
- Type `~.` (tilde then period)

### Method 4: Programmatic Access

You can send commands programmatically using the `sendCommand()` method in Swift:

```swift
// Example: Send a command to the VM
vmManager.sendCommand("ls -la /")
vmManager.sendCommand("ps aux")
vmManager.sendCommand("cat /proc/cpuinfo")
```

## Testing the Console

Once connected, you can interact with the Alpine Linux VM:

```bash
# Check system info
uname -a
cat /etc/os-release

# View running processes
ps aux

# Check network configuration
ip addr show

# Test disk usage
df -h

# View kernel messages
dmesg | tail -20

# Check if OpenVSCode server is running
netstat -tlnp | grep 3000
```

## Features

### Bidirectional Communication
- **VM to Host**: VM output is displayed in real-time
- **Host to VM**: Commands typed in the terminal are sent to the VM

### Non-Blocking Operation
- PTY reading runs on a background thread
- UI remains responsive
- Console output is still captured in the log file for UI display

### Multiple Access Methods
- Direct PTY access via terminal tools
- Programmatic command sending via Swift API
- Console output monitoring in the UI

## Architecture

```
┌─────────────────────────────────────────┐
│         BasicVibeCodeApp                │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │   VM (Virtualization Framework)   │ │
│  │         Serial Console            │ │
│  │          (hvc0)                   │ │
│  └───────────────┬───────────────────┘ │
│                  │                      │
│      ┌───────────▼───────────┐         │
│      │   PTY Master (FD)     │         │
│      │  Read/Write Handle    │         │
│      └───────────┬───────────┘         │
│                  │                      │
│      ┌───────────▼───────────┐         │
│      │   PTY Slave Device    │         │
│      │    /dev/ttysXXX       │         │
│      └───────────────────────┘         │
└─────────────────┬───────────────────────┘
                  │
      ┌───────────▼───────────────┐
      │   Terminal Tools          │
      │  (screen/socat/cu)        │
      │   User Interaction        │
      └───────────────────────────┘
```

## Limitations and Considerations

### 1. PTY Permissions
- The PTY slave device is accessible only by the user running the app
- Requires appropriate file system permissions

### 2. Single Connection
- Only one terminal tool should connect to the PTY at a time
- Multiple connections may cause input/output conflicts

### 3. Terminal Emulation
- The PTY provides basic terminal emulation
- Advanced terminal features (colors, cursor positioning) depend on the client tool

### 4. Console Availability
- PTY is created when VM starts
- PTY is destroyed when VM stops
- Need to reconnect after each VM restart

### 5. Buffer Size
- PTY read buffer is 4096 bytes
- Very large outputs may need multiple reads

### 6. Character Encoding
- Uses UTF-8 encoding
- Non-UTF-8 characters may not display correctly

## Troubleshooting

### Cannot Connect to PTY

**Error**: "Permission denied" when trying to connect

**Solution**: Make sure you're running the terminal command as the same user that started the app

---

**Error**: "Device not configured"

**Solution**: The VM may not be running. Check the app UI to ensure the VM is started.

---

### No Output Visible

**Issue**: Connected to PTY but no output appears

**Solution**:
- The VM may be waiting at a login prompt. Try pressing Enter.
- Check if the kernel boot messages have finished scrolling. Wait a few seconds.

---

### Input Not Working

**Issue**: Can connect and see output but cannot type

**Solution**:
- With `screen`, ensure you're in the right mode (not in copy mode)
- With `socat`, verify you're using the `raw,echo=0` options

---

### PTY Path Changed

**Issue**: The PTY path (e.g., `/dev/ttys001`) changes between restarts

**Solution**: This is normal behavior. Always check the app's console output for the current PTY path.

## Advanced Usage

### Capturing Console Session

Save all console I/O to a file:
```bash
script -a console-session.log socat - /dev/ttys001,raw,echo=0
```

### Automated Command Execution

Send commands without interactive session:
```bash
echo "ls -la /" > /dev/ttys001
```

Or using Swift:
```swift
let commands = ["uname -a", "df -h", "ps aux"]
for cmd in commands {
    vmManager.sendCommand(cmd)
    Thread.sleep(forTimeInterval: 0.5)  // Brief delay between commands
}
```

### Monitoring PTY Activity

Watch for PTY activity in another terminal:
```bash
tail -f /tmp/vibecode-console.log
```

## Security Considerations

1. **PTY Access**: The PTY device file has restricted permissions and is only accessible by the app owner
2. **No Authentication**: The serial console provides direct VM access without authentication
3. **Local Access Only**: PTY is only accessible from the local machine, not over network
4. **Privilege Separation**: VM runs without elevated privileges

## Performance Impact

- **Minimal CPU Usage**: PTY reading is event-driven, not polling-based
- **Low Memory Overhead**: 4KB buffer per read operation
- **No Network Latency**: Direct POSIX file descriptor communication
- **Async Operation**: Non-blocking I/O doesn't impact UI responsiveness

## Future Enhancements

Possible future improvements:
- Add a built-in terminal emulator in the SwiftUI interface
- Implement command history and auto-completion
- Add logging of all serial console activity
- Support for multiple serial ports
- Integration with SSH for secure remote access
