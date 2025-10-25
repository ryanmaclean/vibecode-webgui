#!/usr/bin/env bash
# Verify Valkey Performance on Alpine ARM64
# Tests cache hit latency and operations per second
# Target: <1ms cache hits, 10k+ ops/sec

set -euo pipefail

VALKEY_HOST="${VALKEY_HOST:-localhost}"
VALKEY_PORT="${VALKEY_PORT:-6379}"
VALKEY_CLI="${VALKEY_CLI:-valkey-cli}"
VALKEY_BENCHMARK="${VALKEY_BENCHMARK:-valkey-benchmark}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "=== Valkey Performance Verification ==="
echo "Target: <1ms cache hits, 10k+ ops/sec"
echo "Host: ${VALKEY_HOST}:${VALKEY_PORT}"
echo ""

# Check if valkey-cli is available
if ! command -v ${VALKEY_CLI} &> /dev/null; then
    echo -e "${RED}❌ Error: valkey-cli not found${NC}"
    echo "Please ensure Valkey is installed"
    exit 1
fi

# Check if valkey-benchmark is available
if ! command -v ${VALKEY_BENCHMARK} &> /dev/null; then
    echo -e "${RED}❌ Error: valkey-benchmark not found${NC}"
    echo "Please ensure Valkey is installed"
    exit 1
fi

# Test 1: Basic connectivity
echo -e "${BLUE}=== Test 1: Connectivity ===${NC}"
if ${VALKEY_CLI} -h ${VALKEY_HOST} -p ${VALKEY_PORT} PING | grep -q "PONG"; then
    echo -e "${GREEN}✅ Connection successful${NC}"
else
    echo -e "${RED}❌ Connection failed${NC}"
    exit 1
fi
echo ""

# Test 2: Server info
echo -e "${BLUE}=== Test 2: Server Information ===${NC}"
SERVER_INFO=$(${VALKEY_CLI} -h ${VALKEY_HOST} -p ${VALKEY_PORT} INFO server)
VERSION=$(echo "$SERVER_INFO" | grep "redis_version" | cut -d':' -f2 | tr -d '\r')
OS=$(echo "$SERVER_INFO" | grep "os:" | cut -d':' -f2 | tr -d '\r')
ARCH=$(echo "$SERVER_INFO" | grep "arch_bits" | cut -d':' -f2 | tr -d '\r')

echo "Version: ${VERSION}"
echo "OS: ${OS}"
echo "Architecture: ${ARCH}-bit"
echo ""

# Test 3: Memory info
echo -e "${BLUE}=== Test 3: Memory Usage ===${NC}"
MEMORY_INFO=$(${VALKEY_CLI} -h ${VALKEY_HOST} -p ${VALKEY_PORT} INFO memory)
USED_MEMORY=$(echo "$MEMORY_INFO" | grep "used_memory_human:" | cut -d':' -f2 | tr -d '\r')
PEAK_MEMORY=$(echo "$MEMORY_INFO" | grep "used_memory_peak_human:" | cut -d':' -f2 | tr -d '\r')

echo "Used Memory: ${USED_MEMORY}"
echo "Peak Memory: ${PEAK_MEMORY}"
echo ""

# Test 4: Cache hit latency test
echo -e "${BLUE}=== Test 4: Cache Hit Latency ===${NC}"
echo "Writing test keys..."

# Write 1000 keys
for i in {1..1000}; do
    ${VALKEY_CLI} -h ${VALKEY_HOST} -p ${VALKEY_PORT} SET "test:key:${i}" "value${i}" > /dev/null
done

echo "Measuring GET latency (1000 operations)..."

# Measure latency using Valkey's built-in latency tracking
START_TIME=$(date +%s%N)
for i in {1..1000}; do
    ${VALKEY_CLI} -h ${VALKEY_HOST} -p ${VALKEY_PORT} GET "test:key:${i}" > /dev/null
done
END_TIME=$(date +%s%N)

# Calculate average latency in milliseconds
ELAPSED_NS=$((END_TIME - START_TIME))
ELAPSED_MS=$((ELAPSED_NS / 1000000))
AVG_LATENCY_MS=$(echo "scale=3; ${ELAPSED_MS} / 1000" | bc)

echo "Total time for 1000 GETs: ${ELAPSED_MS}ms"
echo "Average latency per GET: ${AVG_LATENCY_MS}ms"

if (( $(echo "${AVG_LATENCY_MS} < 1.0" | bc -l) )); then
    echo -e "${GREEN}✅ PASS: Cache hit latency ${AVG_LATENCY_MS}ms < 1ms target${NC}"
    LATENCY_PASS=1
