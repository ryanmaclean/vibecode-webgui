# Observability Strategy for VibeCode VM Management

## What We Actually Need to Track

### 1. VM Lifecycle Metrics
- **vm.start.attempt** (counter) - How many times users try to start VMs
- **vm.start.success** (counter) - Successful starts
- **vm.start.failure** (counter) - Failed starts
- **vm.start.duration** (histogram) - Time from button click to VM ready
- **vm.boot.duration** (histogram) - Time from VZ start() to first network packet
- **vm.running.count** (gauge) - How many VMs currently running
- **vm.cpu.usage** (gauge) - CPU usage per VM
- **vm.memory.usage** (gauge) - Memory usage per VM

### 2. Host-VM Relationship
All metrics/logs/traces tagged with:
- `host.name` - Mac hostname
- `host.os` - macOS version
- `host.arch` - arm64
- `vm.id` - Unique VM identifier
- `vm.name` - Human-readable name
- `vm.type` - postgresql, valkey, nodejs, etc.
- `env` - development, production

### 3. User Experience Metrics
- **time.to.cursor** - Time from app launch to user can interact
- **gui.interaction.duration** - Time from click to UI response
- **vm.service.ready** - Time until service (PostgreSQL, etc) is accessible

### 4. Structured Logs
```json
{
  "timestamp": "2025-10-31T22:00:00Z",
  "level": "INFO",
  "message": "VM start initiated",
  "vm.id": "nodejs-codeserver",
  "vm.name": "Nodejs-Codeserver",
  "vm.type": "ide",
  "host.name": "ryans-macbook",
  "operation": "vm.start",
  "trace.id": "abc123",
  "span.id": "def456"
}
```

### 5. Distributed Traces
```
vm.start [10.2s]
  ├─ validate_config [0.1s]
  ├─ allocate_resources [0.3s]
  ├─ boot_vm [8.5s]
  │   ├─ efi_load [0.2s]
  │   ├─ kernel_boot [5.0s]
  │   └─ network_init [3.3s]
  └─ health_check [1.3s]
      └─ service_ready [1.2s]
```

### 6. Events
- VM lifecycle events (started, stopped, crashed)
- Service availability events
- Error events with stack traces
- Deployment events

## Datadog Implementation

### File Logger + Agent
```swift
// Structured JSON logs → file → Datadog agent → Datadog
DatadogLogger.info("VM started", [
    "vm.id": vmId,
    "host.name": hostname,
    "duration.ms": duration
])
```

### DogStatsD Metrics
```swift
// UDP metrics → DogStatsD → Datadog
DogStatsDClient.histogram("vm.start.duration", 
    value: duration,
    tags: ["vm.id:\(vmId)", "host.name:\(hostname)"])
```

### Datadog APM (Tracing)
```swift
// Distributed traces
import DatadogCore
import DatadogTrace

let tracer = Tracer.shared()
let span = tracer.startSpan(operationName: "vm.start")
span.setTag(key: "vm.id", value: vmId)
span.setTag(key: "host.name", value: hostname)
// ... do work ...
span.finish()
```

## OpenTelemetry Implementation

### Benefits
- Vendor-neutral (can switch from Datadog)
- Single SDK for metrics, logs, traces
- Standard format (OTLP)
- Better instrumentation libraries

### Swift OpenTelemetry
```swift
import OpenTelemetryApi
import OpenTelemetrySdk
import OtlpExporter

// Initialize
let otlp = OtlpHttpExporter(endpoint: "http://localhost:4318/v1/traces")
let tracerProvider = TracerProviderBuilder()
    .add(spanProcessor: SimpleSpanProcessor(spanExporter: otlp))
    .build()

OpenTelemetry.registerTracerProvider(tracerProvider: tracerProvider)

// Trace VM start
let tracer = OpenTelemetry.instance.tracerProvider.get(instrumentationName: "vibecode")
let span = tracer.spanBuilder(spanName: "vm.start").startSpan()
span.setAttribute(key: "vm.id", value: vmId)
span.setAttribute(key: "host.name", value: hostname)
span.setAttribute(key: "vm.type", value: "postgresql")

// ... do work ...

span.end()
```

### OTLP → Datadog
```yaml
# otel-collector-config.yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

exporters:
  datadog:
    api:
      key: ${DD_API_KEY}
    host_metadata:
      enabled: true
      hostname_source: config_or_system
      tags:
        - env:development

service:
  pipelines:
    traces:
      receivers: [otlp]
      exporters: [datadog]
    metrics:
      receivers: [otlp]
      exporters: [datadog]
```

## Recommended Implementation

### Phase 1: Enhanced File Logging
```swift
class VMObservability {
    func trackVMStart(_ vm: VMInfo) {
        let startTime = Date()
        let traceId = UUID().uuidString
        
        log(.info, "vm.start.initiated", [
            "trace.id": traceId,
            "vm.id": vm.id,
            "vm.name": vm.name,
            "vm.type": vm.type,
            "host.name": Host.current().name ?? "unknown",
            "timestamp": ISO8601DateFormatter().string(from: startTime)
        ])
        
        // Track duration
        return { result in
            let duration = Date().timeIntervalSince(startTime)
            log(.info, "vm.start.completed", [
                "trace.id": traceId,
                "vm.id": vm.id,
                "duration.seconds": duration,
                "result": result.success ? "success" : "failure",
                "error": result.error?.localizedDescription ?? ""
            ])
        }
    }
}
```

### Phase 2: OpenTelemetry
- Install OpenTelemetry Swift SDK
- Add OTLP exporter
- Run local otel-collector → Datadog
- Get distributed tracing across VM operations

### Phase 3: VM → Host Correlation
```swift
// Tag everything with resource attributes
let resource = Resource(attributes: [
    "service.name": "vibecode",
    "service.version": "1.0.0",
    "host.name": Host.current().name,
    "host.arch": "arm64",
    "deployment.environment": "development"
])

// Each VM operation includes
span.setAttribute(key: "vm.id", value: vmId)
span.setAttribute(key: "vm.name", value: vmName)
span.setAttribute(key: "vm.type", value: vmType)
```

## Key Insights

1. **Traces > Metrics for Understanding** - A trace showing 8.5s boot time broken down is more valuable than a metric saying "VM started in 8.5s"

2. **Resource Attributes** - The key to host-VM correlation is consistent resource tagging

3. **OpenTelemetry vs Datadog SDK**
   - OTel: Vendor-neutral, standard, future-proof
   - Datadog: Easier setup, tighter integration
   - Recommendation: Start with Datadog (already installed), migrate to OTel later

4. **What Actually Matters**
   - Time from click to VM ready (user experience)
   - VM service availability (can I connect to PostgreSQL?)
   - Error rates and failure reasons
   - Resource usage trends

