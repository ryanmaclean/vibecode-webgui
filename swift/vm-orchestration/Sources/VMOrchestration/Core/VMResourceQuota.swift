import Foundation

/// VM Resource Quota - Per-VM resource limits and configuration
///
/// Defines resource allocation for each VM instance:
/// - CPU: 4 vCPUs (2 P-cores + 2 E-cores on Apple Silicon)
/// - Memory: 8GB RAM
/// - Disk: 50GB total (10GB root + 40GB workspace)
///
/// These quotas ensure:
/// - 20+ VMs can run on M2 Pro/Max (with 2:1 CPU overcommit)
/// - Host system maintains <10% CPU overhead
/// - Memory usage stays within physical limits
public struct VMResourceQuota: Codable, Equatable {

    // MARK: - Properties

    /// Number of virtual CPUs allocated to VM
    public let cpuCount: Int

    /// Memory size in bytes
    public let memorySize: UInt64

    /// Root disk size in bytes (for OS and applications)
    public let rootDiskSize: UInt64

    /// Workspace disk size in bytes (for user data)
    public let workspaceDiskSize: UInt64

    /// Total disk size (root + workspace)
    public var totalDiskSize: UInt64 {
        rootDiskSize + workspaceDiskSize
    }

    // MARK: - Initialization

    /// Initialize VM resource quota
    /// - Parameters:
    ///   - cpuCount: Number of virtual CPUs (default: 4)
    ///   - memorySize: Memory in bytes (default: 8GB)
    ///   - rootDiskSize: Root disk size in bytes (default: 10GB)
    ///   - workspaceDiskSize: Workspace disk size in bytes (default: 40GB)
    public init(
        cpuCount: Int = 4,
        memorySize: UInt64 = 8 * 1024 * 1024 * 1024,
        rootDiskSize: UInt64 = 10 * 1024 * 1024 * 1024,
        workspaceDiskSize: UInt64 = 40 * 1024 * 1024 * 1024
    ) {
        self.cpuCount = cpuCount
        self.memorySize = memorySize
        self.rootDiskSize = rootDiskSize
        self.workspaceDiskSize = workspaceDiskSize
    }

    // MARK: - Predefined Quotas

    /// Default resource quota (4 vCPU, 8GB RAM, 50GB disk)
    /// Optimized for AgentAPI containers running Aider/Goose/Cline
    public static let `default` = VMResourceQuota()

    /// Minimal resource quota (2 vCPU, 4GB RAM, 20GB disk)
    /// For lightweight development or testing
    public static let minimal = VMResourceQuota(
        cpuCount: 2,
        memorySize: 4 * 1024 * 1024 * 1024,
        rootDiskSize: 5 * 1024 * 1024 * 1024,
        workspaceDiskSize: 15 * 1024 * 1024 * 1024
    )

    /// High-performance quota (8 vCPU, 16GB RAM, 100GB disk)
    /// For ML workloads or intensive code generation
    public static let highPerformance = VMResourceQuota(
        cpuCount: 8,
        memorySize: 16 * 1024 * 1024 * 1024,
        rootDiskSize: 20 * 1024 * 1024 * 1024,
        workspaceDiskSize: 80 * 1024 * 1024 * 1024
    )

    // MARK: - Validation

    /// Validate resource quota against system limits
    /// - Returns: true if quota is valid for current system
    public func validate() -> ValidationResult {
        var warnings: [String] = []
        var errors: [String] = []

        // Validate CPU count
        let systemCPUCount = ProcessInfo.processInfo.processorCount
        if cpuCount > systemCPUCount {
            warnings.append("CPU count (\(cpuCount)) exceeds system CPUs (\(systemCPUCount))")
        }
        if cpuCount < 1 {
            errors.append("CPU count must be at least 1")
        }

        // Validate memory
        let systemMemory = ProcessInfo.processInfo.physicalMemory
        if memorySize > systemMemory {
            errors.append("Memory size (\(memorySize.bytesToGB)GB) exceeds system memory (\(systemMemory.bytesToGB)GB)")
        }
        if memorySize < 512 * 1024 * 1024 {
            errors.append("Memory size must be at least 512MB")
        }

        // Validate disk sizes
        if rootDiskSize < 1 * 1024 * 1024 * 1024 {
            errors.append("Root disk must be at least 1GB")
        }
        if workspaceDiskSize < 1 * 1024 * 1024 * 1024 {
            errors.append("Workspace disk must be at least 1GB")
        }

        return ValidationResult(
            isValid: errors.isEmpty,
            warnings: warnings,
            errors: errors
        )
    }

    /// Validation result
    public struct ValidationResult {
        public let isValid: Bool
        public let warnings: [String]
        public let errors: [String]
    }

    // MARK: - Formatting

    /// Human-readable description of resource quota
    public var description: String {
        """
        VM Resource Quota:
          CPU: \(cpuCount) vCPUs
          Memory: \(memorySize.bytesToGB) GB
          Root Disk: \(rootDiskSize.bytesToGB) GB
          Workspace: \(workspaceDiskSize.bytesToGB) GB
          Total Disk: \(totalDiskSize.bytesToGB) GB
        """
    }
}

// MARK: - Extensions

extension UInt64 {
    /// Convert bytes to GB (rounded to 2 decimal places)
    var bytesToGB: String {
        let gb = Double(self) / (1024 * 1024 * 1024)
        return String(format: "%.2f", gb)
    }

    /// Convert bytes to MB
    var bytesToMB: String {
        let mb = Double(self) / (1024 * 1024)
        return String(format: "%.2f", mb)
    }
}