else
    echo -e "${RED}❌ FAIL: Cache hit latency ${AVG_LATENCY_MS}ms >= 1ms target${NC}"
    LATENCY_PASS=0
fi
echo ""

# Clean up test keys
echo "Cleaning up test keys..."
for i in {1..1000}; do
    ${VALKEY_CLI} -h ${VALKEY_HOST} -p ${VALKEY_PORT} DEL "test:key:${i}" > /dev/null
done

# Test 5: Operations per second benchmark
echo -e "${BLUE}=== Test 5: Operations Per Second ===${NC}"
echo "Running benchmark (this may take 30-60 seconds)..."
echo ""

# Run benchmark with different operation types
BENCHMARK_OUTPUT=$(${VALKEY_BENCHMARK} -h ${VALKEY_HOST} -p ${VALKEY_PORT} -t set,get,incr,lpush,lpop,sadd,spop -q -c 50 -n 100000)

echo "$BENCHMARK_OUTPUT"
echo ""

# Extract GET operations per second
GET_OPS=$(echo "$BENCHMARK_OUTPUT" | grep "GET:" | awk '{print $2}')
SET_OPS=$(echo "$BENCHMARK_OUTPUT" | grep "SET:" | awk '{print $2}')

echo "Performance Summary:"
echo "  GET: ${GET_OPS} requests/sec"
echo "  SET: ${SET_OPS} requests/sec"

# Check if we meet the 10k ops/sec target
if (( $(echo "${GET_OPS} >= 10000" | bc -l) )); then
    echo -e "${GREEN}✅ PASS: GET operations ${GET_OPS} >= 10k ops/sec target${NC}"
    OPS_PASS=1
else
    echo -e "${RED}❌ FAIL: GET operations ${GET_OPS} < 10k ops/sec target${NC}"
    OPS_PASS=0
fi
echo ""

# Test 6: ARM64 optimizations verification
echo -e "${BLUE}=== Test 6: ARM64 Optimizations ===${NC}"

# Check if running on ARM64
ARCH=$(uname -m)
echo "Current architecture: ${ARCH}"

if [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
    echo -e "${GREEN}✅ Running on ARM64 architecture${NC}"
    
    # Check for ARM64-specific features in build
    if command -v ldd &> /dev/null; then
        LIBC_INFO=$(ldd $(which valkey-server) 2>&1 || echo "static")
        if echo "$LIBC_INFO" | grep -q "musl"; then
            echo -e "${GREEN}✅ Built with musl libc (Alpine optimized)${NC}"
        elif echo "$LIBC_INFO" | grep -q "static"; then
            echo -e "${GREEN}✅ Statically linked (optimized)${NC}"
        else
            echo -e "${YELLOW}⚠️  Not using musl libc${NC}"
        fi
    fi
else
    echo -e "${YELLOW}⚠️  Not running on ARM64 - ARM optimizations not active${NC}"
fi
echo ""

# Final summary
echo "=== Performance Test Summary ==="
echo ""
echo "Requirements:"
echo "  1. Cache hit latency < 1ms"
echo "  2. Operations/sec >= 10,000"
echo ""

if [ ${LATENCY_PASS} -eq 1 ] && [ ${OPS_PASS} -eq 1 ]; then
    echo -e "${GREEN}✅ ALL TESTS PASSED${NC}"
    echo ""
    echo "Valkey is performing within target specifications:"
    echo "  • Cache hits: ${AVG_LATENCY_MS}ms (target: <1ms)"
    echo "  • GET ops: ${GET_OPS}/sec (target: >10k/sec)"
    echo ""
    exit 0
else
    echo -e "${RED}❌ SOME TESTS FAILED${NC}"
    echo ""
    if [ ${LATENCY_PASS} -eq 0 ]; then
        echo -e "${RED}  • Latency test failed: ${AVG_LATENCY_MS}ms >= 1ms${NC}"
    fi
    if [ ${OPS_PASS} -eq 0 ]; then
        echo -e "${RED}  • Operations test failed: ${GET_OPS} < 10k ops/sec${NC}"
    fi
    echo ""
    echo "Troubleshooting tips:"
    echo "  1. Check system resources: free -h"
    echo "  2. Verify Valkey config: cat /etc/valkey/valkey.conf"
    echo "  3. Check for resource contention: top"
    echo "  4. Review logs: tail -f /var/log/valkey/valkey.log"
    echo ""
    exit 1
fi
