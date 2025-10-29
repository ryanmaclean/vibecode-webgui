// VMOrchestrator.swift
// VibeCode - macOS 26 Tahoe Exclusive
//
// Unified orchestration for all VMs: Valkey, PostgreSQL, Node.js

import Foundation
import Virtualization

@available(macOS 14.0, *)
@MainActor
public class VMOrchestrator: NSObject, ObservableObject {

    // MARK: - Published Properties

    @Published public private(set) var vms: [String: any VMProtocol] = [:]
    @Published public private(set) var status: [String: VMStatus] = [:]
    @Published public private(set) var globalStatus: GlobalStatus = .idle
    @Published public private(set) var startupMetrics: StartupMetrics?

    // MARK: - Status Types

    public enum VMStatus: Equatable {
        case notConfigured
        case stopped
        case starting
        case running
        case stopping
        case error(String)

        public static func == (lhs: VMStatus, rhs: VMStatus) -> Bool {
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

    public enum GlobalStatus {
        case idle
        case starting
        case running
        case stopping
        case error(Error)
    }

    public struct StartupMetrics {
        public let totalTime: TimeInterval
        public let valkeyTime: TimeInterval
        public let postgresTime: TimeInterval
        public let nodejsTime: TimeInterval
        public let timestamp: Date

        public var formattedSummary: String {
            """
            Startup Performance:
            - Valkey: \(String(format: "%.2f", valkeyTime))s
            - PostgreSQL: \(String(format: "%.2f", postgresTime))s
            - Node.js: \(String(format: "%.2f", nodejsTime))s
            - Total: \(String(format: "%.2f", totalTime))s
            """
        }
    }

    // MARK: - VM Names

    public static let valkeyVM = "valkey"
    public static let postgresVM = "postgresql"
    public static let nodejsVM = "nodejs"

    // MARK: - Error Types

    public enum OrchestratorError: LocalizedError {
        case vmNotFound(String)
        case vmAlreadyExists(String)
        case startupTimeout(String)
        case configurationError(String)

        public var errorDescription: String? {
            switch self {
            case .vmNotFound(let name):
                return "VM not found: \(name)"
            case .vmAlreadyExists(let name):
                return "VM already exists: \(name)"
            case .startupTimeout(let name):
                return "VM startup timeout: \(name)"
            case .configurationError(let msg):
                return "Configuration error: \(msg)"
            }
        }
    }

    // MARK: - Initialization

    public override init() {
        super.init()
        initializeVMStatus()
    }

    private func initializeVMStatus() {
        status[Self.valkeyVM] = .notConfigured
        status[Self.postgresVM] = .notConfigured
        status[Self.nodejsVM] = .notConfigured
    }

    // MARK: - Quick Start All VMs

    /// Start all VMs in dependency order with performance tracking
    public func startAll() async throws {
        print("🚀 Starting all VMs in dependency order...")
        globalStatus = .starting

        let startTime = Date()
        var valkeyTime: TimeInterval = 0
        var postgresTime: TimeInterval = 0
        var nodejsTime: TimeInterval = 0

        do {
            // Start Valkey first (cache layer)
            let valkeyStart = Date()
            try await startVM(Self.valkeyVM)
            valkeyTime = Date().timeIntervalSince(valkeyStart)
            print("✅ Valkey started in \(String(format: "%.2f", valkeyTime))s")

            // Start PostgreSQL (database layer)
            let postgresStart = Date()
            try await startVM(Self.postgresVM)
            postgresTime = Date().timeIntervalSince(postgresStart)
            print("✅ PostgreSQL started in \(String(format: "%.2f", postgresTime))s")

            // Start Node.js (development environment)
            let nodejsStart = Date()
            try await startVM(Self.nodejsVM)
            nodejsTime = Date().timeIntervalSince(nodejsStart)
            print("✅ Node.js started in \(String(format: "%.2f", nodejsTime))s")

            let totalTime = Date().timeIntervalSince(startTime)

            // Store metrics
            startupMetrics = StartupMetrics(
                totalTime: totalTime,
                valkeyTime: valkeyTime,
                postgresTime: postgresTime,
                nodejsTime: nodejsTime,
                timestamp: Date()
            )

            globalStatus = .running
            print("\n✅ All VMs started successfully!")
            print(startupMetrics!.formattedSummary)

        } catch {
            globalStatus = .error(error)
            throw error
        }
    }

    // MARK: - Individual VM Management

    /// Start a specific VM by name
    public func startVM(_ name: String) async throws {
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
            throw OrchestratorError.vmNotFound(name)
        }

        do {
            try await vm.start()
            vms[name] = vm
            status[name] = .running
        } catch {
            status[name] = .error(error.localizedDescription)
            throw error
        }
    }

