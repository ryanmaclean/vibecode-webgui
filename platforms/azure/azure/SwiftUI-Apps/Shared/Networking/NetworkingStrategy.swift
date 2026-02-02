//
// NetworkingStrategy.swift
// VibeCode
//
// Created: 2025-11-25
// Migration Status: NEW
// Purpose: Protocol defining network configuration strategies for VMs
//
// Part of refactoring effort: See REFACTORING-IN-PROGRESS.md
//

import Foundation
import Virtualization

/// Protocol for VM networking configuration strategies.
///
/// NetworkingStrategy defines how a VM's network devices are configured and managed.
/// Different strategies can be used for different networking approaches:
/// - NAT networking (VZNATNetworkDeviceAttachment)
/// - Bridged networking (VZBridgedNetworkDeviceAttachment)
/// - Vsock networking (VZVirtioSocketDeviceConfiguration)
/// - Custom networking solutions
///
/// ## Usage
///
/// Implement this protocol to create a custom networking strategy:
///
/// ```swift
/// class MyNetworkStrategy: NetworkingStrategy {
///     func configure(_ config: VZVirtualMachineConfiguration) throws {
///         // Configure network devices
///         let net = VZVirtioNetworkDeviceConfiguration()
///         net.macAddress = VZMACAddress(string: getMACAddress())!
///         net.attachment = VZNATNetworkDeviceAttachment()
///         config.networkDevices = [net]
///     }
///
///     func setupConnectivity(_ manager: BaseVMManager) {
///         // Setup monitoring, proxies, etc.
///     }
///
///     func teardown() {
///         // Cleanup resources
///     }
///
///     func getMACAddress() -> String {
///         return "52:54:00:12:34:56"
///     }
/// }
/// ```
///
/// Then use it in your VM manager:
///
/// ```swift
/// final class MyVMManager: BaseVMManager {
///     override func createNetworkingStrategy() -> NetworkingStrategy {
///         return MyNetworkStrategy()
///     }
/// }
/// ```
///
/// ## Strategy Pattern
///
/// NetworkingStrategy follows the Strategy pattern:
/// - Protocol defines the interface
/// - Multiple implementations provide different behaviors
/// - BaseVMManager delegates networking to the strategy
/// - Strategies are swappable at runtime
///
public protocol NetworkingStrategy {

    /// Configure network devices on the VM configuration.
    ///
    /// This method is called during VM configuration creation, before the VM starts.
    /// Add network device configurations to the provided VZVirtualMachineConfiguration.
    ///
    /// Example:
    /// ```swift
    /// func configure(_ config: VZVirtualMachineConfiguration) throws {
    ///     let net = VZVirtioNetworkDeviceConfiguration()
    ///     net.macAddress = VZMACAddress(string: "52:54:00:12:34:56")!
    ///     net.attachment = VZNATNetworkDeviceAttachment()
    ///     config.networkDevices = [net]
    /// }
    /// ```
    ///
    /// - Parameter config: The VM configuration to add network devices to
    /// - Throws: Configuration errors (e.g., invalid MAC address, missing interfaces)
    func configure(_ config: VZVirtualMachineConfiguration) throws

    /// Setup connectivity after VM has started.
    ///
    /// This method is called after the VM successfully starts.
    /// Use it to setup:
    /// - Proxies or port forwarding
    /// - Network monitoring
    /// - Connection pooling
    /// - Custom routing
    ///
    /// Example:
    /// ```swift
    /// func setupConnectivity(_ manager: BaseVMManager) {
    ///     // Start a proxy server
    ///     proxyServer.start(vmIP: manager.vmIPAddress)
    ///
    ///     // Setup port forwarding
    ///     setupPortForward(from: 3000, to: manager.vmIPAddress)
    /// }
    /// ```
    ///
    /// - Parameter manager: The VM manager (provides access to VM state)
    func setupConnectivity(_ manager: BaseVMManager)

    /// Teardown networking resources when VM stops.
    ///
    /// This method is called when the VM stops (either requested or crashed).
    /// Use it to cleanup:
    /// - Stop proxy servers
    /// - Close connections
    /// - Remove port forwarding rules
    /// - Free network resources
    ///
    /// Example:
    /// ```swift
    /// func teardown() {
    ///     proxyServer?.stop()
    ///     connectionPool?.closeAll()
    ///     removePortForwardingRules()
    /// }
    /// ```
    func teardown()

    /// Get the MAC address used for this VM's network interface.
    ///
    /// This MAC address is used for:
    /// - Setting the VM's network device MAC address
    /// - DHCP lease monitoring (tracking IP by MAC)
    /// - Network identification and filtering
    ///
    /// MAC address format: "XX:XX:XX:XX:XX:XX" (e.g., "52:54:00:12:34:56")
    ///
    /// Best practices:
    /// - Use stable MAC addresses for consistent DHCP leases
    /// - Use locally administered addresses (second hex digit should be 2, 6, A, or E)
    /// - Avoid conflicts with other VMs or physical devices
    ///
    /// Example:
    /// ```swift
    /// func getMACAddress() -> String {
    ///     // Generate stable MAC based on VM ID
    ///     return "52:54:00:12:34:\(vmID.suffix(2))"
    /// }
    /// ```
    ///
    /// - Returns: MAC address string in format "XX:XX:XX:XX:XX:XX"
    func getMACAddress() -> String
}

// MARK: - Common Helper Functions

extension NetworkingStrategy {

