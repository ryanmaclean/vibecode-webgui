# BasicVibeCode v1.0.0

Single-VM launcher with OpenVSCode Server running in an Alpine Linux VM using macOS Virtualization.framework.

## What is BasicVibeCode?

BasicVibeCode is a simple, single-purpose application that launches one Linux VM with OpenVSCode Server (browser-based VS Code). Perfect for quick development environments or testing.

## What's Included

- **BasicVibeCode.dmg** (131MB) - macOS application bundle
- Alpine Linux VM with OpenVSCode Server
- Full networking support via DHCP
- Browser-based VS Code interface

## System Requirements

- **OS**: macOS 13.0 (Ventura) or later
- **Architecture**: Apple Silicon (ARM64)
- **Memory**: 2GB RAM minimum (4GB recommended)
- **Disk**: 500MB free space
- **Permissions**: Virtualization and network access

## Installation

1. Download `BasicVibeCode.dmg` (131MB)
2. Verify checksum (see below)
3. Open the DMG file
4. Drag `BasicVibeCode.app` to your Applications folder
5. First launch: Right-click → Open (to bypass Gatekeeper)

## Using BasicVibeCode

### Launch the Application

```bash
# From Finder
Double-click BasicVibeCode.app in Applications

# From Terminal
open /Applications/BasicVibeCode.app
```

### What to Expect

When you launch BasicVibeCode:

1. **VM Boot** (5-10 seconds)
   - Application window appears with status "Starting..."
   - VM boots Alpine Linux in the background

2. **Network Setup** (2-3 seconds)
   - DHCP assigns an IP address (typically 192.168.64.x)
   - Status updates to "Running"

3. **OpenVSCode Server Starts** (3-5 seconds)
   - Server binds to the VM's IP on port 3000
   - Status shows "Ready"
   - Access token is generated

4. **Ready to Use**
   - Application shows OpenVSCode URL with authentication token
   - Example: `http://192.168.64.10:3000?tkn=abc123...`
   - Click the URL or copy-paste into your browser

### Accessing Your IDE

The application displays a clickable URL like:
```
Web UI available at http://192.168.64.10:3000?tkn=3a9cf5f3-6b7e-4bdf-807c-5423eae62105
```

Click this URL or copy it into your browser. You'll see a full VS Code interface running in the VM.

### Stopping the Application

- Click the "Stop" button in the application
- Or simply quit the application (Cmd+Q)
- The VM will shut down automatically

## Verification

**SHA256 Checksum**:
```
215d1bd2b11ec3d8d7cfe1e1c8d4545a4079f812b1a41a105697baf1723b1815  BasicVibeCode.dmg
```

Verify the download:
```bash
shasum -a 256 BasicVibeCode.dmg
```

## Testing

Run the automated test script:
```bash
cd azure/SwiftUI-Apps
./test-basicvibecode.sh
```

**Test Coverage**: 11 comprehensive tests including:
- App bundle integrity
- Executable validation
- App launch and stability
- Code signing and entitlements
- VM boot detection
- DHCP networking capability
- Network configuration
- OpenVSCode URL generation
- Console output capture
- Error handling

**Current Test Results**: 90% pass rate (10/11 tests passing)
- ✅ All build, signing, and core functionality tests pass
- ⚠️ Graceful shutdown test requires user interaction (expected)

## Troubleshooting

### "Cannot be opened because the developer cannot be verified"

macOS Gatekeeper blocks unsigned apps. To open:
1. Right-click BasicVibeCode.app
2. Select "Open"
3. Click "Open" in the dialog

Or disable Gatekeeper for this app:
```bash
xattr -d com.apple.quarantine /Applications/BasicVibeCode.app
```

### VM Doesn't Start

Check if you have virtualization permissions:
```bash
# View entitlements
codesign -d --entitlements - /Applications/BasicVibeCode.app
```

Should show:
- `com.apple.security.virtualization`
- `com.apple.security.hypervisor`

### Network Doesn't Connect

If DHCP fails:
1. Check System Preferences → Network
2. Ensure no other VMs are using the same MAC address (52:54:00:12:34:90)
3. Restart the application

### Can't Access OpenVSCode

If the URL doesn't work:
1. Verify the VM's IP address is reachable: `ping 192.168.64.10`
2. Check if port 3000 is accessible: `nc -zv 192.168.64.10 3000`
3. Try accessing without the token first: `http://192.168.64.10:3000`

### Performance Issues

If the VM is slow:
- Increase memory allocation (requires rebuilding from source)
- Close other memory-intensive applications
- Ensure you have at least 4GB free RAM

## Technical Specifications

- **VM Kernel**: Linux vmlinux-raw (45MB)
- **Root Filesystem**: Alpine Linux initramfs (108MB, cpio.gz format)
- **Memory**: 1GB allocated to VM
- **CPUs**: 2 virtual CPUs
- **Networking**: virtio-net with NAT, DHCP-assigned IP
- **MAC Address**: 52:54:00:12:34:90
- **Console**: virtio-serial device

## Security

- Application requires explicit virtualization entitlements
- No data collection or telemetry
- VM network isolated via NAT
- OpenVSCode requires authentication token

## Building from Source

Full build instructions are available in [BUILD.md](BUILD.md).

### Quick Build

```bash
# Navigate to the project directory
cd azure/SwiftUI-Apps

# Build the application
./build-basicvibecode.sh

# The app will be created at:
# azure/SwiftUI-Apps/BasicVibeCode.app
```

### Prerequisites

Before building, ensure you have:

- [ ] **Xcode 14.0 or later** - Required for Swift compiler and macOS SDK
- [ ] **macOS 13.0 (Ventura) or later** - Build and runtime requirement
- [ ] **Apple Silicon (ARM64)** - Required for Virtualization.framework
- [ ] **Command Line Tools** - Install via `xcode-select --install`
- [ ] **VM kernel and initramfs** - Located in `dist/vm-images/`
  - `vmlinux-raw` (45MB kernel)
  - `alpine-initramfs.cpio.gz` (108MB root filesystem)

### Code Signing Requirements

The built application requires specific entitlements for virtualization:

```xml
<key>com.apple.security.virtualization</key>
<true/>
<key>com.apple.security.hypervisor</key>
<true/>
```

**Important Notes:**
- Self-signed applications will trigger macOS Gatekeeper warnings
- Users must right-click → Open on first launch
- For distribution, use a valid Apple Developer certificate
- Ad-hoc signing is sufficient for local development and testing

To sign with ad-hoc signature:
```bash
codesign --force --deep --sign - BasicVibeCode.app
```

See [BUILD.md](BUILD.md) for detailed signing instructions and troubleshooting.

## Source Code

All source code available:
- `azure/SwiftUI-Apps/BasicVibeCodeApp.swift` - Main application
- `azure/SwiftUI-Apps/build-basicvibecode.sh` - Build script
- `azure/SwiftUI-Apps/test-basicvibecode.sh` - Test script

## Known Issues

- First launch may take longer as macOS initializes VM framework
- OpenVSCode token changes on each launch (save your work before stopping)
- Single VM only - use VibeCode.app for multiple VMs

## Related Releases

- **VibeCode v1.6.0-multivm** - Multi-VM manager for 6 VMs
- **LiquidGlassVibeCode v1.0.0** - Full observability stack

## Support

Report issues: https://github.com/ryanmaclean/vibecode-webgui/issues

---

Generated with Claude Code - https://claude.com/claude-code
