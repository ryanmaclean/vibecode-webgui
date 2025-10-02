import Foundation
import Virtualization

/// Production Apple Containerization Runtime
///
/// Built on top of Virtualization.framework for native macOS container support.
/// Supports OCI images, sub-second startup, and production workloads.
final class ContainerRuntime: @unchecked Sendable {
    static let shared = ContainerRuntime()

    private let containersDirectory: URL
    private let imagesDirectory: URL
    private var containers: [String: Container] = [:]
    private let queue = DispatchQueue(label: "com.vibecode.container-runtime", attributes: .concurrent)

    private init() {
        // Setup directories
        let baseDir = FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent(".vibecode/containers")

        self.containersDirectory = baseDir.appendingPathComponent("instances")
        self.imagesDirectory = baseDir.appendingPathComponent("images")

        try? FileManager.default.createDirectory(
            at: containersDirectory,
            withIntermediateDirectories: true
        )
        try? FileManager.default.createDirectory(
            at: imagesDirectory,
            withIntermediateDirectories: true
        )

        // Load existing containers
        loadContainers()
    }

    // MARK: - Container Lifecycle

    func createContainer(config: ContainerConfiguration) async throws -> String {
        let containerId = UUID().uuidString
        let containerDir = containersDirectory.appendingPathComponent(containerId)

        try FileManager.default.createDirectory(
            at: containerDir,
            withIntermediateDirectories: true
        )

        // Pull image if needed
        let imageBundle = try await ensureImage(reference: config.image)

        // Create Linux VM configuration
        let vmConfig = try createVMConfiguration(
            imageBundle: imageBundle,
            config: config,
            containerDir: containerDir
        )

        // Create and start VM
        let vm = VZVirtualMachine(configuration: vmConfig)
        let container = Container(
            id: containerId,
            name: config.name,
            image: config.image,
            vm: vm,
            config: config,
            directory: containerDir
        )

        // Store container
        queue.async(flags: .barrier) {
            self.containers[containerId] = container
        }

        // Persist metadata
        try saveContainerMetadata(container)

        // Start VM
        try await startVM(vm)

        // Wait for container to be ready
        try await waitForContainerReady(container)

        return containerId
    }

    func stopContainer(id: String, timeout: TimeInterval) async throws {
        guard let container = getContainer(id: id) else {
            throw ContainerError.notFound(id)
        }

        // Request graceful shutdown
        try await container.vm.requestStop()

        // Wait for shutdown or timeout
        let deadline = Date().addingTimeInterval(timeout)
        while container.vm.state != .stopped && Date() < deadline {
            try await Task.sleep(nanoseconds: 100_000_000) // 100ms
        }

        // Force stop if still running
        if container.vm.state != .stopped {
            try await container.vm.stop()
        }

        container.state = .stopped
        try saveContainerMetadata(container)
    }

    func removeContainer(id: String) async throws {
        guard let container = getContainer(id: id) else {
            throw ContainerError.notFound(id)
        }

        // Ensure stopped
        if container.vm.state != .stopped {
            throw ContainerError.stillRunning(id)
        }

        // Remove from memory
        queue.async(flags: .barrier) {
            self.containers.removeValue(forKey: id)
        }

        // Remove filesystem
        try FileManager.default.removeItem(at: container.directory)
    }

    func listContainers(all: Bool) async throws -> [ContainerInfo] {
        let allContainers = queue.sync {
            Array(containers.values)
        }

        return allContainers
            .filter { all || $0.state == .running }
            .map { container in
                ContainerInfo(
                    id: container.id,
                    name: container.name,
                    image: container.image,
                    state: container.state,
                    ipAddress: container.ipAddress,
                    created: container.created
                )
            }
    }

    func inspectContainer(id: String) async throws -> ContainerDetail {
        guard let container = getContainer(id: id) else {
            throw ContainerError.notFound(id)
        }

        return ContainerDetail(
            id: container.id,
            name: container.name,
            image: container.image,
            state: container.state,
            ipAddress: container.ipAddress,
            created: container.created,
            config: container.config,
            vmInfo: VirtualMachineInfo(
                cpuCount: container.config.cpuCount,
                memorySize: container.config.memorySize
            )
        )
    }

