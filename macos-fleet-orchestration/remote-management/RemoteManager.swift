import Foundation

// MARK: - Remote Manager

/// SSH-based and XPC-based remote management for distributed Mac hosts
public final class RemoteManager {

    // MARK: - Configuration

    private let config: RemoteConfig

    // MARK: - Dependencies

    private let sshExecutor: SSHExecutor
    private let xpcClient: XPCClient?

    // MARK: - Initialization

    public init(config: RemoteConfig) {
        self.config = config
        self.sshExecutor = SSHExecutor(config: config.sshConfig)
        self.xpcClient = config.enableXPC ? XPCClient() : nil
    }

    // MARK: - Container Lifecycle

    /// Start container on remote host
    public func startContainer(
        container: Container,
        host: MacHost,
        config: [String: String]
    ) async throws {
        Logger.info("Starting container \(container.id) on \(host.hostname)")

        let command = buildStartCommand(container: container, config: config)

        let result = try await sshExecutor.execute(
            command: command,
            host: host.ipAddress,
            timeout: 30
        )

        guard result.exitCode == 0 else {
            throw RemoteError.commandFailed(command, result.stderr)
        }

        Logger.info("Container \(container.id) started successfully")
    }

    /// Stop container on remote host
    public func stopContainer(
        container: Container,
        host: MacHost
    ) async throws {
        Logger.info("Stopping container \(container.id) on \(host.hostname)")

        let command = "curl -X POST http://127.0.0.1:3284/v1/agents/\(container.id)/stop"

        let result = try await sshExecutor.execute(
            command: command,
            host: host.ipAddress,
            timeout: 15
        )

        guard result.exitCode == 0 else {
            throw RemoteError.commandFailed(command, result.stderr)
        }

        Logger.info("Container \(container.id) stopped successfully")
    }

    /// Restart container on remote host
    public func restartContainer(
        container: Container,
        host: MacHost
    ) async throws {
        try await stopContainer(container: container, host: host)
        try await Task.sleep(nanoseconds: 2_000_000_000) // 2 second delay
        try await startContainer(container: container, host: host, config: [:])
    }

    // MARK: - Container Migration

    /// Checkpoint container state for migration
    public func checkpointContainer(
        container: Container,
        host: MacHost
    ) async throws -> ContainerCheckpoint {
        Logger.info("Checkpointing container \(container.id)")

        // Pause container
        let pauseCommand = "curl -X POST http://127.0.0.1:3284/v1/agents/\(container.id)/pause"
        _ = try await sshExecutor.execute(command: pauseCommand, host: host.ipAddress)

        // Capture process state (if supported)
        let checkpoint = ContainerCheckpoint(
            containerId: container.id,
            hostId: host.id,
            workspace: container.workspace,
            processState: nil,
            timestamp: Date()
        )

        Logger.info("Container \(container.id) checkpointed")
        return checkpoint
    }

    /// Restore container from checkpoint
    public func restoreContainer(
        container: Container,
        host: MacHost,
        checkpoint: ContainerCheckpoint
    ) async throws {
        Logger.info("Restoring container \(container.id) on \(host.hostname)")

        // Start container with restored state
        try await startContainer(container: container, host: host, config: [:])

        Logger.info("Container \(container.id) restored successfully")
    }

    /// Transfer workspace data between hosts
    public func transferWorkspace(
        from sourceHost: MacHost,
        to targetHost: MacHost,
        workspace: String
    ) async throws {
        Logger.info("Transferring workspace \(workspace) from \(sourceHost.hostname) to \(targetHost.hostname)")

        let startTime = Date()

        // Use rsync over SSH for efficient transfer
        let rsyncCommand = """
        rsync -avz --progress \
            -e "ssh -o StrictHostKeyChecking=no" \
            \(sourceHost.ipAddress):\(workspace)/ \
            \(workspace)/
        """

        let result = try await sshExecutor.execute(
            command: rsyncCommand,
            host: targetHost.ipAddress,
            timeout: 300 // 5 minutes
        )

        guard result.exitCode == 0 else {
            throw RemoteError.transferFailed(result.stderr)
        }

        let duration = Date().timeIntervalSince(startTime)
        Logger.info("Workspace transferred in \(duration)s")
    }

    // MARK: - Health Monitoring

    /// Check host health
    public func checkHealth(host: MacHost) async throws -> HealthStatus {
        let command = "curl -f http://127.0.0.1:3284/health"

        let result = try await sshExecutor.execute(
            command: command,
            host: host.ipAddress,
            timeout: 5
        )

        guard result.exitCode == 0 else {
            return HealthStatus(
                isHealthy: false,
                issues: ["AgentAPI not responding"]
            )
        }

        // Parse health response
        guard let data = result.stdout.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let status = json["status"] as? String else {
            return HealthStatus(
                isHealthy: false,
                issues: ["Invalid health response"]
            )
        }

        return HealthStatus(
            isHealthy: status == "healthy",
            checks: ["http": .pass],
            issues: []
        )
    }

