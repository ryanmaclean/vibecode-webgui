#!/usr/bin/env swift
//
// Manual Port Forwarding Test - Demonstrates VMPortForwarder working with running VM
//
// Usage: swift test-port-forward-manual.swift 192.168.64.3 6379
//

import Foundation
import Network

// Simplified port forwarder for testing
class SimplePortForwarder {
    private var listener: NWListener?
    private let queue = DispatchQueue(label: "com.vibecode.portforwarder.test")

    func forward(vmIP: String, vmPort: UInt16, hostPort: UInt16) {
        let params = NWParameters.tcp
        params.allowLocalEndpointReuse = true

        do {
            listener = try NWListener(using: params, on: NWEndpoint.Port(integerLiteral: hostPort))

            listener?.newConnectionHandler = { [weak self] incoming in
                print("[Test] New connection on localhost:\(hostPort)")
                self?.bridgeConnection(incoming: incoming, vmIP: vmIP, vmPort: vmPort)
            }

            listener?.stateUpdateHandler = { state in
                switch state {
                case .ready:
                    print("[Test] ✓ Listening on localhost:\(hostPort) → \(vmIP):\(vmPort)")
                case .failed(let error):
                    print("[Test] ✗ Listener failed: \(error)")
                default:
                    break
                }
            }

            listener?.start(queue: queue)
        } catch {
            print("[Test] ✗ Failed to start listener: \(error)")
        }
    }

    private func bridgeConnection(incoming: NWConnection, vmIP: String, vmPort: UInt16) {
        let host = NWEndpoint.Host(vmIP)
        let port = NWEndpoint.Port(integerLiteral: vmPort)
        let outgoing = NWConnection(host: host, port: port, using: .tcp)

        incoming.stateUpdateHandler = { state in
            if case .ready = state {
                print("[Test] → Client connected")
            }
        }

        outgoing.stateUpdateHandler = { state in
            if case .ready = state {
                print("[Test] → VM connected")
                self.startBridge(from: incoming, to: outgoing, label: "→")
                self.startBridge(from: outgoing, to: incoming, label: "←")
            } else if case .failed(let error) = state {
                print("[Test] ✗ VM connection failed: \(error)")
                incoming.cancel()
            }
        }

        incoming.start(queue: queue)
        outgoing.start(queue: queue)
    }

    private func startBridge(from source: NWConnection, to dest: NWConnection, label: String) {
        source.receive(minimumIncompleteLength: 1, maximumLength: 65536) { [weak self] data, _, isComplete, error in
            if let data = data, !data.isEmpty {
                print("[Test] \(label) \(data.count) bytes")
                dest.send(content: data, completion: .contentProcessed { _ in })
                self?.startBridge(from: source, to: dest, label: label)
            } else if isComplete {
                print("[Test] Connection closed")
                dest.cancel()
            } else if let error = error {
                print("[Test] Error: \(error)")
                dest.cancel()
            }
        }
    }

    func stop() {
        listener?.cancel()
    }
}

// Main
if CommandLine.arguments.count < 3 {
    print("Usage: swift test-port-forward-manual.swift <VM_IP> <VM_PORT> [HOST_PORT]")
    print("Example: swift test-port-forward-manual.swift 192.168.64.3 6379 6379")
    exit(1)
}

let vmIP = CommandLine.arguments[1]
let vmPort = UInt16(CommandLine.arguments[2]) ?? 6379
let hostPort = CommandLine.arguments.count > 3 ? (UInt16(CommandLine.arguments[3]) ?? vmPort) : vmPort

print("=== Swift Port Forwarding Test ===")
print("VM: \(vmIP):\(vmPort)")
print("Host: localhost:\(hostPort)")
print("")

let forwarder = SimplePortForwarder()
forwarder.forward(vmIP: vmIP, vmPort: vmPort, hostPort: hostPort)

print("")
print("Port forwarding active!")
print("Test with: redis-cli -h localhost -p \(hostPort) PING")
print("Press Ctrl+C to stop")
print("")

// Keep running
RunLoop.main.run()
