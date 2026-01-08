# AGENT-S: Quick Reference Guide

## What Changed

The build script now uses **smart service health checks** instead of a generic 3-second wait.

## Key Numbers

| Metric | Old | New |
|--------|-----|-----|
| Fixed Wait Time | 3.0s | 0s (polling only) |
| Check Interval | Single | 500ms (2x/sec) |
| Per-Service Timeout | N/A | 10s |
| Min Time to Ready (fast) | 3.1s | 1-2s |
| Max Time to Failure | 3.1s | 10s |

## Health Checks by Service

### SSH Server
- **Port**: 22
- **Method**: Port connectivity + process check
- **Timeout**: 10 seconds
- **Success Message**: `✓ SSH server responding on port 22`

### Valkey (Redis)
- **Port**: 6379
- **Method**: Port connectivity + process check
- **Timeout**: 10 seconds
- **Success Message**: `✓ Valkey responding on port 6379`

### PostgreSQL
- **Port**: 5432
- **Method**: Port connectivity + process check + connection test
- **Timeout**: 10 seconds
- **Success States**:
  - `✓ PostgreSQL responding on port 5432 ... Accepting connections`
  - `⚠ Port responsive but not accepting connections yet`

### OpenVSCode
- **Port**: 8080
- **Method**: Port connectivity + process check
- **Timeout**: 10 seconds
- **Success Message**: `✓ OpenVSCode responding on port 8080`

## Output Examples

### All Services Ready
```
=========================================
  SMART SERVICE HEALTH CHECKS
=========================================

=== SSH Server ===
Checking SSH (port 22, max 10s)... ✓ Ready (1s)
✓ SSH server responding on port 22
  Connect: ssh root@localhost

=== Valkey Server ===
Checking Valkey (port 6379, max 10s)... ✓ Ready (1s)
✓ Valkey responding on port 6379
  Port: 6379

=== PostgreSQL Server ===
Checking PostgreSQL (port 5432, max 10s)... ✓ Ready (2s)
✓ PostgreSQL responding on port 5432
  ✓ Accepting connections
  Extensions installing in background...

=== OpenVSCode Server ===
Checking OpenVSCode (port 8080, max 10s)... ✓ Ready (2s)
✓ OpenVSCode responding on port 8080
  URL: http://localhost:8080

=========================================
  Unified Services VM Ready
=========================================

✓ All services passed health checks!

Health Check Results:
SSH: Ready
Valkey: Ready
PostgreSQL: Ready (accepting connections)
OpenVSCode: Ready
```

### Service Failure Example
```
=== SSH Server ===
Checking SSH (port 22, max 10s)... ✗ Timeout after 10s
✗ SSH server failed to respond
  Last 5 lines from log:
    [ERROR] SSH initialization failed
    [ERROR] Port 22 already in use
```

## Technical Details

### Port Detection Method
Uses POSIX bash `/dev/tcp` for portability:
```bash
timeout 1 bash -c "cat < /dev/null > /dev/tcp/127.0.0.1/$PORT"
```

**Why not netcat?**
- Works in minimal environments (busybox, musl libc)
- No external tool dependencies
- Faster startup in containers
- Works in Alpine Linux

### Polling Algorithm
1. Start timer
2. Check port connectivity every 500ms
3. Check process verification if port fails
4. Continue until service ready OR timeout reached
5. Report elapsed time on success
6. Report failure after max timeout

### Timeout Tracking
Each service has independent 10-second timeout:
- Service 1: 0-10 seconds
- Service 2: Checks in parallel (sequentially in script)
- Services check one-by-one but each gets full 10s

## Configuration

To adjust timeout (edit `/azure/build-unified-services-with-datadog.sh`):

**Change timeout to 15 seconds**:
```bash
# Line 1460: SSH
if check_service_health "SSH" "22" "15" "$SSH_CHECK"; then

# Line 1484: Valkey
if check_service_health "Valkey" "6379" "15" "$VALKEY_CHECK"; then

# etc.
```

**Change polling interval** (line 1410):
```bash
local POLL_INTERVAL=0.25  # Check 4x per second instead of 2x
```

## Performance Metrics

### Fast Startup (all services ready in < 1 second)
- Time to report ready: ~1-2 seconds
- First poll hits: Immediate success
- Result: Optimal boot time

### Normal Startup (services ready in 2-5 seconds)
- Time to report ready: ~2-5 seconds
- First poll hits: Miss, second+ tries: Success
- Result: Services ready as soon as actually listening

### Slow PostgreSQL (needs 5-10 seconds for connections)
- Port listening: ~2-3 seconds
- Connection acceptance: ~5-10 seconds
- Result: Detailed status shows port ready, connection pending

### Service Failure (never starts)
- Polling continues for full 10 seconds
- After 10s: Report failure with error logs
- Result: Faster failure detection than old 3s approach

## Files Modified

- `/Users/ryan.maclean/vibecode-webgui/azure/build-unified-services-with-datadog.sh`
  - Lines 1350-1602 (replaces old 1390-1502)
  - New function: `check_service_health()` at line 1403
  - Service checks: Lines 1454-1567
  - Summary reporting: Lines 1569-1602

## Troubleshooting

### "Timeout after 10s" for a service

**Possible causes**:
1. Port not actually listening (check logs)
2. Process didn't start (check PID assignment)
3. Port already in use (check with `netstat`)
4. Service crash (check log files)

**Debug steps**:
```bash
# Check process
ps aux | grep service-name

# Check port
netstat -tuln | grep :PORT

# Check logs
head -20 /tmp/service.log

# Manual port test
timeout 1 bash -c "cat < /dev/null > /dev/tcp/127.0.0.1/PORT"
echo $?  # 0 = success, 1 = failure
```

### PostgreSQL shows "Port responsive but not accepting connections"

**Possible causes**:
1. PostgreSQL still initializing
2. Connection authentication issue
3. Database not fully started

**Action**: Wait a few more seconds, connection test is non-blocking

### All services timeout (system slow)

**Possible causes**:
1. Limited system resources (memory, CPU)
2. Slow disk I/O
3. System overloaded

**Action**: Increase timeout values to 15-20 seconds

## See Also

- Full documentation: `AGENT-S-HEALTH-CHECK-IMPROVEMENTS.md`
- Build script: `azure/build-unified-services-with-datadog.sh`
- Boot test results: `AGENT5_BOOT_TIME_REPORT.md`
