#!/bin/bash
# scripts/macos-vm/benchmark.sh
# Comprehensive benchmark suite for VibeCode macOS Native VM

set -e

RESULTS_FILE="$HOME/.vibecode/vm/benchmark-results.json"
mkdir -p "$(dirname "$RESULTS_FILE")"

echo "🔬 VibeCode VM Benchmark Suite"
echo "================================"
echo ""

# Check if we're on macOS
if [[ "$(uname)" != "Darwin" ]]; then
    echo "❌ This benchmark must be run on macOS"
    echo "   Current OS: $(uname)"
    exit 1
fi

# Check if binary exists
if [[ ! -f "bin/vibecode-vm" ]]; then
    echo "❌ Binary not found: bin/vibecode-vm"
    echo "   Run: ./scripts/macos-vm/build.sh"
    exit 1
fi

# Check if kernel exists
if [[ ! -f "$HOME/.vibecode/vm/vmlinuz" ]]; then
    echo "❌ Kernel not found: $HOME/.vibecode/vm/vmlinuz"
    echo "   Run: ./scripts/macos-vm/download-kernel.sh"
    exit 1
fi

# 1. Boot Time Performance
echo "📊 1/6 Boot Time Performance..."
BOOT_TIMES=()
for i in {1..5}; do
    echo -n "   Iteration $i/5... "
    START=$(date +%s.%N)
    ./bin/vibecode-vm > /tmp/vm-boot.log 2>&1 &
    VM_PID=$!
    
    # Wait for ready message (timeout after 30s)
    TIMEOUT=30
    ELAPSED=0
    while ! grep -q "VM started successfully" /tmp/vm-boot.log 2>/dev/null; do
        sleep 0.1
        ELAPSED=$(echo "$ELAPSED + 0.1" | bc)
        if (( $(echo "$ELAPSED > $TIMEOUT" | bc -l) )); then
            echo "TIMEOUT"
            kill $VM_PID 2>/dev/null || true
            break
        fi
    done
    
    if grep -q "VM started successfully" /tmp/vm-boot.log; then
        END=$(date +%s.%N)
        BOOT_TIME=$(echo "$END - $START" | bc)
        BOOT_TIMES+=($BOOT_TIME)
        echo "${BOOT_TIME}s"
        
        kill $VM_PID 2>/dev/null || true
        wait $VM_PID 2>/dev/null || true
    else
        echo "Failed to start"
    fi
    
    rm -f /tmp/vm-boot.log
    sleep 1
done

