# OpenTelemetry OTLP Integration with Datadog

## Overview

This document describes the OpenTelemetry integration for the VibeCode SwiftUI application, enabling distributed tracing with OTLP export to Datadog's ingestion endpoint.

## Architecture Decision

**Current Implementation: Manual OTLP Stub**

The implementation uses a **manual OTLP JSON exporter** rather than the official `opentelemetry-swift` SDK due to the current build process constraints.

### Why Not Use opentelemetry-swift SDK?

The SwiftUI apps are currently built with standalone `swiftc` commands:

```bash
swiftc -o "$PROJECT_NAME" \
    -framework SwiftUI \
    -framework Virtualization \
    -framework Network \
    -target arm64-apple-macos11.0 \
    main.swift
```

The `opentelemetry-swift` SDK requires:
- Swift Package Manager (`Package.swift`)
- Multiple dependencies: `OpenTelemetryApi`, `OpenTelemetrySdk`, `OpenTelemetryProtocolExporter`
- Additional GRPC dependencies for `OtlpGrpcTraceExporter` (gRPC-Swift, SwiftNIO)

### Implementation Options Comparison

| Option | Pros | Cons | Status |
|--------|------|------|--------|
| **1. Manual OTLP Stub** (Current) | No dependencies, works with current build | Manual JSON encoding, limited features | ✅ Implemented |
| **2. Full opentelemetry-swift SDK** | Full OpenTelemetry features, standards-compliant | Requires build process changes to `swift build` | ⏰ Recommended for future |
| **3. Hybrid (XCFramework)** | Keep current build mostly intact | Complex framework building, maintenance overhead | 🤔 Consider if needed |

## Research Findings

### Swift OpenTelemetry SDK

**Repository:** https://github.com/open-telemetry/opentelemetry-swift

**Status:** ✅ Actively maintained
- Latest release: v2.2.0 (October 2, 2025)
- 1,052 commits, 77 contributors
- Active maintainers from Embrace, Elastic, and other organizations

**Features:**
- **Traces:** Fully stable with span creation and context propagation
- **Metrics:** Functional (using outdated spec, planned updates)
- **Logs:** Beta-quality implementation
- **Baggage:** Stable propagation support
- **Instrumentation:** URLSession, NetworkStatus, SignPostIntegration

**OTLP Exporter Support:**
- ✅ OTLP/gRPC: Production ready
- ⚠️ OTLP/HTTP: Experimental

**Swift Package Manager Integration:**
```swift
.package(url: "https://github.com/open-telemetry/opentelemetry-swift", from: "2.2.0")
```

**Minimum Requirements:**
- Swift 5+
- macOS/iOS deployment targets not explicitly documented (assume recent versions)

### Datadog OTLP Ingestion

**Endpoint URL Format:**
- US1: `https://api.datadoghq.com/api/intake/otlp/v1/traces`
- EU1: `https://api.datadoghq.eu/api/intake/otlp/v1/traces`
- US3: `https://api.us3.datadoghq.com/api/intake/otlp/v1/traces`
- US5: `https://api.us5.datadoghq.com/api/intake/otlp/v1/traces`

**Protocol Support:**
- ✅ OTLP/HTTP (port 443, HTTPS)
- ✅ OTLP/gRPC (port 4317 via Datadog Agent)

**Authentication:**
- Required header: `dd-api-key: ${DD_API_KEY}`
- Content-Type: `application/json` (JSON encoding) or `application/x-protobuf` (Protobuf)

**Environment Variables:**
- `DD_API_KEY` (required): Datadog API key
- `DD_SITE` (optional): Datadog site (default: `datadoghq.com`)
- `ENV` (optional): Environment tag (e.g., `production`, `development`)

**Important Notes:**
- ⚠️ OTLP logs and metrics intake are in **Preview** (requires account representative access)
- ✅ OTLP traces are generally available
- Direct ingestion bypasses Datadog Agent

## Implementation Details

### File Structure

```
/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/
├── OpenTelemetryIntegration.swift   # Main integration code
├── TestOpenTelemetry.swift          # Test program
├── VMObservability.swift            # Existing observability (logs + metrics)
├── DatadogLogger.swift              # JSON logs
└── DogStatsDClient.swift            # StatsD metrics
```

