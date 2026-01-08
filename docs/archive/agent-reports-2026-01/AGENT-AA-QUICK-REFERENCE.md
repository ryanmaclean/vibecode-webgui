# Agent AA - Advanced Observability Quick Reference

**Quick Start Guide for Developers & Operators**

---

## 60-Second Quick Start

```bash
# 1. Deploy observability stack
cd /Users/ryan.maclean/vibecode-webgui/azure
chmod +x observability-stack-setup.sh
./observability-stack-setup.sh

# 2. Start all services
/opt/observability/bin/start-observability.sh

# 3. Access dashboards
open http://localhost:3000  # Grafana (admin/admin)
open http://localhost:9090  # Prometheus
open http://localhost:16686 # Jaeger tracing
```

---

## Service Endpoints

| Service | Endpoint | Purpose |
|---------|----------|---------|
| **Grafana** | http://localhost:3000 | Dashboards & visualization |
| **Prometheus** | http://localhost:9090 | Metrics & queries |
| **Jaeger UI** | http://localhost:16686 | Distributed tracing |
| **Loki** | http://localhost:3100 | Log aggregation |
| **OTEL Collector** | http://localhost:4317 (gRPC) | Telemetry ingestion |
| **OTEL Collector** | http://localhost:4318 (HTTP) | Telemetry ingestion |

**Default Credentials**:
- Grafana: `admin` / `admin`

---

## Common Operations

### View Real-Time Metrics

```bash
# Prometheus queries
curl 'http://localhost:9090/api/v1/query?query=up'

# Service metrics
curl 'http://localhost:9090/api/v1/query?query=service_requests_total'

# CPU usage by service
curl 'http://localhost:9090/api/v1/query?query=process_cpu_seconds_total'
```

### Query Logs

```bash
# Query Loki logs
curl -G 'http://localhost:3100/loki/api/v1/query' \
  --data-urlencode 'query={service="valkey"}' \
  --data-urlencode 'limit=10'

# Search for errors
curl -G 'http://localhost:3100/loki/api/v1/query' \
  --data-urlencode 'query={service=~".+"} |~ "ERROR"' \
  --data-urlencode 'limit=50'
```

### Find Traces

```bash
# List recent traces
curl 'http://localhost:16686/api/traces?service=openvscode&limit=20'

# Get specific trace
curl 'http://localhost:16686/api/traces/{trace-id}'
```

---

## Essential Prometheus Queries

### Service Health

```promql
# Service uptime
up{job=~".+"}

# Request rate (per second)
rate(http_requests_total[5m])

# Error rate
rate(http_requests_total{status_code=~"5.."}[5m]) / rate(http_requests_total[5m])

# P95 latency
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
```

### Resource Usage

```promql
# CPU usage
rate(process_cpu_seconds_total[5m]) * 100

# Memory usage (MB)
process_resident_memory_bytes / 1024 / 1024

# Disk I/O
rate(node_disk_io_time_seconds_total[5m])
```

### Service-Specific

```promql
# Valkey: Commands per second
rate(redis_commands_total[5m])

# PostgreSQL: Queries per second
rate(postgresql_queries_total[5m])

# OpenVSCode: Active connections
http_connections{service="openvscode"}
```

---

## LogQL Queries (Loki)

### Basic Queries

```logql
# All logs from a service
{service="valkey"}

# Logs with specific level
{service="postgresql"} | json | level="ERROR"

# Full-text search
{service="openvscode"} |~ "timeout"

# Multiple filters
{service=~"valkey|postgresql"} | json | level="ERROR" | line_format "{{.timestamp}} {{.message}}"
```

### Advanced Queries

```logql
# Error rate (per minute)
rate({service=~".+"} |~ "ERROR" [1m])

# Logs grouped by service
sum by (service) (rate({service=~".+"} [5m]))

# Top 10 error messages
topk(10, sum by (message) (rate({level="ERROR"} [1h])))
```

---

## Grafana Dashboard Shortcuts

### Navigate Dashboards

- **Home**: Click Grafana logo (top-left)
- **Search**: Press `/` or `Ctrl+K`
- **Time Range**: Click time picker (top-right)
- **Refresh**: Click refresh icon or press `Shift+R`
- **Share**: Click share icon (top-right)

