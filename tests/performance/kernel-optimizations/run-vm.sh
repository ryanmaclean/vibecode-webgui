#!/bin/bash
# VM Runner for Kernel Optimization Benchmarks
# Starts a VM with either baseline or optimized kernel parameters

set -e

KERNEL_TYPE="baseline"
SCENARIO=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --kernel)
            KERNEL_TYPE="$2"
            shift 2
            ;;
        --scenario)
            SCENARIO="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

if [ -z "$SCENARIO" ]; then
    echo "ERROR: --scenario is required"
    exit 1
fi

echo "=== VM Runner ==="
echo "Kernel type: $KERNEL_TYPE"
echo "Scenario: $SCENARIO"
echo ""

# Determine kernel parameters based on type
if [ "$KERNEL_TYPE" = "baseline" ]; then
    KERNEL_PARAMS="console=hvc0 root=/dev/vda rw quiet"
    echo "Using baseline kernel parameters (no optimizations)"
elif [ "$KERNEL_TYPE" = "optimized" ]; then
    KERNEL_PARAMS="console=hvc0 root=/dev/vda rw quiet"
    KERNEL_PARAMS="$KERNEL_PARAMS transparent_hugepage=always"
    KERNEL_PARAMS="$KERNEL_PARAMS elevator=bfq"
    KERNEL_PARAMS="$KERNEL_PARAMS sched_cluster=1"
    KERNEL_PARAMS="$KERNEL_PARAMS cpufreq.default_governor=schedutil"
    KERNEL_PARAMS="$KERNEL_PARAMS virtio_vsock.transport=vhost"
    KERNEL_PARAMS="$KERNEL_PARAMS nohz=on"
    echo "Using optimized kernel parameters (M-Series)"
else
    echo "ERROR: Invalid kernel type: $KERNEL_TYPE"
    echo "Valid options: baseline, optimized"
    exit 1
fi

# Start container with appropriate kernel parameters
CONTAINER_NAME="benchmark-$(date +%s)"

echo "Starting VM: $CONTAINER_NAME"
echo "Kernel parameters: $KERNEL_PARAMS"
echo ""

# Create temporary config for this benchmark run
CONFIG_FILE=$(mktemp)
cat > "$CONFIG_FILE" <<EOF
{
  "name": "$CONTAINER_NAME",
  "image": "alpine:latest",
  "cpus": 4,
  "memory": 8192,
  "kernel_params": "$KERNEL_PARAMS"
}
EOF

# Start container
CONTAINER_ID=$(apple-container-runtime run \
    --config "$CONFIG_FILE" \
    --detach \
    2>&1 | grep -oE "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")

echo "Container started: $CONTAINER_ID"

# Wait for container to be ready
echo "Waiting for container to be ready..."
for i in {1..30}; do
    STATE=$(apple-container-runtime inspect "$CONTAINER_ID" 2>/dev/null | jq -r '.state' || echo "unknown")
    if [ "$STATE" = "running" ]; then
        echo "✓ Container is ready"
        break
    fi
    sleep 1
done

# Execute benchmark scenario in VM
echo ""
echo "Executing benchmark scenario..."
apple-container-runtime exec "$CONTAINER_ID" /bin/sh < "$SCENARIO"

# Collect results
echo ""
echo "Collecting results..."
apple-container-runtime logs "$CONTAINER_ID" > "results-${KERNEL_TYPE}.log"

# Cleanup
echo "Cleaning up..."
apple-container-runtime stop "$CONTAINER_ID"
apple-container-runtime rm "$CONTAINER_ID"
rm -f "$CONFIG_FILE"

echo "✓ Benchmark complete for $KERNEL_TYPE kernel"
