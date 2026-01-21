# VibeCode Datadog Metrics Catalog

**Purpose**: Complete reference of all metrics collected from VibeCode VMs
**Last Updated**: 2025-11-25
**Collection Agent**: Datadog Agent (system metrics)

---

## Quick Reference Table

| Metric Name | Type | Unit | Normal Range | Category |
|------------|------|------|--------------|----------|
| system.cpu.user | gauge | % | 5-30 | CPU |
| system.cpu.system | gauge | % | 2-10 | CPU |
| system.cpu.iowait | gauge | % | 1-5 | CPU |
| system.mem.used | gauge | bytes | 200-500MB | Memory |
| system.mem.free | gauge | bytes | >100MB | Memory |
| system.mem.total | gauge | bytes | ~1GB | Memory |
| system.mem.swap | gauge | bytes | 0 (ideal) | Memory |
| system.net.bytes_rcvd | counter | bytes | Varies | Network |
| system.net.bytes_sent | counter | bytes | Varies | Network |
| system.net.packets_in | counter | packets | Varies | Network |
| system.net.packets_out | counter | packets | Varies | Network |
| system.disk.reads | counter | ops | 1-100 | Disk I/O |
| system.disk.writes | counter | ops | 1-50 | Disk I/O |
| system.disk.in_use | gauge | % | <60 | Disk Space |
| system.disk.free | gauge | bytes | >1GB | Disk Space |
| system.processes | gauge | count | 30-80 | Processes |
| system.load.1 | gauge | load | 1-2 | System Load |
| process.memory.rss | gauge | bytes | Varies | Process |
| process.cpu | gauge | % | Varies | Process |

---

## System CPU Metrics

### system.cpu.user

**Description**: Percentage of CPU time spent executing user space code
**Type**: Gauge
**Unit**: Percentage (0-100)
**Collection Interval**: 10 seconds
**Expected Value**: 5-30% during normal operation
**High Values (>70%)**: Application consuming CPU
**Low Values (<5%)**: System idle

**Query Examples**:
```
avg:system.cpu.user{host:vibecode*}
max:system.cpu.user{host:vibecode*} by {host}
```

**Related Metrics**:
- system.cpu.system - Kernel CPU time
- system.cpu.iowait - I/O wait time
- system.load.1 - System load indicator

---

### system.cpu.system

**Description**: Percentage of CPU time spent executing kernel code (system calls, context switches)
**Type**: Gauge
**Unit**: Percentage (0-100)
**Collection Interval**: 10 seconds
**Expected Value**: 2-10% during normal operation
**High Values (>30%)**: Excessive system calls or context switching
**Indicates**: Heavy workload or inefficient application

**Query Examples**:
```
avg:system.cpu.system{host:vibecode*}
sum:system.cpu.user{host:vibecode*} + sum:system.cpu.system{host:vibecode*}
```

---

### system.cpu.iowait

**Description**: Percentage of CPU time spent waiting for I/O operations to complete
**Type**: Gauge
**Unit**: Percentage (0-100)
**Collection Interval**: 10 seconds
**Expected Value**: 1-5% during normal operation
**Warning**: >20% indicates disk or network I/O bottleneck
**Investigation**: Check disk I/O and network metrics if high

**Query Examples**:
```
avg:system.cpu.iowait{host:vibecode*}
```

**Related Metrics**:
- system.disk.read_time - Disk read latency
- system.disk.write_time - Disk write latency
- system.net.bytes_rcvd - Network input

---

### system.nproc

**Description**: Total number of CPU cores/processors available
**Type**: Gauge
**Unit**: Count
**Collection Interval**: 30 seconds
**Expected Value**: 2-8 (VM configuration dependent)
**Note**: This is the maximum concurrent tasks possible

**Query Examples**:
```
system.nproc{host:vibecode*}
```

**Usage**: For per-core analysis
```
avg:system.cpu.user{host:vibecode*} / system.nproc{host:vibecode*} * 100
```

---

