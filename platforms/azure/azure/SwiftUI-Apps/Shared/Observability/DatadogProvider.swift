//
// DatadogProvider.swift
// VibeCode
//
// Created: 2025-11-25
// Migration Status: NEW
// Purpose: Datadog implementation of ObservabilityProvider protocol
//
// Part of refactoring effort: See REFACTORING-IN-PROGRESS.md
// Phase 2: Observability Unification
//

import Foundation
import os.log

// MARK: - Datadog Client Protocols (for dependency injection)

/// Protocol for DatadogLogger to enable testing
protocol DatadogLoggerProtocol {
    func log(_ level: String, _ message: String, _ attributes: [String: Any])
    func debug(_ message: String, _ attributes: [String: Any])
    func info(_ message: String, _ attributes: [String: Any])
    func warning(_ message: String, _ attributes: [String: Any])
    func error(_ message: String, _ attributes: [String: Any])
}

/// Protocol for DogStatsDClient to enable testing
protocol DogStatsDClientProtocol {
    func increment(_ metric: String, tags: [String])
    func gauge(_ metric: String, value: Double, tags: [String])
    func histogram(_ metric: String, value: Double, tags: [String])
}

// MARK: - Stub Implementations (for testing when actual clients unavailable)

/// Stub DatadogLogger for testing
class StubDatadogLogger: DatadogLoggerProtocol {
    func log(_ level: String, _ message: String, _ attributes: [String: Any] = [:]) {}
    func debug(_ message: String, _ attributes: [String: Any] = [:]) {}
    func info(_ message: String, _ attributes: [String: Any] = [:]) {}
    func warning(_ message: String, _ attributes: [String: Any] = [:]) {}
    func error(_ message: String, _ attributes: [String: Any] = [:]) {}
}

/// Stub DogStatsDClient for testing
class StubDogStatsDClient: DogStatsDClientProtocol {
    func increment(_ metric: String, tags: [String] = []) {}
    func gauge(_ metric: String, value: Double, tags: [String] = []) {}
    func histogram(_ metric: String, value: Double, tags: [String] = []) {}
}

/// Datadog implementation of ObservabilityProvider.
///
/// DatadogProvider wraps existing Datadog components (DatadogLogger, DogStatsDClient)
/// and implements distributed tracing using Datadog OTLP integration.
///
/// ## Features
///
/// - **Logging**: Uses DatadogLogger for structured JSON logging
/// - **Metrics**: Uses DogStatsDClient for StatsD metrics (counters, gauges, histograms)
/// - **Tracing**: Implements OpenTelemetry-compatible spans with Datadog OTLP export
/// - **Environment-based Configuration**: API keys from environment variables
///
/// ## Configuration
///
/// Required environment variables:
/// - `DD_API_KEY`: Datadog API key for OTLP trace export
///
/// Optional environment variables:
/// - `DD_SITE`: Datadog site (default: "datadoghq.com", options: "datadoghq.eu", "us3.datadoghq.com", etc.)
/// - `ENV`: Environment tag (default: "development")
///
/// ## Usage
///
/// ### Basic Usage
///
/// ```swift
/// let observability = DatadogProvider.shared
///
/// observability.info("VM started", ["vm_id": "abc-123", "memory_mb": 1024])
/// observability.increment("vm.start", tags: ["app:vibecode", "result:success"])
///
/// let span = observability.startSpan(name: "vm.operation", attributes: ["vm_id": "abc-123"])
/// // Do work...
/// span.end()
/// ```
///
/// ### With BaseVMManager
///
/// ```swift
/// final class ObservableVMManager: BaseVMManager {
///     private let observability: ObservabilityProvider
///
///     init(observability: ObservabilityProvider = DatadogProvider.shared) {
///         self.observability = observability
///         super.init()
///     }
///
///     override func onVMStarted() {
///         super.onVMStarted()
///         observability.info("VM started", ["vm_id": vmID])
///         observability.increment("vm.start", tags: ["result:success"])
///     }
///
///     override func onVMError(_ error: Error) {
///         super.onVMError(error)
///         observability.error("VM error", ["error": error.localizedDescription])
///         observability.increment("vm.error", tags: ["error_type:startup"])
///     }
/// }
/// ```
///
/// ### Distributed Tracing
///
/// ```swift
/// let observability = DatadogProvider.shared
///
/// let parentSpan = observability.startSpan(name: "vm.lifecycle", attributes: [
///     "vm_id": "abc-123",
///     "operation": "start"
/// ])
///
/// // Child operation
/// let childSpan = observability.startSpan(name: "vm.configure", parent: parentSpan, attributes: [
///     "cpu_count": 2,
///     "memory_mb": 1024
/// ])
/// childSpan.end()
///
/// parentSpan.end()
/// ```
///
final class DatadogProvider: ObservabilityProvider {