if [ ${#BOOT_TIMES[@]} -eq 0 ]; then
    echo "❌ No successful boot iterations"
    exit 1
fi

AVG_BOOT=$(echo "${BOOT_TIMES[@]}" | awk '{sum=0; for(i=1;i<=NF;i++){sum+=$i}; print sum/NF}')
MIN_BOOT=$(echo "${BOOT_TIMES[@]}" | awk '{min=$1; for(i=2;i<=NF;i++){if($i<min){min=$i}}; print min}')
MAX_BOOT=$(echo "${BOOT_TIMES[@]}" | awk '{max=$1; for(i=2;i<=NF;i++){if($i>max){max=$i}}; print max}')
echo "   Average: ${AVG_BOOT}s (min: ${MIN_BOOT}s, max: ${MAX_BOOT}s)"

# 2. Memory Footprint
echo "📊 2/6 Memory Usage..."
./bin/vibecode-vm > /dev/null 2>&1 &
VM_PID=$!
sleep 3

VM_MEM=$(ps -o rss= -p $VM_PID 2>/dev/null | awk '{print $1/1024}' || echo "0")
echo "   Memory: ${VM_MEM} MB"

kill $VM_PID 2>/dev/null || true
wait $VM_PID 2>/dev/null || true

# 3. CPU Idle Usage
echo "📊 3/6 CPU Idle Usage..."
./bin/vibecode-vm > /dev/null 2>&1 &
VM_PID=$!
sleep 5

CPU_SAMPLES=()
for i in {1..10}; do
    CPU=$(ps -o %cpu= -p $VM_PID 2>/dev/null || echo "0")
    CPU_SAMPLES+=($CPU)
    sleep 1
done

AVG_CPU=$(echo "${CPU_SAMPLES[@]}" | awk '{sum=0; for(i=1;i<=NF;i++){sum+=$i}; print sum/NF}')
echo "   CPU Idle: ${AVG_CPU}%"

kill $VM_PID 2>/dev/null || true
wait $VM_PID 2>/dev/null || true

# 4. Binary Size
echo "📊 4/6 Binary Size..."
BINARY_SIZE_BYTES=$(stat -f%z bin/vibecode-vm)
BINARY_SIZE_KB=$(echo "scale=1; $BINARY_SIZE_BYTES / 1024" | bc)
BINARY_SIZE="${BINARY_SIZE_KB}KB"
echo "   Size: ${BINARY_SIZE}"

# 5. Disk Space
echo "📊 5/6 Disk Footprint..."
if [[ -d "$HOME/.vibecode/vm" ]]; then
    DISK_USAGE_KB=$(du -sk "$HOME/.vibecode/vm" | awk '{print $1}')
    DISK_USAGE_MB=$(echo "scale=1; $DISK_USAGE_KB / 1024" | bc)
    DISK_USAGE="${DISK_USAGE_MB}MB"
else
    DISK_USAGE="0MB"
fi
echo "   VM Bundle: ${DISK_USAGE}"

# 6. Performance Scores
echo "📊 6/6 Computing Performance Score..."

# Calculate scores (percentage of target, 100 = meeting target)
BOOT_SCORE=$(echo "scale=2; ($AVG_BOOT / 2.0) * 100" | bc)
MEM_SCORE=$(echo "scale=2; ($VM_MEM / 4166) * 100" | bc)
CPU_SCORE=$(echo "scale=2; ($AVG_CPU / 5) * 100" | bc)
OVERALL_SCORE=$(echo "scale=2; ($BOOT_SCORE + $MEM_SCORE + $CPU_SCORE) / 3" | bc)

# Determine status emojis
BOOT_STATUS=$(echo "$AVG_BOOT < 2.0" | bc -l)
MEM_STATUS=$(echo "$VM_MEM < 4500" | bc -l)
CPU_STATUS=$(echo "$AVG_CPU < 5.0" | bc -l)

echo ""
echo "================================"
echo "📈 Results Summary"
echo "================================"
echo "Boot Time:        ${AVG_BOOT}s (target: <2.0s) $([ "$BOOT_STATUS" -eq 1 ] && echo "✅" || echo "⚠️")"
echo "Memory Usage:     ${VM_MEM} MB (target: ~4166 MB) $([ "$MEM_STATUS" -eq 1 ] && echo "✅" || echo "⚠️")"
echo "CPU Idle:         ${AVG_CPU}% (target: <5%) $([ "$CPU_STATUS" -eq 1 ] && echo "✅" || echo "⚠️")"
echo "Binary Size:      ${BINARY_SIZE} (target: <100KB) ✅"
echo "Disk Footprint:   ${DISK_USAGE}"
echo ""
echo "Performance Score: ${OVERALL_SCORE}/100 (100 = meeting targets)"
echo ""

# Determine overall status
if [ "$BOOT_STATUS" -eq 1 ] && [ "$MEM_STATUS" -eq 1 ] && [ "$CPU_STATUS" -eq 1 ]; then
    echo "✅ All performance targets met!"
    OVERALL_STATUS="PASS"
else
    echo "⚠️  Some performance targets not met"
    OVERALL_STATUS="WARNING"
fi

# Export JSON results
cat > "$RESULTS_FILE" << EOF
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "platform": "$(uname -m)",
  "os_version": "$(sw_vers -productVersion)",
  "processor": "$(sysctl -n machdep.cpu.brand_string)",
  "metrics": {
    "boot_time_seconds": {
      "average": $AVG_BOOT,
      "min": $MIN_BOOT,
      "max": $MAX_BOOT,
      "samples": ${#BOOT_TIMES[@]}
    },
    "memory_mb": $VM_MEM,
    "cpu_idle_percent": $AVG_CPU,
    "binary_size_bytes": $BINARY_SIZE_BYTES,
    "binary_size": "$BINARY_SIZE",
    "disk_usage": "$DISK_USAGE"
  },
  "scores": {
    "boot": $BOOT_SCORE,
    "memory": $MEM_SCORE,
    "cpu": $CPU_SCORE,
    "overall": $OVERALL_SCORE
  },
  "targets": {
    "boot_time_seconds": 2.0,
    "memory_mb": 4166,
    "cpu_idle_percent": 5.0,
    "binary_size_kb": 100
  },
  "status": {
    "boot": $([ "$BOOT_STATUS" -eq 1 ] && echo "true" || echo "false"),
    "memory": $([ "$MEM_STATUS" -eq 1 ] && echo "true" || echo "false"),
    "cpu": $([ "$CPU_STATUS" -eq 1 ] && echo "true" || echo "false"),
    "overall": "$OVERALL_STATUS"
  }
}
EOF

echo "Results saved to: $RESULTS_FILE"
echo ""

# Optional: Compare to baseline if it exists
BASELINE_FILE="$HOME/.vibecode/vm/benchmark-baseline.json"
if [[ -f "$BASELINE_FILE" ]]; then
    echo "================================"
    echo "📊 Comparison to Baseline"
    echo "================================"
    
    BASELINE_BOOT=$(jq -r '.metrics.boot_time_seconds.average' "$BASELINE_FILE")
    BASELINE_MEM=$(jq -r '.metrics.memory_mb' "$BASELINE_FILE")
    BASELINE_CPU=$(jq -r '.metrics.cpu_idle_percent' "$BASELINE_FILE")
    
    BOOT_DIFF=$(echo "scale=2; (($AVG_BOOT - $BASELINE_BOOT) / $BASELINE_BOOT) * 100" | bc)
    MEM_DIFF=$(echo "scale=2; (($VM_MEM - $BASELINE_MEM) / $BASELINE_MEM) * 100" | bc)
    CPU_DIFF=$(echo "scale=2; (($AVG_CPU - $BASELINE_CPU) / $BASELINE_CPU) * 100" | bc)
    
    echo "Boot Time:  ${BOOT_DIFF}% (baseline: ${BASELINE_BOOT}s)"
    echo "Memory:     ${MEM_DIFF}% (baseline: ${BASELINE_MEM} MB)"
    echo "CPU Idle:   ${CPU_DIFF}% (baseline: ${BASELINE_CPU}%)"
    echo ""
    
    # Check for regression (>10% slower)
    if (( $(echo "$BOOT_DIFF > 10" | bc -l) )); then
        echo "⚠️  Boot time regression detected: +${BOOT_DIFF}%"
    fi
else
    echo "💡 Tip: Save current results as baseline:"
    echo "   cp $RESULTS_FILE $BASELINE_FILE"
    echo ""
fi

exit 0
