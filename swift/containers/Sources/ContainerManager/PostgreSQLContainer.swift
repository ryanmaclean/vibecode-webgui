// PostgreSQLContainer.swift
// ContainerManager - PostgreSQL container management with pgvector support

import Foundation
import Virtualization

// MARK: - PostgreSQL Configuration

public struct PostgreSQLConfiguration: Sendable {
    public let database: String
    public let username: String
    public let password: String
    public let port: Int
    public let maxConnections: Int
    public let sharedBuffers: String
    public let enablePgVector: Bool
    public let initScripts: [URL]

    public init(
        database: String = "vibecode",
        username: String = "vibecode",
        password: String? = nil,
        port: Int = 5432,
        maxConnections: Int = 100,
        sharedBuffers: String = "256MB",
        enablePgVector: Bool = true,
        initScripts: [URL] = []
    ) {
        self.database = database
        self.username = username
        self.password = password ?? PostgreSQLConfiguration.generateSecurePassword()
        self.port = port
        self.maxConnections = maxConnections
        self.sharedBuffers = sharedBuffers
        self.enablePgVector = enablePgVector
        self.initScripts = initScripts
    }

    public static func generateSecurePassword(length: Int = 32) -> String {
        let characters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*"
        var password = ""
        var randomBytes = [UInt8](repeating: 0, count: length)
        _ = SecRandomCopyBytes(kSecRandomDefault, length, &randomBytes)
        for byte in randomBytes {
            let index = Int(byte) % characters.count
            password.append(characters[characters.index(characters.startIndex, offsetBy: index)])
        }
        return password
    }
}

// MARK: - PostgreSQL Container

@available(macOS 14.0, *)
public final class PostgreSQLContainer: BaseServiceContainer, @unchecked Sendable {
    private let pgConfig: PostgreSQLConfiguration
    private let kernelPath: URL
    private let initramfsPath: URL

    public override var connectionString: String {
        "postgresql://\(pgConfig.username):\(pgConfig.password)@127.0.0.1:\(pgConfig.port)/\(pgConfig.database)"
    }

    public var dsn: String {
        "host=127.0.0.1 port=\(pgConfig.port) dbname=\(pgConfig.database) user=\(pgConfig.username) password=\(pgConfig.password)"
    }

    public var password: String { pgConfig.password }

    public convenience init(name: String = "postgresql") {
        self.init(name: name, pgConfig: PostgreSQLConfiguration())
    }

    public init(name: String = "postgresql", pgConfig: PostgreSQLConfiguration) {
        self.pgConfig = pgConfig
        let homeDir = FileManager.default.homeDirectoryForCurrentUser
        let kernelDir = homeDir.appendingPathComponent(".vfkit/vms/vibecode-alpine/kernel")
        self.kernelPath = kernelDir.appendingPathComponent("vmlinuz")
        self.initramfsPath = kernelDir.appendingPathComponent("initramfs")

        let containerConfig = ContainerConfiguration(
            name: name,
            image: "ankane/pgvector:latest",
            cpuCount: 2,
            memorySize: 2 * 1024 * 1024 * 1024,
            diskSize: 20 * 1024 * 1024 * 1024,
            ports: [PortMapping.port(pgConfig.port)],
            environment: [
                "POSTGRES_DB": pgConfig.database,
                "POSTGRES_USER": pgConfig.username,
                "POSTGRES_PASSWORD": pgConfig.password,
                "POSTGRES_MAX_CONNECTIONS": String(pgConfig.maxConnections)
            ]
        )
        super.init(configuration: containerConfig)
        self.healthCheckConfig = HealthCheckConfiguration(interval: 10, timeout: 5, retries: 3, startPeriod: 30, command: .tcp(port: pgConfig.port))
    }