    // MARK: - Singleton

    /// Shared singleton instance (uses stub implementations in tests)
    static let shared = DatadogProvider(
        logger: StubDatadogLogger(),
        metrics: StubDogStatsDClient()
    )

    // MARK: - Dependencies

    private let logger: DatadogLoggerProtocol
    private let metrics: DogStatsDClientProtocol
    private let serviceName: String
    private let environment: String
    private let hostname: String
    private let otlpEndpoint: String
    private let apiKey: String?
    private let session: URLSession
    private let osLogger: Logger

    // MARK: - Initialization

    /// Initialize DatadogProvider with dependencies
    ///
    /// - Parameters:
    ///   - logger: DatadogLogger instance
    ///   - metrics: DogStatsDClient instance
    init(logger: DatadogLoggerProtocol, metrics: DogStatsDClientProtocol) {
        self.logger = logger
        self.metrics = metrics

        // Service metadata
        self.serviceName = "vibecode-swiftui"
        self.environment = ProcessInfo.processInfo.environment["ENV"] ?? "development"
        self.hostname = Host.current().name ?? "unknown"

        // Datadog OTLP endpoint configuration
        let ddSite = ProcessInfo.processInfo.environment["DD_SITE"] ?? "datadoghq.com"
        self.otlpEndpoint = "https://api.\(ddSite)/api/intake/otlp/v1/traces"

        // API key from environment
        self.apiKey = ProcessInfo.processInfo.environment["DD_API_KEY"]

        // URLSession for HTTP export
        self.session = URLSession(configuration: .default)

        // OS Logger
        self.osLogger = Logger(subsystem: "com.vibecode.observability", category: "datadog")

        // Log initialization
        if apiKey == nil {
            osLogger.warning("DatadogProvider: DD_API_KEY not set, traces will not be exported")
            logger.warning("DatadogProvider: DD_API_KEY not set, traces will not be exported", [:])
        } else {
            osLogger.info("DatadogProvider initialized: service=\(self.serviceName), endpoint=\(self.otlpEndpoint)")
            logger.info("DatadogProvider initialized", [
                "service": serviceName,
                "environment": environment,
                "hostname": hostname,
                "otlp_endpoint": otlpEndpoint
            ])
        }
    }

    // MARK: - Logging

    func log(level: LogLevel, message: String, attributes: [String: Any]) {
        let levelString: String
        switch level {
        case .debug: levelString = "debug"
        case .info: levelString = "info"
        case .warn: levelString = "warning"
        case .error: levelString = "error"
        }

        logger.log(levelString, message, attributes)
    }

    func debug(_ message: String, _ attributes: [String: Any]) {
        logger.debug(message, attributes)
    }

    func info(_ message: String, _ attributes: [String: Any]) {
        logger.info(message, attributes)
    }

    func warn(_ message: String, _ attributes: [String: Any]) {
        logger.warning(message, attributes)
    }

    func error(_ message: String, _ attributes: [String: Any]) {
        logger.error(message, attributes)
    }

    // MARK: - Metrics

