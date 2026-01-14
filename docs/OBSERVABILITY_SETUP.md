# VibeCode Observability Setup Guide

Complete guide to setting up comprehensive observability for VibeCode.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Local Monitoring (No Cloud)](#local-monitoring-no-cloud)
3. [Datadog Cloud Integration](#datadog-cloud-integration)
4. [Health Check Endpoints](#health-check-endpoints)
5. [Custom Metrics](#custom-metrics)
6. [Log Aggregation](#log-aggregation)
7. [Distributed Tracing](#distributed-tracing)

## Quick Start

### Level 1: No Setup (Default)

VibeCode works out of the box with **zero monitoring overhead**.

```bash
vibecode-vm start
# Everything works, no telemetry
```

### Level 2: Local Monitoring (5 minutes)

Enable local metrics stored on your machine:

```bash
# Edit config
vibecode-vm config edit

# Add this section:
[metrics]
enabled = true
local_only = true
retention_days = 30
```

Then view metrics:

```bash
# View local metrics
cat ~/.vibecode/metrics/app-metrics.json

# Monitor in real-time
vibecode-vm logs -f | grep -i metric
```

### Level 3: Datadog Cloud (15 minutes)

Enable full cloud monitoring:

```bash
# 1. Get API keys from Datadog
export DD_API_KEY="your-key"
export DD_APP_KEY="your-app-key"
export DD_SITE="datadoghq.com"

# 2. Edit config
vibecode-vm config edit

# Add:
[datadog]
enabled = true
api_key = "${DD_API_KEY}"
app_key = "${DD_APP_KEY}"
site = "${DD_SITE}"

# 3. Start VM
vibecode-vm start

# 4. View in Datadog UI
open https://app.datadoghq.com/logs
```

## Local Monitoring (No Cloud)

### Metrics Storage

Metrics stored locally at `~/.vibecode/metrics/`:

```bash
$ ls -la ~/.vibecode/metrics/
drwxr-xr-x  app-metrics.json          # App launch data
drwxr-xr-x  vm-metrics.json           # VM performance
drwxr-xr-x  service-metrics.json      # Service health
drwxr-xr-x  error-metrics.json        # Errors and crashes
```

### Viewing Local Metrics

```bash
# Pretty-print metrics
cat ~/.vibecode/metrics/vm-metrics.json | jq .

# Search metrics
jq '.boot_times[]' ~/.vibecode/metrics/vm-metrics.json

# Count metrics
jq '.[] | length' ~/.vibecode/metrics/*.json | awk '{sum+=$1} END {print sum}'
```

### Creating Custom Local Metrics

In your Swift app:

```swift
import os

let logger = Logger(subsystem: "com.vibecode.app", category: "metrics")

// Log metric
logger.notice("metric: boot_time=26500ms")
logger.notice("metric: memory_usage=456mb")
logger.notice("metric: services_started=4")
```

In VM, add to logs:

```bash
# In shell script
echo "$(date -u +%FT%TZ): metric boot_time=26500" >> /var/log/vibecode-metrics.log
```

### Analyzing Local Metrics

```bash
#!/bin/bash
# analyze-metrics.sh

METRICS_DIR="$HOME/.vibecode/metrics"

echo "=== VibeCode Local Metrics Report ==="

# Boot times
echo ""
echo "Boot Times (last 10):"
jq '.boot_times | last(10)[]' "$METRICS_DIR/vm-metrics.json" | tail -10

# Memory usage
echo ""
echo "Memory Usage Stats:"
jq '.memory_usage | {min: min, max: max, avg: (add/length)}' "$METRICS_DIR/vm-metrics.json"

# Service startup times
echo ""
echo "Service Startup Times:"
jq '.services | to_entries | .[] | "\(.key): \(.value.startup_time)ms"' "$METRICS_DIR/service-metrics.json"

# Errors
echo ""
echo "Recent Errors:"
jq '.errors | last(5)[]' "$METRICS_DIR/error-metrics.json"
```

Run locally:

```bash
chmod +x analyze-metrics.sh
./analyze-metrics.sh
```

## Datadog Cloud Integration

### Prerequisites

- Datadog account (free trial available)
- API Key
- Application Key

### Setup Steps

#### 1. Get Keys

In Datadog UI:

1. Click your avatar → "Organization Settings"
2. Select "API Keys" → "New API Key"
3. Name: "VibeCode"
4. Copy the key
5. Select "Application Keys"
6. Click "New Application Key"
7. Name: "VibeCode"
8. Copy the key

#### 2. Configure VibeCode

```bash
# Option 1: Environment variables
export DD_API_KEY="key_here"
export DD_APP_KEY="app_key_here"
export DD_SITE="datadoghq.com"
export DD_LOGS_ENDPOINT="http-intake.logs.datadoghq.com"

# Option 2: Config file
vibecode-vm config edit

# Add:
[datadog]
enabled = true
api_key = "key_here"
app_key = "app_key_here"
site = "datadoghq.com"
```

#### 3. Start VM

```bash
vibecode-vm start
```

#### 4. Verify Connection

In Datadog, go to Logs → Log Explorer:

```
service:vibecode
```

Should see logs within 1-2 minutes.

### Sending Metrics

Metrics are sent automatically when Datadog is configured.

Manually send metrics:

```bash
# From host
curl -X POST "https://api.datadoghq.com/api/v2/series" \
  -H "DD-API-KEY: $DD_API_KEY" \
  -H "Content-Type: application/json" \
  -d @- << 'JSON'
{
  "series": [{
    "metric": "vibecode.custom.metric",
    "type": "gauge",
    "unit": "ms",
    "points": [{
      "timestamp": $(date +%s),
      "value": 12345
    }],
    "tags": ["app:vibecode", "version:3.2.1"]
  }]
}
JSON
```

## Health Check Endpoints

### VM Health Endpoint

SSH into VM and create health check service:

```bash
vibecode-vm ssh

# Create health check script
cat > /root/health-check.sh << 'EOF'
#!/bin/bash
echo "=== VibeCode Health Check ==="

# Check OpenVSCode
echo -n "OpenVSCode: "
curl -s -f http://localhost:8080 > /dev/null && echo "OK" || echo "DOWN"

# Check SSH
echo -n "SSH: "
ss -tlnp | grep -q :22 && echo "OK" || echo "DOWN"

# Check PostgreSQL
echo -n "PostgreSQL: "
psql -U postgres -d postgres -c "SELECT 1" > /dev/null 2>&1 && echo "OK" || echo "DOWN"

# Check Valkey
echo -n "Valkey: "
redis-cli PING > /dev/null 2>&1 && echo "OK" || echo "DOWN"

# Performance metrics
echo ""
echo "Performance:"
echo "  Boot time: $(cat /var/log/vibecode-boot-time.log)"
echo "  Memory: $(free -h | awk 'NR==2 {print $3}')"
echo "  CPU: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}')"
EOF

chmod +x /root/health-check.sh
```

Run health check:

```bash
vibecode-vm ssh "/root/health-check.sh"
```

### HTTP Health Endpoint

Create a health endpoint in OpenVSCode:

```bash
vibecode-vm ssh

# Create health endpoint
cat > /root/health-endpoint.sh << 'EOF'
#!/bin/bash
# Start simple HTTP server with health check

PORT=9000
while true; do
  # Prepare health data
  STATUS=$(cat << JSON
{
  "status": "healthy",
  "timestamp": "$(date -u +%FT%TZ)",
  "services": {
    "openvscode": $(curl -s -f http://localhost:8080 > /dev/null && echo "up" || echo "down"),
    "ssh": $(ss -tlnp | grep -q :22 && echo "up" || echo "down"),
    "postgresql": $(psql -U postgres -d postgres -c "SELECT 1" 2>&1 | grep -q "1 row" && echo "up" || echo "down"),
    "valkey": $(redis-cli PING 2>&1 | grep -q "PONG" && echo "up" || echo "down")
  },
  "metrics": {
    "memory_mb": $(free -b | awk 'NR==2 {print int($3/1048576)}'),
    "cpu_percent": $(top -bn1 | grep "Cpu(s)" | awk '{print int($2)}'),
    "uptime_seconds": $(cat /proc/uptime | awk '{print int($1)}')
  }
}
JSON
)
    echo "$STATUS"
done | nc -l 127.0.0.1 $PORT
EOF

chmod +x /root/health-endpoint.sh
```

Test endpoint:

```bash
vibecode-vm ssh
/root/health-endpoint.sh &

# From host
curl http://192.168.64.10:9000 | jq .
```

## Custom Metrics

### Metric Naming Convention

Use this format for custom metrics:

```
vibecode.<component>.<metric_name>
```

Examples:

```
vibecode.app.launches
vibecode.app.crashes
vibecode.vm.boot_time
vibecode.vm.memory
vibecode.service.ssh.connections
vibecode.service.postgresql.connections
vibecode.service.valkey.memory
vibecode.extension.datadog.commands
vibecode.feature.adoption
```

### Sending Custom Metrics

From Swift app:

```swift
import os

let logger = Logger(subsystem: "com.vibecode.app", category: "metrics")

// Record boot time
let bootTime = Date().timeIntervalSince(appStartTime) * 1000
logger.notice("metric: vibecode.vm.boot_time=\(Int(bootTime))ms")

// Record feature usage
logger.notice("metric: vibecode.feature.adoption tag:feature=datadog value=1")
```

From VM (bash):

```bash
# Send to local log
TIMESTAMP=$(date +%s)
echo "$TIMESTAMP vibecode.vm.memory=$MEMORY_MB" >> /var/log/vibecode-metrics.log

# Send to Datadog API
curl -X POST "https://api.datadoghq.com/api/v2/series" \
  -H "DD-API-KEY: $DD_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"series\": [{\"metric\": \"vibecode.vm.memory\", \"points\": [[${TIMESTAMP}, ${MEMORY_MB}]]}]}"
```

## Log Aggregation

### Local Log Files

Logs stored in multiple locations:

```bash
# Swift app logs
~/Library/Logs/VibeCode/app.log

# VM service logs
vibecode-vm ssh "cat /var/log/console.log"
vibecode-vm ssh "cat /var/log/postgres.log"
vibecode-vm ssh "cat /var/log/valkey.log"
vibecode-vm ssh "cat /var/log/ssh.log"

# OpenVSCode logs
vibecode-vm ssh "cat ~/.openvscode-server/logs/window1.log"
```

### Searching Logs

```bash
# Find errors
vibecode-vm logs | grep ERROR

# Find specific service
vibecode-vm logs | grep "service=postgresql"

# Find by timestamp
vibecode-vm logs | grep "2026-01-14"

# Follow in real-time
vibecode-vm logs -f
```

### Log Format

Logs use standard format:

```
[2026-01-14T10:30:00Z] [service=vibecode] [level=INFO] Message here
[2026-01-14T10:30:01Z] [service=postgresql] [level=INFO] Connection accepted
[2026-01-14T10:30:02Z] [service=valkey] [level=INFO] Ready to accept connections
```

## Distributed Tracing

### OpenTelemetry Integration

If you want distributed tracing, configure OpenTelemetry:

```bash
# Set trace endpoint
export OTEL_EXPORTER_OTLP_ENDPOINT="https://api.datadoghq.com"
export OTEL_EXPORTER_OTLP_HEADERS="dd-api-key=$DD_API_KEY"
export OTEL_SERVICE_NAME="vibecode"
export OTEL_RESOURCE_ATTRIBUTES="service.name=vibecode,service.version=3.2.1"

vibecode-vm start
```

### Enabling Traces in Swift

```swift
import OpenTelemetry

let tracer = OpenTelemetry.instance.tracerProvider.tracer(name: "vibecode")

// Start a span
let span = tracer.startSpan(name: "vm-boot")
defer { span.end() }

// Add attributes
span.setAttribute(key: "service", value: "postgresql")
span.setAttribute(key: "duration_ms", value: 2100)
```

### Viewing Traces

In Datadog:

1. Go to APM → Traces
2. Search for: `service:vibecode`
3. Click a trace to see full flow

## Summary

### Monitoring Setup Comparison

| Feature | Local | Datadog |
|---------|-------|---------|
| **Setup Time** | 5 minutes | 15 minutes |
| **Cost** | Free | Free (SaaS) |
| **Data Location** | Your machine | Datadog servers |
| **Retention** | Your choice | 15 days |
| **Features** | Basic | Advanced |
| **Cloud Integration** | No | Yes |
| **Alerting** | Manual | Automatic |

### Next Steps

1. Start with local monitoring (Level 2)
2. Once comfortable, add Datadog (Level 3)
3. Create custom dashboards
4. Set up alerts for important metrics
5. Review metrics regularly

---

**Last Updated**: 2026-01-14
**Version**: VibeCode v3.2.1
