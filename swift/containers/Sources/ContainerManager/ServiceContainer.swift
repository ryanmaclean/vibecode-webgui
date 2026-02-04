// ServiceContainer.swift
// ContainerManager - Base service container protocol
//
// Provides common interface for managing containerized services
// using Apple Virtualization.framework for native macOS performance

import Foundation
import Virtualization

// MARK: - Container Status

/// Represents the current state of a container
public enum ContainerStatus: Equatable, Sendable {
    case notCreated
    case created
    case starting
    case running
    case stopping
    case stopped
    case error(String)

    public var isActive: Bool {
        switch self {
        case .running, .starting:
            return true
        default:
            return false
        }
    }

    public var description: String {
        switch self {
        case .notCreated: return "Not Created"
        case .created: return "Created"
        case .starting: return "Starting"
        case .running: return "Running"
        case .stopping: return "Stopping"
        case .stopped: return "Stopped"
        case .error(let message): return "Error: \(message)"
        }
    }
}

// MARK: - Container Configuration

/// Configuration for creating a container
public struct ContainerConfiguration: Sendable {
    public let name: String
    public let image: String
    public let cpuCount: Int
    public let memorySize: UInt64
    public let diskSize: UInt64
    public let ports: [PortMapping]
    public let volumes: [VolumeMount]
    public let environment: [String: String]

    public init(
        name: String,
        image: String,
        cpuCount: Int = 2,
        memorySize: UInt64 = 2 * 1024 * 1024 * 1024,
        diskSize: UInt64 = 10 * 1024 * 1024 * 1024,
        ports: [PortMapping] = [],
        volumes: [VolumeMount] = [],
        environment: [String: String] = [:]
    ) {
        self.name = name
        self.image = image
        self.cpuCount = cpuCount
        self.memorySize = memorySize
        self.diskSize = diskSize
        self.ports = ports
        self.volumes = volumes
        self.environment = environment
    }
}

// MARK: - Port Mapping

/// Maps a host port to a container port
public struct PortMapping: Sendable, Equatable {
    public let hostPort: Int
    public let containerPort: Int
    public let protocol_: PortProtocol

    public enum PortProtocol: String, Sendable {
        case tcp = "tcp"
        case udp = "udp"
    }

    public init(hostPort: Int, containerPort: Int, protocol_: PortProtocol = .tcp) {
        self.hostPort = hostPort
        self.containerPort = containerPort
        self.protocol_ = protocol_
    }

    public static func port(_ port: Int, protocol_: PortProtocol = .tcp) -> PortMapping {
        PortMapping(hostPort: port, containerPort: port, protocol_: protocol_)
    }
}

// MARK: - Volume Mount

/// Mounts a host directory into the container
public struct VolumeMount: Sendable, Equatable {
    public let hostPath: URL
    public let containerPath: String
    public let readOnly: Bool

    public init(hostPath: URL, containerPath: String, readOnly: Bool = false) {
        self.hostPath = hostPath
        self.containerPath = containerPath
        self.readOnly = readOnly
    }
}

// MARK: - Health Check Configuration

/// Configuration for container health checks
public struct HealthCheckConfiguration: Sendable {
    public let interval: TimeInterval
    public let timeout: TimeInterval
    public let retries: Int
    public let startPeriod: TimeInterval
    public let command: HealthCheckCommand

    public enum HealthCheckCommand: Sendable {
        case tcp(port: Int)
        case http(port: Int, path: String)
        case exec(command: [String])
    }

    public init(
        interval: TimeInterval = 10,
        timeout: TimeInterval = 5,
        retries: Int = 3,
        startPeriod: TimeInterval = 30,
        command: HealthCheckCommand
    ) {
        self.interval = interval
        self.timeout = timeout
        self.retries = retries
        self.startPeriod = startPeriod
        self.command = command
    }
}

// MARK: - Container Errors

/// Errors that can occur during container operations
public enum ContainerError: LocalizedError {
    case notFound(String)
    case alreadyExists(String)
    case invalidConfiguration(String)
    case startupFailed(String)
    case shutdownFailed(String)
    case healthCheckFailed(String)
    case volumeMountFailed(String)
    case portBindingFailed(Int)
    case virtualizationUnavailable
    case appleSiliconRequired
    case diskCreationFailed(String)

