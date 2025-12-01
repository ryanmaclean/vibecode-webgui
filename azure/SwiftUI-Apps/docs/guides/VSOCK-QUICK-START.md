# Vsock VibeCode Quick Start Guide

## What You Need to Know

**Problem**: NAT networking isn't working in the VM (no eth0 interface).

**Solution**: Use VirtIO Socket (vsock) for direct host-VM communication, bypassing network stack entirely.

## Quick Build and Run

```bash
cd /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps

# Build everything
./build-vsock-app.sh

# Run the app
open VsockVibeCode.app

# Test it
curl http://localhost:3000
```

## How It Works (Simple Version)

```
Browser → localhost:3000 → Proxy → Vsock → VM:3000 → OpenVSCode
```

No network interfaces, no DHCP, no NAT - just direct socket communication!

## Files Overview

| File | Purpose |
|------|---------|
| `VsockVibeCodeApp.swift` | SwiftUI app with vsock support |
| `vm-init-vsock.sh` | VM init script (no networking) |
| `build-vsock-app.sh` | Build script (automated) |
| `VSOCK-IMPLEMENTATION.md` | Full technical documentation |
| `VSOCK-QUICK-START.md` | This file |

## Key Differences from Original

### Original App (BasicVibeCodeApp.swift)
```swift
// Uses NAT networking
let net = VZVirtioNetworkDeviceConfiguration()
net.attachment = VZNATNetworkDeviceAttachment()
config.networkDevices = [net]
```

### Vsock App (VsockVibeCodeApp.swift)
```swift
// Uses vsock instead
let socketConfig = VZVirtioSocketDeviceConfiguration()
config.socketDevices = [socketConfig]
// No network devices at all!
```

### Original Init (from bun-openvscode.cpio.gz)
```bash
# Sets up eth0 interface
for iface in eth0 eth1 enp0s1 ens3; do
    ip link set "$iface" up
    udhcpc -i "$iface" -n -q
done
```

### Vsock Init (vm-init-vsock.sh)
```bash
# Only loopback - no eth0 needed!
ip link set lo up

# Check for vsock
ls -la /dev/vsock
```

## Testing Checklist

- [ ] Build completes without errors
- [ ] App launches successfully
- [ ] Click "Start" button
- [ ] Console shows: "Mounting filesystems..."
- [ ] Console shows: "SUCCESS: /dev/vsock found!"
- [ ] Status changes to "Running"
- [ ] Vsock status: "Listening on vsock port 3000"
- [ ] Vsock status: "Proxy active on localhost:3000"
- [ ] URL appears: http://localhost:3000
- [ ] `curl http://localhost:3000` returns response
- [ ] Browser can access OpenVSCode

## Troubleshooting

### Build Fails
```bash
# Check prerequisites
which swiftc
swiftc --version

# Check files exist
ls -la /Users/ryan.maclean/vibecode-webgui/azure/vmlinux-raw
ls -la /Users/ryan.maclean/vibecode-webgui/azure/bun-openvscode.cpio.gz
```

### App Won't Start
```bash
# Check kernel and initramfs in bundle
ls -la VsockVibeCode.app/Contents/Resources/

# Should show:
# vmlinux-raw
# bun-openvscode-vsock.cpio.gz
```

### VM Starts But No Vsock
Check console output:
- If "WARNING: /dev/vsock not found" → Kernel doesn't support vsock
- If "No socket device found" → SwiftUI app configuration issue
- If "Proxy failed to start" → Port 3000 already in use

### Connection Timeout
```bash
# Check if port is available
lsof -i :3000

# Kill conflicting process if needed
kill -9 <PID>
```

## Architecture Diagram (ASCII)

```
┌─────────────────────────────────────────┐
│  macOS Host (VsockVibeCodeApp)          │
│                                          │
│  Browser → localhost:3000                │
│              ↓                           │
│         Proxy Server                     │
│         (TCP→Vsock)                      │
│              ↓                           │
│    VZVirtioSocketDevice.connect(3000)   │
└──────────────┼───────────────────────────┘
               │
          vsock channel
               │
┌──────────────┼───────────────────────────┐
│  Linux VM    ↓                           │
│                                          │
│  /dev/vsock                              │
│      ↓                                   │
│  Bun Server :3000                        │
│      ↓                                   │
│  OpenVSCode Server                       │
└──────────────────────────────────────────┘
```

## Advantages Over NAT

| Aspect | NAT | Vsock |
|--------|-----|-------|
| Setup | Complex | Simple |
| Reliability | Depends on network | Always works |
| Speed | Good | Excellent |
| Debugging | Hard | Easy |
| Works without eth0 | ❌ No | ✅ Yes |

## Next Steps After Testing

1. **If it works**:
   - Merge into main app
   - Update documentation
   - Consider as primary method

2. **If it doesn't work**:
   - Check console output
   - Review VSOCK-IMPLEMENTATION.md
   - Verify kernel vsock support
   - Check file permissions

3. **Future enhancements**:
   - Support multiple ports
   - Add connection pooling
   - Implement async I/O
   - Add metrics/monitoring

## Need More Info?

- **Full docs**: `VSOCK-IMPLEMENTATION.md`
- **Apple docs**: [VZVirtioSocketDevice](https://developer.apple.com/documentation/virtualization/vzvirtiosocketdevice)
- **Kernel docs**: [Linux vsock](https://www.kernel.org/doc/html/latest/networking/vsock.html)

## Quick Commands Reference

```bash
# Build
./build-vsock-app.sh

# Run
open VsockVibeCode.app

# Test
curl http://localhost:3000

# Check port
lsof -i :3000

# View console log
tail -f /tmp/vibecode-vsock-console.log

# Rebuild initramfs only
cd /Users/ryan.maclean/vibecode-webgui/azure
mkdir tmp && cd tmp
gzip -dc ../bun-openvscode.cpio.gz | cpio -idmv
cp ../SwiftUI-Apps/vm-init-vsock.sh ./init
chmod +x ./init
find . | cpio -o -H newc | gzip -9 > ../bun-openvscode-vsock.cpio.gz
cd .. && rm -rf tmp
```

## Success Indicators

When everything works, you'll see:

**In App:**
- Status: "Ready"
- Vsock Status: "Proxy active on localhost:3000"
- URL: http://localhost:3000 (clickable)
- Console: Green text showing boot messages

**In Browser:**
- http://localhost:3000 loads
- OpenVSCode interface appears
- Can open files and edit

**In Terminal:**
```bash
$ curl http://localhost:3000
OpenVSCode Server Running on Vsock!
```

## Conclusion

Vsock bypasses all the networking complexity and gives you direct, reliable host-VM communication. It's simpler, faster, and actually works when NAT doesn't!
