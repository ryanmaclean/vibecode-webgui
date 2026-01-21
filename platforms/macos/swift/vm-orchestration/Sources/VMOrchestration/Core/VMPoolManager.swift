import Foundation
import Virtualization
import Logging

/// VM Pool Manager - Pre-warmed VM pool with fast allocation and resource management
///
/// This class manages a pool of pre-warmed VMs for AgentAPI containers, providing:
/// - Sub-100ms allocation from pre-warmed pool
/// - Automatic VM recycling after 100 uses
/// - Memory pressure handling with graceful degradation
/// - Health monitoring and automatic VM replacement
///
/// Architecture:
/// ```
/// PREWARMING → AVAILABLE → ALLOCATED → IN_USE → RELEASED → RECYCLING
///                                                     ↓
///                                                 AVAILABLE (if usage < 100)
///                                                     ↓
///                                                 TERMINATED (if usage >= 100)
/// ```
public final class VMPoolManager {

    // MARK: - Configuration

    /// Pool size configuration
    private let config: PoolConfiguration

    /// Resource quotas per VM
    private let vmResources: VMResourceQuota

    /// Logger for diagnostics
    private let logger: Logger

    // MARK: - Pool State

    /// Available pre-warmed VMs ready for allocation
    private var availableVMs: [PrewarmedVM] = []

    /// Currently active VMs in use
    private var activeVMs: [UUID: ActiveVM] = [:]

    /// Usage count per VM for recycling decisions
    private var vmUsageCount: [UUID: Int] = [:]

    /// Pool metrics for monitoring
    private var metrics: PoolMetrics

    /// Queue for thread-safe pool operations
    private let poolQueue = DispatchQueue(label: "com.vibecode.vmpool", qos: .userInitiated)

    /// Timer for background pool maintenance
    private var maintenanceTimer: DispatchSourceTimer?

    // MARK: - Initialization

    /// Initialize VM pool manager with configuration
    /// - Parameters:
    ///   - config: Pool configuration (size, limits, timeouts)
    ///   - resources: Per-VM resource quotas
    ///   - logger: Logger instance for diagnostics
    public init(
        config: PoolConfiguration = .default,
        resources: VMResourceQuota = .default,
        logger: Logger = Logger(label: "com.vibecode.vmpool")
    ) {
        self.config = config
        self.vmResources = resources
        self.logger = logger
        self.metrics = PoolMetrics()

        // Start background maintenance
        startMaintenanceTimer()
    }

    deinit {
        maintenanceTimer?.cancel()
    }

    // MARK: - Public API

    /// Warm the VM pool by pre-booting VMs
    /// - Throws: VMPoolError if pool warming fails
    public func warmPool() async throws {
        logger.info("Warming VM pool", metadata: [
            "target_size": "\(config.poolSize)",
            "max_vms": "\(config.maxVMs)"
        ])

        let startTime = Date()

        // Pre-warm pool to target size
        try await withThrowingTaskGroup(of: PrewarmedVM.self) { group in
            for _ in 0..<config.poolSize {
                group.addTask {
                    try await self.createPrewarmedVM()
                }
            }

            for try await vm in group {
                await poolQueue.sync {
                    availableVMs.append(vm)
                }
            }
        }

        let duration = Date().timeIntervalSince(startTime)
        logger.info("VM pool warmed", metadata: [
            "available_vms": "\(availableVMs.count)",
            "duration_seconds": "\(String(format: "%.2f", duration))"
        ])

        metrics.poolWarmTime = duration
    }

    /// Allocate a VM from the pool
    /// - Returns: Allocated ActiveVM ready for use
    /// - Throws: VMPoolError if allocation fails
    public func allocateVM() async throws -> ActiveVM {
        let startTime = Date()

        return try await poolQueue.sync {
            // Check if pool has available VMs
            guard !availableVMs.isEmpty else {
                logger.warning("No available VMs in pool, cold booting")
                metrics.coldBootCount += 1
                return try await coldBootVM()
            }

            // Pop VM from available pool
            let prewarmedVM = availableVMs.removeFirst()
            let vmId = prewarmedVM.id

            // Convert to active VM
            let activeVM = ActiveVM(
                id: vmId,
                vm: prewarmedVM.vm,
                allocatedAt: Date(),
                ipAddress: prewarmedVM.ipAddress,
                workspaceURL: prewarmedVM.workspaceURL
            )

            // Track active VM
            activeVMs[vmId] = activeVM
            vmUsageCount[vmId, default: 0] += 1

            // Update metrics
            let duration = Date().timeIntervalSince(startTime)
            metrics.allocationLatency = duration
            metrics.hotAllocations += 1

            logger.info("VM allocated from pool", metadata: [
                "vm_id": "\(vmId)",
                "ip_address": "\(activeVM.ipAddress)",
                "latency_ms": "\(Int(duration * 1000))",
                "usage_count": "\(vmUsageCount[vmId] ?? 0)"
            ])

            // Asynchronously replenish pool
            Task {
                await replenishPool()
            }

            return activeVM
        }
    }

