# VibeCode VM IP Detection Implementation

## Overview

This implementation allows the VibeCode SwiftUI apps to detect and display the actual VM's NAT IP address instead of using `localhost:3000`. Users can now access OpenVSCode from other machines on the network by connecting to the detected IP.

## Architecture

### Key Components

1. **DHCPLeaseParser.swift** - Primary DHCP lease parser
   - Monitors `/var/db/dhcpd_leases` for VM DHCP assignments
   - Parses DHCP lease blocks to extract IP and MAC addresses
   - Finds IP address matching target MAC: `52:54:00:12:34:90`
   - Provides real-time monitoring with callbacks

2. **DHCPLeaseParserV2.swift** - Enhanced parser with fallback
   - Includes auto-discovery of most recent DHCP lease
   - Useful if VM MAC changes or is unknown
   - Maintains backward compatibility with V1 parser

3. **Updated SwiftUI Apps**
   - BasicVibeCodeApp.swift - Simple UI with IP display
   - LiquidGlassVibeCodeApp.swift - Modern glassmorphism UI with IP card

### How It Works

```
VM Starts
   ↓
Linux kernel boots with network interface
   ↓
DHCP client requests IP from macOS host
   ↓
macOS DHCP server records lease in /var/db/dhcpd_leases
   ↓
SwiftUI app monitors DHCP file (every 1 second)
   ↓
Parser finds MAC 52:54:00:12:34:90 in leases
   ↓
Parser extracts associated IP address
   ↓
SwiftUI app displays IP and creates link to http://IP:3000
```

## DHCP Leases File Format

The `/var/db/dhcpd_leases` file on macOS is a simple key-value format:

```
{
    name=studioslMachine
    ip_address=192.168.64.2
    hw_address=1,6a:1:60:6d:ef:38
    identifier=1,6a:1:60:6d:ef:38
    lease=0x6903c794
}
```

- `hw_address` format: `1,XX:XX:XX:XX:XX:XX`
  - `1` = Ethernet (hardware type)
  - Followed by the MAC address
- `ip_address` = The IP assigned by DHCP server

## Implementation Details

### VMManager Changes

The `VMManager` class in both SwiftUI apps now includes:

```swift
@Published var vmIPAddress: String?
private var dhcpMonitorTimer: Timer?
private let vmMACAddress = "52:54:00:12:34:90"
```

When VM starts:
```swift
// Start monitoring DHCP leases for VM IP address
self.dhcpMonitorTimer = DHCPLeaseParser.startMonitoring(
    macAddress: self.vmMACAddress,
    interval: 1.0,
    onIPFound: { ip in
        DispatchQueue.main.async {
            self.vmIPAddress = ip
            print("VM IP Address detected: \(ip)")
        }
    },
    onNotFound: { /* ... */ }
)
```

When server is ready, URL is built with detected IP:
```swift
if let vmIP = self.vmIPAddress {
    self.serverURL = "http://\(vmIP):3000"
} else {
    self.serverURL = "http://localhost:3000"
}
```

### UI Updates

**BasicVibeCodeApp.swift:**
- Added IP display section showing `VM IP: 192.168.64.X`
- Icon indicates network connectivity status

**LiquidGlassVibeCodeApp.swift:**
- Beautiful IP address card with network icon
- Gradient styling matching app theme
- Shows "VM Network Address" label with detected IP

## Testing

### Run Automated Tests

```bash
bash /Users/ryan.maclean/vibecode-webgui/test-dhcp-detection.sh
```

This script:
1. Verifies DHCP leases file exists
2. Reads current DHCP content
3. Extracts all leased IPs
4. Searches for target MAC address
5. Tests network connectivity (if IP found)

### Manual Testing Steps

1. **Start the VM from SwiftUI app**
   - Monitor console output
   - Wait for "Server will be available" message

2. **Check DHCP leases**
   ```bash
   cat /var/db/dhcpd_leases
   grep "52:54:00:12:34:90" /var/db/dhcpd_leases
   ```

3. **View detected IP in app**
   - IP should appear in the UI (if properly detected)
   - URL link changes from `localhost:3000` to `192.168.64.X:3000`

4. **Test connectivity**
   ```bash
   # From another machine or terminal on same network
   curl http://192.168.64.X:3000
   open http://192.168.64.X:3000  # macOS
   ```

### Expected Output

When running `test-dhcp-detection.sh` with running VM:

```
Test 4: Searching for VM MAC (52:54:00:12:34:90)...
✓ Found target MAC in leases
  VM IP Address: 192.168.64.X
```

## Possible Issues & Troubleshooting

### Issue: "Target MAC not found in leases"

**Causes:**
1. VM hasn't started yet
2. VM is using different MAC than configured
3. VM hasn't obtained DHCP lease yet

