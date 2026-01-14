import Foundation
import Network
import Virtualization

/// Swift implementation of port forwarding similar to gvproxy
/// Forwards ports from VM to host localhost for service accessibility
class VMPortForwarder {

    struct PortMapping {
        let vmPort: UInt16
        let hostPort: UInt16
        let name: String
    }

    private var listeners: [NWListener] = []
    private var connections: [NWConnection] = []
    private let queue = DispatchQueue(label: "com.vibecode.portforwarder")

    /// Common service port mappings
    static let commonMappings: [PortMapping] = [
        PortMapping(vmPort: 6379, hostPort: 6379, name: "Valkey"),
        PortMapping(vmPort: 5432, hostPort: 5432, name: "PostgreSQL"),
        PortMapping(vmPort: 8080, hostPort: 8080, name: "OpenVSCode"),
        PortMapping(vmPort: 3000, hostPort: 3000, name: "HTTP"),
        PortMapping(vmPort: 22, hostPort: 2222, name: "SSH")
    ]

    /// Start forwarding specific ports from VM IP to localhost
    func startForwarding(vmIP: String, mappings: [PortMapping]) {
        try? "START FORWARDING called with vmIP=\(vmIP), mappings=\(mappings.count)\n".appendingToFile(at: "/tmp/portforwarder-debug.log")
        for mapping in mappings {
            startPortForward(vmIP: vmIP, mapping: mapping)
        }
    }

    /// Forward a single port from VM to localhost
    private func startPortForward(vmIP: String, mapping: PortMapping) {
        try? "startPortForward: \(mapping.name) host:\(mapping.hostPort) → vm:\(mapping.vmPort)\n".appendingToFile(at: "/tmp/portforwarder-debug.log")
        do {
            // Create TCP listener on localhost
            let params = NWParameters.tcp
            params.allowLocalEndpointReuse = true

            let listener = try NWListener(using: params, on: NWEndpoint.Port(integerLiteral: mapping.hostPort))

            listener.newConnectionHandler = { [weak self] incomingConnection in
                self?.handleConnection(
                    incoming: incomingConnection,
                    vmIP: vmIP,
                    vmPort: mapping.vmPort,
                    name: mapping.name
                )
            }

            listener.stateUpdateHandler = { state in
                switch state {
                case .ready:
                    print("[\(mapping.name)] Port forwarder ready: localhost:\(mapping.hostPort) → \(vmIP):\(mapping.vmPort)")
                    try? "LISTENER READY: \(mapping.name) on port \(mapping.hostPort)\n".appendingToFile(at: "/tmp/portforwarder-debug.log")
                case .failed(let error):
                    print("[\(mapping.name)] Port forwarder failed: \(error)")
                    try? "LISTENER FAILED: \(mapping.name) error=\(error)\n".appendingToFile(at: "/tmp/portforwarder-debug.log")
                default:
                    break
                }
            }

            try? "Starting listener for \(mapping.name)\n".appendingToFile(at: "/tmp/portforwarder-debug.log")
            listener.start(queue: queue)
            try? "Listener started for \(mapping.name), appended to list\n".appendingToFile(at: "/tmp/portforwarder-debug.log")
            listeners.append(listener)

        } catch {
            print("[\(mapping.name)] Failed to create listener: \(error)")
            try? "ERROR creating listener: \(error)\n".appendingToFile(at: "/tmp/portforwarder-debug.log")
        }
    }

    /// Handle incoming connection by bridging to VM
    private func handleConnection(incoming: NWConnection, vmIP: String, vmPort: UInt16, name: String) {
        print("[\(name)] New connection on localhost:\(vmPort)")

        // Create outgoing connection to VM
        let host = NWEndpoint.Host(vmIP)
        let port = NWEndpoint.Port(integerLiteral: vmPort)
        let outgoing = NWConnection(host: host, port: port, using: .tcp)

        // Store connections
        connections.append(incoming)
        connections.append(outgoing)

        // Start both connections
        incoming.start(queue: queue)
        outgoing.start(queue: queue)

        // Wait for both to be ready
        var incomingReady = false
        var outgoingReady = false

        incoming.stateUpdateHandler = { state in
            switch state {
            case .ready:
                incomingReady = true
                if outgoingReady {
                    self.bridgeConnections(incoming: incoming, outgoing: outgoing, name: name)
                }
            case .failed(let error):
                print("[\(name)] Incoming connection failed: \(error)")
                self.closeConnection(incoming)
                self.closeConnection(outgoing)
            default:
                break
            }
        }

        outgoing.stateUpdateHandler = { state in
            switch state {
            case .ready:
                outgoingReady = true
                if incomingReady {
                    self.bridgeConnections(incoming: incoming, outgoing: outgoing, name: name)
                }
            case .failed(let error):
                print("[\(name)] Outgoing connection to VM failed: \(error)")
                self.closeConnection(incoming)
                self.closeConnection(outgoing)
            default:
                break
            }
        }
    }

