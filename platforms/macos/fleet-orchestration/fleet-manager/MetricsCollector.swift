import Foundation
import Network

// MARK: - Metrics Collector

/// Prometheus-compatible metrics exporter
@available(macOS 12.0, *)
public final class MetricsCollector {

    // MARK: - Configuration

    private let port: Int

    // MARK: - Metrics State

    private var metrics: [String: MetricValue] = [:]
    private let metricsQueue = DispatchQueue(label: "com.vibecode.fleet.metrics")

    // MARK: - Server

    private var listener: NWListener?

    // MARK: - Initialization

    public init(port: Int = 8081) {
        self.port = port
    }

    // MARK: - Server Lifecycle

    public func start() throws {
        let parameters = NWParameters.tcp
        listener = try NWListener(using: parameters, on: NWEndpoint.Port(integerLiteral: UInt16(port)))

        listener?.stateUpdateHandler = { state in
            switch state {
            case .ready:
                Logger.info("Metrics server listening on port \(self.port)")
            case .failed(let error):
                Logger.error("Metrics server failed: \(error)")
            default:
                break
            }
        }

        listener?.newConnectionHandler = { [weak self] connection in
            self?.handleConnection(connection)
        }

        listener?.start(queue: .main)
    }

    public func stop() {
        listener?.cancel()
        listener = nil
    }

    // MARK: - Connection Handling

    private func handleConnection(_ connection: NWConnection) {
        connection.start(queue: .main)

        connection.receive(minimumIncompleteLength: 1, maximumLength: 65536) { [weak self] data, _, isComplete, error in
            if let data = data, let request = String(data: data, encoding: .utf8) {
                if request.contains("GET /metrics") {
                    self?.sendMetrics(connection: connection)
                }
            }

            if isComplete || error != nil {
                connection.cancel()
            }
        }
    }

    private func sendMetrics(connection: NWConnection) {
        let metricsText = generatePrometheusFormat()
        let response = """
        HTTP/1.1 200 OK\r
        Content-Type: text/plain; version=0.0.4\r
        Content-Length: \(metricsText.utf8.count)\r
        \r
        \(metricsText)
        """

        let data = response.data(using: .utf8)!
        connection.send(content: data, completion: .contentProcessed { _ in
            connection.cancel()
        })
    }

    // MARK: - Metrics Recording

    public func recordHostCount(_ count: Int) {
        setGauge(name: "vibecode_fleet_hosts_total", value: Double(count), help: "Total number of hosts in fleet")
    }

    public func recordContainerCount(_ count: Int) {
        setGauge(name: "vibecode_fleet_containers_total", value: Double(count), help: "Total number of containers")
    }

    public func recordFleetHealth(_ health: FleetHealth) {
        let value: Double = switch health {
        case .healthy: 1.0
        case .degraded: 0.5
        case .critical: 0.0
        case .unknown: -1.0
        }
        setGauge(name: "vibecode_fleet_health", value: value, help: "Fleet health status (1=healthy, 0.5=degraded, 0=critical)")
    }

    public func recordHostCapacity(host: MacHost) {
        let labels = ["host": host.hostname]
        setGauge(name: "vibecode_host_cpu_available_millicores", value: Double(host.availableCPU), labels: labels, help: "Available CPU in millicores")
        setGauge(name: "vibecode_host_memory_available_mb", value: Double(host.availableMemory), labels: labels, help: "Available memory in MB")
        setGauge(name: "vibecode_host_cpu_utilization", value: host.cpuUtilization, labels: labels, help: "CPU utilization ratio")
        setGauge(name: "vibecode_host_memory_utilization", value: host.memoryUtilization, labels: labels, help: "Memory utilization ratio")
    }

    public func recordMigration(duration: TimeInterval) {
        incrementCounter(name: "vibecode_container_migrations_total", help: "Total container migrations")
        observeHistogram(name: "vibecode_migration_duration_seconds", value: duration, help: "Container migration duration")
    }

    public func recordContainerStart() {
        incrementCounter(name: "vibecode_containers_started_total", help: "Total containers started")
    }