## System Memory Metrics

### system.mem.used

**Description**: Total memory currently in use (includes application RAM, kernel buffers, cache)
**Type**: Gauge
**Unit**: Bytes
**Collection Interval**: 10 seconds
**Expected Value**: 200-500 MB (depends on workload)
**Note**: Includes kernel cache which is reclaimable

**Conversion**:
- Bytes to MB: value / 1024 / 1024
- Bytes to GB: value / 1024 / 1024 / 1024

**Query Examples**:
```
avg:system.mem.used{host:vibecode*}
avg:system.mem.used{host:vibecode*} / 1024 / 1024  # In MB
```

**Related Metrics**:
- system.mem.free - Available memory
- system.mem.total - Total system memory
- system.mem.pct_usable - Usage percentage

---

### system.mem.free

**Description**: Memory immediately available for allocation (not cached or buffered)
**Type**: Gauge
**Unit**: Bytes
**Collection Interval**: 10 seconds
**Expected Value**: >100 MB (at least 100MB free recommended)
**Warning**: <50 MB indicates memory pressure
**Critical**: <10 MB may cause OOM conditions

**Query Examples**:
```
avg:system.mem.free{host:vibecode*}
```

**Health Check**:
```
avg:system.mem.free{host:vibecode*} > 100000000  # > 100MB
```

---

### system.mem.total

**Description**: Total system memory installed (RAM)
**Type**: Gauge
**Unit**: Bytes
**Collection Interval**: 30 seconds (rarely changes)
**Expected Value**: ~1 GB typical for VibeCode VMs
**Note**: Constant for VM lifetime (unless VM config changed)

**Query Examples**:
```
system.mem.total{host:vibecode*}
```

**Calculate Memory Percentage Used**:
```
100 * avg:system.mem.used{host:vibecode*} / avg:system.mem.total{host:vibecode*}
```

---

### system.mem.pct_usable

**Description**: Percentage of memory that is available for use
**Type**: Gauge
**Unit**: Percentage (0-100)
**Collection Interval**: 10 seconds
**Expected Value**: 40-70% usable (30-60% used)
**Warning**: <20% indicates memory pressure
**Note**: Inverse of used percentage

**Query Examples**:
```
avg:system.mem.pct_usable{host:vibecode*}
100 - avg:system.mem.pct_usable{host:vibecode*}  # Used percentage
```

---

### system.mem.swap

**Description**: Virtual memory (swap) currently in use
**Type**: Gauge
**Unit**: Bytes
**Collection Interval**: 10 seconds
**Expected Value**: 0 (no swap in use - ideal)
**Any Value > 0**: Indicates memory pressure, VM needs more RAM
**Critical**: Swap use causes severe performance degradation

**Query Examples**:
```
avg:system.mem.swap{host:vibecode*}
```

**Alert Threshold**:
```
Alert when avg:system.mem.swap{host:vibecode*} > 0
```

---

## Network Metrics

### system.net.bytes_rcvd

**Description**: Total bytes received on network interfaces (cumulative counter)
**Type**: Counter (monotonically increasing)
**Unit**: Bytes
**Collection Interval**: 10 seconds
**Expected Value**: Continuously increasing if traffic present
**Rate Calculation**: Use `.as_rate()` to get bytes/second

**Query Examples**:
```
sum:system.net.bytes_rcvd{host:vibecode*}              # Cumulative bytes
sum:system.net.bytes_rcvd{host:vibecode*}.as_rate()   # Bytes per second
```

**Typical Rates**:
- Idle: 0-100 KB/s
- Light activity: 100 KB/s - 1 MB/s
- Heavy activity: 1-50 MB/s

---

### system.net.bytes_sent

**Description**: Total bytes transmitted on network interfaces (cumulative counter)
**Type**: Counter (monotonically increasing)
**Unit**: Bytes
**Collection Interval**: 10 seconds
**Expected Value**: Continuously increasing if traffic present
**Note**: Usually similar to bytes_rcvd