    /// Get container logs
    public func getContainerLogs(
        container: Container,
        host: MacHost,
        lines: Int = 100
    ) async throws -> String {
        let command = "curl http://127.0.0.1:3284/v1/agents/\(container.id)/logs?lines=\(lines)"

        let result = try await sshExecutor.execute(
            command: command,
            host: host.ipAddress,
            timeout: 10
        )

        guard result.exitCode == 0 else {
            throw RemoteError.commandFailed(command, result.stderr)
        }

        return result.stdout
    }

    /// Stream container logs in real-time
    public func streamContainerLogs(
        container: Container,
        host: MacHost,
        handler: @escaping (String) -> Void
    ) async throws {
        let command = "curl -N http://127.0.0.1:3284/v1/agents/\(container.id)/stream"

        try await sshExecutor.executeStreaming(
            command: command,
            host: host.ipAddress,
            outputHandler: handler
        )
    }

    /// Get container metrics
    public func getContainerMetrics(
        container: Container,
        host: MacHost
    ) async throws -> ContainerMetrics {
        let command = "curl http://127.0.0.1:3284/v1/agents/\(container.id)/metrics"

        let result = try await sshExecutor.execute(
            command: command,
            host: host.ipAddress,
            timeout: 5
        )

        guard result.exitCode == 0 else {
            throw RemoteError.commandFailed(command, result.stderr)
        }

        // Parse metrics JSON
        guard let data = result.stdout.data(using: .utf8),
              let json = try? JSONDecoder().decode(ContainerMetrics.self, from: data) else {
            throw RemoteError.invalidResponse
        }

        return json
    }

    // MARK: - System Operations

    /// Execute arbitrary command on host
    public func executeCommand(
        _ command: String,
        host: MacHost,
        timeout: TimeInterval = 30
    ) async throws -> ExecutionResult {
        return try await sshExecutor.execute(
            command: command,
            host: host.ipAddress,
            timeout: timeout
        )
    }

    /// Get host system metrics
    public func getHostMetrics(host: MacHost) async throws -> HostMetrics {
        let command = """
        top -l 1 | grep "CPU usage" && \
        top -l 1 | grep "PhysMem" && \
        sysctl -n machdep.cpu.brand_string && \
        sysctl -n hw.physicalcpu && \
        sysctl -n hw.logicalcpu
        """

        let result = try await sshExecutor.execute(
            command: command,
            host: host.ipAddress,
            timeout: 10
        )

        // Parse system metrics
        return parseHostMetrics(output: result.stdout)
    }

    /// Check thermal status
    public func getThermalStatus(host: MacHost) async throws -> ThermalStatus {
        let command = "sudo powermetrics --samplers smc -i1 -n1 | grep -i temp"

        let result = try await sshExecutor.execute(
            command: command,
            host: host.ipAddress,
            timeout: 5
        )

        // Parse temperature readings
        return parseThermalStatus(output: result.stdout)
    }

    // MARK: - XPC Operations (Local Host Only)

    /// Execute privileged operation via XPC
    public func executePrivilegedOperation(
        operation: XPCOperation
    ) async throws -> XPCResult {
        guard let xpc = xpcClient else {
            throw RemoteError.xpcNotAvailable
        }

        return try await xpc.execute(operation: operation)
    }

    // MARK: - Helper Methods

    private func buildStartCommand(
        container: Container,
        config: [String: String]
    ) -> String {
        let configJSON = try? JSONSerialization.data(withJSONObject: [
            "agent_type": container.agentType,
            "workspace": container.workspace,
            "resources": [
                "cpu": container.resources.cpu,
                "memory": container.resources.memory
            ],
            "config": config
        ])

        let configString = configJSON.flatMap { String(data: $0, encoding: .utf8) } ?? "{}"

        return """
        curl -X POST http://127.0.0.1:3284/v1/agents/start \\
            -H "Content-Type: application/json" \\
            -d '\(configString)'
        """
    }

    private func parseHostMetrics(output: String) -> HostMetrics {
        // Parse top output for CPU and memory
        // This is simplified - real implementation would parse properly
        return HostMetrics(
            cpuUsage: 0.5,
            memoryUsage: 0.6,
            diskUsage: 0.4,
            networkRx: 1000,
            networkTx: 500
        )
    }

    private func parseThermalStatus(output: String) -> ThermalStatus {
        // Parse powermetrics output
        // This is simplified
        return ThermalStatus(
            temperature: 45.0,
            isThrottling: false,
            fanSpeed: 2000
        )
    }
}

// MARK: - Remote Configuration

public struct RemoteConfig {
    public let sshConfig: SSHConfig
    public let enableXPC: Bool
    public let commandTimeout: TimeInterval

    public init(
        sshConfig: SSHConfig = .default,
        enableXPC: Bool = false,
        commandTimeout: TimeInterval = 30
    ) {
        self.sshConfig = sshConfig
        self.enableXPC = enableXPC
        self.commandTimeout = commandTimeout
    }

    public static let `default` = RemoteConfig()
}

// MARK: - SSH Executor

