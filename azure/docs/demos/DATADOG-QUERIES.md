# VibeCode Datadog Queries Reference

**Purpose**: Collection of pre-built Datadog queries for monitoring VibeCode VMs
**Format**: Copy-and-paste ready queries for Metrics, Logs, and APM
**Last Updated**: 2025-11-25

---

## Table of Contents

1. [Infrastructure Queries](#infrastructure-queries)
2. [Metrics Queries](#metrics-queries)
3. [Log Queries](#log-queries)
4. [APM & Traces](#apm--traces)
5. [Performance & Capacity](#performance--capacity)
6. [Troubleshooting Queries](#troubleshooting-queries)

---

## Infrastructure Queries

Use these in Dashboards → Timeseries widget

### Find All VibeCode VMs

```
avg:system.uptime{host:vibecode*} by {host}
```

**Description**: Shows uptime for all VibeCode VMs
**Result**: One line per VM, all should be increasing

### VM Count

```
count_nonzero(avg:system.uptime{host:vibecode*})
```

**Description**: Returns total number of active VibeCode VMs
**Result**: Number (1, 2, 3, etc.)

### Host Status Matrix

```
avg:system.uptime{host:vibecode*} by {host,environment}
```

**Description**: Shows uptime grouped by host and environment
**Result**: Matrix of hosts and their uptime

### VM Geographic Distribution

```
avg:system.uptime{host:vibecode*} by {host,region}
```

**Description**: Uptime grouped by region (if region tags exist)
**Result**: Regional breakdown of VMs

---

## Metrics Queries

### CPU Monitoring

#### CPU User Time (Application)

```
avg:system.cpu.user{host:vibecode*}
```

**Description**: CPU used by applications (user space)
**Expected**: 5-30% during normal operation
**Unit**: Percentage
**Visualization**: Timeseries

#### CPU System Time (Kernel)

```
avg:system.cpu.system{host:vibecode*}
```

**Description**: CPU used by kernel (system calls, I/O)
**Expected**: 2-10% during normal operation
**Unit**: Percentage

#### CPU I/O Wait

```
avg:system.cpu.iowait{host:vibecode*}
```

**Description**: CPU time spent waiting for I/O operations
**Expected**: 1-5% during normal operation
**Warning**: > 20% indicates disk I/O bottleneck

#### CPU Usage by Core

```
avg:system.cpu.user{host:vibecode*} by {core}
```

**Description**: CPU usage per core
**Result**: One line per core
**Use**: Identify if workload is single-threaded

#### Peak CPU (per VM)

```
max:system.cpu.user{host:vibecode*} by {host}
```

**Description**: Maximum CPU usage reached per VM
**Use**: Capacity planning

#### CPU Count

```
avg:system.nproc{host:vibecode*}
```

**Description**: Number of CPU cores/processors
**Expected**: 2-8 depending on VM configuration

---

### Memory Monitoring

#### Total Memory Used

```
avg:system.mem.used{host:vibecode*}
```

**Description**: Total memory used (MB)
**Expected**: 200-500 MB for idle VM
**Note**: Includes cache and buffers

#### Free Memory Available

```
avg:system.mem.free{host:vibecode*}
```

**Description**: Memory available for allocation
**Expected**: > 100 MB for healthy system

#### Memory Percentage Used

```
100 * avg:system.mem.used{host:vibecode*} / avg:system.mem.total{host:vibecode*}
```

**Description**: Memory usage as percentage of total
**Expected**: 30-60% during normal operation
**Warning**: > 80% indicates memory pressure

#### Swap Usage

```
avg:system.mem.swap{host:vibecode*}
```

**Description**: Swap memory used (indicates memory pressure)
**Expected**: 0 or very small
**Warning**: Any swap use indicates memory pressure

#### Memory by VM (comparison)

```
avg:system.mem.used{host:vibecode*} by {host}
```

**Description**: Memory usage comparison across VMs
**Use**: Identify memory-hungry VMs

#### Resident Set Size

```
avg:system.processes.res_mem_avg{host:vibecode*}
```

**Description**: Average process memory size
**Expected**: 5-20 MB per process

---

### Network Monitoring

#### Network Bytes Received (Rate)

```
sum:system.net.bytes_rcvd{host:vibecode*}.as_rate()
```

**Description**: Incoming network throughput (bytes/sec)
**Unit**: Bytes per second
**Expected**: 1KB/s - 10MB/s depending on workload

#### Network Bytes Sent (Rate)

```
sum:system.net.bytes_sent{host:vibecode*}.as_rate()
```

**Description**: Outgoing network throughput (bytes/sec)
**Expected**: Similar to inbound

#### Total Network I/O

```
(sum:system.net.bytes_rcvd{host:vibecode*} + sum:system.net.bytes_sent{host:vibecode*}).as_rate()
```

**Description**: Combined bidirectional throughput
**Use**: Total network utilization

#### Packets Received

```
sum:system.net.packets_in{host:vibecode*}.as_rate()
```

**Description**: Incoming packet count (packets/sec)
**Expected**: 10-1000 packets/sec

#### Packets Sent

```
sum:system.net.packets_out{host:vibecode*}.as_rate()
```

**Description**: Outgoing packet count
**Expected**: Similar to inbound

#### Packet Loss Indicator

```
sum:system.net.drop_in{host:vibecode*} + sum:system.net.drop_out{host:vibecode*}
```

**Description**: Dropped packets (indicates problems)
**Expected**: 0 (any drops indicate network issues)

#### Network by Interface

```
avg:system.net.bytes_rcvd{host:vibecode*} by {device}
```

**Description**: Network traffic per interface
**Use**: Identify active network interfaces

#### Connection Count

```
system.tcp.established{host:vibecode*}
```

**Description**: Established TCP connections
**Expected**: 5-50 depending on workload

---

### Disk Monitoring

#### Disk Read Rate

```
sum:system.disk.reads{host:vibecode*}.as_rate()
```

**Description**: Disk read operations (reads/sec)
**Expected**: 1-100 reads/sec during normal operation

#### Disk Write Rate

```
sum:system.disk.writes{host:vibecode*}.as_rate()
```

**Description**: Disk write operations (writes/sec)
**Expected**: 1-50 writes/sec during normal operation

#### Disk Usage Percentage

```
avg:system.disk.in_use{host:vibecode*}
```

**Description**: Disk utilization percentage
**Expected**: < 60% for healthy system
**Warning**: > 80% indicates capacity issues

#### I/O Operations by Disk

```
sum:system.disk.reads{host:vibecode*} by {device}
```

**Description**: Read operations per disk device
**Use**: Identify hot disks

#### Disk Free Space

```
avg:system.disk.free{host:vibecode*}
```

**Description**: Available disk space (bytes)
**Expected**: > 1 GB for normal operation

#### Disk Read Latency

```
avg:system.disk.read_time{host:vibecode*}
```

**Description**: Average disk read latency (milliseconds)
**Expected**: < 10 ms
**Warning**: > 50 ms indicates slow storage

#### Disk Write Latency

```
avg:system.disk.write_time{host:vibecode*}
```

**Description**: Average disk write latency (ms)
**Expected**: < 10 ms
**Warning**: > 50 ms indicates slow storage

---

### Process Monitoring

#### Total Process Count

```
avg:system.processes{host:vibecode*}
```

**Description**: Total number of running processes
**Expected**: 30-80 processes

#### Process by State

```
avg:system.processes{host:vibecode*} by {state}
```

**Description**: Count of processes by state (running, sleeping, zombie)
**Warning**: Zombie processes indicate application issues

#### Average Process Memory

```
avg:system.processes.res_mem_avg{host:vibecode*}
```

**Description**: Average memory per process (MB)
**Expected**: 5-15 MB

#### Max Process Memory

```
max:system.processes.res_mem_max{host:vibecode*}
```

**Description**: Largest process memory size (MB)
**Use**: Identify memory-heavy processes

#### Datadog Agent Memory

```
avg:process.memory.rss{process_name:datadog-agent, host:vibecode*}
```

**Description**: Memory used by Datadog agent
**Expected**: 50-100 MB

#### Datadog Agent CPU

```
avg:process.cpu{process_name:datadog-agent, host:vibecode*}
```

**Description**: CPU used by Datadog agent
**Expected**: < 5%

---

## Log Queries

Use these in Log Explorer

### Basic Filters

#### All VibeCode VMs

```
host:vibecode* OR host:basicvibecode* OR host:liquidglass*
```

**Result**: All logs from any VibeCode VM
**Common**: Use as base filter for other queries

#### Specific VM

```
host:basicvibecode*
```

**Result**: Logs only from BasicVibeCode VM

#### By Service

```
service:vibecode-vm
```

**Result**: All logs tagged with vibecode-vm service

---

### By Log Level

#### Error Logs Only

```
status:error
```

**Result**: All error-level logs
**Common**: `host:vibecode* status:error`

#### Warning Logs

```
status:warn OR status:warning
```

**Result**: Warning-level logs

#### Info Logs

```
status:info
```

**Result**: Informational messages

#### Debug Logs

```
status:debug
```

**Result**: Debug-level detailed messages

---

### By Source

#### Kernel Logs

```
source:kernel host:vibecode*
```

**Result**: Linux kernel messages
**Common Issues**: Boot errors, hardware issues, device problems

#### Syslog

```
source:syslog host:vibecode*
```

**Result**: System event log messages
**Common Issues**: Service startup/shutdown, cron jobs

#### Application Logs

```
source:app host:vibecode*
```

**Result**: Application-generated logs

#### Datadog Agent Logs

```
service:datadog-agent host:vibecode*
```

**Result**: Agent startup, config, health messages

---

### Time-Based Queries

#### Last Hour

```
host:vibecode* @timestamp:[NOW-1h TO NOW]
```

**Result**: Logs from last hour

#### Last Day

```
host:vibecode* @timestamp:[NOW-24h TO NOW]
```

**Result**: Logs from last 24 hours

#### Specific Time Range

```
host:vibecode* @timestamp:[2025-11-25T10:00:00 TO 2025-11-25T11:00:00]
```

**Result**: Logs within specific time window

#### Last 5 Minutes

```
host:vibecode* @timestamp:[NOW-5m TO NOW]
```

**Result**: Very recent logs

---

### Troubleshooting Queries

#### API Authentication Errors

```
host:vibecode* "api_key" "error" OR "authentication" "failed"
```

**Result**: API-related failures
**Action**: Verify DD_API_KEY setting

#### Network Connectivity Issues

```
host:vibecode* ("connection" OR "timeout" OR "refused") status:error
```

**Result**: Network-related problems
**Action**: Check firewall, DNS, routing

#### Agent Startup Issues

```
service:datadog-agent status:error
```

**Result**: Agent initialization problems
**Action**: Check logs, verify configuration

#### Memory Issues

```
host:vibecode* ("out of memory" OR "OOM" OR "memory" OR "swap")
```

**Result**: Memory-related problems
**Action**: Check memory metrics, increase VM memory

#### Disk Space Issues

```
host:vibecode* ("disk" OR "space" OR "full" OR "ENOSPC") status:error
```

**Result**: Disk-related problems
**Action**: Check disk usage metric

#### Service Failures

```
host:vibecode* ("failed" OR "error" OR "crash") service:* status:error
```

**Result**: Any service failures
**Action**: Check specific service logs

---

### Log Aggregation Queries

#### Error Count by Source

```
host:vibecode* status:error | stats count by source
```

**Result**: How many errors from each log source
**Use**: Identify most problematic service

#### Top Error Messages

```
host:vibecode* status:error | stats count by message limit 10
```

**Result**: Most common error messages
**Use**: Identify patterns

#### Errors by Hour

```
host:vibecode* status:error | stats count by hour
```

**Result**: Error rate over time
**Use**: Identify peak times

#### Failed HTTP Requests

```
host:vibecode* @http.status_code:[400 TO 599]
```

**Result**: HTTP error responses
**Use**: Track API failures

---

## APM & Traces

### Basic Trace Queries

#### All Traces

```
service:vibecode-vm OR service:bun OR service:openvscode
```

**Description**: All traces from VibeCode services
**Visualization**: Trace list

#### Specific Service

```
service:openvscode
```

**Description**: Only OpenVSCode server traces

#### Trace Duration

```
@duration:>1000000000
```

**Description**: Traces taking > 1 second (1000ms = 1000000000ns)
**Use**: Find slow requests

#### Error Traces

```
status:error
```

**Description**: Traces with errors
**Result**: Stack traces and error context

#### High Duration (Performance)

```
@duration:>500000000 service:vibecode-vm
```

**Description**: Traces taking > 500ms
**Use**: Performance analysis

---

### Performance Analysis

#### Average Latency

```
avg:trace.web.request.duration{service:openvscode}
```

**Description**: Average request latency
**Expected**: < 100ms for web requests

#### P95 Latency (95th percentile)

```
pct95:trace.web.request.duration{service:openvscode}
```

**Description**: Request latency at 95th percentile
**Use**: Understand tail performance

#### P99 Latency (99th percentile)

```
pct99:trace.web.request.duration{service:openvscode}
```

**Description**: Request latency at 99th percentile
**Use**: Worst-case performance

#### Request Rate

```
sum:trace.web.request.count{service:openvscode}.as_rate()
```

**Description**: Requests per second
**Expected**: Depends on load

#### Error Rate

```
sum:trace.web.request.error{service:openvscode}.as_rate()
```

**Description**: Errors per second
**Expected**: < 0.1% (< 1 per 1000)

---

### Service Dependencies

#### Dependent Services

```
service:openvscode env:demo | stats count by downstream_service
```

**Description**: Services called by openvscode
**Use**: Understand service topology

#### Database Queries

```
@db.operation:query service:vibecode-vm
```

**Description**: Database query spans
**Use**: Database performance analysis

#### External HTTP Calls

```
@http.method:* service:vibecode-vm @http.target_host:*
```

**Description**: External API calls made by services
**Use**: Identify external dependencies

---

## Performance & Capacity

### Fleet Health

#### Overall CPU Utilization

```
avg:system.cpu.user{host:vibecode*}
```

**Description**: Average CPU across fleet
**Visualization**: Gauge

#### Overall Memory Pressure

```
100 * sum:system.mem.used{host:vibecode*} / sum:system.mem.total{host:vibecode*}
```

**Description**: Fleet-wide memory percentage
**Visualization**: Gauge

#### Total Throughput

```
(sum:system.net.bytes_rcvd{host:vibecode*} + sum:system.net.bytes_sent{host:vibecode*}).as_rate()
```

**Description**: Combined network traffic for all VMs
**Unit**: Bytes per second

#### Disk Utilization Leaders

```
avg:system.disk.in_use{host:vibecode*} by {host} | sort desc
```

**Description**: Disk usage per VM, highest first
**Use**: Identify storage issues

---

### Capacity Planning

#### Peak Memory (Last 7 Days)

```
max:system.mem.used{host:vibecode*}
```

**Description**: Maximum memory observed
**Use**: Right-size VM memory allocation

#### Peak CPU (Last 7 Days)

```
max:system.cpu.user{host:vibecode*}
```

**Description**: Maximum CPU observed
**Use**: Right-size VM CPU allocation

#### Peak Disk Usage (Last 7 Days)

```
max:system.disk.in_use{host:vibecode*}
```

**Description**: Maximum disk usage
**Use**: Right-size storage allocation

#### Network Peak (Last 7 Days)

```
max:system.net.bytes_rcvd{host:vibecode*}.as_rate()
```

**Description**: Peak network throughput
**Use**: Network capacity planning

---

## Troubleshooting Queries

### Agent Health

#### Agent Process Status

```
avg:process.up{process_name:datadog-agent, host:vibecode*}
```

**Description**: Whether agent process is running (1 = running, 0 = down)
**Expected**: Always 1

#### Agent CPU Usage

```
avg:process.cpu{process_name:datadog-agent, host:vibecode*}
```

**Description**: CPU consumed by agent
**Expected**: < 5%
**Warning**: > 10% indicates collection overhead

#### Agent Memory Usage

```
avg:process.memory.rss{process_name:datadog-agent, host:vibecode*}
```

**Description**: Memory used by agent
**Expected**: 50-150 MB
**Warning**: > 250 MB indicates agent issues

---

### Data Collection

#### Metric Submission Rate

```
count(avg:system.cpu.user{host:vibecode*})
```

**Description**: How many metrics being sent
**Expected**: 20-50 metrics per host

#### Metric Latency

```
@timestamp - collection_timestamp
```

**Description**: Delay between collection and receipt
**Expected**: < 5 seconds

#### Log Ingestion Rate

```
sum:datadog.agent.log.ingestion_rate{host:vibecode*}
```

**Description**: Logs per second being sent
**Expected**: 1-50 logs/sec depending on load

---

### Configuration Verification

#### API Key Validity

Query in Logs:
```
service:datadog-agent "api_key" host:vibecode*
```

Check for errors like:
- "authentication failed"
- "unauthorized"
- "invalid_api_key"

**Expected**: No authentication errors

#### Agent Configuration Applied

```
service:datadog-agent "configuration" host:vibecode*
```

**Expected**: Shows "Configuration loaded successfully"

---

## Query Tips & Tricks

### Combining Multiple Conditions

```
host:vibecode* AND status:error AND service:bun
```

### Excluding Conditions

```
host:vibecode* AND NOT service:datadog-agent
```

### Searching for Text

```
"connection refused"
```

### Regex Matching

```
@message:~"failed.*connection"
```

### Case-Insensitive Search

```
@message:(?i)"error"
```

### Date Math

```
@timestamp:[now-1d TO now]    # Last day
@timestamp:[now-1w TO now]    # Last week
@timestamp:[now-1M TO now]    # Last month
```

### Faceting & Grouping

```
status:error | stats count by service
```

### Sorting Results

```
| sort @timestamp desc
```

### Limiting Results

```
| limit 100
```

---

## Saved Queries Template

**To save these queries in Datadog:**

1. Go to Log Explorer or Metric Explorer
2. Paste query
3. Click "Save" or "Export"
4. Name: `[VibeCode] Query Name`
5. Tag: `vibecode`, `demo`, `monitoring`

**Suggested Saved Views**:
- VibeCode All Logs
- VibeCode Errors
- VibeCode Performance Metrics
- VibeCode System Health
- VibeCode APM Overview

---

## Related Documentation

- docs/demos/DATADOG-INTEGRATION-DEMO.md - Overview
- docs/demos/DATADOG-TUTORIAL.md - Step-by-step guide
- docs/quick-start/DATADOG-QUICK-REF.md - Quick reference
- docs/reference/DATADOG-METRICS-CATALOG.md - Metric definitions

---

**Query Reference Version**: 1.0
**Last Updated**: 2025-11-25
**Total Queries**: 100+
**Difficulty Levels**: Beginner to Advanced
