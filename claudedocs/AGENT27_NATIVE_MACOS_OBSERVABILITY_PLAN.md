# Agent 27: Native macOS Observability Implementation Plan

**Agent Role**: Staff SRE (Shopify macOS Observability Team)
**Mission**: Implement lightweight native macOS observability stack (<2% CPU, <100MB memory)
**Date**: 2025-10-02
**Status**: READY FOR IMPLEMENTATION

---

## Executive Summary

Replace heavy external monitoring agents (Datadog, OpenTelemetry) with lightweight native macOS observability using:
- **Unified Logging** (os_log via Rust)
- **Rust-based MetricKit equivalent** (sysinfo, psutil-rs)
- **Custom metrics collector** (Prometheus exposition)
- **Native tracing** (tokio-console, tracing crate)
- **Tauri-based SwiftUI dashboard** (via webview)

**Performance Target**: <2% CPU, <100MB memory overhead
**Scope**: Container fleet monitoring (code-server, agentapi, docker runtime)

---

## Phase 1: Unified Logging Integration (Week 1)

### 1.1 Rust Logging Foundation
**Deliverable**: Replace console.log with structured Rust logging

**Files to Create**:
```
src-tauri/src/logging/
├── mod.rs              # Logging module entry
├── unified_log.rs      # macOS os_log bridge via oslog crate
├── structured.rs       # Structured log formatting (JSON)
├── aggregation.rs      # Log collection and rotation
└── retention.rs        # Retention policy (7d default, configurable)
```

**Dependencies (Cargo.toml)**:
```toml
oslog = "0.2"           # macOS os_log FFI
tracing = "0.1"         # Structured logging
tracing-subscriber = { version = "0.3", features = ["json", "env-filter"] }
tracing-appender = "0.2"  # File rotation
serde_json = "1"        # JSON formatting
```

**Key Features**:
- Subsystem: `com.vibecode.app`
- Categories: `container`, `docker`, `network`, `security`, `performance`
- Structured metadata: `container_id`, `profile`, `event_type`, `timestamp`
- Log levels: ERROR, WARN, INFO, DEBUG, TRACE
- Rotation: 100MB per file, 7 days retention
- Export: JSON format for aggregation

**Integration Points**:
- Docker events: container start/stop/crash
- mDNS discovery: service advertisement/discovery
- Network: API requests, WebSocket connections
- Security: auth failures, rate limit hits

**Testing**:
```bash
# View logs in Console.app
log stream --predicate 'subsystem == "com.vibecode.app"' --style json

# Filter by category
log show --predicate 'subsystem == "com.vibecode.app" AND category == "container"' --last 1h

# Export for analysis
log show --predicate 'subsystem == "com.vibecode.app"' --info --last 24h > vibecode-logs.json
```

---

## Phase 2: MetricKit Collection (Week 1-2)

### 2.1 Rust Metrics Collector
**Deliverable**: Real-time system and container metrics

**Files to Create**:
```
src-tauri/src/metrics/
├── mod.rs              # Metrics module entry
├── collector.rs        # Main metrics collection loop
├── system.rs           # CPU, memory, disk, network
├── container.rs        # Docker container metrics
├── power.rs            # macOS power/thermal state
└── prometheus.rs       # Prometheus exposition format
```

**Dependencies (Cargo.toml)**:
```toml
sysinfo = "0.34"        # Cross-platform system info
bollard = "0.18"        # Docker API (already present)
prometheus = "0.13"     # Prometheus client
tokio = { version = "1", features = ["full", "macros"] }  # Async runtime
once_cell = "1"         # Lazy static metrics registry
```

**Metrics to Collect**:

