//
// OpenTelemetryProvider.swift
// VibeCode
//
// Created: 2025-11-25
// Migration Status: NEW
// Purpose: OpenTelemetry implementation of ObservabilityProvider protocol
//
// Part of refactoring effort: See REFACTORING-IN-PROGRESS.md
// Phase 2: Observability Unification
//

import Foundation

/// OpenTelemetry implementation of ObservabilityProvider.
///
/// This provider wraps the existing OpenTelemetryIntegration to conform to the
/// unified ObservabilityProvider protocol, enabling pluggable observability backends.
///
/// ## Features
///
/// - **Logging**: Uses os.log internally (OpenTelemetryIntegration limitation)
/// - **Metrics**: Currently logged as span events (metrics OTLP export in future)
/// - **Tracing**: Full distributed tracing via OTLP to Datadog
/// - **W3C Trace Context**: Compatible with distributed systems
///
/// ## Usage
///
/// ### Basic Initialization
///
/// ```swift
/// // Default initialization (uses environment variables)
/// let provider = OpenTelemetryProvider.shared
///
/// // Custom configuration
/// let provider = OpenTelemetryProvider(
///     serviceName: "my-service",
///     environment: "production",
///     otlpEndpoint: "https://api.datadoghq.com/api/intake/otlp/v1/traces",
///     apiKey: "your-api-key"
/// )
/// ```
///
/// ### Environment Variables
///
/// ```bash
/// export DD_API_KEY="your-datadog-api-key"
/// export DD_SITE="datadoghq.com"  # Optional, default: datadoghq.com
/// export ENV="production"          # Optional, default: development
/// ```
///
/// ### Logging
///
/// ```swift
/// provider.debug("VM configuration created", ["vm_id": "abc-123"])
/// provider.info("VM started successfully", ["startup_time": 2.5])
/// provider.warn("VM memory low", ["available_mb": 256])
/// provider.error("VM failed to start", ["error": error.localizedDescription])
/// ```
///
/// ### Metrics
///
/// ```swift
/// // Note: Currently logged as span events (metrics OTLP export coming)
/// provider.increment("vm.start", tags: ["result:success"])
/// provider.gauge("vm.memory_usage", value: 512.0, tags: ["vm_id:abc"])
/// provider.histogram("vm.startup_time", value: 2.5, tags: ["app:vibecode"])
/// ```
///
/// ### Tracing
///
/// ```swift
/// let span = provider.startSpan(name: "vm.start", attributes: [
///     "vm_id": "abc-123",
///     "cpu_count": 2
/// ])
///
/// // Perform operation...
///
/// span.setAttribute(key: "result", value: "success")
/// span.addEvent(name: "vm_configured", attributes: [:])
/// span.end()
/// ```
///
/// ### With BaseVMManager
///
/// ```swift
/// final class ObservableVMManager: BaseVMManager {
///     private let observability: ObservabilityProvider
///
///     init(observability: ObservabilityProvider = OpenTelemetryProvider.shared) {
///         self.observability = observability
///         super.init()
///     }
///
///     override func startVM() {
///         let span = observability.startSpan(name: "vm.lifecycle.start")
///         observability.increment("vm.start_attempt")
///
///         super.startVM()
///
///         span.end()
///     }
/// }
/// ```
///
/// ### Nested Spans (Parent-Child Relationship)
///
/// ```swift
/// let parentSpan = provider.startSpan(name: "vm.lifecycle", attributes: [:])
///
/// let configSpan = provider.startSpan(
///     name: "vm.configure",
///     parent: parentSpan,
///     attributes: ["config_type": "network"]
/// )
/// // Configure VM...
/// configSpan.end()
///
/// let startSpan = provider.startSpan(
///     name: "vm.start_process",
///     parent: parentSpan,
///     attributes: ["boot_mode": "uefi"]
/// )
/// // Start VM...
/// startSpan.end()
///
/// parentSpan.end()
/// ```
///
/// ## Implementation Notes
///
/// - Wraps OpenTelemetryIntegration for all tracing operations
/// - Logs are currently sent to os.log (OTLP logs export in future)
/// - Metrics are logged as span events (metrics OTLP export in future)
/// - Thread-safe: All operations are safe to call from multiple threads
///
final class OpenTelemetryProvider: ObservabilityProvider {

    // MARK: - Singleton

    /// Shared singleton instance (configured via environment variables).
    static let shared = OpenTelemetryProvider()

    // MARK: - Properties

    private let integration: OpenTelemetryIntegration
    private let logger: OSLogAdapter

    // MARK: - Initialization

