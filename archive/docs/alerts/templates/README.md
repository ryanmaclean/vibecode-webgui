# VibeCode Alert Templates

Pre-configured alert templates for monitoring VibeCode.

## Quick Start

### In Datadog

1. Go to Monitors → New Monitor
2. Choose alert type (Metric, Log, etc.)
3. Copy configuration from template file
4. Customize for your needs
5. Save and enable

### Template Files

- `boot-time-alert.yaml` - Alert when boot time is slow
- `service-health-alert.yaml` - Service availability alerts
- `error-rate-alert.yaml` - Error spike detection
- `resource-alert.yaml` - Memory/CPU/Disk alerts
- `performance-alert.yaml` - Performance degradation alerts

## Boot Time Alert

```yaml
# File: boot-time-alert.yaml
name: "VibeCode Boot Time Alert"
type: "metric"
metric: "vibecode.vm.boot_time"

# Alert levels
thresholds:
  critical: 40000    # 40 seconds
  warning: 35000     # 35 seconds

# Trigger condition
trigger:
  - above threshold for 5 minutes

# Notification
notify:
  - slack: "@vibecode #alerts"
  - email: "ops@vibecode.dev"

# Message
message: |
  Boot time is {{value}}ms (threshold: {{threshold}}ms)

  Likely causes:
  - Slow host machine
  - Service initialization hanging
  - Disk I/O bottleneck

  Actions:
  1. Check console logs: `vibecode-vm logs`
  2. Check service status: `vibecode-vm status`
  3. Restart: `vibecode-vm restart`
```

## Service Health Alert

```yaml
# File: service-health-alert.yaml
name: "VibeCode Service Down"
type: "metric"
metric: "vibecode.service.up"

# Alert on service being down
trigger:
  - equals 0 for 2 minutes

# Critical - page on-call
severity: critical

notify:
  - pagerduty: "vibecode-oncall"
  - slack: "@vibecode #critical"

message: |
  {{service}} service is down!

  Status page: [Check Status](https://status.vibecode.dev)
  Dashboard: [View Dashboard](https://app.datadoghq.com)

  Troubleshooting:
  - SSH: `vibecode-vm status | grep SSH`
  - PostgreSQL: `vibecode-vm ssh "psql -c 'SELECT 1'"`
  - Valkey: `vibecode-vm ssh "redis-cli PING"`
  - OpenVSCode: `curl http://192.168.64.10:8080`
```

## Error Rate Alert

```yaml
# File: error-rate-alert.yaml
name: "VibeCode High Error Rate"
type: "log-based"
query: "service:vibecode level:ERROR"

# Alert on error spike
trigger:
  - more than 10 errors in 5 minutes

# Warning - notify team
severity: warning

notify:
  - slack: "@vibecode #alerts"
  - email: "devops@vibecode.dev"

message: |
  Error rate spike detected!

  Error count: {{count}} in last 5 minutes
  Error types: {{error_types}}
  Top service: {{top_service}}

  See errors: [View in Datadog]({{link}})
```

## Resource Alert

```yaml
# File: resource-alert.yaml

# Memory alert
---
name: "VibeCode High Memory"
type: "metric"
metric: "vibecode.vm.memory"

trigger:
  - above 1500 for 10 minutes  # 1.5 GB

severity: warning

message: |
  Memory usage is high: {{value}}MB

  Check what's using memory:
  `vibecode-vm ssh "ps aux --sort=-%mem | head -10"`

# CPU alert
---
name: "VibeCode High CPU"
type: "metric"
metric: "vibecode.vm.cpu"

trigger:
  - above 70 for 5 minutes

severity: warning

message: |
  CPU usage is high: {{value}}%

  Top processes:
  `vibecode-vm ssh "top -bn1 | head -20"`

# Disk alert
---
name: "VibeCode Low Disk Space"
type: "metric"
metric: "vibecode.vm.disk_free"

trigger:
  - below 500 (MB)  # Less than 500MB free

severity: critical

message: |
  Low disk space: {{value}}MB free

  Check disk usage:
  `vibecode-vm ssh "df -h"`

  Clean up:
  `vibecode-vm ssh "journalctl --vacuum=time:7d"`
```

## Performance Alert

```yaml
# File: performance-alert.yaml
name: "VibeCode Performance Degradation"
type: "metric"
metric: "vibecode.vm.boot_time"

# Alert if 25% above baseline
trigger:
  - above baseline * 1.25

