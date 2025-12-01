# VibeCode VM Network Configuration Guide

## Current Implementation: IPv4-Optimized NAT Networking

### Overview

The VibeCode VM uses **VZNATNetworkDeviceAttachment** with IPv4-focused configuration to enable reliable network connectivity. This approach was chosen after evaluating multiple networking strategies.

### Changes Made

#### 1. BasicVibeCodeApp.swift (Lines 300-314)

**Kernel Command Line Enhancement:**
- **Line 302**: Added `ipv6.disable=1` to force IPv4-only networking
- **Why**: Eliminates IPv6-only assignments that prevent host-to-guest communication

```swift
// Before:
bootloader.commandLine = "console=hvc0 debug loglevel=8"

// After:
bootloader.commandLine = "console=hvc0 debug loglevel=8 ipv6.disable=1"
```

**Network Configuration:**
- **Lines 305-314**: Enhanced with explanatory comments about entitlement requirements
- Uses `VZNATNetworkDeviceAttachment` (no special entitlements required)
- Sets fixed MAC address `52:54:00:12:34:90` for DHCP lease tracking
- Already includes DHCP lease monitoring via `DHCPLeaseParser`

#### 2. Improved Init Script (vm-init-improved.sh)

Created an enhanced init script with the following improvements:

**IPv6 Disabling (Lines 51-53):**
```bash
sysctl -w net.ipv6.conf.all.disable_ipv6=1
sysctl -w net.ipv6.conf.default.disable_ipv6=1
```

**Per-Interface IPv6 Disable (Line 62):**
```bash
sysctl -w "net.ipv6.conf.$iface.disable_ipv6=1"
```

**Verbose DHCP Configuration (Line 87):**
```bash
timeout 15 udhcpc -i "$iface" -n -v
```
- `-n`: Exit if lease is not obtained
- `-v`: Verbose mode for debugging

**Fallback IPv4 Configuration (Lines 91-94):**
```bash
ip addr add 192.168.65.2/24 dev "$iface"
ip route add default via 192.168.65.1
```

**Enhanced Status Reporting (Lines 97-107):**
- Shows IPv4 address assignments
- Displays routing table
- Confirms IPv6 disabled status

## Why This Approach?

### Evaluated Solutions

#### ❌ Option A: VZBridgedNetworkDeviceAttachment
**Status**: Not feasible

**Reason**: Requires `com.apple.vm.networking` entitlement, which is:
- Restricted to commercial virtualization software developers
- Requires established relationship with Apple
- Not available for general development

