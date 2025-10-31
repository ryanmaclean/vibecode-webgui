// MIT License - Test OpenTelemetry OTLP Integration
import Foundation

/// Test program to verify OpenTelemetry OTLP export to Datadog
///
/// USAGE:
///   1. Set environment variables:
///      export DD_API_KEY="your-datadog-api-key"
///      export DD_SITE="datadoghq.com"  # or datadoghq.eu, etc.
///
///   2. Compile:
///      swiftc -o TestOpenTelemetry TestOpenTelemetry.swift OpenTelemetryIntegration.swift
///
///   3. Run:
///      ./TestOpenTelemetry
///
///   4. Verify in Datadog:
///      - Go to APM > Traces
///      - Search for service:vibecode-swiftui
///      - Look for trace with operation "test.vm.start"
///

// Main entry point using @main struct
@main
struct TestRunner {
    static func main() {
print("=== OpenTelemetry OTLP Integration Test ===\n")

// Check environment
let apiKey = ProcessInfo.processInfo.environment["DD_API_KEY"]
let ddSite = ProcessInfo.processInfo.environment["DD_SITE"] ?? "datadoghq.com"

print("Configuration:")
print("  DD_API_KEY: \(apiKey != nil ? "✅ Set (\(apiKey!.prefix(8))...)" : "❌ Not set")")
print("  DD_SITE: \(ddSite)")
print("  OTLP Endpoint: https://api.\(ddSite)/api/intake/otlp/v1/traces")
print()

if apiKey == nil {
    print("⚠️  WARNING: DD_API_KEY not set. Spans will be created but not exported.")
    print("   Set it with: export DD_API_KEY=\"your-api-key\"\n")
}

// Initialize OpenTelemetry
let otel = OpenTelemetryIntegration.shared

// Test 1: Simple span
print("Test 1: Creating simple span...")
let simpleContext = otel.startSpan(
    name: "test.simple.operation",
    kind: .internal,
    attributes: [
        "test.name": "simple_span",
        "test.number": 42
    ]
)
print("  Trace ID: \(simpleContext.traceId)")
print("  Span ID: \(simpleContext.spanId)")
print("  W3C Traceparent: \(simpleContext.w3cTraceparent)")

// Simulate work
Thread.sleep(forTimeInterval: 0.1)

otel.endSpan(
    context: simpleContext,
    name: "test.simple.operation",
    kind: .internal,
    startTime: Date(timeIntervalSinceNow: -0.1),
    attributes: [
        "test.result": "success",
        "test.duration_ms": 100
    ],
    status: .ok
)
print("  ✅ Span ended and exported\n")

// Test 2: Parent-child span relationship
print("Test 2: Creating parent-child span relationship...")
let parentContext = otel.startSpan(
    name: "test.vm.start",
    kind: .internal,
    attributes: [
        "vm.id": "test-vm-001",
        "vm.name": "PostgreSQL-Test",
        "vm.type": "database"
    ]
)
print("  Parent Trace ID: \(parentContext.traceId)")
print("  Parent Span ID: \(parentContext.spanId)")

let parentStartTime = Date()
Thread.sleep(forTimeInterval: 0.05)

// Child span 1: Configuration
let childContext1 = parentContext.createChild()
let child1StartTime = Date()
print("  Child 1 Span ID: \(childContext1.spanId) (parent: \(childContext1.parentSpanId ?? "none"))")

Thread.sleep(forTimeInterval: 0.03)

otel.endSpan(
    context: childContext1,
    name: "test.vm.configure",
    kind: .internal,
    startTime: child1StartTime,
    attributes: [
        "vm.id": "test-vm-001",
        "config.cpu": 2,
        "config.memory_gb": 1
    ],
    status: .ok
)

// Child span 2: Boot
let childContext2 = parentContext.createChild()
let child2StartTime = Date()
print("  Child 2 Span ID: \(childContext2.spanId) (parent: \(childContext2.parentSpanId ?? "none"))")

Thread.sleep(forTimeInterval: 0.04)

otel.endSpan(
    context: childContext2,
    name: "test.vm.boot",
    kind: .internal,
    startTime: child2StartTime,
    attributes: [
        "vm.id": "test-vm-001",
        "boot.time_ms": 40
    ],
    status: .ok
)

// End parent span
otel.endSpan(
    context: parentContext,
    name: "test.vm.start",
    kind: .internal,
    startTime: parentStartTime,
    attributes: [
        "vm.id": "test-vm-001",
        "result": "success",
        "child_spans": 2
    ],
    status: .ok
)
print("  ✅ Parent and child spans exported\n")

// Test 3: Error span
print("Test 3: Creating error span...")
let errorContext = otel.startSpan(
    name: "test.vm.start.failure",
    kind: .internal,
    attributes: [
        "vm.id": "test-vm-error",
        "vm.name": "Failed-VM"
    ]
)
let errorStartTime = Date()
Thread.sleep(forTimeInterval: 0.02)

otel.endSpan(
    context: errorContext,
    name: "test.vm.start.failure",
    kind: .internal,
    startTime: errorStartTime,
    attributes: [
        "vm.id": "test-vm-error",
        "error.type": "VirtualizationError",
        "error.message": "Failed to allocate memory"
    ],
    status: .error(description: "Failed to allocate memory")
)
print("  ✅ Error span exported\n")

// Test 4: Span with events
print("Test 4: Creating span with events...")
let eventContext = otel.startSpan(
    name: "test.vm.lifecycle",
    kind: .internal,
    attributes: ["vm.id": "test-vm-events"]
)
let eventStartTime = Date()

Thread.sleep(forTimeInterval: 0.01)
let event1Time = Date()

Thread.sleep(forTimeInterval: 0.01)
let event2Time = Date()

Thread.sleep(forTimeInterval: 0.01)

otel.endSpan(
    context: eventContext,
    name: "test.vm.lifecycle",
    kind: .internal,
    startTime: eventStartTime,
    attributes: ["vm.id": "test-vm-events"],
    status: .ok,
    events: [
        OpenTelemetryIntegration.SpanEvent(
            name: "vm.configured",
            timeUnixNano: event1Time.timeIntervalSince1970Nanos,
            attributes: ["config.validated": true]
        ),
        OpenTelemetryIntegration.SpanEvent(
            name: "vm.booted",
            timeUnixNano: event2Time.timeIntervalSince1970Nanos,
            attributes: ["boot.success": true]
        )
    ]
)
print("  ✅ Span with events exported\n")

// Wait for async HTTP requests to complete
print("Waiting for OTLP export requests to complete...")
Thread.sleep(forTimeInterval: 2.0)

print("\n=== Test Complete ===")
print("\nTo verify traces in Datadog:")
print("  1. Go to https://app.\(ddSite)/apm/traces")
print("  2. Search for: service:vibecode-swiftui")
print("  3. Look for traces with operations:")
print("     - test.simple.operation")
print("     - test.vm.start (with child spans)")
print("     - test.vm.start.failure (error trace)")
print("     - test.vm.lifecycle (with events)")
print("\nExpected trace structure:")
print("  test.vm.start")
print("  ├── test.vm.configure")
print("  └── test.vm.boot")
print()
    }
}

// Extension to access internal Date helper
private extension Date {
    var timeIntervalSince1970Nanos: Int64 {
        return Int64(self.timeIntervalSince1970 * 1_000_000_000)
    }
}
