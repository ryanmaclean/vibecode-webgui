#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"


#############################################################################
# VibeCode Desktop App Simple Performance Benchmark
#
# Measures key metrics without requiring UI automation:
# - Binary size
# - Startup time (process-based)
# - Memory usage (RSS/VSZ)
# - CPU usage
#
# Usage: ./scripts/benchmark-desktop-simple.sh
#############################################################################

# Initialize log aggregation
init_log_aggregation


set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
RESULTS_DIR="./performance-results/desktop"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RESULTS_FILE="${RESULTS_DIR}/benchmark_${TIMESTAMP}.json"

# Create results directory
mkdir -p "$RESULTS_DIR"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  VibeCode Desktop Performance Benchmark (Simple)          ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

#############################################################################
# 1. Binary Size Metrics
#############################################################################

measure_binary_size() {
    log_info "Measuring binary size..."

    local binary_path="./src-tauri/target/release/vibecode"
    local bundle_path="./src-tauri/target/release/bundle/macos/VibeCode.app"

    if [ ! -f "$binary_path" ]; then
        log_warn "Binary not found, building..."
        npm run tauri:build
    fi

    local binary_bytes=$(stat -f%z "$binary_path" 2>/dev/null || echo "0")
    local binary_mb=$(echo "scale=2; $binary_bytes / 1024 / 1024" | bc -l)

    local bundle_bytes=0
    local bundle_mb=0
    if [ -d "$bundle_path" ]; then
        bundle_bytes=$(du -sk "$bundle_path" | awk '{print $1*1024}')
        bundle_mb=$(echo "scale=2; $bundle_bytes / 1024 / 1024" | bc -l)
    fi

    log_info "  Binary: ${binary_mb}MB"
    log_info "  Bundle: ${bundle_mb}MB"

    echo "  \"binary_size\": {
    \"binary_bytes\": $binary_bytes,
    \"binary_mb\": $binary_mb,
    \"bundle_bytes\": $bundle_bytes,
    \"bundle_mb\": $bundle_mb
  }"
}

#############################################################################
# 2. Startup Time (Simple Process Detection)
#############################################################################

measure_startup() {
    log_info "Measuring startup time (3 runs)..."

    local app_path="./src-tauri/target/release/vibecode"
    local times=()

    for i in {1..3}; do
        # Kill any existing instances
        pkill -9 vibecode 2>/dev/null || true
        sleep 2

        # Measure time to launch
        local start=$(date +%s.%N)

        # Launch app
        "$app_path" > /dev/null 2>&1 &
        local pid=$!

        # Wait for process to exist and stabilize
        sleep 3

        local end=$(date +%s.%N)
        local duration=$(echo "$end - $start" | bc -l)
        times+=($duration)

        log_info "  Run $i: ${duration}s (PID: $pid)"

        # Kill it
        kill -9 $pid 2>/dev/null || true
        sleep 1
    done

    local avg=$(echo "scale=2; (${times[0]} + ${times[1]} + ${times[2]}) / 3" | bc -l)

    echo "  \"startup_time\": {
    \"runs\": 3,
    \"times\": [${times[0]}, ${times[1]}, ${times[2]}],
    \"average_seconds\": $avg,
    \"note\": \"Process launch time (simplified measurement)\"
  }"
}

#############################################################################
# 3. Memory Usage
#############################################################################

measure_memory() {
    log_info "Measuring memory usage..."

    local app_path="./src-tauri/target/release/vibecode"

    # Kill any existing
    pkill -9 vibecode 2>/dev/null || true
    sleep 2

    # Launch app
    "$app_path" > /dev/null 2>&1 &
    local pid=$!

    # Wait to stabilize
    sleep 5

    # Get memory metrics
    local rss_kb=$(ps -o rss= -p $pid 2>/dev/null || echo "0")
    local vsz_kb=$(ps -o vsz= -p $pid 2>/dev/null || echo "0")

    local rss_mb=$(echo "scale=2; $rss_kb / 1024" | bc -l)
    local vsz_mb=$(echo "scale=2; $vsz_kb / 1024" | bc -l)

    log_info "  RSS: ${rss_mb}MB"
    log_info "  VSZ: ${vsz_mb}MB"

    # Kill it
    kill -9 $pid 2>/dev/null || true

    echo "  \"memory_usage\": {
    \"idle_rss_mb\": $rss_mb,
    \"idle_vsz_mb\": $vsz_mb,
    \"note\": \"Measured after 5s stabilization\"
  }"
}

#############################################################################
# 4. CPU Usage
#############################################################################

measure_cpu() {
    log_info "Measuring CPU usage..."

    local app_path="./src-tauri/target/release/vibecode"

    # Kill any existing
    pkill -9 vibecode 2>/dev/null || true
    sleep 2

    # Launch app
    "$app_path" > /dev/null 2>&1 &
    local pid=$!

    # Wait to stabilize
    sleep 5

    # Sample CPU 5 times
    local cpu_samples=()
    for i in {1..5}; do
        local cpu=$(ps -o %cpu= -p $pid 2>/dev/null || echo "0")
        cpu_samples+=($cpu)
        sleep 2
    done

    local avg_cpu=$(echo "scale=2; (${cpu_samples[0]} + ${cpu_samples[1]} + ${cpu_samples[2]} + ${cpu_samples[3]} + ${cpu_samples[4]}) / 5" | bc -l)

    log_info "  Average CPU: ${avg_cpu}%"

    # Kill it
    kill -9 $pid 2>/dev/null || true

    echo "  \"cpu_usage\": {
    \"idle_average_percent\": $avg_cpu,
    \"samples\": [${cpu_samples[0]}, ${cpu_samples[1]}, ${cpu_samples[2]}, ${cpu_samples[3]}, ${cpu_samples[4]}]
  }"
}

#############################################################################
# Main Execution
#############################################################################

main() {
    log_info "Starting simplified benchmark suite..."
    echo ""

    # Get system info
    local cpu_model=$(sysctl -n machdep.cpu.brand_string)
    local mem_gb=$(sysctl -n hw.memsize | awk '{printf "%.0f", $1/1024/1024/1024}')
    local os_version=$(sw_vers -productVersion)

    # Start JSON output
    cat > "$RESULTS_FILE" << EOF
{
  "timestamp": "$TIMESTAMP",
  "platform": "$(uname -s)",
  "os_version": "$os_version",
  "cpu": "$cpu_model",
  "memory_gb": $mem_gb,
  "benchmarks": {
EOF

    # Run benchmarks
    measure_binary_size >> "$RESULTS_FILE"
    echo "," >> "$RESULTS_FILE"

    measure_startup >> "$RESULTS_FILE"
    echo "," >> "$RESULTS_FILE"

    measure_memory >> "$RESULTS_FILE"
    echo "," >> "$RESULTS_FILE"

    measure_cpu >> "$RESULTS_FILE"

    # Close JSON
    cat >> "$RESULTS_FILE" << EOF

  }
}
EOF

    echo ""
    log_info "✅ Benchmarks complete!"
    log_info "Results saved to: $RESULTS_FILE"
    echo ""

    # Display results
    if command -v jq &> /dev/null; then
        echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${BLUE}║  Results Summary                                           ║${NC}"
        echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
        echo ""
        jq . "$RESULTS_FILE"
    else
        cat "$RESULTS_FILE"
    fi
}

# Run
main "$@"
