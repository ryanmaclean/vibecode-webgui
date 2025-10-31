// MIT License - OpenTelemetry Integration with Datadog OTLP
import Foundation
import os.log

/// OpenTelemetry integration for distributed tracing via OTLP to Datadog
///
/// ARCHITECTURE DECISION:
/// This is a **stub implementation** due to current limitations in the build process.
/// The SwiftUI apps are built with standalone `swiftc` commands without Swift Package Manager.
///
/// CHALLENGE: opentelemetry-swift SDK requires:
///   - Swift Package Manager (Package.swift)
///   - Multiple dependencies: OpenTelemetryApi, OpenTelemetrySdk, OpenTelemetryProtocolExporter
///   - GRPC dependencies for OtlpGrpcTraceExporter (gRPC-Swift, SwiftNIO)
///
/// CURRENT BUILD PROCESS (from build-vsock-app.sh):
///   swiftc -o "$PROJECT_NAME" \
///       -framework SwiftUI \
///       -framework Virtualization \
///       -framework Network \
///       -target arm64-apple-macos11.0 \
///       main.swift
///
/// IMPLEMENTATION OPTIONS:
///
/// Option 1: Stub Implementation (CURRENT - IMPLEMENTED BELOW)
///   - Create trace context manually (trace_id, span_id)
///   - Export via URLSession HTTP POST to Datadog OTLP endpoint
///   - Pros: No dependencies, works with current build
///   - Cons: Manual OTLP JSON encoding, limited features
///
/// Option 2: Full opentelemetry-swift SDK (RECOMMENDED FOR PRODUCTION)
///   - Use Package.swift to manage dependencies
///   - Change build process to `swift build` instead of `swiftc`
///   - Use official OtlpHttpTraceExporter
///   - Pros: Full OpenTelemetry features, standards-compliant
///   - Cons: Requires build process changes
///
/// Option 3: Hybrid Approach
///   - Build opentelemetry-swift as XCFramework
///   - Link with swiftc using -L and -l flags
///   - Pros: Keep current build process mostly intact
///   - Cons: Complex framework building, maintenance overhead
///
/// DATADOG OTLP INGESTION:
/// Endpoint: https://api.datadoghq.com/api/intake/otlp/v1/traces (US1)
///           https://api.datadoghq.eu/api/intake/otlp/v1/traces (EU1)
/// Protocol: OTLP/HTTP (gRPC also available via port 4317)
/// Auth: API key via headers
/// Required Headers:
///   - dd-api-key: ${DD_API_KEY}
///   - Content-Type: application/json (for JSON encoding) or application/x-protobuf
///
/// STATUS: This implementation provides a **manual OTLP span exporter** that:
/// 1. Creates W3C Trace Context (trace_id, span_id) compatible with existing logs
/// 2. Builds OTLP JSON payloads manually
/// 3. Exports via URLSession to Datadog OTLP endpoint
/// 4. Integrates with existing VMObservability and DatadogLogger
///
/// FUTURE WORK:
/// - Migrate to Package.swift and opentelemetry-swift SDK
/// - Use OtlpHttpTraceExporter for standards compliance
/// - Add automatic instrumentation for URLSession, etc.
/// - Add metrics and logs OTLP export
///

class OpenTelemetryIntegration {
    static let shared = OpenTelemetryIntegration()

    private let serviceName: String
    private let environment: String
    private let hostname: String
    private let otlpEndpoint: String
    private let apiKey: String?
    private let session: URLSession
    private let osLogger = Logger(subsystem: "com.vibecode.otel", category: "tracing")

    private init() {
        // Service metadata
        self.serviceName = "vibecode-swiftui"
        self.environment = ProcessInfo.processInfo.environment["ENV"] ?? "development"
        self.hostname = Host.current().name ?? "unknown"

        // Datadog OTLP endpoint configuration
        // Default to US1, override with DD_SITE env var
        let ddSite = ProcessInfo.processInfo.environment["DD_SITE"] ?? "datadoghq.com"
        self.otlpEndpoint = "https://api.\(ddSite)/api/intake/otlp/v1/traces"

        // API key from environment
        self.apiKey = ProcessInfo.processInfo.environment["DD_API_KEY"]

        // URLSession for HTTP export
        self.session = URLSession(configuration: .default)

        // Log initialization
        if apiKey == nil {
            osLogger.warning("OpenTelemetry: DD_API_KEY not set, traces will not be exported")
            NSLog("⚠️ OpenTelemetry: DD_API_KEY not set, traces will not be exported")
        } else {
            osLogger.info("OpenTelemetry initialized: endpoint=\(self.otlpEndpoint)")
            NSLog("✅ OpenTelemetry initialized: endpoint=\(self.otlpEndpoint)")
        }
    }

