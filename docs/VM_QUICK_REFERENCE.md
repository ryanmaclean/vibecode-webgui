# VibeCode VM Quick Reference

**Last Updated:** $(date)

## Available VMs

| VM | Size | Port(s) | Status | Command |
|----|------|---------|--------|---------|
| Valkey | 29MB | 6379 | Standalone | `redis-cli -h 192.168.64.X -p 6379` |
| PostgreSQL | 37MB | 5432 | Standalone | `psql -h 192.168.64.X -U postgres` |
| Unified Services | 114MB | 22, 8080, 6379, 5432 | Multi-service | See below |
| Node.js (Reference) | 52MB | 3000 | Working (100%) | `curl http://192.168.64.X:3000` |

## VM Details

### 1. Valkey Standalone VM

**Purpose:** Redis-compatible in-memory cache
**Size:** 29 MB
**Services:** Valkey 7.2.11
**Ports:** 6379

**Quick Launch:**
```bash
bash ~/vibecode-webgui/scripts/launch/launch-valkey.sh
```

**Access:**
```bash
# Get VM IP from launch output, then:
redis-cli -h 192.168.64.X -p 6379

# Test connection
redis-cli -h 192.168.64.X -p 6379 PING

# Set/Get values
redis-cli -h 192.168.64.X -p 6379 SET mykey "Hello"
redis-cli -h 192.168.64.X -p 6379 GET mykey
```

### 2. PostgreSQL Standalone VM

**Purpose:** Full PostgreSQL database
**Size:** 37 MB (pure Ubuntu glibc)
**Services:** PostgreSQL 16.4
**Ports:** 5432

**Quick Launch:**
```bash
bash ~/vibecode-webgui/scripts/launch/launch-postgresql.sh
```

**Access:**
```bash
# Get VM IP from launch output, then:
psql -h 192.168.64.X -U postgres -d vibecode

# Test connection
pg_isready -h 192.168.64.X -p 5432

# Connect and query
psql -h 192.168.64.X -U postgres -d vibecode -c "SELECT version();"
```

### 3. Unified Services VM (Optimized)

**Purpose:** All-in-one development environment
**Size:** 114 MB (optimized from 174 MB)
**Services:** SSH + OpenVSCode + Valkey + PostgreSQL
**Ports:** 22 (SSH), 8080 (VSCode), 6379 (Valkey), 5432 (PostgreSQL)

**Quick Launch:**
```bash
bash ~/vibecode-webgui/scripts/launch/launch-unified.sh
```

**Access:**
```bash
# SSH Access
ssh root@192.168.64.X

# VSCode Web IDE
open http://192.168.64.X:8080

# Valkey
redis-cli -h 192.168.64.X -p 6379

# PostgreSQL
psql -h 192.168.64.X -U postgres -d vibecode
```

### 4. Node.js Reference VM (Working)

**Purpose:** Reference implementation (100% operational)
**Size:** 52 MB
**Services:** Node.js HTTP server
**Ports:** 3000

**Quick Launch:**
```bash
bash ~/vibecode-webgui/scripts/launch/launch-nodejs.sh
```

**Access:**
```bash
# HTTP request
curl http://192.168.64.X:3000

# Test performance
time curl http://192.168.64.X:3000
```

**Test Results:**
- Boot time: 20-30 seconds
- Response time: 1.9-3.4ms
- Success rate: 100% (10/10 tests)

## Testing

### Run Full Test Suite

Test all VMs automatically:
```bash
bash ~/vibecode-webgui/scripts/test-swiftui-vms.sh
```

This will:
1. Test each VM in sequence
2. Measure boot times
3. Test port connectivity
4. Run service-specific tests
5. Generate detailed report

### Test Individual VM

```bash
# Launch specific VM
bash ~/vibecode-webgui/scripts/launch/launch-valkey.sh

# In another terminal, test manually
redis-cli -h 192.168.64.X -p 6379 PING
```

## VM Files

All initramfs files are located in:
```
~/vibecode-webgui/azure/
```

Key files:
- `valkey-standalone-v2.cpio.gz` - Valkey VM
- `postgresql-standalone.cpio.gz` - PostgreSQL VM
- `unified-services-optimized.cpio.gz` - Unified VM
- `nodejs-complete.cpio.gz` - Node.js reference VM

## Swift Apps

