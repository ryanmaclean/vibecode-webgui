# Quick Fix Guide: Enable Networking in VibeCode SwiftUI Apps

## Problem
No eth0 interface appears in VM - only loopback (lo) interface.

## Root Cause
Alpine Linux kernel (`vmlinux-raw`) missing virtio-net driver.

## Solution: Use Alpine Virt Kernel (5 minutes)

### Step 1: Download Alpine Virt Kernel

```bash
cd ~/.vfkit/vms/vibecode-alpine/kernel/

# Download Alpine virt ISO with virtio drivers
curl -LO https://dl-cdn.alpinelinux.org/alpine/v3.19/releases/aarch64/alpine-virt-3.19.9-aarch64.iso

# Mount and extract kernel
hdiutil attach alpine-virt-3.19.9-aarch64.iso
cp /Volumes/alpine-virt-*/boot/vmlinuz-virt ./vmlinuz-virt.gz
hdiutil detach /Volumes/alpine-virt-*

# Decompress kernel
gunzip -c vmlinuz-virt.gz > vmlinuz-virt-uncompressed

# Verify
ls -lh vmlinuz-virt-uncompressed
```

### Step 2: Update BasicVibeCode.app

Edit `/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/BasicVibeCodeApp.swift`:

```swift
// Change this line (around line 155):
guard let kernel = Bundle.main.url(forResource: "vmlinux-raw", withExtension: nil) else {

// To:
guard let kernel = Bundle.main.url(forResource: "vmlinuz-virt-uncompressed", withExtension: nil) else {
```

### Step 3: Update LiquidGlassVibeCode.app

Edit `/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/LiquidGlassVibeCodeApp.swift`:

```swift
// Change this line (around line 368):
guard let kernel = Bundle.main.url(forResource: "vmlinux-raw", withExtension: nil) else {

// To:
guard let kernel = Bundle.main.url(forResource: "vmlinuz-virt-uncompressed", withExtension: nil) else {
```

### Step 4: Copy New Kernel to App Bundles

```bash
# For BasicVibeCode
cp ~/.vfkit/vms/vibecode-alpine/kernel/vmlinuz-virt-uncompressed \
   /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/BasicVibeCode.app/Contents/Resources/

# For LiquidGlassVibeCode
cp ~/.vfkit/vms/vibecode-alpine/kernel/vmlinuz-virt-uncompressed \
   /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/LiquidGlassVibeCode.app/Contents/Resources/

# Verify
ls -lh /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/BasicVibeCode.app/Contents/Resources/vmlinuz*
```

### Step 5: Test

```bash
# Launch app
open /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/BasicVibeCode.app

# Wait 10 seconds for boot
sleep 10

# Check console log for eth0
tail -30 /tmp/vibecode-console.log
```

Expected output:
```
Network interfaces:
1: lo: <LOOPBACK,UP,LOWER_UP> ...
2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> ...  <-- SUCCESS!
```

## Verification Checklist

- [ ] Alpine virt ISO downloaded
- [ ] Kernel extracted and decompressed
- [ ] BasicVibeCodeApp.swift updated
- [ ] LiquidGlassVibeCodeApp.swift updated
- [ ] Kernel copied to BasicVibeCode.app/Contents/Resources/
- [ ] Kernel copied to LiquidGlassVibeCode.app/Contents/Resources/
- [ ] App launches without errors
- [ ] Console log shows eth0 interface
- [ ] OpenVSCode server binds to 0.0.0.0:3000
- [ ] Can access http://localhost:3000 from macOS host

## Alternative: Direct Path (No App Bundle Modification)

Instead of bundling the kernel in the .app, use direct file path:

```swift
// In createVMConfiguration()
let home = FileManager.default.homeDirectoryForCurrentUser.path
let kernel = URL(fileURLWithPath: "\(home)/.vfkit/vms/vibecode-alpine/kernel/vmlinuz-virt-uncompressed")
// Remove the Bundle.main.url check
```

This is simpler for development but less portable.

## Troubleshooting

### Issue: "Kernel not found in bundle"
**Solution:** Ensure kernel was copied to .app/Contents/Resources/ directory

### Issue: "Invalid kernel format"
**Solution:** Make sure kernel is decompressed (use `gunzip`)

### Issue: Still no eth0
**Solution:** Check kernel has virtio support:
```bash
strings ~/.vfkit/vms/vibecode-alpine/kernel/vmlinuz-virt-uncompressed | grep virtio_net
# Should show results
```

### Issue: App won't start after changes
**Solution:** Re-sign the app:
```bash
codesign --force --deep --sign - BasicVibeCode.app
```

## Success Indicators

When working correctly, console log will show:

```
[    0.xxx] virtio_net: device registered
Detecting network interfaces...
Found interface: eth0
eth0 is up
Attempting DHCP on eth0...
Network interfaces:
1: lo: <LOOPBACK,UP,LOWER_UP> ...
2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> ...
    inet 192.168.127.x/24 ...
```

And OpenVSCode will start normally without MAC address errors.

## For More Details

See: `/Users/ryan.maclean/vibecode-webgui/NETWORK_TESTING_REPORT.md`
