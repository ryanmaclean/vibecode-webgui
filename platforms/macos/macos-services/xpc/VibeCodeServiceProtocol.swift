// VibeCode XPC Service Protocol
// Purpose: IPC interface between VibeCode.app and containerd daemon
// Location: /Applications/VibeCode.app/Contents/XPCServices/VibeCodeService.xpc

import Foundation

// MARK: - XPC Protocol Definition

@objc protocol VibeCodeServiceProtocol {
    // MARK: - Container Lifecycle

    /// Start a new container instance
    /// - Parameters:
    ///   - name: Container name (must be unique)
    ///   - image: Container image (e.g., "codercom/code-server:latest")
    ///   - ports: Port mappings (host port → container port)
    ///   - environment: Environment variables
    ///   - reply: Callback with success status and error
    func startContainer(
        name: String,
        image: String,
        ports: [Int],
        environment: [String: String],
        reply: @escaping (Bool, Error?) -> Void
    )

    /// Stop a running container
    /// - Parameters:
    ///   - name: Container name
    ///   - force: Force kill if graceful stop fails
    ///   - reply: Callback with success status
    func stopContainer(
        name: String,
        force: Bool,
        reply: @escaping (Bool, Error?) -> Void
    )

    /// Restart a container
    /// - Parameters:
    ///   - name: Container name
    ///   - reply: Callback with success status
    func restartContainer(
        name: String,
        reply: @escaping (Bool, Error?) -> Void
    )

    /// Remove a stopped container
    /// - Parameters:
    ///   - name: Container name
    ///   - removeVolumes: Also remove associated volumes
    ///   - reply: Callback with success status
    func removeContainer(
        name: String,
        removeVolumes: Bool,
        reply: @escaping (Bool, Error?) -> Void
    )

    // MARK: - Container Inspection

    /// List all containers (running and stopped)
    /// - Parameters:
    ///   - reply: Callback with array of container information
    func listContainers(
        reply: @escaping ([ContainerInfo], Error?) -> Void
    )

    /// Get detailed status for a specific container
    /// - Parameters:
    ///   - name: Container name
    ///   - reply: Callback with container status
    func getContainerStatus(
        name: String,
        reply: @escaping (ContainerStatus?, Error?) -> Void
    )

    /// Get container logs
    /// - Parameters:
    ///   - name: Container name
    ///   - tail: Number of lines from end (0 = all)
    ///   - follow: Stream logs in real-time
    ///   - reply: Callback with log content
    func getContainerLogs(
        name: String,
        tail: Int,
        follow: Bool,
        reply: @escaping (String?, Error?) -> Void
    )

    // MARK: - System Health

    /// Get overall system health status
    /// - Parameters:
    ///   - reply: Callback with system health information
    func getSystemHealth(
        reply: @escaping (SystemHealth, Error?) -> Void
    )

    /// Check if containerd daemon is responsive
    /// - Parameters:
    ///   - reply: Callback with ping result (latency in ms)
    func pingDaemon(
        reply: @escaping (Double?, Error?) -> Void
    )

    // MARK: - Service Management

    /// Reload daemon configuration
    /// - Parameters:
    ///   - reply: Callback with success status
    func reloadConfiguration(
        reply: @escaping (Bool, Error?) -> Void
    )

    /// Gracefully shutdown daemon (stops all containers)
    /// - Parameters:
    ///   - reply: Callback with success status
    func shutdownDaemon(
        reply: @escaping (Bool, Error?) -> Void
    )

    // MARK: - Image Management

    /// Pull a container image
    /// - Parameters:
    ///   - image: Image name (e.g., "codercom/code-server:latest")
    ///   - progress: Progress callback (0.0 to 1.0)
    ///   - reply: Callback with success status
    func pullImage(
        _ image: String,
        progress: @escaping (Double) -> Void,
        reply: @escaping (Bool, Error?) -> Void
    )

    /// List cached images
    /// - Parameters:
    ///   - reply: Callback with array of image information
    func listImages(
        reply: @escaping ([ImageInfo], Error?) -> Void
    )

