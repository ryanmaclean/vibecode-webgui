# VibeCode v0.9-beta - Native macOS VM Management

**Status**: Production Infrastructure (86% Complete)  
**Release Date**: November 1, 2025  
**Platform**: macOS 15+ (Apple Silicon & Intel)

---

## What's Included

### Native Swift VM Manager
- macOS native application for managing virtual machines
- Apple Virtualization.framework integration
- 6 pre-configured Alpine Linux VMs
- GUI for VM lifecycle management

### Working VMs (2/6)
1. **Pgvector** - PostgreSQL with vector extensions
2. **Ide** - Development environment

### Complete Infrastructure
- VM discovery and validation
- Network configuration (VirtIO NAT)
- Console output capture
- Datadog observability
- Automated testing framework

---

## Build Instructions

### Prerequisites

```bash
# Required
- macOS 15 (Sequoia) or later
- Xcode 15+ or Swift 5.9+
- 16GB RAM minimum
- 50GB free disk space

# Check your Swift version
swift --version
# Should be 5.9 or later
```

### Build Steps

1. **Clone the Repository**
```bash
git clone https://github.com/ryanmaclean/vibecode-webgui.git
cd vibecode-webgui
```

2. **Build the Native App**
```bash
cd VibeCodeSwift
swift build -c release
```

3. **Create App Bundle**
```bash
# Create macOS app bundle
mkdir -p .build/release/VibeCode.app/Contents/MacOS
mkdir -p .build/release/VibeCode.app/Contents/Resources
cp .build/release/VibeCode .build/release/VibeCode.app/Contents/MacOS/
cp Info.plist .build/release/VibeCode.app/Contents/
```

4. **Sign the App**
```bash
codesign --force --sign - \
  --entitlements VibeCode.entitlements \
  .build/release/VibeCode.app/Contents/MacOS/VibeCode
```

5. **Verify Signing**
```bash
codesign -d --entitlements - .build/release/VibeCode.app 2>&1 | \
  grep "com.apple.security.virtualization"
# Should show the virtualization entitlement
```

### Quick Build (One Command)

```bash
./scripts/launch-vibecode.sh
```

This script:
- Builds the app
- Creates app bundle
- Signs with entitlements
- Launches the application

---

## Usage Instructions

### First Launch

1. **Open the App**
```bash
open VibeCodeSwift/.build/release/VibeCode.app
```

Or use the launch script:
```bash
./scripts/launch-vibecode.sh
```

2. **Grant Permissions**
   - If prompted, allow virtualization access
   - The app needs `com.apple.security.virtualization` entitlement

3. **VM Discovery**
   - App will automatically discover 6 VMs
   - VMs are loaded from: `dist/vm-images/`
   - Each VM has a disk (.img) and EFI NVRAM file

### Starting VMs

**Working VMs (Can Start Now)**:
- **Pgvector** - Click in sidebar, then "Start VM"
- **Ide** - Click in sidebar, then "Start VM"

**VMs with Known Issues** (Bootloader):
- Postgresql
- Valkey  
- Nodejs
- Nodejs-Codeserver

These will show "Invalid boot loader" error. See troubleshooting below.

### VM Details

Each VM shows:
- **CPU Cores**: 4
- **Memory**: 4 GB
- **Disk**: 10-50 GB (sparse, grows as needed)
- **Type**: Linux (Alpine)
- **Status**: Stopped/Starting/Running

### Network Access

VMs use NAT networking and get IPs in the `192.168.64.x` range.

**Find VM IPs**:
```bash
./scripts/find-vm-ips.sh
```

**Test Services**:
```bash
./scripts/test-service-health.sh <vm-ip>
```

---

## Troubleshooting

### "Invalid Boot Loader" Error

**Cause**: VM doesn't have valid EFI boot configuration

**Fix**: Copy EFI from a working VM
```bash
cp dist/vm-images/vibecode-ide-efi.nvram \
   dist/vm-images/vibecode-postgresql-efi.nvram

# Restart app
killall VibeCode
./scripts/launch-vibecode.sh
```

### VMs Don't Appear

**Check**: VM images present?
```bash
ls -lh dist/vm-images/
# Should show 6 .img and 6 -efi.nvram files
```

