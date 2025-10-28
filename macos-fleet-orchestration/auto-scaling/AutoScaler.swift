import Foundation
import Combine

// MARK: - Auto-Scaler

/// Automatic fleet scaling based on capacity and demand
public final class AutoScaler: ObservableObject {

    // MARK: - Published Properties

    @Published public private(set) var scalingDecisions: ScalingDecision?
    @Published public private(set) var metrics: ScalingMetrics?

    // MARK: - Configuration

    private let config: AutoScalerConfig

    // MARK: - State

    private var evaluationTimer: Timer?
    private var demandHistory: [DemandSnapshot] = []
    private var isScaling: Bool = false

    // MARK: - Initialization

    public init(config: AutoScalerConfig) {
        self.config = config
    }

    // MARK: - Public API

    public func start() async {
        Logger.info("Starting auto-scaler...")

        startEvaluationTimer()

        Logger.info("Auto-scaler started")
    }

    public func stop() async {
        Logger.info("Stopping auto-scaler...")

        evaluationTimer?.invalidate()
        evaluationTimer = nil

        Logger.info("Auto-scaler stopped")
    }

    /// Evaluate scaling decision based on current fleet state
    public func evaluate(fleetMetrics: FleetMetrics) async -> ScalingDecision? {
        guard !isScaling else {
            Logger.info("Scaling operation in progress, skipping evaluation")
            return nil
        }

        // Record demand snapshot
        recordDemand(metrics: fleetMetrics)

        // Update scaling metrics
        await updateMetrics(fleetMetrics: fleetMetrics)

        // Check scale-out conditions
        if shouldScaleOut(metrics: fleetMetrics) {
            let count = calculateScaleOutCount(metrics: fleetMetrics)
            let decision = ScalingDecision(
                action: .scaleOut(count: count),
                reason: "Fleet capacity below threshold (\(fleetMetrics.cpuUtilization * 100)% CPU)"
            )
            await executeScalingDecision(decision)
            return decision
        }

        // Check scale-in conditions
        if shouldScaleIn(metrics: fleetMetrics) {
            let hostIds = selectHostsForScaleIn(metrics: fleetMetrics)
            let decision = ScalingDecision(
                action: .scaleIn(hostIds: hostIds),
                reason: "Fleet utilization low (\(fleetMetrics.cpuUtilization * 100)% CPU)"
            )
            await executeScalingDecision(decision)
            return decision
        }

        return ScalingDecision(
            action: .noAction,
            reason: "Fleet capacity within target range"
        )
    }

    // MARK: - Scale-Out Logic

    private func shouldScaleOut(metrics: FleetMetrics) -> Bool {
        // Trigger scale-out if:
        // 1. Available capacity below threshold
        let capacityPressure = 1.0 - Double(metrics.availableCPU) / Double(metrics.totalCPU)
        guard capacityPressure > config.scaleOutThreshold else {
            return false
        }

        // 2. Not in cooldown period
        guard !isInCooldown() else {
            Logger.info("In scale-out cooldown period")
            return false
        }

        // 3. Sustained demand (not just spike)
        guard isSustainedDemand(threshold: config.scaleOutThreshold) else {
            Logger.info("Demand spike, waiting for sustained pressure")
            return false
        }

        return true
    }

    private func calculateScaleOutCount(metrics: FleetMetrics) -> Int {
        let capacityNeeded = Double(metrics.totalContainers) - Double(metrics.runningContainers)
        let avgContainersPerHost = Double(metrics.runningContainers) / Double(metrics.totalHosts)

        // Calculate hosts needed with buffer
        let hostsNeeded = Int(ceil(capacityNeeded / avgContainersPerHost * config.scaleBuffer))

        // Clamp to min/max
        return max(config.minScaleStep, min(config.maxScaleStep, hostsNeeded))
    }

    // MARK: - Scale-In Logic

    private func shouldScaleIn(metrics: FleetMetrics) -> Bool {
        // Trigger scale-in if:
        // 1. Utilization below threshold
        let avgUtilization = (metrics.cpuUtilization + metrics.memoryUtilization) / 2.0
        guard avgUtilization < config.scaleInThreshold else {
            return false
        }

        // 2. Sustained low utilization
        guard isSustainedLowUtilization(threshold: config.scaleInThreshold) else {
            Logger.info("Utilization temporarily low, waiting for sustained period")
            return false
        }

        // 3. Not in cooldown period
        guard !isInCooldown() else {
            Logger.info("In scale-in cooldown period")
            return false
        }

        // 4. Have hosts to remove
        guard metrics.totalHosts > config.minHosts else {
            Logger.info("Already at minimum host count")
            return false
        }

        return true
    }

