# Agent T - Monitoring Quick Reference

**For**: Operators and DevOps teams
**Date**: 2026-01-05
**Duration**: 2-3 minutes to read

---

## Quick Start (60 seconds)

### View Real-Time Dashboard
```bash
# Auto-refreshing dashboard (updates every 5 seconds)
watch -n 5 'tail -30 /tmp/service-health.txt'
```

### Check JSON Metrics
```bash
# Pretty-printed current metrics
cat /tmp/service-metrics-snapshot.json | jq .
```

### Follow Monitor Log
```bash
# Real-time log stream
tail -f /tmp/service-monitor.log
```

---

## Service Status at a Glance

### All services healthy
```
│ valkey     [████████████] HEALTHY    PID:12345  Mem: 245MB  6%   │
│ postgresql [████████████] HEALTHY    PID:12346  Mem: 156MB  4%   │
│ openvscode [████████████] HEALTHY    PID:12347  Mem: 342MB  8%   │
│ ssh        [████████████] HEALTHY    PID:12348  Mem:  23MB  1%   │
```

### Service down/crashed
```
│ valkey     [░░░░░░░░░░░░] STOPPED  PID: N/A   Mem:    0MB  0%   │
```

---

## Key Metrics Explained

| Metric | Normal Range | Warning | Critical |
|--------|--------------|---------|----------|
| **CPU Total** | < 10% | 25-50% | > 80% |
| **Memory %** | < 50% | 50-75% | > 90% |
| **Valkey Mem** | 200-400 MB | > 600 MB | > 800 MB |
| **PostgreSQL Mem** | 100-300 MB | > 400 MB | > 600 MB |
| **OpenVSCode Mem** | 300-500 MB | > 800 MB | > 1000 MB |
| **Connections** | 0-5 per service | Increasing trend | > 20 |

---

## Common Operations

### Check Service Status
```bash
# Get status of specific service
jq '.services.valkey' /tmp/service-metrics-snapshot.json

# Get all service statuses
jq '.services | keys[] as $k | "\($k): \(.[$k].status)"' /tmp/service-metrics-snapshot.json
```

### Monitor Memory Growth
```bash
# Watch Valkey memory over time
watch -n 30 'jq .services.valkey.memory_mb /tmp/service-metrics-snapshot.json'

# See memory trend
tail -20 /tmp/service-monitor.log | grep "Memory:"
```

### Check Error Count
```bash
# Get errors per service
jq '.services | to_entries[] | "\(.key): \(.value.errors_last_30s)"' \
  /tmp/service-metrics-snapshot.json
```

### View Service Logs
```bash
# Valkey logs
tail -f /tmp/valkey.log

# PostgreSQL logs
tail -f /tmp/postgresql.log

# OpenVSCode logs
tail -f /tmp/openvscode.log

# SSH logs
tail -f /tmp/dropbear.log
```

### Check Network Activity
```bash
# Active connections
netstat -tan | grep ESTAB

# Connections per port
netstat -tan | grep ESTAB | awk '{print $4}' | sort | uniq -c

# Monitor live connections
watch -n 5 'netstat -tan | grep -E "6379|5432|8080|22"'
```

---

## Quick Diagnostics

### Service is slow/unresponsive

```bash
# 1. Check CPU usage
jq '.services.openvscode.cpu_percent' /tmp/service-metrics-snapshot.json

# 2. Check memory usage
jq '.services.openvscode.memory_mb' /tmp/service-metrics-snapshot.json

# 3. Check connection count
jq '.services.openvscode.connections' /tmp/service-metrics-snapshot.json

# 4. Check service log
tail -100 /tmp/openvscode.log | grep -i "error\|warning\|slow"

# 5. Check system resources
jq '.system' /tmp/service-metrics-snapshot.json
```

### Memory usage spike

```bash
# Which service is using memory?
jq '.services | to_entries | sort_by(.value.memory_mb) | reverse[] |
  "\(.key): \(.value.memory_mb)MB"' /tmp/service-metrics-snapshot.json

# Is it growing continuously?
tail -30 /tmp/service-monitor.log | grep "Memory:"

# Check for leaks in PostgreSQL
tail -100 /tmp/postgresql.log | grep -i "memory\|oom\|fail"
```

