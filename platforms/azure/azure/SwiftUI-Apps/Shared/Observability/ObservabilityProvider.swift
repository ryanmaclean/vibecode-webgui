//
// ObservabilityProvider.swift
// VibeCode
//
// Created: 2025-11-25
// Migration Status: NEW
// Purpose: Protocol for unified observability (logging, metrics, tracing)
//
// Part of refactoring effort: See REFACTORING-IN-PROGRESS.md
// Phase 2: Observability Unification
//

import Foundation

/// Protocol for observability providers (logging, metrics, tracing).
///
/// ObservabilityProvider defines a unified interface for observability backends like:
/// - Datadog (DatadogLogger + DogStatsDClient)
/// - OpenTelemetry (OpenTelemetryIntegration)
/// - Custom backends (Prometheus, Honeycomb, etc.)
/// - Mock providers for testing
///
/// ## Features
///
/// - **Logging**: Structured logging with levels (debug, info, warn, error)
/// - **Metrics**: Counters, gauges, histograms with tags
/// - **Tracing**: Distributed tracing with spans
/// - **Pluggable**: Multiple implementations, swappable backends
///
/// ## Usage
///
/// ### Basic Logging
///
/// ```swift
/// let observability: ObservabilityProvider = DatadogProvider.shared
///
/// observability.info("VM started", ["vm_id": "abc-123", "memory_mb": 1024])
/// observability.error("VM failed", ["error": error.localizedDescription])
/// ```
///
/// ### Metrics
///
/// ```swift
/// observability.increment("vm.start", tags: ["app:vibecode", "result:success"])
/// observability.gauge("vm.memory_usage", value: 512.0, tags: ["vm_id:abc"])
/// observability.histogram("vm.startup_time", value: 2.5, tags: ["app:vibecode"])
/// ```
///
/// ### Tracing
///
/// ```swift
/// let span = observability.startSpan(name: "vm.operation", attributes: [
///     "operation": "start",
///     "vm_id": "abc-123"
/// ])
///
/// // Do work...
///
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
protocol ObservabilityProvider {

    // MARK: - Logging

    /// Log a message with a specific level.
    ///
    /// - Parameters:
    ///   - level: Log level (debug, info, warn, error)
    ///   - message: Log message
    ///   - attributes: Structured attributes (e.g., ["vm_id": "123", "memory": 1024])
    func log(level: LogLevel, message: String, attributes: [String: Any])

    /// Log a debug message.
    ///
    /// Use for verbose diagnostic information useful during development.
    ///
    /// Example:
    /// ```swift
    /// observability.debug("DHCP lease updated", ["ip": "192.168.64.5", "mac": "52:54:00:12:34:90"])
    /// ```
    func debug(_ message: String, _ attributes: [String: Any])

    /// Log an info message.
    ///
    /// Use for general informational messages about application flow.
    ///
    /// Example:
    /// ```swift
    /// observability.info("VM started", ["vm_id": "abc-123", "cpu_count": 2])
    /// ```
    func info(_ message: String, _ attributes: [String: Any])

    /// Log a warning message.
    ///
    /// Use for potentially problematic situations that aren't errors.
    ///
    /// Example:
    /// ```swift
    /// observability.warn("VM memory low", ["available_mb": 256, "requested_mb": 512])
    /// ```
    func warn(_ message: String, _ attributes: [String: Any])

    /// Log an error message.
    ///
    /// Use for error conditions that need attention.
    ///
    /// Example:
    /// ```swift
    /// observability.error("VM failed to start", ["error": error.localizedDescription])
    /// ```
    func error(_ message: String, _ attributes: [String: Any])

    // MARK: - Metrics

    /// Increment a counter metric.
    ///
    /// Counters are cumulative metrics that only increase (e.g., total requests, errors).
    ///
    /// - Parameters:
    ///   - metric: Metric name (e.g., "vm.start", "app.launch")
    ///   - tags: Tags for filtering (e.g., ["app:vibecode", "result:success"])
    ///
    /// Example:
    /// ```swift
    /// observability.increment("vm.start", tags: ["app:vibecode", "result:success"])
    /// ```
    func increment(_ metric: String, tags: [String])

