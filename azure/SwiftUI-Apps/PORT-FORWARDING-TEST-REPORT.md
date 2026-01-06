# VMPortForwarder Test Report
**Date:** 2025-12-02  
**VM:** ValkeyVibeCodeApp  
**Status:** ❌ FAILURE - Port forwarding not working

---

## Executive Summary

The VMPortForwarder implementation is **NOT working** due to a critical bug in the DHCP lease monitoring system. The port forwarder is never started because `onIPAddressDetected()` is never called.

### Root Cause

**MAC Address Mismatch Between Strategy and DHCP Leases**

1. ValkeyVMManager uses `NATNetworkStrategy(macAddress: nil)`
2. When `nil`, the strategy generates a random MAC in format: `52:54:00:XX:XX:XX` (with leading zeros)
3. Apple Virtualization writes DHCP leases in non-standard format: `52:54:0:XX:XX:XX` (without leading zeros)
4. DHCPLeaseMonitor searches for the wrong MAC format and never finds the IP
5. `onIPAddressDetected()` callback is never fired
6. VMPortForwarder is never instantiated

---

## Test Results

### 1. VM Status ✅
- **VM IP:** 192.168.64.3
- **VM State:** Running
- **Valkey Service:** Accessible at 192.168.64.3:6379
- **Direct Connection:** ✅ WORKS

```bash
$ redis-cli -h 192.168.64.3 -p 6379 PING
PONG
```

### 2. Port Forwarding Status ❌
- **Localhost Port 6379:** ❌ NOT listening
- **Port Forwarder Instance:** ❌ NOT created
- **ValkeyVibeCode Listeners:** None on port 6379

```bash
$ nc -z localhost 6379
Connection refused

$ lsof -c ValkeyVibeCode -i :6379
(no output - not listening)
```

### 3. DHCP Lease Detection ❌
- **VM MAC Address (Actual):** `52:54:0:e0:17:c3` (from ARP & DHCP leases)
- **Strategy MAC Address:** `52:54:00:XX:XX:XX` (random, with leading zeros)
- **DHCP Lease Found:** ❌ NO (MAC format mismatch)

```bash
$ arp -a | grep 192.168.64.3
? (192.168.64.3) at 52:54:0:e0:17:c3 on bridge100

$ cat /var/db/dhcpd_leases | grep 192.168.64.3 -A 1
ip_address=192.168.64.3
hw_address=1,52:54:0:e0:17:c3
```

### 4. Code Flow Analysis

**Expected Flow:**
```
ValkeyVMManager.start()
  ↓
BaseVMManager.startVM()
  ↓
NATNetworkStrategy.setupConnectivity()
  ↓
DHCPLeaseMonitor.startMonitoring(macAddress: "52:54:00:XX:XX:XX")
  ↓
[Monitors /var/db/dhcpd_leases every 1 second]
  ↓
[Finds MAC "52:54:0:e0:17:c3" in leases] ← ❌ FAILS HERE
  ↓
onIPFound callback fired with IP "192.168.64.3"
  ↓
BaseVMManager.onIPAddressDetected(ip: "192.168.64.3")
  ↓
ValkeyVMManager.onIPAddressDetected(ip: "192.168.64.3")
  ↓
VMPortForwarder.forwardService(vmIP: "192.168.64.3", serviceName: "Valkey")
  ↓
[Creates NWListener on localhost:6379]
  ↓
[Forwards connections to 192.168.64.3:6379]
```

**Actual Flow:**
```
ValkeyVMManager.start()
  ↓
BaseVMManager.startVM()
  ↓
NATNetworkStrategy.setupConnectivity()
  ↓
DHCPLeaseMonitor.startMonitoring(macAddress: "52:54:00:XX:XX:XX")
  ↓
[Monitors /var/db/dhcpd_leases every 1 second]
  ↓
[NEVER finds matching MAC - format mismatch]
  ↓
❌ STOPS HERE - callback never fired
```

---

## Technical Details

### Issue: MAC Address Format Inconsistency

**DHCP Leases File Format (macOS):**
```
hw_address=1,52:54:0:e0:17:c3    ← Missing leading zeros
```

**NATNetworkStrategy generateRandomMAC():**
```swift
private static func generateRandomMAC() -> String {
    let prefix = "52:54:00"  // ← Always uses leading zeros
    let randomBytes = (0..<3).map { _ in
        String(format: "%02x", Int.random(in: 0...255))  // ← %02x = leading zeros
    }
    return "\(prefix):\(randomBytes.joined(separator: ":"))"
}
```