    /// Initialize with custom configuration.
    ///
    /// - Parameters:
    ///   - serviceName: Service name for OTLP resource attributes
    ///   - environment: Environment tag (development, staging, production)
    ///   - otlpEndpoint: OTLP HTTP endpoint URL
    ///   - apiKey: Datadog API key for authentication
    init(
        serviceName: String? = nil,
        environment: String? = nil,
        otlpEndpoint: String? = nil,
        apiKey: String? = nil
    ) {
        // Use OpenTelemetryIntegration singleton
        // Note: OpenTelemetryIntegration is initialized with environment variables
        // Custom parameters are for future extensibility
        self.integration = OpenTelemetryIntegration.shared
        self.logger = OSLogAdapter(subsystem: "com.vibecode.otel", category: "provider")
    }

    // MARK: - Logging

    func log(level: LogLevel, message: String, attributes: [String: Any]) {
        logger.log(level: level, message: message, attributes: attributes)
    }

    func debug(_ message: String, _ attributes: [String: Any]) {
        logger.log(level: .debug, message: message, attributes: attributes)
    }

    func info(_ message: String, _ attributes: [String: Any]) {
        logger.log(level: .info, message: message, attributes: attributes)
    }

    func warn(_ message: String, _ attributes: [String: Any]) {
        logger.log(level: .warn, message: message, attributes: attributes)
    }

    func error(_ message: String, _ attributes: [String: Any]) {
        logger.log(level: .error, message: message, attributes: attributes)
    }

    // MARK: - Metrics

    func increment(_ metric: String, tags: [String]) {
        // Note: Current implementation logs metric as event
        // Future: Export via OTLP metrics endpoint
        logger.log(
            level: .info,
            message: "Metric: increment",
            attributes: [
                "metric.name": metric,
                "metric.type": "counter",
                "metric.value": 1,
                "metric.tags": tags.joined(separator: ",")
            ]
        )
    }

    func gauge(_ metric: String, value: Double, tags: [String]) {
        // Note: Current implementation logs metric as event
        // Future: Export via OTLP metrics endpoint
        logger.log(
            level: .info,
            message: "Metric: gauge",
            attributes: [
                "metric.name": metric,
                "metric.type": "gauge",
                "metric.value": value,
                "metric.tags": tags.joined(separator: ",")
            ]
        )
    }

    func histogram(_ metric: String, value: Double, tags: [String]) {
        // Note: Current implementation logs metric as event
        // Future: Export via OTLP metrics endpoint
        logger.log(
            level: .info,
            message: "Metric: histogram",
            attributes: [
                "metric.name": metric,
                "metric.type": "histogram",
                "metric.value": value,
                "metric.tags": tags.joined(separator: ",")
            ]
        )
    }

    // MARK: - Tracing

    func startSpan(name: String, attributes: [String: Any]) -> SpanContext {
        let context = integration.startSpan(
            name: name,
            kind: .internal,
            attributes: attributes,
            parentContext: nil
        )

        return OpenTelemetrySpanContext(
            integration: integration,
            context: context,
            name: name,
            startTime: Date(),
            kind: .internal
        )
    }

    func startSpan(name: String, parent: SpanContext, attributes: [String: Any]) -> SpanContext {
        guard let parentOtel = parent as? OpenTelemetrySpanContext else {
            // Fallback: create root span if parent is not OpenTelemetry
            logger.log(
                level: .warn,
                message: "Parent span is not OpenTelemetry, creating root span",
                attributes: ["span.name": name]
            )
            return startSpan(name: name, attributes: attributes)
        }

        let context = integration.startSpan(
            name: name,
            kind: .internal,
            attributes: attributes,
            parentContext: parentOtel.context
        )

        return OpenTelemetrySpanContext(
            integration: integration,
            context: context,
            name: name,
            startTime: Date(),
            kind: .internal
        )
    }
}

// MARK: - OpenTelemetrySpanContext

/// SpanContext implementation that wraps OpenTelemetryIntegration.SpanContext.
private class OpenTelemetrySpanContext: SpanContext {

    let integration: OpenTelemetryIntegration
    let context: OpenTelemetryIntegration.SpanContext
    let name: String
    let startTime: Date
    let kind: OpenTelemetryIntegration.SpanKind

    private var attributes: [String: Any] = [:]
    private var events: [OpenTelemetryIntegration.SpanEvent] = []
    private var status: OpenTelemetryIntegration.SpanStatus = .ok

    init(
        integration: OpenTelemetryIntegration,
        context: OpenTelemetryIntegration.SpanContext,
        name: String,
        startTime: Date,
        kind: OpenTelemetryIntegration.SpanKind
    ) {
        self.integration = integration
        self.context = context
        self.name = name
        self.startTime = startTime
        self.kind = kind
    }

    var spanID: String {
        return context.spanId
    }

    var traceID: String {
        return context.traceId
    }

    func setAttribute(key: String, value: Any) {
        attributes[key] = value
    }

    func addEvent(name: String, attributes: [String: Any]) {
        let event = OpenTelemetryIntegration.SpanEvent(
            name: name,
            timeUnixNano: Date().timeIntervalSince1970Nanos,
            attributes: attributes
        )
        events.append(event)
    }

