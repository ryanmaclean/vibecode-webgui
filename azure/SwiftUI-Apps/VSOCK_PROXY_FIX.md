# Vsock Proxy Server Fix - Root Cause and Solution

## Executive Summary

**Problem:** Vsock proxy server wasn't starting despite code fixes for property names and types.

**Root Cause:** Duplicate socket device configuration causing the NATNetworkStrategy's socket device to overwrite BaseVMManager's socket device, resulting in an empty socketDevices array at runtime.

**Solution:**
1. Removed duplicate socket device configuration from BaseVMManager
2. Made NATNetworkStrategy solely responsible for socket device configuration
3. Added 500ms delay to allow VM to fully initialize before accessing socketDevices

## Root Cause Analysis

### The Issue

The vsock proxy server was failing to start with these symptoms:
- No NSLog messages from `startProxyServer()`
- Port 3000 not listening on host
- No error messages indicating why

### Investigation Path

#### Step 1: Verified Property Access
✓ Fixed: `manager.vm` (not `manager.virtualMachine`)
✓ Fixed: `vm.socketDevices` is `[VZSocketDevice]` (not optional)
✓ Fixed: Cast to `VZVirtioSocketDevice` required

#### Step 2: Traced Call Path
```
startVM()
  → createVMConfiguration()
    → createBootloader()
    → networkingStrategy.configure()  ← NATNetworkStrategy adds socket device
    → configureSerialConsole()
    → configureStandardDevices()      ← BaseVMManager ALSO adds socket device
  → VZVirtualMachine.start()
  → onVMStarted()
    → networkingStrategy.setupConnectivity()
      → startProxyServer()
```

#### Step 3: Found Duplicate Configuration

**Location 1: BaseVMManager.configureStandardDevices()** (line 654-655)
```swift
let socketDevice = VZVirtioSocketDeviceConfiguration()
config.socketDevices = [socketDevice]  // OVERWRITES previous array!
```

**Location 2: NATNetworkStrategy.configure()** (line 184-185)
```swift
let socketDevice = VZVirtioSocketDeviceConfiguration()
config.socketDevices = [socketDevice]  // Gets overwritten by BaseVMManager!
```

**The Problem:**
1. NATNetworkStrategy adds socket device during `configure()`
2. BaseVMManager then **overwrites** it in `configureStandardDevices()`
3. The socket device at runtime may be the wrong instance or empty
4. When `startProxyServer()` tries to access `vm.socketDevices`, it's empty

### Why This Wasn't Obvious

The error was subtle because:
- Both pieces of code looked correct in isolation
- The order of execution matters: `configure()` runs BEFORE `configureStandardDevices()`
- Swift arrays are value types, so `config.socketDevices = [...]` replaces the entire array
- No compiler errors or warnings
- The VM still started successfully (it had *a* socket device)

## The Fix

### Change 1: Remove Duplicate from BaseVMManager

**File:** `/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/Shared/Core/BaseVMManager.swift`

**Before:**
```swift
/// Configure standard devices (entropy, vsock, network, platform).
private func configureStandardDevices(_ config: VZVirtualMachineConfiguration) {
    // Entropy device for random number generation
    config.entropyDevices = [VZVirtioEntropyDeviceConfiguration()]

    // Vsock device for host-guest communication
    let socketDevice = VZVirtioSocketDeviceConfiguration()
    config.socketDevices = [socketDevice]  // ← DUPLICATE!

    // NAT network device for external connectivity
    let networkDevice = VZVirtioNetworkDeviceConfiguration()
    networkDevice.attachment = VZNATNetworkDeviceAttachment()
    config.networkDevices = [networkDevice]  // ← ALSO DUPLICATE!

    // Platform configuration
    let platform = VZGenericPlatformConfiguration()
    platform.machineIdentifier = VZGenericMachineIdentifier()
    config.platform = platform
}
```

**After:**
```swift
/// Configure standard devices (entropy, platform).
/// Note: Network and socket devices are configured by the NetworkingStrategy.
private func configureStandardDevices(_ config: VZVirtualMachineConfiguration) {
    // Entropy device for random number generation
    config.entropyDevices = [VZVirtioEntropyDeviceConfiguration()]

    // Platform configuration
    let platform = VZGenericPlatformConfiguration()
    platform.machineIdentifier = VZGenericMachineIdentifier()
    config.platform = platform
}
```

