#!/bin/bash
# Apple Silicon Performance Benchmark Suite for AgentAPI
# Tests: Startup time, CPU efficiency, memory usage, I/O performance, power consumption
# Target: M1/M2/M3 with OrbStack runtime

set -e

# Configuration
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.agentapi.apple-silicon.yml}"
SERVICE_NAME="${SERVICE_NAME:-agentapi}"
CONTAINER_NAME="${CONTAINER_NAME:-vibecode-agentapi}"
RESULTS_DIR="${RESULTS_DIR:-./benchmark-results}"
ITERATIONS="${ITERATIONS:-10}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Create results directory
mkdir -p "$RESULTS_DIR"

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Get milliseconds since epoch
get_ms() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        python3 -c 'import time; print(int(time.time() * 1000))'
    else
        date +%s%3N
    fi
}

# Check if Apple Silicon
check_apple_silicon() {
    if [[ $(uname -m) != "arm64" ]]; then
        log_error "Not running on Apple Silicon (ARM64)"
        exit 1
    fi
    log_success "Detected Apple Silicon: $(sysctl -n machdep.cpu.brand_string)"
}

# Get CPU core counts
get_core_info() {
    local perf_cores=$(sysctl -n hw.perflevel0.physicalcpu 2>/dev/null || echo "0")
    local eff_cores=$(sysctl -n hw.perflevel1.physicalcpu 2>/dev/null || echo "0")
    echo "${perf_cores}P + ${eff_cores}E"
}

# ============================================================================
# 1. Container Startup Benchmark
# ============================================================================

benchmark_startup() {
    log_info "=== Benchmark 1: Container Startup Time ==="
    local results_file="$RESULTS_DIR/startup_${TIMESTAMP}.csv"

    echo "iteration,stop_ms,start_ms,health_ms,total_ms" > "$results_file"

    for i in $(seq 1 $ITERATIONS); do
        log_info "Iteration $i/$ITERATIONS"

        # Stop and remove container
        local stop_start=$(get_ms)
        docker stop "$CONTAINER_NAME" 2>/dev/null || true
        docker rm "$CONTAINER_NAME" 2>/dev/null || true
        sleep 1
        local stop_end=$(get_ms)
        local stop_duration=$((stop_end - stop_start))

        # Start container
        local start_start=$(get_ms)
        docker-compose -f "$COMPOSE_FILE" up -d "$SERVICE_NAME" >/dev/null 2>&1
        local start_end=$(get_ms)
        local start_duration=$((start_end - start_start))

        # Wait for health check
        local health_start=$(get_ms)
        local timeout=30
        local elapsed=0
        while [ "$elapsed" -lt "$timeout" ]; do
            local status=$(docker inspect "$CONTAINER_NAME" --format='{{.State.Health.Status}}' 2>/dev/null || echo "starting")
            if [ "$status" = "healthy" ]; then
                break
            fi
            sleep 0.5
            elapsed=$((elapsed + 1))
        done
        local health_end=$(get_ms)
        local health_duration=$((health_end - health_start))
        local total_duration=$((health_end - stop_start))

        echo "$i,$stop_duration,$start_duration,$health_duration,$total_duration" >> "$results_file"

        log_info "Total: ${total_duration}ms (stop: ${stop_duration}ms, start: ${start_duration}ms, health: ${health_duration}ms)"
        sleep 2
    done

    # Analyze results
    log_success "Startup benchmark complete: $results_file"

    # Calculate statistics
    local avg_total=$(awk -F',' 'NR>1 {sum+=$5; count++} END {printf "%.0f", sum/count}' "$results_file")
    local avg_start=$(awk -F',' 'NR>1 {sum+=$3; count++} END {printf "%.0f", sum/count}' "$results_file")
    local avg_health=$(awk -F',' 'NR>1 {sum+=$4; count++} END {printf "%.0f", sum/count}' "$results_file")

    echo ""
    log_info "Average startup times:"
    echo "  Total: ${avg_total}ms"
    echo "  Container start: ${avg_start}ms"
    echo "  Health check: ${avg_health}ms"

    # Check against target (<300ms)
    if [ "$avg_total" -lt 300 ]; then
        log_success "✓ Target met: ${avg_total}ms < 300ms"
    else
        log_warning "✗ Target missed: ${avg_total}ms >= 300ms"
    fi
    echo ""
}

# ============================================================================
# 2. CPU Efficiency Benchmark
# ============================================================================