    public var errorDescription: String? {
        switch self {
        case .notFound(let name):
            return "Container not found: \(name)"
        case .alreadyExists(let name):
            return "Container already exists: \(name)"
        case .invalidConfiguration(let reason):
            return "Invalid configuration: \(reason)"
        case .startupFailed(let reason):
            return "Container startup failed: \(reason)"
        case .shutdownFailed(let reason):
            return "Container shutdown failed: \(reason)"
        case .healthCheckFailed(let reason):
            return "Health check failed: \(reason)"
        case .volumeMountFailed(let path):
            return "Failed to mount volume: \(path)"
        case .portBindingFailed(let port):
            return "Failed to bind port: \(port)"
        case .virtualizationUnavailable:
            return "Virtualization.framework is not available"
        case .appleSiliconRequired:
            return "Apple silicon (M1/M2/M3/M4) is required"
        case .diskCreationFailed(let reason):
            return "Disk creation failed: \(reason)"
        }
    }
}

// MARK: - Service Container Protocol

/// Protocol defining the interface for all service containers
@available(macOS 14.0, *)
public protocol ServiceContainer: AnyObject, Sendable {
    var id: UUID { get }
    var name: String { get }
    var status: ContainerStatus { get }
    var configuration: ContainerConfiguration { get }
    var connectionString: String { get }
    var healthCheckConfig: HealthCheckConfiguration? { get }

    func create() async throws
    func start() async throws
    func stop() async throws
    func kill() async throws
    func restart() async throws
    func remove() async throws
    func healthCheck() async -> Bool
    func logs(tail: Int?) async throws -> String
    func exec(command: [String]) async throws -> String
    func resourceUsage() async throws -> ResourceUsage
}

// MARK: - Resource Usage

/// Current resource usage of a container
public struct ResourceUsage: Sendable {
    public let cpuPercent: Double
    public let memoryUsed: UInt64
    public let memoryLimit: UInt64
    public let diskUsed: UInt64
    public let diskLimit: UInt64
    public let networkRxBytes: UInt64
    public let networkTxBytes: UInt64
    public let timestamp: Date

    public var memoryPercent: Double {
        guard memoryLimit > 0 else { return 0 }
        return Double(memoryUsed) / Double(memoryLimit) * 100
    }

    public var diskPercent: Double {
        guard diskLimit > 0 else { return 0 }
        return Double(diskUsed) / Double(diskLimit) * 100
    }

    public init(
        cpuPercent: Double = 0,
        memoryUsed: UInt64 = 0,
        memoryLimit: UInt64 = 0,
        diskUsed: UInt64 = 0,
        diskLimit: UInt64 = 0,
        networkRxBytes: UInt64 = 0,
        networkTxBytes: UInt64 = 0,
        timestamp: Date = Date()
    ) {
        self.cpuPercent = cpuPercent
        self.memoryUsed = memoryUsed
        self.memoryLimit = memoryLimit
        self.diskUsed = diskUsed
        self.diskLimit = diskLimit
        self.networkRxBytes = networkRxBytes
        self.networkTxBytes = networkTxBytes
        self.timestamp = timestamp
    }
}

// MARK: - Base Service Container Implementation

/// Base implementation providing common functionality for all service containers
@available(macOS 14.0, *)
open class BaseServiceContainer: ServiceContainer {
    public let id: UUID
    public let name: String
    public private(set) var status: ContainerStatus = .notCreated
    public let configuration: ContainerConfiguration
    public var healthCheckConfig: HealthCheckConfiguration?

    internal var virtualMachine: VZVirtualMachine?
    internal let vmDirectory: URL
    internal let diskPath: URL
    internal var consoleOutput: [String] = []

    open var connectionString: String {
        fatalError("Subclasses must implement connectionString")
    }

    public init(configuration: ContainerConfiguration) {
        self.id = UUID()
        self.name = configuration.name
        self.configuration = configuration

        let homeDir = FileManager.default.homeDirectoryForCurrentUser
        self.vmDirectory = homeDir
            .appendingPathComponent(".vfkit")
            .appendingPathComponent("containers")
            .appendingPathComponent(configuration.name)
        self.diskPath = vmDirectory.appendingPathComponent("disk.img")
    }

    open func create() async throws {
        guard status == .notCreated else {
            throw ContainerError.alreadyExists(name)
        }
        #if !arch(arm64)
        throw ContainerError.appleSiliconRequired
        #endif
        try FileManager.default.createDirectory(at: vmDirectory, withIntermediateDirectories: true)
        if !FileManager.default.fileExists(atPath: diskPath.path) {
            try await createDiskImage()
        }
        status = .created
    }

    open func start() async throws {
        guard status == .created || status == .stopped else {
            throw ContainerError.invalidConfiguration("Container must be created or stopped to start")
        }
        status = .starting
        do {
            let config = try buildVMConfiguration()
            let vm = VZVirtualMachine(configuration: config)
            self.virtualMachine = vm
            try await vm.start()
            try await waitForServiceReady()
            status = .running
        } catch {
            status = .error(error.localizedDescription)
            throw ContainerError.startupFailed(error.localizedDescription)
        }
    }