**Query Examples**:
```
sum:system.net.bytes_sent{host:vibecode*}.as_rate()
```

**Combined Throughput**:
```
(sum:system.net.bytes_rcvd{host:vibecode*} + sum:system.net.bytes_sent{host:vibecode*}).as_rate()
```

---

### system.net.packets_in

**Description**: Total number of packets received (cumulative counter)
**Type**: Counter
**Unit**: Packets
**Collection Interval**: 10 seconds
**Expected Value**: Continuously increasing
**Rate**: Use `.as_rate()` for packets/second

**Query Examples**:
```
sum:system.net.packets_in{host:vibecode*}.as_rate()
```

**Typical Rates**:
- Idle: 1-10 packets/sec
- Active: 10-1000 packets/sec

---

### system.net.packets_out

**Description**: Total number of packets transmitted (cumulative counter)
**Type**: Counter
**Unit**: Packets
**Collection Interval**: 10 seconds
**Expected Value**: Continuously increasing
**Note**: Usually similar to packets_in

**Query Examples**:
```
sum:system.net.packets_out{host:vibecode*}.as_rate()
```

---

### system.net.packets_drop_in

**Description**: Dropped incoming packets (indicates problems)
**Type**: Counter
**Unit**: Packets
**Collection Interval**: 10 seconds
**Expected Value**: 0 (any drops indicate issues)
**Warnings**: Any increase indicates packet loss

**Query Examples**:
```
sum:system.net.drop_in{host:vibecode*}
```

**Investigation**: If > 0
- Network congestion
- Buffer exhaustion
- Hardware issues
- Firewall dropping packets

---

### system.net.packets_drop_out

**Description**: Dropped outgoing packets
**Type**: Counter
**Unit**: Packets
**Collection Interval**: 10 seconds
**Expected Value**: 0
**Warning**: Any increase indicates transmit problems

---

### system.tcp.established

**Description**: Number of established TCP connections
**Type**: Gauge
**Unit**: Count
**Collection Interval**: 30 seconds
**Expected Value**: 5-50 connections (depends on workload)
**Tracks**: Active TCP sessions

**Query Examples**:
```
system.tcp.established{host:vibecode*}
```

**Sudden Increases**: May indicate connection leak or DDoS

---

## Disk I/O Metrics

### system.disk.reads

**Description**: Total disk read operations (cumulative counter)
**Type**: Counter (monotonically increasing)
**Unit**: Operations (count)
**Collection Interval**: 10 seconds
**Expected Value**: Continuously increasing with file I/O
**Rate**: Use `.as_rate()` for reads/second

**Query Examples**:
```
sum:system.disk.reads{host:vibecode*}.as_rate()  # Reads per second
```

**Typical Rates**:
- Idle: 0-5 ops/sec
- Light I/O: 5-50 ops/sec
- Heavy I/O: 50-1000+ ops/sec

---

### system.disk.writes

**Description**: Total disk write operations (cumulative counter)
**Type**: Counter
**Unit**: Operations (count)
**Collection Interval**: 10 seconds
**Expected Value**: Continuously increasing
**Rate**: Use `.as_rate()` for writes/second

**Query Examples**:
```
sum:system.disk.writes{host:vibecode*}.as_rate()
```

**Typical Rates**: Usually lower than reads (1-50 ops/sec)

---

### system.disk.in_use

**Description**: Disk utilization percentage (space used / capacity)
**Type**: Gauge
**Unit**: Percentage (0-100)
**Collection Interval**: 30 seconds
**Expected Value**: <60% for healthy system
**Warning**: >80% indicates capacity issue
**Critical**: >95% may cause application failures

**Query Examples**:
```
avg:system.disk.in_use{host:vibecode*}
```

**Alert Thresholds**:
- Normal: <60%
- Warning: 60-80%
- Critical: >80%

---

### system.disk.free