    // MARK: - Span Context

    /// Represents a distributed trace context (W3C Trace Context compatible)
    struct SpanContext {
        let traceId: String    // 32 hex chars (128-bit)
        let spanId: String     // 16 hex chars (64-bit)
        let parentSpanId: String?  // 16 hex chars (64-bit)

        /// Generate new trace context
        static func generate() -> SpanContext {
            return SpanContext(
                traceId: generateTraceId(),
                spanId: generateSpanId(),
                parentSpanId: nil
            )
        }

        /// Create child span context
        func createChild() -> SpanContext {
            return SpanContext(
                traceId: self.traceId,
                spanId: SpanContext.generateSpanId(),
                parentSpanId: self.spanId
            )
        }

        private static func generateTraceId() -> String {
            // 128-bit trace ID (32 hex chars)
            let uuid1 = UUID().uuidString.replacingOccurrences(of: "-", with: "")
            return String(uuid1.prefix(32))
        }

        private static func generateSpanId() -> String {
            // 64-bit span ID (16 hex chars)
            let uuid = UUID().uuidString.replacingOccurrences(of: "-", with: "")
            return String(uuid.prefix(16))
        }

        /// Convert to W3C traceparent header format
        var w3cTraceparent: String {
            return "00-\(traceId)-\(spanId)-01"
        }
    }

    // MARK: - Span Recording

    /// Start a new span and return its context
    func startSpan(
        name: String,
        kind: SpanKind = .internal,
        attributes: [String: Any] = [:],
        parentContext: SpanContext? = nil
    ) -> SpanContext {
        let context = parentContext?.createChild() ?? SpanContext.generate()

        osLogger.debug("Span started: \(name) trace_id=\(context.traceId) span_id=\(context.spanId)")

        return context
    }

    /// End a span and export it to Datadog
    func endSpan(
        context: SpanContext,
        name: String,
        kind: SpanKind = .internal,
        startTime: Date,
        endTime: Date = Date(),
        attributes: [String: Any] = [:],
        status: SpanStatus = .ok,
        events: [SpanEvent] = []
    ) {
        let durationNanos = Int64((endTime.timeIntervalSince(startTime)) * 1_000_000_000)

        osLogger.debug("Span ended: \(name) duration_ms=\(durationNanos / 1_000_000)")

        // Build OTLP span
        let span = OTLPSpan(
            traceId: context.traceId,
            spanId: context.spanId,
            parentSpanId: context.parentSpanId,
            name: name,
            kind: kind,
            startTimeUnixNano: startTime.timeIntervalSince1970Nanos,
            endTimeUnixNano: endTime.timeIntervalSince1970Nanos,
            attributes: buildAttributes(attributes),
            status: status,
            events: events
        )

        // Export span asynchronously
        exportSpan(span)
    }

    // MARK: - Helper: Track Operation (convenience method)

    /// Track an async operation with automatic span creation
    func trackOperation<T>(
        _ name: String,
        kind: SpanKind = .internal,
        attributes: [String: Any] = [:],
        parentContext: SpanContext? = nil,
        operation: () async throws -> T
    ) async rethrows -> T {
        let context = startSpan(name: name, kind: kind, attributes: attributes, parentContext: parentContext)
        let startTime = Date()

        do {
            let result = try await operation()
            endSpan(
                context: context,
                name: name,
                kind: kind,
                startTime: startTime,
                attributes: attributes,
                status: .ok
            )
            return result
        } catch {
            endSpan(
                context: context,
                name: name,
                kind: kind,
                startTime: startTime,
                attributes: attributes.merging([
                    "error.type": String(describing: type(of: error)),
                    "error.message": error.localizedDescription
                ]) { _, new in new },
                status: .error(description: error.localizedDescription)
            )
            throw error
        }
    }

