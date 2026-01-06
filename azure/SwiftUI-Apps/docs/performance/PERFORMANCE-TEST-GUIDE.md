# VibeCode Performance Testing Guide
**Complete Manual Testing Procedures**

## Overview

This guide provides step-by-step instructions for conducting comprehensive performance testing of VibeCode apps. Use this alongside the automated quick-performance-check.sh script.

---

## Prerequisites

```bash
# Ensure apps are built
./build-apps.sh
./bundle-apps.sh

# Verify apps exist
ls -la *.app

# Run quick automated check
./quick-performance-check.sh
```

---

## Test 1: VM Startup Time Measurement

### Objective
Measure time from app launch to VM server ready (3-5 second target).

### Procedure

#### BasicVibeCode

1. **Prepare terminal with stopwatch:**
```bash
# Terminal 1: Monitor console output
log stream --predicate 'process == "BasicVibeCode"' --level debug
```

2. **Run startup test (3 times):**
```bash
# Terminal 2: Launch app and time
time open BasicVibeCode.app

# Watch for "Server started on 192.168.64.X:8080"
# Record time when message appears
# Note: 'time' measures open command, not VM startup
# Manual timing required for VM startup
```

3. **Manual timing:**
   - Start timer when app window appears
   - Stop timer when "Server started" message appears
   - Record: Run 1: _____ seconds
   - Kill app: `killall BasicVibeCode`
   - Wait 5 seconds for cleanup
   - Repeat for Runs 2 and 3

4. **Calculate average:**
   - Average = (Run1 + Run2 + Run3) / 3
   - Target: 3-5 seconds ✅

#### LiquidGlassVibeCode

Repeat same procedure for LiquidGlassVibeCode.app.

**Expected results:**
- BasicVibeCode: ~3.5-4.0 seconds
- LiquidGlassVibeCode: ~4.0-4.5 seconds (slight overhead from observability)

---

## Test 2: Memory Usage Monitoring

### Objective
Measure memory usage in idle and loaded states (<150MB target).

### Procedure

#### Using Activity Monitor (Recommended)

1. **Open Activity Monitor:**
```bash
open -a "Activity Monitor"
```

2. **Start BasicVibeCode:**
```bash
open BasicVibeCode.app
```

3. **Measure at each state:**

   **State 1: App Launched (pre-VM)**
   - Find "BasicVibeCode" process in Activity Monitor
   - Note "Memory" column value
   - Expected: ~15-20 MB
   - Record: _____ MB

   **State 2: VM Starting**
   - After clicking "Start VM"
   - While "Starting..." indicator is visible
   - Expected: ~80-100 MB
   - Record: _____ MB

   **State 3: VM Running (Idle)**
   - After "Server started" message
   - Wait 30 seconds
   - Expected: ~120-140 MB
   - Record: _____ MB

   **State 4: VM Running (Under Load)**
   - Open browser: `open http://192.168.64.X:8080/`
   - Reload page 10 times rapidly
   - Watch memory during load
   - Expected: ~140-160 MB
   - Record: _____ MB

4. **Repeat for LiquidGlassVibeCode**

#### Using Command Line

```bash
# Get PID
PID=$(pgrep BasicVibeCode)

# Monitor memory continuously
watch -n 1 "ps -o rss=,vsz=,command= -p $PID | awk '{print \"RSS: \" \$1/1024 \" MB, VSZ: \" \$2/1024 \" MB\"}'"

# Or use top
top -pid $PID

# Memory breakdown
vmmap $PID | grep -E "(REGION|Physical|MALLOC|STACK)"
```

### Analysis

**Memory Budget:**
- SwiftUI framework: ~10-15 MB
- Virtualization.framework: ~50-70 MB
- VM guest memory (RSS): ~60-80 MB
- App overhead: ~5-10 MB
- **Total: ~125-175 MB**

**Pass Criteria:**
- ✅ Idle < 150 MB
- ⚠️ Load < 150 MB (may slightly exceed)
- ❌ Idle > 200 MB (investigate leak)

---

## Test 3: Memory Leak Detection

### Objective
Verify no memory leaks during VM lifecycle (0 leaks target).

### Procedure

#### Using `leaks` Tool

1. **Start app and get PID:**
```bash
open BasicVibeCode.app
sleep 5
PID=$(pgrep BasicVibeCode)
echo "PID: $PID"
```

2. **Baseline (pre-VM start):**
```bash
leaks $PID > /tmp/leaks-baseline.txt
grep "LEAK:" /tmp/leaks-baseline.txt | wc -l
# Expected: 0 leaks
```

