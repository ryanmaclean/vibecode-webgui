import Foundation
import Combine

// MARK: - Fleet Dashboard ViewModel

@available(macOS 12.0, *)
public final class FleetDashboardViewModel: ObservableObject {

    // MARK: - Published Properties

    @Published public private(set) var hosts: [MacHost] = []
    @Published public private(set) var containers: [Container] = []
    @Published public private(set) var fleetHealth: FleetHealth = .unknown
    @Published public private(set) var recentEvents: [FleetEvent] = []

    // Metrics
    @Published public private(set) var totalHosts: Int = 0
    @Published public private(set) var healthyHosts: Int = 0
    @Published public private(set) var totalContainers: Int = 0
    @Published public private(set) var runningContainers: Int = 0
    @Published public private(set) var cpuUtilization: Double = 0
    @Published public private(set) var memoryUtilization: Double = 0

    // History for charts
    @Published public private(set) var cpuHistory: [Double] = []
    @Published public private(set) var memoryHistory: [Double] = []

    // MARK: - Dependencies

    private let fleetManager: FleetManager
    private var cancellables = Set<AnyCancellable>()

    // MARK: - Initialization

    public init(fleetManager: FleetManager) {
        self.fleetManager = fleetManager
        setupBindings()
    }

    // MARK: - Setup

    private func setupBindings() {
        // Bind to fleet manager state
        fleetManager.$hosts
            .map { Array($0.values) }
            .assign(to: &$hosts)

        fleetManager.$containers
            .map { Array($0.values) }
            .assign(to: &$containers)

        fleetManager.$fleetHealth
            .assign(to: &$fleetHealth)

        fleetManager.$events
            .map { Array($0.suffix(10)) }
            .assign(to: &$recentEvents)

        // Update metrics
        fleetManager.$hosts
            .combineLatest(fleetManager.$containers)
            .sink { [weak self] hosts, containers in
                self?.updateMetrics(hosts: hosts, containers: containers)
            }
            .store(in: &cancellables)
    }

    // MARK: - Metrics Updates

    private func updateMetrics(
        hosts: [UUID: MacHost],
        containers: [UUID: Container]
    ) {
        totalHosts = hosts.count
        healthyHosts = hosts.values.filter { $0.status == .healthy }.count
        totalContainers = containers.count
        runningContainers = containers.values.filter { $0.status == .running }.count

        let totalCPU = hosts.values.reduce(0) { $0 + $1.totalCPU }
        let availableCPU = hosts.values.reduce(0) { $0 + $1.availableCPU }
        cpuUtilization = totalCPU > 0 ? Double(totalCPU - availableCPU) / Double(totalCPU) : 0

        let totalMemory = hosts.values.reduce(0) { $0 + $1.totalMemory }
        let availableMemory = hosts.values.reduce(0) { $0 + $1.availableMemory }
        memoryUtilization = totalMemory > 0 ? Double(totalMemory - availableMemory) / Double(totalMemory) : 0

        // Update history
        cpuHistory.append(cpuUtilization)
        memoryHistory.append(memoryUtilization)

        // Keep last 60 data points
        if cpuHistory.count > 60 {
            cpuHistory.removeFirst()
        }
        if memoryHistory.count > 60 {
            memoryHistory.removeFirst()
        }
    }

    // MARK: - Actions

    public func drainHost(hostId: UUID) {
        Task {
            do {
                try await fleetManager.unregisterHost(id: hostId)
            } catch {
                print("Failed to drain host: \(error)")
            }
        }
    }

    public func setMaintenanceMode(hostId: UUID) {
        Task {
            await fleetManager.updateHostStatus(id: hostId, status: .maintenance)
        }
    }

    public func stopContainer(containerId: UUID) {
        Task {
            do {
                try await fleetManager.stopContainer(id: containerId)
            } catch {
                print("Failed to stop container: \(error)")
            }
        }
    }

    public func restartContainer(containerId: UUID) {
        Task {
            do {
                // Stop and restart
                try await fleetManager.stopContainer(id: containerId)
                // Note: Would need to re-place container
            } catch {
                print("Failed to restart container: \(error)")
            }
        }
    }

    public func migrateContainer(containerId: UUID) {
        Task {
            guard let container = containers.first(where: { $0.id == containerId }) else {
                return
            }

            // Find suitable target host
            let targetHost = hosts
                .filter { $0.id != container.hostId && $0.status == .healthy }
                .max { $0.availableCPU < $1.availableCPU }

            guard let target = targetHost else {
                print("No suitable target host for migration")
                return
            }

            do {
                try await fleetManager.migrateContainer(id: containerId, to: target.id)
            } catch {
                print("Failed to migrate container: \(error)")
            }
        }
    }

    public func viewContainerLogs(containerId: UUID) {
        // Open logs view
        print("Viewing logs for container: \(containerId)")
    }

    // MARK: - Helper Methods

    public func getContainer(id: UUID) -> Container? {
        containers.first { $0.id == id }
    }

    public func getHost(id: UUID) -> MacHost? {
        hosts.first { $0.id == id }
    }
}