    // MARK: - Networking (mDNS/Bonjour)

    /// Start advertising this instance via mDNS
    /// - Parameters:
    ///   - instanceName: Display name for this instance
    ///   - port: Port number to advertise
    ///   - reply: Callback with success status
    func startMDNSAdvertising(
        instanceName: String,
        port: Int,
        reply: @escaping (Bool, Error?) -> Void
    )

    /// Stop mDNS advertising
    /// - Parameters:
    ///   - reply: Callback with success status
    func stopMDNSAdvertising(
        reply: @escaping (Bool, Error?) -> Void
    )

    /// Discover nearby VibeCode instances
    /// - Parameters:
    ///   - timeout: Discovery timeout in seconds
    ///   - reply: Callback with discovered instances
    func discoverInstances(
        timeout: TimeInterval,
        reply: @escaping ([VibeCodeInstance], Error?) -> Void
    )
}

// MARK: - Data Models

/// Container information
struct ContainerInfo: Codable {
    let id: String
    let name: String
    let image: String
    let status: String // "running", "stopped", "paused", "restarting"
    let ports: [PortMapping]
    let createdAt: Date
    let startedAt: Date?
    let uptime: TimeInterval
    let cpuUsage: Double // Percentage (0.0 to 100.0)
    let memoryUsage: UInt64 // Bytes
    let memoryLimit: UInt64 // Bytes
    let networkRx: UInt64 // Bytes received
    let networkTx: UInt64 // Bytes transmitted
    let restartCount: Int
    let health: ContainerHealth
}

/// Port mapping
struct PortMapping: Codable {
    let hostPort: Int
    let containerPort: Int
    let protocol: String // "tcp" or "udp"
}

/// Container health status
enum ContainerHealth: String, Codable {
    case healthy = "healthy"
    case unhealthy = "unhealthy"
    case starting = "starting"
    case none = "none"
}

/// Detailed container status
struct ContainerStatus: Codable {
    let running: Bool
    let paused: Bool
    let restarting: Bool
    let oomKilled: Bool
    let dead: Bool
    let pid: Int?
    let exitCode: Int?
    let error: String?
    let startedAt: Date?
    let finishedAt: Date?
    let health: ContainerHealth
}

/// System-wide health information
struct SystemHealth: Codable {
    let daemonRunning: Bool
    let daemonVersion: String
    let daemonUptime: TimeInterval
    let containerCount: Int
    let runningContainers: Int
    let stoppedContainers: Int
    let cpuCores: Int
    let cpuUsage: Double // Percentage (0.0 to 100.0)
    let memoryTotal: UInt64 // Bytes
    let memoryUsed: UInt64 // Bytes
    let memoryAvailable: UInt64 // Bytes
    let diskTotal: UInt64 // Bytes
    let diskUsed: UInt64 // Bytes
    let diskAvailable: UInt64 // Bytes
    let socketPath: String
    let configPath: String

    static var `default`: SystemHealth {
        SystemHealth(
            daemonRunning: false,
            daemonVersion: "unknown",
            daemonUptime: 0,
            containerCount: 0,
            runningContainers: 0,
            stoppedContainers: 0,
            cpuCores: ProcessInfo.processInfo.processorCount,
            cpuUsage: 0,
            memoryTotal: ProcessInfo.processInfo.physicalMemory,
            memoryUsed: 0,
            memoryAvailable: 0,
            diskTotal: 0,
            diskUsed: 0,
            diskAvailable: 0,
            socketPath: "/var/run/vibecode-containerd.sock",
            configPath: "/etc/vibecode/containerd.conf"
        )
    }
}

/// Image information
struct ImageInfo: Codable {
    let id: String
    let repository: String
    let tag: String
    let digest: String?
    let createdAt: Date
    let size: UInt64 // Bytes
    let labels: [String: String]
}

/// Discovered VibeCode instance (mDNS)
struct VibeCodeInstance: Codable, Identifiable {
    let id: String
    let name: String
    let hostname: String
    let ipAddress: String
    let port: Int
    let version: String
    let user: String?
    let workspace: String?
    let discoveredAt: Date
}

