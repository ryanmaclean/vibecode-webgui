# macOS Native VM - Troubleshooting Guide

## Quick Diagnostics

Run the automated health check:

```bash
./scripts/macos-vm/test-vm.sh
```

This will check:
- ✅ Platform compatibility
- ✅ Dependencies installed
- ✅ File structure
- ✅ Build status
- ✅ Kernel components
- ✅ Runtime functionality

## Common Issues

### 1. VM Won't Start

#### Symptom
```
Fatal error: Kernel not found. Run: ./scripts/macos-vm/download-kernel.sh
```

#### Solution
Download kernel components:
```bash
./scripts/macos-vm/download-kernel.sh
```

#### Verification
```bash
ls -lh ~/.vibecode/vm/
# Should show:
# vmlinuz (34MB)
# initramfs (8.3MB)
```

---

### 2. Build Fails

#### Symptom
```
error: The package dependency graph could not be resolved
```

#### Solutions

**A. Update Xcode Command Line Tools**
```bash
# Remove old tools
sudo rm -rf /Library/Developer/CommandLineTools

# Reinstall
xcode-select --install
```

**B. Clear Swift build cache**
```bash
rm -rf macos-vm/.build
swift package clean --package-path macos-vm
```

**C. Update Swift**
```bash
# Check Swift version
swift --version

# Should be Swift 5.9+
# If not, install via Xcode or Swift.org
```

---

### 3. Permission Denied

#### Symptom
```
zsh: permission denied: ./bin/vibecode-vm
```

#### Solution
Make binary executable:
```bash
chmod +x bin/vibecode-vm
chmod +x scripts/macos-vm/*.sh
```

---

### 4. macOS Version Too Old

#### Symptom
```
error: 'Virtualization' is only available in macOS 11.0 or newer
```

#### Solution
Virtualization.framework requires macOS 11+, optimized for 13+:

```bash
# Check macOS version
sw_vers -productVersion

# Upgrade if needed
# System Settings → General → Software Update
```

**Minimum Requirements:**
- macOS 11.0: Basic support
- macOS 12.0: Improved graphics
- macOS 13.0: **Recommended** (Rosetta 2, shared folders)
- macOS 14.0: Latest features

---

### 5. Port 8080 Already in Use

#### Symptom
```
Error: Port 8080 is already in use
```

#### Solution

**A. Find and kill process:**
```bash
lsof -ti:8080 | xargs kill
```

**B. Or use different port (requires code modification):**
```swift
// In Sources/main.swift
// Modify network configuration to use different port
```

---

### 6. Slow Boot Time

#### Symptom
VM takes > 5 seconds to boot

#### Diagnostics
```bash
# Run benchmark
./scripts/macos-vm/benchmark.sh

# Check results
cat ~/.vibecode/vm/benchmark-results.json
```

#### Solutions

**A. Check disk performance:**
```bash
# Test disk speed
dd if=/dev/zero of=/tmp/testfile bs=1M count=1024 conv=fdatasync
rm /tmp/testfile
```

**B. Reduce CPU contention:**
```bash
# Check CPU usage
top -l 1 | grep "CPU usage"

# Close resource-intensive apps
```

**C. Re-create disk image:**
```bash
rm ~/.vibecode/vm/disk.img
# Will be recreated on next boot
```

---

### 7. VM Crashes on Start

#### Symptom
```
❌ VM error: [error description]
```

#### Diagnostics

**Check logs:**
```bash
# If using LaunchAgent
tail -50 ~/.vibecode/vm/stderr.log

# If running directly
./bin/vibecode-vm 2>&1 | tee /tmp/vm-debug.log
```

**Check system logs:**
```bash
# Open Console.app
# Filter: process:com.apple.virtualization
```

#### Solutions

**A. Corrupted kernel/initramfs:**
```bash
rm -rf ~/.vibecode/vm/vmlinuz ~/.vibecode/vm/initramfs
./scripts/macos-vm/download-kernel.sh
```

**B. Corrupted disk image:**
```bash
rm ~/.vibecode/vm/disk.img
# Will be recreated on next boot
```

**C. Insufficient memory:**
```bash
# Check available memory
vm_stat | perl -ne '/page size of (\d+)/ and $size=$1; /Pages\s+([^:]+)[^\d]+(\d+)/ and printf("%-16s % 16.2f Mi\n", "$1:", $2 * $size / 1048576);'

# Close memory-intensive apps or reduce VM memory
```

---

### 8. Network Issues

#### Symptom
Cannot access code-server at http://localhost:8080

#### Diagnostics
```bash
# Check if VM is running
ps aux | grep vibecode-vm

# Check port is listening
lsof -i:8080

# Test localhost connectivity
curl -v http://localhost:8080
```