3. **Start VM and measure:**
```bash
# Click "Start VM" in app
sleep 30  # Wait for VM to fully start

leaks $PID > /tmp/leaks-running.txt
grep "LEAK:" /tmp/leaks-running.txt | wc -l
# Expected: 0 leaks
```

4. **Stop VM and measure:**
```bash
# Click "Stop VM" in app
sleep 10  # Wait for cleanup

leaks $PID > /tmp/leaks-stopped.txt
grep "LEAK:" /tmp/leaks-stopped.txt | wc -l
# Expected: 0 leaks
```

5. **Cycle test (5 iterations):**
```bash
# Automated cycle test
for i in {1..5}; do
    echo "=== Cycle $i ==="
    # Manually: Start VM, wait 10s, Stop VM, wait 5s
    sleep 15
    leaks $PID | grep -c "LEAK:"
done
```

6. **Analyze results:**
```bash
# View full leak report
less /tmp/leaks-stopped.txt

# Look for patterns
grep -A 5 "LEAK:" /tmp/leaks-stopped.txt
```

**Pass Criteria:**
- ✅ 0 leaks at all stages
- ⚠️ 1-2 small leaks (< 1KB each) may be framework related
- ❌ Growing leaks or > 10 leaks

#### Using Instruments

```bash
# Launch with Instruments Allocations template
instruments -t Allocations \
    -D /tmp/allocations.trace \
    BasicVibeCode.app

# After test completes (manually cycle VM)
open /tmp/allocations.trace

# In Instruments:
# 1. Select "Allocations" instrument
# 2. Click "Mark Generation" before/after each cycle
# 3. Look for persistent growth
# 4. Check "Leaks" instrument for confirmed leaks
```

---

## Test 4: Network Performance Benchmarking

### Objective
Measure network latency, DHCP detection time, and HTTP response time.

### Procedure

#### Part A: DHCP Detection Time

1. **Monitor console during VM start:**
```bash
# Terminal 1
log stream --predicate 'subsystem == "com.vibecode"' --level debug
```

2. **Start VM and measure:**
```bash
# Terminal 2
open BasicVibeCode.app
# Click "Start VM"
# Time from "Starting VM..." to "IP detected: 192.168.64.X"
```

3. **Record times (3 runs):**
   - Run 1: _____ seconds
   - Run 2: _____ seconds
   - Run 3: _____ seconds
   - Average: _____ seconds
   - Target: < 5 seconds ✅

#### Part B: Network Latency (Ping)

```bash
# Get VM IP from app console
VM_IP="192.168.64.X"  # Replace with actual IP

# Ping test
ping -c 20 $VM_IP

# Analyze results:
# Look for: round-trip min/avg/max/stddev
# Target: avg < 5ms ✅
```

**Expected output:**
```
20 packets transmitted, 20 packets received, 0.0% packet loss
round-trip min/avg/max/stddev = 0.123/0.456/1.234/0.123 ms
```

#### Part C: HTTP Response Time

```bash
VM_IP="192.168.64.X"  # Replace with actual IP

# Single request timing
time curl -s http://$VM_IP:8080/ > /dev/null

# Multiple requests (10 samples)
for i in {1..10}; do
    time curl -s http://$VM_IP:8080/ > /dev/null 2>&1
done

# Automated timing with curl's built-in metrics
curl -w "@-" -o /dev/null -s http://$VM_IP:8080/ <<'EOF'
time_namelookup:  %{time_namelookup}\n
time_connect:     %{time_connect}\n
time_starttransfer: %{time_starttransfer}\n
time_total:       %{time_total}\n
EOF
```

**Expected results:**
- First request (cold): < 100ms
- Subsequent requests: < 10ms
- Target: avg < 10ms ✅

#### Part D: Network Throughput

```bash
# Download speed test
curl -o /dev/null http://$VM_IP:8080/

# Upload speed test (if server supports POST)
dd if=/dev/zero bs=1M count=10 | curl -X POST --data-binary @- http://$VM_IP:8080/upload
```

---

## Test 5: Instruments Profiling

### Objective
Identify performance bottlenecks using Xcode Instruments.

### Procedure

#### Time Profiler (CPU Hotspots)

1. **Launch Time Profiler:**
```bash
instruments -t "Time Profiler" \
    -D /tmp/time-profile.trace \
    BasicVibeCode.app
```

2. **Perform test actions:**
   - Wait for app to launch
   - Click "Start VM"
   - Wait for VM to fully start
   - Click "Stop VM"
   - Quit app
   - (Instruments will capture all CPU activity)

3. **Analyze trace:**
```bash
open /tmp/time-profile.trace
```