benchmark_cpu_efficiency() {
    log_info "=== Benchmark 2: CPU Efficiency (E-core vs P-core) ==="
    local results_file="$RESULTS_DIR/cpu_efficiency_${TIMESTAMP}.csv"

    # Ensure container is running
    docker-compose -f "$COMPOSE_FILE" up -d "$SERVICE_NAME" >/dev/null 2>&1
    sleep 5

    echo "timestamp,cpu_percent,threads,user_time,system_time" > "$results_file"

    log_info "Monitoring CPU usage for 60 seconds (idle workload)..."
    for i in $(seq 1 12); do
        local timestamp=$(date +%s)
        local stats=$(docker stats "$CONTAINER_NAME" --no-stream --format "{{.CPUPerc}}")
        local cpu_percent=$(echo "$stats" | tr -d '%')

        # Get detailed process info
        local proc_info=$(docker exec "$CONTAINER_NAME" ps -o %cpu,nlwp,time,etime -p 1 2>/dev/null | tail -1)
        local threads=$(echo "$proc_info" | awk '{print $2}')
        local user_time=$(echo "$proc_info" | awk '{print $3}')
        local system_time=$(echo "$proc_info" | awk '{print $4}')

        echo "$timestamp,$cpu_percent,$threads,$user_time,$system_time" >> "$results_file"

        sleep 5
    done

    # Analyze results
    local avg_cpu=$(awk -F',' 'NR>1 {sum+=$2; count++} END {printf "%.2f", sum/count}' "$results_file")
    local avg_threads=$(awk -F',' 'NR>1 {sum+=$3; count++} END {printf "%.0f", sum/count}' "$results_file")

    log_success "CPU efficiency benchmark complete: $results_file"
    echo ""
    log_info "Average metrics:"
    echo "  CPU usage: ${avg_cpu}%"
    echo "  Thread count: ${avg_threads}"
    echo ""
}

# ============================================================================
# 3. Memory Usage Benchmark
# ============================================================================

benchmark_memory() {
    log_info "=== Benchmark 3: Memory Usage ==="
    local results_file="$RESULTS_DIR/memory_${TIMESTAMP}.csv"

    # Ensure container is running
    docker-compose -f "$COMPOSE_FILE" up -d "$SERVICE_NAME" >/dev/null 2>&1
    sleep 5

    echo "timestamp,memory_mb,memory_percent,memory_limit_mb" > "$results_file"

    log_info "Monitoring memory usage for 60 seconds..."
    for i in $(seq 1 12); do
        local timestamp=$(date +%s)

        # Get memory stats
        local mem_usage=$(docker stats "$CONTAINER_NAME" --no-stream --format "{{.MemUsage}}")
        local mem_mb=$(echo "$mem_usage" | awk '{print $1}' | sed 's/MiB//')
        local mem_limit=$(echo "$mem_usage" | awk '{print $3}' | sed 's/GiB//')
        local mem_limit_mb=$(echo "$mem_limit * 1024" | bc)

        local mem_percent=$(docker stats "$CONTAINER_NAME" --no-stream --format "{{.MemPerc}}" | tr -d '%')

        echo "$timestamp,$mem_mb,$mem_percent,$mem_limit_mb" >> "$results_file"

        sleep 5
    done

    # Analyze results
    local avg_mem=$(awk -F',' 'NR>1 {sum+=$2; count++} END {printf "%.0f", sum/count}' "$results_file")
    local avg_percent=$(awk -F',' 'NR>1 {sum+=$3; count++} END {printf "%.2f", sum/count}' "$results_file")

    log_success "Memory benchmark complete: $results_file"
    echo ""
    log_info "Average memory usage:"
    echo "  Memory: ${avg_mem}MB"
    echo "  Percent: ${avg_percent}%"

    # Check against target (<512MB idle)
    if [ "$avg_mem" -lt 512 ]; then
        log_success "✓ Target met: ${avg_mem}MB < 512MB"
    else
        log_warning "✗ Target missed: ${avg_mem}MB >= 512MB"
    fi
    echo ""
}

# ============================================================================
# 4. I/O Performance Benchmark
# ============================================================================