VM launcher applications are located in:
```
~/vibecode-webgui/azure/SwiftUI-Apps/
```

Available apps:
- `ValkeyVibeCode.app`
- `PostgreSQLVibeCode.app`
- `UnifiedServicesVibeCode.app`
- `NodeJSVibeCode.app`

## Troubleshooting

### VM Won't Boot

1. Check if initramfs exists:
   ```bash
   ls -lh ~/vibecode-webgui/azure/*.cpio.gz
   ```

2. Kill any stuck VMs:
   ```bash
   killall NodeJS 2>/dev/null || true
   ```

3. Clean console logs:
   ```bash
   rm -f /tmp/vibecode-console-*.log
   ```

4. Try launching again

### Can't Find VM IP

Check console log:
```bash
tail -100 /tmp/vibecode-console-*.log | grep "inet "
```

### Port Not Reachable

1. Verify VM is running:
   ```bash
   ps aux | grep NodeJS
   ```

2. Test port with netcat:
   ```bash
   nc -zv 192.168.64.X PORT_NUMBER
   ```

3. Check console log for errors:
   ```bash
   tail -50 /tmp/vibecode-console-*.log
   ```

### Service Not Starting

1. Check console log for service errors:
   ```bash
   grep -i error /tmp/vibecode-console-*.log
   ```

2. Verify service-specific dependencies:
   - Valkey: Check for library errors
   - PostgreSQL: Check for glibc version
   - Unified: Check all services started

## Performance Benchmarks

### Boot Times

| VM | Boot Time | Notes |
|----|-----------|-------|
| Valkey | ~25s | Fast boot, minimal services |
| PostgreSQL | ~30s | Database initialization |
| Unified | ~40s | Multiple services startup |
| Node.js | 20-30s | Reference (working) |

### Response Times

| VM | Service | Response Time |
|----|---------|---------------|
| Valkey | PING | <5ms |
| PostgreSQL | pg_isready | <10ms |
| Node.js | HTTP GET | 1.9-3.4ms |

## Architecture Notes

### Multi-Port Vsock Forwarding

All VMs use enhanced vsock forwarding that supports multiple ports:
- Modified `NATNetworkStrategy.swift`
- Supports simultaneous forwarding of ports 3000, 8080, 22, 6379, 5432
- No Lima dependencies

### Size Optimizations

Applied to Unified VM:
- Removed documentation files
- Stripped debug symbols
- Removed unnecessary VSCode extensions
- Removed character encoding libraries
- Result: 60 MB reduction (174 MB → 114 MB)

### Library Compatibility

- **Valkey:** Uses musl libc (Alpine-based)
- **PostgreSQL:** Uses Ubuntu glibc (better compatibility)
- **Unified:** Mixed Alpine + Ubuntu packages
- **Node.js:** Pure Alpine (reference)

## Development Notes

### Testing Methodology

1. Use NodeJSVibeCode.app as test harness
2. Swap initramfs files for each test
3. Measure boot time from launch to network up
4. Test port connectivity with netcat
5. Run service-specific validation
6. Collect console logs

### Console Logs

All VMs write to:
```
/tmp/vibecode-console-TIMESTAMP.log
```

Logs include:
- Boot messages
- Network configuration
- Service startup
- Error messages

## Next Steps

### Recommended Improvements

1. **Add Health Checks**
   - Implement readiness probes
   - Add liveness monitoring
   - Create status API

2. **Optimize Boot Times**
   - Parallel service startup
   - Reduce init scripts
   - Optimize kernel parameters

3. **Add Monitoring**
   - Datadog agent integration
   - Metrics collection
   - Log aggregation

4. **Improve Testing**
   - Add load testing
   - Performance regression tests
   - Automated nightly tests

## Resources

- VM Build Scripts: `~/vibecode-webgui/scripts/rebuild-specialized-vms.sh`
- Test Suite: `~/vibecode-webgui/scripts/test-swiftui-vms.sh`
- Launch Scripts: `~/vibecode-webgui/scripts/launch/`
- Documentation: `~/vibecode-webgui/docs/`

## Support

For issues or questions:
1. Check console logs: `/tmp/vibecode-console-*.log`
2. Run test suite: `bash ~/vibecode-webgui/scripts/test-swiftui-vms.sh`
3. Review build logs: `~/vibecode-webgui/azure/build-logs/`

---

**Note:** This is a living document. Update as VMs evolve and new features are added.