#### System Metrics (1-minute intervals)
```rust
// CPU
cpu_usage_percent{core="0..N"}
cpu_temperature_celsius
cpu_throttling_active

// Memory
memory_total_bytes
memory_used_bytes
memory_available_bytes
memory_pressure{level="normal|warning|critical"}
swap_used_bytes
swap_total_bytes

// Disk
disk_total_bytes{mount="/"}
disk_used_bytes{mount="/"}
disk_read_bytes_total
disk_write_bytes_total
disk_operations_total{operation="read|write"}

// Network
network_rx_bytes_total{interface="en0"}
network_tx_bytes_total{interface="en0"}
network_errors_total{interface="en0",direction="rx|tx"}
```

#### Container Metrics (10-second intervals)
```rust
// Per-container resource usage
container_cpu_usage_percent{id, name, profile}
container_memory_usage_bytes{id, name, profile}
container_memory_limit_bytes{id, name, profile}
container_network_rx_bytes_total{id, name, profile}
container_network_tx_bytes_total{id, name, profile}
container_block_read_bytes_total{id, name, profile}
container_block_write_bytes_total{id, name, profile}

// Container lifecycle
container_state{id, name, profile, state="running|stopped|paused"}
container_restart_count{id, name, profile}
container_uptime_seconds{id, name, profile}
container_exit_code{id, name, profile}
```

#### Power/Thermal Metrics (5-minute intervals)
```rust
// macOS-specific power metrics
power_source{type="battery|ac"}
battery_level_percent
battery_time_remaining_seconds
thermal_pressure{level="nominal|moderate|heavy|trapping|sleeping"}
power_budget_watts
cpu_energy_joules_total
```

**Prometheus Endpoint**:
```rust
// HTTP server on localhost:9091
GET /metrics -> Prometheus text exposition format
GET /health -> {"status": "healthy", "collectors": 3}
```

**Performance Optimization**:
- Async collection with Tokio (non-blocking)
- Lazy evaluation (collect only when scraped)
- Ring buffer for time-series (last 1h in memory)
- Exponential backoff on Docker API errors

---

## Phase 3: Custom Metrics Collector (Week 2)

### 3.1 Container-Specific Metrics
**Deliverable**: Advanced container observability

**Files to Create**:
```
src-tauri/src/metrics/
├── container_advanced.rs    # Container internals
├── histograms.rs            # Request latency histograms
├── gauges.rs                # Custom gauge metrics
└── exporters/
    ├── prometheus.rs        # Prometheus format (port 9091)
    ├── json.rs              # JSON export for dashboard
    └── statsd.rs            # StatsD format (optional)
```

**Advanced Metrics**:
```rust
// Container task metrics
container_task_active_count{id, name, profile}
container_task_completed_total{id, name, profile, status="success|failure"}
container_task_duration_seconds{id, name, profile, quantile="0.5|0.9|0.99"}

// Code-server specific
codeserver_extension_count{id, profile}
codeserver_workspace_count{id}
codeserver_session_active{id, profile}
codeserver_cpu_time_seconds_total{id, profile}

// Docker operations
docker_api_requests_total{method, endpoint, status}
docker_api_duration_seconds{method, endpoint, quantile="0.5|0.9|0.99"}
docker_image_pull_duration_seconds{image, profile}

// VM performance (if using Docker VM)
vm_cpu_usage_percent
vm_memory_usage_bytes
vm_disk_usage_bytes
```

**Histogram Buckets** (latency):
```rust
[0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1.0, 5.0, 10.0] // seconds
```

**Custom Collectors**:
```rust
// Register custom collectors
registry.register(Box::new(ContainerCollector::new()));
registry.register(Box::new(DockerAPICollector::new()));
registry.register(Box::new(CodeServerCollector::new()));
```

---

## Phase 4: Distributed Tracing (Week 2-3)

### 4.1 Tokio Console & Tracing
**Deliverable**: Real-time async task tracing

**Files to Create**:
```
src-tauri/src/tracing/
├── mod.rs              # Tracing module entry
├── console.rs          # Tokio-console server
├── spans.rs            # Custom span definitions
├── correlation.rs      # Trace ID propagation
└── exporters/
    ├── jaeger.rs       # Jaeger exporter (optional)
    └── zipkin.rs       # Zipkin exporter (optional)
```