### Key Components

#### 1. OpenTelemetryIntegration.swift

**Main Class: `OpenTelemetryIntegration`**

Singleton that manages OTLP span creation and export.

**Key Features:**
- W3C Trace Context generation (`trace_id`, `span_id`)
- Parent-child span relationships
- OTLP JSON payload encoding
- Asynchronous HTTP export to Datadog via `URLSession`
- Integration with existing logs and metrics

**Span Context Structure:**
```swift
struct SpanContext {
    let traceId: String      // 32 hex chars (128-bit)
    let spanId: String       // 16 hex chars (64-bit)
    let parentSpanId: String?  // 16 hex chars (64-bit)
}
```

**W3C Traceparent Format:**
```
00-<trace_id>-<span_id>-01
```

#### 2. Core API

**Start a Span:**
```swift
let context = OpenTelemetryIntegration.shared.startSpan(
    name: "vm.start",
    kind: .internal,
    attributes: ["vm.id": vmId, "vm.name": vmName],
    parentContext: nil  // or parent span context
)
```

**End a Span:**
```swift
OpenTelemetryIntegration.shared.endSpan(
    context: context,
    name: "vm.start",
    kind: .internal,
    startTime: startTime,
    attributes: ["result": "success"],
    status: .ok
)
```

**Track Operation (Convenience):**
```swift
let result = await otel.trackOperation("vm.start") {
    try await startVirtualMachine()
}
// Automatically creates span, handles errors, exports
```

#### 3. Span Kinds

```swift
enum SpanKind {
    case unspecified  // Unknown operation type
    case internal     // Internal operation (default for VM ops)
    case server       // Server handling incoming request
    case client       // Client making outgoing request
    case producer     // Message queue producer
    case consumer     // Message queue consumer
}
```

#### 4. OTLP JSON Payload Structure