    /// Bridge data between two connections (bidirectional)
    private func bridgeConnections(incoming: NWConnection, outgoing: NWConnection, name: String) {
        print("[\(name)] Bridging connection")

        // Forward incoming → outgoing
        receiveAndForward(from: incoming, to: outgoing, name: "\(name) →")

        // Forward outgoing → incoming
        receiveAndForward(from: outgoing, to: incoming, name: "\(name) ←")
    }

    /// Receive data from one connection and forward to another
    private func receiveAndForward(from source: NWConnection, to dest: NWConnection, name: String) {
        source.receive(minimumIncompleteLength: 1, maximumLength: 65536) { [weak self] data, context, isComplete, error in
            guard let self = self else { return }

            if let data = data, !data.isEmpty {
                // Forward data to destination
                dest.send(content: data, completion: .contentProcessed { error in
                    if let error = error {
                        print("[\(name)] Forward error: \(error)")
                        self.closeConnection(source)
                        self.closeConnection(dest)
                    }
                })

                // Continue receiving
                if !isComplete {
                    self.receiveAndForward(from: source, to: dest, name: name)
                }
            }

            if let error = error {
                print("[\(name)] Receive error: \(error)")
                self.closeConnection(source)
                self.closeConnection(dest)
            }

            if isComplete {
                print("[\(name)] Connection complete")
                self.closeConnection(source)
                self.closeConnection(dest)
            }
        }
    }

    /// Close a connection
    private func closeConnection(_ connection: NWConnection) {
        connection.cancel()
        connections.removeAll { $0 === connection }
    }

    /// Stop all port forwarding
    func stopAll() {
        try? "STOPALL CALLED: listeners=\(listeners.count)\n".appendingToFile(at: "/tmp/portforwarder-debug.log")
        print("[Port Forwarder] Stopping all forwarding")

        // Cancel all listeners
        for listener in listeners {
            listener.cancel()
        }
        listeners.removeAll()
        try? "STOPALL: All listeners cancelled\n".appendingToFile(at: "/tmp/portforwarder-debug.log")

        // Cancel all connections
        for connection in connections {
            connection.cancel()
        }
        connections.removeAll()
    }

    deinit {
        stopAll()
    }
}

// MARK: - Convenience Extensions

extension VMPortForwarder {

    /// Start forwarding all common service ports
    static func forwardCommonPorts(vmIP: String) -> VMPortForwarder {
        let forwarder = VMPortForwarder()
        forwarder.startForwarding(vmIP: vmIP, mappings: commonMappings)
        return forwarder
    }

    /// Start forwarding for specific service
    static func forwardService(vmIP: String, serviceName: String) -> VMPortForwarder? {
        guard let mapping = commonMappings.first(where: { $0.name == serviceName }) else {
            print("[Port Forwarder] Unknown service: \(serviceName)")
            return nil
        }

        let forwarder = VMPortForwarder()
        forwarder.startForwarding(vmIP: vmIP, mappings: [mapping])
        return forwarder
    }
}


// MARK: - Debug Helper
private extension String {
    func appendingToFile(at path: String) throws {
        let url = URL(fileURLWithPath: path)
        if FileManager.default.fileExists(atPath: path) {
            let handle = try FileHandle(forWritingTo: url)
            handle.seekToEndOfFile()
            if let data = self.data(using: .utf8) {
                handle.write(data)
            }
            handle.closeFile()
        } else {
            try self.write(to: url, atomically: true, encoding: .utf8)
        }
    }
}