**Description**: Free disk space available
**Type**: Gauge
**Unit**: Bytes
**Collection Interval**: 30 seconds
**Expected Value**: >1 GB (at least 1 GB free)
**Warning**: <500 MB indicates tight space
**Critical**: <100 MB may cause failures

**Query Examples**:
```
avg:system.disk.free{host:vibecode*}
avg:system.disk.free{host:vibecode*} / 1024 / 1024 / 1024  # GB
```

---

### system.disk.read_time

**Description**: Average time for disk read operations
**Type**: Gauge
**Unit**: Milliseconds (ms)
**Collection Interval**: 10 seconds
**Expected Value**: <10 ms for SSD, <20 ms for HDD
**Warning**: >50 ms indicates slow storage
**Critical**: >100 ms severe performance issue

**Query Examples**:
```
avg:system.disk.read_time{host:vibecode*}
```

---

### system.disk.write_time

**Description**: Average time for disk write operations
**Type**: Gauge
**Unit**: Milliseconds (ms)
**Collection Interval**: 10 seconds
**Expected Value**: <10 ms for SSD, <20 ms for HDD
**Warning**: >50 ms indicates performance issue

**Query Examples**:
```
avg:system.disk.write_time{host:vibecode*}
```

---

## Process Metrics

### system.processes

**Description**: Total number of processes currently running
**Type**: Gauge
**Unit**: Count
**Collection Interval**: 30 seconds
**Expected Value**: 30-80 processes
**Warning**: >200 indicates potential issue
**Note**: Includes all processes (system, user, agents)

**Query Examples**:
```
avg:system.processes{host:vibecode*}
system.processes{host:vibecode*} by {state}  # Breakdown by state
```

**States**:
- Running: Actively executing
- Sleeping: Waiting for event
- Zombie: Terminated but not reaped

---

### system.processes.res_mem_avg

**Description**: Average resident memory per process
**Type**: Gauge
**Unit**: Bytes (MB scale)
**Collection Interval**: 30 seconds
**Expected Value**: 5-15 MB
**High Values (>50 MB)**: Memory-heavy processes present

**Query Examples**:
```
avg:system.processes.res_mem_avg{host:vibecode*}
```

---

### system.processes.res_mem_max

**Description**: Maximum resident memory used by any single process
**Type**: Gauge
**Unit**: Bytes
**Collection Interval**: 30 seconds
**Expected Value**: 50-200 MB
**High Values (>500 MB)**: Identify memory-heavy processes

**Query Examples**:
```
max:system.processes.res_mem_max{host:vibecode*}
```

**Investigation**: Find which process
```
max:process.memory.rss{host:vibecode*} by {process_name}
```

---

## Process-Specific Metrics

### process.memory.rss

**Description**: Resident Set Size for specific process (memory actually in RAM)
**Type**: Gauge
**Unit**: Bytes
**Scope**: Per process_name tag
**Collection Interval**: 10 seconds

**Query Examples (Datadog Agent)**:
```
avg:process.memory.rss{process_name:datadog-agent, host:vibecode*}
```

**Expected**: 50-150 MB for Datadog agent

**Query Examples (OpenVSCode)**:
```
max:process.memory.rss{process_name:node, host:vibecode*}
```

---

### process.cpu

**Description**: CPU percentage used by specific process
**Type**: Gauge
**Unit**: Percentage (0-100)
**Scope**: Per process_name tag
**Collection Interval**: 10 seconds

**Query Examples (Datadog Agent)**:
```
avg:process.cpu{process_name:datadog-agent, host:vibecode*}
```

**Expected**: <5% for agent (normal overhead)

**Alert if Agent CPU > 10%**: May indicate collection problem

---

### process.up

**Description**: Whether process is currently running (1 = running, 0 = down)
**Type**: Gauge
**Unit**: Binary (0 or 1)
**Scope**: Per process_name tag
**Collection Interval**: 10 seconds

**Query Examples**:
```
avg:process.up{process_name:datadog-agent, host:vibecode*}
```

**Health Check**:
```
Alert when avg:process.up{process_name:datadog-agent} == 0
```