**Result:**
- Strategy generates: `52:54:00:e0:17:c3`
- DHCP file contains: `52:54:0:e0:17:c3`
- DHCPLeaseMonitor searches for first, finds second → NO MATCH

### Additional Problem: Auto-Generated MAC

Even if the format were fixed, there's a second issue:

The strategy generates a **different random MAC** each time it's instantiated:
1. First random MAC is generated in `NATNetworkStrategy.init()` (used for DHCP monitoring)
2. VM gets a DIFFERENT random MAC from Apple Virtualization
3. These two MACs don't match

---

## Recommendations

### 🔴 Critical Fix Required

**Option 1: Use Fixed MAC Address (RECOMMENDED)**

Change ValkeyVMManager to use a fixed MAC address:

```swift
extension NATNetworkStrategy {
    static let valkey = NATNetworkStrategy(
        macAddress: "52:54:00:12:34:92",  // ← Fixed MAC
        enableVsock: false
    )
}
```

**Pros:**
- ✅ Consistent across restarts
- ✅ Stable DHCP leases
- ✅ DHCP monitor will find IP
- ✅ Port forwarding will work

**Option 2: Fix DHCPLeaseMonitor to Handle Non-Standard Format**

Update `DHCPLeaseMonitor.extractMACFromHwAddress()` to normalize MAC format:

```swift
private static func extractMACFromHwAddress(_ hwAddress: String) -> String {
    let macParts = hwAddress.split(separator: ",")
    let mac = macParts.count > 1 ? String(macParts[1]) : hwAddress
    let normalized = mac.trimmingCharacters(in: .whitespaces)
    
    // Normalize MAC format: add leading zeros to single-digit octets
    let octets = normalized.split(separator: ":")
    let paddedOctets = octets.map { octet in
        octet.count == 1 ? "0\(octet)" : String(octet)
    }
    return paddedOctets.joined(separator: ":")
}
```

**Pros:**
- ✅ Handles both formats (52:54:0:XX and 52:54:00:XX)
- ✅ Works with any MAC address
- ✅ Auto-generated MACs will work

**Cons:**
- ⚠️ Still has the "different random MAC" issue (VM vs Strategy)

**Option 3: Get Actual VM MAC After Configuration**

Modify NATNetworkStrategy to read the actual MAC from the VM after configuration:

```swift
public func configure(_ config: VZVirtualMachineConfiguration) throws {
    let net = VZVirtioNetworkDeviceConfiguration()
    
    if macAddress == nil {
        // Let VZ auto-generate MAC
        net.macAddress = VZMACAddress(string: "52:54:00:00:00:00")!  // Temp
    } else {
        net.macAddress = VZMACAddress(string: macAddress)!
    }
    
    // Store the actual MAC that was assigned
    self.actualMAC = net.macAddress.string  // ← Use this for DHCP monitoring
}
```

---

## Immediate Action Items

1. **Change ValkeyVMManager to use fixed MAC** (quickest fix)
2. **Test port forwarding works with fixed MAC**
3. **Update DHCPLeaseMonitor to normalize MAC format** (prevents future issues)
4. **Document MAC address requirements** in code comments
5. **Add unit test** for MAC format normalization

---

## Files Involved

| File | Issue | Fix Required |
|------|-------|--------------|
| `Apps/ValkeyVibeCodeApp/ValkeyVMManager.swift` | Uses `macAddress: nil` | Change to fixed MAC |
| `Shared/Networking/DHCPLeaseMonitor.swift` | Doesn't normalize MAC format | Add format normalization |
| `Shared/Networking/NATNetworkStrategy.swift` | Generates MAC with leading zeros | No change needed |
| `Shared/Networking/VMPortForwarder.swift` | Works correctly (not the issue) | No change needed |

---

## Success Criteria

Port forwarding is working when:

✅ `lsof -c ValkeyVibeCode -i :6379` shows LISTEN on localhost  
✅ `nc -z localhost 6379` succeeds  
✅ `redis-cli -h localhost -p 6379 PING` returns PONG  
✅ Console logs show:
```
[ValkeyVM] Starting port forwarding for 192.168.64.X:6379 → localhost:6379
[ValkeyVM] Port forwarding enabled - access Valkey via: redis-cli -h localhost -p 6379
[Valkey] Port forwarder ready: localhost:6379 → 192.168.64.X:6379
```

---

## Conclusion

The VMPortForwarder implementation itself is **correct and well-designed**. The failure is due to a **DHCP monitoring issue** caused by MAC address format inconsistency. This is easily fixable by using a fixed MAC address in ValkeyVMManager.

**Estimated Fix Time:** 5 minutes  
**Recommended Fix:** Option 1 (use fixed MAC address)
