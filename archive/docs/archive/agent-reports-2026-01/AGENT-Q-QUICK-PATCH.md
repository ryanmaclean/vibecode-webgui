# Agent Q: Quick Patch Guide

## TL;DR

Replace 4 blocks of code in the init script to save 7 seconds of boot time.

**File**: `/Users/ryan.maclean/vibecode-webgui/azure/build-unified-services-with-datadog.sh`
**Section**: Init script (lines 1039-1529)
**Expected result**: Boot time drops from ~17s to ~10s

---

## Patch 1: Module Initialization (Lines 1122-1124)

### Find this:
```bash
    echo "✓ Kernel modules loaded"

    # Give modules time to initialize (increased from 2s to 5s per Agent 5 recommendation)
    echo "  Waiting 5 seconds for module initialization..."
    sleep 5
```

### Replace with:
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

**Savings: 4-5 seconds**

---

## Patch 2: Network Interface Polling (Lines 1153-1165)

### Find this:
```bash
for i in $(seq 1 20); do
    for iface in eth0 eth1 enp0s1 ens3; do
        if ip link show "$iface" >/dev/null 2>&1; then
            ELAPSED=$(awk "BEGIN {printf \"%.1f\", $i * 0.5}")
            echo "  ✓ Found interface: $iface after ${ELAPSED} seconds"
            echo "[$(date '+%Y-%m-%d %H:%M:%S.%3N')] Found interface: $iface after ${ELAPSED}s" >> /tmp/network.log
            FOUND_IFACE="$iface"
            NETWORK_MODE="network"
            break 2  # Break both loops
        fi
    done
    sleep 0.5
done
```

### Replace with:
```bash
for i in $(seq 1 100); do  # 100 iterations at 0.1s = 10 seconds max
    for iface in eth0 eth1 enp0s1 ens3; do
        if ip link show "$iface" >/dev/null 2>&1; then
            ELAPSED=$(awk "BEGIN {printf \"%.1f\", $i * 0.1}")
            echo "  ✓ Found interface: $iface after ${ELAPSED} seconds"
            echo "[$(date '+%Y-%m-%d %H:%M:%S.%3N')] Found interface: $iface after ${ELAPSED}s" >> /tmp/network.log
            FOUND_IFACE="$iface"
            NETWORK_MODE="network"
            break 2  # Break both loops
        fi
    done
    sleep 0.1  # OPTIMIZED: Reduced from 0.5s
done
```

**Savings: 0.3-0.4 seconds**

---

## Patch 3: Link Stabilization (Line 1181)

### Find this:
```bash
if [ -n "$FOUND_IFACE" ]; then
    echo "Network interface: $FOUND_IFACE"
    echo "[$(date '+%Y-%m-%d %H:%M:%S.%3N')] Found interface: $FOUND_IFACE" >> /tmp/network.log
    ip link set "$FOUND_IFACE" up
    sleep 0.5
```

### Replace with:
```bash
if [ -n "$FOUND_IFACE" ]; then
    echo "Network interface: $FOUND_IFACE"
    echo "[$(date '+%Y-%m-%d %H:%M:%S.%3N')] Found interface: $FOUND_IFACE" >> /tmp/network.log
    ip link set "$FOUND_IFACE" up
    sleep 0.1  # OPTIMIZED: Reduced from 0.5s - virtio_net stabilizes quickly
```

**Savings: 0.4 seconds**

---

## Patch 4: Service Readiness (Lines 1389-1392)

### Find this:
```bash
echo ""
echo "All services launched in background!"
echo "Waiting 3 seconds for services to initialize..."
sleep 3  # Single wait for all services

# ==============================================================================
# SERVICE VERIFICATION - Check each service independently
# ==============================================================================
```

### Replace with:
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

