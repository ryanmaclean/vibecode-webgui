# VibeCode Project Monitoring & Observability Guide

A comprehensive guide to monitoring, observing, and analyzing the VibeCode project infrastructure and application performance.

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Datadog Integration](#datadog-integration)
4. [OpenVSCode Monitoring](#openvscode-monitoring)
5. [VM Performance Monitoring](#vm-performance-monitoring)
6. [Service Health Monitoring](#service-health-monitoring)
7. [Error Tracking](#error-tracking)
8. [Analytics](#analytics)
9. [Dashboards](#dashboards)
10. [Alerting](#alerting)
11. [Best Practices](#best-practices)

## Overview

VibeCode provides comprehensive monitoring capabilities through:

- **Datadog VSCode Extension** - Built-in observability in the IDE
- **VM Metrics** - Boot time, memory usage, CPU utilization
- **Service Health** - SSH, PostgreSQL, Valkey, OpenVSCode status
- **Error Tracking** - Application crashes and errors
- **Usage Analytics** - User behavior and feature usage (privacy-first)

### What Gets Monitored

| Component | Metrics | Tools |
|-----------|---------|-------|
| **VM Boot** | Boot time, service startup times | Datadog, custom logs |
| **Memory** | Usage over time, peak usage | Datadog, VM metrics |
| **Services** | Connection counts, response times, errors | Service logs, Datadog |
| **OpenVSCode** | Extension usage, command execution | Built-in telemetry |
| **PostgreSQL** | Connections, query performance, size | pg_stat_statements |
| **Valkey** | Operations, memory usage, evictions | Valkey stats |
| **SSH** | Connection attempts, sessions | Dropbear logs |

## Quick Start

### 1. Enable Datadog Integration

If you have a Datadog account:

```bash
# Set your Datadog API key (optional - not required for local monitoring)
export DD_API_KEY="your-api-key"
export DD_APP_KEY="your-app-key"

# Start the VM
vibecode-vm start

# Access OpenVSCode
open http://<VM_IP>:8080

# Open Extensions panel (Ctrl+Shift+X) and find Datadog extension
# Authenticate with your Datadog account for cloud monitoring
```

### 2. View VM Metrics Locally

```bash
# Start the VM
vibecode-vm start

# View real-time status and metrics
vibecode-vm status

# Stream logs
vibecode-vm logs -f

# Access VM via SSH for detailed metrics
vibecode-vm ssh
# Once in VM:
free -h              # Memory usage
top -bn1 | head      # CPU metrics
ps aux | grep -E "ssh|postgres|valkey|openvscode"
```

### 3. Check Service Health

```bash
vibecode-vm status        # Shows all service status
vibecode-vm ssh           # SSH into VM for manual checks

# In VM - test each service:
ping -c 1 localhost       # Network
redis-cli PING            # Valkey
psql -c "SELECT 1"        # PostgreSQL
nc -zv localhost 22       # SSH
curl -s http://localhost:8080 | head   # OpenVSCode
```

## Datadog Integration

### Setting Up Datadog

Datadog VSCode extension is already included in OpenVSCode. To use it:

1. **Get API Key**: Log in to [datadog.com](https://datadog.com)
2. **Navigate**: Organization Settings → API Keys → Create API Key
3. **Copy**: Store the API key and Application Key securely
4. **In OpenVSCode**:
   - Open Command Palette (Cmd+Shift+P on macOS)
   - Search for "Datadog: Authenticate"
   - Paste your API and Application keys when prompted
   - Extension will connect to your Datadog organization

### Datadog Extension Features

The integrated Datadog VSCode extension provides:

- **Real-time Log Access** - Search and filter logs from all services
- **Metrics Browser** - View infrastructure and application metrics
- **Distributed Tracing** - Follow requests across services
- **Error Tracking** - Monitor application errors and crashes
- **Compliance Insights** - GDPR, HIPAA, SOC 2 compliance status
- **Cloud Integration** - Works with AWS, Azure, GCP
- **Status Pages** - Monitor service health

#### Available Commands

Open the Command Palette (Cmd+Shift+P) and search for:

- `Datadog: Open Logs` - Access log explorer
- `Datadog: Open Metrics` - Browse metrics
- `Datadog: Open Traces` - View distributed traces
- `Datadog: Open Events` - See recent events
- `Datadog: Open Dashboards` - Access saved dashboards
- `Datadog: Search Services` - Find services
- `Datadog: Authenticate` - Set up authentication
- `Datadog: Open Datadog` - Go to Datadog website

See [DATADOG_INTEGRATION_GUIDE.md](docs/DATADOG_INTEGRATION_GUIDE.md) for detailed setup.

### Local Datadog Monitoring (Optional)

If you want to collect metrics locally without Datadog cloud:

```bash
# VM logs are written to console.log automatically
vibecode-vm logs

# Parse logs for metrics
grep "Service started" console.log | wc -l      # Count service starts
grep "ERROR" console.log                         # Find errors
grep "boot_time" console.log | tail -1           # Latest boot time
```

## OpenVSCode Monitoring

### Extension Performance

Monitor extension health from the Extension sidebar:

1. Click Extensions icon (Ctrl+Shift+X)
2. Click the Datadog extension
3. Check "Extension Details" for:
   - Activation time
   - Memory usage
   - Performance impact

### OpenVSCode Logs

View OpenVSCode logs in the integrated terminal:

```bash
# In OpenVSCode terminal:
# Follow OpenVSCode logs
tail -f ~/.openvscode-server/logs/window1.log

# Search for errors
grep ERROR ~/.openvscode-server/logs/window1.log

# Check extension loading
grep "activating extension" ~/.openvscode-server/logs/window1.log
```

### Terminal Commands

Monitor services directly from OpenVSCode terminal:

```bash
# Check all services
ss -tlnp | grep LISTEN

# PostgreSQL status
psql -c "SELECT version();"

# Valkey status
redis-cli INFO server

# SSH status
ss -tlnp | grep ssh
```

## VM Performance Monitoring

### Boot Time Tracking

Track VM boot performance over time:

```bash
# Time the VM start (measures from cold start)
time vibecode-vm start

# Expected: 25-29 seconds
# If >40 seconds: investigate services or hardware issues
```

### Memory Usage

Monitor memory consumption:

```bash
# Local (macOS host)
vm_stat          # Check vm statistics

# In VM
free -h          # Show memory in human-readable format
ps aux --sort=-%mem | head -10     # Top memory consumers
```

### CPU Usage

Track CPU utilization:

```bash
# In VM
top -bn1 | head -20    # CPU snapshot
ps aux --sort=-%cpu    # Sort processes by CPU

# Monitor specific services
ps aux | grep postgres
ps aux | grep valkey
ps aux | grep openvscode
ps aux | grep sshd
```

### Disk Usage

Check disk space usage:

```bash
# In VM
df -h              # Overall disk usage
du -sh /root/*     # Per-directory usage
du -sh /var/log    # Log directory size

# Find large files
find / -type f -size +10M 2>/dev/null
```

### Network Performance

Monitor network connectivity and performance:

```bash
# Check interfaces
ip addr show

# Network statistics
netstat -s | head -20

# Active connections
netstat -tulpn | grep LISTEN

# Monitor latency
ping -c 5 192.168.64.1    # Gateway
```

## Service Health Monitoring

### SSH Server

```bash
# Check status
vibecode-vm status | grep SSH

# Test connection
ssh -v root@192.168.64.10

# Monitor connections
ss -tlnp | grep 22

# In VM - check Dropbear logs
cat /var/log/dropbear.log
```

### PostgreSQL

```bash
# Check status
vibecode-vm status | grep PostgreSQL

# Connect and verify
psql -h 192.168.64.10 -U postgres -c "SELECT 1;"

# Monitor in VM
ps aux | grep postgres
psql -c "SELECT datname, numbackends FROM pg_stat_database;"

# Connection count
psql -c "SELECT count(*) FROM pg_stat_activity;"

# Database size
psql -c "SELECT pg_database.datname, pg_size_pretty(pg_database_size(pg_database.datname)) FROM pg_database ORDER BY pg_database_size(pg_database.datname) DESC;"
```

### Valkey

```bash
# Check status
vibecode-vm status | grep Valkey

# Connect and verify
redis-cli -h 192.168.64.10 PING

# Monitor in VM
redis-cli INFO server    # Server info
redis-cli INFO stats     # Statistics
redis-cli INFO memory    # Memory usage
redis-cli MONITOR        # Real-time commands

# Connection count
redis-cli INFO clients
```

### OpenVSCode

```bash
# Check status
vibecode-vm status | grep OpenVSCode

# Test HTTP access
curl -s http://192.168.64.10:8080 | head -20

# Monitor in VM
ps aux | grep openvscode
lsof -i :8080            # Check port 8080
```

## Error Tracking

### Application Errors

Monitor VibeCode Swift app crashes:

```bash
# macOS system log for app errors
log stream --predicate 'processImagePath contains "VibeCode"'

# Or check Console.app for crashes
```

### Service Errors

Monitor VM service errors:

```bash
# View boot errors
vibecode-vm logs | grep ERROR

# PostgreSQL errors
vibecode-vm ssh "tail -100 /var/log/postgres.log"

# Valkey errors
vibecode-vm ssh "tail -100 /var/log/valkey.log"

# OpenVSCode errors
# Navigate to http://<VM_IP>:8080 and check browser console
```

### Setting Up Error Alerts

Using Datadog:

1. Open Datadog dashboard
2. Navigate to Monitors → New Monitor
3. Select "Log-based" monitor
4. Filter for `service:vibecode ERROR`
5. Set alert threshold (e.g., >5 errors in 5 minutes)
6. Configure notification channel

## Analytics

### Usage Metrics (Privacy-First)

By design, VibeCode collects minimal telemetry. Optional metrics you can monitor:

- **App Launch Count** - Tracked locally only
- **Service Usage** - Which services are accessed
- **Boot Time Trends** - Historical performance
- **Extension Usage** - Datadog extension commands executed
- **Error Rates** - Count of errors per day

### Privacy & Compliance

All analytics are:
- **Opt-in**: Users explicitly enable data collection
- **Local-first**: Data stays on the VM by default
- **Anonymized**: No personal information collected
- **GDPR Compliant**: Users can request/delete data
- **No PII**: No user names, IPs, or file contents

See [PRIVACY.md](docs/PRIVACY.md) for full privacy policy.

### Collecting Analytics

Option 1: Local tracking (no network)

```bash
# In VM, create a metrics log file
mkdir -p /var/log/vibecode-metrics
# Services log metrics to this directory
```

Option 2: Send to Datadog (requires API key)

```bash
# In VM, metrics are sent to Datadog API
# Environment variables:
# - DD_API_KEY=your-key
# - DD_SITE=datadoghq.com (or your region)
```

### Analyzing Analytics

#### App Launch Frequency

```bash
# Query Datadog
# Count app launches per day/week
logs:"service:vibecode" "app:launch" | stats count by @timestamp
```

#### Service Usage

```bash
# Top services accessed
logs:"service:vibecode" "service:*" | stats count by service
# Recent: SSH, PostgreSQL, Valkey, OpenVSCode
```

#### Boot Time Trends

```bash
# Query Datadog for boot time metric
metrics: "vibecode.vm.boot_time" | avg over last 30 days
```

## Dashboards

### Pre-built Dashboards

VibeCode includes JSON dashboard templates:

1. **VM Performance Dashboard** (`dashboards/vm-performance.json`)
   - Boot time trends
   - Memory usage
   - CPU utilization
   - Disk space

2. **Service Health Dashboard** (`dashboards/service-health.json`)
   - Service uptime
   - Connection counts
   - Error rates
   - Response times

3. **User Analytics Dashboard** (`dashboards/user-analytics.json`)
   - App launches
   - Service usage
   - Feature adoption
   - Error frequency

4. **Error Tracking Dashboard** (`dashboards/error-tracking.json`)
   - Error count over time
   - Error types
   - Error sources
   - Error trends

### Creating Custom Dashboards

#### In Datadog:

1. Go to Dashboards → New Dashboard
2. Add widgets for metrics you care about:
   - Boot time: `avg:vibecode.vm.boot_time{*}`
   - Memory: `avg:vibecode.vm.memory{*}`
   - Errors: `sum:vibecode.errors{*}`
3. Save dashboard

#### Locally (CLI):

```bash
# Export dashboard as JSON
curl -H "DD-API-KEY: $DD_API_KEY" \
  "https://api.datadoghq.com/api/v1/dashboard" \
  > dashboard-backup.json
```

## Alerting

### Setting Up Alerts

#### Boot Time Alerts

Alert if VM takes longer than 40 seconds to boot:

```yaml
# Datadog Monitor Configuration
name: "VibeCode VM Boot Time Alert"
type: "metric alert"
metric: "vibecode.vm.boot_time"
threshold: 40000  # milliseconds
alert_type: "when metric is above threshold"
```

#### Service Health Alerts

Alert if a service is down:

```yaml
# Check if OpenVSCode is accessible
name: "OpenVSCode Health Check"
type: "http check"
url: "http://localhost:8080"
timeout: 5
alert_on_timeout: true
```

#### Error Rate Alerts

Alert on error spikes:

```yaml
# Alert if errors exceed 10 in 5 minutes
name: "Error Rate Alert"
type: "log-based"
metric: "service:vibecode ERROR"
alert_threshold: 10
time_window: "5m"
```

### Alert Notification Channels

Configure where alerts are sent:

1. **Slack**: Connect Datadog to Slack channel
2. **Email**: Set email recipients
3. **PagerDuty**: For on-call rotation
4. **Webhook**: For custom integrations

See [alerts/templates/](docs/alerts/templates/) for example configurations.

## Best Practices

### 1. Monitor Key Metrics

Focus on metrics that indicate system health:

- **Boot Time**: <30 seconds is healthy
- **Memory**: <50% utilization is healthy
- **CPU**: <30% average utilization is healthy
- **Errors**: <1% error rate is healthy
- **Service Uptime**: >99.9% is expected

### 2. Set Up Baselines

Establish normal behavior:

```bash
# Collect baseline boot times over 7 days
for i in {1..7}; do
  echo "Run $i:"
  /usr/bin/time -v vibecode-vm start
  vibecode-vm stop
  sleep 10
done
```

### 3. Regular Health Checks

Run automated health checks:

```bash
#!/bin/bash
# health-check.sh
vibecode-vm start

# Wait for services
sleep 5

# Health checks
curl -f http://localhost:8080 || echo "OpenVSCode down"
redis-cli PING || echo "Valkey down"
psql -U postgres -c "SELECT 1" || echo "PostgreSQL down"
ssh -o StrictHostKeyChecking=no root@localhost "echo ok" || echo "SSH down"

vibecode-vm stop
```

Run hourly or daily.

### 4. Log Retention

Keep logs for analysis:

```bash
# In VM, configure log rotation
cat > /etc/logrotate.d/vibecode <<EOF
/var/log/vibecode/* {
  daily
  rotate 7        # Keep 7 days
  compress
  missingok
  notifempty
}
EOF
```

### 5. Performance Optimization

Use monitoring to identify optimization opportunities:

1. **Long boot times**: Check service startup order
2. **High memory usage**: Monitor specific services
3. **CPU spikes**: Identify resource-heavy operations
4. **Network latency**: Check network configuration

### 6. Documentation

Document your monitoring setup:

```markdown
# Our Monitoring Setup

- **Tool**: Datadog
- **Metrics**: VM performance, service health
- **Alerts**: Slack notifications for critical issues
- **Dashboards**: Team visibility into system health
- **Retention**: 30 days for metrics, 90 days for logs
```

## Troubleshooting

### High Boot Time

```bash
# Check which service is slow
vibecode-vm logs | grep -i "service started"

# Start services manually to time each
# SSH first, then PostgreSQL, then Valkey, then OpenVSCode
```

### High Memory Usage

```bash
# Check process memory
ps aux --sort=-%mem | head -10

# Check memory utilization
free -h

# Common causes:
# - PostgreSQL with many connections
# - Large dataset in Valkey
# - Memory leak in OpenVSCode
```

### Service Connection Failures

```bash
# Check service status
vibecode-vm status

# Check network
ip addr show
netstat -tulpn

# Check service logs
vibecode-vm logs | grep ERROR

# Restart service
vibecode-vm restart
```

### Error Rate Spikes

```bash
# Check what changed
vibecode-vm logs | tail -100 | grep ERROR

# Review recent deployments
git log --oneline -10

# Check system resources
free -h
df -h
top -bn1
```

## Further Reading

- [Telemetry Documentation](TELEMETRY.md) - What data is collected
- [Privacy Policy](docs/PRIVACY.md) - Data handling and GDPR compliance
- [Datadog Integration Guide](docs/DATADOG_INTEGRATION_GUIDE.md) - Full Datadog setup
- [Monitoring Best Practices](docs/MONITORING_BEST_PRACTICES.md) - Advanced monitoring techniques
- [Performance Optimization](docs/optimization.md) - Improving system performance

## Support

For issues with monitoring:

1. Check this guide for common solutions
2. Review [Troubleshooting](docs/troubleshooting.md)
3. Check [GitHub Issues](https://github.com/yourusername/vibecode-vm/issues)
4. Open a discussion on [GitHub Discussions](https://github.com/yourusername/vibecode-vm/discussions)

---

**Last Updated**: 2026-01-14
**Version**: VibeCode v3.2.1
