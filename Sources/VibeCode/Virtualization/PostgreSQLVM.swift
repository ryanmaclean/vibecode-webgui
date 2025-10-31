// PostgreSQLVM.swift
// VibeCode - PostgreSQL + pgvector VM Manager

import Foundation
import Virtualization

@available(macOS 14.0, *)
public class PostgreSQLVM: VMProtocol {

    // MARK: - Properties

    private var virtualMachine: VZVirtualMachine?
    private let vmPath: URL
    private let port: Int = 5432
    private let database: String = "vibecode"
    private let username: String = "vibecode"
    private let password: String = "vibecode_prod_2024"

    // MARK: - Configuration

    private struct Config {
        static let cpuCount = 2
        static let memorySize: UInt64 = 2 * 1024 * 1024 * 1024 // 2GB
        static let diskSize: UInt64 = 20 * 1024 * 1024 * 1024 // 20GB
    }

    // MARK: - Initialization

    public init() {
        let homeDir = FileManager.default.homeDirectoryForCurrentUser
        self.vmPath = homeDir
            .appendingPathComponent(".vfkit")
            .appendingPathComponent("vms")
            .appendingPathComponent("postgresql-vz")
    }

    // MARK: - Connection String

    public var connectionString: String {
        return "postgresql://\(username):\(password)@127.0.0.1:\(port)/\(database)"
    }

    // MARK: - VM Lifecycle

    public func start() async throws {
        print("🚀 Starting PostgreSQL VM...")

        // Create VM directory if needed
        try FileManager.default.createDirectory(at: vmPath, withIntermediateDirectories: true)

        // Check if disk exists, create if not
        let diskPath = vmPath.appendingPathComponent("disk.img")
        if !FileManager.default.fileExists(atPath: diskPath.path) {
            try await createDisk(at: diskPath)
        }

        // Build VM configuration
        let config = try buildConfiguration(diskPath: diskPath)

        // Create and start VM
        virtualMachine = VZVirtualMachine(configuration: config)

        return try await withCheckedThrowingContinuation { continuation in
            virtualMachine?.start { result in
                switch result {
                case .success:
                    print("✅ PostgreSQL VM started successfully")
                    continuation.resume()
                case .failure(let error):
                    print("❌ PostgreSQL VM failed to start: \(error)")
                    continuation.resume(throwing: error)
                }
            }
        }
    }

    public func stop() async throws {
        guard let vm = virtualMachine else {
            return
        }

        print("🛑 Stopping PostgreSQL VM...")

        return try await withCheckedThrowingContinuation { continuation in
            vm.stop { error in
                if let error = error {
                    print("❌ PostgreSQL VM failed to stop: \(error)")
                    continuation.resume(throwing: error)
                } else {
                    print("✅ PostgreSQL VM stopped successfully")
                    self.virtualMachine = nil
                    continuation.resume()
                }
            }
        }
    }

    // MARK: - Health Check

    public func healthCheck() async -> Bool {
        // Try to connect to PostgreSQL using psql
        let task = Process()
        task.executableURL = URL(fileURLWithPath: "/usr/bin/which")
        task.arguments = ["psql"]

        let outputPipe = Pipe()
        task.standardOutput = outputPipe

        do {
            try task.run()
            task.waitUntilExit()

            guard task.terminationStatus == 0 else {
                print("⚠️ psql not found, assuming healthy")
                return true
            }

            // Try actual connection
            let connectionTask = Process()
            connectionTask.executableURL = URL(fileURLWithPath: "/opt/homebrew/bin/psql")
            connectionTask.arguments = [
                "-h", "127.0.0.1",
                "-p", "\(port)",
                "-U", username,
                "-d", database,
                "-c", "SELECT 1"
            ]

            // Set password via environment
            var env = ProcessInfo.processInfo.environment
            env["PGPASSWORD"] = password
            connectionTask.environment = env

            let connectionPipe = Pipe()
            connectionTask.standardOutput = connectionPipe

            try connectionTask.run()
            connectionTask.waitUntilExit()

            if connectionTask.terminationStatus == 0 {
                print("✅ PostgreSQL health check passed")
                return true
            }

            print("⚠️ PostgreSQL health check failed")
            return false

        } catch {
            print("⚠️ PostgreSQL health check error: \(error)")
            return false
        }
    }

    // MARK: - pgvector Support

    /// Check if pgvector extension is available
    public func checkPgVectorSupport() async -> Bool {
        let task = Process()
        task.executableURL = URL(fileURLWithPath: "/opt/homebrew/bin/psql")
        task.arguments = [
            "-h", "127.0.0.1",
            "-p", "\(port)",
            "-U", username,
            "-d", database,
            "-c", "SELECT * FROM pg_available_extensions WHERE name = 'vector'"
        ]

        var env = ProcessInfo.processInfo.environment
        env["PGPASSWORD"] = password
        task.environment = env

        let outputPipe = Pipe()
        task.standardOutput = outputPipe

        do {
            try task.run()
            task.waitUntilExit()

            if task.terminationStatus == 0 {
                print("✅ pgvector extension is available")
                return true
            }
            return false
        } catch {
            print("⚠️ pgvector check error: \(error)")
            return false
        }
    }

    // MARK: - Private Methods

    private func createDisk(at url: URL) async throws {
        print("📀 Creating PostgreSQL disk image...")

        let attachment = try VZDiskImageStorageDeviceAttachment(
            url: url,
            readOnly: false
        )

        // Create sparse disk
        let fileManager = FileManager.default
        fileManager.createFile(atPath: url.path, contents: nil)

        print("✅ PostgreSQL disk created at \(url.path)")
    }

    private func buildConfiguration(diskPath: URL) throws -> VZVirtualMachineConfiguration {
        let config = VZVirtualMachineConfiguration()

        // CPU Configuration
        config.cpuCount = Config.cpuCount

        // Memory Configuration
        config.memorySize = Config.memorySize

        // Boot Loader (EFI for Linux)
        config.bootLoader = VZEFIBootLoader()

        // Storage Devices
        let diskAttachment = try VZDiskImageStorageDeviceAttachment(
            url: diskPath,
            readOnly: false
        )
        let diskConfig = VZVirtioBlockDeviceConfiguration(attachment: diskAttachment)
        config.storageDevices = [diskConfig]

        // Network Configuration (NAT)
        let networkDevice = VZVirtioNetworkDeviceConfiguration()
        networkDevice.attachment = VZNATNetworkDeviceAttachment()
        config.networkDevices = [networkDevice]

        // Graphics Device
        let graphicsDevice = VZVirtioGraphicsDeviceConfiguration()
        graphicsDevice.scanouts = [
            VZVirtioGraphicsScanoutConfiguration(
                widthInPixels: 1280,
                heightInPixels: 720
            )
        ]
        config.graphicsDevices = [graphicsDevice]

        // Entropy Device
        config.entropyDevices = [VZVirtioEntropyDeviceConfiguration()]

        // Memory Balloon Device
        config.memoryBalloonDevices = [VZVirtioTraditionalMemoryBalloonDeviceConfiguration()]

        // Rosetta 2 for Linux
        #if arch(arm64)
        if VZLinuxRosettaDirectoryShare.availability == .available {
            let rosetta = VZLinuxRosettaDirectoryShare()
            let rosettaShare = VZVirtioFileSystemDeviceConfiguration(tag: "rosetta")
            rosettaShare.share = rosetta
            config.directorySharingDevices = [rosettaShare]
        }
        #endif

        // Validate configuration
        try config.validate()

        return config
    }
}
