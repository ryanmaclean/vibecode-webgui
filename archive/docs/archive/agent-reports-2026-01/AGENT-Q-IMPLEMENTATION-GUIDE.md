# Agent Q: Boot Time Optimization Implementation Guide

## Quick Reference

**Goal**: Reduce boot time from ~17s to ~10s
**Method**: Replace fixed sleeps with intelligent polling
**Expected Savings**: 6-7 seconds
**Risk Level**: Low (proper timeouts maintained)

---

## Summary of Changes

### Change 1: Module Initialization Wait (Lines 1122-1124)
**Impact**: Save 3-4 seconds

**BEFORE** (Fixed 5-second sleep):
```bash
echo "✓ Kernel modules loaded"

# Give modules time to initialize (increased from 2s to 5s per Agent 5 recommendation)
echo "  Waiting 5 seconds for module initialization..."
sleep 5
```

**AFTER** (Intelligent polling):
```bash
echo "✓ Kernel modules loaded"

# OPTIMIZATION: Poll for interface instead of fixed 5-second sleep
echo "  Waiting for network interface (max 3 seconds)..."
INTERFACE_READY=0
for i in $(seq 1 30); do
    if ip link show 2>/dev/null | grep -qE "eth0|eth1|enp0s1|ens3"; then
        WAIT_TIME=$(awk "BEGIN {printf \"%.1f\", $i * 0.1}")
        echo "  ✓ Interface ready after ${WAIT_TIME}s"
        INTERFACE_READY=1
        break
    fi
    sleep 0.1
done

if [ $INTERFACE_READY -eq 0 ]; then
    echo "  ⚠ Interface not ready after 3s (continuing anyway)"
fi
```

**Rationale**:
- Modules load instantly; the wait is for network interface to appear
- Interface typically ready in 0.1-0.5 seconds
- Still maintains 3-second timeout for safety
- Reduces typical wait from 5s to 0.1-0.5s

---

### Change 2: Network Interface Polling (Line 1153-1165)
**Impact**: Save 0.2-0.3 seconds

**BEFORE** (0.5s polling interval):
```bash
for i in $(seq 1 20); do
    for iface in eth0 eth1 enp0s1 ens3; do
        if ip link show "$iface" >/dev/null 2>&1; then
            ELAPSED=$(awk "BEGIN {printf \"%.1f\", $i * 0.5}")
            # ... found interface
        fi
    done
    sleep 0.5
done
```

**AFTER** (0.1s polling interval):
```bash
for i in $(seq 1 100); do  # 100 iterations at 0.1s = 10 seconds max
    for iface in eth0 eth1 enp0s1 ens3; do
        if ip link show "$iface" >/dev/null 2>&1; then
            ELAPSED=$(awk "BEGIN {printf \"%.1f\", $i * 0.1}")
            # ... found interface
        fi
    done
    sleep 0.1  # OPTIMIZED: Reduced from 0.5s
done
```

**Rationale**:
- Interface typically found in first iteration
- Faster polling = faster detection
- Still maintains 10-second max timeout
- Reduces typical detection time from 0.5s to 0.1s

---

### Change 3: Link Stabilization (Line 1181)
**Impact**: Save 0.3-0.4 seconds

**BEFORE** (0.5s wait):
```bash
ip link set "$FOUND_IFACE" up
sleep 0.5
```

**AFTER** (0.1s wait):
```bash
ip link set "$FOUND_IFACE" up
sleep 0.1  # OPTIMIZED: Reduced from 0.5s - virtio_net stabilizes quickly
```

**Rationale**:
- virtio_net network driver stabilizes almost instantly
- Physical hardware needs time; virtual network does not
- Reduces wait from 0.5s to 0.1s

---

### Change 4: Service Readiness Wait (Lines 1389-1391)
**Impact**: Save 1-2 seconds

**BEFORE** (Fixed 3-second sleep):
```bash
echo ""
echo "All services launched in background!"
echo "Waiting 3 seconds for services to initialize..."
sleep 3  # Single wait for all services
```

