# OpenVSCode Server Network Configuration

## Summary

OpenVSCode server is **already configured** to bind to `0.0.0.0` (all network interfaces), making it accessible from the host machine at the VM's IP address.

## Configuration Details

### 1. Init Script Configuration

**File:** `init` (in initramfs)

```bash
# Lines 211-212
export PORT=3000
export HOST=0.0.0.0
```

The init script sets the `HOST` environment variable to `0.0.0.0` before starting the Bun server.

### 2. Bun Server Configuration

**File:** `/opt/openvscode/bun-server.js` (in initramfs)

```javascript
// Line 6
const HOST = process.env.HOST || "0.0.0.0";

// Lines 14-16
args: [
    "--host", HOST,
    "--port", PORT.toString(),
    // ...
]
```

The Bun server:
1. Reads the `HOST` environment variable (set by init script)
2. Falls back to `"0.0.0.0"` if not set
3. Passes the host to OpenVSCode server via `--host` flag

### 3. Current Status

All initramfs files already have this configuration:

- `/Users/ryan.maclean/vibecode-webgui/azure/bun-openvscode-with-modules.cpio.gz` (Nov 26 09:44) ✓
- `/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/BasicVibeCode.app/Contents/Resources/bun-openvscode.cpio.gz` (Nov 26 09:55) ✓
- `/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/LiquidGlassVibeCode.app/Contents/Resources/bun-openvscode.cpio.gz` (Nov 26 09:55) ✓

## Network Architecture

### NAT Networking

The VM uses NAT networking via Apple's `VZNATNetworkDeviceAttachment`:

1. **VM Boot**: VM starts with virtio network device
2. **DHCP**: macOS DHCP server assigns IP (typically `192.168.64.x`)
3. **Binding**: OpenVSCode binds to `0.0.0.0:3000` (all interfaces)
4. **Access**: Host can access server at `http://<VM_IP>:3000`

### IP Address Detection

The VM's IP address is detected via DHCP lease monitoring:

```bash
# DHCP leases stored here
/var/db/dhcpd_leases
```

The SwiftUI apps monitor this file to detect when the VM obtains an IP address.

## Testing Accessibility

### Automated Test Script

Use the provided test script to verify accessibility:

```bash
# Basic usage (default: 192.168.64.3:3000)
./test-vm-accessibility.sh

# Custom IP
VM_IP=192.168.64.5 ./test-vm-accessibility.sh

# Custom IP and port
VM_IP=192.168.64.5 VM_PORT=3000 ./test-vm-accessibility.sh

# Longer wait time (default: 60s)
MAX_WAIT=120 ./test-vm-accessibility.sh
```

The test script checks:
1. VM IP is reachable (ping)
2. Port 3000 is open (netcat)
3. HTTP server responds
4. OpenVSCode signature is present

### Manual Testing

1. **Start the VM** via BasicVibeCode or LiquidGlassVibeCode app

2. **Find the VM's IP address**:
   ```bash
   # Check DHCP leases
   sudo cat /var/db/dhcpd_leases | grep -A 10 "52:54:00"

   # Or check the app's console output
   tail -f /tmp/vibecode-console-*.log | grep "DHCP successful"
   ```

3. **Test connectivity**:
   ```bash
   # Replace with your VM's IP
   VM_IP=192.168.64.3

   # Test ping
   ping -c 3 $VM_IP

   # Test port
   nc -zv $VM_IP 3000

   # Test HTTP
   curl -v http://$VM_IP:3000
   ```

4. **Access in browser**:
   ```
   http://192.168.64.3:3000
   ```

## Troubleshooting

### Issue: "Connection refused" from host

**Symptoms:**
```bash
curl: (7) Failed to connect to 192.168.64.3 port 3000: Connection refused
```

**Possible Causes:**
1. Server not started yet (wait for "Starting OpenVSCode Server" in console)
2. Server crashed (check console output for errors)
3. Port number mismatch (verify PORT=3000 in init script)

**Debug:**
```bash
# Check VM console output
tail -100 /tmp/vibecode-console-*.log

# Look for these messages:
# - "Starting OpenVSCode Server..."
# - "Server will be available at http://0.0.0.0:3000"
```