**Source**: [Apple Developer Documentation](https://developer.apple.com/documentation/virtualization/vzbridgednetworkdeviceattachment)

#### ✅ Option B: IPv4-Focused Configuration (IMPLEMENTED)
**Status**: Implemented

**Benefits**:
- No special entitlements required
- Works with standard VZNATNetworkDeviceAttachment
- Predictable IPv4 addresses
- Compatible with existing DHCP lease monitoring
- Enables host-to-guest communication

**Technical Details**:
- BusyBox `udhcpc` is IPv4-only by default
- Disabling IPv6 at kernel and sysctl level prevents IPv6-only assignments
- Fixed MAC address enables DHCP lease tracking
- VM IP displayed in UI via DHCPLeaseParser

#### ❌ Option C: VZNATNetworkDeviceAttachment Port Forwarding
**Status**: Not available

**Reason**: VZNATNetworkDeviceAttachment does not expose port forwarding APIs in the Virtualization framework. This is a framework limitation, not an implementation issue.

#### Option D: External Port Forwarding (WORKAROUND)
**Status**: Available as workaround

See "Advanced Networking Workarounds" section below.

## How It Works

### Network Flow

1. **VM Boot**: Kernel parameter `ipv6.disable=1` prevents IPv6 stack initialization
2. **Init Script**:
   - Disables IPv6 via sysctl for additional enforcement
   - Brings up network interface (eth0)
   - Runs `udhcpc` for IPv4 DHCP
3. **Host Monitoring**:
   - DHCPLeaseParser monitors `/var/db/dhcpd_leases`
   - Matches VM MAC address `52:54:00:12:34:90`
   - Extracts and displays IPv4 address in UI
4. **Connectivity**:
   - VM obtains IPv4 address (typically 192.168.64.x)
   - Host can access VM services via this IP
   - OpenVSCode server available at `http://<vm-ip>:3000`

### IP Address Detection

The app automatically detects the VM's IP address:

```swift
// DHCPLeaseParser monitors DHCP leases
self.dhcpMonitorTimer = DHCPLeaseParser.startMonitoring(
    macAddress: "52:54:00:12:34:90",
    interval: 1.0,
    onIPFound: { ip in
        self.vmIPAddress = ip
        self.serverURL = "http://\(ip):3000"
    }
)
```

## Testing Network Configuration

### 1. Verify IPv4 Assignment

When the VM boots, check the console output for:

```
Network Status:
Network interfaces:
eth0: inet 192.168.64.X netmask 255.255.255.0
```

### 2. Check DHCP Lease

On the host:
```bash
sudo cat /var/db/dhcpd_leases | grep -A 5 "52:54:00:12:34:90"
```

### 3. Test Connectivity

From the host:
```bash
# Ping the VM
ping <vm-ip>

# Access OpenVSCode
curl http://<vm-ip>:3000
```

### 4. Interactive Console

The app creates a PTY for interactive console access:

```bash
# Find the PTY path in app output
screen /dev/ttysXXX

# Or use socat
socat - /dev/ttysXXX,raw,echo=0
```

## Advanced Networking Workarounds

While the IPv4-optimized NAT configuration works for most use cases, here are advanced options:

### Port Forwarding with pfctl (macOS Firewall)

Forward host ports to VM:

```bash
# Get VM IP from app UI
VM_IP="192.168.64.5"

# Create anchor file
cat > /tmp/vibecode-pf.conf << EOF
# Port forwarding for VibeCode VM
rdr pass on lo0 inet proto tcp from any to 127.0.0.1 port 8080 -> $VM_IP port 3000
rdr pass on lo0 inet proto tcp from any to 127.0.0.1 port 2222 -> $VM_IP port 22
EOF

# Enable forwarding
sudo pfctl -ef /tmp/vibecode-pf.conf

# Verify
sudo pfctl -s nat
```

Now access OpenVSCode at `http://localhost:8080`

### SSH Tunnel

If you enable SSH in the VM:

```bash
# Forward port 3000 via SSH
ssh -L 8080:localhost:3000 root@<vm-ip>

# Access at http://localhost:8080
```

### socat Port Forwarding

```bash
# Forward localhost:8080 to VM:3000
socat TCP-LISTEN:8080,fork,reuseaddr TCP:<vm-ip>:3000
```

### Using VMNet for Custom Networking

For advanced users needing more control, consider using `vmnet` framework directly:

```bash
# Install vmnet helper (requires root)
# Example with vfkit or similar tools
```

Note: This still uses VZNATNetworkDeviceAttachment but gives more control over the NAT configuration.

## Limitations and Requirements

### Current Limitations

1. **No Bridged Networking**: Requires com.apple.vm.networking entitlement
2. **No Built-in Port Forwarding**: VZNATNetworkDeviceAttachment doesn't expose port forwarding APIs
3. **Dynamic IP Address**: VM IP may change between boots (though DHCP lease usually persists)

### Requirements

1. **macOS Version**: macOS 11.0 (Big Sur) or later
2. **Architecture**: arm64 (Apple Silicon)
3. **Entitlements**:
   - `com.apple.security.virtualization` (included)
   - No special networking entitlement required

### Network Stability

The VM network is stable and reliable for:
- ✅ HTTP/HTTPS server access
- ✅ Outbound internet connectivity
- ✅ SSH access (if enabled)
- ✅ WebSocket connections
- ✅ Long-running services

## Troubleshooting

### VM Has No IPv4 Address

**Check 1**: Verify IPv6 is disabled
```bash
# In VM console
sysctl net.ipv6.conf.all.disable_ipv6
# Should output: net.ipv6.conf.all.disable_ipv6 = 1
```

**Check 2**: Verify DHCP client ran
```bash
# Look for in console output
Attempting IPv4 DHCP on eth0...
DHCP successful on eth0
```

**Check 3**: Check interface status
```bash
# In VM console
ip addr show eth0
ip link show eth0
```

### Cannot Connect to VM from Host

**Check 1**: Verify IP address in app UI
- Look for "VM IP: 192.168.64.X" in the status section

**Check 2**: Test basic connectivity
```bash
ping <vm-ip>
```

**Check 3**: Check firewall rules
```bash
# macOS firewall might block connections
sudo pfctl -s all
```

### DHCP Lease Not Detected

**Check 1**: Verify MAC address matches
```bash
sudo cat /var/db/dhcpd_leases | grep "52:54:00:12:34:90"
```

**Check 2**: Check lease file permissions
```bash
ls -la /var/db/dhcpd_leases
# Should be readable
```

## Implementation Files

- **BasicVibeCodeApp.swift**: Main application with network configuration
  - Lines 300-302: IPv6 disable in kernel command line
  - Lines 305-314: Network device configuration
  - Lines 363-377: DHCP lease monitoring

- **vm-init-improved.sh**: Enhanced init script
  - Lines 51-53: IPv6 disable via sysctl
  - Lines 62: Per-interface IPv6 disable
  - Lines 75-87: DHCP configuration with fallback
  - Lines 97-107: Network status reporting

- **DHCPLeaseParser.swift**: DHCP lease monitoring
  - Monitors `/var/db/dhcpd_leases`
  - Matches MAC address to IP
  - Updates UI with VM IP

## Future Enhancements

Potential improvements for future versions:

1. **Static IP Configuration**: Option to use static IP instead of DHCP
2. **Port Forwarding UI**: Built-in pfctl rule management
3. **Multiple Network Interfaces**: Support for additional NICs
4. **VPN Integration**: Route VM traffic through VPN
5. **Network Performance Metrics**: Bandwidth and latency monitoring

## References

- [VZNATNetworkDeviceAttachment Documentation](https://developer.apple.com/documentation/virtualization/vznatnetworkdeviceattachment)
- [VZBridgedNetworkDeviceAttachment Requirements](https://developer.apple.com/documentation/virtualization/vzbridgednetworkdeviceattachment)
- [BusyBox udhcpc Documentation](https://busybox.net/downloads/BusyBox.html#udhcpc)
- [Apple Virtualization Framework](https://developer.apple.com/documentation/virtualization)

---

**Last Updated**: 2025-11-25
**Tested On**: macOS 14.x (Sonoma) with Apple Silicon
**Status**: Production Ready