**AFTER** (Intelligent port polling):
```bash
echo ""
echo "All services launched in background!"

# OPTIMIZATION: Poll for service readiness instead of fixed 3-second sleep
echo "Waiting for services to be ready (max 5 seconds)..."

SERVICES_READY=0
for i in $(seq 1 50); do
    READY_COUNT=0
    TOTAL_COUNT=0

    # Check Valkey (port 6379)
    if [ -n "$VALKEY_PID" ] && ps | grep -q "^[[:space:]]*$VALKEY_PID"; then
        TOTAL_COUNT=$((TOTAL_COUNT + 1))
        if nc -z 127.0.0.1 6379 2>/dev/null; then
            READY_COUNT=$((READY_COUNT + 1))
        fi
    fi

    # Check PostgreSQL (port 5432)
    if [ -n "$POSTGRES_PID" ] && ps | grep -q "^[[:space:]]*$POSTGRES_PID"; then
        TOTAL_COUNT=$((TOTAL_COUNT + 1))
        if nc -z 127.0.0.1 5432 2>/dev/null; then
            READY_COUNT=$((READY_COUNT + 1))
        fi
    fi

    # Check OpenVSCode (port 8080)
    if [ -n "$VSCODE_PID" ] && ps | grep -q "^[[:space:]]*$VSCODE_PID"; then
        TOTAL_COUNT=$((TOTAL_COUNT + 1))
        if nc -z 127.0.0.1 8080 2>/dev/null; then
            READY_COUNT=$((READY_COUNT + 1))
        fi
    fi

    # Check SSH (port 22)
    if [ -n "$SSH_PID" ] && ps | grep -q "^[[:space:]]*$SSH_PID"; then
        TOTAL_COUNT=$((TOTAL_COUNT + 1))
        if nc -z 127.0.0.1 22 2>/dev/null; then
            READY_COUNT=$((READY_COUNT + 1))
        fi
    fi

    if [ $READY_COUNT -eq $TOTAL_COUNT ] && [ $TOTAL_COUNT -gt 0 ]; then
        WAIT_TIME=$(awk "BEGIN {printf \"%.1f\", $i * 0.1}")
        echo "✓ All $READY_COUNT services ready after ${WAIT_TIME}s"
        SERVICES_READY=1
        break
    fi

    sleep 0.1
done

if [ $SERVICES_READY -eq 0 ]; then
    echo "⚠ Some services may still be initializing"
fi
```

**Rationale**:
- Services are ready when their ports accept connections
- Port checks are more accurate than fixed time waits
- Services typically ready in 1-1.5 seconds
- Still maintains 5-second max timeout (increased from 3s for safety)
- Reduces typical wait from 3s to 1-1.5s

---

## Implementation Steps

### Step 1: Apply Changes to Build Script

Edit the file: `/Users/ryan.maclean/vibecode-webgui/azure/build-unified-services-with-datadog.sh`

Replace the init script section (lines 1039-1529) with the optimized version from:
`/Users/ryan.maclean/vibecode-webgui/azure/init-optimized.sh`

### Step 2: Rebuild Initramfs

```bash
cd /Users/ryan.maclean/vibecode-webgui
./azure/build-unified-services-with-datadog.sh
```

### Step 3: Test Boot Time

```bash
# Test boot 5 times and measure timing
for i in {1..5}; do
    echo "=== Boot Test $i ==="
    vfkit --cpus 4 --memory 2048 \
        --kernel ~/.vibecode/vms/vibecode-valkey/kernel/vmlinux \
        --initrd azure/unified-services-static.cpio.gz \
        --kernel-cmdline "console=hvc0" \
        --device virtio-net,nat,mac=52:54:00:12:34:70 \
        --device virtio-rng \
        > /tmp/boot-test-optimized-$i.log 2>&1 &

    VFKIT_PID=$!
    sleep 20
    kill -9 $VFKIT_PID

    # Extract boot time
    grep "Interface ready after" /tmp/boot-test-optimized-$i.log
    grep "services ready after" /tmp/boot-test-optimized-$i.log
done
```

### Step 4: Verify Service Reliability

Check that all 4 services still start successfully:

