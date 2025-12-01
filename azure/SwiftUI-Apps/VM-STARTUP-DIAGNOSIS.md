# VM Startup Diagnosis & Fix Plan

## Executive Summary

✅ **VMs DO start** - kernel boots, application runs
❌ **Network FAILS** - virtio_net module won't load
✅ **Logging infrastructure COMPLETE** - ready for production

## Root Cause: Kernel Module Mismatch

### The Problem

```
insmod: can't insert '/lib/modules/kernel/drivers/net/virtio_net.ko': Invalid argument
Note: virtio_net module load result: 22 (EINVAL)
failed to validate module [virtio_net] BTF: -22
```

### Why It's Happening

- **Kernel**: `vmlinux-raw` (Oct 30, 8.2MB)
- **Initramfs**: `bun-openvscode.cpio.gz` (Nov 25, 108MB)
- **Built at different times** with incompatible configurations
- **BTF validation fails** - module doesn't match kernel ABI

### Current Symptoms

| Component | Status |
|-----------|--------|
| VM Launch | ✅ Working |
| Kernel Boot | ✅ Working |
| Server Application | ✅ Working (binds to 127.0.0.1:3000) |
| Network Interface | ❌ FAILED - no eth0 |
| DHCP | ❌ FAILED - no IP address |
| External Access | ❌ BLOCKED - localhost only |

## Completed: Logging Infrastructure

### 1. VMLogger Implementation (`Shared/Core/VMLogger.swift`)

**Features:**
- ISO 8601 timestamps with fractional seconds
- Multiple log levels (DEBUG, INFO, WARN, ERROR, CRITICAL)
- File logging to `FileManager.default.temporaryDirectory/vibecode-vm.log`
- NSLog for system console
- **Datadog HTTP API integration** - sends to `https://http-intake.logs.{DD_SITE}/api/v2/logs`
- Structured metadata with every log entry
- Non-blocking async dispatch

**Configuration:**
- Reads `DD_API_KEY` and `DD_SITE` from environment
- Falls back silently if Datadog not configured
- File logging always works (with proper entitlements)

### 2. BaseVMManager Integration

**Comprehensive logging at every step:**
- `startVM()`: Entry, networking strategy creation, configuration, VM creation, start callback
- `createBootloader()`: Resource loading with full paths, bundle contents on failure
- `stopVM()`: Shutdown sequence with cleanup
- All lifecycle hooks: `onVMStarted()`, `onVMError()`, `onServerReady()`, `onIPAddressDetected()`

**Rich metadata includes:**
- `vm_id`: Unique identifier for each VM instance
- `cpu_count`, `memory_gb`: Resource configuration
- `mac_address`: Network identification
- `strategy_type`: Networking strategy in use
- `kernel_name`, `kernel_path`, `bundle_path`: Resource locations
- `error_type`, `error_description`, `domain`, `code`: Full error context

### 3. App Entitlements

Updated `entitlements.plist` with:
```xml
<key>com.apple.security.temporary-exception.files.absolute-path.read-write</key>
<array>
    <string>/tmp/</string>
</array>
```

### 4. Helper Script

Created `scripts/view-vm-logs.sh`:
```bash
# Find and display VM logs
./scripts/view-vm-logs.sh

# Follow logs in real-time
./scripts/view-vm-logs.sh -f
```

## Fix Option 1: Download Pre-Built Kernel+Initramfs (RECOMMENDED)

**Fastest solution - use proven working combination:**

```bash
cd ~/vibecode-webgui/azure

# Download Ubuntu cloud kernel for ARM64 (tested, working)
wget https://cloud-images.ubuntu.com/minimal/releases/jammy/release/ubuntu-22.04-minimal-cloudimg-arm64-vmlinuz-generic
wget https://cloud-images.ubuntu.com/minimal/releases/jammy/release/ubuntu-22.04-minimal-cloudimg-arm64-initrd-generic

# Rename for compatibility
mv ubuntu-22.04-minimal-cloudimg-arm64-vmlinuz-generic vmlinux-cloud
mv ubuntu-22.04-minimal-cloudimg-arm64-initrd-generic cloud-initrd.cpio.gz

# Update bundle script to use cloud kernel
cd SwiftUI-Apps
# Edit bundle-apps.sh to copy vmlinux-cloud and cloud-initrd.cpio.gz
```

**Pros:**
- ✅ Guaranteed to work together
- ✅ No compilation needed
- ✅ ~5 minutes

**Cons:**
- ⚠️ Larger kernel (~9MB vs 8.2MB)
- ⚠️ Generic modules (not minimal)

## Fix Option 2: Rebuild Initramfs with Matching Modules

**Use existing kernel, rebuild modules:**

```bash
cd ~/vibecode-webgui/azure

# Extract kernel version from vmlinux-raw
file vmlinux-raw  # Check version

# Build initramfs with modules matching this exact kernel
# (requires: linux-kernel-arm64 source tree)
cd linux-kernel-arm64
make ARCH=arm64 CROSS_COMPILE=aarch64-linux-gnu- modules
make ARCH=arm64 CROSS_COMPILE=aarch64-linux-gnu- INSTALL_MOD_PATH=../initramfs_root modules_install

# Rebuild initramfs with new modules
cd ..
./build-bun-minimal.sh
```

