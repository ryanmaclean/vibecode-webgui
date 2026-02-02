# Core VM Management

**Component:** BaseVMManager and VM Configuration
**Purpose:** Unified VM lifecycle management for all VibeCode applications
**Technology:** Pure Swift 6 + Apple Virtualization.framework (macOS Native)
**Status:** Phase 1 - Core Infrastructure

---

## 🔧 Technology Stack

**Uses ONLY Apple's native Virtualization.framework:**
- ✅ `VZVirtualMachine` - VM instance management
- ✅ `VZLinuxBootLoader` - Kernel boot
- ✅ `VZVirtioConsoleDeviceSerialPortConfiguration` - Console I/O
- ✅ `VZVirtioSocketDeviceConfiguration` - vsock communication
- ✅ `VZGenericPlatformConfiguration` - ARM64 platform

**NOT using:**
- ❌ vfkit, QEMU, VMware, or any external VM tools
- ❌ Command-line VM executables
- ❌ Third-party VM frameworks

---

## Overview

The Core module provides the foundational building blocks for all VM applications:

- **BaseVMManager**: Abstract base class managing VM lifecycle
- **VMConfiguration**: Builders and strategies for VM setup
- **Template Methods**: Customization points for subclasses
- **Native VZ APIs**: Pure Apple Virtualization.framework

---

## BaseVMManager

The heart of the Core module. BaseVMManager handles:

- VM creation and configuration
- Start/stop lifecycle
- Console monitoring
- Network monitoring
- State management (@Published properties)
- Error handling

### Public Interface

```swift
class BaseVMManager: NSObject, ObservableObject {
    // Published state
    @Published public var status: String
    @Published public var isRunning: Bool
    @Published public var consoleOutput: String
    @Published public var serverURL: String?
    @Published public var vmIPAddress: String?

    // Lifecycle
    public func startVM()
    public func stopVM()

    // Template methods (override in subclass)
    open func createNetworkingStrategy() -> NetworkingStrategy
    open func getKernelCommandLine() -> String
    open func getInitramfsResource() -> String
    open func getCPUCount() -> Int
    open func getMemorySize() -> UInt64

    // Lifecycle hooks (override for custom behavior)
    open func onVMStarted()
    open func onVMStopped()
    open func onVMError(_ error: Error)
    open func onServerReady(url: String)
    open func onIPAddressDetected(ip: String)
}
```

### Usage Example

```swift
import Foundation
import Virtualization

final class BasicVMManager: BaseVMManager {
    override func getKernelCommandLine() -> String {
        return "console=hvc0 debug loglevel=8 ipv6.disable=1"
    }

    override func getInitramfsResource() -> String {
        return "bun-openvscode"
    }

    override func onServerReady(url: String) {
        super.onServerReady(url: url)
        print("OpenVSCode server ready at: \(url)")
    }
}
```

---

## Template Methods

BaseVMManager uses the Template Method pattern to allow customization:

### Configuration Methods

Override these to customize VM configuration:

```swift
override func getCPUCount() -> Int {
    return 4  // Default is 2
}

override func getMemorySize() -> UInt64 {
    return 2 * 1024 * 1024 * 1024  // 2GB (default is 1GB)
}

override func getKernelCommandLine() -> String {
    return "console=hvc0 debug loglevel=8 custom_param=value"
}

override func getInitramfsResource() -> String {
    return "custom-initramfs"  // Name of .cpio.gz in bundle
}

override func getKernelResource() -> String {
    return "vmlinux-raw"  // Default kernel name
}

override func createNetworkingStrategy() -> NetworkingStrategy {
    return VsockNetworkStrategy()  // Default is NAT
}
```

### Lifecycle Hooks

Override these to add custom behavior at lifecycle points:

```swift
override func onVMStarted() {
    super.onVMStarted()  // Always call super first
    // Custom startup logic
    print("VM started with custom configuration")
}

override func onVMStopped() {
    super.onVMStopped()
    // Custom cleanup logic
}

override func onVMError(_ error: Error) {
    super.onVMError(error)
    // Custom error handling
    logErrorToExternalService(error)
}

override func onServerReady(url: String) {
    super.onServerReady(url: url)
    // Custom server ready logic
    openBrowserAutomatically(url)
}

override func onIPAddressDetected(ip: String) {
    super.onIPAddressDetected(ip: ip)
    // Custom IP detection logic
    updateDNSRecord(ip)
}
```

---

## VM Configuration

VM configuration is handled internally by BaseVMManager, but can be customized through:

### Configuration Builder Pattern

```swift
// Inside BaseVMManager
private func createVMConfiguration() throws -> VZVirtualMachineConfiguration {
    let config = VZVirtualMachineConfiguration()

    // CPU and Memory (customizable via template methods)
    config.cpuCount = getCPUCount()
    config.memorySize = getMemorySize()

    // Bootloader (customizable via template methods)
    let bootloader = try createBootloader()
    config.bootLoader = bootloader

    // Networking (customizable via strategy)
    let networkingStrategy = createNetworkingStrategy()
    try networkingStrategy.configure(config)

    // Serial console
    try configureSerialConsole(config)

    // Other devices
    configureStandardDevices(config)

    try config.validate()
    return config
}
```

---

## Console Monitoring

BaseVMManager automatically monitors console output:

### Automatic Features

1. **Console Log File**: `/tmp/vibecode-console-{timestamp}.log`
2. **Real-time Updates**: Published to `consoleOutput` property
3. **Server Detection**: Automatically detects when server is ready
4. **Pattern Matching**: Customizable patterns for service detection

### Custom Console Patterns

```swift
override func checkServerReady(consoleOutput: String) -> String? {
    // Default checks for "Server will be available"
    // Override to check for custom patterns
    if consoleOutput.contains("My custom server ready message") {
        return "http://localhost:8080"
    }
    return nil
}
```

---

## Network Monitoring

BaseVMManager integrates with DHCPLeaseMonitor:

### Automatic Features

1. **DHCP Monitoring**: Tracks VM IP address via DHCP leases
2. **MAC Address Tracking**: Each VM gets unique MAC address
3. **IP Detection**: Published to `vmIPAddress` property
4. **URL Updates**: Server URL updated when IP detected

### Custom Networking

```swift
override func createNetworkingStrategy() -> NetworkingStrategy {
    // Use different strategy
    return BridgeNetworkStrategy()
}
```

See [Networking/README.md](../Networking/README.md) for strategy details.

---

## State Management

BaseVMManager is an ObservableObject with @Published properties:

```swift
@Published public var status: String         // "Stopped", "Starting...", "Running", "Ready", "Error: ..."
@Published public var isRunning: Bool        // true when VM is running
@Published public var consoleOutput: String  // Latest console output (tail)
@Published public var serverURL: String?     // nil until server is ready
@Published public var vmIPAddress: String?   // nil until DHCP lease detected
```

### Using in SwiftUI

```swift
struct MyView: View {
    @StateObject private var vmManager = MyVMManager()

    var body: some View {
        VStack {
            Text(vmManager.status)

            if let url = vmManager.serverURL {
                Link("Open Server", destination: URL(string: url)!)
            }

            if let ip = vmManager.vmIPAddress {
                Text("VM IP: \(ip)")
            }

            ScrollView {
                Text(vmManager.consoleOutput)
                    .font(.system(.caption, design: .monospaced))
            }
        }
    }
}
```

---

## Error Handling

BaseVMManager provides comprehensive error handling:

### Automatic Error Handling

1. **Configuration Errors**: Missing kernel/initramfs, invalid config
2. **Runtime Errors**: VM start failure, crash, stop failure
3. **Resource Errors**: File access, bundle resource loading
4. **Network Errors**: DHCP monitoring, network configuration

### Custom Error Handling