### Dashboard Keyboard Shortcuts

- `d` + `k`: Toggle kiosk mode
- `d` + `s`: Dashboard settings
- `d` + `v`: View mode (cycle)
- `t` + `z`: Zoom out time range
- `t` + `←/→`: Move time range back/forward

---

## Alert Management

### Check Active Alerts

```bash
# Prometheus alerts
curl 'http://localhost:9090/api/v1/alerts'

# Grafana alerts
curl -H "Authorization: Bearer ${GRAFANA_API_KEY}" \
  'http://localhost:3000/api/alerts'
```

### Alert States

- **Pending**: Condition met, waiting for `for` duration
- **Firing**: Alert actively firing
- **Resolved**: Condition no longer met

---

## Troubleshooting

### Services Won't Start

```bash
# Check logs
tail -f /var/log/observability/*.log

# Verify ports are available
netstat -tlnp | grep -E '(3000|9090|4317|16686)'

# Check disk space
df -h /var/lib/observability

# Check memory
free -h
```

### No Metrics Appearing

```bash
# Verify OTEL Collector is running
curl http://localhost:13133/health

# Check Prometheus targets
curl 'http://localhost:9090/api/v1/targets'

# Verify service is sending metrics
tcpdump -i lo port 4317  # gRPC traffic
```

### Traces Not Showing

```bash
# Check Jaeger backend
curl 'http://localhost:16686/api/services'

# Verify OTEL Collector trace pipeline
curl 'http://localhost:13133/health/traces'

# Check sampling configuration
cat /opt/observability/config/otel-collector.yaml | grep -A 10 tail_sampling
```

---

## Performance Optimization

### Reduce Memory Usage

```yaml
# Edit otel-collector.yaml
processors:
  memory_limiter:
    limit_mib: 256  # Reduce from 512
    spike_limit_mib: 64
```

### Reduce Disk Usage

```bash
# Prometheus retention
prometheus --storage.tsdb.retention.time=7d  # Reduce from 90d

# Delete old data
rm -rf /var/lib/observability/prometheus/data/*
```

### Reduce Trace Volume

```yaml
# Edit otel-collector.yaml
processors:
  probabilistic_sampler:
    sampling_percentage: 1.0  # Sample only 1%
```

---

## Integration Examples

### Send Custom Metrics (Python)

```python
from opentelemetry import metrics
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import OTLPMetricExporter

# Setup
exporter = OTLPMetricExporter(endpoint="http://localhost:4317")
provider = MeterProvider(metric_exporters=[exporter])
metrics.set_meter_provider(provider)

# Create meter
meter = metrics.get_meter(__name__)

# Counter
requests_counter = meter.create_counter(
    "http_requests_total",
    description="Total HTTP requests",
)
requests_counter.add(1, {"endpoint": "/api/users", "method": "GET"})

# Histogram
latency_histogram = meter.create_histogram(
    "http_request_duration_seconds",
    description="HTTP request latency",
)
latency_histogram.record(0.145, {"endpoint": "/api/users"})
```

### Send Traces (Node.js)

```javascript
const { NodeTracerProvider } = require('@opentelemetry/sdk-trace-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');

// Setup
const provider = new NodeTracerProvider();
const exporter = new OTLPTraceExporter({
  url: 'http://localhost:4318/v1/traces'
});
provider.addSpanProcessor(new BatchSpanProcessor(exporter));
provider.register();

// Create span
const tracer = provider.getTracer('my-service');
const span = tracer.startSpan('database-query');
span.setAttribute('db.operation', 'SELECT');
span.end();
```

---

## Datadog Integration

### Enable Datadog APM

```bash
# Set API key
export DD_API_KEY="your_api_key_here"
export DD_SITE="datadoghq.com"

# Restart OTEL Collector to pick up env vars
pkill otelcol-contrib
/opt/observability/bin/start-observability.sh
```

### Verify Datadog Export

```bash
# Check OTEL Collector logs
tail -f /var/log/observability/otel-collector.log | grep datadog

# Verify metrics in Datadog UI
# https://app.datadoghq.com/metric/explorer
```