    /// Release a VM back to the pool or recycle if over usage limit
    /// - Parameter vmId: UUID of the VM to release
    public func releaseVM(_ vmId: UUID) async {
        let startTime = Date()

        await poolQueue.sync {
            guard let activeVM = activeVMs.removeValue(forKey: vmId) else {
                logger.warning("Attempted to release unknown VM", metadata: ["vm_id": "\(vmId)"])
                return
            }

            let usageCount = vmUsageCount[vmId] ?? 0

            // Check if VM should be recycled
            if usageCount >= config.vmRecycleLimit {
                logger.info("Recycling VM due to usage limit", metadata: [
                    "vm_id": "\(vmId)",
                    "usage_count": "\(usageCount)"
                ])

                Task {
                    await recycleVM(activeVM)
                }

                metrics.recycledVMs += 1
            } else {
                // Return to available pool
                let prewarmedVM = PrewarmedVM(
                    id: vmId,
                    vm: activeVM.vm,
                    ipAddress: activeVM.ipAddress,
                    workspaceURL: activeVM.workspaceURL
                )

                availableVMs.append(prewarmedVM)

                logger.info("VM returned to pool", metadata: [
                    "vm_id": "\(vmId)",
                    "usage_count": "\(usageCount)"
                ])
            }

            let duration = Date().timeIntervalSince(startTime)
            metrics.releaseLatency = duration
        }
    }

    /// Get current pool statistics
    /// - Returns: PoolStatistics with current state
    public func getStatistics() -> PoolStatistics {
        poolQueue.sync {
            PoolStatistics(
                availableVMs: availableVMs.count,
                activeVMs: activeVMs.count,
                totalVMs: availableVMs.count + activeVMs.count,
                hotAllocations: metrics.hotAllocations,
                coldBootCount: metrics.coldBootCount,
                recycledVMs: metrics.recycledVMs,
                averageAllocationLatency: metrics.allocationLatency,
                averageReleaseLatency: metrics.releaseLatency,
                poolWarmTime: metrics.poolWarmTime
            )
        }
    }

    /// Handle system memory pressure by shrinking pool
    public func handleMemoryPressure() {
        poolQueue.async { [weak self] in
            guard let self = self else { return }

            let targetSize = max(1, self.config.poolSize / 2)
            let removeCount = max(0, self.availableVMs.count - targetSize)

            if removeCount > 0 {
                self.logger.warning("Memory pressure detected, shrinking pool", metadata: [
                    "current_size": "\(self.availableVMs.count)",
                    "target_size": "\(targetSize)",
                    "removing": "\(removeCount)"
                ])

                for _ in 0..<removeCount {
                    if let vm = self.availableVMs.popLast() {
                        Task {
                            await self.terminateVM(vm.vm)
                        }
                    }
                }
            }
        }
    }

    // MARK: - Private Methods

    /// Create a new pre-warmed VM
    private func createPrewarmedVM() async throws -> PrewarmedVM {
        let vmId = UUID()
        let startTime = Date()

        logger.info("Creating pre-warmed VM", metadata: ["vm_id": "\(vmId)"])

        // Create VM configuration
        let vmConfig = try await VMConfigurationBuilder.buildConfiguration(
            resources: vmResources,
            vmId: vmId
        )

        // Create VM instance
        let vm = VZVirtualMachine(configuration: vmConfig.configuration)

        // Boot VM
        try await vm.start()

        // Wait for boot completion (AgentAPI ready)
        try await waitForBoot(vm: vm, timeout: config.bootTimeout)

        let bootTime = Date().timeIntervalSince(startTime)
        logger.info("Pre-warmed VM ready", metadata: [
            "vm_id": "\(vmId)",
            "boot_time_ms": "\(Int(bootTime * 1000))",
            "ip_address": "\(vmConfig.ipAddress)"
        ])

        return PrewarmedVM(
            id: vmId,
            vm: vm,
            ipAddress: vmConfig.ipAddress,
            workspaceURL: vmConfig.workspaceURL
        )
    }

    /// Cold boot a VM when pool is empty
    private func coldBootVM() async throws -> ActiveVM {
        let vm = try await createPrewarmedVM()

        let activeVM = ActiveVM(
            id: vm.id,
            vm: vm.vm,
            allocatedAt: Date(),
            ipAddress: vm.ipAddress,
            workspaceURL: vm.workspaceURL
        )

        activeVMs[vm.id] = activeVM
        vmUsageCount[vm.id] = 1

        return activeVM
    }

    /// Replenish pool to target size
    private func replenishPool() async {
        let currentSize = availableVMs.count
        let targetSize = config.poolSize

        if currentSize < targetSize {
            let needed = targetSize - currentSize

            logger.info("Replenishing pool", metadata: [
                "current": "\(currentSize)",
                "target": "\(targetSize)",
                "needed": "\(needed)"
            ])

            for _ in 0..<needed {
                do {
                    let vm = try await createPrewarmedVM()
                    await poolQueue.sync {
                        availableVMs.append(vm)
                    }
                } catch {
                    logger.error("Failed to create VM for pool replenishment", metadata: [
                        "error": "\(error)"
                    ])
                }
            }
        }
    }

