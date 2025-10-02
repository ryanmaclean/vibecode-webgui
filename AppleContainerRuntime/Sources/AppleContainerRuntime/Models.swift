import Foundation
import Virtualization

// MARK: - Container Configuration

struct ContainerConfiguration: Codable, Sendable {
    let image: String
    let name: String
    let cpuCount: Int
    let memorySize: UInt64
    let portMappings: [PortMapping]
    let environmentVariables: [String: String]
    let volumeMounts: [VolumeMount]
    let removeOnExit: Bool

    init(
        image: String,
        name: String,
        cpuCount: Int = 2,
        memorySize: UInt64 = 2 * 1024 * 1024 * 1024,
        portMappings: [PortMapping] = [],
        environmentVariables: [String: String] = [:],
        volumeMounts: [VolumeMount] = [],
        removeOnExit: Bool = false
    ) {
        self.image = image
        self.name = name
        self.cpuCount = cpuCount
        self.memorySize = memorySize
        self.portMappings = portMappings
        self.environmentVariables = environmentVariables
        self.volumeMounts = volumeMounts
        self.removeOnExit = removeOnExit
    }
}

struct PortMapping: Codable, Sendable {
    let hostPort: UInt16
    let containerPort: UInt16
}

struct VolumeMount: Codable, Sendable {
    let hostPath: String
    let containerPath: String
}

// MARK: - Container Model

class Container: Codable {
    let id: String
    let name: String
    let image: String
    let vm: VZVirtualMachine
    let config: ContainerConfiguration
    let directory: URL
    let created: Date
    var state: ContainerState
    var ipAddress: String?

    init(
        id: String,
        name: String,
        image: String,
        vm: VZVirtualMachine,
        config: ContainerConfiguration,
        directory: URL
    ) {
        self.id = id
        self.name = name
        self.image = image
        self.vm = vm
        self.config = config
        self.directory = directory
        self.created = Date()
        self.state = .created
    }

    // MARK: - Codable

    enum CodingKeys: String, CodingKey {
        case id, name, image, config, directory, created, state, ipAddress
    }

    required init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)

        self.id = try container.decode(String.self, forKey: .id)
        self.name = try container.decode(String.self, forKey: .name)
        self.image = try container.decode(String.self, forKey: .image)
        self.config = try container.decode(ContainerConfiguration.self, forKey: .config)
        self.directory = try container.decode(URL.self, forKey: .directory)
        self.created = try container.decode(Date.self, forKey: .created)
        self.state = try container.decode(ContainerState.self, forKey: .state)
        self.ipAddress = try container.decodeIfPresent(String.self, forKey: .ipAddress)

        // VM needs to be reconstructed
        self.vm = VZVirtualMachine(configuration: VZVirtualMachineConfiguration())
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)

        try container.encode(id, forKey: .id)
        try container.encode(name, forKey: .name)
        try container.encode(image, forKey: .image)
        try container.encode(config, forKey: .config)
        try container.encode(directory, forKey: .directory)
        try container.encode(created, forKey: .created)
        try container.encode(state, forKey: .state)
        try container.encodeIfPresent(ipAddress, forKey: .ipAddress)
    }
}

enum ContainerState: String, Codable, Sendable {
    case created
    case running
    case paused
    case stopped
    case exited
}

// MARK: - Container Info (Public API)

struct ContainerInfo: Codable, Sendable {
    let id: String
    let name: String
    let image: String
    let state: ContainerState
    let ipAddress: String?
    let created: Date
}

struct ContainerDetail: Codable, Sendable {
    let id: String
    let name: String
    let image: String
    let state: ContainerState
    let ipAddress: String?
    let created: Date
    let config: ContainerConfiguration
    let vmInfo: VirtualMachineInfo
}

struct VirtualMachineInfo: Codable, Sendable {
    let cpuCount: Int
    let memorySize: UInt64
}

// MARK: - Image Management

struct PullProgress: Sendable {
    let bytesDownloaded: UInt64
    let totalBytes: UInt64

    var percentComplete: Int {
        guard totalBytes > 0 else { return 0 }
        return Int((Double(bytesDownloaded) / Double(totalBytes)) * 100)
    }
}
