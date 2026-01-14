//
// NATNetworkStrategy.swift
// VibeCode
//
// Created: 2025-11-25
// Migration Status: NEW
// Purpose: NAT networking strategy for VMs (standard, no special entitlements required)
//
// Part of refactoring effort: See REFACTORING-IN-PROGRESS.md
//

import Foundation
import Virtualization
import Network

/// NAT networking strategy using Apple's VZNATNetworkDeviceAttachment with optional vsock support.
///
/// This is the default and most common networking strategy for VMs:
/// - No special entitlements required
/// - Automatic DHCP IP assignment
/// - NAT'd internet access
/// - Port forwarding possible
/// - Firewall-friendly
/// - Optional vsock for direct host-guest communication
///
/// ## Usage
///
/// Use with BaseVMManager:
///
/// ```swift
/// final class MyVMManager: BaseVMManager {
///     override func createNetworkingStrategy() -> NetworkingStrategy {
///         return NATNetworkStrategy()
///     }
/// }
/// ```
///
/// Or with custom MAC address for stable DHCP leases:
///
/// ```swift
/// override func createNetworkingStrategy() -> NetworkingStrategy {
///     return NATNetworkStrategy(macAddress: "52:54:00:12:34:90")
/// }
/// ```
///
/// ## How NAT Networking Works
///
/// 1. VM gets a network device with NAT attachment
/// 2. macOS assigns VM an IP via DHCP (typically 192.168.64.x range)
/// 3. VM can access internet through host's connection
/// 4. Host can access VM via VM's IP address
/// 5. External machines cannot directly access VM (NAT'd)
///
/// ## DHCP Lease Tracking
///
/// The MAC address is used to track the VM's IP via DHCP leases:
/// - Leases stored in `/var/db/dhcpd_leases`
/// - Monitored by DHCPLeaseMonitor
/// - IP published to BaseVMManager.vmIPAddress
///
/// ## Comparison with Other Strategies
///
/// **NAT (this strategy)**
/// - ✅ No entitlements needed
/// - ✅ Works everywhere
/// - ✅ Firewall-friendly
/// - ⚠️ VM not directly accessible from network
///
/// **Bridge Networking**
/// - ❌ Requires com.apple.vm.networking entitlement (restricted)
/// - ✅ VM gets IP on local network
/// - ✅ Directly accessible from network
/// - ⚠️ Requires admin setup
///
/// **Vsock**
/// - ✅ No entitlements needed
/// - ✅ Direct host-guest communication
/// - ⚠️ Requires proxy for internet access
/// - ⚠️ More complex setup
///
public class NATNetworkStrategy: NetworkingStrategy {

    // MARK: - Properties

    /// MAC address for the VM's network interface
    private let macAddress: String

    /// Enable vsock for direct host-guest communication
    private let enableVsock: Bool

    /// Port forwards for vsock connections (guest port -> host port)
    private let portForwards: [(guestPort: UInt32, hostPort: UInt16)]

    /// Vsock proxy servers (one per port forward)
    private var proxyServers: [VsockProxyServer] = []

    /// Queue for vsock operations
    private let vsockQueue = DispatchQueue(label: "com.vibecode.vsock", qos: .userInitiated)

    // MARK: - Initialization