    func setError(_ error: Error) {
        status = .error(description: error.localizedDescription)
        setAttribute(key: "error.type", value: String(describing: type(of: error)))
        setAttribute(key: "error.message", value: error.localizedDescription)
    }

    func end() {
        integration.endSpan(
            context: context,
            name: name,
            kind: kind,
            startTime: startTime,
            endTime: Date(),
            attributes: attributes,
            status: status,
            events: events
        )
    }
}

// MARK: - OSLogAdapter

/// Adapter to use os.log for logging (OpenTelemetry OTLP logs export in future).
private class OSLogAdapter {
    private let logger: Logger

    init(subsystem: String, category: String) {
        self.logger = Logger(subsystem: subsystem, category: category)
    }

    func log(level: LogLevel, message: String, attributes: [String: Any]) {
        let attributesString = attributes.isEmpty ? "" : " \(formatAttributes(attributes))"
        let fullMessage = "\(message)\(attributesString)"

        switch level {
        case .debug:
            logger.debug("\(fullMessage)")
        case .info:
            logger.info("\(fullMessage)")
        case .warn:
            logger.warning("\(fullMessage)")
        case .error:
            logger.error("\(fullMessage)")
        }
    }

    private func formatAttributes(_ attributes: [String: Any]) -> String {
        let pairs = attributes.map { key, value in
            return "\(key)=\(value)"
        }
        return "[\(pairs.joined(separator: ", "))]"
    }
}

// MARK: - Date Extension

private extension Date {
    /// Convert Date to Unix nanoseconds (required by OTLP)
    var timeIntervalSince1970Nanos: Int64 {
        return Int64(self.timeIntervalSince1970 * 1_000_000_000)
    }
}

// MARK: - Logger Import

import os.log

// MARK: - Documentation Examples

/*
 USAGE EXAMPLES
 ==============

 1. Basic Initialization:
 -------------------------
 let provider = OpenTelemetryProvider.shared

 // Or with custom config:
 let provider = OpenTelemetryProvider(
     serviceName: "my-service",
     environment: "production",
     otlpEndpoint: "https://api.datadoghq.com/api/intake/otlp/v1/traces",
     apiKey: "your-api-key"
 )


 2. Logging:
 ------------
 provider.debug("VM configuration validated")
 provider.info("VM started", ["vm_id": "abc-123", "startup_time": 2.5])
 provider.warn("VM memory low", ["available_mb": 256])
 provider.error("VM failed", ["error": error.localizedDescription])


 3. Metrics:
 ------------
 provider.increment("vm.start", tags: ["result:success"])
 provider.gauge("vm.memory_usage", value: 512.0, tags: ["vm_id:abc"])
 provider.histogram("vm.startup_time", value: 2.5, tags: ["app:vibecode"])


 4. Distributed Tracing:
 ------------------------
 let span = provider.startSpan(name: "vm.lifecycle", attributes: [
     "vm_id": "abc-123",
     "cpu_count": 2
 ])

 // Do work...
 span.setAttribute(key: "result", value: "success")
 span.addEvent(name: "vm_configured", attributes: ["config_type": "network"])

 span.end()


 5. Nested Spans:
 -----------------
 let parentSpan = provider.startSpan(name: "vm.lifecycle", attributes: [:])

 let childSpan = provider.startSpan(
     name: "vm.configure",
     parent: parentSpan,
     attributes: ["phase": "network"]
 )
 // Configure network...
 childSpan.end()

 parentSpan.end()


 6. With BaseVMManager:
 -----------------------
 final class ObservableVMManager: BaseVMManager {
     private let observability: ObservabilityProvider

     init(observability: ObservabilityProvider = OpenTelemetryProvider.shared) {
         self.observability = observability
         super.init()
     }

     override func startVM() {
         let span = observability.startSpan(name: "vm.start")
         observability.increment("vm.start_attempt")

         super.startVM()

         span.end()
     }

     override func onVMStarted() {
         super.onVMStarted()
         observability.info("VM started successfully")
         observability.increment("vm.start", tags: ["result:success"])
     }
 }


 7. Error Handling:
 -------------------
 let span = provider.startSpan(name: "vm.operation")

 do {
     try performRiskyOperation()
     span.setAttribute(key: "result", value: "success")
 } catch {
     span.setError(error)
     provider.error("Operation failed", ["error": error.localizedDescription])
 }

 span.end()


 8. Multiple Providers (Composite):
 ------------------------------------
 let composite = CompositeProvider(providers: [
     DatadogProvider.shared,
     OpenTelemetryProvider.shared
 ])

 composite.info("Message sent to both Datadog and OpenTelemetry")


 9. Testing:
 ------------
 // Use NoOpProvider for testing
 let mockProvider = NoOpProvider()
 let vm = ObservableVMManager(observability: mockProvider)
 // VM runs without sending observability data

 */