**Dependencies (Cargo.toml)**:
```toml
console-subscriber = "0.4"  # Tokio-console integration
tracing-opentelemetry = "0.27"  # OpenTelemetry bridge
opentelemetry = { version = "0.27", features = ["trace", "rt-tokio"] }
opentelemetry-jaeger = { version = "0.27", features = ["rt-tokio"] }  # Optional
```

**Span Instrumentation**:
```rust
#[tracing::instrument(skip(self), fields(container_id = %id))]
async fn start_container(&self, id: &str, profile: &str) -> Result<()> {
    tracing::info!("starting container");
    // ...
}

#[tracing::instrument]
async fn discover_services(&self) -> Result<Vec<Service>> {
    let span = tracing::span!(tracing::Level::INFO, "mdns_discovery");
    let _enter = span.enter();
    // ...
}
```

**Trace Context Propagation**:
```rust
// Generate trace ID for cross-process correlation
let trace_id = uuid::Uuid::new_v4();
let span = tracing::span!(
    tracing::Level::INFO,
    "docker_operation",
    trace_id = %trace_id,
    operation = "container_start"
);
```

**Tokio Console Access**:
```bash
# Start Tauri app with console enabled
RUSTFLAGS="--cfg tokio_unstable" cargo tauri dev

# Connect tokio-console
tokio-console http://localhost:6669
```

**Features**:
- Real-time async task visualization
- Task spawn tree
- Task waker history
- Resource (mutex/semaphore) contention
- Poll time distribution

---

## Phase 5: Native Alerting (Week 3)

### 5.1 macOS Notification Center Integration
**Deliverable**: Critical alerts via native notifications

**Files to Create**:
```
src-tauri/src/alerts/
├── mod.rs              # Alerts module entry
├── notifier.rs         # macOS notification center bridge
├── rules.rs            # Alert rule engine
├── aggregation.rs      # Alert deduplication
└── channels/
    ├── email.rs        # SMTP email via lettre
    ├── slack.rs        # Slack webhook
    └── pagerduty.rs    # PagerDuty API
```

**Dependencies (Cargo.toml)**:
```toml
mac-notification-sys = "0.6"  # macOS notification bridge
lettre = "0.11"              # SMTP email
reqwest = { version = "0.11", features = ["json"] }  # HTTP client
cron = "0.12"                # Cron-based alert scheduling
```

**Alert Rules**:
```rust
// Container health alerts
container_down{severity="critical", profile, id}
  → "Container {profile} is down (ID: {id})"

container_cpu_high{severity="warning", threshold="80%"}
  → "Container {profile} CPU usage: {value}%"

container_memory_high{severity="warning", threshold="90%"}
  → "Container {profile} memory: {value}MB / {limit}MB"

container_restart_loop{severity="critical", count=5, window="5m"}
  → "Container {profile} restarting repeatedly"

// System alerts
disk_space_low{severity="warning", threshold="10%"}
  → "Disk space low: {available}GB remaining on {mount}"

memory_pressure{severity="warning", level="critical"}
  → "System memory pressure: {level}"

thermal_throttling{severity="warning"}
  → "CPU thermal throttling detected: {temperature}°C"
```

**Alert Deduplication**:
```rust
// Suppress duplicate alerts within 5 minutes
let dedup_key = format!("{}:{}:{}", rule_id, resource_id, threshold);
if !alert_cache.contains_key(&dedup_key) {
    send_alert(alert);
    alert_cache.insert(dedup_key, Instant::now());
}
```

**macOS Notification Example**:
```rust
use mac_notification_sys::*;

fn send_notification(title: &str, body: &str, urgency: Urgency) {
    let bundle = get_bundle_identifier_or_default("com.vibecode.app");
    set_application(&bundle).unwrap();

    Notification::new()
        .title(title)
        .subtitle("VibeCode Observability")
        .message(body)
        .sound(Sound::Default)
        .urgency(urgency)
        .send()
        .unwrap();
}
```