    // MARK: - OTLP Data Structures

    enum SpanKind: Int {
        case unspecified = 0
        case `internal` = 1
        case server = 2
        case client = 3
        case producer = 4
        case consumer = 5
    }

    enum SpanStatus {
        case unset
        case ok
        case error(description: String)

        var code: Int {
            switch self {
            case .unset: return 0
            case .ok: return 1
            case .error: return 2
            }
        }
    }

    struct SpanEvent {
        let name: String
        let timeUnixNano: Int64
        let attributes: [String: Any]
    }

    private struct OTLPSpan {
        let traceId: String
        let spanId: String
        let parentSpanId: String?
        let name: String
        let kind: SpanKind
        let startTimeUnixNano: Int64
        let endTimeUnixNano: Int64
        let attributes: [[String: Any]]
        let status: SpanStatus
        let events: [SpanEvent]
    }

    // MARK: - OTLP Export

    private func exportSpan(_ span: OTLPSpan) {
        guard let apiKey = apiKey else {
            osLogger.warning("Span not exported: DD_API_KEY not configured")
            return
        }

        // Build OTLP JSON payload
        // https://opentelemetry.io/docs/specs/otlp/#otlphttp
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
                                "name": "vibecode-manual-instrumentation",
                                "version": "1.0.0"
                            ],
                            "spans": [
                                [
                                    "traceId": span.traceId,
                                    "spanId": span.spanId,
                                    "parentSpanId": span.parentSpanId ?? "",
                                    "name": span.name,
                                    "kind": span.kind.rawValue,
                                    "startTimeUnixNano": String(span.startTimeUnixNano),
                                    "endTimeUnixNano": String(span.endTimeUnixNano),
                                    "attributes": span.attributes,
                                    "status": [
                                        "code": span.status.code
                                    ],
                                    "events": span.events.map { event in
                                        [
                                            "name": event.name,
                                            "timeUnixNano": String(event.timeUnixNano),
                                            "attributes": buildAttributes(event.attributes)
                                        ]
                                    }
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
        let task = session.dataTask(with: request) { data, response, error in
            if let error = error {
                self.osLogger.error("OTLP export failed: \(error.localizedDescription)")
                NSLog("❌ OTLP export failed: \(error.localizedDescription)")
                return
            }

            if let httpResponse = response as? HTTPURLResponse {
                if httpResponse.statusCode >= 200 && httpResponse.statusCode < 300 {
                    self.osLogger.info("OTLP span exported: \(span.name) (\(httpResponse.statusCode))")
                } else {
                    self.osLogger.error("OTLP export error: HTTP \(httpResponse.statusCode)")
                    if let data = data, let body = String(data: data, encoding: .utf8) {
                        NSLog("❌ OTLP response: \(body)")
                    }
                }
            }
        }

        task.resume()
    }

    // MARK: - Helpers

    private func buildAttributes(_ attrs: [String: Any]) -> [[String: Any]] {
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

// MARK: - Date Extension

private extension Date {
    /// Convert Date to Unix nanoseconds (required by OTLP)
    var timeIntervalSince1970Nanos: Int64 {
        return Int64(self.timeIntervalSince1970 * 1_000_000_000)
    }
}

// MARK: - Integration with VMObservability

/// Enhanced VMObservability with OpenTelemetry tracing
extension VMObservability {
    /// Track VM start with distributed tracing
    func trackVMStartWithTracing(_ vmId: String, _ vmName: String, operation: () async throws -> Void) async rethrows {
        let otel = OpenTelemetryIntegration.shared

        // Create root span for VM start operation
        let context = otel.startSpan(
            name: "vm.start",
            kind: .internal,
            attributes: [
                "vm.id": vmId,
                "vm.name": vmName,
                "vm.type": extractVMType(from: vmName),
                "host.name": hostname,
                "env": environment
            ]
        )

        let startTime = Date()

        do {
            try await operation()

            // End span on success
            otel.endSpan(
                context: context,
                name: "vm.start",
                kind: .internal,
                startTime: startTime,
                attributes: [
                    "vm.id": vmId,
                    "vm.name": vmName,
                    "result": "success"
                ],
                status: .ok
            )

            // Also emit metrics and logs (existing behavior)
            trackVMStart(vmId, vmName, operation: operation)

        } catch {
            // End span on error
            otel.endSpan(
                context: context,
                name: "vm.start",
                kind: .internal,
                startTime: startTime,
                attributes: [
                    "vm.id": vmId,
                    "vm.name": vmName,
                    "result": "failure",
                    "error.type": String(describing: type(of: error)),
                    "error.message": error.localizedDescription
                ],
                status: .error(description: error.localizedDescription)
            )

            throw error
        }
    }
}

// MARK: - Usage Example

/*

 USAGE EXAMPLE 1: Track VM Start Operation

 ```swift
 // In VMManager.startVM():
 let otel = OpenTelemetryIntegration.shared
 let context = otel.startSpan(
     name: "vm.start",
     kind: .internal,
     attributes: ["vm.id": vmId, "vm.name": vmName]
 )
 let startTime = Date()

 // ... perform VM start ...

 otel.endSpan(
     context: context,
     name: "vm.start",
     startTime: startTime,
     attributes: ["result": "success"],
     status: .ok
 )
 ```

 USAGE EXAMPLE 2: Track with Automatic Error Handling

 ```swift
 let result = await otel.trackOperation("vm.start") {
     try await startVirtualMachine()
 }
 ```

 USAGE EXAMPLE 3: Link Spans with Existing Logs

 ```swift
 // Create span
 let context = otel.startSpan(name: "vm.start", ...)

 // Use trace_id in logs for correlation
 DatadogLogger.shared.info("VM starting", [
     "trace_id": context.traceId,
     "span_id": context.spanId
 ])
 ```

 ENVIRONMENT VARIABLES:

 ```bash
 # Required for OTLP export
 export DD_API_KEY="your-datadog-api-key"

 # Optional: specify Datadog site (default: datadoghq.com)
 export DD_SITE="datadoghq.com"  # US1
 # export DD_SITE="datadoghq.eu"  # EU1
 # export DD_SITE="us3.datadoghq.com"  # US3
 # export DD_SITE="us5.datadoghq.com"  # US5

 # Optional: environment tag
 export ENV="production"
 ```

 FUTURE MIGRATION TO opentelemetry-swift SDK:

 1. Create Package.swift:
 ```swift
 // swift-tools-version:5.5
 import PackageDescription

 let package = Package(
     name: "VibeCode",
     platforms: [.macOS(.v11)],
     dependencies: [
         .package(url: "https://github.com/open-telemetry/opentelemetry-swift", from: "2.2.0")
     ],
     targets: [
         .executableTarget(
             name: "VibeCode",
             dependencies: [
                 .product(name: "OpenTelemetryApi", package: "opentelemetry-swift"),
                 .product(name: "OpenTelemetrySdk", package: "opentelemetry-swift"),
                 .product(name: "OpenTelemetryProtocolExporter", package: "opentelemetry-swift")
             ]
         )
     ]
 )
 ```

 2. Initialize SDK:
 ```swift
 import OpenTelemetryApi
 import OpenTelemetrySdk
 import OpenTelemetryProtocolExporter

 let otlpConfig = OtlpExporterConfiguration(
     endpoint: "https://api.datadoghq.com/api/intake/otlp/v1/traces",
     headers: [("dd-api-key", ProcessInfo.processInfo.environment["DD_API_KEY"] ?? "")]
 )
 let exporter = OtlpHttpTraceExporter(config: otlpConfig)

 OpenTelemetry.registerTracerProvider(
     tracerProvider: TracerProviderBuilder()
         .add(spanProcessor: BatchSpanProcessor(spanExporter: exporter))
         .with(resource: Resource(attributes: [
             "service.name": "vibecode-swiftui",
             "service.environment": environment
         ]))
         .build()
 )

 let tracer = OpenTelemetry.instance.tracerProvider.get(
     instrumentationName: "com.vibecode.app",
     instrumentationVersion: "1.0.0"
 )
 ```

 3. Create spans:
 ```swift
 let span = tracer.spanBuilder(spanName: "vm.start")
     .setSpanKind(spanKind: .internal)
     .startSpan()

 span.setAttribute(key: "vm.id", value: vmId)
 // ... perform operation ...
 span.end()
 ```

 */