---

## System Load Metrics

### system.load.1

**Description**: 1-minute average system load
**Type**: Gauge
**Unit**: Load average (not percentage)
**Collection Interval**: 10 seconds
**Expected Value**: 1-2 (for 2-core VM)
**Interpretation**: Compare to CPU core count
**Note**: Load > core count = system overloaded

**Query Examples**:
```
avg:system.load.1{host:vibecode*}
```

**Health**:
```
- Load = 1: Good (1 core busy)
- Load = 2: Fully utilized (2 cores busy)
- Load > 2: Overloaded (queued processes)
```

---

### system.load.5

**Description**: 5-minute average system load
**Type**: Gauge
**Unit**: Load average
**Collection Interval**: 10 seconds
**Use**: Trend indicator (medium-term load)

---

### system.load.15

**Description**: 15-minute average system load
**Type**: Gauge
**Unit**: Load average
**Collection Interval**: 10 seconds
**Use**: Long-term trend indicator

---

## Uptime & Status Metrics

### system.uptime

**Description**: Seconds since system last boot (monotonically increasing)
**Type**: Gauge
**Unit**: Seconds
**Collection Interval**: 10 seconds
**Expected**: Increases continuously
**Use**: Verify VM is online and stable

**Query Examples**:
```
avg:system.uptime{host:vibecode*}
```

**Sudden Drops**: Indicate VM crash/restart

---

## Metric Tags & Filtering

### Common Tags

All system metrics include:

| Tag | Example | Scope |
|-----|---------|-------|
| host | vibecode-vm, basicvibecode | Per VM |
| device | eth0, sda | Network/disk interfaces |
| core | 0, 1, 2 | CPU cores |
| state | running, sleeping | Process states |

### Filtering Examples

```
# By specific VM
{host:basicvibecode*}

# By all VibeCode VMs
{host:vibecode*}

# By device
{device:eth0}

# By CPU core
{core:0} OR {core:1}

# By process name
{process_name:datadog-agent}

# By service
{service:vibecode-vm}
```

---

## Collection & Retention

### Agent Configuration

- **Collection Interval**: 10 seconds (system metrics)
- **Aggregation**: 30 seconds (on send)
- **Retention**: 15 months (Datadog default)
- **Tags**: Applied per host/metric

### Data Points

- Each metric: 1 value per collection interval
- Rate of metrics: ~50 metrics per host per interval
- Daily metrics: ~5,000 metric samples per host per day

---

## Metric Health Indicators

### Healthy System

```
✓ CPU user: 5-30%
✓ CPU system: 2-10%
✓ CPU iowait: 1-5%
✓ Memory used: 30-60% of total
✓ Disk usage: <60% capacity
✓ Processes: 30-80 running
✓ Load: 1-2 (2-core VM)
✓ Uptime: Continuously increasing
```

### Warning Signs

```
⚠ CPU user: 50-70%
⚠ Memory used: 70-80% of total
⚠ Disk usage: 70-80% capacity
⚠ Processes: 100+ running
⚠ Load: 3-5 (for 2-core VM)
⚠ Swap usage: >0 bytes
⚠ Packet drops: >0
```

### Critical Issues

```
✗ CPU user: >80%
✗ Memory used: >90% of total
✗ Memory swap: Any usage
✗ Disk usage: >90% capacity
✗ Disk free: <100 MB
✗ Processes: >200 running
✗ Load: >10 (for 2-core VM)
✗ Uptime: Decreasing (indicates restart)
✗ Agent process: Down (up == 0)
```

---

## Related Documentation

- Datadog Docs: https://docs.datadoghq.com/
- System Metrics: https://docs.datadoghq.com/agent/metrics/
- Process Checks: https://docs.datadoghq.com/integrations/process/

---

**Metrics Catalog Version**: 1.0
**Last Updated**: 2025-11-25
**Total Metrics Documented**: 35+
**Scope**: VibeCode VMs on macOS