    public func recordContainerFailure() {
        incrementCounter(name: "vibecode_containers_failed_total", help: "Total container failures")
    }

    public func recordScalingEvent(type: String, count: Int) {
        let labels = ["type": type]
        incrementCounter(name: "vibecode_scaling_events_total", labels: labels, help: "Total scaling events")
        setGauge(name: "vibecode_scaling_count", value: Double(count), labels: labels, help: "Number of hosts added/removed")
    }

    // MARK: - Metric Types

    private func setGauge(name: String, value: Double, labels: [String: String] = [:], help: String) {
        metricsQueue.sync {
            metrics[name] = .gauge(value: value, labels: labels, help: help)
        }
    }

    private func incrementCounter(name: String, labels: [String: String] = [:], help: String) {
        metricsQueue.sync {
            if case .counter(let current, let currentLabels, let currentHelp) = metrics[name] {
                metrics[name] = .counter(value: current + 1, labels: labels.isEmpty ? currentLabels : labels, help: help.isEmpty ? currentHelp : help)
            } else {
                metrics[name] = .counter(value: 1, labels: labels, help: help)
            }
        }
    }

    private func observeHistogram(name: String, value: Double, labels: [String: String] = [:], help: String) {
        metricsQueue.sync {
            if case .histogram(var values, let currentLabels, let currentHelp) = metrics[name] {
                values.append(value)
                metrics[name] = .histogram(values: values, labels: labels.isEmpty ? currentLabels : labels, help: help.isEmpty ? currentHelp : help)
            } else {
                metrics[name] = .histogram(values: [value], labels: labels, help: help)
            }
        }
    }

    // MARK: - Prometheus Format

    private func generatePrometheusFormat() -> String {
        var output = ""

        metricsQueue.sync {
            for (name, metric) in metrics.sorted(by: { $0.key < $1.key }) {
                switch metric {
                case .gauge(let value, let labels, let help):
                    output += "# HELP \(name) \(help)\n"
                    output += "# TYPE \(name) gauge\n"
                    output += "\(name)\(formatLabels(labels)) \(value)\n"

                case .counter(let value, let labels, let help):
                    output += "# HELP \(name) \(help)\n"
                    output += "# TYPE \(name) counter\n"
                    output += "\(name)\(formatLabels(labels)) \(value)\n"

                case .histogram(let values, let labels, let help):
                    output += "# HELP \(name) \(help)\n"
                    output += "# TYPE \(name) histogram\n"

                    let buckets = [0.1, 0.5, 1.0, 5.0, 10.0, 30.0, 60.0]
                    for bucket in buckets {
                        let count = values.filter { $0 <= bucket }.count
                        var bucketLabels = labels
                        bucketLabels["le"] = "\(bucket)"
                        output += "\(name)_bucket\(formatLabels(bucketLabels)) \(count)\n"
                    }

                    var infLabels = labels
                    infLabels["le"] = "+Inf"
                    output += "\(name)_bucket\(formatLabels(infLabels)) \(values.count)\n"
                    output += "\(name)_sum\(formatLabels(labels)) \(values.reduce(0, +))\n"
                    output += "\(name)_count\(formatLabels(labels)) \(values.count)\n"
                }
            }
        }

        return output
    }

    private func formatLabels(_ labels: [String: String]) -> String {
        guard !labels.isEmpty else { return "" }

        let formatted = labels
            .map { "\($0.key)=\"\($0.value)\"" }
            .joined(separator: ",")

        return "{\(formatted)}"
    }
}

// MARK: - Metric Value

private enum MetricValue {
    case gauge(value: Double, labels: [String: String], help: String)
    case counter(value: Double, labels: [String: String], help: String)
    case histogram(values: [Double], labels: [String: String], help: String)
}

// Simple logger
private enum Logger {
    static func info(_ message: String) {
        print("[METRICS] [INFO] \(Date()) \(message)")
    }

    static func error(_ message: String) {
        print("[METRICS] [ERROR] \(Date()) \(message)")
    }
}
