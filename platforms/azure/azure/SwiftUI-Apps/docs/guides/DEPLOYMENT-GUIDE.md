# VibeCode SwiftUI Apps - Deployment Guide

**Version:** 2.0.0
**Last Updated:** 2025-11-25
**Status:** Production Ready

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [System Requirements](#system-requirements)
3. [Build Instructions](#build-instructions)
4. [Deployment Procedures](#deployment-procedures)
5. [Configuration](#configuration)
6. [Troubleshooting](#troubleshooting)
7. [Rollback Procedures](#rollback-procedures)
8. [Monitoring & Observability](#monitoring--observability)

---

## Prerequisites

### Required Software

| Component | Version | Purpose |
|-----------|---------|---------|
| macOS | 13.0+ | Host operating system |
| Xcode | 15.0+ | Swift compiler and SDK |
| Swift | 6.0+ | Programming language |
| Python | 3.9+ | Build automation |
| ddtrace | 2.0+ | Observability (optional) |

### Required Frameworks

All frameworks are included with macOS 13+:
- Virtualization.framework (v259.2.10+)
- SwiftUI.framework (v7.1.13+)
- Combine.framework (v3023.0.0+)
- Network.framework

### Verification

```bash
# Check macOS version
sw_vers

# Check Swift version
swift --version
# Expected: Swift version 6.0 or later

# Check Python version
python3 --version
# Expected: Python 3.9 or later

# Check ddtrace (optional)
python3 -c "import ddtrace; print(ddtrace.__version__)"
# Expected: 2.0 or later
```

---

## System Requirements

### Minimum Requirements

- **Processor:** Apple Silicon (M1, M2, M3, M4)
- **Memory:** 8 GB RAM (2 GB available for VM)
- **Storage:** 2 GB free disk space
- **Display:** 1920x1080 or higher

### Recommended Requirements

- **Processor:** Apple Silicon M2 Pro or better
- **Memory:** 16 GB RAM (4 GB available for VM)
- **Storage:** 10 GB free disk space
- **Display:** 2560x1440 or higher

### Network Requirements

- Internet connection for VM networking (NAT mode)
- Ports 8080, 3000 available for VS Code server
- DHCP service enabled (built-in to Virtualization.framework)

---

## Build Instructions

### Quick Build (Recommended)

```bash
# Clone repository
git clone <repository-url>
cd SwiftUI-Apps

# Build all applications
./build-all-refactored.sh

# Expected output:
# ✓ BasicVibeCodeApp compiled successfully (411 KB)
# ✓ LiquidGlassVibeCodeApp compiled successfully (647 KB)
# ✓ NetworkTestVibeCodeApp compiled successfully (321 KB)
# ✓ NetworkTestCLI compiled successfully (179 KB)
```

### Build Individual Applications

#### 1. BasicVibeCodeApp (Recommended for most users)

```bash
swiftc -O \
  -target arm64-apple-macos13.0 \
  -framework SwiftUI \
  -framework Virtualization \
  -framework Combine \
  BasicVibeCodeApp.swift \
  Apps/BasicVibeCodeApp/BasicVMManager.swift \
  Shared/Core/BaseVMManager.swift \
  Shared/Networking/NetworkingStrategy.swift \
  Shared/Networking/NATNetworkStrategy.swift \
  Shared/Networking/DHCPLeaseMonitor.swift \
  -o BasicVibeCodeApp

# Verify build
ls -lh BasicVibeCodeApp
file BasicVibeCodeApp
otool -L BasicVibeCodeApp | grep Virtualization
```

**Expected output:**
```
-rwxr-xr-x  1 user  staff   411K Nov 25 11:00 BasicVibeCodeApp
BasicVibeCodeApp: Mach-O 64-bit executable arm64
/System/Library/Frameworks/Virtualization.framework/Versions/A/Virtualization
```

#### 2. LiquidGlassVibeCodeApp (Premium UI)

```bash
swiftc -O \
  -target arm64-apple-macos13.0 \
  -framework SwiftUI \
  -framework Virtualization \
  -framework Combine \
  LiquidGlassVibeCodeApp.swift \
  Apps/LiquidGlassVibeCodeApp/LiquidGlassVMManager.swift \
  Shared/Core/BaseVMManager.swift \
  Shared/Networking/NetworkingStrategy.swift \
  Shared/Networking/NATNetworkStrategy.swift \
  Shared/Networking/DHCPLeaseMonitor.swift \
  DatadogLogger.swift \
  DogStatsDClient.swift \
  -o LiquidGlassVibeCodeApp
```

#### 3. NetworkTestVibeCodeApp (Testing)

```bash
swiftc -O \
  -target arm64-apple-macos13.0 \
  -framework SwiftUI \
  -framework Virtualization \
  -framework Combine \
  NetworkTestVibeCodeApp.swift \
  Apps/NetworkTestVibeCodeApp/NetworkTestVMManager.swift \
  Shared/Core/BaseVMManager.swift \
  Shared/Networking/NetworkingStrategy.swift \
  Shared/Networking/NATNetworkStrategy.swift \
  Shared/Networking/DHCPLeaseMonitor.swift \
  -o NetworkTestVibeCodeApp
```

#### 4. NetworkTestCLI (Command-line testing)

```bash
swiftc -O \
  -target arm64-apple-macos13.0 \
  -framework Virtualization \
  -framework Combine \
  NetworkTestCLI.swift \
  -o NetworkTestCLI
```

### Bundle Applications (Optional)

Create signed .app bundles for distribution:

```bash
./bundle-apps.sh

# Creates:
# - BasicVibeCodeApp.app
# - LiquidGlassVibeCodeApp.app
# - NetworkTestVibeCodeApp.app
```

---

## Deployment Procedures

### Local Deployment (Development/Testing)

1. **Build application:**
   ```bash
   ./build-all-refactored.sh
   ```

2. **Verify VM resources:**
   ```bash
   ls -lh Resources/vmlinux-raw
   ls -lh Resources/bun-openvscode.cpio.gz

   # Expected:
   # -rw-r--r--  1 user  staff    15M vmlinux-raw
   # -rw-r--r--  1 user  staff   120M bun-openvscode.cpio.gz
   ```

3. **Run application:**
   ```bash
   ./BasicVibeCodeApp &

   # Monitor startup
   tail -f /tmp/vibecode-console.log
   ```

4. **Verify VM started:**
   ```bash
   # Wait for "Server listening on port 8080" in console
   # Check DHCP lease
   cat /var/db/dhcpd_leases | grep "52:54:00:12:34:90"
   ```

5. **Access application:**
   ```bash
   # Wait for IP address to appear in UI
   # Open browser to http://<vm-ip>:8080
   open http://192.168.64.3:8080
   ```

### Production Deployment

#### Option 1: Direct Executable Deployment

```bash
# Copy executables to deployment location
sudo cp BasicVibeCodeApp /usr/local/bin/
sudo chmod +x /usr/local/bin/BasicVibeCodeApp

# Copy resources
sudo mkdir -p /usr/local/share/vibecode/Resources
sudo cp Resources/* /usr/local/share/vibecode/Resources/

# Create launch script
cat > /usr/local/bin/start-vibecode <<'EOF'
#!/bin/bash
cd /usr/local/share/vibecode
exec /usr/local/bin/BasicVibeCodeApp
EOF
chmod +x /usr/local/bin/start-vibecode

# Run
start-vibecode
```

#### Option 2: .app Bundle Deployment

```bash
# Create .app bundles
./bundle-apps.sh

# Sign applications (if distributing)
codesign --force --sign "Developer ID Application: Your Name" \
  BasicVibeCodeApp.app

# Verify signature
codesign --verify --verbose BasicVibeCodeApp.app
spctl --assess --verbose BasicVibeCodeApp.app

# Distribute
# - Copy to /Applications
# - Create DMG for distribution
# - Notarize with Apple (for external distribution)
```

#### Option 3: LaunchAgent Deployment (Background Service)

```bash
# Create LaunchAgent plist
cat > ~/Library/LaunchAgents/com.vibecode.basicapp.plist <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.vibecode.basicapp</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/BasicVibeCodeApp</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/vibecode-stdout.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/vibecode-stderr.log</string>
</dict>
</plist>
EOF

# Load LaunchAgent
launchctl load ~/Library/LaunchAgents/com.vibecode.basicapp.plist

# Check status
launchctl list | grep vibecode
```

---

## Configuration

### VM Configuration

Edit `Apps/{AppName}/{AppName}VMManager.swift`:

```swift
// CPU count (default: 2)
override func getCPUCount() -> Int {
    return 4  // Change to desired CPU count
}

// Memory size (default: 1 GB)
override func getMemorySize() -> UInt64 {
    return 2 * 1024 * 1024 * 1024  // 2 GB
}

// Kernel command line
override func getKernelCommandLine() -> String {
    return "console=hvc0 debug loglevel=8 ipv6.disable=1"
}
```

### Network Configuration

Edit MAC address for stable DHCP leases:

```swift
// Apps/BasicVibeCodeApp/BasicVMManager.swift
override func createNetworkingStrategy() -> NetworkingStrategy {
    // Use predefined MAC or create custom
    return NATNetworkStrategy(macAddress: "52:54:00:12:34:90")
}
```

### Observability Configuration

Enable Datadog monitoring (LiquidGlassVibeCodeApp):

```swift
// Set environment variables
export DD_SERVICE="vibecode-vm"
export DD_ENV="production"
export DD_VERSION="2.0.0"
export DD_AGENT_HOST="localhost"
export DD_TRACE_AGENT_PORT="8126"

# Run application
./LiquidGlassVibeCodeApp
```

---

## Troubleshooting

### Common Issues

#### 1. Application won't start

**Symptom:** Application crashes immediately or shows error dialog.

**Solution:**
```bash
# Check system requirements
sw_vers | grep ProductVersion
# Must be 13.0+

# Check for missing resources
ls -l Resources/vmlinux-raw Resources/bun-openvscode.cpio.gz

# Check permissions
chmod +x BasicVibeCodeApp
chmod 644 Resources/*

# Run with verbose output
./BasicVibeCodeApp 2>&1 | tee vibecode-debug.log
```

#### 2. VM fails to start

**Symptom:** "VM failed to start" error, VM status shows error.

**Solution:**
```bash
# Check console output
cat /tmp/vibecode-console.log

# Verify kernel/initramfs
file Resources/vmlinux-raw
# Should show: ELF 64-bit LSB executable, ARM aarch64

file Resources/bun-openvscode.cpio.gz
# Should show: gzip compressed data

# Check VM configuration
./NetworkTestVibeCodeApp  # Use network test app to diagnose
```

#### 3. No IP address detected

**Symptom:** VM starts but DHCP IP never appears.

**Solution:**
```bash
# Check DHCP leases manually
sudo cat /var/db/dhcpd_leases

# Check network configuration
grep "MAC" Apps/*/BasicVMManager.swift
# Ensure unique MAC addresses per app

# Restart networking
# Stop VM, wait 10 seconds, restart

# Check for IP conflicts
arp -a | grep "192.168.64"
```

#### 4. Console output not updating

**Symptom:** UI shows blank console or old output.

**Solution:**
```bash
# Check console log file
ls -l /tmp/vibecode-console.log
cat /tmp/vibecode-console.log

# Verify serial console configuration
# Should see "VZVirtioConsoleDeviceSerialPortConfiguration" in logs

# Check file permissions
ls -l /tmp/vibecode-*
chmod 666 /tmp/vibecode-console.log
```

#### 5. Build failures

**Symptom:** Compiler errors during build.

**Solution:**
```bash
# Clean build artifacts
rm -rf .build BasicVibeCodeApp LiquidGlassVibeCodeApp

# Verify Swift version
swift --version
# Must be 6.0+

# Check for syntax errors
swiftc -parse BasicVibeCodeApp.swift

# Build with verbose output
./build-all-refactored.sh 2>&1 | tee build-output.log
```

### Performance Issues

#### VM startup is slow (>30 seconds)

```bash
# Check available memory
vm_stat | head -5

# Check disk I/O
iostat -c 10 3

# Reduce VM memory if needed
# Edit VMManager getCPUCount() and getMemorySize()
```

#### High CPU usage when idle

```bash
# Check VM processes
ps aux | grep -i vm

# Monitor CPU usage
top -pid $(pgrep BasicVibeCodeApp)

# Check for runaway processes in VM
# (View console output)
```

### Debugging Tools

```bash
# Comprehensive diagnostics
./test-vm-functionality.sh

# Performance testing
./performance-test.sh

# Network testing
./NetworkTestCLI

# Manual VM testing
./test-basicvibecode.sh

# Check framework versions
otool -L BasicVibeCodeApp | grep -E "(Virtualization|SwiftUI|Combine)"
```

---

## Rollback Procedures

### Quick Rollback

If deployment fails, rollback to previous version:

```bash
# Stop current application
pkill BasicVibeCodeApp

# Restore from backup
cp BasicVibeCodeApp.backup BasicVibeCodeApp

# Restart
./BasicVibeCodeApp &
```

### Full Rollback

```bash
# Checkout previous git commit
git log --oneline -10
git checkout <previous-commit-hash>

# Rebuild
./build-all-refactored.sh

# Verify
./test-basicvibecode.sh

# If successful, deploy
```

### Rollback Checklist

- [ ] Stop all running applications
- [ ] Backup current deployment
- [ ] Restore previous version
- [ ] Verify VM resources intact
- [ ] Test VM startup
- [ ] Verify network connectivity
- [ ] Check observability (if enabled)
- [ ] Monitor for 30 minutes
- [ ] Document rollback reason

---

## Monitoring & Observability

### Built-in Monitoring

All applications provide console output monitoring:

```bash
# Real-time console output
tail -f /tmp/vibecode-console.log

# Check VM status
cat /tmp/vibecode-status.txt
```

### Datadog Integration (LiquidGlassVibeCodeApp)

```bash
# Enable Datadog
export DD_SERVICE="vibecode-vm"
export DD_ENV="production"
export DD_VERSION="2.0.0"
export DD_AGENT_HOST="localhost"
export DD_TRACE_AGENT_PORT="8126"

# Run with Datadog
./LiquidGlassVibeCodeApp

# Verify metrics in Datadog UI
# - VM lifecycle events
# - DHCP IP detection
# - Console monitoring
# - Performance metrics
```

### Health Checks

```bash
# Check if VM is running
pgrep -f BasicVibeCodeApp
# Non-zero exit code = running

# Check VM IP assigned
grep -q "192.168.64" /tmp/vibecode-status.txt
# Exit code 0 = IP assigned

# Check console for errors
grep -i "error\|fail\|panic" /tmp/vibecode-console.log
# Empty output = no errors
```

### Automated Monitoring Script

```bash
#!/bin/bash
# monitor-vibecode.sh

while true; do
    if ! pgrep -f BasicVibeCodeApp > /dev/null; then
        echo "$(date): VM not running - restarting"
        ./BasicVibeCodeApp &
    fi

    if grep -qi "kernel panic" /tmp/vibecode-console.log; then
        echo "$(date): Kernel panic detected - restarting VM"
        pkill BasicVibeCodeApp
        sleep 5
        ./BasicVibeCodeApp &
    fi

    sleep 30
done
```

---

## Production Checklist

Before deploying to production:

- [ ] All 4 applications build successfully
- [ ] VM resources (kernel, initramfs) verified
- [ ] Test VM startup completes in <30 seconds
- [ ] DHCP IP detection works consistently
- [ ] Console output displays correctly
- [ ] Network connectivity from host to VM works
- [ ] Observability (if enabled) sends metrics
- [ ] Documentation reviewed and accurate
- [ ] Rollback procedure tested
- [ ] Monitoring alerts configured
- [ ] Team trained on deployment procedures

---

## Support & Documentation

### Documentation

- **Architecture:** [ARCHITECTURE.md](ARCHITECTURE.md)
- **Migration Status:** [MIGRATION-STATUS.md](MIGRATION-STATUS.md)
- **Build Report:** [BUILD-TEST-REPORT.md](BUILD-TEST-REPORT.md)
- **WWDC Compliance:** [docs/WWDC-2022-ALIGNMENT.md](docs/WWDC-2022-ALIGNMENT.md)
- **API Documentation:** [Shared/README.md](Shared/README.md)

### Testing

```bash
# Full test suite
./test-all-apps.sh

# Individual tests
./test-basicvibecode.sh
./test-vibecode-multivm.sh
./test-observability.sh
./performance-test.sh
```

### Getting Help

1. Check troubleshooting section above
2. Review console logs: `/tmp/vibecode-*.log`
3. Run diagnostics: `./test-vm-functionality.sh`
4. Check git history for recent changes
5. Consult [BUILD-TEST-REPORT.md](BUILD-TEST-REPORT.md)

---

**Deployment Guide Version:** 2.0.0
**Last Updated:** 2025-11-25
**Maintained by:** VibeCode Team
**Next Review:** 2026-01-25
