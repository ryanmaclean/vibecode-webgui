# VM Boot Failure - Complete Root Cause Analysis

**Investigation Date:** 2026-01-14
**Agents Deployed:** P (Swift Analysis), Q (Boot Test), R (Git Investigation)
**Status:** 🔴 TWO CRITICAL BLOCKERS IDENTIFIED

---

## Executive Summary

The UnifiedServicesVibeCodeApp VM boot failure has **TWO ROOT CAUSES**:

1. **IMMEDIATE BLOCKER:** Code signature violation (OSStatus -67030)
2. **UNDERLYING BLOCKER:** Swift property access bugs in BaseVMManager

Both must be fixed for VM to boot successfully.

---

## BLOCKER #1: Code Signature Violation

### Discovery (Agent Q)

The app crashes **immediately on launch** with code signature validation failure. The VM initialization code never runs.

### Root Cause

```
App signed:          2026-01-14 08:45:12
initramfs modified:  2026-01-14 09:25:14  ← 40 minutes AFTER signing
vmlinux modified:    2026-01-14 09:27:22  ← 42 minutes AFTER signing
```

macOS detected the sealed resource hash mismatch and refused to launch the app.

### Evidence

- **Crash report:** `~/Library/Logs/DiagnosticReports/UnifiedServicesVibeCode-2026-01-14-092907.ips`
- **Error message:** "The code signature is not valid"
- **Verification:** `codesign --verify` confirms "a sealed resource is missing or invalid"
- **Process behavior:** App launches (PID created) but dies in `_libsecinit_appsandbox`

### Test Results (2-minute observation)

```
✓ Process launched: YES (PID 93907)
✗ vfkit started: NO
✗ Kernel accessed: NO
✗ VM booted: NO
✗ Ports listening: NO (2222, 6379, 5432, 8080, 2375)
✗ SSH available: NO
✗ ARP entry: NO
```

### Fix

```bash
cd azure/SwiftUI-Apps
codesign --force --deep --sign - \
  --entitlements entitlements.plist \
  Apps/UnifiedServicesVibeCodeApp.app
```

---

## BLOCKER #2: Swift Property Access Bugs

### Discovery (Agent P)

Critical bugs in BaseVMManager.swift and NATNetworkStrategy.swift prevent VM initialization even if code signature is fixed.

### Bug #1: Invalid Property Access in BaseVMManager

**Location:** `BaseVMManager.swift:233` (in NATNetworkStrategy context)

```swift
guard let vm = manager.vm else {  // ❌ ERROR: 'vm' property NOT accessible
    NSLog("[NATNetworkStrategy] ERROR: Cannot start proxy - VM not available")
    return
}
```

**Why It Breaks:**
- `vm` property is declared as `internal var vm: VZVirtualMachine?`
- `NATNetworkStrategy` tries to access `manager.vm`
- Property is not accessible due to internal visibility
- Swift compiler error or runtime crash

**Fix Options:**
1. Make property public: `public internal(set) var vm: VZVirtualMachine?`
2. Add protocol method: `func getVM() -> VZVirtualMachine?`
3. Disable vsock entirely

### Bug #2: Type Casting Issue

**Location:** `NATNetworkStrategy.swift:246-248`

```swift
// ❌ WRONG: Casts entire array, fails if ANY device is not VZVirtioSocketDevice
guard let socketDevices = vm.socketDevices as? [VZVirtioSocketDevice],
      let device = socketDevices.first else {
```

**Why It Fails:**
- VM has multiple device types (network, serial, entropy, etc.)
- Cast fails if ANY device in array is not a socket device
- Will ALWAYS FAIL with mixed device types

**Fix:**
```swift
// ✓ CORRECT: Filters only socket devices
guard let device = vm.socketDevices.compactMap({ $0 as? VZVirtioSocketDevice }).first else {
```

### Bug #3: Race Condition in DHCPLeaseMonitor

**Location:** `BaseVMManager.swift:858`

```swift
dhcpMonitor = DHCPLeaseMonitor(macAddress: macAddress, vmManager: self)
```

**Why It's Problematic:**
- DHCPLeaseMonitor takes `vmManager: AnyObject?` parameter
- Uses reflection to access console log: `Mirror(reflecting: vmManager)`
- Console log file might not exist yet
- `consoleLogPath` property is private, making reflection fragile

---

## BLOCKER #3: Breaking Commit Identified

### Discovery (Agent R)

Git investigation identified the exact commit that introduced the bugs.

### Breaking Commit

```
Commit: 38be7f201f44bce6be987b55c1f7253648c0eccd
Author: Ryan MacLean
Date: Tue Jan 13 16:41:40 2026 -0800
Message: feat: Complete Unified Services v3.2.0 with enhanced networking and testing
```

### Timeline

```
2026-01-13 13:28:26  ✅ 4f2a643ec - Working (Ralph Loop v3.2.0)
2026-01-13 16:41:40  ❌ 38be7f201 - BROKEN (Enhanced networking) ← BREAKING COMMIT
2026-01-14 08:09:57  📝 455af4dc6 - Merged to main (still broken)
2026-01-14 08:45:00  🚨 Problem reported by user
```

**Time since breaking change:** ~16 hours

### Key Changes in Breaking Commit