### High error rate

```bash
# Which service has errors?
jq '.services | to_entries[] | select(.value.errors_last_30s > 0) |
  "\(.key): \(.value.errors_last_30s) errors"' /tmp/service-metrics-snapshot.json

# View actual errors
grep -i "ERROR\|FAIL\|CRITICAL" /tmp/valkey.log | tail -20
```

### Connection issues

```bash
# Are ports listening?
netstat -tln | grep LISTEN

# Specific port
netstat -tln | grep ":6379"  # Valkey
netstat -tln | grep ":5432"  # PostgreSQL
netstat -tln | grep ":8080"  # OpenVSCode
netstat -tln | grep ":22"    # SSH

# Active connections by port
netstat -tan | grep ESTAB | awk '{print $4}' | sort | uniq -c
```

---

## Alert Severity Guide

### 🔴 CRITICAL (Act immediately)
- Service down (PID missing)
- Memory > 90% of total
- CPU > 80% sustained
- Port not listening
- Error rate > 100/minute

**Action**: SSH into VM, check service logs, restart if needed

### 🟡 WARNING (Attention within 15 minutes)
- Memory > 70% of total
- CPU > 50% sustained for 5+ minutes
- Connection pool > 80% utilized
- Increasing error rate trend
- Response time > 500ms

**Action**: Investigate cause, monitor closely, consider scaling

### 🟢 INFO (For tracking)
- Service restart
- Normal memory fluctuations
- Periodic high CPU (expected under load)
- New error type
- Connection count changes

**Action**: Log for analysis, no immediate action needed

---

## Connection to Datadog

If Datadog is enabled (check: `ps aux | grep statsd-bridge`):

```bash
# Verify bridge is running
ps aux | grep statsd-bridge

# Check if metrics are being sent
grep "Sent.*metrics" /tmp/datadog-bridge.log

# View last few metrics sent
tail -20 /tmp/datadog-bridge.log
```

### Datadog Dashboard
Access metrics at: https://app.datadoghq.com/dashboard

**Key metrics to track**:
- `service.valkey.memory_mb`
- `service.postgresql.connections`
- `service.openvscode.cpu_percent`
- `system.memory_percent`

---

## SSH Access to VM

### Find VM IP
```bash
# During boot, watch for IP assignment
watch -n 2 'tail -20 /tmp/network.log'

# Or check DHCP leases
cat /var/db/dhcpd_leases | grep "ip_address"
```

### Connect
```bash
# Replace <VM_IP> with actual IP
ssh root@<VM_IP>

# Default password: vibecode
# Or use private key if configured
```

### Inside VM
```bash
# Check service status
ps aux | grep -E "valkey|postgres|openvscode|dropbear"

# View monitoring
cat /tmp/service-health.txt

# Check specific service
jq .services.valkey /tmp/service-metrics-snapshot.json
```

---

## Common Issues & Fixes

### Monitor script not running
```bash
# Check if process exists
ps aux | grep service-monitor

# Start it manually
/usr/local/bin/service-monitor.sh --daemon

# Check for errors
cat /tmp/monitor-startup.log
```

### Metrics file empty/missing
```bash
# Monitor might be starting
ls -la /tmp/service-metrics-snapshot.json

# Wait 30 seconds for first update
sleep 30
cat /tmp/service-metrics-snapshot.json

# If still missing, check logs
tail /tmp/service-monitor.log
```

### High memory reported but services fine
```bash
# Verify against process list
jq '.services | to_entries[] | "\(.key): \(.value.memory_mb)MB"' \
  /tmp/service-metrics-snapshot.json

# Cross-check with ps
ps aux | awk '$11 ~ /valkey|postgres|node|dropbear/ {print $11, $6 " KB"}'

# Convert MB to KB for comparison
jq '.services.valkey.memory_mb' /tmp/service-metrics-snapshot.json | \
  awk '{print $1 * 1024 " KB"}'
```

