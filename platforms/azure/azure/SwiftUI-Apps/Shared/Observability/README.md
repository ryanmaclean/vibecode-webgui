# Observability Components

**Purpose:** Unified observability layer for metrics, logging, and tracing
**Status:** Phase 2 - Observability Unification

---

## Overview

The Observability module provides:

- **ObservabilityProvider Protocol**: Abstract interface for observability backends
- **DatadogProvider**: Wrapper for existing Datadog integration
- **OpenTelemetryProvider**: Wrapper for OpenTelemetry integration
- **CompositeProvider**: Send to multiple backends simultaneously
- **MockProvider**: For testing

---

## ObservabilityProvider Protocol

All observability providers implement this protocol:

```swift
protocol ObservabilityProvider {
    // Logging
    func log(level: LogLevel, message: String, attributes: [String: Any])
    func debug(_ message: String, _ attributes: [String: Any])
    func info(_ message: String, _ attributes: [String: Any])
    func error(_ message: String, _ attributes: [String: Any])

    // Metrics
    func increment(_ metric: String, tags: [String])
    func gauge(_ metric: String, value: Double, tags: [String])
    func histogram(_ metric: String, value: Double, tags: [String])

    // Tracing
    func startSpan(name: String, attributes: [String: Any]) -> SpanContext
    func endSpan(_ context: SpanContext)
}
```

---

## Usage Example

```swift
final class ObservableVMManager: BaseVMManager {
    private let observability: ObservabilityProvider

    init(observability: ObservabilityProvider = DatadogProvider.shared) {
        self.observability = observability
        super.init()
    }

    override func onVMStarted() {
        super.onVMStarted()
        observability.info("VM started", ["vm_id": vmID])
        observability.increment("vm.start", tags: ["app:vibecode"])
    }

    override func onVMError(_ error: Error) {
        super.onVMError(error)
        observability.error("VM error", ["error": error.localizedDescription])
    }
}
```

---

## Available Providers

### DatadogProvider

Wraps existing DatadogLogger and DogStatsDClient:

```swift
let provider = DatadogProvider.shared
provider.info("Application started", ["version": "1.0.0"])
provider.increment("app.launch", tags: ["env:production"])
```

### OpenTelemetryProvider

Wraps existing OpenTelemetryIntegration:

```swift
let provider = OpenTelemetryProvider.shared
provider.startSpan(name: "vm.operation", attributes: ["operation": "start"])
```

### CompositeProvider

Send to multiple backends:

```swift
let composite = CompositeProvider(providers: [
    DatadogProvider.shared,
    OpenTelemetryProvider.shared
])

composite.info("Message sent to both backends")
```

---

## Best Practices

### DO ✅
- Use dependency injection for providers
- Use CompositeProvider for multiple backends
- Add structured attributes to logs
- Use appropriate log levels

### DON'T ❌
- Don't log sensitive data
- Don't use observability in tight loops (performance)
- Don't forget to end spans
- Don't hardcode provider implementation

---

## Reference

- [ObservabilityProvider.swift](./ObservabilityProvider.swift)
- Phase 2 implementation coming soon
