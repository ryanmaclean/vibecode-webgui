# Datadog Integration Guide for VibeCode

Complete guide to integrating Datadog monitoring with VibeCode.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Setup Steps](#setup-steps)
3. [Datadog Extension Features](#datadog-extension-features)
4. [Sending Metrics](#sending-metrics)
5. [Custom Dashboards](#custom-dashboards)
6. [Alert Configuration](#alert-configuration)
7. [Troubleshooting](#troubleshooting)

## Quick Start

### 1. Get Datadog Account

- Go to [datadog.com](https://www.datadog.com)
- Sign up for free trial or create account
- Log in to Datadog

### 2. Get API Keys

```bash
# In Datadog UI:
# 1. Click Organization Settings (bottom left)
# 2. Select "API Keys"
# 3. Click "New API Key"
# 4. Name it "VibeCode"
# 5. Copy the API Key

# Also get Application Key:
# 1. In Organization Settings
# 2. Select "Application Keys"
# 3. Click "New Application Key"
# 4. Name it "VibeCode"
# 5. Copy the Application Key
```

### 3. Set Environment Variables

```bash
export DD_API_KEY="your-api-key-here"
export DD_APP_KEY="your-app-key-here"
export DD_SITE="datadoghq.com"  # or "datadogheu.com" for EU
```

### 4. Start VibeCode

```bash
vibecode-vm start
```

### 5. Access OpenVSCode

```bash
# Get VM IP
vibecode-vm status | grep "IP Address"

# Open in browser
open http://<VM_IP>:8080
```

### 6. Use Datadog Extension

1. Press `Ctrl+Shift+X` to open Extensions
2. Find "Datadog" in installed extensions
3. Click it
4. Click "Sign in with OAuth"
5. Authenticate with your Datadog account
6. Explore logs, metrics, and traces

## Setup Steps

### Prerequisites

- VibeCode VM installed (`vibecode-vm` command available)
- Datadog account (free or paid)
- API Key and Application Key from Datadog

### Step 1: Create Datadog API Keys

In Datadog UI:

1. Click your avatar → Organization Settings
2. In left menu, select "API Keys"
3. Click "New API Key"
   - Name: "VibeCode"
   - Copy the key
4. Select "Application Keys"
5. Click "New Application Key"
   - Name: "VibeCode"
   - Copy the key

### Step 2: Configure Environment

Save API keys in your shell profile:

```bash
# In ~/.zshrc or ~/.bash_profile
export DD_API_KEY="your-api-key"
export DD_APP_KEY="your-app-key"
export DD_SITE="datadoghq.com"

# Optional: where to send logs
export DD_LOGS_ENDPOINT="http-intake.logs.datadoghq.com"

# Optional: custom tags
export DD_TAGS="app:vibecode,version:3.2.1,environment:local"
```

Or set temporarily:

```bash
export DD_API_KEY="..."
export DD_APP_KEY="..."
export DD_SITE="datadoghq.com"
vibecode-vm start
```

### Step 3: Configure VibeCode

Edit the VM configuration:

```bash
vibecode-vm config edit

# Add these lines:
METRICS_ENABLED=true
METRICS_CLOUD_ENABLED=true
DD_API_KEY="your-key"
DD_APP_KEY="your-app-key"
DD_SITE="datadoghq.com"
```

Or create `~/.vibecode/config.json`:

```json
{
  "metrics": {
    "enabled": true,
    "cloud_enabled": true,
    "datadog_api_key": "your-key",
    "datadog_app_key": "your-app-key",
    "datadog_site": "datadoghq.com"
  }
}
```

### Step 4: Start VM

```bash
vibecode-vm start
```

Check logs for confirmation:

```bash
vibecode-vm logs | grep -i "datadog"
```

### Step 5: Verify Integration

In Datadog UI:

1. Go to Logs → Logs Explorer
2. Search for: `service:vibecode`
3. Should see boot logs and metrics

## Datadog Extension Features

### What It Does

The Datadog VSCode extension provides:

- **Real-time Logs**: Search and filter logs
- **Metrics Browser**: View all infrastructure metrics
- **Distributed Traces**: Follow requests through services
- **Error Tracking**: Monitor application errors
- **Monitors**: Set up and manage alerts
- **Dashboards**: Access saved dashboards
- **Service Map**: Visualize service dependencies

### Commands Available

Open Command Palette (Cmd+Shift+P) and search:

| Command | What It Does |
|---------|--------------|
| `Datadog: Open Logs` | Open log explorer |
| `Datadog: Open Metrics` | Browse all metrics |
| `Datadog: Open Traces` | View distributed traces |
| `Datadog: Open Events` | See recent events |
| `Datadog: Open Dashboards` | Access saved dashboards |
| `Datadog: Open Monitors` | View and manage alerts |
| `Datadog: Search Services` | Find services to monitor |
| `Datadog: Authenticate` | Sign in/out |
| `Datadog: Set API Key` | Configure API key |
| `Datadog: Preferences` | Adjust extension settings |

### Using Logs

1. Open Datadog extension
2. Click "Logs" tab
3. Search for:
   ```
   service:vibecode host:localhost
   ```
4. Click a log to view details
5. Filter by:
   - Service (postgresql, valkey, ssh, openvscode)
   - Log level (INFO, WARNING, ERROR)
   - Time range

### Using Metrics

1. Open Datadog extension
2. Click "Metrics" tab
3. Search for VibeCode metrics:
   - `vibecode.vm.boot_time`
   - `vibecode.vm.memory`
   - `vibecode.vm.cpu`
   - `vibecode.services.errors`
   - `vibecode.extension.usage`
4. Click metric to view details
5. See historical data

### Using Traces

1. Open Datadog extension
2. Click "Traces" tab
3. Search for:
   ```
   service:vibecode
   ```
4. Click a trace to see:
   - Service flow
   - Latency breakdown
   - Error details

## Sending Metrics

### Automatic Metrics

When `METRICS_CLOUD_ENABLED=true`, these are automatically sent:

```json
{
  "metric": "vibecode.vm.boot_time",
  "points": [[1642094000, 26500]],
  "type": "gauge"
}
```

### Manual Metric Submission

From within the VM:

```bash
# SSH into VM
vibecode-vm ssh

# Send metric to Datadog
curl -X POST "https://api.datadoghq.com/api/v2/series" \
  -H "DD-API-KEY: $DD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "series": [{
      "metric": "vibecode.custom.metric",
      "type": "gauge",
      "unit": "ms",
      "points": [{"timestamp": '$(date +%s)', "value": 12345}],
      "tags": ["app:vibecode", "version:3.2.1"]
    }]
  }'
```

### Sending Logs

From shell:

```bash
# Send log to Datadog
curl -X POST "https://http-intake.logs.datadoghq.com/v1/input/$DD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "hostname": "vibecode-vm",
    "service": "vibecode",
    "message": "Service started successfully",
    "level": "INFO",
    "timestamp": '$(date +%s)'000
  }'
```

### Batch Submission

Create a script `/root/send-metrics.sh`:

```bash
#!/bin/bash
# Runs every minute to send metrics

TIMESTAMP=$(date +%s)

# Boot time (once at startup)
if [ ! -f /var/log/vibecode-boot-sent ]; then
  BOOT_TIME=$(cat /var/log/vibecode-boot-time)
  curl -s -X POST "https://api.datadoghq.com/api/v2/series" \
    -H "DD-API-KEY: $DD_API_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"series\": [{\"metric\": \"vibecode.vm.boot_time\", \"points\": [[${TIMESTAMP}, ${BOOT_TIME}]]}]}" &
  touch /var/log/vibecode-boot-sent
fi

# Memory usage
MEMORY=$(free -b | awk 'NR==2 {print int($3/1048576)}')
curl -s -X POST "https://api.datadoghq.com/api/v2/series" \
  -H "DD-API-KEY: $DD_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"series\": [{\"metric\": \"vibecode.vm.memory\", \"points\": [[${TIMESTAMP}, ${MEMORY}]]}]}" &

# CPU usage
CPU=$(top -bn1 | grep "Cpu(s)" | awk '{print int($2)}')
curl -s -X POST "https://api.datadoghq.com/api/v2/series" \
  -H "DD-API-KEY: $DD_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"series\": [{\"metric\": \"vibecode.vm.cpu\", \"points\": [[${TIMESTAMP}, ${CPU}]]}]}" &

wait
```

Add to crontab:

```bash
vibecode-vm ssh "crontab -e"
# Add: * * * * * /root/send-metrics.sh
```

## Custom Dashboards

### Create Dashboard in Datadog

1. Go to Dashboards → New Dashboard
2. Click "New Dashboard"
3. Choose "Timeboard" or "Screenboard"
4. Click "Edit"

### Add Widgets

Click "Add Widget" and choose:

#### Graph Widget

```
Metric: avg:vibecode.vm.boot_time{*}
Time: Last 7 days
```

#### Status Widget

```
Query: avg:vibecode.vm.boot_time{*}
Threshold: 40000 (milliseconds)
```

#### Log Stream Widget

```
Query: service:vibecode
```

### Example Dashboard JSON

See [dashboards/vm-performance.json](../dashboards/vm-performance.json) for full dashboard definition.

## Alert Configuration

### Create Boot Time Alert

In Datadog:

1. Monitors → New Monitor
2. Choose "Metric"
3. Define metric:
   ```
   avg:vibecode.vm.boot_time{*}
   ```
4. Set alert condition:
   - Alert when metric is above 40000
   - Over the last 5 minutes
5. Set threshold:
   - Alert: 40000 ms (40 seconds)
   - Warning: 35000 ms (35 seconds)
6. Configure notifications:
   - Slack: `@vibecode`
   - Email: your@email.com
7. Name: "VibeCode VM Boot Time Alert"

### Create Service Health Alert

```yaml
name: "VibeCode Service Health Alert"
type: "metric alert"
metric: "vibecode.services.healthy"
threshold: 1
condition: "below"
alert_message: |
  A VibeCode service is down: @vibecode #alert
```

### Create Error Rate Alert

```yaml
name: "VibeCode Error Rate Alert"
type: "log-based"
query: "service:vibecode level:ERROR"
group_by: "service"
alert_threshold: 10
time_window: "5m"
message: |
  High error rate in VibeCode: {{service}}
  Errors: {{count}}
```

## Dashboards

### JSON Dashboard Files

VibeCode provides pre-built dashboards as JSON:

1. **VM Performance Dashboard**
   - File: `dashboards/vm-performance.json`
   - Metrics: Boot time, memory, CPU
   - Time range: Last 24 hours

2. **Service Health Dashboard**
   - File: `dashboards/service-health.json`
   - Services: SSH, PostgreSQL, Valkey, OpenVSCode
   - Includes: Uptime, connection count, errors

3. **Error Tracking Dashboard**
   - File: `dashboards/error-tracking.json`
   - Shows: Error count, error types, trends

### Import Dashboard

In Datadog:

1. Dashboards → New Dashboard
2. Settings (gear icon)
3. "Import"
4. Paste JSON from file
5. Click "Import"

## Troubleshooting

### Issue: Extension doesn't connect

**Solution**:
1. Check API key is correct:
   ```bash
   echo $DD_API_KEY
   ```
2. Verify API key exists in Datadog
3. Check DD_SITE is correct (datadoghq.com or datadogheu.com)

### Issue: No metrics appearing

**Symptoms**: Extension connects but no data shows

**Solutions**:
1. Verify metrics are being sent:
   ```bash
   vibecode-vm logs | grep "metric sent"
   ```
2. Check Datadog API key has write permission:
   - Go to API Keys in Datadog
   - Verify the key isn't revoked
3. Wait 2-3 minutes for data to appear in Datadog

### Issue: High API usage cost

**Solutions**:
1. Reduce metric frequency:
   ```bash
   # Send every 60 seconds instead of every 10
   export METRICS_INTERVAL=60
   ```
2. Disable less important metrics:
   ```bash
   export METRICS_DISABLED="cpu,disk"
   ```
3. Use local metrics only:
   ```bash
   export METRICS_CLOUD_ENABLED=false
   ```

### Issue: Authentication fails

**Symptoms**: "Invalid API key" error

**Solutions**:
1. Verify keys:
   ```bash
   curl -H "DD-API-KEY: $DD_API_KEY" \
     "https://api.datadoghq.com/api/v1/validate"
   ```
2. Regenerate keys:
   - Go to Datadog API Keys
   - Delete old key
   - Create new key
   - Update environment variable

### Issue: Can't see logs in extension

**Solutions**:
1. Check logs are being sent:
   ```bash
   vibecode-vm logs | grep -i "datadog"
   ```
2. Search correct service:
   ```
   service:vibecode
   ```
3. Check time range (default: last hour)

## Additional Resources

- [Datadog Documentation](https://docs.datadoghq.com/)
- [Datadog API Reference](https://docs.datadoghq.com/api/)
- [Datadog VSCode Extension](https://github.com/DataDog/datadog-vscode-extension)
- [VibeCode GitHub Issues](https://github.com/yourusername/vibecode-vm/issues)

---

**Last Updated**: 2026-01-14
**Version**: VibeCode v3.2.1
