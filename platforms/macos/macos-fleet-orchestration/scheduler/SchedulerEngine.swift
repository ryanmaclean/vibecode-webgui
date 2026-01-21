import Foundation

// MARK: - Scheduler Engine

/// Intelligent container placement using bin-packing and affinity rules
public final class SchedulerEngine {

    // MARK: - Configuration

    private let config: SchedulerConfig

    public init(config: SchedulerConfig) {
        self.config = config
    }

    // MARK: - Scheduling Algorithm

    /// Make placement decision for container request
    public func schedule(
        request: ContainerRequest,
        hosts: [MacHost]
    ) async -> PlacementDecision? {

        // Filter eligible hosts
        let eligibleHosts = filterEligibleHosts(
            hosts: hosts,
            requirements: request.resources
        )

        guard !eligibleHosts.isEmpty else {
            Logger.warning("No eligible hosts for request: \(request.agentType)")
            return nil
        }

        // Calculate scores for each host
        let scoredHosts = eligibleHosts.compactMap { host in
            calculateScore(
                host: host,
                request: request
            )
        }

        // Sort by score (descending)
        let sorted = scoredHosts.sorted { $0.score > $1.score }

        guard let best = sorted.first else {
            return nil
        }

        Logger.info("Selected host \(best.hostId) with score \(best.score)")
        return best
    }

    // MARK: - Host Filtering

    private func filterEligibleHosts(
        hosts: [MacHost],
        requirements: ResourceRequirements
    ) -> [MacHost] {
        hosts.filter { host in
            // Must be healthy or degraded (not failed)
            guard host.status == .healthy || host.status == .degraded else {
                return false
            }

            // Must have sufficient CPU (with system reserve)
            let requiredCPU = Int(Double(requirements.cpu) * (1.0 + config.systemReservePercent))
            guard host.availableCPU >= requiredCPU else {
                return false
            }

            // Must have sufficient memory (with system reserve)
            let requiredMemory = Int(Double(requirements.memory) * (1.0 + config.systemReservePercent))
            guard host.availableMemory >= requiredMemory else {
                return false
            }

            // Architecture match if specified
            if let requiredArch = requirements.architecture {
                guard host.architecture == requiredArch else {
                    return false
                }
            }

            // Not throttling
            guard !host.isThrottling else {
                return false
            }

            return true
        }
    }

    // MARK: - Scoring

    private func calculateScore(
        host: MacHost,
        request: ContainerRequest
    ) -> PlacementDecision? {

        var score: Double = 0
        var reasons: [String] = []

        // 1. Resource availability score (40% weight)
        let resourceScore = calculateResourceScore(host: host, request: request)
        score += resourceScore * 0.4
        reasons.append("Resource fit: \(String(format: "%.2f", resourceScore))")

        // 2. Load balancing score (20% weight)
        let loadScore = calculateLoadBalancingScore(host: host)
        score += loadScore * 0.2
        reasons.append("Load balance: \(String(format: "%.2f", loadScore))")

        // 3. Affinity score (20% weight)
        let affinityScore = calculateAffinityScore(host: host, request: request)
        score += affinityScore * 0.2
        reasons.append("Affinity: \(String(format: "%.2f", affinityScore))")

        // 4. Anti-affinity score (10% weight)
        let antiAffinityScore = calculateAntiAffinityScore(host: host, request: request)
        score += antiAffinityScore * 0.1
        reasons.append("Anti-affinity: \(String(format: "%.2f", antiAffinityScore))")

        // 5. Thermal health score (10% weight)
        let thermalScore = calculateThermalScore(host: host)
        score += thermalScore * 0.1
        reasons.append("Thermal: \(String(format: "%.2f", thermalScore))")

        return PlacementDecision(
            hostId: host.id,
            score: score,
            reasons: reasons
        )
    }

    // MARK: - Resource Score

    private func calculateResourceScore(
        host: MacHost,
        request: ContainerRequest
    ) -> Double {
        switch config.packingStrategy {
        case .firstFit:
            // Simple binary: fits or doesn't fit
            return 1.0

        case .bestFit:
            // Prefer host with least remaining resources after placement
            let cpuLeftover = Double(host.availableCPU - request.resources.cpu) / Double(host.totalCPU)
            let memLeftover = Double(host.availableMemory - request.resources.memory) / Double(host.totalMemory)
            return 1.0 - ((cpuLeftover + memLeftover) / 2.0)

        case .worstFit:
            // Prefer host with most remaining resources
            let cpuAvailable = Double(host.availableCPU) / Double(host.totalCPU)
            let memAvailable = Double(host.availableMemory) / Double(host.totalMemory)
            return (cpuAvailable + memAvailable) / 2.0

        case .binPacking:
            // Minimize fragmentation - similar to best fit
            let cpuUtil = 1.0 - (Double(host.availableCPU - request.resources.cpu) / Double(host.totalCPU))
            let memUtil = 1.0 - (Double(host.availableMemory - request.resources.memory) / Double(host.totalMemory))

            // Prefer utilization close to target (80%)
            let targetUtil = 0.8
            let cpuDist = abs(cpuUtil - targetUtil)
            let memDist = abs(memUtil - targetUtil)

            return 1.0 - ((cpuDist + memDist) / 2.0)
        }
    }