    /// Record a gauge metric (current value at a point in time).
    ///
    /// Gauges represent values that can go up or down (e.g., memory usage, CPU %).
    ///
    /// - Parameters:
    ///   - metric: Metric name (e.g., "vm.memory_usage", "cpu.percent")
    ///   - value: Current value
    ///   - tags: Tags for filtering
    ///
    /// Example:
    /// ```swift
    /// observability.gauge("vm.memory_usage", value: 512.0, tags: ["vm_id:abc", "unit:mb"])
    /// ```
    func gauge(_ metric: String, value: Double, tags: [String])

    /// Record a histogram metric (distribution of values).
    ///
    /// Histograms track distributions (e.g., request duration, file sizes).
    ///
    /// - Parameters:
    ///   - metric: Metric name (e.g., "vm.startup_time", "request.duration")
    ///   - value: Measured value
    ///   - tags: Tags for filtering
    ///
    /// Example:
    /// ```swift
    /// observability.histogram("vm.startup_time", value: 2.5, tags: ["app:vibecode"])
    /// ```
    func histogram(_ metric: String, value: Double, tags: [String])

    // MARK: - Tracing

    /// Start a new trace span.
    ///
    /// Spans represent units of work in distributed tracing.
    /// Always call `span.end()` when the operation completes.
    ///
    /// - Parameters:
    ///   - name: Span name (e.g., "vm.operation", "http.request")
    ///   - attributes: Span attributes
    /// - Returns: SpanContext to end the span later
    ///
    /// Example:
    /// ```swift
    /// let span = observability.startSpan(name: "vm.start", attributes: [
    ///     "vm_id": "abc-123",
    ///     "cpu_count": 2
    /// ])
    ///
    /// // Do work...
    ///
    /// span.end()
    /// ```
    func startSpan(name: String, attributes: [String: Any]) -> SpanContext

    /// Start a child span (nested within another span).
    ///
    /// - Parameters:
    ///   - name: Span name
    ///   - parent: Parent span context
    ///   - attributes: Span attributes
    /// - Returns: Child span context
    ///
    /// Example:
    /// ```swift
    /// let parentSpan = observability.startSpan(name: "vm.lifecycle", attributes: [:])
    /// let childSpan = observability.startSpan(name: "vm.configure", parent: parentSpan, attributes: [:])
    /// childSpan.end()
    /// parentSpan.end()
    /// ```
    func startSpan(name: String, parent: SpanContext, attributes: [String: Any]) -> SpanContext
}

// MARK: - Supporting Types

/// Log levels for structured logging.
enum LogLevel: String {
    case debug = "DEBUG"
    case info = "INFO"
    case warn = "WARN"
    case error = "ERROR"

    /// Numeric value for comparison (debug=0, info=1, warn=2, error=3)
    var numericValue: Int {
        switch self {
        case .debug: return 0
        case .info: return 1
        case .warn: return 2
        case .error: return 3
        }
    }
}

/// Context for a trace span.
///
/// Used to correlate related operations in distributed tracing.
/// Always call `end()` when the operation completes.
protocol SpanContext {
    /// Span ID (unique identifier)
    var spanID: String { get }

    /// Trace ID (shared across related spans)
    var traceID: String { get }

    /// Add an attribute to the span
    func setAttribute(key: String, value: Any)

    /// Add an event to the span (timestamped annotation)
    func addEvent(name: String, attributes: [String: Any])

    /// Mark span as error
    func setError(_ error: Error)

    /// End the span (records duration)
    func end()
}

// MARK: - Default Implementations (Protocol Extensions)

extension ObservabilityProvider {

    /// Log with empty attributes (convenience).
    func debug(_ message: String) {
        debug(message, [:])
    }

    /// Log with empty attributes (convenience).
    func info(_ message: String) {
        info(message, [:])
    }

