# VibeCode Datadog Integration Demo

**Date:** 2025-11-25
**Status:** Production Ready
**Integration Level:** Full Observability (Logs, Metrics, Traces)

## Overview

This demo showcases complete Datadog observability integration across all VibeCode VM applications, with metrics, logs, and traces flowing from Linux VMs to Datadog cloud platform. The integration enables real-time monitoring of system health, application performance, and end-to-end tracing across distributed services.

## Architecture

```
┌─────────────────────────────────────────┐
│          macOS Host                     │
│  ┌───────────────────────────────────┐  │
│  │  BasicVibeCodeApp / LiquidGlass   │  │
│  │  - DD_API_KEY from environment    │  │
│  │  - Pass to VM via kernel cmdline  │  │
│  └───────────────────────────────────┘  │
│               │                          │
│               ▼                          │
│  ┌───────────────────────────────────┐  │
│  │   Apple Virtualization.framework  │  │
│  │   - VZVirtualMachine              │  │
│  │   - Network (NAT/vsock)           │  │
│  └───────────────────────────────────┘  │
│               │                          │
└───────────────┼──────────────────────────┘
                │
                ▼
┌───────────────────────────────────────────┐
│        Linux VM (Alpine/Ubuntu)           │
│  ┌─────────────────────────────────────┐  │
│  │   Datadog Agent                     │  │
│  │   - Reads DD_API_KEY from /proc    │  │
│  │   - Collects metrics, logs, traces │  │
│  │   - Sends to Datadog cloud         │  │
│  └─────────────────────────────────────┘  │
│               │                            │
│  ┌─────────────────────────────────────┐  │
│  │   Application Services              │  │
│  │   - Bun runtime                     │  │
│  │   - OpenVSCode Server               │  │
│  │   - Custom applications             │  │
│  └─────────────────────────────────────┘  │
└───────────────────────────────────────────┘
                │
                ▼
┌───────────────────────────────────────────┐
│         Datadog Platform                  │
│  https://app.datadoghq.com                │
│  - Infrastructure monitoring              │
│  - Log aggregation                        │
│  - APM & distributed tracing              │
│  - Custom dashboards                      │
└───────────────────────────────────────────┘
```

## Prerequisites

- macOS 13+ with Apple Silicon (M1 or later)
- Datadog account (free trial available at datadoghq.com)
- DD_API_KEY environment variable set (32 character hex string)
- VibeCode apps built with Datadog-enabled initramfs
- SSH connectivity to VMs
- Terminal access with standard Unix tools

## Quick Start

### Step 1: Set Datadog Credentials

```bash
# Set your Datadog API key
export DD_API_KEY="your_32_character_hex_key"

# Set Datadog site (default is US)
export DD_SITE="datadoghq.com"  # or datadoghq.eu for EU

# Verify
echo $DD_API_KEY
```

### Step 2: Launch VMs

```bash
cd /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps

# Open both apps
open BasicVibeCode.app
open LiquidGlassVibeCode.app
```

### Step 3: Wait for Data Flow

- Initial boot: 1-2 minutes
- Agent startup: 30-60 seconds
- First metrics appear: 2-3 minutes
- Full data picture: 5 minutes

### Step 4: Access Datadog Dashboards

Once data flows:

1. **Infrastructure View**
   https://app.datadoghq.com/infrastructure

2. **Metrics Explorer**
   https://app.datadoghq.com/metric/explorer

3. **Log Explorer**
   https://app.datadoghq.com/logs

4. **APM Traces**
   https://app.datadoghq.com/apm/traces

5. **VibeCode Dashboard**
   Import custom dashboard JSON (see docs/demos/datadog-vibecode-dashboard.json)

## What Gets Monitored

### System Metrics

Collected automatically by Datadog Agent:

- **CPU Usage** (per core)
  - `system.cpu.user`: User space CPU percentage
  - `system.cpu.system`: Kernel space CPU percentage
  - `system.cpu.iowait`: Time waiting for I/O

- **Memory Usage**
  - `system.mem.used`: Total used memory (bytes)
  - `system.mem.free`: Available memory (bytes)
  - `system.mem.pct_usable`: Percentage of usable memory

- **Network I/O**
  - `system.net.bytes_rcvd`: Bytes received per interface
  - `system.net.bytes_sent`: Bytes sent per interface
  - `system.net.packets_in`: Packets received
  - `system.net.packets_out`: Packets sent

- **Disk I/O**
  - `system.disk.reads`: Disk read operations
  - `system.disk.writes`: Disk write operations
  - `system.disk.in_use`: Disk utilization percentage

- **Process Monitoring**
  - `system.processes`: Total process count
  - Process-specific metrics (memory, CPU per process)

### Application Metrics

Custom metrics sent by applications:

- **OpenVSCode Server**
  - HTTP request count and latency
  - Active connections
  - Memory usage

