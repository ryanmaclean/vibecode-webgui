# Networking Components

**Purpose:** Network configuration strategies and DHCP monitoring
**Status:** Phase 1 - Core Infrastructure

---

## Overview

The Networking module provides:

- **NetworkingStrategy Protocol**: Abstract interface for network configuration
- **NATNetworkStrategy**: Standard NAT networking (no special entitlements)
- **DHCPLeaseMonitor**: Unified DHCP lease monitoring (replaces V1 and V2 parsers)
- **Future Strategies**: Bridge, vsock, custom configurations

---

## NetworkingStrategy Protocol

All network strategies implement this protocol:

```swift
protocol NetworkingStrategy {
    /// Configure network devices on the VM configuration
    func configure(_ config: VZVirtualMachineConfiguration) throws

    /// Setup any post-start connectivity (proxies, monitoring, etc.)
    func setupConnectivity(_ manager: BaseVMManager)

    /// Cleanup on VM stop
    func teardown()

    /// Get the MAC address for DHCP monitoring
    func getMACAddress() -> String
}
```

### Usage Example

```swift
final class MyVMManager: BaseVMManager {
    override func createNetworkingStrategy() -> NetworkingStrategy {
        return NATNetworkStrategy()
    }
}
```

---

## NATNetworkStrategy

Standard NAT networking using Apple's VZNATNetworkDeviceAttachment:

### Features
- No special entitlements required
- Automatic DHCP
- Port forwarding available
- Firewall-friendly

### Example

```swift
let strategy = NATNetworkStrategy()

// Custom MAC address
let strategy = NATNetworkStrategy(macAddress: "52:54:00:12:34:56")

// Use in BaseVMManager
override func createNetworkingStrategy() -> NetworkingStrategy {
    return NATNetworkStrategy(macAddress: "52:54:00:12:34:90")
}
```

---

## DHCPLeaseMonitor

Unified DHCP lease parser replacing both V1 and V2 parsers:

### Features
- Parses `/var/db/dhcpd_leases`
- Tracks IP by MAC address
- Automatic updates
- Thread-safe
- Performance optimized

### Usage Example

```swift
let monitor = DHCPLeaseMonitor(macAddress: "52:54:00:12:34:90")

monitor.startMonitoring(interval: 1.0) { ip in
    print("VM IP detected: \(ip)")
}

// Later...
monitor.stopMonitoring()
```

### Integration with BaseVMManager

BaseVMManager automatically uses DHCPLeaseMonitor:

```swift
// Automatic in BaseVMManager - no code needed!
// IP address published to vmIPAddress property
```

---

## Creating Custom Network Strategies

### Example: Bridge Network Strategy

```swift
class BridgeNetworkStrategy: NetworkingStrategy {
    private let bridgeInterface: String
    private let macAddress: String

    init(bridgeInterface: String = "en0") {
        self.bridgeInterface = bridgeInterface
        self.macAddress = generateRandomMAC()
    }

    func configure(_ config: VZVirtualMachineConfiguration) throws {
        let net = VZVirtioNetworkDeviceConfiguration()
        net.macAddress = VZMACAddress(string: macAddress)!

        // Note: Requires com.apple.vm.networking entitlement
        guard let interface = VZBridgedNetworkInterface.networkInterfaces
            .first(where: { $0.identifier == bridgeInterface }) else {
            throw NetworkError.interfaceNotFound
        }

        net.attachment = VZBridgedNetworkDeviceAttachment(interface: interface)
        config.networkDevices = [net]
    }

    func setupConnectivity(_ manager: BaseVMManager) {
        // Setup monitoring if needed
    }

    func teardown() {
        // Cleanup
    }

    func getMACAddress() -> String {
        return macAddress
    }
}
```

---

## Best Practices

### DO ✅
- Use NATNetworkStrategy for most cases
- Set stable MAC addresses for consistent DHCP
- Use DHCPLeaseMonitor for IP detection
- Implement teardown() for cleanup

### DON'T ❌
- Don't hardcode network interfaces
- Don't assume bridge networking works (needs entitlement)
- Don't parse DHCP leases manually (use DHCPLeaseMonitor)
- Don't forget to call teardown()

---

## Reference

- [NetworkingStrategy.swift](./NetworkingStrategy.swift)
- [NATNetworkStrategy.swift](./NATNetworkStrategy.swift)
- [DHCPLeaseMonitor.swift](./DHCPLeaseMonitor.swift)