### Issue: "No route to host"

**Symptoms:**
```bash
ping: sendto: No route to host
```

**Possible Causes:**
1. VM network not initialized
2. DHCP lease not obtained
3. Wrong IP address

**Debug:**
```bash
# Check DHCP leases
sudo cat /var/db/dhcpd_leases

# Check VM console for network errors
tail -100 /tmp/vibecode-console-*.log | grep -A 5 "network\|DHCP\|eth0"
```

### Issue: "Connection times out"

**Symptoms:**
```bash
curl: (28) Operation timed out after 30000 milliseconds
```

**Possible Causes:**
1. Server bound to 127.0.0.1 instead of 0.0.0.0 (check config)
2. Firewall blocking connection
3. Server listening on wrong port

**Debug:**
```bash
# Verify the configuration in the running initramfs
mkdir -p /tmp/verify-config
cd /tmp/verify-config
gunzip -c ~/vibecode-webgui/azure/bun-openvscode-with-modules.cpio.gz | cpio -idmv init opt/openvscode/bun-server.js

# Check HOST configuration
grep "export HOST" init
grep "const HOST" opt/openvscode/bun-server.js
```

## Configuration Files

### Files to Verify

If you need to verify or modify the configuration:

1. **Source init scripts** (used to build initramfs):
   - `/tmp/initramfs-fix/init`
   - `/tmp/initramfs-check/init`

2. **Build script** (creates initramfs):
   - `/Users/ryan.maclean/vibecode-webgui/azure/build-bun-minimal-with-datadog.sh`

3. **Initramfs archives**:
   - `/Users/ryan.maclean/vibecode-webgui/azure/bun-openvscode-with-modules.cpio.gz`
   - App bundles: `*.app/Contents/Resources/bun-openvscode.cpio.gz`

### Rebuilding Initramfs (if needed)

If you need to rebuild with modified configuration:

```bash
cd /Users/ryan.maclean/vibecode-webgui/azure

# Method 1: Full rebuild
./build-bun-minimal-with-datadog.sh

# Method 2: Manual rebuild from /tmp/initramfs-fix
cd /tmp/initramfs-fix
find . | cpio -o -H newc | gzip > /Users/ryan.maclean/vibecode-webgui/azure/bun-openvscode-with-modules.cpio.gz

# Copy to app bundles
cp /Users/ryan.maclean/vibecode-webgui/azure/bun-openvscode-with-modules.cpio.gz \
   /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/BasicVibeCode.app/Contents/Resources/bun-openvscode.cpio.gz

cp /Users/ryan.maclean/vibecode-webgui/azure/bun-openvscode-with-modules.cpio.gz \
   /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/LiquidGlassVibeCode.app/Contents/Resources/bun-openvscode.cpio.gz
```

## Verification Checklist

- [x] Init script sets `export HOST=0.0.0.0`
- [x] Bun server defaults to `HOST=0.0.0.0`
- [x] Bun server passes `--host` flag to openvscode-server
- [x] Initramfs in azure directory is up to date
- [x] Initramfs in app bundles is up to date
- [x] Test script created for automated verification

## Related Documentation

- [NAT Network Strategy](SwiftUI-Apps/Shared/Networking/NATNetworkStrategy.swift) - NAT networking implementation
- [DHCP Lease Monitor](SwiftUI-Apps/Shared/Networking/DHCPLeaseMonitor.swift) - IP address detection
- [Base VM Manager](SwiftUI-Apps/Shared/Core/BaseVMManager.swift) - VM lifecycle management

## Quick Reference

| Configuration | Location | Value |
|---------------|----------|-------|
| Host binding | init script | `HOST=0.0.0.0` |
| Port | init script | `PORT=3000` |
| Default host | bun-server.js | `"0.0.0.0"` |
| Network mode | VM config | NAT (VZNATNetworkDeviceAttachment) |
| IP range | DHCP | `192.168.64.x` |
| Access URL | Browser | `http://<VM_IP>:3000` |

## Status

**Configuration Status:** ✓ Complete and correct

**Last Verified:** 2025-11-26

**No action required** - The server is already configured to be accessible from the host at `http://<VM_IP>:3000`