    open func stop() async throws {
        guard status == .running else { return }
        status = .stopping
        guard let vm = virtualMachine else {
            status = .stopped
            return
        }
        do {
            try await vm.stop()
            virtualMachine = nil
            status = .stopped
        } catch {
            status = .error(error.localizedDescription)
            throw ContainerError.shutdownFailed(error.localizedDescription)
        }
    }

    open func kill() async throws {
        guard let vm = virtualMachine else {
            status = .stopped
            return
        }
        try await vm.stop()
        virtualMachine = nil
        status = .stopped
    }

    open func restart() async throws {
        try await stop()
        try await Task.sleep(for: .seconds(2))
        try await start()
    }

    open func remove() async throws {
        if status == .running { try await stop() }
        if FileManager.default.fileExists(atPath: vmDirectory.path) {
            try FileManager.default.removeItem(at: vmDirectory)
        }
        status = .notCreated
    }

    open func healthCheck() async -> Bool {
        guard status == .running else { return false }
        guard let config = healthCheckConfig else { return true }
        switch config.command {
        case .tcp(let port):
            return await checkTCPHealth(port: port, timeout: config.timeout)
        case .http(let port, let path):
            return await checkHTTPHealth(port: port, path: path, timeout: config.timeout)
        case .exec(let command):
            return await checkExecHealth(command: command, timeout: config.timeout)
        }
    }

    open func logs(tail: Int? = nil) async throws -> String {
        let lines = tail.map { consoleOutput.suffix($0) } ?? consoleOutput[...]
        return lines.joined(separator: "\n")
    }

    open func exec(command: [String]) async throws -> String {
        fatalError("Subclasses must implement exec(command:)")
    }

    open func resourceUsage() async throws -> ResourceUsage {
        return ResourceUsage(memoryLimit: configuration.memorySize, diskLimit: configuration.diskSize, timestamp: Date())
    }

    open func buildVMConfiguration() throws -> VZVirtualMachineConfiguration {
        let config = VZVirtualMachineConfiguration()
        config.cpuCount = configuration.cpuCount
        config.memorySize = configuration.memorySize
        config.bootLoader = VZEFIBootLoader()
        let diskAttachment = try VZDiskImageStorageDeviceAttachment(url: diskPath, readOnly: false)
        config.storageDevices = [VZVirtioBlockDeviceConfiguration(attachment: diskAttachment)]
        let networkDevice = VZVirtioNetworkDeviceConfiguration()
        networkDevice.attachment = VZNATNetworkDeviceAttachment()
        config.networkDevices = [networkDevice]
        config.entropyDevices = [VZVirtioEntropyDeviceConfiguration()]
        config.memoryBalloonDevices = [VZVirtioTraditionalMemoryBalloonDeviceConfiguration()]
        var sharingDevices: [VZDirectorySharingDeviceConfiguration] = []
        for volume in configuration.volumes {
            let share = VZSingleDirectoryShare(directory: VZSharedDirectory(url: volume.hostPath, readOnly: volume.readOnly))
            let sharingDevice = VZVirtioFileSystemDeviceConfiguration(tag: volume.containerPath)
            sharingDevice.share = share
            sharingDevices.append(sharingDevice)
        }
        #if arch(arm64)
        if VZLinuxRosettaDirectoryShare.availability == .available {
            let rosetta = VZLinuxRosettaDirectoryShare()
            let rosettaShare = VZVirtioFileSystemDeviceConfiguration(tag: "rosetta")
            rosettaShare.share = rosetta
            sharingDevices.append(rosettaShare)
        }
        #endif
        config.directorySharingDevices = sharingDevices
        try config.validate()
        return config
    }

    private func createDiskImage() async throws {
        FileManager.default.createFile(atPath: diskPath.path, contents: nil)
        let fileHandle = try FileHandle(forWritingTo: diskPath)
        try fileHandle.truncate(atOffset: configuration.diskSize)
        try fileHandle.close()
    }

    internal func waitForServiceReady() async throws {
        try await Task.sleep(for: .seconds(5))
    }

    private func checkTCPHealth(port: Int, timeout: TimeInterval) async -> Bool { return true }

    private func checkHTTPHealth(port: Int, path: String, timeout: TimeInterval) async -> Bool {
        guard let url = URL(string: "http://127.0.0.1:\(port)\(path)") else { return false }
        var request = URLRequest(url: url, timeoutInterval: timeout)
        request.httpMethod = "GET"
        do {
            let (_, response) = try await URLSession.shared.data(for: request)
            if let httpResponse = response as? HTTPURLResponse { return httpResponse.statusCode == 200 }
            return false
        } catch { return false }
    }

    private func checkExecHealth(command: [String], timeout: TimeInterval) async -> Bool { return true }
}