baseline: "average over last 30 days"

severity: warning

message: |
  Boot time has degraded 25% above baseline.

  Baseline: {{baseline}}ms
  Current: {{value}}ms
  Delta: {{delta}}ms

  Possible causes:
  - More data in databases
  - VM host under load
  - Disk getting fragmented

  Actions:
  1. Establish new baseline
  2. Check disk space
  3. Clear logs and caches
```

## Creating Custom Alerts

### Template Structure

```yaml
name: "Alert Name"
type: "metric|log|apm|monitor"  # Type of alert

# Metric or query
metric: "vibecode.custom.metric"  # For metric alerts
query: "service:vibecode STATUS"  # For log alerts

# Trigger condition
trigger:
  - above 1000            # Threshold
  - for 5 minutes         # Duration
  - on all               # Scope

# Severity
severity: critical|warning|info

# Notifications
notify:
  - slack: "#channel @user"
  - email: "user@example.com"
  - pagerduty: "oncall-service"
  - webhook: "https://example.com/webhook"

# Alert message (can use variables)
message: |
  Alert message
  Value: {{value}}
  Threshold: {{threshold}}
  {{metric_name}}: {{value}}
```

### Variables

Available in alert messages:

| Variable | Description |
|----------|-------------|
| `{{value}}` | Current metric value |
| `{{threshold}}` | Alert threshold |
| `{{metric}}` | Metric name |
| `{{service}}` | Service name |
| `{{host}}` | Host name |
| `{{tags}}` | Associated tags |
| `{{link}}` | Link to Datadog |
| `{{timestamp}}` | Alert timestamp |

## Best Practices

### 1. Test Alerts

Always test alerts before enabling:

```bash
# Simulate high boot time
curl -X POST "https://api.datadoghq.com/api/v2/series" \
  -H "DD-API-KEY: $DD_API_KEY" \
  -d '{
    "series": [{
      "metric": "vibecode.vm.boot_time",
      "points": [['"$(date +%s)"', 45000]],
      "tags": ["test:true"]
    }]
  }'

# Verify alert triggers
# Check Slack/email for notification
```

### 2. Use Baselines

Compare against historical data:

```yaml
# Instead of fixed threshold
threshold: 30000

# Use baseline
trigger:
  - above baseline * 1.2  # 20% above normal
```

### 3. Avoid Alert Fatigue

Set thresholds high enough to avoid false positives:

```yaml
# Too sensitive (lots of alerts)
threshold: 30000  # Triggers frequently

# Better (less noise)
threshold: 40000
duration: "5 minutes"  # Sustained for 5 min
```

### 4. Clear Runbooks

Always include action steps:

```yaml
message: |
  Boot time exceeded threshold.

  Troubleshooting:
  1. Check console: vibecode-vm logs | grep ERROR
  2. Check service: vibecode-vm status
  3. Restart: vibecode-vm restart
```

## Integration with Tools

### Slack Integration

```yaml
notify:
  - slack: "#vibecode-alerts @vibecode-team"
```

In Datadog:
1. Integrations → Slack
2. Connect workspace
3. Authorize
4. Use in alerts

### PagerDuty Integration

```yaml
notify:
  - pagerduty: "vibecode-oncall"
```

In Datadog:
1. Integrations → PagerDuty
2. Connect account
3. Select escalation policy
4. Use in alerts

### Custom Webhooks

```yaml
notify:
  - webhook: "https://example.com/alerts"
```

Example webhook payload:

```json
{
  "alert_type": "metric",
  "alert_id": "12345",
  "alert_name": "VibeCode Boot Time Alert",
  "severity": "critical",
  "metric": "vibecode.vm.boot_time",
  "value": 45000,
  "threshold": 40000,
  "timestamp": "2026-01-14T10:30:00Z"
}
```

## Maintenance

### Review Alerts Regularly

Monthly checklist:

- [ ] Review alert thresholds
- [ ] Check false positive rate
- [ ] Update baselines
- [ ] Remove old/unused alerts
- [ ] Test alert notifications

### Audit Trail

Keep alerts documented:

```bash
# Export all alerts
curl -H "DD-API-KEY: $DD_API_KEY" \
  "https://api.datadoghq.com/api/v1/monitor" \
  > alerts-backup-$(date +%Y%m%d).json
```

---

**Last Updated**: 2026-01-14
**Version**: VibeCode v3.2.1
