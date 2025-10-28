import Foundation

// MARK: - Mac Host Model

public struct MacHost: Codable, Identifiable, Hashable {
    public let id: UUID
    public let hostname: String
    public let ipAddress: String
    public let architecture: String // "arm64" or "amd64"

    // Resource capacity
    public let totalCPU: Int // Millicores (e.g., 8000 = 8 cores)
    public let totalMemory: Int // MB
    public var availableCPU: Int
    public var availableMemory: Int

    // Container tracking
    public var containers: [UUID]

    // Health status
    public var status: HostStatus
    public var lastHeartbeat: Date

    // Metadata
    public var tags: [String: String]
    public let registeredAt: Date
    public var version: String

    // Thermal monitoring
    public var temperature: Double?
    public var isThrottling: Bool

    public init(
        id: UUID = UUID(),
        hostname: String,
        ipAddress: String,
        architecture: String,
        totalCPU: Int,
        totalMemory: Int,
        availableCPU: Int? = nil,
        availableMemory: Int? = nil,
        containers: [UUID] = [],
        status: HostStatus = .healthy,
        lastHeartbeat: Date = Date(),
        tags: [String: String] = [:],
        registeredAt: Date = Date(),
        version: String = "1.0.0",
        temperature: Double? = nil,
        isThrottling: Bool = false
    ) {
        self.id = id
        self.hostname = hostname
        self.ipAddress = ipAddress
        self.architecture = architecture
        self.totalCPU = totalCPU
        self.totalMemory = totalMemory
        self.availableCPU = availableCPU ?? totalCPU
        self.availableMemory = availableMemory ?? totalMemory
        self.containers = containers
        self.status = status
        self.lastHeartbeat = lastHeartbeat
        self.tags = tags
        self.registeredAt = registeredAt
        self.version = version
        self.temperature = temperature
        self.isThrottling = isThrottling
    }

    public var cpuUtilization: Double {
        let used = Double(totalCPU - availableCPU)
        return used / Double(totalCPU)
    }

    public var memoryUtilization: Double {
        let used = Double(totalMemory - availableMemory)
        return used / Double(totalMemory)
    }

    public var isOverloaded: Bool {
        cpuUtilization > 0.9 || memoryUtilization > 0.9
    }
}

// MARK: - Host Status

public enum HostStatus: String, Codable {
    case healthy
    case degraded
    case failed
    case maintenance
    case draining
}

// MARK: - Container Model

public struct Container: Codable, Identifiable, Hashable {
    public let id: UUID
    public let agentType: String // "aider", "goose", "cline"
    public var hostId: UUID
    public let workspace: String

    // Resources
    public let resources: ResourceRequirements

    // Status
    public var status: ContainerStatus
    public let startTime: Date
    public var healthScore: Float // 0.0-1.0

    // Metadata
    public var pid: Int?
    public var exitCode: Int?
    public var restartCount: Int

    public init(
        id: UUID = UUID(),
        agentType: String,
        hostId: UUID,
        workspace: String,
        resources: ResourceRequirements,
        status: ContainerStatus = .pending,
        startTime: Date = Date(),
        healthScore: Float = 1.0,
        pid: Int? = nil,
        exitCode: Int? = nil,
        restartCount: Int = 0
    ) {
        self.id = id
        self.agentType = agentType
        self.hostId = hostId
        self.workspace = workspace
        self.resources = resources
        self.status = status
        self.startTime = startTime
        self.healthScore = healthScore
        self.pid = pid
        self.exitCode = exitCode
        self.restartCount = restartCount
    }

    public var uptime: TimeInterval {
        Date().timeIntervalSince(startTime)
    }
}

// MARK: - Container Status

public enum ContainerStatus: String, Codable {
    case pending
    case running
    case stopped
    case failed
    case migrating
}

// MARK: - Resource Requirements

public struct ResourceRequirements: Codable, Hashable {
    public let cpu: Int // Millicores
    public let memory: Int // MB
    public let architecture: String? // Optional architecture preference
    public let qosClass: QoSClass

    public init(
        cpu: Int,
        memory: Int,
        architecture: String? = nil,
        qosClass: QoSClass = .normal
    ) {
        self.cpu = cpu
        self.memory = memory
        self.architecture = architecture
        self.qosClass = qosClass
    }

    public static let small = ResourceRequirements(
        cpu: 250,
        memory: 512,
        qosClass: .normal
    )

    public static let medium = ResourceRequirements(
        cpu: 500,
        memory: 1024,
        qosClass: .normal
    )

    public static let large = ResourceRequirements(
        cpu: 1000,
        memory: 2048,
        qosClass: .high
    )
}

// MARK: - QoS Class

public enum QoSClass: String, Codable, Comparable {
    case low = "low"
    case normal = "normal"
    case high = "high"
    case critical = "critical"