#### Solutions

**A. Firewall blocking:**
```bash
# System Settings → Network → Firewall
# Add vibecode-vm to allowed apps
```

**B. VPN interference:**
```bash
# Temporarily disable VPN and test
```

**C. Restart VM:**
```bash
pkill vibecode-vm
./bin/vibecode-vm
```

---

### 9. LaunchAgent Not Starting

#### Symptom
```
launchctl list | grep vibecode
# No output
```

#### Diagnostics
```bash
# Check plist syntax
plutil -lint ~/Library/LaunchAgents/com.vibecode.vm.plist

# Check permissions
ls -l ~/Library/LaunchAgents/com.vibecode.vm.plist
```

#### Solutions

**A. Fix plist path:**
```bash
# Ensure absolute path to binary
cat ~/Library/LaunchAgents/com.vibecode.vm.plist | grep ProgramArguments -A1
```

**B. Reload service:**
```bash
launchctl unload ~/Library/LaunchAgents/com.vibecode.vm.plist
launchctl load ~/Library/LaunchAgents/com.vibecode.vm.plist
```

**C. Check logs:**
```bash
tail -50 ~/.vibecode/vm/stdout.log
tail -50 ~/.vibecode/vm/stderr.log
```

---

### 10. High CPU Usage

#### Symptom
VM using > 100% CPU when idle

#### Diagnostics
```bash
# Monitor CPU
top -pid $(pgrep vibecode-vm)

# Check VM configuration
# Review Sources/main.swift for CPU allocation
```

#### Solutions

**A. Reduce CPU cores:**
```swift
// In Sources/main.swift
config.cpuCount = min(2, ProcessInfo.processInfo.processorCount)
// Rebuild: ./scripts/macos-vm/build.sh
```

**B. Check for runaway processes in guest:**
```bash
# TODO: Add console access to debug guest
```

---

### 11. Apple Silicon vs Intel Issues

#### Symptom
Binary won't run on different architecture

#### Diagnostics
```bash
# Check binary architecture
file bin/vibecode-vm
lipo -info bin/vibecode-vm

# Check system architecture
uname -m
```

#### Solutions

**A. Build for correct architecture:**
```bash
# On Apple Silicon
swift build --package-path macos-vm -c release --arch arm64

# On Intel
swift build --package-path macos-vm -c release --arch x86_64

# Universal binary (requires both architectures)
# Build on each platform then:
lipo -create \
    bin/vibecode-vm-arm64 \
    bin/vibecode-vm-x86_64 \
    -output bin/vibecode-vm
```

**B. Use Rosetta 2 (Apple Silicon):**
```bash
# Install Rosetta 2
/usr/sbin/softwareupdate --install-rosetta --agree-to-license

# Run Intel binary on Apple Silicon
arch -x86_64 ./bin/vibecode-vm
```

---

## Advanced Debugging

### Enable Verbose Logging

Modify `Sources/main.swift`:

```swift
// Add at start of main()
print("[DEBUG] Starting VibeCode VM")
print("[DEBUG] VM Bundle: \(vmBundlePath)")
print("[DEBUG] Kernel: \(kernelURL())")
print("[DEBUG] Initrd: \(initrdURL())")
```

### Inspect VM Configuration

```swift
// Before config.validate()
print("[DEBUG] CPU Count: \(config.cpuCount)")
print("[DEBUG] Memory: \(config.memorySize / 1024 / 1024 / 1024)GB")
print("[DEBUG] Devices: \(config.storageDevices.count)")
```

### Console Access

Add console output capture:

```swift
// Replace FileHandle-based serial port with custom handler
class ConsoleCapture: NSObject, VZSerialPortAttachmentDelegate {
    func serialPort(_ serialPort: VZSerialPort, 
                   didReceive data: Data) {
        if let str = String(data: data, encoding: .utf8) {
            print("[GUEST] \(str)", terminator: "")
        }
    }
}

// Use in config
let consoleCapture = ConsoleCapture()
let serialPort = VZVirtioConsoleDeviceSerialPortConfiguration()
serialPort.attachment = VZFileHandleSerialPortAttachment(
    fileHandleForReading: FileHandle.standardInput,
    fileHandleForWriting: FileHandle.standardOutput
)
// Add delegate for capturing output
```

### Memory Profiling

```bash
# Use Instruments
xcrun xctrace record --template 'Time Profiler' \
    --launch bin/vibecode-vm \
    --output vm-profile.trace

# Open in Instruments.app
open vm-profile.trace
```

### System Call Tracing

