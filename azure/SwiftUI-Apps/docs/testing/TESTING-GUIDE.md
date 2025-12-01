# VM Apps Testing Guide

## Quick Start

### Automated Testing (when VM auto-starts)

```bash
cd ~/vibecode-webgui/azure/SwiftUI-Apps
./test-vm-apps.sh
```

### Manual Testing (current method)

```bash
# Terminal 1: Launch the monitoring script
cd ~/vibecode-webgui/azure/SwiftUI-Apps
./monitor-vm-manual.sh

# Terminal 2 (or GUI): Launch the app and click Start
open BasicVibeCode.app
# Click the "Start" button in the app window
```

## Test Scripts

### 1. test-vm-apps.sh (Full Automated Test Suite)

**Status:** Ready but requires VM auto-start implementation

**Features:**
- Tests both BasicVibeCode.app and LiquidGlassVibeCode.app
- Validates bundle integrity and resources
- Monitors VM boot process
- Checks network configuration
- Tests server connectivity
- Generates comprehensive reports

**Usage:**
```bash
./test-vm-apps.sh
```

**Current Limitation:** Requires apps to auto-start VM, which is not currently implemented.

### 2. monitor-vm-manual.sh (Manual Test Monitor)

**Status:** Ready to use now

**Features:**
- Works with manually started VMs
- Monitors console log in real-time
- Validates all VM functionality
- Provides clear pass/fail results
- Shows VM IP and server URL

**Usage:**
```bash
# 1. Start the monitor script (it will wait)
./monitor-vm-manual.sh

# 2. In the app, click "Start" button
# 3. Monitor automatically detects and tests VM
```

## Testing Checklist

### Basic Functionality Test

- [ ] App launches without errors
- [ ] Click "Start" button
- [ ] VM boots (console log created)
- [ ] Network driver loads (virtio_net)
- [ ] Network interface configured (eth0)
- [ ] DHCP assigns IP address
- [ ] OpenVSCode server starts
- [ ] Can access server via browser
- [ ] Can create/edit files in VSCode
- [ ] Click "Stop" button works
- [ ] App quits cleanly

### Advanced Testing

- [ ] VM survives host sleep/wake
- [ ] Port forwarding works correctly
- [ ] File operations persist
- [ ] Multiple app instances (different VMs)
- [ ] Resource cleanup after stop
- [ ] Restart after crash

## Test Results Location

- **Automated Test Results:** `/tmp/test-vm-results.log`
- **Console Log:** `/tmp/vibecode-console.log`
- **DHCP Leases:** `/var/db/dhcpd_leases`

## Common Issues

### VM doesn't start

**Check:**
- Console log doesn't exist: VM not started (click Start button)
- App crash: Check Console.app for errors
- Permissions: Verify Virtualization framework entitlements

### No network connectivity

**Check:**
```bash
# Check vmnet service
sudo launchctl list | grep vmnet

# Restart if needed
sudo launchctl stop com.apple.networking.vmnet
sudo launchctl start com.apple.networking.vmnet
```

### Server not accessible

**Check:**
- VM has IP: Look in app UI or DHCP leases
- Firewall: macOS firewall may block connections
- Port conflict: Another service using port 3000

## Manual Verification Commands

```bash
# Check if app is running
ps aux | grep -i vibecode | grep -v grep

# Watch console log live
tail -f /tmp/vibecode-console.log

# Check DHCP leases
sudo cat /var/db/dhcpd_leases | grep -A5 "52:54:00:12:34:90"

# Test server connectivity
curl http://VM_IP:3000

# Check port forwarding
lsof -i :3000
```

## Troubleshooting

### Console.app Filtering

To see VM-related logs:
```
1. Open Console.app
2. Filter: process:BasicVibeCode OR process:LiquidGlassVibeCode
3. Look for errors or crashes
```

### Verbose Logging

Add debug output to apps:
```swift
// In VMManager
print("DEBUG: VM starting with config: \(config)")
```

### Network Debugging

```bash
# Check vmnet interfaces
ifconfig | grep -A5 vmnet

# Monitor DHCP
sudo log stream --predicate 'eventMessage contains "dhcp"' --level debug

# Check routing
netstat -rn | grep 192.168.64
```

## Performance Metrics

Expected timing (from Start click):
- Console log created: ~1-2 seconds
- virtio_net detected: ~3-5 seconds
- eth0 configured: ~5-7 seconds
- DHCP IP assigned: ~7-10 seconds
- Server started: ~15-30 seconds
- HTTP responsive: ~20-35 seconds

## Test Data

### VM Configuration
- **CPU:** 2 cores
- **Memory:** 1 GB
- **Network:** NAT (vmnet)
- **MAC Address:** 52:54:00:12:34:90
- **Console:** /dev/hvc0 → /tmp/vibecode-console.log

### Expected Console Markers
- `Linux version 6.x.x` - Kernel boot
- `virtio_net` - Network driver
- `eth0` - Network interface
- `udhcpc` - DHCP client
- `Server will be available` - OpenVSCode ready

### Expected Network
- **IP Range:** 192.168.64.0/24 (macOS vmnet default)
- **Gateway:** 192.168.64.1
- **DNS:** Host DNS forwarding
- **Port:** 3000 (OpenVSCode server)

## CI/CD Integration (Future)

When auto-start is implemented:

```yaml
# .github/workflows/test-vm.yml
name: Test VM Apps
on: [push, pull_request]

jobs:
  test:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v2
      - name: Build Apps
        run: ./bundle-apps.sh
      - name: Test Apps
        run: ./test-vm-apps.sh
      - name: Upload Results
        uses: actions/upload-artifact@v2
        with:
          name: test-results
          path: /tmp/test-vm-results.log
```

## Support

### Documentation
- **Test Report:** `VM-TEST-REPORT.md`
- **Implementation:** `DELIVERY-REPORT.md`
- **VSOCK Details:** `VSOCK-SUMMARY.md`

### Scripts
- **Full Tests:** `test-vm-apps.sh`
- **Manual Monitor:** `monitor-vm-manual.sh`
- **Build:** `bundle-apps.sh`

### Logs
- **Console:** `/tmp/vibecode-console.log`
- **System:** `Console.app`
- **DHCP:** `/var/db/dhcpd_leases`