    /// Stop a specific VM by name
    public func stopVM(_ name: String) async throws {
        guard let vm = vms[name] else {
            throw OrchestratorError.vmNotFound(name)
        }

        status[name] = .stopping

        do {
            try await vm.stop()
            status[name] = .stopped
        } catch {
            status[name] = .error(error.localizedDescription)
            throw error
        }
    }

    /// Stop all VMs in reverse dependency order
    public func stopAll() async throws {
        print("🛑 Stopping all VMs...")
        globalStatus = .stopping

        // Stop in reverse order: Node.js → PostgreSQL → Valkey
        for vmName in [Self.nodejsVM, Self.postgresVM, Self.valkeyVM] {
            if vms[vmName] != nil {
                try? await stopVM(vmName)
                print("✅ \(vmName) stopped")
            }
        }

        vms.removeAll()
        globalStatus = .idle
        print("✅ All VMs stopped")
    }

    /// Restart a specific VM
    public func restartVM(_ name: String) async throws {
        try await stopVM(name)
        try await Task.sleep(for: .seconds(2))
        try await startVM(name)
    }

    // MARK: - VM Status

    /// Get status of all VMs
    public func getAllStatus() -> [String: VMStatus] {
        return status
    }

    /// Get status of specific VM
    public func getVMStatus(_ name: String) -> VMStatus {
        return status[name] ?? .notConfigured
    }

    /// Check if all VMs are running
    public var allRunning: Bool {
        return status.values.allSatisfy { $0 == .running }
    }

    // MARK: - Health Checks

    /// Perform health checks on all running VMs
    public func healthCheck() async -> [String: Bool] {
        var results: [String: Bool] = [:]

        for (name, vm) in vms {
            results[name] = await vm.healthCheck()
        }

        return results
    }

    // MARK: - Connection Info

    /// Get connection information for all VMs
    public func getConnectionInfo() -> [String: String] {
        var info: [String: String] = [:]

        if let valkey = vms[Self.valkeyVM] as? ValkeyVM {
            info[Self.valkeyVM] = valkey.connectionString
        }

        if let postgres = vms[Self.postgresVM] as? PostgreSQLVM {
            info[Self.postgresVM] = postgres.connectionString
        }

        if let nodejs = vms[Self.nodejsVM] as? NodeJSVM {
            info[Self.nodejsVM] = nodejs.connectionString
        }

        return info
    }

    // MARK: - Configuration

    /// Configure a VM before starting
    public func configureVM(_ name: String, config: VMConfiguration) throws {
        // Store configuration for later use
        // This would be implemented based on specific VM needs
        status[name] = .stopped
    }
}

// MARK: - VM Protocol

public protocol VMProtocol {
    func start() async throws
    func stop() async throws
    func healthCheck() async -> Bool
    var connectionString: String { get }
}

// MARK: - VM Configuration

public struct VMConfiguration {
    public let cpus: Int
    public let memory: UInt64
    public let diskPath: URL?
    public let env: [String: String]

    public init(cpus: Int = 2, memory: UInt64 = 2 * 1024 * 1024 * 1024, diskPath: URL? = nil, env: [String: String] = [:]) {
        self.cpus = cpus
        self.memory = memory
        self.diskPath = diskPath
        self.env = env
    }
}