    public override func buildVMConfiguration() throws -> VZVirtualMachineConfiguration {
        let config = VZVirtualMachineConfiguration()
        config.cpuCount = configuration.cpuCount
        config.memorySize = configuration.memorySize
        if FileManager.default.fileExists(atPath: kernelPath.path) {
            let bootloader = VZLinuxBootLoader(kernelURL: kernelPath)
            if FileManager.default.fileExists(atPath: initramfsPath.path) {
                bootloader.initialRamdiskURL = initramfsPath
            }
            bootloader.commandLine = "console=hvc0 root=/dev/vda rw"
            config.bootLoader = bootloader
        } else {
            config.bootLoader = VZEFIBootLoader()
        }
        let diskAttachment = try VZDiskImageStorageDeviceAttachment(url: diskPath, readOnly: false)
        config.storageDevices = [VZVirtioBlockDeviceConfiguration(attachment: diskAttachment)]
        let networkDevice = VZVirtioNetworkDeviceConfiguration()
        networkDevice.attachment = VZNATNetworkDeviceAttachment()
        config.networkDevices = [networkDevice]
        let serialPort = VZVirtioConsoleDeviceSerialPortConfiguration()
        let inputPipe = Pipe()
        let outputPipe = Pipe()
        outputPipe.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let data = handle.availableData
            if !data.isEmpty, let line = String(data: data, encoding: .utf8) {
                Task { @MainActor in
                    self?.consoleOutput.append(line)
                    if let count = self?.consoleOutput.count, count > 1000 {
                        self?.consoleOutput.removeFirst(count - 1000)
                    }
                }
            }
        }
        serialPort.attachment = VZFileHandleSerialPortAttachment(fileHandleForReading: inputPipe.fileHandleForReading, fileHandleForWriting: outputPipe.fileHandleForWriting)
        config.serialPorts = [serialPort]
        config.entropyDevices = [VZVirtioEntropyDeviceConfiguration()]
        config.memoryBalloonDevices = [VZVirtioTraditionalMemoryBalloonDeviceConfiguration()]
        #if arch(arm64)
        if VZLinuxRosettaDirectoryShare.availability == .available {
            let rosetta = VZLinuxRosettaDirectoryShare()
            let rosettaShare = VZVirtioFileSystemDeviceConfiguration(tag: "rosetta")
            rosettaShare.share = rosetta
            config.directorySharingDevices = [rosettaShare]
        }
        #endif
        try config.validate()
        return config
    }

    override func waitForServiceReady() async throws {
        let maxAttempts = 30
        for attempt in 1...maxAttempts {
            if await checkPostgreSQLReady() { return }
            if attempt < maxAttempts { try await Task.sleep(nanoseconds: 1_000_000_000) }
        }
        throw ContainerError.healthCheckFailed("PostgreSQL did not become ready within \(maxAttempts) seconds")
    }

    public override func healthCheck() async -> Bool {
        guard status == .running else { return false }
        return await checkPostgreSQLReady()
    }

    private func checkPostgreSQLReady() async -> Bool {
        guard let psqlPath = findPsql() else { return await checkTCPConnection() }
        let task = Process()
        task.executableURL = URL(fileURLWithPath: psqlPath)
        task.arguments = ["-h", "127.0.0.1", "-p", String(pgConfig.port), "-U", pgConfig.username, "-d", pgConfig.database, "-c", "SELECT 1"]
        var env = ProcessInfo.processInfo.environment
        env["PGPASSWORD"] = pgConfig.password
        task.environment = env
        task.standardOutput = Pipe()
        task.standardError = Pipe()
        do { try task.run(); task.waitUntilExit(); return task.terminationStatus == 0 } catch { return false }
    }

    private func checkTCPConnection() async -> Bool {
        let socket = socket(AF_INET, SOCK_STREAM, 0)
        guard socket >= 0 else { return false }
        defer { close(socket) }
        var addr = sockaddr_in()
        addr.sin_family = sa_family_t(AF_INET)
        addr.sin_port = UInt16(pgConfig.port).bigEndian
        addr.sin_addr.s_addr = inet_addr("127.0.0.1")
        return withUnsafePointer(to: &addr) { $0.withMemoryRebound(to: sockaddr.self, capacity: 1) { Darwin.connect(socket, $0, socklen_t(MemoryLayout<sockaddr_in>.size)) } } == 0
    }

    private func findPsql() -> String? {
        for path in ["/opt/homebrew/bin/psql", "/usr/local/bin/psql", "/usr/bin/psql"] {
            if FileManager.default.fileExists(atPath: path) { return path }
        }
        return nil
    }

    public func query(_ sql: String) async throws -> String {
        guard let psqlPath = findPsql() else { throw ContainerError.healthCheckFailed("psql not found") }
        let task = Process()
        task.executableURL = URL(fileURLWithPath: psqlPath)
        task.arguments = ["-h", "127.0.0.1", "-p", String(pgConfig.port), "-U", pgConfig.username, "-d", pgConfig.database, "-c", sql]
        var env = ProcessInfo.processInfo.environment
        env["PGPASSWORD"] = pgConfig.password
        task.environment = env
        let outputPipe = Pipe()
        let errorPipe = Pipe()
        task.standardOutput = outputPipe
        task.standardError = errorPipe
        try task.run()
        task.waitUntilExit()
        let outputData = outputPipe.fileHandleForReading.readDataToEndOfFile()
        let errorData = errorPipe.fileHandleForReading.readDataToEndOfFile()
        if task.terminationStatus != 0 {
            throw ContainerError.healthCheckFailed("Query failed: \(String(data: errorData, encoding: .utf8) ?? "Unknown error")")
        }
        return String(data: outputData, encoding: .utf8) ?? ""
    }

    public func checkPgVectorSupport() async -> Bool {
        do { return try await query("SELECT * FROM pg_available_extensions WHERE name = 'vector'").contains("vector") } catch { return false }
    }

    public func enablePgVector() async throws { _ = try await query("CREATE EXTENSION IF NOT EXISTS vector") }

    public func createVectorTable(name: String, dimensions: Int, additionalColumns: String = "") async throws {
        var columns = "id SERIAL PRIMARY KEY, embedding vector(\(dimensions))"
        if !additionalColumns.isEmpty { columns += ", \(additionalColumns)" }
        _ = try await query("CREATE TABLE IF NOT EXISTS \(name) (\(columns))")
    }

    public func databaseSize() async throws -> String {
        try await query("SELECT pg_size_pretty(pg_database_size('\(pgConfig.database)'))").trimmingCharacters(in: .whitespacesAndNewlines)
    }

    public func listTables() async throws -> [String] {
        try await query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")
            .split(separator: "\n").dropFirst(2).map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty && !$0.starts(with: "(") }
    }

    public override func exec(command: [String]) async throws -> String {
        guard !command.isEmpty else { throw ContainerError.invalidConfiguration("Empty command") }
        return try await query(command.joined(separator: " "))
    }

    public var connectionInfo: [String: String] {
        ["host": "127.0.0.1", "port": String(pgConfig.port), "database": pgConfig.database, "username": pgConfig.username, "password": pgConfig.password, "connectionString": connectionString, "dsn": dsn]
    }
}