    public static func < (lhs: QoSClass, rhs: QoSClass) -> Bool {
        lhs.priority < rhs.priority
    }

    var priority: Int {
        switch self {
        case .low: return 0
        case .normal: return 1
        case .high: return 2
        case .critical: return 3
        }
    }
}

// MARK: - Container Request

public struct ContainerRequest {
    public let agentType: String
    public let workspace: String
    public let resources: ResourceRequirements
    public let config: [String: String]
    public let priority: QoSClass
    public let affinityRules: [AffinityRule]
    public let antiAffinityRules: [AntiAffinityRule]

    public init(
        agentType: String,
        workspace: String,
        resources: ResourceRequirements,
        config: [String: String] = [:],
        priority: QoSClass = .normal,
        affinityRules: [AffinityRule] = [],
        antiAffinityRules: [AntiAffinityRule] = []
    ) {
        self.agentType = agentType
        self.workspace = workspace
        self.resources = resources
        self.config = config
        self.priority = priority
        self.affinityRules = affinityRules
        self.antiAffinityRules = antiAffinityRules
    }
}

// MARK: - Affinity Rules

public struct AffinityRule {
    public let type: AffinityType
    public let scope: String
    public let weight: Int // 0-100

    public init(type: AffinityType, scope: String, weight: Int = 50) {
        self.type = type
        self.scope = scope
        self.weight = min(100, max(0, weight))
    }
}

public enum AffinityType {
    case host
    case workspace
    case architecture
    case tag(String)
}

public struct AntiAffinityRule {
    public let type: AffinityType
    public let scope: String
    public let weight: Int // 0-100

    public init(type: AffinityType, scope: String, weight: Int = 50) {
        self.type = type
        self.scope = scope
        self.weight = min(100, max(0, weight))
    }
}

// MARK: - Health Status

public struct HealthStatus: Codable {
    public let isHealthy: Bool
    public let checks: [String: CheckResult]
    public let issues: [String]
    public let timestamp: Date

    public init(
        isHealthy: Bool,
        checks: [String: CheckResult] = [:],
        issues: [String] = [],
        timestamp: Date = Date()
    ) {
        self.isHealthy = isHealthy
        self.checks = checks
        self.issues = issues
        self.timestamp = timestamp
    }
}

public enum CheckResult: String, Codable {
    case pass
    case warn
    case fail
}

// MARK: - Placement Decision

public struct PlacementDecision {
    public let hostId: UUID
    public let score: Double
    public let reasons: [String]

    public init(hostId: UUID, score: Double, reasons: [String]) {
        self.hostId = hostId
        self.score = score
        self.reasons = reasons
    }
}

// MARK: - Container Checkpoint

public struct ContainerCheckpoint: Codable {
    public let containerId: UUID
    public let hostId: UUID
    public let workspace: String
    public let processState: Data?
    public let timestamp: Date

    public init(
        containerId: UUID,
        hostId: UUID,
        workspace: String,
        processState: Data? = nil,
        timestamp: Date = Date()
    ) {
        self.containerId = containerId
        self.hostId = hostId
        self.workspace = workspace
        self.processState = processState
        self.timestamp = timestamp
    }
}

// MARK: - Scaling Decision

public struct ScalingDecision {
    public let action: ScalingAction
    public let reason: String
    public let timestamp: Date

    public init(action: ScalingAction, reason: String, timestamp: Date = Date()) {
        self.action = action
        self.reason = reason
        self.timestamp = timestamp
    }
}

public enum ScalingAction {
    case scaleOut(count: Int)
    case scaleIn(hostIds: [UUID])
    case noAction
}

// MARK: - Fleet Metrics

public struct FleetMetrics: Codable {
    public let totalHosts: Int
    public let healthyHosts: Int
    public let totalContainers: Int
    public let runningContainers: Int
    public let totalCPU: Int
    public let availableCPU: Int
    public let totalMemory: Int
    public let availableMemory: Int
    public let cpuUtilization: Double
    public let memoryUtilization: Double
    public let timestamp: Date

    public init(
        totalHosts: Int,
        healthyHosts: Int,
        totalContainers: Int,
        runningContainers: Int,
        totalCPU: Int,
        availableCPU: Int,
        totalMemory: Int,
        availableMemory: Int,
        timestamp: Date = Date()
    ) {
        self.totalHosts = totalHosts
        self.healthyHosts = healthyHosts
        self.totalContainers = totalContainers
        self.runningContainers = runningContainers
        self.totalCPU = totalCPU
        self.availableCPU = availableCPU
        self.totalMemory = totalMemory
        self.availableMemory = availableMemory
        self.cpuUtilization = Double(totalCPU - availableCPU) / Double(totalCPU)
        self.memoryUtilization = Double(totalMemory - availableMemory) / Double(totalMemory)
        self.timestamp = timestamp
    }
}