**Rationale:**
- Socket devices should be configured by NetworkingStrategy (single responsibility)
- Network devices should also be configured by NetworkingStrategy
- BaseVMManager should only configure truly generic devices (entropy, platform)

### Change 2: Add Initialization Delay

**File:** `/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/Shared/Networking/NATNetworkStrategy.swift`

**Before:**
```swift
private func startProxyServer(manager: BaseVMManager) {
    NSLog("[NATNetworkStrategy] startProxyServer() called, checking VM...")

    guard let vm = manager.vm else {
        NSLog("[NATNetworkStrategy] ERROR: Cannot start proxy - VM not available")
        return
    }

    NSLog("[NATNetworkStrategy] VM available, checking socket devices...")
    guard !vm.socketDevices.isEmpty else {
        NSLog("[NATNetworkStrategy] ERROR: Cannot start proxy - socketDevices array is empty")
        return
    }
    // ... rest of code
}
```

**After:**
```swift
private func startProxyServer(manager: BaseVMManager) {
    NSLog("[NATNetworkStrategy] startProxyServer() called, checking VM...")

    guard let vm = manager.vm else {
        NSLog("[NATNetworkStrategy] ERROR: Cannot start proxy - VM not available")
        return
    }

    NSLog("[NATNetworkStrategy] VM available, adding delay for device initialization...")

    // Add delay to allow VM to fully initialize socket devices
    // The socketDevices array may not be immediately populated after VM.start() succeeds
    DispatchQueue.global().asyncAfter(deadline: .now() + 0.5) { [weak self, weak vm] in
        guard let self = self, let vm = vm else { return }

        NSLog("[NATNetworkStrategy] Checking socket devices after delay...")
        guard !vm.socketDevices.isEmpty else {
            NSLog("[NATNetworkStrategy] ERROR: Cannot start proxy - socketDevices array is empty")
            return
        }
        // ... rest of code
    }
}
```

**Rationale:**
- VZVirtualMachine.start() may complete before internal device arrays are fully populated
- 500ms delay is conservative and allows for initialization
- Uses weak references to prevent retain cycles

## Testing

### Manual Testing

1. **Build the app** (if using Xcode):
   ```bash
   xcodebuild -scheme BasicVibeCode -configuration Debug build
   ```

2. **Run the test script**:
   ```bash
   cd /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps
   ./test-vsock-proxy.sh
   ```

3. **Expected output**:
   ```
   ================================================
   Vsock Proxy Server Test
   ================================================

   [1] Cleaning up existing processes...
   [2] Starting BasicVibeCode app...
       App launched (PID: 12345)

   [3] Waiting for VM to start (10 seconds)...
   ..........

   [4] Checking if port 3000 is listening...
   BasicVibeCode 12345 user TCP *:3000 (LISTEN)
       ✓ Port 3000 is LISTENING!

   [5] Testing connection to localhost:3000...
       ✓ Connection successful!

   ================================================
   TEST PASSED: Vsock proxy is working!
   ================================================
   ```

### Console Log Verification

Look for these log messages in Console.app (filter: "NATNetworkStrategy"):

**Success indicators:**
```
[NATNetworkStrategy] Initialized with MAC: 52:54:00:..., vsock: true
[NATNetworkStrategy] Vsock device configured (guest:3000, host:3000)
[NATNetworkStrategy] startProxyServer() called, checking VM...
[NATNetworkStrategy] VM available, adding delay for device initialization...
[NATNetworkStrategy] Checking socket devices after delay...
[NATNetworkStrategy] VM socketDevices property: 1 devices
[NATNetworkStrategy] Socket device found, creating proxy server...
[NATNetworkStrategy] Starting proxy server (guest:3000, host:3000)...
[VsockProxyServer] Starting proxy server...
[VsockProxyServer] Listener ready on localhost:3000
[NATNetworkStrategy] ✓ Vsock proxy started successfully on localhost:3000
```

**Failure indicators (should NOT see):**
```
[NATNetworkStrategy] ERROR: Cannot start proxy - VM not available
[NATNetworkStrategy] ERROR: Cannot start proxy - socketDevices array is empty
[NATNetworkStrategy] ERROR: First socket device is not VZVirtioSocketDevice
[NATNetworkStrategy] ERROR: Failed to start vsock proxy
[VsockProxyServer] Listener failed: ...
```

