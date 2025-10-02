#!/bin/bash
# I/O Scheduler Benchmark - NVMe BFQ Test
# Tests BFQ scheduler performance vs. default

set -e

echo "=== I/O Scheduler Benchmark ==="
echo "Testing: BFQ scheduler for NVMe devices"
echo ""

# Check if fio is available
if ! command -v fio >/dev/null 2>&1; then
    echo "Installing fio..."
    apk add --no-cache fio
fi

# Sequential write test
echo "[1/4] Sequential write (1MB blocks, 1GB file)..."
fio --name=seq-write \
    --filename=/tmp/fio-test \
    --size=1G \
    --bs=1M \
    --rw=write \
    --direct=1 \
    --ioengine=libaio \
    --iodepth=32 \
    --numjobs=4 \
    --group_reporting \
    --output-format=json \
    --output=seq-write.json

SEQ_WRITE_BW=$(jq -r '.jobs[0].write.bw' seq-write.json)
echo "Sequential write: $SEQ_WRITE_BW KB/s"

# Sequential read test
echo ""
echo "[2/4] Sequential read (1MB blocks, 1GB file)..."
fio --name=seq-read \
    --filename=/tmp/fio-test \
    --size=1G \
    --bs=1M \
    --rw=read \
    --direct=1 \
    --ioengine=libaio \
    --iodepth=32 \
    --numjobs=4 \
    --group_reporting \
    --output-format=json \
    --output=seq-read.json

SEQ_READ_BW=$(jq -r '.jobs[0].read.bw' seq-read.json)
echo "Sequential read: $SEQ_READ_BW KB/s"

# Random read test (IOPS)
echo ""
echo "[3/4] Random read (4KB blocks, 30s runtime)..."
fio --name=rand-read \
    --filename=/tmp/fio-test \
    --size=1G \
    --bs=4K \
    --rw=randread \
    --direct=1 \
    --ioengine=libaio \
    --iodepth=64 \
    --runtime=30 \
    --time_based \
    --output-format=json \
    --output=rand-read.json

RAND_READ_IOPS=$(jq -r '.jobs[0].read.iops' rand-read.json)
echo "Random read IOPS: $RAND_READ_IOPS"

# Random write test (IOPS)
echo ""
echo "[4/4] Random write (4KB blocks, 30s runtime)..."
fio --name=rand-write \
    --filename=/tmp/fio-test-rw \
    --size=1G \
    --bs=4K \
    --rw=randwrite \
    --direct=1 \
    --ioengine=libaio \
    --iodepth=64 \
    --runtime=30 \
    --time_based \
    --output-format=json \
    --output=rand-write.json

RAND_WRITE_IOPS=$(jq -r '.jobs[0].write.iops' rand-write.json)
echo "Random write IOPS: $RAND_WRITE_IOPS"

# Cleanup
rm -f /tmp/fio-test /tmp/fio-test-rw
rm -f seq-write.json seq-read.json rand-read.json rand-write.json

echo ""
echo "=== Benchmark Results ==="
echo "Sequential write: $SEQ_WRITE_BW KB/s"
echo "Sequential read: $SEQ_READ_BW KB/s"
echo "Random read IOPS: $RAND_READ_IOPS"
echo "Random write IOPS: $RAND_WRITE_IOPS"
echo "Expected improvement: 20-30% IOPS with BFQ scheduler"