    private func selectHostsForScaleIn(metrics: FleetMetrics) -> [UUID] {
        // Select least utilized hosts for removal
        // This is a placeholder - real implementation would query fleet manager

        // Scale down by min step
        let count = config.minScaleStep

        Logger.info("Selecting \(count) hosts for scale-in")

        return []
    }

    // MARK: - Demand Analysis

    private func recordDemand(metrics: FleetMetrics) {
        let snapshot = DemandSnapshot(
            timestamp: Date(),
            cpuUtilization: metrics.cpuUtilization,
            memoryUtilization: metrics.memoryUtilization,
            containerCount: metrics.runningContainers
        )

        demandHistory.append(snapshot)

        // Keep last N snapshots
        let maxHistory = Int(config.sustainedDemandDuration / config.evaluationInterval)
        if demandHistory.count > maxHistory {
            demandHistory.removeFirst(demandHistory.count - maxHistory)
        }
    }

    private func isSustainedDemand(threshold: Double) -> Bool {
        guard demandHistory.count >= 3 else {
            return false
        }

        let recentSnapshots = demandHistory.suffix(3)
        return recentSnapshots.allSatisfy { snapshot in
            (1.0 - snapshot.cpuUtilization) < (1.0 - threshold)
        }
    }

    private func isSustainedLowUtilization(threshold: Double) -> Bool {
        guard demandHistory.count >= 5 else {
            return false
        }

        let recentSnapshots = demandHistory.suffix(5)
        return recentSnapshots.allSatisfy { snapshot in
            (snapshot.cpuUtilization + snapshot.memoryUtilization) / 2.0 < threshold
        }
    }

    // MARK: - Predictive Scaling

    private func predictDemand() -> Double? {
        guard demandHistory.count >= 10 else {
            return nil
        }

        // Simple linear regression
        let utilizations = demandHistory.map { $0.cpuUtilization }
        let n = Double(utilizations.count)

        let sumX = (0..<utilizations.count).reduce(0.0) { $0 + Double($1) }
        let sumY = utilizations.reduce(0.0, +)
        let sumXY = zip(0..<utilizations.count, utilizations).reduce(0.0) { $0 + Double($1.0) * $1.1 }
        let sumX2 = (0..<utilizations.count).reduce(0.0) { $0 + pow(Double($1), 2) }

        let slope = (n * sumXY - sumX * sumY) / (n * sumX2 - pow(sumX, 2))
        let intercept = (sumY - slope * sumX) / n

        // Predict next value
        let nextX = Double(utilizations.count)
        let prediction = slope * nextX + intercept

        return prediction
    }

    // MARK: - Cooldown Management

    private var lastScalingAction: Date?

    private func isInCooldown() -> Bool {
        guard let lastAction = lastScalingAction else {
            return false
        }

        let cooldownElapsed = Date().timeIntervalSince(lastAction)
        return cooldownElapsed < config.cooldownPeriod
    }

    private func executeScalingDecision(_ decision: ScalingDecision) async {
        isScaling = true
        lastScalingAction = Date()

        Logger.info("Executing scaling decision: \(decision.reason)")

        // Publish decision for fleet manager
        await MainActor.run {
            self.scalingDecisions = decision
        }

        // Simulate scaling delay
        try? await Task.sleep(nanoseconds: 5_000_000_000) // 5 seconds

        isScaling = false
    }

    // MARK: - Cost Optimization

    private func calculateCost(hostCount: Int) -> Double {
        // Cost model: base cost + per-host cost
        let baseCost = config.costModel.baseMonthly
        let hostCost = config.costModel.perHostMonthly * Double(hostCount)

        return baseCost + hostCost
    }

    private func optimizeCostEfficiency(metrics: FleetMetrics) -> ScalingDecision? {
        let currentCost = calculateCost(hostCount: metrics.totalHosts)
        let utilizationEfficiency = (metrics.cpuUtilization + metrics.memoryUtilization) / 2.0

        // If utilization is low and we can save significant cost
        if utilizationEfficiency < 0.5 && metrics.totalHosts > config.minHosts {
            let optimizedHosts = Int(ceil(Double(metrics.totalHosts) * utilizationEfficiency / 0.7))
            let potentialSavings = currentCost - calculateCost(hostCount: optimizedHosts)

            if potentialSavings > config.costModel.savingsThreshold {
                return ScalingDecision(
                    action: .scaleIn(hostIds: []),
                    reason: "Cost optimization: potential savings $\(potentialSavings)/month"
                )
            }
        }

        return nil
    }