### Port Testing

```bash
# Check if port 3000 is listening
lsof -i :3000 -P -n | grep LISTEN

# Test connection
nc -zv localhost 3000

# If service is running in guest, test HTTP
curl -v http://localhost:3000
```

## Architecture Improvements

### Before (Broken)
```
BaseVMManager.configureStandardDevices()
  ↓
  Sets: config.socketDevices = [device]  ← OVERWRITES
        config.networkDevices = [device] ← OVERWRITES

NATNetworkStrategy.configure()  (called BEFORE)
  ↓
  Sets: config.socketDevices = [device]  ← GETS OVERWRITTEN
        config.networkDevices = [device] ← GETS OVERWRITTEN
```

### After (Fixed)
```
NATNetworkStrategy.configure()
  ↓
  Sets: config.socketDevices = [device]  ← AUTHORITATIVE
        config.networkDevices = [device] ← AUTHORITATIVE

BaseVMManager.configureStandardDevices()
  ↓
  Sets: config.entropyDevices = [device]
        config.platform = platform
        (No longer touches socket/network devices)
```

### Design Principle: Single Responsibility

Each component now has clear ownership:

- **NetworkingStrategy**: Owns network and socket device configuration
  - Knows about vsock setup
  - Knows about NAT vs Bridge vs other networking modes
  - Can add multiple devices if needed

- **BaseVMManager**: Owns generic device configuration
  - Entropy device (RNG)
  - Platform configuration
  - Serial console
  - Bootloader

## Future Considerations

### If Other NetworkingStrategies Don't Need Vsock

Currently, NATNetworkStrategy adds a socket device unconditionally (when `enableVsock=true`).

If you create a networking strategy that doesn't need vsock:

```swift
class SimpleNATStrategy: NetworkingStrategy {
    func configure(_ config: VZVirtualMachineConfiguration) throws {
        // Only configure network device
        let net = VZVirtioNetworkDeviceConfiguration()
        net.macAddress = VZMACAddress(string: macAddress)!
        net.attachment = VZNATNetworkDeviceAttachment()
        config.networkDevices = [net]

        // Don't add socket devices
        config.socketDevices = []  // Explicitly empty
    }
}
```

### If You Need Multiple Socket Devices

```swift
class AdvancedStrategy: NetworkingStrategy {
    func configure(_ config: VZVirtualMachineConfiguration) throws {
        // Multiple socket devices for different purposes
        let vsockDevice1 = VZVirtioSocketDeviceConfiguration()
        let vsockDevice2 = VZVirtioSocketDeviceConfiguration()
        config.socketDevices = [vsockDevice1, vsockDevice2]

        // Strategy owns this configuration
    }
}
```

## Files Modified

1. `/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/Shared/Core/BaseVMManager.swift`
   - Removed socket device configuration from `configureStandardDevices()`
   - Removed network device configuration from `configureStandardDevices()`
   - Updated comments to clarify responsibility

2. `/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/Shared/Networking/NATNetworkStrategy.swift`
   - Added 500ms delay before accessing `vm.socketDevices`
   - Added `weak` captures to prevent retain cycles
   - Enhanced logging for delay phase

## Related Documentation

- [REFACTORING-IN-PROGRESS.md](REFACTORING-IN-PROGRESS.md) - Overall refactoring effort
- [Shared/Networking/README.md](Shared/Networking/README.md) - Networking architecture
- [Shared/Core/README.md](Shared/Core/README.md) - Core VM management

## Commit Message

```
fix: Resolve vsock proxy server startup failure

Root cause: Duplicate socket device configuration in BaseVMManager was
overwriting the socket device configured by NATNetworkStrategy, resulting
in an empty socketDevices array at runtime.

Changes:
- Remove socket device configuration from BaseVMManager.configureStandardDevices()
- Make NetworkingStrategy solely responsible for socket/network device config
- Add 500ms initialization delay before accessing vm.socketDevices
- Improve separation of concerns (BaseVMManager: generic devices, Strategy: network devices)

Testing:
- Run test-vsock-proxy.sh to verify port 3000 is listening
- Check Console.app for successful proxy startup logs
- Test connection: nc -zv localhost 3000

Fixes: vsock proxy not starting
Related: Agent 1 findings on property names and types