    func increment(_ metric: String, tags: [String]) {
        metrics.increment(metric, tags: tags)
    }

    func gauge(_ metric: String, value: Double, tags: [String]) {
        metrics.gauge(metric, value: value, tags: tags)
    }

    func histogram(_ metric: String, value: Double, tags: [String]) {
        metrics.histogram(metric, value: value, tags: tags)
    }

    // MARK: - Tracing

    func startSpan(name: String, attributes: [String: Any]) -> SpanContext {
        let spanContext = DatadogSpanContext(
            name: name,
            traceID: generateTraceID(),
            spanID: generateSpanID(),
            parentSpanID: nil,
            attributes: attributes,
            provider: self
        )

        osLogger.debug("Span started: \(name) trace_id=\(spanContext.traceID) span_id=\(spanContext.spanID)")

        return spanContext
    }

    func startSpan(name: String, parent: SpanContext, attributes: [String: Any]) -> SpanContext {
        let spanContext = DatadogSpanContext(
            name: name,
            traceID: parent.traceID,
            spanID: generateSpanID(),
            parentSpanID: parent.spanID,
            attributes: attributes,
            provider: self
        )

        osLogger.debug("Child span started: \(name) trace_id=\(spanContext.traceID) span_id=\(spanContext.spanID) parent_span_id=\(parent.spanID)")

        return spanContext
    }

    // MARK: - Internal Span Export

    internal func exportSpan(_ span: DatadogSpanContext) {
        guard let apiKey = apiKey else {
            osLogger.warning("Span not exported: DD_API_KEY not configured")
            return
        }

        let durationNanos = Int64((span.endTime.timeIntervalSince(span.startTime)) * 1_000_000_000)

        osLogger.debug("Exporting span: \(span.name) duration_ms=\(durationNanos / 1_000_000)")

        // Build OTLP JSON payload
        let payload: [String: Any] = [
            "resourceSpans": [
                [
                    "resource": [
                        "attributes": [
                            ["key": "service.name", "value": ["stringValue": serviceName]],
                            ["key": "service.environment", "value": ["stringValue": environment]],
                            ["key": "host.name", "value": ["stringValue": hostname]]
                        ]
                    ],
                    "scopeSpans": [
                        [
                            "scope": [
                                "name": "vibecode-datadog-provider",
                                "version": "1.0.0"
                            ],
                            "spans": [
                                [
                                    "traceId": span.traceID,
                                    "spanId": span.spanID,
                                    "parentSpanId": span.parentSpanID ?? "",
                                    "name": span.name,
                                    "kind": 1, // Internal
                                    "startTimeUnixNano": String(span.startTime.timeIntervalSince1970Nanos),
                                    "endTimeUnixNano": String(span.endTime.timeIntervalSince1970Nanos),
                                    "attributes": buildOTLPAttributes(span.getAllAttributes()),
                                    "events": span.events.map { event in
                                        [
                                            "name": event.name,
                                            "timeUnixNano": String(event.timeUnixNano),
                                            "attributes": buildOTLPAttributes(event.attributes)
                                        ]
                                    },
                                    "status": [
                                        "code": span.error != nil ? 2 : 1 // 2 = ERROR, 1 = OK
                                    ]
                                ]
                            ]
                        ]
                    ]
                ]
            ]
        ]

        // Serialize to JSON
        guard let jsonData = try? JSONSerialization.data(withJSONObject: payload) else {
            osLogger.error("Failed to serialize OTLP payload")
            return
        }

        // Create HTTP request
        guard let url = URL(string: otlpEndpoint) else {
            osLogger.error("Invalid OTLP endpoint URL")
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue(apiKey, forHTTPHeaderField: "dd-api-key")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = jsonData

        // Send request asynchronously
        let task = session.dataTask(with: request) { [weak self] data, response, error in
            guard let self = self else { return }

            if let error = error {
                self.osLogger.error("OTLP export failed: \(error.localizedDescription)")
                return
            }

            if let httpResponse = response as? HTTPURLResponse {
                if httpResponse.statusCode >= 200 && httpResponse.statusCode < 300 {
                    self.osLogger.info("OTLP span exported: \(span.name) (\(httpResponse.statusCode))")
                } else {
                    self.osLogger.error("OTLP export error: HTTP \(httpResponse.statusCode)")
                    if let data = data, let body = String(data: data, encoding: .utf8) {
                        self.osLogger.error("OTLP response: \(body)")
                    }
                }
            }
        }

        task.resume()
    }

    // MARK: - Helper Methods

    private func generateTraceID() -> String {
        // 128-bit trace ID (32 hex chars)
        let uuid = UUID().uuidString.replacingOccurrences(of: "-", with: "")
        return String(uuid.prefix(32))
    }

    private func generateSpanID() -> String {
        // 64-bit span ID (16 hex chars)
        let uuid = UUID().uuidString.replacingOccurrences(of: "-", with: "")
        return String(uuid.prefix(16))
    }

    private func buildOTLPAttributes(_ attrs: [String: Any]) -> [[String: Any]] {
        return attrs.map { key, value in
            var attrDict: [String: Any] = ["key": key]

            // Map Swift types to OTLP attribute values
            if let stringValue = value as? String {
                attrDict["value"] = ["stringValue": stringValue]
            } else if let intValue = value as? Int {
                attrDict["value"] = ["intValue": String(intValue)]
            } else if let doubleValue = value as? Double {
                attrDict["value"] = ["doubleValue": doubleValue]
            } else if let boolValue = value as? Bool {
                attrDict["value"] = ["boolValue": boolValue]
            } else {
                // Fallback: convert to string
                attrDict["value"] = ["stringValue": String(describing: value)]
            }

            return attrDict
        }
    }
}

// MARK: - DatadogSpanContext

/// Span context implementation for Datadog tracing.
///
/// DatadogSpanContext represents a single unit of work in a distributed trace.
/// It tracks timing, attributes, events, and errors, and exports to Datadog via OTLP.
final class DatadogSpanContext: SpanContext {

