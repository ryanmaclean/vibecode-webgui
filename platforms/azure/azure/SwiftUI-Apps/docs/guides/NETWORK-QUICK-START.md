# VibeCode Network Quick Start

## Summary

The VM now uses **IPv4-optimized NAT networking** for reliable connectivity.

## What Changed

### ✅ Code Changes
- **BasicVibeCodeApp.swift:302**: Added `ipv6.disable=1` to kernel command line
- **BasicVibeCodeApp.swift:305-314**: Enhanced network configuration comments
- **vm-init-improved.sh**: New init script with IPv4 focus (ready to integrate)

### ✅ Compilation Status
**SUCCESS**: All changes compile without errors
```
swiftc -o /tmp/basicvibecode-test BasicVibeCodeApp.swift DHCPLeaseParser.swift
```

## How to Use

### 1. Launch the App
```bash
open BasicVibeCode.app
```

### 2. Check VM IP Address
The UI displays: **"VM IP: 192.168.64.X"**

### 3. Access Services
```bash
# OpenVSCode Server
open http://192.168.64.X:3000

# Or if shown in UI, click the URL directly
```

### 4. Interactive Console (Optional)
```bash
# Check app console output for PTY path
screen /dev/ttysXXX
```

## Port Forwarding (Optional)

### Quick pfctl Setup
```bash
# Get VM IP from app
VM_IP="192.168.64.5"  # Replace with actual IP

# Forward localhost:8080 -> VM:3000
echo "rdr pass on lo0 inet proto tcp from any to 127.0.0.1 port 8080 -> $VM_IP port 3000" | sudo pfctl -ef -

# Access via localhost
open http://localhost:8080
```

### Quick socat Setup
```bash
# Install socat if needed
brew install socat

# Forward port
socat TCP-LISTEN:8080,fork,reuseaddr TCP:192.168.64.5:3000

# Access via localhost
open http://localhost:8080
```

## Troubleshooting

### No IPv4 Address?
1. Check console output for "DHCP successful"
2. Verify in app UI: should show "VM IP: 192.168.64.X"
3. Check DHCP leases: `sudo cat /var/db/dhcpd_leases | grep 52:54:00:12:34:90`

### Can't Connect?
1. Ping the VM: `ping 192.168.64.X`
2. Check firewall: `sudo pfctl -s all`
3. Use interactive console to debug

### Need IPv6?
This setup intentionally disables IPv6 for stability. If you need IPv6:
1. Remove `ipv6.disable=1` from line 302 in BasicVibeCodeApp.swift
2. Remove sysctl commands from init script
3. Note: May get IPv6-only address that's not accessible from host

## Network Configuration Details

- **Mode**: NAT (VZNATNetworkDeviceAttachment)
- **MAC Address**: 52:54:00:12:34:90 (fixed for DHCP tracking)
- **IP Range**: 192.168.64.x (macOS vmnet default)
- **DHCP**: Automatic IPv4 assignment
- **IPv6**: Disabled for predictable connectivity

## Files Modified

- `/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/BasicVibeCodeApp.swift`
  - Line 302: Added `ipv6.disable=1`
  - Lines 305-314: Enhanced comments

## Full Documentation

For complete details, see: `NETWORK-CONFIGURATION-GUIDE.md`

---

**Status**: ✅ Ready to use
**Tested**: ✅ Compiles successfully
**Approach**: IPv4-optimized NAT (no special entitlements)