1. **DHCPLeaseMonitor refactoring** (479 lines changed)
   - Changed from static methods to instance-based pattern
   - Added VM manager reference requirement
   - Introduced console output parsing
   - Changed from timer-based to instance pattern

2. **MAC address change** in UnifiedServicesVMManager
   ```swift
   - macAddress: "52:54:00:12:34:99"  // Fixed MAC (working)
   + macAddress: nil                   // Auto-generate (broken)
   ```

3. **Port forwarding timing** added 0.5s delay
   ```swift
   DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in
       self?.portForwarder = VMPortForwarder.forwardCommonPorts(vmIP: ip)
   }
   ```

### Comparison with Working Apps

**Working Apps (Valkey, PostgreSQL):**
```swift
extension NATNetworkStrategy {
    static let valkey = NATNetworkStrategy(
        macAddress: nil,
        enableVsock: false  // No vsock = no proxy issues
    )
}
```

**Broken App (UnifiedServices):**
```swift
return NATNetworkStrategy(
    macAddress: nil,
    enableVsock: false  // But default is true in init!
)
```

**Hidden Issue:** `NATNetworkStrategy` init has `enableVsock: Bool = true` as default, so vsock code may still run in some code paths.

---

## Why VM Won't Boot - Complete Failure Chain

1. ✓ User runs UnifiedServicesVibeCodeApp
2. ✓ macOS attempts to launch app
3. ✗ **Code signature check fails** (resources modified after signing)
4. ✗ **App crashes in sandbox init** (never reaches Swift code)
5. — VM initialization code never executes
6. — Even if it did, property access bugs would crash it

**Result:** No console output, no SSH, no services, no VM

---

## Files Requiring Fixes

All paths are absolute:

1. `/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/Apps/UnifiedServicesVibeCodeApp.app`
   - **Fix:** Re-sign after initramfs changes

2. `/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/Shared/Core/BaseVMManager.swift`
   - **Lines:** 95 (vm property), 233 (property access), 858 (DHCP monitor)

3. `/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/Shared/Networking/NATNetworkStrategy.swift`
   - **Lines:** 233 (vm access), 246-248 (type casting)

4. `/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/Shared/Networking/DHCPLeaseMonitor.swift`
   - **Lines:** 123-127 (vmManager reference), 164-204 (console parsing)

5. `/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/Apps/UnifiedServicesVibeCodeApp/UnifiedServicesVMManager.swift`
   - **Lines:** 42-46 (vsock config), 52-65 (port forwarding timing)

---

## Recommended Fix Strategy

### IMMEDIATE (Priority 1)

Fix code signature to allow app to launch:

```bash
cd /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps
codesign --force --deep --sign - \
  --entitlements entitlements.plist \
  Apps/UnifiedServicesVibeCodeApp.app
```

### SHORT-TERM (Priority 2)

Fix Swift property access bugs:

1. **Make vm property accessible:**
   ```swift
   public internal(set) var vm: VZVirtualMachine?
   ```

2. **Fix type casting:**
   ```swift
   guard let device = vm.socketDevices.compactMap({ $0 as? VZVirtioSocketDevice }).first else {
   ```

3. **Remove vmManager dependency from DHCPLeaseMonitor:**
   - Use delegate pattern instead of reflection
   - Or make console log accessible via protocol

### LONG-TERM (Priority 3)

Consider reverting the breaking changes:

```bash
git revert 38be7f201f44bce6be987b55c1f7253648c0eccd
```

Or refactor the DHCPLeaseMonitor to be more robust.

---

## Testing Plan

After fixes are applied:

1. **Verify app launches:**
   ```bash
   open Apps/UnifiedServicesVibeCodeApp.app
   ps aux | grep UnifiedServicesVibeCode  # Should show running process
   ```

2. **Wait for VM boot (2 minutes):**
   ```bash
   sleep 120
   ```

3. **Check services with CLI:**
   ```bash
   vibecode check
   ```

4. **Expected results:**
   ```
   ✓ SSH: localhost:2222
   ✓ Valkey: localhost:6379
   ✓ PostgreSQL: localhost:5432
   ✓ OpenVSCode: http://localhost:8080
   ✓ Docker: localhost:2375
   ```

5. **Regression test other apps:**
   ```bash
   # Ensure Valkey and PostgreSQL apps still work
   open Apps/ValkeyVibeCodeApp.app
   open Apps/PostgreSQLVibeCodeApp.app
   ```

---

## Evidence Files Created

1. **Agent P Report:** (in this file, Swift Analysis section)
2. **Agent Q Report:** `AGENT_Q_BOOT_ISOLATION_TEST_REPORT.md`
3. **Agent Q Summary:** `AGENT_Q_QUICK_SUMMARY.md`
4. **Agent R Report:** (in this file, Git Investigation section)

---

## Conclusion

The VM boot failure has a **dual root cause**:

1. **Code signature violation** prevents app from launching
2. **Swift property access bugs** would prevent VM initialization even if app launched

Both must be fixed. The code signature issue is the immediate blocker and must be resolved first before we can test the Swift fixes.

**Next Action:** Re-sign the app, then fix the Swift bugs.

---

**Investigation Complete**
**Agents:** P (Swift), Q (Boot Test), R (Git)
**Date:** 2026-01-14
**Status:** Ready for fixes