4. **Look for hotspots:**
   - **Expected hotspots:**
     - `VZVirtualMachine.start()` - 60-70% of time
     - `VZLinuxBootLoader.init()` - 15-20%
     - DHCP polling loop - 5-10%
     - SwiftUI rendering - 3-5%

   - **Red flags:**
     - App code > 20% of time
     - Spinning loops or hangs
     - Unexpected synchronous operations

5. **Export report:**
   - File > Export > Save as /tmp/time-profile-report.txt

#### Allocations (Memory Analysis)

1. **Launch Allocations template:**
```bash
instruments -t "Allocations" \
    -D /tmp/allocations.trace \
    BasicVibeCode.app
```

2. **Mark generations during test:**
   - Launch: Click "Mark Generation" (Gen 1)
   - After VM start: Mark Generation (Gen 2)
   - After VM stop: Mark Generation (Gen 3)
   - After quit: Final state

3. **Analyze growth:**
   - Look for persistent growth between generations
   - Check "Leaks" for confirmed memory leaks
   - Review large allocations (> 1MB)

4. **Expected patterns:**
   - Gen 1 → Gen 2: Growth due to VM allocation (~512MB virtual)
   - Gen 2 → Gen 3: Should return to near Gen 1 levels
   - Persistent growth = potential leak

#### System Trace (Advanced)

```bash
# Capture system-wide trace
instruments -t "System Trace" \
    -D /tmp/system-trace.trace \
    BasicVibeCode.app

# Useful for:
# - Thread activity
# - System call patterns
# - I/O operations
# - Lock contention
```

---

## Test 6: BaseVMManager Performance Comparison

### Objective
Compare performance before/after migrating to BaseVMManager.

### Procedure

#### Baseline (Current - Inline VMManager)

1. **Measure current BasicVibeCode:**
```bash
# Run all tests from above
# Record:
# - Startup time: _____ seconds
# - Memory (idle): _____ MB
# - Memory (load): _____ MB
```

#### Migrated (BaseVMManager)

2. **After migration (future):**
   - Repeat all tests
   - Compare results
   - Should be nearly identical

3. **Expected delta:**
```
| Metric         | Before | After | Delta | Status |
|----------------|--------|-------|-------|--------|
| Startup time   | 3.5s   | 3.5s  | 0s    | ✅ OK  |
| Memory (idle)  | 130MB  | 130MB | 0MB   | ✅ OK  |
| Memory (load)  | 150MB  | 150MB | 0MB   | ✅ OK  |
| Executable     | 360KB  | 360KB | 0KB   | ✅ OK  |
```

**Pass criteria:**
- ✅ No performance regression (< 5% variance)
- ✅ Same memory footprint
- ✅ Code is more maintainable
- ❌ Any regression > 10% (investigate)

---

## Test 7: Stress Testing

### Objective
Test stability under continuous operation.

### Procedure

#### Long-Running Stability Test

```bash
# Run VM for extended period
open BasicVibeCode.app
# Click "Start VM"
# Leave running for 1 hour

# Monitor memory every 5 minutes
while true; do
    date
    ps aux | grep BasicVibeCode | grep -v grep
    sleep 300
done > /tmp/stability-log.txt
```

#### Rapid Cycle Test

```bash
# Start/stop VM repeatedly
for i in {1..20}; do
    echo "=== Cycle $i/20 ==="

    # Start VM
    open BasicVibeCode.app
    sleep 30  # Wait for VM to start

    # Check memory
    ps aux | grep BasicVibeCode | grep -v grep | awk '{print $6/1024 " MB"}'

    # Stop VM
    killall BasicVibeCode
    sleep 10  # Wait for cleanup
done
```

**Expected results:**
- ✅ Stable memory (no growth)
- ✅ No crashes or hangs
- ✅ Clean shutdowns
- ❌ Memory growth > 50MB (leak suspected)

---

## Test 8: Comparison with Archived Builds

### Objective
Verify no performance regression from previous version.

### Procedure

1. **Extract archived build:**
```bash
cd /tmp
unzip ~/vibecode-webgui/azure/SwiftUI-Apps/BasicVibeCode.zip
```

2. **Run same tests on both versions:**
   - Current build (Nov 25, 2025)
   - Archived build (Oct 29, 2024)

3. **Compare metrics:**
```
| Metric         | Oct 29 | Nov 25 | Delta | Status |
|----------------|--------|--------|-------|--------|
| Startup time   | TBD    | TBD    | TBD   | ⏳     |
| Memory (idle)  | TBD    | TBD    | TBD   | ⏳     |
| Bundle size    | 116MB* | 153MB  | +37MB | ⚠️**   |

* Compressed .zip
** Uncompressed .app (compress for fair comparison)
```