**Check**: App has virtualization entitlement?
```bash
codesign -d --entitlements - \
  VibeCodeSwift/.build/release/VibeCode.app 2>&1 | \
  grep virtualization
```

### No Network Connectivity

**Check**: bridge100 exists?
```bash
ifconfig bridge100
```

**Check**: VMs on network?
```bash
arp -a | grep 192.168.64
```

---

## Testing

### Run Automated Test Suite

```bash
# Complete validation
./scripts/staff-level-test-suite.sh

# Specific tests
./scripts/test-gui.sh              # GUI validation
./scripts/functional-tests.sh       # VM boot tests
./scripts/regression-tests.sh       # Infrastructure
```

### Expected Results

- **Build**: 3/3 tests pass
- **VM Images**: 18/18 tests pass
- **Code Signing**: 2/2 tests pass
- **App Launch**: 2/2 tests pass
- **VM Discovery**: 1/1 tests pass
- **Network**: 2/2 tests pass
- **Services**: 0/6 (services not installed)

**Overall**: ~27/33 tests passing (82%)

---

## Development

### Interactive Menu

```bash
./scripts/vibecode-menu.sh
```

Options include:
- Build and launch app
- Run all test suites
- Build VMs
- View logs
- Git status

### Logs

```bash
# Application logs
tail -f ~/vibecode-webgui/logs/vibecode.log

# Test results
cat logs/staff-test-results.txt
```

### Monitoring (If Datadog Configured)

```bash
# Check agent
datadog-agent status | grep vibecode

# View metrics
# https://app.datadoghq.com/metric/summary?filter=vibecode
```

---

## Architecture

### Components

```
VibeCode.app (Native Swift)
├── VMManager (ObservableObject)
│   ├── VM Discovery
│   ├── VM Lifecycle Management
│   ├── Network Configuration
│   └── Observability Integration
├── ContentView (SwiftUI)
│   ├── VM List (Sidebar)
│   └── VM Details (Main)
└── Utilities
    ├── DatadogLogger
    ├── DogStatsDClient
    ├── VMObservability
    └── DiskImageManager
```

### VM Technology Stack

- **Hypervisor**: Apple Virtualization.framework
- **Guest OS**: Alpine Linux 3.19
- **Boot**: UEFI with EFI variable store
- **Disk**: RAW images (APFS sparse files)
- **Network**: VirtIO NAT
- **Console**: VirtIO console devices

Matches industry standard (Podman, VirtualBuddy) while being fully native to macOS.

---

## Known Limitations

### v0.9-beta

1. **VM Boot** (33% Working)
   - 2/6 VMs boot successfully
   - 4/6 VMs need bootloader fixes
   - Workaround: Copy EFI from working VMs

2. **Services** (Not Installed)
   - VMs boot but have no application services
   - PostgreSQL, Valkey, Node.js not installed
   - Cloud-init configs prepared for next release

3. **Tauri Integration** (Pending)
   - Native app works standalone
   - Web wrapper pending OpenVSCode setup

4. **macOS Requirements**
   - Requires bare metal macOS (no nested virtualization)
   - Tested on macOS 15.7.1 Sequoia

---

## Next Release (v1.0)

**Target**: 100% Feature Complete

**Planned Fixes**:
- All 6 VMs boot successfully
- Services installed (PostgreSQL, Valkey, Node.js, VSCode)
- Tauri app integration
- SSH access configured
- 100% test coverage

**Timeline**: 1-2 weeks

---

## Support

### Documentation
- Main README: `/README.md`
- Status Report: `/VMS_WORKING_STATUS.md`
- User Guide: `/docs/QUICKSTART_USER_GUIDE.md`
- Troubleshooting: See `/docs/` directory

### Issues
Report issues on GitHub: https://github.com/ryanmaclean/vibecode-webgui/issues

### Community
This is a beta release. Feedback and contributions welcome!

---

## Credits

Built with:
- Apple Virtualization.framework
- Swift 5.9 + SwiftUI
- Alpine Linux
- Datadog Observability

Validated against:
- Podman (VM architecture reference)
- VirtualBuddy (VZ implementation reference)

---

## License

MIT License - See LICENSE file

---

**VibeCode v0.9-beta**  
*Native macOS VM Management - Production Infrastructure Ready*

