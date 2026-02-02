import Foundation
import Network
import Combine

// MARK: - Fleet Manager Service

/// Central orchestration service for managing Mac fleet
@available(macOS 12.0, *)
public final class FleetManager: ObservableObject {

    // MARK: - Published Properties

    @Published private(set) var hosts: [UUID: MacHost] = [:]
    @Published private(set) var containers: [UUID: Container] = [:]
    @Published private(set) var fleetHealth: FleetHealth = .unknown
    @Published private(set) var events: [FleetEvent] = []

    // MARK: - Dependencies

    private let scheduler: SchedulerEngine
    private let discovery: ServiceDiscovery
    private let remoteManager: RemoteManager
    private let autoScaler: AutoScaler
    private let database: FleetDatabase
    private let metrics: MetricsCollector

    // MARK: - Configuration

    private let config: FleetConfig
    private var cancellables = Set<AnyCancellable>()

    // MARK: - State

    private var heartbeatTimer: Timer?
    private var healthCheckTimer: Timer?

    // MARK: - Initialization

    public init(config: FleetConfig) throws {
        self.config = config
        self.database = try FleetDatabase(url: config.databaseURL)
        self.metrics = MetricsCollector(port: config.metricsPort)
        self.scheduler = SchedulerEngine(config: config.schedulerConfig)
        self.discovery = ServiceDiscovery(config: config.discoveryConfig)
        self.remoteManager = RemoteManager(config: config.remoteConfig)
        self.autoScaler = AutoScaler(config: config.autoScalerConfig)

        setupEventHandlers()
    }

    // MARK: - Public API

    /// Start fleet management service
    public func start() async throws {
        Logger.info("Starting Fleet Manager...")

        // Load state from database
        try await loadState()

        // Start service discovery
        try await discovery.start()

        // Start heartbeat monitoring
        startHeartbeatTimer()

        // Start health checks
        startHealthCheckTimer()

        // Start auto-scaler
        await autoScaler.start()

        // Expose metrics
        try metrics.start()

        Logger.info("Fleet Manager started successfully")
        logEvent(.systemStarted)
    }

    /// Stop fleet management service
    public func stop() async {
        Logger.info("Stopping Fleet Manager...")

        heartbeatTimer?.invalidate()
        healthCheckTimer?.invalidate()

        await discovery.stop()
        await autoScaler.stop()
        metrics.stop()

        Logger.info("Fleet Manager stopped")
        logEvent(.systemStopped)
    }

    // MARK: - Host Management

    /// Register new Mac host
    public func registerHost(_ host: MacHost) async throws {
        Logger.info("Registering host: \(host.hostname)")

        hosts[host.id] = host
        try await database.saveHost(host)

        updateFleetHealth()
        logEvent(.hostRegistered(host))
        metrics.recordHostCount(hosts.count)
    }

    /// Unregister Mac host
    public func unregisterHost(id: UUID) async throws {
        guard let host = hosts[id] else {
            throw FleetError.hostNotFound(id)
        }

        Logger.info("Unregistering host: \(host.hostname)")

        // Drain containers first
        try await drainHost(id: id)

        hosts.removeValue(forKey: id)
        try await database.deleteHost(id)

        updateFleetHealth()
        logEvent(.hostUnregistered(host))
        metrics.recordHostCount(hosts.count)
    }

    /// Update host status
    public func updateHostStatus(id: UUID, status: HostStatus) async {
        guard var host = hosts[id] else { return }

        host.status = status
        host.lastHeartbeat = Date()
        hosts[id] = host

        try? await database.updateHost(host)
        updateFleetHealth()

        if status == .failed {
            logEvent(.hostFailed(host))
            await handleHostFailure(host: host)
        }
    }

    /// Get available hosts matching requirements
    public func availableHosts(for requirements: ResourceRequirements) -> [MacHost] {
        hosts.values.filter { host in
            host.status == .healthy &&
            host.availableCPU >= requirements.cpu &&
            host.availableMemory >= requirements.memory &&
            (requirements.architecture == nil || host.architecture == requirements.architecture)
        }
    }

    // MARK: - Container Management

    /// Place container on optimal host
    public func placeContainer(_ request: ContainerRequest) async throws -> Container {
        Logger.info("Placing container: \(request.agentType)")

        // Get placement decision from scheduler
        guard let placementDecision = await scheduler.schedule(
            request: request,
            hosts: Array(hosts.values)
        ) else {
            throw FleetError.noSuitableHost
        }

        // Create container instance
        let container = Container(
            id: UUID(),
            agentType: request.agentType,
            hostId: placementDecision.hostId,
            workspace: request.workspace,
            resources: request.resources,
            status: .pending,
            startTime: Date(),
            healthScore: 1.0
        )

        // Start container on selected host
        try await remoteManager.startContainer(
            container: container,
            host: hosts[placementDecision.hostId]!,
            config: request.config
        )

        // Update state
        containers[container.id] = container
        try await database.saveContainer(container)

        // Update host capacity
        await updateHostCapacity(hostId: placementDecision.hostId)

        logEvent(.containerStarted(container))
        metrics.recordContainerCount(containers.count)

        return container
    }