    /// Create a NAT networking strategy.
    ///
    /// - Parameters:
    ///   - macAddress: MAC address for the network device.
    ///     If nil, generates a random MAC address.
    ///     Use a stable MAC address for consistent DHCP leases.
    ///   - enableVsock: Enable vsock for direct host-guest communication (default: true)
    ///   - portForwards: Array of (guestPort, hostPort) tuples for vsock forwarding.
    ///     Default: [(3000, 3000)] - forwards guest port 3000 to host port 3000
    ///
    /// Example:
    /// ```swift
    /// // Random MAC with default port forwarding (3000 -> 3000)
    /// let strategy1 = NATNetworkStrategy()
    ///
    /// // Fixed MAC with multiple port forwards
    /// let strategy2 = NATNetworkStrategy(
    ///     macAddress: "52:54:00:12:34:90",
    ///     portForwards: [(3000, 3000), (8080, 8080)]
    /// )
    ///
    /// // NAT only (no vsock)
    /// let strategy3 = NATNetworkStrategy(enableVsock: false)
    /// ```
    public init(macAddress: String? = nil, enableVsock: Bool = true, portForwards: [(guestPort: UInt32, hostPort: UInt16)] = [(3000, 3000)]) {
        if let mac = macAddress {
            self.macAddress = mac
        } else {
            // Generate random MAC address
            self.macAddress = Self.generateRandomMAC()
        }

        self.enableVsock = enableVsock
        self.portForwards = portForwards

        NSLog("[NATNetworkStrategy] Initialized with MAC: \(self.macAddress), vsock: \(enableVsock), forwards: \(portForwards)")
    }

    /// Create a NAT networking strategy with stable MAC based on seed.
    ///
    /// Use this for deterministic MAC addresses (same seed = same MAC).
    ///
    /// - Parameter seed: Unique string to seed MAC generation (e.g., VM ID or app name)
    ///
    /// Example:
    /// ```swift
    /// let strategy = NATNetworkStrategy.withStableMAC(seed: "BasicVibeCode")
    /// // Always generates the same MAC for "BasicVibeCode"
    /// ```
    public static func withStableMAC(seed: String) -> NATNetworkStrategy {
        let mac = Self.generateStableMACInternal(seed: seed)
        return NATNetworkStrategy(macAddress: mac)
    }

    // MARK: - NetworkingStrategy Protocol

    public func configure(_ config: VZVirtualMachineConfiguration) throws {
        NSLog("[NATNetworkStrategy] Configuring NAT networking...")

        // Validate MAC address format
        guard isValidMACAddress(macAddress) else {
            throw NetworkError.invalidMACAddress(macAddress)
        }

        // Create network device configuration
        let net = VZVirtioNetworkDeviceConfiguration()

        // Set MAC address
        guard let vzMACAddress = VZMACAddress(string: macAddress) else {
            throw NetworkError.invalidMACAddress(macAddress)
        }
        net.macAddress = vzMACAddress

        // Use NAT attachment (no special entitlements required)
        net.attachment = VZNATNetworkDeviceAttachment()

        // Add to configuration
        config.networkDevices = [net]

        // Add vsock device for direct host-guest communication (if enabled)
        if enableVsock {
            let socketDevice = VZVirtioSocketDeviceConfiguration()
            config.socketDevices = [socketDevice]
            NSLog("[NATNetworkStrategy] Vsock device configured for \(portForwards.count) port forwards")
        }

        NSLog("[NATNetworkStrategy] NAT networking configured successfully")
    }

    public func setupConnectivity(_ manager: BaseVMManager) {
        // NAT networking is automatic - no special setup needed
        // VM will get DHCP IP automatically
        // DHCP monitoring is handled by BaseVMManager
        NSLog("[NATNetworkStrategy] NAT connectivity active (automatic DHCP)")

        // Start vsock proxy server if enabled
        if enableVsock {
            startProxyServer(manager: manager)
        }
    }

    public func teardown() {
        // Stop all vsock proxy servers
        if enableVsock {
            for proxy in proxyServers {
                proxy.stop()
            }
            proxyServers.removeAll()
            NSLog("[NATNetworkStrategy] All vsock proxies stopped")
        }

        NSLog("[NATNetworkStrategy] NAT networking teardown complete")
    }

    public func getMACAddress() -> String {
        return macAddress
    }

    // MARK: - Private Helpers