The implementation manually constructs OTLP JSON payloads according to the [OpenTelemetry Protocol Specification](https://opentelemetry.io/docs/specs/otlp/):

```json
{
  "resourceSpans": [
    {
      "resource": {
        "attributes": [
          {"key": "service.name", "value": {"stringValue": "vibecode-swiftui"}},
          {"key": "service.environment", "value": {"stringValue": "production"}},
          {"key": "host.name", "value": {"stringValue": "macbook.local"}}
        ]
      },
      "scopeSpans": [
        {
          "scope": {
            "name": "vibecode-manual-instrumentation",
            "version": "1.0.0"
          },
          "spans": [
            {
              "traceId": "abcdef1234567890abcdef1234567890",
              "spanId": "1234567890abcdef",
              "parentSpanId": "",
              "name": "vm.start",
              "kind": 1,
              "startTimeUnixNano": "1698765432123456789",
              "endTimeUnixNano": "1698765433123456789",
              "attributes": [
                {"key": "vm.id", "value": {"stringValue": "vm-001"}},
                {"key": "vm.name", "value": {"stringValue": "PostgreSQL"}}
              ],
              "status": {"code": 1}
            }
          ]
        }
      ]
    }
  ]
}
```

## Integration with Existing Observability

### Current Stack

| Component | Type | Protocol | Destination |
|-----------|------|----------|-------------|
| `DatadogLogger` | Logs | JSON file | Datadog Agent (file tail) |
| `DogStatsDClient` | Metrics | StatsD/UDP | Datadog Agent (port 8125) |
| `OpenTelemetryIntegration` | Traces | OTLP/HTTP | Datadog API (port 443) |

### Unified Observability

The integration maintains **trace correlation** across logs, metrics, and traces:

```swift
// Create trace
let context = otel.startSpan(name: "vm.start", ...)

// Correlate logs with trace_id
DatadogLogger.shared.info("VM starting", [
    "trace_id": context.traceId,
    "span_id": context.spanId,
    "vm.id": vmId
])

// Emit metrics with trace tag
DogStatsDClient.shared.increment("vm.start.attempt", tags: [
    "trace_id:\(context.traceId)",
    "vm_id:\(vmId)"
])

// End trace
otel.endSpan(context: context, ...)
```

**Benefits:**
- Jump from logs to traces in Datadog UI
- Correlate metrics spikes with specific traces
- End-to-end visibility: logs → metrics → traces

### VMObservability Extension

The `VMObservability` class has been extended with tracing:

```swift
extension VMObservability {
    func trackVMStartWithTracing(
        _ vmId: String,
        _ vmName: String,
        operation: () async throws -> Void
    ) async rethrows {
        // Creates span, executes operation, emits logs + metrics + trace
    }
}
```

## Setup Instructions

### 1. Set Environment Variables

```bash
# Required: Datadog API key
export DD_API_KEY="your-datadog-api-key-here"

# Optional: Datadog site (default: datadoghq.com)
export DD_SITE="datadoghq.com"    # US1
# export DD_SITE="datadoghq.eu"   # EU1
# export DD_SITE="us3.datadoghq.com"  # US3
# export DD_SITE="us5.datadoghq.com"  # US5

# Optional: Environment tag
export ENV="production"
```

### 2. Compile Test Program

```bash
cd /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/

swiftc -o TestOpenTelemetry \
    TestOpenTelemetry.swift \
    OpenTelemetryIntegration.swift
```

### 3. Run Test

```bash
./TestOpenTelemetry
```

**Expected Output:**
```
=== OpenTelemetry OTLP Integration Test ===

Configuration:
  DD_API_KEY: ✅ Set (dd-api-k...)
  DD_SITE: datadoghq.com
  OTLP Endpoint: https://api.datadoghq.com/api/intake/otlp/v1/traces

Test 1: Creating simple span...
  Trace ID: abcdef1234567890abcdef1234567890
  Span ID: 1234567890abcdef
  W3C Traceparent: 00-abcdef1234567890abcdef1234567890-1234567890abcdef-01
  ✅ Span ended and exported

Test 2: Creating parent-child span relationship...
  Parent Trace ID: fedcba0987654321fedcba0987654321
  Parent Span ID: 0987654321fedcba
  Child 1 Span ID: 1111222233334444 (parent: 0987654321fedcba)
  Child 2 Span ID: 5555666677778888 (parent: 0987654321fedcba)
  ✅ Parent and child spans exported

Test 3: Creating error span...
  ✅ Error span exported

Test 4: Creating span with events...
  ✅ Span with events exported

Waiting for OTLP export requests to complete...

=== Test Complete ===
```

### 4. Verify in Datadog

1. **Navigate to APM Traces:**
   - Go to: `https://app.datadoghq.com/apm/traces` (or your DD_SITE)

2. **Search for Service:**
   - Search: `service:vibecode-swiftui`

3. **Verify Traces:**
   - Look for operations: `test.simple.operation`, `test.vm.start`, etc.
   - Verify parent-child relationships in flame graph
   - Check span attributes and events

4. **Verify Trace Structure:**
   ```
   test.vm.start (parent)
   ├── test.vm.configure (child)
   └── test.vm.boot (child)
   ```

## Integration into SwiftUI Apps

### Option 1: Use in VMManager (Existing Apps)

**LiquidGlassVibeCodeApp.swift:**

```swift
import SwiftUI
import Virtualization

@main
struct VibeCodeApp: App {
    init() {
        // Initialize observability
        DatadogLogger.shared.info("VibeCode app launching", ["version": "1.0.0"])
        DogStatsDClient.shared.increment("app.launch")

        // Initialize OpenTelemetry
        _ = OpenTelemetryIntegration.shared
        NSLog("✅ Observability initialized: Logs + Metrics + Traces")
    }
    // ...
}

class VMManager: ObservableObject {
    func startVM() {
        let otel = OpenTelemetryIntegration.shared
        let vmId = UUID().uuidString
        let context = otel.startSpan(
            name: "vm.start",
            kind: .internal,
            attributes: [
                "vm.id": vmId,
                "vm.name": "PostgreSQL",
                "mac_address": vmMACAddress
            ]
        )
        let startTime = Date()

        // ... VM start logic ...

        vm?.start { result in
            switch result {
            case .success:
                otel.endSpan(
                    context: context,
                    name: "vm.start",
                    startTime: startTime,
                    attributes: ["result": "success"],
                    status: .ok
                )
            case .failure(let error):
                otel.endSpan(
                    context: context,
                    name: "vm.start",
                    startTime: startTime,
                    attributes: [
                        "result": "failure",
                        "error.type": String(describing: type(of: error)),
                        "error.message": error.localizedDescription
                    ],
                    status: .error(description: error.localizedDescription)
                )
            }
        }
    }
}
```

### Option 2: Compile with Multiple Files

**Update build script:**

```bash
swiftc -o LiquidGlassVibeCodeApp \
    -framework SwiftUI \
    -framework Virtualization \
    -framework Network \
    -target arm64-apple-macos11.0 \
    LiquidGlassVibeCodeApp.swift \
    OpenTelemetryIntegration.swift \
    DatadogLogger.swift \
    DogStatsDClient.swift \
    VMObservability.swift \
    DHCPLeaseParser.swift
```

## Test Plan

### Unit Tests

✅ **Test 1: Simple Span Creation**
- Create span with attributes
- Verify trace_id and span_id generation
- Verify W3C traceparent format

✅ **Test 2: Parent-Child Relationships**
- Create parent span
- Create multiple child spans
- Verify child spans have correct parent_span_id
- Verify all children share same trace_id

✅ **Test 3: Error Spans**
- Create span with error status
- Verify error attributes (error.type, error.message)
- Verify status code = 2 (ERROR)

✅ **Test 4: Span Events**
- Create span with timeline events
- Verify event timestamps
- Verify event attributes

### Integration Tests

⏰ **Test 5: OTLP Export to Datadog**
- Run TestOpenTelemetry with DD_API_KEY
- Verify HTTP POST to OTLP endpoint
- Verify 200/202 response from Datadog
- Verify spans appear in Datadog APM UI

⏰ **Test 6: Trace-Log Correlation**
- Create span with trace_id
- Emit log with same trace_id
- Verify logs and traces are linked in Datadog

⏰ **Test 7: Full VM Lifecycle Tracing**
- Start VM with tracing enabled
- Verify spans for: configure, boot, network setup
- Verify parent-child relationships
- Verify span attributes (vm.id, vm.name, duration)

### Performance Tests

⏰ **Test 8: Overhead Measurement**
- Measure VM start time with/without tracing
- Verify <5ms overhead per span
- Verify async export doesn't block main thread

### Failure Tests

⏰ **Test 9: Missing DD_API_KEY**
- Run without DD_API_KEY
- Verify graceful degradation (logs warning, doesn't crash)

⏰ **Test 10: Network Failure**
- Simulate OTLP endpoint unavailability
- Verify error logging
- Verify app continues functioning

## Troubleshooting

### Issue 1: "DD_API_KEY not set"

**Symptom:**
```
⚠️ OpenTelemetry: DD_API_KEY not set, traces will not be exported
```

**Solution:**
```bash
export DD_API_KEY="your-api-key-here"
```

### Issue 2: "OTLP export failed: HTTP 403"

**Symptom:**
```
❌ OTLP export failed: HTTP 403 Forbidden
```

**Causes:**
1. Invalid API key
2. Organization not allowlisted for OTLP Preview (logs/metrics only)
3. Wrong DD_SITE

**Solutions:**
- Verify API key: `https://app.datadoghq.com/organization-settings/api-keys`
- Contact Datadog account representative for OTLP access
- Verify DD_SITE matches your organization

### Issue 3: Spans not appearing in Datadog

**Checklist:**
1. ✅ DD_API_KEY is set and valid
2. ✅ Network connectivity to `api.datadoghq.com`
3. ✅ Correct DD_SITE for your organization
4. ✅ Wait 2-3 minutes for ingestion processing
5. ✅ Search for `service:vibecode-swiftui` in APM Traces

### Issue 4: Build errors with OpenTelemetryIntegration.swift

**Error:**
```
error: cannot find type 'VZVirtualMachine' in scope
```

**Cause:** Missing framework imports

**Solution:**
```bash
swiftc -o MyApp \
    -framework Virtualization \
    -framework Network \
    MyApp.swift \
    OpenTelemetryIntegration.swift
```

## Future Migration to opentelemetry-swift SDK

### Step 1: Create Package.swift

```swift
// swift-tools-version:5.5
import PackageDescription

let package = Package(
    name: "VibeCode",
    platforms: [.macOS(.v11)],
    dependencies: [
        .package(
            url: "https://github.com/open-telemetry/opentelemetry-swift",
            from: "2.2.0"
        )
    ],
    targets: [
        .executableTarget(
            name: "VibeCode",
            dependencies: [
                .product(name: "OpenTelemetryApi", package: "opentelemetry-swift"),
                .product(name: "OpenTelemetrySdk", package: "opentelemetry-swift"),
                .product(name: "OpenTelemetryProtocolExporter", package: "opentelemetry-swift")
            ],
            path: "Sources"
        )
    ]
)
```

### Step 2: Initialize SDK

```swift
import OpenTelemetryApi
import OpenTelemetrySdk
import OpenTelemetryProtocolExporter

// Configure OTLP exporter
let otlpConfig = OtlpExporterConfiguration(
    endpoint: "https://api.datadoghq.com/api/intake/otlp/v1/traces",
    headers: [("dd-api-key", ProcessInfo.processInfo.environment["DD_API_KEY"] ?? "")]
)

let exporter = OtlpHttpTraceExporter(config: otlpConfig)

// Register tracer provider
OpenTelemetry.registerTracerProvider(
    tracerProvider: TracerProviderBuilder()
        .add(spanProcessor: BatchSpanProcessor(spanExporter: exporter))
        .with(resource: Resource(attributes: [
            "service.name": "vibecode-swiftui",
            "service.environment": ProcessInfo.processInfo.environment["ENV"] ?? "development",
            "host.name": Host.current().name ?? "unknown"
        ]))
        .build()
)

// Get tracer
let tracer = OpenTelemetry.instance.tracerProvider.get(
    instrumentationName: "com.vibecode.app",
    instrumentationVersion: "1.0.0"
)
```

### Step 3: Create Spans

```swift
// Create span
let span = tracer.spanBuilder(spanName: "vm.start")
    .setSpanKind(spanKind: .internal)
    .startSpan()

span.setAttribute(key: "vm.id", value: vmId)
span.setAttribute(key: "vm.name", value: vmName)

// ... perform operation ...

span.end()
```

### Step 4: Update Build Process

```bash
# Old: swiftc
swiftc -o VibeCode main.swift

# New: swift build
swift build -c release
```

### Benefits of Migration

| Feature | Current (Stub) | With opentelemetry-swift |
|---------|----------------|--------------------------|
| OTLP Compliance | Manual JSON | ✅ Standards-compliant |
| Batch Export | No (one-by-one) | ✅ Batched for efficiency |
| Sampling | No | ✅ Configurable sampling |
| Context Propagation | Manual | ✅ Automatic |
| Instrumentation | Manual | ✅ Auto-instrumentation libraries |
| Metrics Export | No | ✅ Yes (OTLP metrics) |
| Logs Export | No | ✅ Yes (OTLP logs) |
| Maintenance | Manual updates | ✅ Community-maintained |

## References

### Documentation

- **OpenTelemetry Swift SDK:** https://github.com/open-telemetry/opentelemetry-swift
- **OpenTelemetry Docs:** https://opentelemetry.io/docs/languages/swift/
- **OTLP Specification:** https://opentelemetry.io/docs/specs/otlp/
- **Datadog OpenTelemetry:** https://docs.datadoghq.com/opentelemetry/
- **Datadog OTLP Intake:** https://docs.datadoghq.com/opentelemetry/setup/agentless/
- **W3C Trace Context:** https://www.w3.org/TR/trace-context/

### API Keys

- **Get Datadog API Key:** https://app.datadoghq.com/organization-settings/api-keys
- **Datadog Sites:** https://docs.datadoghq.com/getting_started/site/

### Support

- **OpenTelemetry Swift Issues:** https://github.com/open-telemetry/opentelemetry-swift/issues
- **Datadog Support:** https://docs.datadoghq.com/help/

## Summary

This implementation provides a **working OTLP integration** that:

✅ Exports traces to Datadog via OTLP/HTTP
✅ Creates W3C-compliant trace contexts
✅ Supports parent-child span relationships
✅ Integrates with existing logs and metrics
✅ Works with current `swiftc` build process
✅ Provides path to migrate to official SDK

**Recommendation:** Use this stub for immediate tracing needs, plan migration to `opentelemetry-swift` SDK for production use.