---

## Phase 6: SwiftUI Dashboard (Week 3-4)

### 6.1 Tauri WebView Dashboard
**Deliverable**: Real-time metrics visualization in native UI

**Architecture**:
```
src-tauri/src/dashboard.rs       # Dashboard API backend
src/components/observability/    # React components (Tauri webview)
├── DashboardLayout.tsx
├── MetricsPanel.tsx
├── LogViewer.tsx
├── TraceViewer.tsx
└── AlertManager.tsx
```

**Dashboard Features**:

#### Real-Time Metrics (1-second refresh)
```typescript
// Fetch from Tauri backend
import { invoke } from '@tauri-apps/api/core';

const metrics = await invoke<MetricsSnapshot>('get_metrics', {
  interval: '1m',
  containers: ['all']
});

// Display in Tremor charts
<LineChart
  data={metrics.cpu_history}
  index="timestamp"
  categories={["container_1", "container_2", "system"]}
  colors={["blue", "green", "gray"]}
  valueFormatter={(v) => `${v.toFixed(1)}%`}
/>
```

#### Live Log Viewer (WebSocket stream)
```typescript
// Stream logs from Tauri
import { listen } from '@tauri-apps/api/event';

useEffect(() => {
  const unlisten = listen('log-stream', (event) => {
    const log = event.payload as LogEntry;
    setLogs((prev) => [...prev.slice(-1000), log]);
  });
  return () => unlisten.then(f => f());
}, []);

// Display with react-virtualized-auto-sizer
<VirtualLogViewer
  logs={logs}
  filters={{ level: ['error', 'warn'], category: 'container' }}
  search={searchQuery}
/>
```

#### Trace Viewer (Waterfall chart)
```typescript
// Fetch trace spans
const trace = await invoke<TraceData>('get_trace', { trace_id });

// Display as waterfall
<TraceWaterfall
  spans={trace.spans}
  rootSpan={trace.root}
  duration={trace.duration_ms}
/>
```

#### Alert Manager (CRUD interface)
```typescript
// Alert rule management
const rules = await invoke<AlertRule[]>('list_alert_rules');

// Create new rule
await invoke('create_alert_rule', {
  rule: {
    name: 'High CPU Alert',
    metric: 'container_cpu_usage_percent',
    threshold: 80,
    duration: '5m',
    severity: 'warning',
    channels: ['notification', 'email']
  }
});
```

**Layout**:
```
┌─────────────────────────────────────────────┐
│ VibeCode Observability                      │
├─────────────────────────────────────────────┤
│ [Metrics] [Logs] [Traces] [Alerts]          │
├─────────────────────────────────────────────┤
│                                             │
│  📊 System Overview          📦 Containers  │
│  CPU: 45%  Mem: 8GB/16GB    • code-server-1 │
│                             • code-server-2 │
│  ──────────────────────────  • agentapi     │
│                                             │
│  📈 Metrics (Last 1h)                       │
│  [LineChart: CPU, Memory, Disk, Network]    │
│                                             │
│  📝 Recent Logs (Live)                      │
│  [VirtualList: 1000 most recent logs]       │
│                                             │
│  🔔 Active Alerts (3)                       │
│  ⚠️ Container CPU high (code-server-1)      │
│  ⚠️ Disk space low (80% used)               │
│  ℹ️ Container restarted (agentapi)          │
└─────────────────────────────────────────────┘
```

---

## Phase 7: Performance Insights (Week 4)

### 7.1 Historical Analysis & Regression Detection
**Deliverable**: Performance trend analysis and anomaly detection

**Files to Create**:
```
src-tauri/src/insights/
├── mod.rs              # Insights module entry
├── timeseries.rs       # Time-series database (in-memory)
├── anomaly.rs          # Statistical anomaly detection
├── regression.rs       # Performance regression detection
└── reports.rs          # Daily/weekly performance reports
```