---

## Common Grafana Dashboards

### Available Dashboards

1. **Executive Overview** - High-level system health
2. **Service Overview** - Per-service metrics
3. **Valkey Dashboard** - Redis cache metrics
4. **PostgreSQL Dashboard** - Database metrics
5. **OpenVSCode Dashboard** - Editor metrics
6. **SLO Tracking** - Availability & error budget
7. **Logs Explorer** - Log search & analysis
8. **Trace Explorer** - Distributed tracing

### Import Dashboard

```bash
# Via API
curl -X POST -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${GRAFANA_API_KEY}" \
  -d @dashboard.json \
  http://localhost:3000/api/dashboards/db

# Or upload via UI: + → Import → Upload JSON
```

---

## SLO Monitoring

### Check SLO Compliance

```bash
# Availability SLO (99.95% target)
curl -G 'http://localhost:9090/api/v1/query' \
  --data-urlencode 'query=avg_over_time(up[30d]) >= 0.9995'

# Error rate SLO (<0.1% errors)
curl -G 'http://localhost:9090/api/v1/query' \
  --data-urlencode 'query=(sum(rate(http_requests_total{status_code=~"5.."}[30d])) / sum(rate(http_requests_total[30d]))) < 0.001'
```

### Error Budget Remaining

```promql
# Remaining error budget (30-day window)
1 - (
  (sum(rate(http_requests_total{status_code=~"5.."}[30d])) / sum(rate(http_requests_total[30d])))
  / (1 - 0.9995)
)
```

---

## Stop Services

```bash
# Stop all observability services
pkill prometheus
pkill otelcol-contrib
pkill loki
pkill promtail
pkill jaeger-all-in-one
pkill grafana-server

# Or kill by PID
kill $(cat /tmp/prometheus.pid)
kill $(cat /tmp/grafana.pid)
```

---

## Environment Variables

```bash
# OpenTelemetry
export OTEL_EXPORTER_OTLP_ENDPOINT="http://localhost:4317"
export OTEL_SERVICE_NAME="my-service"
export OTEL_TRACES_SAMPLER="parentbased_traceidratio"
export OTEL_TRACES_SAMPLER_ARG="0.1"

# Datadog
export DD_API_KEY="your_key"
export DD_SITE="datadoghq.com"
export DD_ENV="production"
export DD_SERVICE="unified-services-vm"
export DD_VERSION="1.0.0"

# Prometheus
export PROMETHEUS_RETENTION="90d"
export PROMETHEUS_STORAGE_PATH="/var/lib/observability/prometheus"
```

---

## Useful Links

- **Prometheus Documentation**: https://prometheus.io/docs/
- **Grafana Documentation**: https://grafana.com/docs/
- **OpenTelemetry Documentation**: https://opentelemetry.io/docs/
- **Loki Documentation**: https://grafana.com/docs/loki/latest/
- **Jaeger Documentation**: https://www.jaegertracing.io/docs/

---

## Support & Troubleshooting

### Check System Status

```bash
# All services status
ps aux | grep -E '(prometheus|grafana|otel|loki|jaeger)'

# Check ports
netstat -tlnp | grep -E '(3000|9090|4317|16686)'

# View logs
ls -lh /var/log/observability/
```

### Get Help

```bash
# Prometheus help
prometheus --help

# OTEL Collector help
otelcol-contrib --help

# Grafana help
grafana-server --help
```

---

## File Locations

```
/opt/observability/
├── bin/                  # Binaries
├── config/               # Configuration files
├── dashboards/           # Grafana dashboards
├── prometheus/           # Prometheus installation
├── grafana/              # Grafana installation
└── jaeger/               # Jaeger installation

/var/lib/observability/
├── prometheus/           # Metrics data
├── loki/                 # Log data
└── grafana/              # Grafana data

/var/log/observability/
├── prometheus.log
├── otel-collector.log
├── loki.log
├── promtail.log
├── jaeger.log
└── grafana.log
```

---

**Agent AA Sign-off**: 2026-01-05 15:45 UTC
**Status**: ✅ Quick Reference Complete