    /// Stop container
    public func stopContainer(id: UUID) async throws {
        guard let container = containers[id] else {
            throw FleetError.containerNotFound(id)
        }

        Logger.info("Stopping container: \(container.id)")

        guard let host = hosts[container.hostId] else {
            throw FleetError.hostNotFound(container.hostId)
        }

        try await remoteManager.stopContainer(container: container, host: host)

        containers.removeValue(forKey: id)
        try await database.deleteContainer(id)

        await updateHostCapacity(hostId: container.hostId)

        logEvent(.containerStopped(container))
        metrics.recordContainerCount(containers.count)
    }

    /// Migrate container to different host
    public func migrateContainer(id: UUID, to targetHostId: UUID) async throws {
        guard let container = containers[id] else {
            throw FleetError.containerNotFound(id)
        }

        guard let sourceHost = hosts[container.hostId],
              let targetHost = hosts[targetHostId] else {
            throw FleetError.hostNotFound(targetHostId)
        }

        Logger.info("Migrating container \(container.id) from \(sourceHost.hostname) to \(targetHost.hostname)")

        let startTime = Date()

        // Checkpoint container state
        let checkpoint = try await remoteManager.checkpointContainer(
            container: container,
            host: sourceHost
        )

        // Transfer workspace data
        try await remoteManager.transferWorkspace(
            from: sourceHost,
            to: targetHost,
            workspace: container.workspace
        )

        // Start container on target host
        var migratedContainer = container
        migratedContainer.hostId = targetHostId

        try await remoteManager.restoreContainer(
            container: migratedContainer,
            host: targetHost,
            checkpoint: checkpoint
        )

        // Stop container on source host
        try await remoteManager.stopContainer(container: container, host: sourceHost)

        // Update state
        containers[id] = migratedContainer
        try await database.updateContainer(migratedContainer)

        await updateHostCapacity(hostId: sourceHost.id)
        await updateHostCapacity(hostId: targetHost.id)

        let duration = Date().timeIntervalSince(startTime)
        Logger.info("Migration completed in \(duration)s")

        logEvent(.containerMigrated(container, from: sourceHost, to: targetHost))
        metrics.recordMigration(duration: duration)
    }

    // MARK: - Health Monitoring

    private func startHeartbeatTimer() {
        heartbeatTimer = Timer.scheduledTimer(withTimeInterval: 15, repeats: true) { [weak self] _ in
            Task { await self?.checkHeartbeats() }
        }
    }

    private func startHealthCheckTimer() {
        healthCheckTimer = Timer.scheduledTimer(withTimeInterval: 30, repeats: true) { [weak self] _ in
            Task { await self?.performHealthChecks() }
        }
    }

    private func checkHeartbeats() async {
        let now = Date()

        for (id, host) in hosts {
            let heartbeatAge = now.timeIntervalSince(host.lastHeartbeat)

            if heartbeatAge > 30 { // 30 second timeout
                Logger.warning("Host \(host.hostname) heartbeat timeout: \(heartbeatAge)s")
                await updateHostStatus(id: id, status: .failed)
            }
        }
    }

    private func performHealthChecks() async {
        for host in hosts.values where host.status == .healthy {
            do {
                let health = try await remoteManager.checkHealth(host: host)

                if !health.isHealthy {
                    Logger.warning("Host \(host.hostname) unhealthy: \(health.issues)")
                    await updateHostStatus(id: host.id, status: .degraded)
                }
            } catch {
                Logger.error("Health check failed for \(host.hostname): \(error)")
                await updateHostStatus(id: host.id, status: .failed)
            }
        }
    }

    private func updateFleetHealth() {
        let totalHosts = hosts.count
        guard totalHosts > 0 else {
            fleetHealth = .unknown
            return
        }

        let healthyCount = hosts.values.filter { $0.status == .healthy }.count
        let healthPercentage = Double(healthyCount) / Double(totalHosts)

        fleetHealth = switch healthPercentage {
        case 0.9...: .healthy
        case 0.7..<0.9: .degraded
        default: .critical
        }

        metrics.recordFleetHealth(fleetHealth)
    }

    // MARK: - Failure Handling

    private func handleHostFailure(host: MacHost) async {
        Logger.error("Handling failure for host: \(host.hostname)")

        // Get all containers on failed host
        let failedContainers = containers.values.filter { $0.hostId == host.id }

        Logger.info("Rescheduling \(failedContainers.count) containers from failed host")

        // Reschedule containers with high priority
        for container in failedContainers {
            do {
                let request = ContainerRequest(
                    agentType: container.agentType,
                    workspace: container.workspace,
                    resources: container.resources,
                    config: [:],
                    priority: .high
                )

                _ = try await placeContainer(request)

                // Remove old container reference
                containers.removeValue(forKey: container.id)
            } catch {
                Logger.error("Failed to reschedule container \(container.id): \(error)")
                logEvent(.containerFailedToReschedule(container, error: error))
            }
        }
    }

    private func drainHost(id: UUID) async throws {
        let hostContainers = containers.values.filter { $0.hostId == id }

        for container in hostContainers {
            try await migrateContainer(
                id: container.id,
                to: try selectMigrationTarget(excluding: id).id
            )
        }
    }