**Features**:

#### Time-Series Storage (In-Memory)
```rust
// Keep 7 days of 1-minute granularity metrics
struct TimeSeriesDB {
    cpu: RingBuffer<MetricPoint, 10080>,      // 7d * 24h * 60m
    memory: RingBuffer<MetricPoint, 10080>,
    disk: RingBuffer<MetricPoint, 10080>,
    network: RingBuffer<MetricPoint, 10080>,
}

// Downsample for long-term storage (1h granularity, 90d)
struct DownsampledDB {
    hourly: Vec<AggregatedMetric>,  // 90d * 24h = 2160 points
}
```

#### Anomaly Detection
```rust
// Simple moving average + standard deviation
fn detect_anomaly(metric: &str, value: f64) -> Option<Anomaly> {
    let history = db.get_history(metric, Duration::from_secs(3600))?;
    let mean = history.iter().map(|p| p.value).sum::<f64>() / history.len() as f64;
    let stddev = (history.iter()
        .map(|p| (p.value - mean).powi(2))
        .sum::<f64>() / history.len() as f64)
        .sqrt();

    if (value - mean).abs() > 3.0 * stddev {
        Some(Anomaly {
            metric: metric.to_string(),
            value,
            expected: mean,
            deviation: (value - mean) / stddev,
            severity: if (value - mean).abs() > 5.0 * stddev {
                Severity::Critical
            } else {
                Severity::Warning
            },
        })
    } else {
        None
    }
}
```

#### Regression Detection
```rust
// Compare current performance to 7-day baseline
fn detect_regression(metric: &str) -> Option<Regression> {
    let current = db.get_avg(metric, Duration::from_secs(3600))?;
    let baseline = db.get_avg(metric, Duration::from_secs(86400 * 7))?;

    let change_pct = ((current - baseline) / baseline) * 100.0;

    if change_pct.abs() > 10.0 {
        Some(Regression {
            metric: metric.to_string(),
            current,
            baseline,
            change_pct,
            severity: if change_pct.abs() > 50.0 {
                Severity::Critical
            } else if change_pct.abs() > 25.0 {
                Severity::Warning
            } else {
                Severity::Info
            },
        })
    } else {
        None
    }
}
```

#### Daily Performance Report
```rust
// Generate daily summary
#[derive(Serialize)]
struct DailyReport {
    date: Date,
    containers: Vec<ContainerReport>,
    system: SystemReport,
    anomalies: Vec<Anomaly>,
    regressions: Vec<Regression>,
}

struct ContainerReport {
    id: String,
    name: String,
    profile: String,
    uptime_pct: f64,
    avg_cpu: f64,
    avg_memory_mb: f64,
    restart_count: u32,
    error_count: u32,
}

// Export as JSON/HTML
fn generate_daily_report() -> DailyReport {
    // Aggregate last 24h of metrics
    // Detect anomalies and regressions
    // Format as structured report
}
```

---

## Integration with Existing Systems

### Agent 21: Runtime Manager Integration
**Goal**: Monitor container lifecycle events

```rust
// src-tauri/src/docker.rs (enhance existing)
use crate::logging;
use crate::metrics;

async fn start_container(&self, config: ContainerConfig) -> Result<String> {
    let span = tracing::span!(tracing::Level::INFO, "start_container",
        profile = %config.profile);
    let _enter = span.enter();

    tracing::info!("starting container", profile = %config.profile);
    metrics::CONTAINER_STARTS_TOTAL.with_label_values(&[&config.profile]).inc();

    let start = Instant::now();
    let result = self.docker.create_container(config).await;
    metrics::CONTAINER_START_DURATION
        .with_label_values(&[&config.profile])
        .observe(start.elapsed().as_secs_f64());

    match result {
        Ok(id) => {
            tracing::info!("container started", id = %id);
            Ok(id)
        }
        Err(e) => {
            tracing::error!("container start failed", error = %e);
            metrics::CONTAINER_START_ERRORS_TOTAL
                .with_label_values(&[&config.profile])
                .inc();
            Err(e)
        }
    }
}
```