// MARK: - Error Types

enum VibeCodeServiceError: Error {
    case connectionFailed(String)
    case containerNotFound(String)
    case containerAlreadyRunning(String)
    case containerStartFailed(String, String)
    case containerStopFailed(String, String)
    case imageNotFound(String)
    case imagePullFailed(String, String)
    case invalidConfiguration(String)
    case daemonUnresponsive
    case permissionDenied(String)
    case resourceExhausted(String)
    case timeout(String)
    case unknown(String)
}

extension VibeCodeServiceError: LocalizedError {
    var errorDescription: String? {
        switch self {
        case .connectionFailed(let reason):
            return "Connection failed: \(reason)"
        case .containerNotFound(let name):
            return "Container '\(name)' not found"
        case .containerAlreadyRunning(let name):
            return "Container '\(name)' is already running"
        case .containerStartFailed(let name, let reason):
            return "Failed to start container '\(name)': \(reason)"
        case .containerStopFailed(let name, let reason):
            return "Failed to stop container '\(name)': \(reason)"
        case .imageNotFound(let image):
            return "Image '\(image)' not found"
        case .imagePullFailed(let image, let reason):
            return "Failed to pull image '\(image)': \(reason)"
        case .invalidConfiguration(let reason):
            return "Invalid configuration: \(reason)"
        case .daemonUnresponsive:
            return "Container daemon is not responding"
        case .permissionDenied(let reason):
            return "Permission denied: \(reason)"
        case .resourceExhausted(let resource):
            return "Resource exhausted: \(resource)"
        case .timeout(let operation):
            return "Operation timed out: \(operation)"
        case .unknown(let reason):
            return "Unknown error: \(reason)"
        }
    }
}

// MARK: - Notification Names

extension Notification.Name {
    /// Posted when a container starts
    static let containerDidStart = Notification.Name("com.vibecode.container.didStart")

    /// Posted when a container stops
    static let containerDidStop = Notification.Name("com.vibecode.container.didStop")

    /// Posted when a container crashes or becomes unhealthy
    static let containerDidCrash = Notification.Name("com.vibecode.container.didCrash")

    /// Posted when daemon health changes
    static let daemonHealthDidChange = Notification.Name("com.vibecode.daemon.healthDidChange")

    /// Posted when a new instance is discovered via mDNS
    static let instanceDiscovered = Notification.Name("com.vibecode.mdns.instanceDiscovered")

    /// Posted when an instance disappears from mDNS
    static let instanceLost = Notification.Name("com.vibecode.mdns.instanceLost")
}

// MARK: - Convenience Extensions

extension ContainerInfo {
    var isRunning: Bool {
        status == "running"
    }

    var isStopped: Bool {
        status == "stopped"
    }

    var memoryUsagePercentage: Double {
        guard memoryLimit > 0 else { return 0 }
        return (Double(memoryUsage) / Double(memoryLimit)) * 100.0
    }

    var formattedUptime: String {
        let hours = Int(uptime) / 3600
        let minutes = (Int(uptime) % 3600) / 60
        let seconds = Int(uptime) % 60

        if hours > 0 {
            return String(format: "%dh %dm %ds", hours, minutes, seconds)
        } else if minutes > 0 {
            return String(format: "%dm %ds", minutes, seconds)
        } else {
            return String(format: "%ds", seconds)
        }
    }

    var formattedMemoryUsage: String {
        let formatter = ByteCountFormatter()
        formatter.countStyle = .memory
        return formatter.string(fromByteCount: Int64(memoryUsage))
    }
}

extension SystemHealth {
    var memoryUsagePercentage: Double {
        guard memoryTotal > 0 else { return 0 }
        return (Double(memoryUsed) / Double(memoryTotal)) * 100.0
    }

    var diskUsagePercentage: Double {
        guard diskTotal > 0 else { return 0 }
        return (Double(diskUsed) / Double(diskTotal)) * 100.0
    }

    var isHealthy: Bool {
        daemonRunning && cpuUsage < 90.0 && memoryUsagePercentage < 90.0
    }
}