# ==============================================================================
# SERVICE VERIFICATION - Check each service independently
# ==============================================================================
```

**Savings: 1.5-2 seconds**

---

## Alternative: Use Pre-built Optimized Script

Instead of manual patching, you can use the complete optimized init script:

```bash
# Copy optimized init script into build script
cd /Users/ryan.maclean/vibecode-webgui

# The optimized script is at:
# azure/init-optimized.sh

# You need to replace lines 1039-1529 in:
# azure/build-unified-services-with-datadog.sh

# With the contents of:
# azure/init-optimized.sh
```

---

## Quick Test

After applying patches:

```bash
# Rebuild
./azure/build-unified-services-with-datadog.sh

# Boot and time it
time vfkit --cpus 4 --memory 2048 \
    --kernel ~/.vibecode/vms/vibecode-valkey/kernel/vmlinux \
    --initrd azure/unified-services-static.cpio.gz \
    --kernel-cmdline "console=hvc0" \
    --device virtio-net,nat,mac=52:54:00:12:34:70 \
    --device virtio-rng

# Watch for these timing messages:
# "Interface ready after X.Xs" - should be 0.1-0.5s (not 5s)
# "All X services ready after X.Xs" - should be 1.0-1.5s (not 3s)
```

---

## Verification Checklist

After patching and rebuilding, verify:

- [ ] Boot time is 10-12 seconds (down from ~17s)
- [ ] All 4 services start successfully
- [ ] No timeout warnings
- [ ] Services are accessible via network
- [ ] Console shows "Interface ready after 0.X seconds" (not 5 seconds)
- [ ] Console shows "All services ready after 1.X seconds" (not 3 seconds)

---

## Rollback

If something breaks:

```bash
cd /Users/ryan.maclean/vibecode-webgui
git checkout azure/build-unified-services-with-datadog.sh
./azure/build-unified-services-with-datadog.sh
```

---

## Expected Console Output (Optimized)

```
=========================================
  Unified Services VM
  OPTIMIZED BOOT (Agent Q)
  Valkey + PostgreSQL + OpenVSCode
=========================================

Installing busybox applets...
Mounting filesystems...

=== Loading Kernel Modules ===
Loading failover.ko...
Loading net_failover.ko...
Loading virtio_net.ko...
✓ Kernel modules loaded
  Waiting for network interface (max 3 seconds)...
  ✓ Interface ready after 0.2s         ← NEW: Fast detection

=== Network Setup ===
Waiting for network interface to appear (max 10 seconds)...
  ✓ Found interface: eth0 after 0.1 seconds   ← NEW: Faster polling
Network interface: eth0
Requesting DHCP address...
✓ DHCP IP: 192.168.64.10

=== Preparing Service Directories ===
✓ Preparation complete

=========================================
  PARALLEL SERVICE STARTUP
  All services launching simultaneously
=========================================

Launching services in parallel...
  - SSH server launched (PID: 206)
  - Valkey server launched (PID: 207)
  - PostgreSQL server launched (PID: 208)
  - OpenVSCode server launched (PID: 209)

All services launched in background!
Waiting for services to be ready (max 5 seconds)...
✓ All 4 services ready after 1.2s     ← NEW: Smart polling

=========================================
  SERVICE VERIFICATION
=========================================

=== SSH Server ===
✓ SSH server running (PID: 206)

=== Valkey Server ===
✓ Valkey running (PID: 207)

=== PostgreSQL Server ===
✓ PostgreSQL running (PID: 208)
  ✓ Accepting connections

=== OpenVSCode Server ===
✓ OpenVSCode running (PID: 209)

=========================================
  Unified Services VM Ready            ← ~10 seconds total
=========================================
```

---

## Summary

**Total Patches**: 4
**Total Lines Changed**: ~80 lines
**Expected Time Savings**: 6-7 seconds
**Target Boot Time**: 10-12 seconds
**Risk Level**: Low (all timeouts maintained)

Apply all 4 patches, rebuild, and enjoy 40% faster boot times!