    // MARK: - Metrics

    private func updateMetrics(fleetMetrics: FleetMetrics) async {
        let prediction = predictDemand()

        let scalingMetrics = ScalingMetrics(
            currentUtilization: fleetMetrics.cpuUtilization,
            predictedUtilization: prediction,
            hostCount: fleetMetrics.totalHosts,
            containerCount: fleetMetrics.runningContainers,
            isInCooldown: isInCooldown(),
            lastScalingAction: lastScalingAction,
            costPerMonth: calculateCost(hostCount: fleetMetrics.totalHosts)
        )

        await MainActor.run {
            self.metrics = scalingMetrics
        }
    }

    // MARK: - Timer

    private func startEvaluationTimer() {
        evaluationTimer = Timer.scheduledTimer(
            withTimeInterval: config.evaluationInterval,
            repeats: true
        ) { [weak self] _ in
            // Evaluation triggered by fleet manager passing current metrics
            Logger.info("Auto-scaler evaluation tick")
        }
    }
}

// MARK: - Auto-Scaler Configuration

public struct AutoScalerConfig {
    public let enabled: Bool
    public let evaluationInterval: TimeInterval
    public let scaleOutThreshold: Double // e.g., 0.85 = scale when 85% utilized
    public let scaleInThreshold: Double // e.g., 0.40 = scale down when 40% utilized
    public let cooldownPeriod: TimeInterval
    public let sustainedDemandDuration: TimeInterval
    public let minHosts: Int
    public let maxHosts: Int
    public let minScaleStep: Int
    public let maxScaleStep: Int
    public let scaleBuffer: Double // e.g., 1.2 = 20% buffer
    public let costModel: CostModel

    public init(
        enabled: Bool = true,
        evaluationInterval: TimeInterval = 60,
        scaleOutThreshold: Double = 0.85,
        scaleInThreshold: Double = 0.40,
        cooldownPeriod: TimeInterval = 300,
        sustainedDemandDuration: TimeInterval = 180,
        minHosts: Int = 2,
        maxHosts: Int = 100,
        minScaleStep: Int = 1,
        maxScaleStep: Int = 5,
        scaleBuffer: Double = 1.2,
        costModel: CostModel = .default
    ) {
        self.enabled = enabled
        self.evaluationInterval = evaluationInterval
        self.scaleOutThreshold = scaleOutThreshold
        self.scaleInThreshold = scaleInThreshold
        self.cooldownPeriod = cooldownPeriod
        self.sustainedDemandDuration = sustainedDemandDuration
        self.minHosts = minHosts
        self.maxHosts = maxHosts
        self.minScaleStep = minScaleStep
        self.maxScaleStep = maxScaleStep
        self.scaleBuffer = scaleBuffer
        self.costModel = costModel
    }

    public static let `default` = AutoScalerConfig()
}

// MARK: - Cost Model

public struct CostModel {
    public let baseMonthly: Double
    public let perHostMonthly: Double
    public let savingsThreshold: Double

    public init(
        baseMonthly: Double = 0,
        perHostMonthly: Double = 100,
        savingsThreshold: Double = 200
    ) {
        self.baseMonthly = baseMonthly
        self.perHostMonthly = perHostMonthly
        self.savingsThreshold = savingsThreshold
    }

    public static let `default` = CostModel()
}

// MARK: - Supporting Types

private struct DemandSnapshot {
    let timestamp: Date
    let cpuUtilization: Double
    let memoryUtilization: Double
    let containerCount: Int
}

public struct ScalingMetrics {
    public let currentUtilization: Double
    public let predictedUtilization: Double?
    public let hostCount: Int
    public let containerCount: Int
    public let isInCooldown: Bool
    public let lastScalingAction: Date?
    public let costPerMonth: Double
}

// Simple logger
private enum Logger {
    static func info(_ message: String) {
        print("[AUTOSCALER] [INFO] \(Date()) \(message)")
    }

    static func warning(_ message: String) {
        print("[AUTOSCALER] [WARN] \(Date()) \(message)")
    }
}