4. **Create compressed build for comparison:**
```bash
zip -r BasicVibeCode-Nov25.zip BasicVibeCode.app
du -sh BasicVibeCode-Nov25.zip
# Expected: ~116-120 MB (similar to Oct 29)
```

---

## Test 9: Observability Overhead Analysis

### Objective
Measure performance impact of Datadog/OpenTelemetry integration.

### Procedure

#### Compare BasicVibeCode vs LiquidGlassVibeCode

1. **Run identical tests on both apps:**
```bash
# BasicVibeCode (no observability)
# - Startup time: _____ seconds
# - Memory usage: _____ MB

# LiquidGlassVibeCode (with observability)
# - Startup time: _____ seconds
# - Memory usage: _____ MB
```

2. **Calculate overhead:**
```
Startup overhead = LiquidGlass - Basic
Memory overhead = LiquidGlass - Basic

Expected:
- Startup: +0.3-0.5 seconds (10-15%)
- Memory: +3-5 MB (2-4%)
```

3. **Profile observability code:**
```bash
# Time Profiler with LiquidGlassVibeCode
instruments -t "Time Profiler" LiquidGlassVibeCode.app

# Look for:
# - DatadogLogger initialization time
# - OpenTelemetry span creation overhead
# - Network trace submission time
```

---

## Test 10: Network Strategy Performance

### Objective
Compare NAT vs vsock networking performance.

### Procedure

#### NAT (BasicVibeCode, LiquidGlassVibeCode)

```bash
# DHCP detection time: _____ seconds
# First HTTP request: _____ ms
# Avg HTTP request: _____ ms
```

#### vsock (VsockVibeCode) - If available

```bash
# Connection time: _____ seconds (should be faster)
# First HTTP request: _____ ms
# Avg HTTP request: _____ ms
```

#### Expected comparison:

```
| Metric            | NAT   | vsock | Improvement |
|-------------------|-------|-------|-------------|
| Detection time    | ~3s   | ~0.5s | 6x faster   |
| First request     | ~50ms | ~30ms | 40% faster  |
| Avg request       | ~5ms  | ~3ms  | 40% faster  |
```

**Recommendation:** Consider migrating all apps to vsock for better performance.

---

## Results Summary Template

### Test Execution Checklist

- [ ] VM Startup Time (Section 1)
  - [ ] BasicVibeCode: _____ seconds
  - [ ] LiquidGlassVibeCode: _____ seconds

- [ ] Memory Usage (Section 2)
  - [ ] BasicVibeCode idle: _____ MB
  - [ ] BasicVibeCode load: _____ MB
  - [ ] LiquidGlassVibeCode idle: _____ MB
  - [ ] LiquidGlassVibeCode load: _____ MB

- [ ] Memory Leaks (Section 3)
  - [ ] BasicVibeCode: _____ leaks
  - [ ] LiquidGlassVibeCode: _____ leaks

- [ ] Network Performance (Section 4)
  - [ ] DHCP detection: _____ seconds
  - [ ] Ping latency: _____ ms
  - [ ] HTTP response: _____ ms

- [ ] Instruments Profiling (Section 5)
  - [ ] Time Profiler: _____ (hotspots identified)
  - [ ] Allocations: _____ (growth pattern)

- [ ] BaseVMManager Comparison (Section 6)
  - [ ] Performance delta: _____ (none expected)

- [ ] Stress Testing (Section 7)
  - [ ] Long-running stability: _____ (pass/fail)
  - [ ] Rapid cycle: _____ (pass/fail)

- [ ] Archived Build Comparison (Section 8)
  - [ ] Performance regression: _____ (yes/no)

- [ ] Observability Overhead (Section 9)
  - [ ] Startup overhead: _____ seconds
  - [ ] Memory overhead: _____ MB

- [ ] Network Strategy (Section 10)
  - [ ] NAT vs vsock: _____ (comparison)

### Overall Assessment

**Performance Status:** ✅ Pass / ⚠️ Needs optimization / ❌ Fail

**Key Findings:**
1. _____
2. _____
3. _____

**Recommendations:**
1. _____
2. _____
3. _____

---

## Appendix: Automated Test Script

For convenience, use the included automation scripts:

```bash
# Quick automated checks
./quick-performance-check.sh

# Full automated test suite (requires manual VM interaction)
./performance-test.sh

# Continuous monitoring
./monitor-vm-manual.sh
```

---

**Guide Version:** 1.0
**Last Updated:** 2025-11-25
**Location:** `/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/PERFORMANCE-TEST-GUIDE.md`
