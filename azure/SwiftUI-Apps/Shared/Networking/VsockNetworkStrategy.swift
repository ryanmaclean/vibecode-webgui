//
// VsockNetworkStrategy.swift
// VibeCode
//
// Created: 2025-11-25
// Migration Status: NEW
// Purpose: Vsock networking strategy using VZVirtioSocketDevice (macOS 13+)
//
// Part of refactoring effort: See REFACTORING-IN-PROGRESS.md
//

import Foundation
import Virtualization
import Network

/// Vsock networking strategy using VZVirtioSocketDevice.
///
/// This strategy uses VirtIO sockets for direct host-guest communication:
/// - No IP networking required
/// - Direct socket connection to guest
/// - Proxy server for localhost access
/// - Requires macOS 13+ for modern async APIs
///
/// ## Usage
///
/// Use with BaseVMManager:
///
/// ```swift
/// final class VsockVMManager: BaseVMManager {
///     override func createNetworkingStrategy() -> NetworkingStrategy {
///         return VsockNetworkStrategy()
///     }
/// }
/// ```
///
/// ## How Vsock Networking Works
///
/// 1. VM gets VZVirtioSocketDevice configured
/// 2. Guest app connects to vsock port (e.g., 3000)
/// 3. Host proxy listens on localhost:3000
/// 4. Proxy forwards TCP connections to vsock
/// 5. Browser connects to localhost:3000
///
/// ## Architecture
///
/// ```
/// Browser -> localhost:3000 -> VsockProxyServer -> VZVirtioSocketDevice -> Guest:3000
/// ```
///
/// ## API Changes (macOS 13+)
///
/// Old synchronous API (macOS 12):
/// - `device.connect(toPort:)` - Sync, returns connection
/// - `connection.read(&buffer, count:)` - Sync read
/// - `connection.write(address, count:)` - Sync write
/// - `connection.close()` - Sync close
///
/// New async API (macOS 13+):
/// - `device.connect(toPort:completionHandler:)` - Async connect
/// - Use FileDescriptor or async streams for I/O
/// - Proper async resource management
///
public class VsockNetworkStrategy: NetworkingStrategy {

    // MARK: - Properties

    /// MAC address for optional NAT networking (for IP detection)
    private let macAddress: String

    /// Vsock proxy server (started after VM boots)
    private var proxyServer: VsockProxyServer?

    /// Queue for vsock operations
    private let vsockQueue = DispatchQueue(label: "com.vibecode.vsock", qos: .userInitiated)

    /// The guest port to connect to (OpenVSCode Server port)
    private let guestPort: UInt32

    /// The host port to proxy to
    private let hostPort: UInt16

    // MARK: - Initialization

    /// Create a Vsock networking strategy.
    ///
    /// - Parameters:
    ///   - guestPort: Port on guest VM to connect to (default: 3000)
    ///   - hostPort: Port on host to listen on (default: 3000)
    ///   - includeNAT: Whether to also include NAT networking for IP detection (default: false)
    public init(guestPort: UInt32 = 3000, hostPort: UInt16 = 3000, includeNAT: Bool = false) {
        self.guestPort = guestPort
        self.hostPort = hostPort
        self.macAddress = Self.generateRandomMAC()

        NSLog("[VsockNetworkStrategy] Initialized (guest port: \(guestPort), host port: \(hostPort))")
    }

    // MARK: - NetworkingStrategy Protocol

    public func configure(_ config: VZVirtualMachineConfiguration) throws {
        NSLog("[VsockNetworkStrategy] Configuring vsock networking...")

        // Add VirtIO socket device for host-guest communication
        let socketDevice = VZVirtioSocketDeviceConfiguration()
        config.socketDevices = [socketDevice]

        NSLog("[VsockNetworkStrategy] Vsock device configured")
    }

    public func setupConnectivity(_ manager: BaseVMManager) {
        NSLog("[VsockNetworkStrategy] Setting up vsock connectivity...")

        // Get the VM instance to access socket devices
        guard let vm = manager.vm else {
            NSLog("[VsockNetworkStrategy] ERROR: No VM instance available")
            return
        }

        // Start proxy server after VM boots
        vsockQueue.async { [weak self] in
            guard let self = self else { return }

            // Give VM a moment to fully initialize
            Thread.sleep(forTimeInterval: 1.0)

            self.startProxyServer(vm: vm)
        }
    }

    public func teardown() {
        NSLog("[VsockNetworkStrategy] Tearing down vsock networking...")

        proxyServer?.stop()
        proxyServer = nil

        NSLog("[VsockNetworkStrategy] Vsock networking teardown complete")
    }

    public func getMACAddress() -> String {
        return macAddress
    }

    // MARK: - Private Helpers

    /// Start the vsock proxy server.
    private func startProxyServer(vm: VZVirtualMachine) {
        NSLog("[VsockNetworkStrategy] Starting vsock proxy server...")

        // Get socket device from VM
        guard let socketDevices = vm.socketDevices as? [VZVirtioSocketDevice],
              let socketDevice = socketDevices.first else {
            NSLog("[VsockNetworkStrategy] ERROR: No socket device found on VM")
            return
        }

        // Create and start proxy server
        let proxy = VsockProxyServer(
            device: socketDevice,
            guestPort: guestPort,
            hostPort: hostPort,
            queue: vsockQueue
        )

        proxy.start { [weak self] success in
            if success {
                NSLog("[VsockNetworkStrategy] Proxy server started on localhost:\(self?.hostPort ?? 0)")
            } else {
                NSLog("[VsockNetworkStrategy] ERROR: Failed to start proxy server")
            }
        }

        self.proxyServer = proxy
    }

    /// Generate a random MAC address for optional NAT networking.
    private static func generateRandomMAC() -> String {
        let prefix = "52:54:00"
        let randomBytes = (0..<3).map { _ in
            String(format: "%02x", Int.random(in: 0...255))
        }
        return "\(prefix):\(randomBytes.joined(separator: ":"))"
    }
}

// MARK: - Common Pre-defined Strategies

public extension VsockNetworkStrategy {

    /// Pre-defined strategy for VsockVibeCode app.
    ///
    /// Uses guest port 3000, host port 3000
    static var vsockVibeCode: VsockNetworkStrategy {
        return VsockNetworkStrategy(guestPort: 3000, hostPort: 3000)
    }
}