benchmark_io() {
    log_info "=== Benchmark 4: I/O Performance ==="
    local results_file="$RESULTS_DIR/io_${TIMESTAMP}.csv"

    # Ensure container is running
    docker-compose -f "$COMPOSE_FILE" up -d "$SERVICE_NAME" >/dev/null 2>&1
    sleep 5

    echo "test,operation,size_mb,duration_ms,throughput_mbps" > "$results_file"

    # Sequential write test
    log_info "Testing sequential write..."
    local write_start=$(get_ms)
    docker exec "$CONTAINER_NAME" dd if=/dev/zero of=/tmp/test_write bs=1M count=100 conv=fdatasync 2>&1 | grep -v records >/dev/null
    local write_end=$(get_ms)
    local write_duration=$((write_end - write_start))
    local write_throughput=$(echo "scale=2; 100 / ($write_duration / 1000)" | bc)
    echo "1,write,100,$write_duration,$write_throughput" >> "$results_file"
    log_info "Sequential write: ${write_throughput} MB/s"

    # Sequential read test
    log_info "Testing sequential read..."
    local read_start=$(get_ms)
    docker exec "$CONTAINER_NAME" dd if=/tmp/test_write of=/dev/null bs=1M 2>&1 | grep -v records >/dev/null
    local read_end=$(get_ms)
    local read_duration=$((read_end - read_start))
    local read_throughput=$(echo "scale=2; 100 / ($read_duration / 1000)" | bc)
    echo "2,read,100,$read_duration,$read_throughput" >> "$results_file"
    log_info "Sequential read: ${read_throughput} MB/s"

    # Random read/write test (if fio available)
    if docker exec "$CONTAINER_NAME" command -v fio >/dev/null 2>&1; then
        log_info "Testing random I/O with fio..."
        docker exec "$CONTAINER_NAME" fio \
            --name=random-rw \
            --ioengine=libaio \
            --rw=randrw \
            --bs=4k \
            --direct=1 \
            --size=100M \
            --numjobs=2 \
            --runtime=10 \
            --time_based \
            --group_reporting \
            --output=/tmp/fio_result.txt 2>/dev/null || true

        # Parse fio results (simplified)
        local fio_read=$(docker exec "$CONTAINER_NAME" grep "read:" /tmp/fio_result.txt 2>/dev/null | head -1 | awk '{print $2}' || echo "N/A")
        local fio_write=$(docker exec "$CONTAINER_NAME" grep "write:" /tmp/fio_result.txt 2>/dev/null | head -1 | awk '{print $2}' || echo "N/A")
        log_info "Random I/O: read=$fio_read, write=$fio_write"
    fi

    # Cleanup
    docker exec "$CONTAINER_NAME" rm -f /tmp/test_write /tmp/fio_result.txt 2>/dev/null || true

    log_success "I/O benchmark complete: $results_file"
    echo ""
}

# ============================================================================
# 5. API Latency Benchmark
# ============================================================================

benchmark_api_latency() {
    log_info "=== Benchmark 5: API Latency ==="
    local results_file="$RESULTS_DIR/api_latency_${TIMESTAMP}.txt"

    # Ensure container is running
    docker-compose -f "$COMPOSE_FILE" up -d "$SERVICE_NAME" >/dev/null 2>&1
    sleep 5

    # Wait for API to be ready
    local ready=false
    for i in {1..30}; do
        if curl -f -s http://localhost:3284/health >/dev/null 2>&1; then
            ready=true
            break
        fi
        sleep 1
    done

    if [ "$ready" = false ]; then
        log_error "API not ready after 30 seconds"
        return 1
    fi

    # Test with hey (if available)
    if command -v hey >/dev/null 2>&1; then
        log_info "Running load test with hey (10000 requests, 100 concurrent)..."
        hey -n 10000 -c 100 -m GET http://localhost:3284/health > "$results_file" 2>&1

        # Parse results
        local total_time=$(grep "Total:" "$results_file" | awk '{print $2}')
        local rps=$(grep "Requests/sec:" "$results_file" | awk '{print $2}')
        local p50=$(grep "50% in" "$results_file" | awk '{print $3}')
        local p95=$(grep "95% in" "$results_file" | awk '{print $3}')
        local p99=$(grep "99% in" "$results_file" | awk '{print $3}')

        log_success "API latency benchmark complete: $results_file"
        echo ""
        log_info "Performance metrics:"
        echo "  Total time: $total_time"
        echo "  Requests/sec: $rps"
        echo "  Latency P50: $p50"
        echo "  Latency P95: $p95"
        echo "  Latency P99: $p99"

        # Check against targets
        local p95_ms=$(echo "$p95" | sed 's/s$//' | awk '{print $1 * 1000}')
        if (( $(echo "$p95_ms < 50" | bc -l) )); then
            log_success "✓ P95 target met: ${p95} < 50ms"
        else
            log_warning "✗ P95 target missed: ${p95} >= 50ms"
        fi
    else
        log_warning "hey not installed, using curl for basic test..."

        log_info "Testing API latency (100 requests)..."
        local total_time=0
        for i in $(seq 1 100); do
            local start=$(get_ms)
            curl -f -s http://localhost:3284/health >/dev/null 2>&1
            local end=$(get_ms)
            local duration=$((end - start))
            total_time=$((total_time + duration))
        done

        local avg_latency=$((total_time / 100))
        echo "Average latency: ${avg_latency}ms" > "$results_file"

        log_success "API latency benchmark complete: $results_file"
        log_info "Average latency: ${avg_latency}ms"
    fi
    echo ""
}

