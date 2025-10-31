#!/usr/bin/env swift
// demo-tahoe-vms.swift
// VibeCode - macOS 26 Tahoe Exclusive Demo
// Unified VM Orchestration Demo

import Foundation
import Virtualization

// MARK: - VM Protocol

protocol VMProtocol {
    func start() async throws
    func stop() async throws
    func healthCheck() async -> Bool
    var connectionString: String { get }
}

// MARK: - VM Status Types

enum VMStatus: Equatable {
    case notConfigured
    case stopped
    case starting
    case running
    case stopping
    case error(String)

    static func == (lhs: VMStatus, rhs: VMStatus) -> Bool {
        switch (lhs, rhs) {
        case (.notConfigured, .notConfigured),
             (.stopped, .stopped),
             (.starting, .starting),
             (.running, .running),
             (.stopping, .stopping):
            return true
        case let (.error(lm), .error(rm)):
            return lm == rm
        default:
            return false
        }
    }
}

// MARK: - Stub VM Implementations
// These are stubs for demonstration. Real implementations would use Virtualization.framework

class ValkeyVM: VMProtocol {
    var connectionString: String { "redis://:vibecode@127.0.0.1:6379/0" }

    func start() async throws {
        print("  🚀 Starting Valkey VM...")
        try await Task.sleep(for: .seconds(2))
        print("  ✅ Valkey VM started")
    }

    func stop() async throws {
        print("  🛑 Stopping Valkey VM...")
        try await Task.sleep(for: .seconds(1))
        print("  ✅ Valkey VM stopped")
    }

    func healthCheck() async -> Bool {
        return true
    }
}

class PostgreSQLVM: VMProtocol {
    var connectionString: String { "postgresql://vibecode:vibecode_prod_2024@127.0.0.1:5432/vibecode" }

    func start() async throws {
        print("  🚀 Starting PostgreSQL VM...")
        try await Task.sleep(for: .seconds(3))
        print("  ✅ PostgreSQL VM started")
    }

    func stop() async throws {
        print("  🛑 Stopping PostgreSQL VM...")
        try await Task.sleep(for: .seconds(1))
        print("  ✅ PostgreSQL VM stopped")
    }

    func healthCheck() async -> Bool {
        return true
    }
}

class NodeJSVM: VMProtocol {
    var connectionString: String { "http://127.0.0.1:3000 (debug: 9229)" }

    func start() async throws {
        print("  🚀 Starting Node.js VM...")
        try await Task.sleep(for: .seconds(2))
        print("  ✅ Node.js VM started")
    }

    func stop() async throws {
        print("  🛑 Stopping Node.js VM...")
        try await Task.sleep(for: .seconds(1))
        print("  ✅ Node.js VM stopped")
    }

    func healthCheck() async -> Bool {
        return true
    }
}

// MARK: - VM Orchestrator

@MainActor
class VMOrchestrator {
    var vms: [String: any VMProtocol] = [:]
    var status: [String: VMStatus] = [:]

    static let valkeyVM = "valkey"
    static let postgresVM = "postgresql"
    static let nodejsVM = "nodejs"

    init() {
        status[Self.valkeyVM] = .stopped
        status[Self.postgresVM] = .stopped
        status[Self.nodejsVM] = .stopped
    }

    func startAll() async throws {
        print("\n🚀 Starting all VMs in dependency order...")
        let startTime = Date()

        // Start Valkey (cache layer)
        let valkeyStart = Date()
        try await startVM(Self.valkeyVM)
        let valkeyTime = Date().timeIntervalSince(valkeyStart)

        // Start PostgreSQL (database layer)
        let postgresStart = Date()
        try await startVM(Self.postgresVM)
        let postgresTime = Date().timeIntervalSince(postgresStart)

        // Start Node.js (development environment)
        let nodejsStart = Date()
        try await startVM(Self.nodejsVM)
        let nodejsTime = Date().timeIntervalSince(nodejsStart)

        let totalTime = Date().timeIntervalSince(startTime)

        print("\n⚡ Performance Metrics:")
        print("  - Valkey: \(String(format: "%.2f", valkeyTime))s")
        print("  - PostgreSQL: \(String(format: "%.2f", postgresTime))s")
        print("  - Node.js: \(String(format: "%.2f", nodejsTime))s")
        print("  - Total: \(String(format: "%.2f", totalTime))s")
        print("\n✅ All VMs started successfully!")
    }

    func startVM(_ name: String) async throws {
        status[name] = .starting

        let vm: any VMProtocol
        switch name {
        case Self.valkeyVM:
            vm = ValkeyVM()
        case Self.postgresVM:
            vm = PostgreSQLVM()
        case Self.nodejsVM:
            vm = NodeJSVM()
        default:
            throw NSError(domain: "VMOrchestrator", code: 1, userInfo: [NSLocalizedDescriptionKey: "Unknown VM: \(name)"])
        }

        try await vm.start()
        vms[name] = vm
        status[name] = .running
    }

    func stopAll() async throws {
        print("\n🛑 Stopping all VMs...")

        for vmName in [Self.nodejsVM, Self.postgresVM, Self.valkeyVM] {
            if let vm = vms[vmName] {
                try? await vm.stop()
            }
        }

        vms.removeAll()
        print("✅ All VMs stopped\n")
    }

    func getConnectionInfo() -> [String: String] {
        var info: [String: String] = [:]
        for (name, vm) in vms {
            info[name] = vm.connectionString
        }
        return info
    }
}

// MARK: - Main Demo Application

Task {
    await mainAsync()
}

RunLoop.main.run()

@MainActor
func mainAsync() async {
    print("""
    ╔══════════════════════════════════════════════════════════╗
    ║  VibeCode - macOS 26 Tahoe Exclusive Demo               ║
    ║  Apple Virtualization Framework Integration              ║
    ║  Three VMs: Valkey + PostgreSQL + Node.js                ║
    ╚══════════════════════════════════════════════════════════╝
    """)

    let orchestrator = VMOrchestrator()

        do {
            // Start all VMs
            try await orchestrator.startAll()

            // Display connection info
            print("\n📡 Connection Information:")
            let connections = orchestrator.getConnectionInfo()
            for (name, connection) in connections.sorted(by: { $0.key < $1.key }) {
                print("  \(name): \(connection)")
            }

            print("\n✨ Demo completed successfully!")
            print("\n💡 In a real scenario:")
            print("  - VMs would use actual Virtualization.framework")
            print("  - Services would be accessible on localhost")
            print("  - Health checks would verify real service availability")
            print("  - Performance would be <30s total startup time")

            print("\n🎯 Next Steps:")
            print("  1. Complete VM builds in Alpine VM")
            print("  2. Replace stub implementations with real VZ framework code")
            print("  3. Add service discovery and health monitoring")
            print("  4. Integrate with VibeCode UI")

            // Keep running briefly to simulate active state
            print("\n⏳ Running for 5 seconds...")
            try await Task.sleep(for: .seconds(5))

            // Cleanup
            try await orchestrator.stopAll()

            print("🏁 Demo finished!\n")

        } catch {
            print("\n❌ Error: \(error.localizedDescription)\n")
            exit(1)
        }

    exit(0)
}