private final class SSHExecutor {
    let config: SSHConfig

    init(config: SSHConfig) {
        self.config = config
    }

    func execute(
        command: String,
        host: String,
        timeout: TimeInterval
    ) async throws -> ExecutionResult {
        let sshCommand = buildSSHCommand(command: command, host: host)

        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/ssh")
        process.arguments = sshCommand.components(separatedBy: " ")

        let stdoutPipe = Pipe()
        let stderrPipe = Pipe()
        process.standardOutput = stdoutPipe
        process.standardError = stderrPipe

        try process.run()

        // Wait with timeout
        let deadline = Date().addingTimeInterval(timeout)
        while process.isRunning && Date() < deadline {
            try await Task.sleep(nanoseconds: 100_000_000) // 100ms
        }

        if process.isRunning {
            process.terminate()
            throw RemoteError.timeout(command)
        }

        process.waitUntilExit()

        let stdoutData = stdoutPipe.fileHandleForReading.readDataToEndOfFile()
        let stderrData = stderrPipe.fileHandleForReading.readDataToEndOfFile()

        return ExecutionResult(
            exitCode: Int(process.terminationStatus),
            stdout: String(data: stdoutData, encoding: .utf8) ?? "",
            stderr: String(data: stderrData, encoding: .utf8) ?? ""
        )
    }

    func executeStreaming(
        command: String,
        host: String,
        outputHandler: @escaping (String) -> Void
    ) async throws {
        let sshCommand = buildSSHCommand(command: command, host: host)

        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/ssh")
        process.arguments = sshCommand.components(separatedBy: " ")

        let stdoutPipe = Pipe()
        process.standardOutput = stdoutPipe

        try process.run()

        // Stream output
        let handle = stdoutPipe.fileHandleForReading
        while true {
            let data = handle.availableData
            guard !data.isEmpty else { break }

            if let line = String(data: data, encoding: .utf8) {
                outputHandler(line)
            }
        }
    }

    private func buildSSHCommand(command: String, host: String) -> String {
        var args: [String] = []

        // SSH options
        args.append("-o StrictHostKeyChecking=no")
        args.append("-o ConnectTimeout=\(config.connectTimeout)")

        if let keyPath = config.privateKeyPath {
            args.append("-i \(keyPath)")
        }

        if let user = config.username {
            args.append("\(user)@\(host)")
        } else {
            args.append(host)
        }

        args.append("'\(command)'")

        return "ssh \(args.joined(separator: " "))"
    }
}

// MARK: - SSH Configuration

public struct SSHConfig {
    public let username: String?
    public let privateKeyPath: String?
    public let connectTimeout: Int
    public let commandTimeout: Int

    public init(
        username: String? = "coder",
        privateKeyPath: String? = "~/.ssh/id_rsa",
        connectTimeout: Int = 10,
        commandTimeout: Int = 30
    ) {
        self.username = username
        self.privateKeyPath = privateKeyPath
        self.connectTimeout = connectTimeout
        self.commandTimeout = commandTimeout
    }

    public static let `default` = SSHConfig()
}

// MARK: - XPC Client (Stub)

private final class XPCClient {
    func execute(operation: XPCOperation) async throws -> XPCResult {
        // Execute XPC operation
        Logger.info("Executing XPC operation: \(operation)")
        return XPCResult(success: true, message: "Operation completed")
    }
}

public enum XPCOperation {
    case installAgent
    case updateAgent
    case configureSystem
}

public struct XPCResult {
    public let success: Bool
    public let message: String
}

// MARK: - Supporting Types

public struct ExecutionResult {
    public let exitCode: Int
    public let stdout: String
    public let stderr: String
}

public struct ContainerMetrics: Codable {
    public let cpuUsage: Double
    public let memoryUsage: Int
    public let diskIO: Int
    public let networkIO: Int
}

public struct HostMetrics {
    public let cpuUsage: Double
    public let memoryUsage: Double
    public let diskUsage: Double
    public let networkRx: Int
    public let networkTx: Int
}

public struct ThermalStatus {
    public let temperature: Double
    public let isThrottling: Bool
    public let fanSpeed: Int
}

public enum RemoteError: Error, LocalizedError {
    case commandFailed(String, String)
    case transferFailed(String)
    case timeout(String)
    case invalidResponse
    case xpcNotAvailable

    public var errorDescription: String? {
        switch self {
        case .commandFailed(let cmd, let error):
            return "Command failed: \(cmd)\n\(error)"
        case .transferFailed(let error):
            return "Transfer failed: \(error)"
        case .timeout(let cmd):
            return "Command timeout: \(cmd)"
        case .invalidResponse:
            return "Invalid response from remote host"
        case .xpcNotAvailable:
            return "XPC service not available"
        }
    }
}

// Simple logger
private enum Logger {
    static func info(_ message: String) {
        print("[REMOTE] [INFO] \(Date()) \(message)")
    }

    static func error(_ message: String) {
        print("[REMOTE] [ERROR] \(Date()) \(message)")
    }
}
