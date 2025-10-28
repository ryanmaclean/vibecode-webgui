#!/bin/bash
# Apple Silicon Kernel Optimization Benchmark Suite
# Agent 30 - Senior Kernel Engineer (Apple Darwin Team)

set -e

RESULTS_DIR="results/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$RESULTS_DIR"

echo "=== Apple Silicon Kernel Optimization Benchmark Suite ==="
echo "Date: $(date)"
echo "System: $(sw_vers -productName) $(sw_vers -productVersion)"
echo ""

# System information
echo "=== System Information ===" | tee "$RESULTS_DIR/system.txt"
system_profiler SPHardwareDataType | tee -a "$RESULTS_DIR/system.txt"
sysctl hw.physicalcpu hw.logicalcpu hw.memsize hw.cpufrequency | tee -a "$RESULTS_DIR/system.txt"
echo "" | tee -a "$RESULTS_DIR/system.txt"

# Check for required tools
echo "=== Checking dependencies ===" | tee -a "$RESULTS_DIR/system.txt"
command -v apple-container-runtime >/dev/null 2>&1 || {
    echo "ERROR: apple-container-runtime not found. Build it first:" >&2
    echo "  cd AppleContainerRuntime && swift build -c release" >&2
    exit 1
}

# Summary header
echo "| Scenario | Baseline | Optimized | Improvement |" | tee "$RESULTS_DIR/summary.md"
echo "|----------|----------|-----------|-------------|" | tee -a "$RESULTS_DIR/summary.md"

# Run benchmark scenarios
SCENARIOS=(
    "memory-throughput"
    "io-scheduler"
    "vsock-latency"
    "cpu-scheduling"
    "thermal-sustained"
)

for scenario in "${SCENARIOS[@]}"; do
    echo ""
    echo "=== Running: $scenario ===" | tee -a "$RESULTS_DIR/${scenario}.log"

    if [ ! -f "scenarios/${scenario}.sh" ]; then
        echo "SKIP: Scenario script not found: scenarios/${scenario}.sh" | tee -a "$RESULTS_DIR/${scenario}.log"
        continue
    fi

    # Run baseline (no optimizations)
    echo "[1/2] Baseline kernel (default parameters)..." | tee -a "$RESULTS_DIR/${scenario}.log"
    ./run-vm.sh --kernel baseline --scenario "scenarios/${scenario}.sh" \
        2>&1 | tee -a "$RESULTS_DIR/${scenario}-baseline.log"

    # Run optimized (M-Series kernel)
    echo "[2/2] Optimized kernel (M-Series parameters)..." | tee -a "$RESULTS_DIR/${scenario}.log"
    ./run-vm.sh --kernel optimized --scenario "scenarios/${scenario}.sh" \
        2>&1 | tee -a "$RESULTS_DIR/${scenario}-optimized.log"

    echo "✓ Completed: $scenario" | tee -a "$RESULTS_DIR/${scenario}.log"
done

echo ""
echo "=== Generating comparison report ==="
if command -v python3 >/dev/null 2>&1; then
    python3 analyze-results.py "$RESULTS_DIR" > "$RESULTS_DIR/report.md"
    echo "✓ Report generated: $RESULTS_DIR/report.md"
else
    echo "WARN: python3 not found, skipping automated analysis"
    echo "Manual analysis required for: $RESULTS_DIR"
fi

echo ""
echo "=== Benchmark Complete ==="
echo "Results directory: $RESULTS_DIR"
echo ""
echo "View summary:"
echo "  cat $RESULTS_DIR/summary.md"
echo ""
echo "View detailed report:"
echo "  cat $RESULTS_DIR/report.md"
