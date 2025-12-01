# Init Script Update Instructions

## Overview

An improved init script (`vm-init-improved.sh`) has been created with IPv4-focused networking. To use it, you need to rebuild the initramfs.

## The Improved Init Script

Location: `/tmp/vm-init-improved.sh`

### Key Improvements

1. **IPv6 Disabled at Sysctl Level**
   - Lines 51-53: Disables IPv6 globally
   - Line 62: Disables IPv6 per-interface
   - Ensures only IPv4 DHCP runs

2. **Verbose DHCP Configuration**
   - Line 87: Added `-v` flag to udhcpc for debugging
   - Shows DHCP negotiation in console

3. **Fallback IPv4 Configuration**
   - Lines 91-94: Manual IP configuration if DHCP fails
   - Uses 192.168.65.2/24 as fallback

4. **Enhanced Status Reporting**
   - Lines 97-107: Shows network status after boot
   - Displays IPv4 address, routing table, IPv6 status

## Steps to Integrate

### Option 1: Rebuild Initramfs (Recommended)

If you have the initramfs build environment:

```bash
# 1. Extract current initramfs
cd /tmp
mkdir initramfs-new
cd initramfs-new
gunzip -c ~/vibecode-webgui/azure/SwiftUI-Apps/BasicVibeCode.app/Contents/Resources/bun-openvscode.cpio.gz | cpio -idmv

# 2. Replace init script
cp /tmp/vm-init-improved.sh ./init
chmod +x ./init

# 3. Rebuild initramfs
find . | cpio -o -H newc | gzip > /tmp/bun-openvscode-improved.cpio.gz

# 4. Replace in app bundle
cp /tmp/bun-openvscode-improved.cpio.gz ~/vibecode-webgui/azure/SwiftUI-Apps/BasicVibeCode.app/Contents/Resources/bun-openvscode.cpio.gz

# 5. Test
open ~/vibecode-webgui/azure/SwiftUI-Apps/BasicVibeCode.app
```

### Option 2: Test Without Rebuild (Quick Test)

The kernel command line change (`ipv6.disable=1`) already provides significant improvement without rebuilding the initramfs:

```bash
# Just rebuild the app with updated BasicVibeCodeApp.swift
cd ~/vibecode-webgui/azure/SwiftUI-Apps
swiftc -o /tmp/BasicVibeCode BasicVibeCodeApp.swift DHCPLeaseParser.swift -framework SwiftUI -framework Virtualization

# Test the change
open BasicVibeCode.app
# Check console output for IPv4 address
```

### Option 3: Create Build Script

Create a script to automate the initramfs rebuild:

```bash
#!/bin/bash
# rebuild-initramfs.sh

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
WORK_DIR="/tmp/initramfs-rebuild-$$"
APP_BUNDLE="$SCRIPT_DIR/BasicVibeCode.app"
INIT_SCRIPT="$SCRIPT_DIR/vm-init-improved.sh"

# Check if init script exists
if [ ! -f "$INIT_SCRIPT" ]; then
    echo "Error: Init script not found at $INIT_SCRIPT"
    exit 1
fi

echo "Creating work directory..."
mkdir -p "$WORK_DIR"
cd "$WORK_DIR"

echo "Extracting current initramfs..."
gunzip -c "$APP_BUNDLE/Contents/Resources/bun-openvscode.cpio.gz" | cpio -idmv

echo "Replacing init script..."
cp "$INIT_SCRIPT" ./init
chmod +x ./init

echo "Rebuilding initramfs..."
find . | cpio -o -H newc | gzip > "$WORK_DIR/bun-openvscode.cpio.gz"

echo "Backing up old initramfs..."
cp "$APP_BUNDLE/Contents/Resources/bun-openvscode.cpio.gz" \
   "$APP_BUNDLE/Contents/Resources/bun-openvscode.cpio.gz.backup-$(date +%Y%m%d-%H%M%S)"

echo "Installing new initramfs..."
cp "$WORK_DIR/bun-openvscode.cpio.gz" \
   "$APP_BUNDLE/Contents/Resources/bun-openvscode.cpio.gz"

echo "Cleaning up..."
rm -rf "$WORK_DIR"

echo "Done! New initramfs installed."
echo "Backup saved with timestamp."
```

## Verification

After updating, check the console output for:

```
=== Booting Bun OpenVSCode VM (IPv4-optimized) ===
...
Disabling IPv6 to focus on IPv4...
net.ipv6.conf.all.disable_ipv6 = 1
...
Attempting IPv4 DHCP on eth0...
DHCP successful on eth0
...
=== Network Status ===
Network interfaces:
eth0: inet 192.168.64.5 netmask 255.255.255.0
...
IPv4 routing table:
default via 192.168.64.1 dev eth0
...
IPv6 status (should be disabled):
net.ipv6.conf.all.disable_ipv6 = 1
```

## Comparison: Current vs Improved Init

### Current Init (`/tmp/initramfs-extract/init`)
- Basic IPv6 disable via kernel modules
- Standard udhcpc with timeout
- Basic error handling
- Limited status output

### Improved Init (`/tmp/vm-init-improved.sh`)
- ✅ Multi-layer IPv6 disabling (kernel + sysctl + per-interface)
- ✅ Verbose DHCP with detailed output
- ✅ Fallback IPv4 configuration
- ✅ Comprehensive network status reporting
- ✅ Better debugging information

## Current Status

- ✅ **BasicVibeCodeApp.swift**: Updated with `ipv6.disable=1`
- ✅ **Improved Init Script**: Created at `/tmp/vm-init-improved.sh`
- ⏸️ **Initramfs Integration**: Pending (use instructions above)

## Recommendation

**Short Term**: The kernel command line change alone (`ipv6.disable=1` in BasicVibeCodeApp.swift:302) provides immediate improvement and is already integrated.

**Long Term**: Rebuild the initramfs with the improved init script for maximum reliability and better debugging output.

## Notes

- The kernel parameter `ipv6.disable=1` is already effective without init script changes
- Init script improvements are additive and provide better visibility
- Backup the original initramfs before making changes
- Test thoroughly after any initramfs modification

---

**Created**: 2025-11-25
**Status**: Ready for integration