    /// Start the vsock proxy servers.
    ///
    /// This creates and starts multiple VsockProxyServer instances, one for each
    /// port forward configuration. Each forwards TCP connections from
    /// localhost:hostPort to the guest VM on guestPort via vsock.
    ///
    /// - Parameter manager: The VM manager instance (to access the VM and socket device)
    private func startProxyServer(manager: BaseVMManager) {
        NSLog("[NATNetworkStrategy] startProxyServer() called, checking VM...")

        // FIXED: Property is 'vm' not 'virtualMachine'
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
            // Filter only VZVirtioSocketDevice from socketDevices array
            guard let device = vm.socketDevices.compactMap({ $0 as? VZVirtioSocketDevice }).first else {
                NSLog("[NATNetworkStrategy] ERROR: Cannot start proxy - no VZVirtioSocketDevice found")
                NSLog("[NATNetworkStrategy] VM socketDevices count: \(vm.socketDevices.count)")
                if let first = vm.socketDevices.first {
                    NSLog("[NATNetworkStrategy] First device type: \(type(of: first))")
                }
                return
            }

            NSLog("[NATNetworkStrategy] Socket device found, creating \(self.portForwards.count) proxy servers...")

            // Create and start a proxy server for each port forward
            for (guestPort, hostPort) in self.portForwards {
                let proxy = VsockProxyServer(
                    device: device,
                    guestPort: guestPort,
                    hostPort: hostPort,
                    queue: self.vsockQueue
                )

                NSLog("[NATNetworkStrategy] Starting proxy server (guest:\(guestPort), host:\(hostPort))...")

                proxy.start { success in
                    if success {
                        NSLog("[NATNetworkStrategy] ✓ Vsock proxy started successfully on localhost:\(hostPort)")
                    } else {
                        NSLog("[NATNetworkStrategy] ERROR: Failed to start vsock proxy on port \(hostPort)")
                    }
                }

                self.proxyServers.append(proxy)
            }

            NSLog("[NATNetworkStrategy] All \(self.proxyServers.count) proxy servers started")
        }
    }

    /// Validate MAC address format.
    ///
    /// Valid format: "XX:XX:XX:XX:XX:XX" where X is hex digit (0-9, A-F, a-f)
    ///
    /// - Parameter mac: MAC address string to validate
    /// - Returns: true if valid format, false otherwise
    private func isValidMACAddress(_ mac: String) -> Bool {
        let pattern = "^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$"
        let regex = try? NSRegularExpression(pattern: pattern)
        let range = NSRange(mac.startIndex..., in: mac)
        return regex?.firstMatch(in: mac, range: range) != nil
    }

    /// Generate a random locally-administered MAC address.
    ///
    /// Format: 52:54:00:XX:XX:XX (common for VMs)
    /// - 52:54:00 is a common prefix for virtual machines
    /// - Last 3 octets are random
    ///
    /// - Returns: Random MAC address string
    private static func generateRandomMAC() -> String {
        let prefix = "52:54:00"
        let randomBytes = (0..<3).map { _ in
            String(format: "%02x", Int.random(in: 0...255))
        }
        return "\(prefix):\(randomBytes.joined(separator: ":"))"
    }

    /// Generate a stable MAC address based on a seed string.
    ///
    /// Uses simple hash to convert seed to MAC address bytes.
    /// Same seed always produces same MAC.
    ///
    /// - Parameter seed: Unique string to seed generation
    /// - Returns: Stable MAC address string
    private static func generateStableMACInternal(seed: String) -> String {
        let hash = seed.hashValue
        let bytes = [
            0x52,  // Fixed prefix for virtual machines
            0x54,
            0x00,
            UInt8((hash >> 16) & 0xFF),
            UInt8((hash >> 8) & 0xFF),
            UInt8(hash & 0xFF)
        ]
        return bytes.map { String(format: "%02x", $0) }.joined(separator: ":")
    }
}

// MARK: - Common Pre-defined Strategies

public extension NATNetworkStrategy {