```bash
# SSH into VM and verify
ssh root@<VM_IP>

# Check all services running
ps aux | grep -E "valkey|postgres|openvscode|dropbear"

# Check service logs
cat /tmp/valkey.log
cat /tmp/postgresql.log
cat /tmp/openvscode.log

# Test connectivity
nc -z 127.0.0.1 6379  # Valkey
nc -z 127.0.0.1 5432  # PostgreSQL
nc -z 127.0.0.1 8080  # OpenVSCode
nc -z 127.0.0.1 22    # SSH
```

---

## Expected Results

### Timing Comparison

| Phase | Before | After | Savings |
|-------|--------|-------|---------|
| Kernel boot | 0.7s | 0.7s | 0s |
| Module + interface wait | 5.0s | 0.1-0.5s | 4.5-4.9s |
| Interface detection | 0.5s | 0.1-0.2s | 0.3-0.4s |
| Link stabilization | 0.5s | 0.1s | 0.4s |
| DHCP (success case) | 1.0s | 1.0s | 0s |
| Service prep | 0.5s | 0.5s | 0s |
| Service wait | 3.0s | 1.0-1.5s | 1.5-2.0s |
| Verification | 0.5s | 0.5s | 0s |
| **TOTAL** | **11.7s** | **4.0-4.9s** | **6.7-7.7s** |

### Boot Time Projection

**Current boot time** (DHCP success): ~11.7 seconds
**Optimized boot time** (DHCP success): ~4.0-4.9 seconds
**Savings**: ~6.7-7.7 seconds

**Current boot time** (DHCP failure): ~17 seconds (includes 5s of DHCP retries)
**Optimized boot time** (DHCP failure): ~10-11 seconds
**Savings**: ~6-7 seconds

---

## Safety Features Maintained

### Timeouts
- ✓ Module/interface wait: 3-second timeout (reduced from 5s but still adequate)
- ✓ Interface detection: 10-second timeout (unchanged)
- ✓ Service readiness: 5-second timeout (increased from 3s for extra safety)
- ✓ DHCP attempts: 3 attempts with backoff (unchanged)

### Fallback Mechanisms
- ✓ Continue boot if interface not ready
- ✓ Static IP fallback if DHCP fails
- ✓ Continue boot if services not ready
- ✓ Localhost-only mode if no network

### Reliability Checks
- ✓ Process existence checks (ps | grep)
- ✓ Port availability checks (nc -z)
- ✓ Both checks must pass for "ready" status
- ✓ Individual service status reporting

---

## Rollback Plan

If optimizations cause issues:

1. **Restore original init script**:
   ```bash
   cd /Users/ryan.maclean/vibecode-webgui
   git checkout azure/build-unified-services-with-datadog.sh
   ```

2. **Rebuild with original**:
   ```bash
   ./azure/build-unified-services-with-datadog.sh
   ```

3. **Incremental optimization**:
   - Start with only Change 1 (module wait)
   - Test thoroughly
   - Add Change 4 (service wait)
   - Test thoroughly
   - Add Changes 2 & 3 (network polling)

---

## Monitoring & Validation

### Key Metrics to Track

1. **Boot time**: From kernel start to "Unified Services VM Ready"
2. **Service success rate**: 4/4 services running
3. **Interface detection time**: Time to find eth0
4. **Service readiness time**: Time for all ports to be listening

### Success Criteria

- ✓ Boot time < 12 seconds (target: 10-12s)
- ✓ Service success rate = 100%
- ✓ No timeout-related failures
- ✓ All services accessible via network

### Failure Indicators

- ✗ Boot time > 15 seconds (regression)
- ✗ Service success rate < 100%
- ✗ Frequent timeout warnings
- ✗ Services not accessible

---

## Conclusion

These optimizations are **low-risk** and **high-impact**:

- Replace fixed delays with event-driven polling
- Maintain all safety timeouts and fallbacks
- Expected boot time reduction: **6-7 seconds**
- Target boot time: **10-12 seconds** ✓ ACHIEVABLE

The optimized init script is ready for testing at:
`/Users/ryan.maclean/vibecode-webgui/azure/init-optimized.sh`
