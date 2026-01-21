# OpenTelemetry OTLP Integration - Quick Start Guide

## 30-Second Test

```bash
# 1. Set your Datadog API key
export DD_API_KEY="your-datadog-api-key-here"

# 2. Compile and run test
cd /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/
swiftc -o TestOTLP TestOpenTelemetry.swift OpenTelemetryIntegration.swift
./TestOTLP

# 3. View traces in Datadog
# Go to: https://app.datadoghq.com/apm/traces
# Search: service:vibecode-swiftui
```

## Integration Examples

### Example 1: Track VM Start

```swift
import Foundation

let otel = OpenTelemetryIntegration.shared

// Start span
let context = otel.startSpan(
    name: "vm.start",
    kind: .internal,
    attributes: ["vm.id": "vm-001", "vm.name": "PostgreSQL"]
)
let startTime = Date()

// Perform VM start operation
try await vm.start()

// End span
otel.endSpan(
    context: context,
    name: "vm.start",
    startTime: startTime,
    attributes: ["result": "success"],
    status: .ok
)
```

### Example 2: Track with Automatic Error Handling

```swift
let result = await otel.trackOperation("vm.start", attributes: ["vm.id": vmId]) {
    try await startVirtualMachine()
}
// Automatically creates span, handles errors, exports
```

### Example 3: Parent-Child Spans

```swift
// Parent span
let parentContext = otel.startSpan(name: "vm.lifecycle", ...)
let parentStart = Date()

// Child span 1
let childContext1 = parentContext.createChild()
let child1Start = Date()
// ... configure VM ...
otel.endSpan(context: childContext1, name: "vm.configure", startTime: child1Start, ...)

// Child span 2
let childContext2 = parentContext.createChild()
let child2Start = Date()
// ... boot VM ...
otel.endSpan(context: childContext2, name: "vm.boot", startTime: child2Start, ...)

// End parent
otel.endSpan(context: parentContext, name: "vm.lifecycle", startTime: parentStart, ...)
```

### Example 4: Link Traces with Logs

```swift
// Create span
let context = otel.startSpan(name: "vm.start", ...)

// Emit correlated log
DatadogLogger.shared.info("VM starting", [
    "trace_id": context.traceId,
    "span_id": context.spanId,
    "vm.id": vmId
])

// Emit correlated metric
DogStatsDClient.shared.increment("vm.start", tags: [
    "trace_id:\(context.traceId)"
])
```

## Environment Variables

```bash
# Required
export DD_API_KEY="your-datadog-api-key"

# Optional
export DD_SITE="datadoghq.com"    # US1 (default)
# export DD_SITE="datadoghq.eu"   # EU1
# export DD_SITE="us3.datadoghq.com"  # US3
# export DD_SITE="us5.datadoghq.com"  # US5

export ENV="production"           # Environment tag
```

## Build Commands

### Test Program Only

```bash
swiftc -o TestOTLP \
    TestOpenTelemetry.swift \
    OpenTelemetryIntegration.swift
```

### SwiftUI App with Tracing

```bash
swiftc -o MyApp \
    -framework SwiftUI \
    -framework Virtualization \
    -framework Network \
    MyApp.swift \
    OpenTelemetryIntegration.swift \
    DatadogLogger.swift \
    DogStatsDClient.swift \
    VMObservability.swift
```

## Verifying Traces in Datadog

1. **Navigate:** https://app.datadoghq.com/apm/traces
2. **Search:** `service:vibecode-swiftui`
3. **Filter by operation:** `operation_name:vm.start`
4. **View flame graph:** See parent-child relationships
5. **Check span details:** Attributes, duration, status

## Span Attributes (Standard)

| Attribute | Description | Example |
|-----------|-------------|---------|
| `vm.id` | VM identifier | `"vm-001"` |
| `vm.name` | VM name | `"PostgreSQL"` |
| `vm.type` | VM type | `"database"` |
| `result` | Operation result | `"success"`, `"failure"` |
| `error.type` | Error type (on failure) | `"VirtualizationError"` |
| `error.message` | Error message | `"Failed to allocate memory"` |
| `duration_ms` | Duration in milliseconds | `1500` |

## Span Kinds

| Kind | Use Case | Example |
|------|----------|---------|
| `internal` | Internal operation | VM start/stop |
| `client` | Outgoing request | HTTP call to API |
| `server` | Incoming request | Handle HTTP request |
| `producer` | Message producer | Publish to queue |
| `consumer` | Message consumer | Consume from queue |

## Span Status

| Status | Code | Description |
|--------|------|-------------|
| `unset` | 0 | Default (not set) |
| `ok` | 1 | Success |
| `error` | 2 | Failure |

## Troubleshooting

### No traces in Datadog?

```bash
# Check DD_API_KEY is set
echo $DD_API_KEY

# Check network connectivity
curl -I https://api.datadoghq.com

# Run test with verbose output
./TestOTLP 2>&1 | grep -i "otlp\|export"

# Check Console.app for errors
log show --predicate 'subsystem == "com.vibecode.otel"' --last 5m
```

### "DD_API_KEY not set" warning?

```bash
export DD_API_KEY="your-api-key-here"
```

Get your API key: https://app.datadoghq.com/organization-settings/api-keys

### HTTP 403 Forbidden?

- Verify API key is valid
- Check DD_SITE matches your organization
- For OTLP logs/metrics (Preview): contact Datadog account rep

## W3C Trace Context

Traces use W3C Trace Context format for distributed tracing:

```
traceparent: 00-<trace_id>-<span_id>-01
             │   │           │         │
             │   │           │         └─ Sampled (01)
             │   │           └─────────── Span ID (16 hex)
             │   └─────────────────────── Trace ID (32 hex)
             └─────────────────────────── Version (00)
```

Example:
```
00-abcdef1234567890abcdef1234567890-1234567890abcdef-01
```

## Performance

- **Span creation:** <1ms overhead
- **Export:** Async (doesn't block main thread)
- **Network:** HTTP POST to Datadog API (443)
- **Batching:** Not implemented in stub (one-by-one export)

## Next Steps

1. ✅ Test basic tracing with `TestOpenTelemetry`
2. ✅ Integrate into `VMManager.startVM()`
3. ✅ Add spans for VM lifecycle events
4. ⏰ Add distributed tracing across network calls
5. ⏰ Migrate to `opentelemetry-swift` SDK for production

## Full Documentation

See: [OPENTELEMETRY-INTEGRATION.md](OPENTELEMETRY-INTEGRATION.md)

## Files

- `OpenTelemetryIntegration.swift` - Main integration code (605 lines)
- `TestOpenTelemetry.swift` - Test program (234 lines)
- `OPENTELEMETRY-INTEGRATION.md` - Comprehensive documentation (713 lines)
- `OPENTELEMETRY-QUICKSTART.md` - This quick start guide