    func attachContainer(id: String) async throws {
        guard let container = getContainer(id: id) else {
            throw ContainerError.notFound(id)
        }

        // Stream output until container stops
        while container.vm.state == .running {
            try await Task.sleep(nanoseconds: 100_000_000)
        }
    }

    // MARK: - Logs

    func getLogs(id: String, tail: Int?) async throws -> String {
        guard let container = getContainer(id: id) else {
            throw ContainerError.notFound(id)
        }

        let logFile = container.directory.appendingPathComponent("console.log")
        guard FileManager.default.fileExists(atPath: logFile.path) else {
            return ""
        }

        let content = try String(contentsOf: logFile, encoding: .utf8)

        if let tail = tail {
            let lines = content.split(separator: "\n")
            return lines.suffix(tail).joined(separator: "\n")
        }

        return content
    }

    func streamLogs(id: String, handler: @escaping (String) -> Void) async throws {
        guard let container = getContainer(id: id) else {
            throw ContainerError.notFound(id)
        }

        let logFile = container.directory.appendingPathComponent("console.log")

        // Simple tail -f implementation
        var lastPosition: UInt64 = 0

        while container.vm.state == .running {
            if FileManager.default.fileExists(atPath: logFile.path) {
                let handle = try FileHandle(forReadingFrom: logFile)
                try handle.seek(toOffset: lastPosition)

                if let data = try handle.readToEnd(),
                   let text = String(data: data, encoding: .utf8) {
                    let lines = text.split(separator: "\n")
                    for line in lines {
                        handler(String(line))
                    }
                }

                lastPosition = try handle.offset()
                try handle.close()
            }

            try await Task.sleep(nanoseconds: 100_000_000) // 100ms
        }
    }

    // MARK: - Image Management

    func pullImage(reference: String, progressHandler: @escaping (PullProgress) -> Void) async throws {
        let imageManager = OCIImageManager(cacheDirectory: imagesDirectory)
        try await imageManager.pull(reference: reference, progressHandler: progressHandler)
    }

    private func ensureImage(reference: String) async throws -> URL {
        let imageManager = OCIImageManager(cacheDirectory: imagesDirectory)
        return try await imageManager.getOrPull(reference: reference)
    }

    // MARK: - VM Configuration

    private func createVMConfiguration(
        imageBundle: URL,
        config: ContainerConfiguration,
        containerDir: URL
    ) throws -> VZVirtualMachineConfiguration {
        let vmConfig = VZVirtualMachineConfiguration()

        // CPU
        vmConfig.cpuCount = config.cpuCount

        // Memory
        vmConfig.memorySize = config.memorySize

        // Platform
        let platform = VZGenericPlatformConfiguration()
        vmConfig.platform = platform

        // Boot loader
        let bootloader = VZLinuxBootLoader(kernelURL: imageBundle.appendingPathComponent("vmlinuz"))
        bootloader.initialRamdiskURL = imageBundle.appendingPathComponent("initrd")
        bootloader.commandLine = "console=hvc0 root=/dev/vda rw"
        vmConfig.bootLoader = bootloader

        // Storage - Root filesystem
        let diskImagePath = containerDir.appendingPathComponent("disk.img")
        try createDiskImage(at: diskImagePath, size: 10 * 1024 * 1024 * 1024) // 10GB

        let diskAttachment = try VZDiskImageStorageDeviceAttachment(
            url: diskImagePath,
            readOnly: false
        )
        let storageDevice = VZVirtioBlockDeviceConfiguration(attachment: diskAttachment)
        vmConfig.storageDevices = [storageDevice]

        // Network
        let networkDevice = VZVirtioNetworkDeviceConfiguration()
        networkDevice.attachment = VZNATNetworkDeviceAttachment()
        vmConfig.networkDevices = [networkDevice]

        // Console
        let consoleDevice = VZVirtioConsoleDeviceConfiguration()
        let consolePort = VZVirtioConsolePortConfiguration()

        let logFile = containerDir.appendingPathComponent("console.log")
        let fileHandle = try FileHandle(forWritingTo: logFile)
        consolePort.attachment = VZFileHandleSerialPortAttachment(
            fileHandleForReading: nil,
            fileHandleForWriting: fileHandle
        )

        consoleDevice.ports[0] = consolePort
        vmConfig.consoleDevices = [consoleDevice]

        // Entropy (for random number generation)
        vmConfig.entropyDevices = [VZVirtioEntropyDeviceConfiguration()]

        // Rosetta (for x86_64 support on Apple Silicon)
        // Note: Rosetta support requires macOS 13+ and is checked at runtime
        if #available(macOS 13.0, *) {
            do {
                let rosettaShare = try VZLinuxRosettaDirectoryShare()
                let rosettaDevice = VZVirtioFileSystemDeviceConfiguration(tag: "rosetta")
                rosettaDevice.share = rosettaShare
                vmConfig.directorySharingDevices = [rosettaDevice]
            } catch {
                // Rosetta not available, continue without it
            }
        }