    /// Generate a random locally-administered MAC address.
    ///
    /// The generated MAC address:
    /// - Starts with 52:54:00 (common prefix for virtual machines)
    /// - Has random last 3 octets
    /// - Is locally administered (not globally unique)
    ///
    /// Use this if you don't need stable MAC addresses across VM restarts.
    ///
    /// - Returns: Random MAC address string
    func generateRandomMAC() -> String {
        let prefix = "52:54:00"
        let randomBytes = (0..<3).map { _ in
            String(format: "%02x", Int.random(in: 0...255))
        }
        return "\(prefix):\(randomBytes.joined(separator: ":"))"
    }

    /// Generate a stable MAC address based on a seed string.
    ///
    /// The generated MAC address:
    /// - Is deterministic (same seed = same MAC)
    /// - Is locally administered
    /// - Avoids common conflicts
    ///
    /// Use this to ensure the same VM always gets the same MAC address.
    ///
    /// Example:
    /// ```swift
    /// let mac = generateStableMAC(seed: "my-vm-unique-id")
    /// // Always returns the same MAC for this seed
    /// ```
    ///
    /// - Parameter seed: Unique string to seed MAC generation (e.g., VM ID)
    /// - Returns: Stable MAC address string
    func generateStableMAC(seed: String) -> String {
        // Simple hash-based MAC generation
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

// MARK: - Network Error Types

/// Errors that can occur during network configuration.
enum NetworkError: LocalizedError {
    case interfaceNotFound(String)
    case invalidMACAddress(String)
    case bridgeNetworkingRequiresEntitlement
    case configurationFailed(String)

    var errorDescription: String? {
        switch self {
        case .interfaceNotFound(let interface):
            return "Network interface '\(interface)' not found"
        case .invalidMACAddress(let mac):
            return "Invalid MAC address '\(mac)' (expected format: XX:XX:XX:XX:XX:XX)"
        case .bridgeNetworkingRequiresEntitlement:
            return "Bridge networking requires com.apple.vm.networking entitlement (restricted to commercial virtualization developers)"
        case .configurationFailed(let reason):
            return "Network configuration failed: \(reason)"
        }
    }
}

// MARK: - Example Implementations (Documentation)

/// Example NAT networking strategy (see NATNetworkStrategy.swift for full implementation).
///
/// ```swift
/// class NATNetworkStrategy: NetworkingStrategy {
///     private let macAddress: String
///
///     init(macAddress: String? = nil) {
///         self.macAddress = macAddress ?? generateRandomMAC()
///     }
///
///     func configure(_ config: VZVirtualMachineConfiguration) throws {
///         let net = VZVirtioNetworkDeviceConfiguration()
///         net.macAddress = VZMACAddress(string: macAddress)!
///         net.attachment = VZNATNetworkDeviceAttachment()
///         config.networkDevices = [net]
///     }
///
///     func setupConnectivity(_ manager: BaseVMManager) {
///         // NAT networking needs no special setup
///     }
///
///     func teardown() {
///         // Nothing to cleanup
///     }
///
///     func getMACAddress() -> String {
///         return macAddress
///     }
/// }
/// ```

/// Example vsock networking strategy.
///
/// ```swift
/// class VsockNetworkStrategy: NetworkingStrategy {
///     private let macAddress: String
///     private var proxyServer: VsockProxyServer?
///
///     init() {
///         self.macAddress = generateRandomMAC()
///     }
///
///     func configure(_ config: VZVirtualMachineConfiguration) throws {
///         // Vsock uses socket device, not network device
///         let socketDevice = VZVirtioSocketDeviceConfiguration()
///         config.socketDevices = [socketDevice]
///
///         // Still add network device for DHCP/IP detection
///         let net = VZVirtioNetworkDeviceConfiguration()
///         net.macAddress = VZMACAddress(string: macAddress)!
///         net.attachment = VZNATNetworkDeviceAttachment()
///         config.networkDevices = [net]
///     }
///
///     func setupConnectivity(_ manager: BaseVMManager) {
///         // Start vsock proxy server
///         guard let vm = manager.vm else { return }
///         proxyServer = VsockProxyServer(vm: vm)
///         proxyServer?.start(port: 3000)
///     }
///
///     func teardown() {
///         proxyServer?.stop()
///         proxyServer = nil
///     }
///
///     func getMACAddress() -> String {
///         return macAddress
///     }
/// }
/// ```

/// Example bridge networking strategy (requires entitlement).
///
/// ```swift
/// class BridgeNetworkStrategy: NetworkingStrategy {
///     private let bridgeInterface: String
///     private let macAddress: String
///
///     init(bridgeInterface: String = "en0") {
///         self.bridgeInterface = bridgeInterface
///         self.macAddress = generateRandomMAC()
///     }
///
///     func configure(_ config: VZVirtualMachineConfiguration) throws {
///         let net = VZVirtioNetworkDeviceConfiguration()
///         net.macAddress = VZMACAddress(string: macAddress)!
///
///         // Find bridge interface
///         guard let interface = VZBridgedNetworkInterface.networkInterfaces
///             .first(where: { $0.identifier == bridgeInterface }) else {
///             throw NetworkError.interfaceNotFound(bridgeInterface)
///         }
///
///         // Create bridge attachment (requires entitlement!)
///         net.attachment = VZBridgedNetworkDeviceAttachment(interface: interface)
///         config.networkDevices = [net]
///     }
///
///     func setupConnectivity(_ manager: BaseVMManager) {
///         // Bridge networking needs no special setup
///     }
///
///     func teardown() {
///         // Nothing to cleanup
///     }
///
///     func getMACAddress() -> String {
///         return macAddress
///     }
/// }
/// ```