### Agent 22: VM Manager Integration
**Goal**: Monitor Docker VM performance

```rust
// src-tauri/src/metrics/vm.rs
pub struct VMCollector {
    docker: Arc<Docker>,
}

impl VMCollector {
    pub async fn collect(&self) -> VMMetrics {
        // Query Docker for VM stats
        let info = self.docker.info().await?;

        VMMetrics {
            cpu_usage_pct: info.ncpu.unwrap_or(0) as f64,
            memory_usage_bytes: info.mem_total.unwrap_or(0),
            disk_usage_bytes: self.get_vm_disk_usage().await?,
            containers_running: info.containers_running.unwrap_or(0),
        }
    }
}
```

### Agent 26: Orchestrator Integration
**Goal**: Provide health status for orchestration decisions

```rust
// src-tauri/src/commands.rs (add new command)
#[tauri::command]
async fn get_fleet_health(state: State<'_, AppState>) -> Result<FleetHealth, String> {
    let metrics = state.metrics.get_current_metrics().await
        .map_err(|e| e.to_string())?;

    Ok(FleetHealth {
        healthy_containers: metrics.containers.iter()
            .filter(|c| c.state == "running" && c.cpu_usage < 80.0)
            .count(),
        total_containers: metrics.containers.len(),
        system_memory_available_pct: metrics.system.memory_available_pct,
        alerts_active: state.alerts.get_active_count().await,
    })
}
```

---

## Performance Budget & Validation

### Resource Limits
```rust
// src-tauri/src/config.rs
pub struct ObservabilityConfig {
    // CPU: <2% target
    max_cpu_pct: f64,           // 2.0

    // Memory: <100MB target
    max_memory_mb: usize,       // 100

    // Disk: metrics retention
    metrics_retention_days: u32,  // 7
    logs_retention_days: u32,     // 7
    max_disk_usage_mb: usize,     // 500

    // Collection intervals
    system_metrics_interval_secs: u64,      // 60
    container_metrics_interval_secs: u64,   // 10
    power_metrics_interval_secs: u64,       // 300

    // Prometheus endpoint
    prometheus_port: u16,       // 9091
    prometheus_enabled: bool,   // true
}
```

### Validation Tests
```rust
// tests/observability_performance.rs
#[tokio::test]
async fn test_cpu_usage_under_limit() {
    let metrics_collector = MetricsCollector::new().await;
    let system = System::new_all();

    // Run collector for 60 seconds
    let start = Instant::now();
    while start.elapsed() < Duration::from_secs(60) {
        metrics_collector.collect().await;
        tokio::time::sleep(Duration::from_secs(1)).await;
    }

    // Measure CPU usage
    let cpu_usage = system.process(std::process::id())
        .map(|p| p.cpu_usage())
        .unwrap_or(0.0);

    assert!(cpu_usage < 2.0, "CPU usage {cpu_usage}% exceeds 2% limit");
}

#[tokio::test]
async fn test_memory_usage_under_limit() {
    let metrics_collector = MetricsCollector::new().await;

    // Run collector and measure memory
    tokio::time::sleep(Duration::from_secs(60)).await;

    let memory_mb = metrics_collector.memory_usage_mb();
    assert!(memory_mb < 100, "Memory usage {memory_mb}MB exceeds 100MB limit");
}
```

---

## Deployment & Configuration

### Feature Flags
```toml
# Cargo.toml features
[features]
default = ["native-observability"]
native-observability = [
    "oslog",
    "tracing",
    "prometheus",
    "console-subscriber"
]
datadog = ["dd-trace"]    # Legacy external monitoring
opentelemetry = ["opentelemetry-jaeger"]
```