**Solutions:**
- Verify VM is running: `ps aux | grep vz`
- Check if VM has network interface: `ifconfig -a`
- Increase monitoring interval in code
- Use DHCPLeaseParserV2 with fallback option

### Issue: IP detected but connection fails

**Causes:**
1. OpenVSCode server not started
2. Server only listening on localhost inside VM
3. Network routing issue

**Solutions:**
- Check console output for "Server will be available"
- Verify server listens on 0.0.0.0:3000 (not just 127.0.0.1:3000)
- Ensure host/VM network routing works: `ping 192.168.64.X`

### Issue: Multiple VMs getting same/conflicting IPs

**Causes:**
- Multiple VMs using same MAC address
- DHCP lease conflicts

**Solutions:**
- Use DHCPLeaseParserV2 `getAllLeasedMACs()` to see all leases
- Ensure each VM has unique MAC address
- Consider using static DHCP assignments

## Advanced Features

### Auto-Discovery Mode (V2)

Use `DHCPLeaseParserV2` if VM MAC might be unknown:

```swift
self.dhcpMonitorTimer = DHCPLeaseParserV2.startMonitoringWithFallback(
    macAddress: self.vmMACAddress,
    useFallback: true,  // Use most recent IP if MAC not found
    interval: 1.0,
    onIPFound: { ip in /* ... */ },
    onNotFound: { /* ... */ }
)
```

### Get All Leases

```swift
let allMACs = DHCPLeaseParserV2.getAllLeasedMACs()
// Returns: ["52:54:00:12:34:90": "192.168.64.2", ...]
```

### Monitoring Interval Tuning

Default is 1.0 second. Adjust for different update frequencies:
- **0.5 seconds** - More responsive, higher CPU usage
- **2.0 seconds** - Less responsive, lower CPU usage
- **5.0 seconds** - Minimal overhead, slower updates

## File Permissions

The DHCP leases file requires root access to read:

```bash
ls -la /var/db/dhcpd_leases
# Output: -rw-r--r--  1 root  wheel  131 Oct 30 12:16 /var/db/dhcpd_leases
```

Current implementation works because:
- SwiftUI app runs as user
- /var/db/dhcpd_leases is readable by all users (mode 644)
- No special permissions needed

If file permissions change, you may need:
```bash
sudo chmod 644 /var/db/dhcpd_leases
```

## Performance Considerations

### DHCP Monitoring Overhead

- Reads `/var/db/dhcpd_leases` every 1 second
- File is small (~100-200 bytes typically)
- Regex parsing is lightweight
- Timer-based polling won't block main thread

### Optimization Tips

1. Increase monitoring interval after IP is found
2. Stop monitoring timer when VM stops
3. Cache parsed results to avoid repeated parsing
4. Use background queue for file I/O

## Security Considerations

### Potential Risks

1. **DHCP file access** - Currently world-readable, but could change
   - Add error handling for permission denied
   - Consider using network APIs as alternative

2. **IP exposure** - Displaying IP in app log output
   - Remove debug prints in production
   - Consider sanitizing logs

3. **Network access** - VM IP becomes publicly visible
   - Ensure firewall rules on VM
   - Consider VPN or network segmentation

### Best Practices

```swift
// Always validate IP before using
if let ip = vmIPAddress, isValidIPAddress(ip) {
    // Use IP safely
}

func isValidIPAddress(_ ip: String) -> Bool {
    // Validate IP format: 192.168.64.0-254
    let ipPattern = "^192\\.168\\.64\\.([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-4])$"
    return NSPredicate(format: "SELF MATCHES %@", ipPattern).evaluate(with: ip)
}
```

## Future Improvements

1. **Alternative detection methods:**
   - Use `arp` table to find VM MAC
   - Query macOS network framework APIs
   - Read VM guest agent info

2. **Better error handling:**
   - Network unreachability detection
   - Automatic fallback to localhost
   - User notifications for connection issues

3. **Configuration:**
   - Allow user to override detected IP
   - Remember last known good IP
   - Support for static IP assignment

4. **Monitoring:**
   - Add telemetry/analytics
   - Track IP discovery success rates
   - Log connection attempts

## References

- macOS DHCP server documentation
- VZNATNetworkDeviceAttachment docs
- Swift FileHandle and Timer APIs

## Version History

- **v1.0** (Oct 30, 2025)
  - Initial DHCP parser implementation
  - Integration with BasicVibeCodeApp and LiquidGlassVibeCodeApp
  - Real-time monitoring with callbacks
  - Comprehensive test suite

- **v2.0** (Oct 30, 2025)
  - Enhanced parser with fallback support
  - Auto-discovery of most recent lease
  - getAllLeasedMACs() utility function
  - Improved error handling