```bash
# Use dtruss (requires SIP disabled or special entitlements)
sudo dtruss -f ./bin/vibecode-vm 2>&1 | tee vm-syscalls.log
```

## Performance Optimization

### 1. Disk I/O

**Use sparse disk images** (default):
- Grows as needed
- Minimal initial space

**Alternative: Pre-allocated disk**:
```swift
// In createDiskImage()
// Replace with pre-allocated version for better performance
let fileHandle = try FileHandle(forWritingTo: url)
try fileHandle.truncate(atOffset: UInt64(sizeBytes))
// Write zeros to pre-allocate
let zeroBuffer = Data(count: 1024 * 1024) // 1MB chunks
for _ in 0..<sizeGB * 1024 {
    try fileHandle.write(contentsOf: zeroBuffer)
}
try fileHandle.close()
```

### 2. CPU Pinning

For better performance, pin CPU cores:

```swift
// Requires additional configuration
// Research: VZVirtualMachineConfiguration CPU affinity
```

### 3. Memory Ballooning

Enable dynamic memory adjustment:

```swift
// Future: VZVirtioTraditionalMemoryBalloonDeviceConfiguration
// Allows guest to return unused memory to host
```

## Health Monitoring

### Create Monitoring Script

```bash
#!/bin/bash
# monitor-vm.sh

while true; do
    clear
    echo "VibeCode VM Health Monitor"
    echo "=========================="
    echo ""
    
    # Check if running
    if pgrep vibecode-vm > /dev/null; then
        echo "Status: ✅ Running"
        
        # Get PID
        VM_PID=$(pgrep vibecode-vm)
        echo "PID: $VM_PID"
        
        # Memory usage
        VM_MEM=$(ps -o rss= -p $VM_PID | awk '{print $1/1024}')
        echo "Memory: ${VM_MEM} MB"
        
        # CPU usage
        VM_CPU=$(ps -o %cpu= -p $VM_PID)
        echo "CPU: ${VM_CPU}%"
        
        # Uptime
        VM_START=$(ps -o lstart= -p $VM_PID)
        echo "Started: $VM_START"
        
        # Network test
        if curl -s http://localhost:8080 > /dev/null; then
            echo "Code-Server: ✅ Accessible"
        else
            echo "Code-Server: ❌ Not accessible"
        fi
    else
        echo "Status: ❌ Not running"
    fi
    
    echo ""
    echo "Press Ctrl+C to exit"
    sleep 5
done
```

## Getting Help

### Collect Diagnostic Information

```bash
#!/bin/bash
# collect-diagnostics.sh

DIAG_DIR="/tmp/vibecode-vm-diagnostics-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$DIAG_DIR"

echo "Collecting diagnostics to $DIAG_DIR..."

# System info
sw_vers > "$DIAG_DIR/system-info.txt"
uname -a >> "$DIAG_DIR/system-info.txt"
sysctl -n machdep.cpu.brand_string >> "$DIAG_DIR/system-info.txt"

# VM files
ls -lR ~/.vibecode/vm > "$DIAG_DIR/vm-files.txt"

# Logs
cp ~/.vibecode/vm/*.log "$DIAG_DIR/" 2>/dev/null || true

# Process info
ps aux | grep vibecode > "$DIAG_DIR/processes.txt"

# Network
lsof -i:8080 > "$DIAG_DIR/network.txt"

# Build info
file bin/vibecode-vm > "$DIAG_DIR/binary-info.txt"

# Package info
cat macos-vm/Package.swift > "$DIAG_DIR/Package.swift"

# Benchmark results
cp ~/.vibecode/vm/benchmark-results.json "$DIAG_DIR/" 2>/dev/null || true

# Create archive
tar czf "$DIAG_DIR.tar.gz" -C /tmp "$(basename "$DIAG_DIR")"

echo "Diagnostics collected: $DIAG_DIR.tar.gz"
echo "Please attach this file when reporting issues"
```

### Reporting Issues

When reporting issues, include:

1. Output from `./scripts/macos-vm/test-vm.sh`
2. Diagnostic archive from script above
3. Steps to reproduce
4. Expected vs actual behavior
5. macOS and Swift versions

### Community Support

- **GitHub Issues**: https://github.com/ryanmaclean/vibecode-webgui/issues
- **Documentation**: See [macos-vm/README.md](README.md)
- **Related Issues**: See [macos-vm/RELATED_ISSUES.md](RELATED_ISSUES.md)

## Related Documentation

- [User Guide](README.md)
- [API Reference](API.md)
- [Benchmarking Guide](BENCHMARKING.md)
- [Integration Guide](INTEGRATION.md)

## License

MIT - See root LICENSE file