    /// Log with empty attributes (convenience).
    func warn(_ message: String) {
        warn(message, [:])
    }

    /// Log with empty attributes (convenience).
    func error(_ message: String) {
        error(message, [:])
    }

    /// Increment with no tags (convenience).
    func increment(_ metric: String) {
        increment(metric, tags: [])
    }

    /// Record gauge with no tags (convenience).
    func gauge(_ metric: String, value: Double) {
        gauge(metric, value: value, tags: [])
    }

    /// Record histogram with no tags (convenience).
    func histogram(_ metric: String, value: Double) {
        histogram(metric, value: value, tags: [])
    }

    /// Start span with no attributes (convenience).
    func startSpan(name: String) -> SpanContext {
        startSpan(name: name, attributes: [:])
    }

    /// Convenience: log debug level
    func log(level: LogLevel, message: String) {
        log(level: level, message: message, attributes: [:])
    }
}

// MARK: - Composite Provider (Multiple Backends)

/// Composite provider that sends to multiple backends simultaneously.
///
/// Use this to send observability data to multiple destinations:
/// - Datadog for production monitoring
/// - OpenTelemetry for distributed tracing
/// - Local logging for development
///
/// Example:
/// ```swift
/// let composite = CompositeProvider(providers: [
///     DatadogProvider.shared,
///     OpenTelemetryProvider.shared,
///     ConsoleProvider()  // Local development
/// ])
///
/// composite.info("Message sent to all providers")
/// ```
class CompositeProvider: ObservabilityProvider {
    private let providers: [ObservabilityProvider]

    init(providers: [ObservabilityProvider]) {
        self.providers = providers
    }

    func log(level: LogLevel, message: String, attributes: [String: Any]) {
        providers.forEach { $0.log(level: level, message: message, attributes: attributes) }
    }

    func debug(_ message: String, _ attributes: [String: Any]) {
        providers.forEach { $0.debug(message, attributes) }
    }

    func info(_ message: String, _ attributes: [String: Any]) {
        providers.forEach { $0.info(message, attributes) }
    }

    func warn(_ message: String, _ attributes: [String: Any]) {
        providers.forEach { $0.warn(message, attributes) }
    }

    func error(_ message: String, _ attributes: [String: Any]) {
        providers.forEach { $0.error(message, attributes) }
    }

    func increment(_ metric: String, tags: [String]) {
        providers.forEach { $0.increment(metric, tags: tags) }
    }

    func gauge(_ metric: String, value: Double, tags: [String]) {
        providers.forEach { $0.gauge(metric, value: value, tags: tags) }
    }

    func histogram(_ metric: String, value: Double, tags: [String]) {
        providers.forEach { $0.histogram(metric, value: value, tags: tags) }
    }

    func startSpan(name: String, attributes: [String: Any]) -> SpanContext {
        let spans = providers.map { $0.startSpan(name: name, attributes: attributes) }
        return CompositeSpanContext(spans: spans)
    }

    func startSpan(name: String, parent: SpanContext, attributes: [String: Any]) -> SpanContext {
        let spans = providers.map { $0.startSpan(name: name, parent: parent, attributes: attributes) }
        return CompositeSpanContext(spans: spans)
    }
}

/// Composite span context that forwards to multiple backends.
class CompositeSpanContext: SpanContext {
    private let spans: [SpanContext]

    var spanID: String { spans.first?.spanID ?? "" }
    var traceID: String { spans.first?.traceID ?? "" }

    init(spans: [SpanContext]) {
        self.spans = spans
    }

    func setAttribute(key: String, value: Any) {
        spans.forEach { $0.setAttribute(key: key, value: value) }
    }

    func addEvent(name: String, attributes: [String: Any]) {
        spans.forEach { $0.addEvent(name: name, attributes: attributes) }
    }

    func setError(_ error: Error) {
        spans.forEach { $0.setError(error) }
    }

    func end() {
        spans.forEach { $0.end() }
    }
}

// MARK: - No-Op Provider (Testing)