# ============================================================================
# 6. Power Consumption Estimate
# ============================================================================

benchmark_power() {
    log_info "=== Benchmark 6: Power Consumption Estimate ==="

    # Note: Accurate power measurement requires sudo for powermetrics
    log_warning "Power measurement requires sudo access (skipping for non-privileged run)"

    # Estimate based on CPU usage
    log_info "Estimating power consumption from CPU usage..."

    # Sample CPU usage
    local cpu_percent=$(docker stats "$CONTAINER_NAME" --no-stream --format "{{.CPUPerc}}" | tr -d '%')

    # Rough estimates for Apple Silicon (M1 Max):
    # - Idle (0% CPU): ~1-2W
    # - Low load (10% CPU): ~3-5W
    # - Medium load (50% CPU): ~10-15W
    # - High load (100% CPU): ~25-35W

    local estimated_watts=$(echo "scale=1; 2 + ($cpu_percent * 0.3)" | bc)

    log_info "CPU usage: ${cpu_percent}%"
    log_info "Estimated power: ${estimated_watts}W (container contribution)"

    # Check against target (<5W idle)
    if (( $(echo "$estimated_watts < 5" | bc -l) )); then
        log_success "✓ Estimated power within target: ${estimated_watts}W < 5W"
    else
        log_warning "✗ Estimated power exceeds target: ${estimated_watts}W >= 5W"
    fi
    echo ""
}

# ============================================================================
# Main benchmark suite
# ============================================================================

main() {
    log_info "=========================================="
    log_info "Apple Silicon AgentAPI Benchmark Suite"
    log_info "=========================================="
    echo ""

    # System information
    check_apple_silicon
    log_info "CPU cores: $(get_core_info)"
    log_info "Total memory: $(sysctl -n hw.memsize | awk '{printf "%.0f GB", $1/1024/1024/1024}')"
    log_info "Container runtime: $(docker version --format '{{.Server.Version}}')"
    echo ""

    # Run benchmarks
    benchmark_startup
    benchmark_cpu_efficiency
    benchmark_memory
    benchmark_io
    benchmark_api_latency
    benchmark_power

    # Summary
    log_info "=========================================="
    log_success "Benchmark suite complete!"
    log_info "Results saved to: $RESULTS_DIR"
    log_info "=========================================="
    echo ""

    # Generate summary report
    local summary_file="$RESULTS_DIR/summary_${TIMESTAMP}.txt"
    {
        echo "Apple Silicon AgentAPI Benchmark Summary"
        echo "========================================"
        echo ""
        echo "System Information:"
        echo "  Platform: $(uname -m)"
        echo "  CPU: $(sysctl -n machdep.cpu.brand_string)"
        echo "  Cores: $(get_core_info)"
        echo "  Memory: $(sysctl -n hw.memsize | awk '{printf "%.0f GB", $1/1024/1024/1024}')"
        echo ""
        echo "Benchmark Results:"
        echo "  - Startup time: See startup_${TIMESTAMP}.csv"
        echo "  - CPU efficiency: See cpu_efficiency_${TIMESTAMP}.csv"
        echo "  - Memory usage: See memory_${TIMESTAMP}.csv"
        echo "  - I/O performance: See io_${TIMESTAMP}.csv"
        echo "  - API latency: See api_latency_${TIMESTAMP}.txt"
        echo ""
        echo "Timestamp: $(date)"
    } > "$summary_file"

    log_info "Summary report: $summary_file"
}

# Run main function
main "$@"