```swift
override func onVMError(_ error: Error) {
    super.onVMError(error)

    // Log to observability provider
    observabilityProvider?.logError(error)

    // Show user-friendly message
    if error.localizedDescription.contains("kernel") {
        self.status = "Error: Kernel not found in bundle"
    }
}
```

---

## Best Practices

### DO ✅

```swift
// Extend BaseVMManager
final class MyVMManager: BaseVMManager {
    // Override only what you need
}

// Always call super in hooks
override func onVMStarted() {
    super.onVMStarted()  // Important!
    // Your custom logic
}

// Use template methods for configuration
override func getCPUCount() -> Int {
    return 4
}
```

### DON'T ❌

```swift
// Don't create standalone VM managers
class MyVMManager: ObservableObject {  // ❌ Wrong!
    // ...duplicate code...
}

// Don't skip super calls in hooks
override func onVMStarted() {
    // super.onVMStarted()  // ❌ Missing!
    // Your custom logic
}

// Don't modify VM directly
override func startVM() {
    vm?.start()  // ❌ Wrong! Use template methods
}
```

---

## Testing

### Unit Testing BaseVMManager Subclasses

```swift
import XCTest
@testable import VibeCodeKit

final class MyVMManagerTests: XCTestCase {
    var manager: MyVMManager!

    override func setUp() {
        super.setUp()
        manager = MyVMManager()
    }

    func testCustomConfiguration() {
        XCTAssertEqual(manager.getCPUCount(), 4)
        XCTAssertEqual(manager.getKernelCommandLine(), "console=hvc0 custom=1")
    }

    func testLifecycleHooks() {
        let expectation = expectation(description: "onVMStarted called")
        manager.onVMStartedHandler = {
            expectation.fulfill()
        }
        manager.startVM()
        waitForExpectations(timeout: 5)
    }
}
```

### Integration Testing

See [../Testing/README.md](../Testing/README.md) for integration test patterns.

---

## Common Patterns

### Minimal VM App

```swift
final class MinimalVMManager: BaseVMManager {
    // Uses all defaults - just works!
}
```

### Custom CPU/Memory

```swift
final class PowerfulVMManager: BaseVMManager {
    override func getCPUCount() -> Int { 8 }
    override func getMemorySize() -> UInt64 { 4 * 1024 * 1024 * 1024 }
}
```

### Custom Networking

```swift
final class VsockVMManager: BaseVMManager {
    override func createNetworkingStrategy() -> NetworkingStrategy {
        return VsockNetworkStrategy()
    }
}
```

### Custom Hooks

```swift
final class ObservableVMManager: BaseVMManager {
    private let observability: ObservabilityProvider

    init(observability: ObservabilityProvider) {
        self.observability = observability
        super.init()
    }

    override func onVMStarted() {
        super.onVMStarted()
        observability.recordEvent("vm.started")
    }

    override func onVMError(_ error: Error) {
        super.onVMError(error)
        observability.recordError(error)
    }
}
```

---

## Troubleshooting

### Issue: "Kernel not found in bundle"
**Solution**: Ensure `vmlinux-raw` is in your app bundle, or override `getKernelResource()`

### Issue: "Initramfs not found"
**Solution**: Ensure `{name}.cpio.gz` is in bundle, where `{name}` matches `getInitramfsResource()`

### Issue: "VM starts but no IP address"
**Solution**: Check DHCP leases file permissions, ensure NAT networking is configured

### Issue: "Server never becomes ready"
**Solution**: Override `checkServerReady()` with correct pattern for your server

### Issue: "SwiftUI view not updating"
**Solution**: Ensure you use `@StateObject` (not `@ObservedObject`) for the manager

---

## Reference

- [BaseVMManager.swift](./BaseVMManager.swift) - Implementation
- [Networking/README.md](../Networking/README.md) - Network strategies
- [Observability/README.md](../Observability/README.md) - Observability integration
- [REFACTORING-IN-PROGRESS.md](../../REFACTORING-IN-PROGRESS.md) - Migration guide