### Cannot SSH into VM
```bash
# Check if SSH service is running
jq '.services.ssh' /tmp/service-metrics-snapshot.json

# Check dropbear logs
tail -50 /tmp/dropbear.log

# Check if port 22 is listening
netstat -tln | grep ":22"

# Check VM network
tail -50 /tmp/network.log
```

---

## Performance Tuning Tips

### High memory on OpenVSCode
```bash
# Check active extensions
ls -la /opt/openvscode/extensions/ | wc -l

# Memory is normal for VSCode - no action usually needed
# Only concern if > 1GB sustained

# Consider restarting if unresponsive
pkill -f openvscode-server
# It will restart automatically
```

### High CPU on PostgreSQL
```bash
# Check active queries
su postgres -c "psql -d postgres -c 'SELECT pid, duration, query FROM long_running_queries;'"

# Check table sizes
su postgres -c "psql -d postgres -c 'SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) FROM pg_tables ORDER BY pg_total_relation_size DESC LIMIT 10;'"

# Analyze query performance
EXPLAIN ANALYZE <your_query>;
```

### Valkey eviction rate high
```bash
# Check memory policy
redis-cli CONFIG GET maxmemory-policy

# Monitor eviction rate
redis-cli INFO stats | grep evicted

# Increase if memory available
redis-cli CONFIG SET maxmemory 256mb
```

---

## Log Files Reference

| Service | Log File | Command |
|---------|----------|---------|
| Valkey | `/tmp/valkey.log` | `tail -f /tmp/valkey.log` |
| PostgreSQL | `/tmp/postgresql.log` | `tail -f /tmp/postgresql.log` |
| OpenVSCode | `/tmp/openvscode.log` | `tail -f /tmp/openvscode.log` |
| SSH | `/tmp/dropbear.log` | `tail -f /tmp/dropbear.log` |
| Monitor | `/tmp/service-monitor.log` | `tail -f /tmp/service-monitor.log` |
| Network | `/tmp/network.log` | `tail -f /tmp/network.log` |

---

## Health Check Endpoint

### Test connectivity
```bash
# If exposed on port 8080
curl http://127.0.0.1:8080/health

# Expected response:
# {
#   "status": "healthy",
#   "uptime_seconds": 3600,
#   "services": {
#     "valkey": "up",
#     "postgresql": "up",
#     "openvscode": "up",
#     "ssh": "up"
#   },
#   "memory_percent": 27.7,
#   "cpu_percent": 2.0
# }
```

---

## Contact & Escalation

### Local Debugging
1. SSH to VM: `ssh root@<IP>`
2. Check service logs
3. Review monitoring data
4. Restart service if needed

### Escalation
If issue persists:
1. Collect debug information
   ```bash
   mkdir /tmp/debug-$(date +%s)
   cp /tmp/service-*.* /tmp/debug-*/
   cp /tmp/*.log /tmp/debug-*/
   ```
2. Contact DevOps team
3. Provide monitoring snapshots and logs

---

## One-Liner Commands

```bash
# Overall health score
jq '.system.healthy_services / .system.total_services * 100 | round' /tmp/service-metrics-snapshot.json

# Total memory usage MB
jq '[.services[].memory_mb] | add' /tmp/service-metrics-snapshot.json

# All services status (one line)
jq '.services | to_entries | map("\(.key):\(.value.status)") | join(" ")' /tmp/service-metrics-snapshot.json

# CPU vs Memory usage
jq '{cpu: .system.total_cpu_percent, memory: .system.memory_percent}' /tmp/service-metrics-snapshot.json

# Service with highest memory
jq '.services | to_entries | max_by(.value.memory_mb) | "\(.key): \(.value.memory_mb)MB"' /tmp/service-metrics-snapshot.json

# Export as CSV
echo "timestamp,service,status,memory_mb,cpu_percent,connections" && \
jq -r '.services | to_entries[] | "\(.key),\(.value.status),\(.value.memory_mb),\(.value.cpu_percent),\(.value.connections)"' /tmp/service-metrics-snapshot.json

# Services with errors
jq '.services | to_entries[] | select(.value.errors_last_30s > 0) | "\(.key): \(.value.errors_last_30s)"' /tmp/service-metrics-snapshot.json
```

---

**Last Updated**: 2026-01-05
**Status**: Ready for Operations
