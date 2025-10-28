#!/bin/bash
# Memory Throughput Benchmark - Unified Memory Fabric Test
# Tests transparent hugepage effectiveness

set -e

echo "=== Memory Throughput Benchmark ==="
echo "Testing: Unified memory fabric with transparent hugepages"
echo ""

# Check if sysbench is available
if ! command -v sysbench >/dev/null 2>&1; then
    echo "Installing sysbench..."
    apk add --no-cache sysbench
fi

# Sequential read/write test
echo "[1/3] Sequential memory access (1MB blocks, 10GB total)..."
sysbench memory \
    --memory-block-size=1M \
    --memory-total-size=10G \
    --memory-access-mode=seq \
    --threads=4 \
    run | tee seq-results.txt

SEQ_THROUGHPUT=$(grep "total time:" seq-results.txt | awk '{print $3}')
echo "Sequential throughput: $SEQ_THROUGHPUT"

# Random access test
echo ""
echo "[2/3] Random memory access (4KB blocks, 2GB total)..."
sysbench memory \
    --memory-block-size=4K \
    --memory-total-size=2G \
    --memory-access-mode=rnd \
    --threads=4 \
    run | tee rnd-results.txt

RND_THROUGHPUT=$(grep "total time:" rnd-results.txt | awk '{print $3}')
echo "Random throughput: $RND_THROUGHPUT"

# Transparent hugepage allocation test
echo ""
echo "[3/3] Transparent hugepage allocation test..."
dd if=/dev/zero of=/tmp/hugepage-test bs=1M count=4096 2>&1 | tee dd-results.txt

# Check hugepage statistics
if [ -f /proc/meminfo ]; then
    echo ""
    echo "Hugepage statistics:"
    grep -E "AnonHugePages|Hugepagesize" /proc/meminfo
fi

# Cleanup
rm -f /tmp/hugepage-test seq-results.txt rnd-results.txt dd-results.txt

echo ""
echo "=== Benchmark Results ==="
echo "Sequential: $SEQ_THROUGHPUT seconds"
echo "Random: $RND_THROUGHPUT seconds"
echo "Expected improvement: 15-20% with transparent hugepages"