    private func selectMigrationTarget(excluding excludedHostId: UUID) throws -> MacHost {
        let candidates = hosts.values.filter { host in
            host.id != excludedHostId &&
            host.status == .healthy &&
            host.availableCPU > 100 && // At least 100m CPU
            host.availableMemory > 256 // At least 256MB
        }

        guard let target = candidates.max(by: { $0.availableCPU < $1.availableCPU }) else {
            throw FleetError.noSuitableHost
        }

        return target
    }

    // MARK: - Capacity Management

    private func updateHostCapacity(hostId: UUID) async {
        guard var host = hosts[hostId] else { return }

        let hostContainers = containers.values.filter { $0.hostId == hostId }

        let usedCPU = hostContainers.reduce(0) { $0 + $1.resources.cpu }
        let usedMemory = hostContainers.reduce(0) { $0 + $1.resources.memory }

        host.availableCPU = host.totalCPU - usedCPU
        host.availableMemory = host.totalMemory - usedMemory

        hosts[hostId] = host
        try? await database.updateHost(host)

        metrics.recordHostCapacity(host: host)
    }

    // MARK: - Event Handling

    private func setupEventHandlers() {
        // Handle discovery events
        discovery.$discoveredHosts
            .sink { [weak self] discoveredHosts in
                Task {
                    for host in discoveredHosts {
                        try? await self?.registerHost(host)
                    }
                }
            }
            .store(in: &cancellables)

        // Handle auto-scaling events
        autoScaler.$scalingDecisions
            .sink { [weak self] decision in
                Task {
                    await self?.handleScalingDecision(decision)
                }
            }
            .store(in: &cancellables)
    }

    private func handleScalingDecision(_ decision: ScalingDecision) async {
        switch decision.action {
        case .scaleOut(let count):
            Logger.info("Auto-scaler: Adding \(count) hosts")
            logEvent(.autoScaleOut(count))
            // Trigger provisioning system

        case .scaleIn(let hostIds):
            Logger.info("Auto-scaler: Removing \(hostIds.count) hosts")
            for hostId in hostIds {
                try? await unregisterHost(id: hostId)
            }
            logEvent(.autoScaleIn(hostIds.count))
        }
    }

    // MARK: - State Persistence

    private func loadState() async throws {
        Logger.info("Loading fleet state from database...")

        let loadedHosts = try await database.loadHosts()
        let loadedContainers = try await database.loadContainers()

        for host in loadedHosts {
            hosts[host.id] = host
        }

        for container in loadedContainers {
            containers[container.id] = container
        }

        Logger.info("Loaded \(hosts.count) hosts and \(containers.count) containers")
        updateFleetHealth()
    }

    // MARK: - Event Logging

    private func logEvent(_ event: FleetEvent) {
        events.append(event)

        // Keep last 1000 events
        if events.count > 1000 {
            events.removeFirst(events.count - 1000)
        }

        Logger.info("Event: \(event)")
    }
}

// MARK: - Supporting Types

public struct FleetConfig {
    let databaseURL: URL
    let metricsPort: Int
    let schedulerConfig: SchedulerConfig
    let discoveryConfig: DiscoveryConfig
    let remoteConfig: RemoteConfig
    let autoScalerConfig: AutoScalerConfig

    public static let `default` = FleetConfig(
        databaseURL: URL(fileURLWithPath: "/var/lib/vibecode/fleet.db"),
        metricsPort: 8081,
        schedulerConfig: .default,
        discoveryConfig: .default,
        remoteConfig: .default,
        autoScalerConfig: .default
    )
}

public enum FleetHealth: String, Codable {
    case healthy
    case degraded
    case critical
    case unknown
}

public enum FleetError: Error, LocalizedError {
    case hostNotFound(UUID)
    case containerNotFound(UUID)
    case noSuitableHost
    case migrationFailed(String)
    case databaseError(Error)

    public var errorDescription: String? {
        switch self {
        case .hostNotFound(let id):
            return "Host not found: \(id)"
        case .containerNotFound(let id):
            return "Container not found: \(id)"
        case .noSuitableHost:
            return "No suitable host available for placement"
        case .migrationFailed(let reason):
            return "Container migration failed: \(reason)"
        case .databaseError(let error):
            return "Database error: \(error.localizedDescription)"
        }
    }
}

public enum FleetEvent {
    case systemStarted
    case systemStopped
    case hostRegistered(MacHost)
    case hostUnregistered(MacHost)
    case hostFailed(MacHost)
    case containerStarted(Container)
    case containerStopped(Container)
    case containerMigrated(Container, from: MacHost, to: MacHost)
    case containerFailedToReschedule(Container, error: Error)
    case autoScaleOut(Int)
    case autoScaleIn(Int)
}

// Simple logger
private enum Logger {
    static func info(_ message: String) {
        print("[INFO] \(Date()) \(message)")
    }

    static func warning(_ message: String) {
        print("[WARN] \(Date()) \(message)")
    }

    static func error(_ message: String) {
        print("[ERROR] \(Date()) \(message)")
    }
}