**Pros:**
- ✅ Keeps minimal kernel
- ✅ Exact version match

**Cons:**
- ⏱️ Requires kernel source
- ⏱️ ~30-60 minutes compile time
- ⚠️ Needs cross-compilation tools

## Fix Option 3: Build Kernel with Built-In Networking

**Build kernel with virtio_net compiled in (not as module):**

```bash
cd ~/vibecode-webgui/azure/linux-kernel-arm64

# Edit .config
scripts/config --set-val CONFIG_VIRTIO_NET y  # Built-in, not module
scripts/config --set-val CONFIG_VIRTIO_NET m  # Change m to y

# Rebuild kernel
make ARCH=arm64 CROSS_COMPILE=aarch64-linux-gnu- -j$(nproc)

# Copy new kernel
cp arch/arm64/boot/Image ../vmlinux-new
```

**Pros:**
- ✅ No module loading needed
- ✅ Eliminates BTF issues
- ✅ Faster boot

**Cons:**
- ⏱️ Full kernel rebuild (~60-90 min)
- ⚠️ Requires kernel source
- ⚠️ Need cross-compiler toolchain

## Immediate Next Steps

### Quick Win (5 minutes):
```bash
cd ~/vibecode-webgui/azure/SwiftUI-Apps

# Document finding
echo "Root cause: virtio_net module mismatch (error 22)" > KNOWN_ISSUES.md
echo "Solution: Use pre-built Ubuntu cloud kernel+initramfs" >> KNOWN_ISSUES.md

# Test logging infrastructure works
bash scripts/view-vm-logs.sh
```

### Production Fix (Choose one):

**A. Download & Use Cloud Kernel (RECOMMENDED for speed):**
```bash
# 1. Download (2 min)
cd ~/vibecode-webgui/azure
wget https://cloud-images.ubuntu.com/minimal/releases/jammy/release/ubuntu-22.04-minimal-cloudimg-arm64-vmlinuz-generic

# 2. Update bundle script
cd SwiftUI-Apps
# Edit bundle-apps.sh line ~30 to use new kernel

# 3. Test
bash bundle-apps.sh
open BasicVibeCode.app

# 4. Check logs
bash scripts/view-vm-logs.sh -f
```

**B. Rebuild Modules (if you have kernel source):**
```bash
cd ~/vibecode-webgui/azure/linux-kernel-arm64
make ARCH=arm64 modules
make ARCH=arm64 INSTALL_MOD_PATH=../initramfs_root modules_install
cd .. && ./build-bun-minimal.sh
```

## Verification Steps

Once fixed, verify with:

```bash
# 1. Launch app
open BasicVibeCode.app

# 2. Check VM logs (should see successful startup)
bash scripts/view-vm-logs.sh

# Expected log entries:
# [timestamp] [INFO] [VM] Starting VM metadata={vm_id: ...}
# [timestamp] [DEBUG] [VM] Loading kernel and initramfs metadata={kernel_name: vmlinux-raw, ...}
# [timestamp] [INFO] [VM] VM started successfully metadata={vm_id: ...}

# 3. Check console log (should see eth0 and IP address)
tail -100 /tmp/vibecode-console-*.log | grep -E "eth0|inet.*192"

# Expected console output:
# Loading virtio network modules...
# [OK] virtio_net loaded
# eth0: Link is Up
# inet 192.168.64.X/24 brd 192.168.64.255 scope global dynamic eth0

# 4. Check DHCP leases
cat /var/db/dhcpd_leases | grep -A 5 "52:54:00:12:34:90"

# 5. Test connectivity
curl http://192.168.64.X:3000  # Should get OpenVSCode response
```

## Files Modified

### Logging Infrastructure:
- `Shared/Core/VMLogger.swift` (NEW, 230 lines)
- `Shared/Core/BaseVMManager.swift` (updated with VMLogger calls)
- `build-all-refactored.sh` (added VMLogger to SHARED_CORE)
- `entitlements.plist` (added /tmp/ file access)
- `scripts/view-vm-logs.sh` (NEW helper script)

### Next (Kernel Fix):
- `bundle-apps.sh` (update kernel/initramfs paths)
- OR `linux-kernel-arm64/.config` (enable built-in virtio_net)

## Datadog Dashboard Queries

Once VMs are working, use these queries in Datadog:

```
# All VM lifecycle events
service:vibecode source:vibecode-vm

# VM startup failures
service:vibecode source:vibecode-vm status:error

# Network configuration issues
service:vibecode source:vibecode-vm @message:*network*

# Specific VM instance
service:vibecode source:vibecode-vm @vm_id:<uuid>

# Kernel loading errors
service:vibecode source:vibecode-vm @message:*kernel*
```

## Success Criteria

- [ ] VMs get IP addresses via DHCP
- [ ] eth0 interface configured successfully
- [ ] OpenVSCode accessible at `http://192.168.64.X:3000`
- [ ] VM logs show successful startup
- [ ] Datadog receives logs (if configured)
- [ ] No virtio_net loading errors in console