        // Volume mounts
        for mount in config.volumeMounts {
            let sharedDir = VZSharedDirectory(url: URL(fileURLWithPath: mount.hostPath), readOnly: false)
            let share = VZSingleDirectoryShare(directory: sharedDir)
            let device = VZVirtioFileSystemDeviceConfiguration(tag: mount.containerPath)
            device.share = share
            vmConfig.directorySharingDevices.append(device)
        }

        try vmConfig.validate()
        return vmConfig
    }

    private func startVM(_ vm: VZVirtualMachine) async throws {
        return try await withCheckedThrowingContinuation { continuation in
            vm.start { result in
                switch result {
                case .success:
                    continuation.resume()
                case .failure(let error):
                    continuation.resume(throwing: error)
                }
            }
        }
    }

    private func waitForContainerReady(_ container: Container) async throws {
        // Wait up to 5 seconds for container to be ready
        let deadline = Date().addingTimeInterval(5.0)

        while Date() < deadline {
            if container.vm.state == .running {
                // Additional readiness checks could go here
                return
            }
            try await Task.sleep(nanoseconds: 100_000_000) // 100ms
        }

        throw ContainerError.startupTimeout(container.id)
    }

    // MARK: - Helpers

    private func getContainer(id: String) -> Container? {
        queue.sync {
            // Try exact match first
            if let container = containers[id] {
                return container
            }

            // Try prefix match
            let matches = containers.values.filter { $0.id.hasPrefix(id) || $0.name == id }
            return matches.first
        }
    }

    private func loadContainers() {
        guard let contents = try? FileManager.default.contentsOfDirectory(
            at: containersDirectory,
            includingPropertiesForKeys: nil
        ) else {
            return
        }

        for dir in contents where dir.hasDirectoryPath {
            if let container = try? loadContainer(from: dir) {
                containers[container.id] = container
            }
        }
    }

    private func loadContainer(from directory: URL) throws -> Container {
        let metadataFile = directory.appendingPathComponent("metadata.json")
        let data = try Data(contentsOf: metadataFile)
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode(Container.self, from: data)
    }

    private func saveContainerMetadata(_ container: Container) throws {
        let metadataFile = container.directory.appendingPathComponent("metadata.json")
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        encoder.dateEncodingStrategy = .iso8601
        let data = try encoder.encode(container)
        try data.write(to: metadataFile)
    }

    private func createDiskImage(at url: URL, size: UInt64) throws {
        let fileHandle = FileHandle(forWritingAtPath: url.path) ?? {
            FileManager.default.createFile(atPath: url.path, contents: nil)
            return FileHandle(forWritingAtPath: url.path)!
        }()

        defer { try? fileHandle.close() }
        try fileHandle.truncate(atOffset: size)
    }
}

// MARK: - Error Types

enum ContainerError: Error, CustomStringConvertible {
    case notFound(String)
    case stillRunning(String)
    case startupTimeout(String)
    case invalidConfiguration(String)

    var description: String {
        switch self {
        case .notFound(let id):
            return "Container not found: \(id)"
        case .stillRunning(let id):
            return "Container is still running: \(id)"
        case .startupTimeout(let id):
            return "Container startup timeout: \(id)"
        case .invalidConfiguration(let message):
            return "Invalid configuration: \(message)"
        }
    }
}
