//
// VsockProxyServer.swift
// VibeCode
//
// Created: 2025-11-25
// Migration Status: NEW
// Purpose: TCP proxy server that forwards to VZVirtioSocket connections
//
// Part of refactoring effort: See REFACTORING-IN-PROGRESS.md
//

import Foundation
import Virtualization
import Network

/// Vsock proxy server for forwarding TCP to VirtIO socket connections.
///
/// VsockProxyServer creates a TCP listener on localhost and forwards connections
/// to the guest VM via VZVirtioSocketDevice. This allows browsers and clients
/// to access guest services via familiar TCP/localhost connections.
///
/// ## Architecture
///
/// ```
/// Browser -> localhost:3000 -> VsockProxyServer -> VZVirtioSocketDevice -> Guest:3000
/// ```
///
/// ## Usage
///
/// ```swift
/// let proxy = VsockProxyServer(
///     device: socketDevice,
///     guestPort: 3000,
///     hostPort: 3000,
///     queue: vsockQueue
/// )
///
/// proxy.start { success in
///     if success {
///         print("Proxy ready on localhost:3000")
///     }
/// }
/// ```
///
/// ## Modern API Usage (macOS 13+)
///
/// Uses async completion handler for vsock connections:
/// - `device.connect(toPort:completionHandler:)` instead of sync `connect(toPort:)`
/// - FileDescriptor-based I/O for vsock
/// - NWConnection for TCP
///
/// ## Lifecycle
///
/// 1. Create VsockProxyServer with device and ports
/// 2. Call start() to begin listening
/// 3. Server accepts connections and creates ProxyConnection for each
/// 4. Call stop() to cleanup (closes all active connections)
///
public class VsockProxyServer {

    // MARK: - Properties

    /// VirtIO socket device for guest connections
    private let device: VZVirtioSocketDevice

    /// Port on guest to connect to
    private let guestPort: UInt32

    /// Port on host to listen on
    private let hostPort: UInt16

    /// Queue for vsock operations
    private let queue: DispatchQueue

    /// TCP listener
    private var listener: NWListener?

    /// Active proxy connections
    private var activeConnections: [ProxyConnection] = []

    /// Connection tracking lock
    private let connectionLock = NSLock()

    // MARK: - Initialization

    /// Create a vsock proxy server.
    ///
    /// - Parameters:
    ///   - device: The VZVirtioSocketDevice from the VM
    ///   - guestPort: Port on guest to connect to (e.g., 3000 for OpenVSCode)
    ///   - hostPort: Port on host to listen on (e.g., 3000)
    ///   - queue: DispatchQueue for vsock operations
    public init(device: VZVirtioSocketDevice, guestPort: UInt32, hostPort: UInt16, queue: DispatchQueue) {
        self.device = device
        self.guestPort = guestPort
        self.hostPort = hostPort
        self.queue = queue

        NSLog("[VsockProxyServer] Initialized (guest: \(guestPort), host: \(hostPort))")
    }

    // MARK: - Public Methods

    /// Start the proxy server.
    ///
    /// Creates TCP listener on localhost:hostPort and begins accepting connections.
    ///
    /// - Parameter completion: Called when server is ready or fails (true = success)
    public func start(completion: @escaping (Bool) -> Void) {
        NSLog("[VsockProxyServer] Starting proxy server...")

        // Create TCP listener parameters
        let parameters = NWParameters.tcp
        parameters.allowLocalEndpointReuse = true

        do {
            // Create listener on host port
            listener = try NWListener(using: parameters, on: NWEndpoint.Port(integerLiteral: hostPort))

            // Setup state handler
            listener?.stateUpdateHandler = { [weak self] state in
                guard let self = self else { return }

                switch state {
                case .ready:
                    NSLog("[VsockProxyServer] Listener ready on localhost:\(self.hostPort)")
                    completion(true)

                case .failed(let error):
                    NSLog("[VsockProxyServer] Listener failed: \(error)")
                    completion(false)

                case .cancelled:
                    NSLog("[VsockProxyServer] Listener cancelled")

                default:
                    break
                }
            }

            // Setup new connection handler
            listener?.newConnectionHandler = { [weak self] tcpConnection in
                self?.handleNewConnection(tcpConnection)
            }

            // Start listener
            listener?.start(queue: queue)

        } catch {
            NSLog("[VsockProxyServer] Failed to create listener: \(error)")
            completion(false)
        }
    }

    /// Stop the proxy server.
    ///
    /// Cancels the listener and closes all active connections.
    public func stop() {
        NSLog("[VsockProxyServer] Stopping proxy server...")

        // Cancel listener
        listener?.cancel()
        listener = nil

        // Stop all active connections
        connectionLock.lock()
        let connections = activeConnections
        activeConnections.removeAll()
        connectionLock.unlock()

        for connection in connections {
            connection.stop()
        }

        NSLog("[VsockProxyServer] Proxy server stopped")
    }

    // MARK: - Private Connection Handling

    /// Handle a new TCP connection from a client.
    private func handleNewConnection(_ tcpConnection: NWConnection) {
        NSLog("[VsockProxyServer] New TCP connection from client")

        // Connect to guest via vsock (async on macOS 13+)
        // Must be called on the vsock queue to avoid threading issues
        queue.async { [weak self] in
            guard let strongSelf = self else { return }

            strongSelf.device.connect(toPort: strongSelf.guestPort) { result in

            switch result {
            case .success(let vsockConnection):
                NSLog("[VsockProxyServer] Connected to guest via vsock")

                // Create proxy connection
                let proxy = ProxyConnection(
                    tcpConnection: tcpConnection,
                    vsockConnection: vsockConnection,
                    queue: strongSelf.queue
                )

                // Track connection
                strongSelf.connectionLock.lock()
                strongSelf.activeConnections.append(proxy)
                strongSelf.connectionLock.unlock()

                // Start forwarding
                proxy.start()

                NSLog("[VsockProxyServer] Proxy connection established (total: \(strongSelf.activeConnections.count))")

                case .failure(let error):
                    NSLog("[VsockProxyServer] Failed to connect to guest: \(error)")
                    tcpConnection.cancel()
                }
            }
        }
    }
}
