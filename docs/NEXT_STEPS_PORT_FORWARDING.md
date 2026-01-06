# Next Steps - Port Forwarding Integration

**Quick Reference for Completing Port Forwarding Testing**

---

## What We Accomplished ✅

1. **Identified Root Cause**: Explicit MAC addresses break Apple Virtualization DHCP
2. **Applied Fix**: Changed ValkeyVMManager to auto-generate MAC addresses
3. **Port Forwarding Ready**: VMPortForwarder.swift complete and integrated
4. **Verified Working VM**: Unified VM has Valkey accessible at 192.168.64.3:6379

---

## Current Status

### ✅ Complete
- Swift port forwarding implementation (VMPortForwarder.swift)
- MAC address fix in ValkeyVMManager.swift
- Build script updated with VMPortForwarder.swift
- Documentation created

### ⏳ Pending
- Standalone Valkey initramfs creation
- End-to-end testing with ValkeyVibeCode.app

---

## Step-by-Step Next Actions

### Option 1: Quick Test with Unified VM Workaround

**Goal**: Use existing Unified VM to create standalone Valkey VM

```bash
# 1. Create standalone Valkey initramfs from Unified VM
cd ~/vibecode-webgui/azure
cp unified-services-restored.cpio.gz valkey-standalone-complete.cpio.gz

# 2. Rebuild ValkeyVibeCode.app with fixed MAC address
cd ~/vibecode-webgui/azure/SwiftUI-Apps
./build-standalone-apps.sh

# 3. Launch and test
./ValkeyVibeCode.app/Contents/MacOS/ValkeyVibeCode &
sleep 45  # Wait for boot

# 4. Test port forwarding
redis-cli -h localhost -p 6379 PING
# Expected: PONG

# 5. Verify listener
lsof -i :6379 | grep LISTEN
# Expected: ValkeyVibeCode listening on localhost:6379
```

### Option 2: Build Clean Standalone Valkey VM

**Goal**: Create minimal Alpine Linux with only Valkey

#### 2a. Extract and Modify Unified VM

```bash
cd ~/vibecode-webgui/azure

# Extract unified VM
mkdir -p /tmp/valkey-standalone
cd /tmp/valkey-standalone
gzip -dc ~/vibecode-webgui/azure/unified-services-restored.cpio.gz | cpio -idmv

# Remove unnecessary services (keep only Valkey)
rm -rf usr/bin/postgres*
rm -rf usr/lib/postgres*
rm -rf opt/openvscode-server

# Modify init script to start only Valkey
vi init  # Remove PostgreSQL and OpenVSCode startup

# Repack
find . | cpio -o -H newc | gzip > ~/vibecode-webgui/azure/valkey-standalone-complete.cpio.gz
```

#### 2b. Build from Scratch (More Involved)

```bash
# Use Alpine Linux base
# Include:
# - Valkey binary
# - OpenSSL libraries (libssl.so.3, libcrypto.so.3)
# - DHCP client (udhcpc)
# - Init script from working Unified VM
# - Network configuration that works with Apple Virtualization
```

---

## Testing Checklist

Once ValkeyVibeCode.app is built with proper initramfs:

### 1. Launch Test
```bash
./ValkeyVibeCode.app/Contents/MacOS/ValkeyVibeCode
```

**Look for these log messages**:
```
[NATNetworkStrategy] Initialized with MAC: 52:54:00:XX:XX:XX, vsock: false
[BaseVMManager] VM started successfully
[BaseVMManager] VM IP detected: 192.168.64.X
[ValkeyVM] Starting port forwarding for 192.168.64.X:6379 → localhost:6379
[ValkeyVM] Port forwarding enabled - access Valkey via: redis-cli -h localhost -p 6379
```

### 2. Direct VM Access Test
```bash
# Get VM IP from logs
VM_IP="192.168.64.X"  # Replace with actual IP

# Test direct access
redis-cli -h $VM_IP -p 6379 PING
# Expected: PONG
```

### 3. Port Forwarding Test
```bash
# Test localhost access (via port forwarder)
redis-cli -h localhost -p 6379 PING
# Expected: PONG

# Verify port forwarder is listening
lsof -i :6379 -P -n | grep LISTEN
# Expected: ValkeyVibeCode ... TCP localhost:6379 (LISTEN)
```

### 4. Functional Test
```bash
# Set a key
redis-cli -h localhost -p 6379 SET test_key "Hello from localhost"
# Expected: OK

# Get the key
redis-cli -h localhost -p 6379 GET test_key
# Expected: "Hello from localhost"

# Verify same data via direct VM access
redis-cli -h $VM_IP -p 6379 GET test_key
# Expected: "Hello from localhost"
```

---

## Troubleshooting

### Issue: DHCP Still Fails

**Symptom**:
```
ERROR: DHCP failed to assign IPv4 after 20s
```

**Possible Causes**:
1. Build script didn't pick up MAC address fix → Rebuild
2. Initramfs has wrong network configuration → Use Unified VM initramfs
3. Kernel/driver issue → Verify kernel version matches working Ubuntu VM