    // MARK: - Properties

    let name: String
    let spanID: String
    let traceID: String
    let parentSpanID: String?
    let startTime: Date
    private(set) var endTime: Date
    private var attributes: [String: Any]
    private(set) var events: [(name: String, timeUnixNano: Int64, attributes: [String: Any])] = []
    private(set) var error: Error?
    private var isEnded = false
    private weak var provider: DatadogProvider?

    // MARK: - Initialization

    init(
        name: String,
        traceID: String,
        spanID: String,
        parentSpanID: String?,
        attributes: [String: Any],
        provider: DatadogProvider
    ) {
        self.name = name
        self.traceID = traceID
        self.spanID = spanID
        self.parentSpanID = parentSpanID
        self.startTime = Date()
        self.endTime = Date()
        self.attributes = attributes
        self.provider = provider
    }

    // MARK: - SpanContext Protocol

    func setAttribute(key: String, value: Any) {
        attributes[key] = value
    }

    func addEvent(name: String, attributes: [String: Any]) {
        let event = (
            name: name,
            timeUnixNano: Date().timeIntervalSince1970Nanos,
            attributes: attributes
        )
        events.append(event)
    }

    func setError(_ error: Error) {
        self.error = error
        setAttribute(key: "error.type", value: String(describing: type(of: error)))
        setAttribute(key: "error.message", value: error.localizedDescription)
    }

    func end() {
        guard !isEnded else { return }

        isEnded = true
        endTime = Date()

        // Export span to Datadog
        provider?.exportSpan(self)
    }

    // MARK: - Internal Helpers

    func getAllAttributes() -> [String: Any] {
        return attributes
    }
}

// MARK: - Date Extension

private extension Date {
    /// Convert Date to Unix nanoseconds (required by OTLP)
    var timeIntervalSince1970Nanos: Int64 {
        return Int64(self.timeIntervalSince1970 * 1_000_000_000)
    }
}