    // MARK: - Load Balancing Score

    private func calculateLoadBalancingScore(host: MacHost) -> Double {
        // Prefer less loaded hosts
        let cpuLoad = 1.0 - host.cpuUtilization
        let memLoad = 1.0 - host.memoryUtilization

        return (cpuLoad + memLoad) / 2.0
    }

    // MARK: - Affinity Score

    private func calculateAffinityScore(
        host: MacHost,
        request: ContainerRequest
    ) -> Double {
        guard !request.affinityRules.isEmpty else {
            return 0.5 // Neutral if no rules
        }

        var totalWeight = 0
        var weightedScore = 0.0

        for rule in request.affinityRules {
            let ruleScore = evaluateAffinityRule(rule: rule, host: host, request: request)
            weightedScore += ruleScore * Double(rule.weight)
            totalWeight += rule.weight
        }

        return totalWeight > 0 ? weightedScore / Double(totalWeight) : 0.5
    }

    private func evaluateAffinityRule(
        rule: AffinityRule,
        host: MacHost,
        request: ContainerRequest
    ) -> Double {
        switch rule.type {
        case .host:
            // Prefer specific host
            return host.id.uuidString == rule.scope ? 1.0 : 0.0

        case .workspace:
            // Prefer host with same workspace containers
            // This would require workspace tracking
            return 0.5

        case .architecture:
            // Prefer matching architecture
            return host.architecture == rule.scope ? 1.0 : 0.0

        case .tag(let key):
            // Prefer host with matching tag
            return host.tags[key] == rule.scope ? 1.0 : 0.0
        }
    }

    // MARK: - Anti-Affinity Score

    private func calculateAntiAffinityScore(
        host: MacHost,
        request: ContainerRequest
    ) -> Double {
        guard !request.antiAffinityRules.isEmpty else {
            return 0.5 // Neutral if no rules
        }

        var totalWeight = 0
        var weightedScore = 0.0

        for rule in request.antiAffinityRules {
            let ruleScore = evaluateAntiAffinityRule(rule: rule, host: host, request: request)
            weightedScore += ruleScore * Double(rule.weight)
            totalWeight += rule.weight
        }

        return totalWeight > 0 ? weightedScore / Double(totalWeight) : 0.5
    }

    private func evaluateAntiAffinityRule(
        rule: AntiAffinityRule,
        host: MacHost,
        request: ContainerRequest
    ) -> Double {
        switch rule.type {
        case .host:
            // Avoid specific host
            return host.id.uuidString == rule.scope ? 0.0 : 1.0

        case .workspace:
            // Avoid host with same workspace
            return 0.5

        case .architecture:
            // Avoid matching architecture
            return host.architecture == rule.scope ? 0.0 : 1.0

        case .tag(let key):
            // Avoid host with matching tag
            return host.tags[key] == rule.scope ? 0.0 : 1.0
        }
    }

    // MARK: - Thermal Score

    private func calculateThermalScore(host: MacHost) -> Double {
        guard let temp = host.temperature else {
            return 1.0 // No thermal data, assume healthy
        }

        // Penalize hot hosts
        // Assume safe range: <70°C good, >85°C bad
        switch temp {
        case ..<70:
            return 1.0
        case 70..<80:
            return 0.8
        case 80..<90:
            return 0.5
        case 90...:
            return 0.1
        default:
            return 1.0
        }
    }
}

// MARK: - Scheduler Configuration

public struct SchedulerConfig {
    public let packingStrategy: PackingStrategy
    public let systemReservePercent: Double // e.g., 0.15 = 15% reserve
    public let maxUtilization: Double // e.g., 0.90 = 90% max
    public let considerThermals: Bool

    public init(
        packingStrategy: PackingStrategy = .binPacking,
        systemReservePercent: Double = 0.15,
        maxUtilization: Double = 0.90,
        considerThermals: Bool = true
    ) {
        self.packingStrategy = packingStrategy
        self.systemReservePercent = systemReservePercent
        self.maxUtilization = maxUtilization
        self.considerThermals = considerThermals
    }

    public static let `default` = SchedulerConfig()
}

// MARK: - Packing Strategy

public enum PackingStrategy {
    case firstFit      // First host that fits
    case bestFit       // Minimize leftover space
    case worstFit      // Maximize leftover space (spreading)
    case binPacking    // Optimize for 80% target utilization
}

// Simple logger
private enum Logger {
    static func info(_ message: String) {
        print("[SCHEDULER] [INFO] \(Date()) \(message)")
    }

    static func warning(_ message: String) {
        print("[SCHEDULER] [WARN] \(Date()) \(message)")
    }
}