    /// Pre-defined strategy for BasicVibeCode app.
    ///
    /// Uses stable MAC: 52:54:00:12:34:90
    static var basicVibeCode: NATNetworkStrategy {
        return NATNetworkStrategy(macAddress: "52:54:00:12:34:90")
    }

    /// Pre-defined strategy for LiquidGlass app.
    ///
    /// Uses stable MAC: 52:54:00:12:34:91
    static var liquidGlass: NATNetworkStrategy {
        return NATNetworkStrategy(macAddress: "52:54:00:12:34:91")
    }

    /// Pre-defined strategy for NetworkTest apps.
    ///
    /// Uses stable MAC: 52:54:00:12:34:92
    static var networkTest: NATNetworkStrategy {
        return NATNetworkStrategy(macAddress: "52:54:00:12:34:92")
    }
}

// MARK: - Documentation Examples

/*
 USAGE EXAMPLES
 ==============

 1. Basic usage with random MAC:
 --------------------------------
 class MyVMManager: BaseVMManager {
     override func createNetworkingStrategy() -> NetworkingStrategy {
         return NATNetworkStrategy()
     }
 }


 2. Usage with stable MAC (recommended):
 ----------------------------------------
 class MyVMManager: BaseVMManager {
     override func createNetworkingStrategy() -> NetworkingStrategy {
         return NATNetworkStrategy(macAddress: "52:54:00:12:34:90")
     }
 }


 3. Usage with pre-defined strategy:
 ------------------------------------
 class BasicVMManager: BaseVMManager {
     override func createNetworkingStrategy() -> NetworkingStrategy {
         return NATNetworkStrategy.basicVibeCode
     }
 }


 4. Usage with seed-based MAC:
 ------------------------------
 class MyVMManager: BaseVMManager {
     override func createNetworkingStrategy() -> NetworkingStrategy {
         return NATNetworkStrategy.withStableMAC(seed: "my-unique-vm-id")
     }
 }


 5. Accessing VM IP in UI:
 --------------------------
 struct MyView: View {
     @StateObject private var vmManager = MyVMManager()

     var body: some View {
         VStack {
             if let ip = vmManager.vmIPAddress {
                 Text("VM IP: \(ip)")
             }

             if let url = vmManager.serverURL {
                 Link("Open Server", destination: URL(string: url)!)
             }
         }
     }
 }


 6. Port forwarding with NAT (using external tools):
 ----------------------------------------------------
 // Note: VZNATNetworkDeviceAttachment doesn't support programmatic
 // port forwarding. Use macOS firewall rules or external tools:

 // Example using pfctl:
 // echo "rdr pass on lo0 inet proto tcp from any to any port 8080 -> 192.168.64.5 port 3000" | sudo pfctl -ef -

 // Better: Access VM directly via its IP (vmIPAddress property)


 7. Testing strategy in isolation:
 ----------------------------------
 func testNATStrategy() {
     let strategy = NATNetworkStrategy(macAddress: "52:54:00:12:34:90")

     XCTAssertEqual(strategy.getMACAddress(), "52:54:00:12:34:90")

     let config = VZVirtualMachineConfiguration()
     try strategy.configure(config)

     XCTAssertEqual(config.networkDevices.count, 1)
     XCTAssertTrue(config.networkDevices[0].attachment is VZNATNetworkDeviceAttachment)
 }


 8. Multiple VMs with different MACs:
 -------------------------------------
 class VM1Manager: BaseVMManager {
     override func createNetworkingStrategy() -> NetworkingStrategy {
         return NATNetworkStrategy(macAddress: "52:54:00:12:34:01")
     }
 }

 class VM2Manager: BaseVMManager {
     override func createNetworkingStrategy() -> NetworkingStrategy {
         return NATNetworkStrategy(macAddress: "52:54:00:12:34:02")
     }
 }

 // Each VM gets its own IP via DHCP, tracked by MAC address
 */
