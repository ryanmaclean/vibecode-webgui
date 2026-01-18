# VibeCode Monitoring Best Practices

Advanced monitoring techniques and best practices for VibeCode.

## Table of Contents

1. [Monitoring Strategy](#monitoring-strategy)
2. [Key Metrics](#key-metrics)
3. [Alert Strategies](#alert-strategies)
4. [Performance Baselining](#performance-baselining)
5. [Capacity Planning](#capacity-planning)
6. [Incident Response](#incident-response)
7. [Cost Optimization](#cost-optimization)

## Monitoring Strategy

### Three Pillars

#### 1. Availability

**What**: Is the service running?

Monitor:
- Service uptime
- Endpoint health
- Connection counts
- Response times

**Tools**: Health checks, status pages

**Alert Threshold**: Down for >2 minutes = alert

#### 2. Performance

**What**: How fast is it?

Monitor:
- Boot time
- Query latency
- Memory usage
- CPU utilization

**Tools**: Metrics, distributed traces

**Alert Threshold**: >40% slower than baseline = investigate

#### 3. Errors

**What**: Are things breaking?

Monitor:
- Error count
- Error rate (%)
- Error types
- Stack traces

**Tools**: Error tracking, logs

**Alert Threshold**: >1% error rate = alert

### Monitoring Levels

#### Level 1: Essential (Minimum)

Monitor only critical metrics:
- VM boot time
- Service uptime (SSH, PostgreSQL, Valkey, OpenVSCode)
- Error count

**Setup Time**: 5 minutes

#### Level 2: Standard (Recommended)

Add performance metrics:
- Memory usage
- CPU utilization
- Connection counts
- Query times
- Extension usage

**Setup Time**: 30 minutes

#### Level 3: Advanced (Best)

Full observability:
- Distributed traces
- Custom metrics
- Log aggregation
- Real-time dashboards
- Predictive alerting

**Setup Time**: 2 hours

## Key Metrics

### VM Metrics

#### Boot Time

**What**: How long does the VM take to start?

**Target**: <30 seconds (25-29s normal)

**Track**:
```bash
# From host
time vibecode-vm start

# From VM
cat /var/log/vibecode-boot-time.log
```

**Alert**: If >40 seconds
```yaml
metric: vibecode.vm.boot_time
threshold: 40000  # milliseconds
```

**Why Matters**:
- Indicates system health
- Affects developer experience
- Detects regressions

#### Memory Usage

**What**: How much RAM is being used?

**Target**: 400-800 MB baseline, <1.5 GB peak

**Track**:
```bash
# Baseline on clean start
vibecode-vm start
sleep 30  # Wait for services
vibecode-vm ssh "free -h"

# Under load
# Repeat with active usage
```

**Alert**: If >1.8 GB (close to 2GB limit)
```yaml
metric: vibecode.vm.memory
threshold: 1800  # MB
```

**Why Matters**:
- Detects memory leaks
- Indicates resource pressure
- Affects performance

#### CPU Usage

**What**: How much CPU is being used?

**Target**: 5-15% average, <30% peak

**Track**:
```bash
vibecode-vm ssh "top -bn1 | grep Cpu"
```

**Alert**: If >50% sustained
```yaml
metric: vibecode.vm.cpu
threshold: 50
```

**Why Matters**:
- Detects runaway processes
- Indicates system stress
- Affects battery life on macOS

### Service Metrics

#### SSH Connections

**What**: How many SSH sessions are active?

**Target**: 0-2 connections

**Track**:
```bash
vibecode-vm ssh "ss -t | grep -i established | wc -l"
```

**Why Matters**:
- Detects disconnection issues
- Monitors accessibility

#### PostgreSQL

**What**: Database health and performance

**Track**:
```bash
# Connection count
vibecode-vm ssh "psql -U postgres -c \"SELECT count(*) FROM pg_stat_activity;\""

# Slow queries
vibecode-vm ssh "psql -U postgres -c \"SELECT query FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 5;\""

# Database size
vibecode-vm ssh "psql -U postgres -c \"SELECT pg_size_pretty(pg_database_size('postgres'));\""
```

**Alert**: If connection count > 30 (close to limit)
```yaml
metric: vibecode.service.postgresql.connections
threshold: 30
```

#### Valkey

**What**: Cache performance

**Track**:
```bash
# Memory usage
vibecode-vm ssh "redis-cli INFO memory | grep used_memory_human"

# Operations per second
vibecode-vm ssh "redis-cli INFO stats | grep instantaneous_ops_per_sec"

# Evictions
vibecode-vm ssh "redis-cli INFO stats | grep evicted_keys"
```

**Alert**: If evictions > 0 (memory pressure)
```yaml
metric: vibecode.service.valkey.evictions
threshold: 0
```

#### OpenVSCode

**What**: IDE accessibility and performance

**Track**:
```bash
# Uptime
vibecode-vm ssh "curl -s http://localhost:8080 | head -20"

# Response time
time curl -s http://192.168.64.10:8080 > /dev/null

# Extension count
# Check Extensions panel
```

**Alert**: If response time > 2 seconds
```yaml
metric: vibecode.service.openvscode.response_time
threshold: 2000  # milliseconds
```

### Application Metrics

#### App Launches

**What**: How often is VibeCode being used?

**Track**:
```bash
grep "app_launch" ~/.vibecode/metrics/app-metrics.json | wc -l
```

**Purpose**:
- Understand usage patterns
- Track adoption
- Identify inactive periods

#### Error Rate

**What**: What percentage of operations fail?

**Target**: <0.5% (healthy)

**Track**:
```bash
# Total errors in last hour
vibecode-vm logs | grep ERROR | wc -l

# Calculate rate
TOTAL_OPERATIONS=1000
ERRORS=5
RATE=$((ERRORS * 100 / TOTAL_OPERATIONS))
echo "Error Rate: ${RATE}%"
```

**Alert**: If >1% error rate
```yaml
metric: vibecode.error.rate
threshold: 1  # percent
```

## Alert Strategies

### Alert Types

#### Critical Alerts (Page on-call)

Alerts that require immediate action:

1. **Service Down** - Service not responding
2. **Data Loss** - Risk of losing data
3. **Security Issue** - Active security incident
4. **Performance Degradation** - >50% slower than baseline

**Action**: Immediate response required

**Example**:
```yaml
name: "OpenVSCode Down"
metric: vibecode.service.openvscode.up
threshold: 1  # up = 1, down = 0
alert: "down"
notify: "on_call_engineer"
```

#### Warning Alerts (Slack notification)

Alerts that should be investigated:

1. **High Memory** - >1.5 GB
2. **High CPU** - >50%
3. **Slow Boot Time** - >35 seconds
4. **Error Rate** - >0.5%

**Action**: Investigate in next hour

**Example**:
```yaml
name: "High Memory Usage"
metric: vibecode.vm.memory
threshold: 1500  # MB
alert: "warning"
notify: "slack_vibecode_channel"
```

#### Informational Alerts (Email digest)

Alerts for tracking and analysis:

1. **Boot Time Trend** - Weekly average
2. **Feature Usage** - Adoption metrics
3. **User Growth** - New users

**Action**: Review in weekly meeting

**Example**:
```yaml
name: "Weekly Boot Time Report"
metric: "avg:vibecode.vm.boot_time{*} by {day}"
frequency: "weekly"
notify: "email_digest"
```

### Alert Rules

#### Rule 1: Use Baselines

Always compare against baseline:

```yaml
# BAD: Fixed threshold
threshold: 30000  # Always 30s

# GOOD: Dynamic based on baseline
threshold: baseline * 1.33  # 33% above normal
```

#### Rule 2: Avoid Alert Fatigue

Too many alerts = ignored alerts:

```yaml
# BAD: Alert on every spike
threshold: 25000  # Too low, lots of false positives

# GOOD: Alert on sustained issues
threshold: 40000
duration: "5 minutes"  # Sustained for 5 min
```

#### Rule 3: Clear Alert Messages

Make alerts actionable:

```yaml
# BAD message
message: "high cpu"

# GOOD message
message: |
  CPU usage is 75% (threshold: 50%)
  Top processes:
  - OpenVSCode: 40%
  - PostgreSQL: 25%
  Actions: Restart service or check for long-running queries
```

#### Rule 4: Escalation Paths

Define who to contact:

```yaml
# Escalation path
alerts:
  - level: warning
    notify: slack_channel
    wait: 15 minutes

  - level: critical
    notify: on_call_engineer
    immediately: true

  - level: critical (if >=2 in 1h)
    notify: team_lead
    escalate: immediately
```

## Performance Baselining

### Baseline Metrics

Establish normal behavior:

```bash
#!/bin/bash
# establish-baseline.sh

echo "=== Establishing VibeCode Baselines ==="

# Collect data for 7 days
for day in {1..7}; do
  echo ""
  echo "Day $day of 7"

  # Cold start
  vibecode-vm start

  # Measure boot time
  TIMESTAMP=$(date +%s)
  BOOT_TIME=$(cat /var/log/vibecode-boot-time.log)

  # Measure after warmup
  sleep 30
  vibecode-vm ssh "free -h | awk 'NR==2 {print \$3}'" > memory-$day.txt

  # Measure peak
  vibecode-vm ssh "echo \"test query\" | psql -U postgres" > /dev/null
  vibecode-vm ssh "redis-cli INCR counter" > /dev/null

  # Record
  echo "$TIMESTAMP boot_time=$BOOT_TIME" >> baseline-raw.log

  # Clean up
  vibecode-vm stop

  # Wait for next run
  if [ $day -lt 7 ]; then
    sleep 30
  fi
done

# Analyze
echo ""
echo "=== Baseline Summary ==="
awk '{print $NF}' baseline-raw.log | awk -F= '{sum+=$2; count++} END {printf "Boot Time: Avg=%.0f, Min=%.0f, Max=%.0f\n", sum/count, min, max}'
```

### Using Baselines for Alerts

```yaml
# Alert if 25% above baseline
name: "Boot Time Degradation"
metric: vibecode.vm.boot_time
condition: "last_value > baseline * 1.25"
baseline: "average over last 30 days"
threshold: 33125  # 26500 * 1.25
```

## Capacity Planning

### Identifying Growth

Track metrics over time:

```bash
# Boot time trend
for day in {1..30}; do
  vibecode-vm start
  # Record boot time
  vibecode-vm stop
  sleep 60
done

# Analyze trend
# If boot time is increasing, something is growing
```

### Right-Sizing

Ensure VM has enough resources:

| Resource | Current | Recommended |
|----------|---------|-------------|
| CPUs | 2 | 2-4 for performance |
| Memory | 2GB | 2-4GB for headroom |
| Disk | Auto | 10GB for logs/cache |

### Scaling Decisions

When to increase resources:

```
If avg_memory > 80% of available
  OR peak_memory increasing consistently
  OR error_rate > 1%
  => Increase VM memory
```

## Incident Response

### Incident Detection

Automated detection:

1. **Automatic Alert** - Threshold exceeded
2. **Notification** - Slack/email/page
3. **Dashboard** - Show incident details

### Incident Response Process

```
1. Alert (automatic)
   ↓
2. Acknowledge (engineer)
   ↓
3. Investigate (gather logs/metrics)
   ↓
4. Resolve (implement fix)
   ↓
5. Document (post-mortem)
   ↓
6. Prevent (improve monitoring)
```

### Incident Runbook Example

```markdown
# Boot Time High (>40 seconds)

## Immediate Actions
1. Check service startup logs
   `vibecode-vm logs | grep "service started"`
2. Check resource usage
   `vibecode-vm ssh "free -h && top -bn1"`
3. Note: Might be slow host machine

## Investigation
- SSH into VM: `vibecode-vm ssh`
- Check individual service times:
  - SSH: `ps aux | grep sshd`
  - PostgreSQL: `ps aux | grep postgres`
  - Valkey: `ps aux | grep valkey`
  - OpenVSCode: `ps aux | grep openvscode`

## Resolution
- Restart slow service
- Check for hung processes
- Review recent changes

## Prevention
- Add boot time regression test
- Monitor CPU during boot
```

## Cost Optimization

### Datadog Cost Control

```bash
# Monitor API usage
curl -H "DD-API-KEY: $DD_API_KEY" \
  "https://api.datadoghq.com/api/v1/usage/summary" | jq .

# Cost reduction strategies:

# 1. Reduce metric frequency (from 10s to 60s)
export METRICS_INTERVAL=60

# 2. Sample metrics (send every other measurement)
export METRICS_SAMPLE_RATE=0.5

# 3. Disable expensive metrics
export METRICS_DISABLED="detailed_traces"

# 4. Use local metrics for development
export METRICS_CLOUD_ENABLED=false
```

### Metric Cardinality

Watch out for high cardinality metrics:

```yaml
# BAD: Creates many metrics (one per command)
metric: "extension.command" tags: {command: $COMMAND}
# Results in: datadog.logs, datadog.traces, datadog.metrics, etc.

# GOOD: Count total
metric: "extension.commands_total" value: 1
```

## Monitoring Tools Comparison

| Tool | Local | Cloud | Cost | Setup |
|------|-------|-------|------|-------|
| **Local Logs** | ✓ | ✗ | Free | 5 min |
| **Datadog** | ✗ | ✓ | $/month | 15 min |
| **Prometheus** | ✓ | ✗ | Free | 30 min |
| **ELK Stack** | ✓ | ✗ | Free | 1 hour |

## Further Reading

- [MONITORING.md](../MONITORING.md) - Main monitoring guide
- [OBSERVABILITY_SETUP.md](OBSERVABILITY_SETUP.md) - Setup instructions
- [DATADOG_INTEGRATION_GUIDE.md](DATADOG_INTEGRATION_GUIDE.md) - Datadog details
- [Datadog Best Practices](https://docs.datadoghq.com/ja/monitors/guide/best_practices/)

---

**Last Updated**: 2026-01-14
**Version**: VibeCode v3.2.1