/// No-op observability provider (does nothing).
///
/// Use for testing or when observability is disabled.
///
/// Example:
/// ```swift
/// let provider = NoOpProvider()
/// provider.info("This message goes nowhere")  // No-op
/// ```
class NoOpProvider: ObservabilityProvider {
    func log(level: LogLevel, message: String, attributes: [String: Any]) {}
    func debug(_ message: String, _ attributes: [String: Any]) {}
    func info(_ message: String, _ attributes: [String: Any]) {}
    func warn(_ message: String, _ attributes: [String: Any]) {}
    func error(_ message: String, _ attributes: [String: Any]) {}
    func increment(_ metric: String, tags: [String]) {}
    func gauge(_ metric: String, value: Double, tags: [String]) {}
    func histogram(_ metric: String, value: Double, tags: [String]) {}

    func startSpan(name: String, attributes: [String: Any]) -> SpanContext {
        return NoOpSpanContext()
    }

    func startSpan(name: String, parent: SpanContext, attributes: [String: Any]) -> SpanContext {
        return NoOpSpanContext()
    }
}

/// No-op span context (does nothing).
class NoOpSpanContext: SpanContext {
    var spanID: String = ""
    var traceID: String = ""
    func setAttribute(key: String, value: Any) {}
    func addEvent(name: String, attributes: [String: Any]) {}
    func setError(_ error: Error) {}
    func end() {}
}

// MARK: - Documentation Examples

/*
 USAGE EXAMPLES
 ==============

 1. Basic logging:
 ------------------
 let observability: ObservabilityProvider = DatadogProvider.shared

 observability.debug("VM configuration created")
 observability.info("VM started", ["vm_id": "abc-123"])
 observability.warn("Memory low", ["available": 256])
 observability.error("VM crashed", ["error": error.localizedDescription])


 2. Metrics:
 ------------
 observability.increment("vm.start", tags: ["result:success"])
 observability.gauge("vm.memory_usage", value: 512.0, tags: ["vm_id:abc"])
 observability.histogram("vm.startup_time", value: 2.5, tags: ["app:vibecode"])


 3. Tracing:
 ------------
 let span = observability.startSpan(name: "vm.lifecycle", attributes: [
     "vm_id": "abc-123"
 ])

 span.setAttribute(key: "cpu_count", value: 2)
 span.addEvent(name: "configuration_complete", attributes: [:])

 // Do work...

 span.end()


 4. With BaseVMManager:
 -----------------------
 final class MyVMManager: BaseVMManager {
     private let observability: ObservabilityProvider

     init(observability: ObservabilityProvider = DatadogProvider.shared) {
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

     override func onVMError(_ error: Error) {
         super.onVMError(error)
         observability.error("VM error", ["error": error.localizedDescription])
         observability.increment("vm.error")
     }
 }


 5. Multiple providers:
 -----------------------
 let composite = CompositeProvider(providers: [
     DatadogProvider.shared,
     OpenTelemetryProvider.shared
 ])

 composite.info("Message sent to both Datadog and OpenTelemetry")


 6. Testing:
 ------------
 let mockProvider = NoOpProvider()
 let vm = MyVMManager(observability: mockProvider)
 // VM runs without sending any observability data


 7. Custom provider:
 --------------------
 class ConsoleProvider: ObservabilityProvider {
     func info(_ message: String, _ attributes: [String: Any]) {
         print("[INFO] \(message) \(attributes)")
     }
     // ... implement other methods
 }

 let provider = ConsoleProvider()
 provider.info("Test message", ["key": "value"])


 8. Dependency injection:
 -------------------------
 struct ContentView: View {
     @StateObject private var vmManager: MyVMManager

     init(observability: ObservabilityProvider = DatadogProvider.shared) {
         _vmManager = StateObject(wrappedValue: MyVMManager(observability: observability))
     }

     var body: some View {
         // UI code...
     }
 }

 // In tests:
 let testView = ContentView(observability: NoOpProvider())
 */