**Debug Steps**:
```bash
# Check if MAC address fix was applied
strings ValkeyVibeCode.app/Contents/MacOS/ValkeyVibeCode | grep "52:54:00:12:34:92"
# Should NOT appear if fix applied correctly

# Check console log
tail -f /tmp/vibecode-console-*.log
# Look for DHCP messages
```

### Issue: Port Forwarding Not Starting

**Symptom**: No port forwarding log messages

**Possible Causes**:
1. VM never got IP address → Check DHCP first
2. onIPAddressDetected() not firing → Check DHCPLeaseMonitor
3. Port forwarder failing silently → Add debug logging

**Debug Steps**:
```bash
# Enable verbose logging (add to ValkeyVMManager.swift)
override func onIPAddressDetected(ip: String) {
    NSLog("[DEBUG] onIPAddressDetected called with IP: \(ip)")
    super.onIPAddressDetected(ip: ip)
    // ... rest of implementation
}
```

### Issue: Port Forwarding Listener Fails

**Symptom**: "Address already in use" or no listener on localhost:6379

**Possible Causes**:
1. Another process using port 6379
2. Firewall blocking localhost binding
3. Network framework permissions issue

**Debug Steps**:
```bash
# Check what's using port 6379
lsof -i :6379

# Kill conflicting process
killall redis-server  # If local Redis running

# Try different port
# Edit ValkeyVMManager.swift to use port 6380 instead
```

---

## Success Criteria

Port forwarding is working when:

✅ VM boots and gets DHCP IP
✅ Port forwarder log shows: "Listening on localhost:6379"
✅ `redis-cli -h localhost -p 6379 PING` returns `PONG`
✅ `lsof` shows ValkeyVibeCode listening on localhost:6379
✅ Data is accessible via both localhost and VM IP

---

## Applying to Other VMs

Once Valkey works, apply the same pattern:

### PostgreSQL VM
```swift
// PostgreSQLVMManager.swift
extension NATNetworkStrategy {
    static let postgresql = NATNetworkStrategy(
        macAddress: nil,  // Auto-generate
        enableVsock: false
    )
}

override func onIPAddressDetected(ip: String) {
    super.onIPAddressDetected(ip: ip)
    portForwarder = VMPortForwarder.forwardService(vmIP: ip, serviceName: "PostgreSQL")
    // Port 5432 → localhost:5432
}
```

### Unified Services VM
```swift
// UnifiedServicesVMManager.swift
override func onIPAddressDetected(ip: String) {
    super.onIPAddressDetected(ip: ip)

    // Forward multiple services
    let mappings = [
        VMPortForwarder.PortMapping(vmPort: 6379, hostPort: 6379, name: "Valkey"),
        VMPortForwarder.PortMapping(vmPort: 5432, hostPort: 5432, name: "PostgreSQL"),
        VMPortForwarder.PortMapping(vmPort: 8080, hostPort: 8080, name: "OpenVSCode")
    ]

    portForwarder = VMPortForwarder()
    portForwarder?.startForwarding(vmIP: ip, mappings: mappings)
}
```

---

## Files to Review

### Code
- `azure/SwiftUI-Apps/Apps/ValkeyVibeCodeApp/ValkeyVMManager.swift` - MAC fix applied
- `azure/SwiftUI-Apps/Shared/Networking/VMPortForwarder.swift` - Port forwarding implementation
- `azure/SwiftUI-Apps/build-standalone-apps.sh` - Build configuration

### Documentation
- `docs/MAC_ADDRESS_FIX_AND_PORT_FORWARDING.md` - Complete analysis and fix
- `docs/SWIFT_PORT_FORWARDING_SOLUTION.md` - Port forwarding architecture guide
- `docs/PORT_FORWARDING_INTEGRATION_COMPLETE.md` - Previous status report

### Reference VMs
- `vz-swift/Sources/VibeCodeVM/NetworkConfig.swift` - Working Ubuntu networking
- `vz-swift/Sources/VibeCodeVM/LinuxGUIVM.swift` - Working Ubuntu VM config

---

## Questions & Answers

### Q: Why did explicit MAC addresses break DHCP?

**A**: Apple Virtualization Framework manages DHCP internally and expects to control MAC address generation. External MAC assignment interferes with this internal mechanism.

### Q: Will auto-generated MACs work reliably?

**A**: Yes - the working Ubuntu Desktop 26 VM uses auto-generated MACs and DHCP works perfectly. This is Apple's recommended approach.

### Q: Can we track which VM has which IP?

**A**: Yes - DHCPLeaseMonitor tracks IP assignments by watching network traffic and VM console output. MAC addresses are still available (just auto-generated).

### Q: Is port forwarding as good as gvproxy?

**A**: Yes - VMPortForwarder provides identical functionality in pure Swift:
- TCP bridging from localhost to VM IP
- Support for multiple port mappings
- Automatic lifecycle management
- App Store compatible (unlike gvproxy)

---

## Contact / Issues

If you encounter issues:

1. Check console logs: `/tmp/vibecode-console-*.log`
2. Review VM manager logs: Application stdout
3. Verify DHCP: Look for "VM IP detected" messages
4. Test direct VM access before port forwarding

---

**Last Updated**: 2025-12-01
**Status**: Ready for Testing
**Next Action**: Create standalone Valkey initramfs and rebuild