// MARK: - Builder

@available(macOS 14.0, *)
public class PostgreSQLContainerBuilder {
    private var name: String = "postgresql"
    private var database: String = "vibecode"
    private var username: String = "vibecode"
    private var password: String?
    private var port: Int = 5432
    private var maxConnections: Int = 100
    private var sharedBuffers: String = "256MB"
    private var enablePgVector: Bool = true
    private var memoryGB: Int = 2
    private var cpuCount: Int = 2

    public init() {}
    public func name(_ name: String) -> Self { self.name = name; return self }
    public func database(_ database: String) -> Self { self.database = database; return self }
    public func username(_ username: String) -> Self { self.username = username; return self }
    public func password(_ password: String) -> Self { self.password = password; return self }
    public func port(_ port: Int) -> Self { self.port = port; return self }
    public func maxConnections(_ maxConnections: Int) -> Self { self.maxConnections = maxConnections; return self }
    public func sharedBuffers(_ sharedBuffers: String) -> Self { self.sharedBuffers = sharedBuffers; return self }
    public func withPgVector(_ enabled: Bool = true) -> Self { self.enablePgVector = enabled; return self }
    public func memory(gigabytes: Int) -> Self { self.memoryGB = gigabytes; return self }
    public func cpus(_ count: Int) -> Self { self.cpuCount = count; return self }
    public func build() -> PostgreSQLContainer {
        PostgreSQLContainer(name: name, pgConfig: PostgreSQLConfiguration(database: database, username: username, password: password, port: port, maxConnections: maxConnections, sharedBuffers: sharedBuffers, enablePgVector: enablePgVector))
    }
}

@available(macOS 14.0, *)
extension PostgreSQLContainer {
    public static func builder() -> PostgreSQLContainerBuilder { PostgreSQLContainerBuilder() }
    public static func quickStart(name: String = "postgresql") async throws -> PostgreSQLContainer {
        let container = PostgreSQLContainer(name: name)
        try await container.create()
        try await container.start()
        return container
    }
}