- **Bun Runtime**
  - Execution time per request
  - Memory allocation
  - Garbage collection events

- **Custom Applications**
  - Custom business logic metrics
  - Service-specific counters

### Log Collection

Logs aggregated from multiple sources:

- **Kernel Messages**: System boot, hardware events
- **Application Logs**: stdout/stderr from services
- **Service Logs**: syslog, systemd journal
- **Datadog Agent Logs**: Agent health and status

### Traces (APM)

Distributed tracing enables:

- **Request Tracing**: End-to-end request paths
- **Service Dependencies**: Service interaction map
- **Performance Analysis**: Latency breakdown
- **Error Tracking**: Stack traces and error context

## Integration Details

### How DD_API_KEY Gets to the VM

1. **Host Side**: Set `DD_API_KEY` environment variable
2. **VM Launch**: BasicVibeCodeApp reads environment
3. **Kernel Cmdline**: Passes as `dd_api_key=...` parameter
4. **VM Boot**: Linux kernel exposes via `/proc/cmdline`
5. **Agent Initialization**: Reads from `/proc/cmdline`
6. **Authentication**: Uses API key for all Datadog API calls

### Data Flow

```
Host Environment Variable
          ↓
VM Configuration
          ↓
/proc/cmdline in VM
          ↓
Datadog Agent reads /proc/cmdline
          ↓
Agent Initialization with API Key
          ↓
Metrics Collection (5s intervals)
          ↓
Log Collection (real-time)
          ↓
Trace Collection (continuous)
          ↓
HTTPS POST to Datadog API
          ↓
Datadog Platform Processing
          ↓
Dashboards & Alerts
```

## Data Collection Intervals

- **Metrics**: 10 second collection, 30 second aggregation
- **Logs**: Real-time collection, 10 second batching
- **Traces**: Continuous sampling (100% of traces by default)
- **Processes**: 30 second intervals

## Network Requirements

- **Outbound HTTPS**: To api.datadoghq.com (port 443)
- **DNS Resolution**: datadoghq.com and related domains
- **No Inbound Required**: Data flows one-way from VM to Datadog
- **Bandwidth**: Minimal (typically <100KB/min for light workloads)

## Success Indicators

### Immediate (within 1 minute)
- [x] VM boots without error
- [x] Network connectivity established
- [x] SSH accessible
- [x] Datadog Agent process running

### Short Term (within 5 minutes)
- [x] Infrastructure page shows host
- [x] System metrics visible (CPU, memory)
- [x] Host tags appear (environment, service)
- [x] Agent status: "OK"

### Medium Term (within 10 minutes)
- [x] Application metrics flowing
- [x] First logs appearing
- [x] Network metrics complete
- [x] Process metrics detailed

### Long Term (after 30 minutes)
- [x] Traces populated (if APM enabled)
- [x] Service map generated
- [x] Baseline metrics established
- [x] Trend data available

## Common Dashboard Queries

### Find All VibeCode VMs
```
host:vibecode* OR host:basicvibecode* OR host:liquidglass*
```

### CPU Usage Across Fleet
```
avg:system.cpu.user{host:vibecode*} by {host}
```

### Memory Pressure
```
avg:system.mem.used{host:vibecode*} / avg:system.mem.total{host:vibecode*}
```

### Network Throughput
```
sum:system.net.bytes_rcvd{host:vibecode*}.as_rate() + sum:system.net.bytes_sent{host:vibecode*}.as_rate()
```

### Error Rate in Logs
```
status:error service:vibecode-vm
```

## Troubleshooting Quick Links

| Issue | Diagnostic Command | Expected Result |
|-------|------------------|-----------------|
| API Key not found | `cat /proc/cmdline` | Contains `dd_api_key=...` |
| Agent not running | `ps aux \| grep datadog` | Datadog agent process visible |
| No metrics | Check agent status in Datadog UI | Shows as "OK" with metrics |
| Network blocked | `curl -I https://api.datadoghq.com` | HTTP 200 response |
| Logs missing | Check log level configuration | Proper permissions on log files |

## Next Steps

1. **Review** docs/demos/DATADOG-TUTORIAL.md for detailed walkthrough
2. **Verify** docs/demos/DATADOG-VERIFICATION-CHECKLIST.md for comprehensive testing
3. **Reference** docs/demos/DATADOG-QUERIES.md for useful Datadog queries
4. **Troubleshoot** docs/guides/DATADOG-TROUBLESHOOTING.md if issues arise
5. **Optimize** docs/reference/DATADOG-METRICS-CATALOG.md for custom metrics

## Support Resources

- **Datadog Documentation**: https://docs.datadoghq.com/
- **Datadog Agent**: https://docs.datadoghq.com/agent/
- **APM Setup**: https://docs.datadoghq.com/tracing/
- **Log Collection**: https://docs.datadoghq.com/logs/

---

**Last Updated**: 2025-11-25
**Maintained By**: VibeCode Demo Team