### Environment Configuration
```bash
# .env.local
OBSERVABILITY_ENABLED=true
OBSERVABILITY_MODE=native      # native | datadog | otel | hybrid

# Native observability config
METRICS_PORT=9091
METRICS_INTERVAL_SECS=60
LOGS_RETENTION_DAYS=7
METRICS_RETENTION_DAYS=7
ALERTS_ENABLED=true
DASHBOARD_ENABLED=true

# Tokio console (dev only)
TOKIO_CONSOLE_ENABLED=true
TOKIO_CONSOLE_PORT=6669
```

### Tauri Configuration
```json
// tauri.conf.json
{
  "plugins": {
    "observability": {
      "enabled": true,
      "mode": "native",
      "prometheus": {
        "port": 9091,
        "enabled": true
      },
      "logging": {
        "subsystem": "com.vibecode.app",
        "retention_days": 7
      },
      "alerts": {
        "notification_center": true,
        "channels": ["notification", "email"]
      }
    }
  }
}
```

---

## Migration Plan: Datadog → Native

### Phase 1: Parallel Operation (Week 1-2)
- Deploy native observability alongside Datadog
- Compare metrics for accuracy (±5% acceptable)
- Validate alerting rules fire correctly

### Phase 2: Gradual Cutover (Week 3)
- Switch dashboard to native UI
- Keep Datadog as backup for 1 week
- Monitor for regressions

### Phase 3: Full Native (Week 4)
- Disable Datadog in production
- Remove dd-trace dependency
- Document performance improvements

### Rollback Plan
```bash
# Revert to Datadog if needed
OBSERVABILITY_MODE=datadog npm run tauri:dev

# Or hybrid mode (both systems)
OBSERVABILITY_MODE=hybrid npm run tauri:dev
```

---

## Success Metrics

### Performance Targets
- ✅ CPU usage: <2% average, <5% peak
- ✅ Memory usage: <100MB average, <150MB peak
- ✅ Disk usage: <500MB (7 days retention)
- ✅ Metrics collection latency: <100ms p99
- ✅ Dashboard render time: <1s initial load

### Functional Targets
- ✅ 100% container lifecycle events captured
- ✅ 95% metric accuracy vs external tools
- ✅ <1min alert latency (detection → notification)
- ✅ Zero data loss during log rotation
- ✅ Dashboard available offline (local data only)

### User Experience
- ✅ Native macOS notifications work
- ✅ Dashboard responsive (<16ms frame time)
- ✅ Log search completes in <200ms
- ✅ Zero external dependencies required

---

## Next Steps

1. **Immediate**: Review plan with team, adjust scope if needed
2. **Week 1**: Implement Phase 1 (Unified Logging) & Phase 2 (MetricKit)
3. **Week 2**: Implement Phase 3 (Custom Metrics) & Phase 4 (Tracing)
4. **Week 3**: Implement Phase 5 (Alerts) & Phase 6 (Dashboard UI)
5. **Week 4**: Implement Phase 7 (Insights), performance validation, migration
6. **Week 5**: Production rollout, monitor performance, iterate

---

## References

- [oslog-rs](https://github.com/stijnfrishert/oslog-rs) - macOS os_log FFI
- [sysinfo](https://github.com/GuillaumeGomez/sysinfo) - Cross-platform system info
- [prometheus-client](https://docs.rs/prometheus/latest/prometheus/) - Prometheus metrics
- [tracing](https://docs.rs/tracing/latest/tracing/) - Structured logging
- [tokio-console](https://github.com/tokio-rs/console) - Async task debugging
- [Tauri](https://tauri.app/v2/guides/) - Native app framework

---

**Status**: ✅ PLAN COMPLETE - READY FOR IMPLEMENTATION
**Agent**: Agent 27 (Staff SRE - Native macOS Observability)
**Date**: 2025-10-02
**Estimated Effort**: 4-5 weeks (1 engineer, full-time)