    /// Recycle a VM by graceful shutdown and cleanup
    private func recycleVM(_ vm: ActiveVM) async {
        logger.info("Recycling VM", metadata: ["vm_id": "\(vm.id)"])

        // Graceful shutdown
        if vm.vm.state == .running {
            do {
                try await vm.vm.stop()
            } catch {
                logger.error("Failed to stop VM during recycling", metadata: [
                    "vm_id": "\(vm.id)",
                    "error": "\(error)"
                ])
            }
        }

        // Cleanup resources
        vmUsageCount.removeValue(forKey: vm.id)

        // Replenish pool
        await replenishPool()
    }

    /// Terminate a VM completely
    private func terminateVM(_ vm: VZVirtualMachine) async {
        if vm.state == .running {
            do {
                try await vm.stop()
            } catch {
                logger.error("Failed to stop VM during termination", metadata: [
                    "error": "\(error)"
                ])
            }
        }
    }

    /// Wait for VM to complete boot (AgentAPI ready check)
    private func waitForBoot(vm: VZVirtualMachine, timeout: TimeInterval) async throws {
        let deadline = Date().addingTimeInterval(timeout)

        while Date() < deadline {
            if vm.state == .running {
                // TODO: Add HTTP health check to AgentAPI port 3284
                return
            }

            try await Task.sleep(nanoseconds: 10_000_000) // 10ms
        }

        throw VMPoolError.bootTimeout
    }

    /// Start background maintenance timer
    private func startMaintenanceTimer() {
        maintenanceTimer = DispatchSource.makeTimerSource(queue: poolQueue)
        maintenanceTimer?.schedule(deadline: .now() + 30, repeating: 30)
        maintenanceTimer?.setEventHandler { [weak self] in
            Task {
                await self?.performMaintenance()
            }
        }
        maintenanceTimer?.resume()
    }

    /// Perform periodic pool maintenance
    private func performMaintenance() async {
        // Health check active VMs
        for (vmId, activeVM) in activeVMs {
            if !isVMHealthy(activeVM.vm) {
                logger.warning("Unhealthy VM detected", metadata: ["vm_id": "\(vmId)"])
                await recycleVM(activeVM)
            }
        }

        // Replenish pool if needed
        await replenishPool()
    }

    /// Check if VM is healthy
    private func isVMHealthy(_ vm: VZVirtualMachine) -> Bool {
        return vm.state == .running
    }
}

// MARK: - Supporting Types

/// Pool configuration parameters
public struct PoolConfiguration {
    /// Target number of pre-warmed VMs
    public let poolSize: Int

    /// Maximum number of total VMs
    public let maxVMs: Int

    /// Number of uses before VM recycling
    public let vmRecycleLimit: Int

    /// Boot timeout in seconds
    public let bootTimeout: TimeInterval

    /// Default configuration
    public static let `default` = PoolConfiguration(
        poolSize: 5,
        maxVMs: 20,
        vmRecycleLimit: 100,
        bootTimeout: 0.5 // 500ms
    )
}

/// VM resource quotas
public struct VMResourceQuota {
    /// Number of virtual CPUs
    public let cpuCount: Int

    /// Memory size in bytes
    public let memorySize: UInt64

    /// Root disk size in bytes
    public let diskSize: UInt64

    /// Default resource quota (4 vCPU, 8GB RAM, 50GB disk)
    public static let `default` = VMResourceQuota(
        cpuCount: 4,
        memorySize: 8 * 1024 * 1024 * 1024,
        diskSize: 50 * 1024 * 1024 * 1024
    )
}

/// Pre-warmed VM in available pool
struct PrewarmedVM {
    let id: UUID
    let vm: VZVirtualMachine
    let ipAddress: String
    let workspaceURL: URL
}

/// Active VM currently in use
public struct ActiveVM {
    public let id: UUID
    public let vm: VZVirtualMachine
    public let allocatedAt: Date
    public let ipAddress: String
    public let workspaceURL: URL
}

/// Pool performance metrics
struct PoolMetrics {
    var allocationLatency: TimeInterval = 0
    var releaseLatency: TimeInterval = 0
    var poolWarmTime: TimeInterval = 0
    var hotAllocations: Int = 0
    var coldBootCount: Int = 0
    var recycledVMs: Int = 0
}

/// Pool statistics snapshot
public struct PoolStatistics {
    public let availableVMs: Int
    public let activeVMs: Int
    public let totalVMs: Int
    public let hotAllocations: Int
    public let coldBootCount: Int
    public let recycledVMs: Int
    public let averageAllocationLatency: TimeInterval
    public let averageReleaseLatency: TimeInterval
    public let poolWarmTime: TimeInterval
}

/// VM pool errors
public enum VMPoolError: Error {
    case poolExhausted
    case bootTimeout
    case configurationFailed(String)
    case allocationFailed(String)
}
