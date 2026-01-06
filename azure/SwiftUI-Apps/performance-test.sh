#!/bin/bash
# Performance Testing Script for VibeCode Apps
# Tests VM startup time, memory usage, and network performance

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

OUTPUT_FILE="/tmp/vibecode-perf-results.txt"
rm -f "$OUTPUT_FILE"

echo "=== VibeCode Performance Testing ===" | tee -a "$OUTPUT_FILE"
echo "Date: $(date)" | tee -a "$OUTPUT_FILE"
echo "" | tee -a "$OUTPUT_FILE"

# Function to test app performance
test_app_performance() {
    local APP_NAME=$1
    local APP_PATH="${SCRIPT_DIR}/${APP_NAME}.app"
    local EXECUTABLE="${APP_PATH}/Contents/MacOS/${APP_NAME}"

    echo "=== Testing ${APP_NAME} ===" | tee -a "$OUTPUT_FILE"

    # Bundle size
    local BUNDLE_SIZE=$(du -sh "$APP_PATH" | awk '{print $1}')
    echo "Bundle size: $BUNDLE_SIZE" | tee -a "$OUTPUT_FILE"

    # Executable size
    local EXE_SIZE=$(ls -lh "$EXECUTABLE" | awk '{print $5}')
    echo "Executable size: $EXE_SIZE" | tee -a "$OUTPUT_FILE"

    # VM resources
    local KERNEL_SIZE=$(ls -lh "${APP_PATH}/Contents/Resources/vmlinuz" 2>/dev/null | awk '{print $5}' || echo "N/A")
    local INITRD_SIZE=$(ls -lh "${APP_PATH}/Contents/Resources/initrd" 2>/dev/null | awk '{print $5}' || echo "N/A")
    echo "Kernel size: $KERNEL_SIZE" | tee -a "$OUTPUT_FILE"
    echo "Initrd size: $INITRD_SIZE" | tee -a "$OUTPUT_FILE"
    echo "" | tee -a "$OUTPUT_FILE"

    # Startup time test (3 runs)
    echo "VM Startup Time Tests (3 runs):" | tee -a "$OUTPUT_FILE"
    local TOTAL_TIME=0

    for i in 1 2 3; do
        echo -n "  Run $i: " | tee -a "$OUTPUT_FILE"

        # Start app in background and measure time to VM ready
        local START_TIME=$(date +%s.%N)

        # Launch app
        open "$APP_PATH" &
        local APP_PID=$!

        # Wait for VM to be ready (check for server or VM running)
        local TIMEOUT=30
        local ELAPSED=0
        local VM_READY=false

        while [ $ELAPSED -lt $TIMEOUT ]; do
            # Check if Python server is running (sign of VM ready)
            if pgrep -f "python.*http.server" > /dev/null 2>&1; then
                VM_READY=true
                break
            fi
            sleep 0.5
            ELAPSED=$(echo "$ELAPSED + 0.5" | bc)
        done

        local END_TIME=$(date +%s.%N)
        local DURATION=$(echo "$END_TIME - $START_TIME" | bc)

        if [ "$VM_READY" = true ]; then
            echo "${DURATION}s" | tee -a "$OUTPUT_FILE"
            TOTAL_TIME=$(echo "$TOTAL_TIME + $DURATION" | bc)
        else
            echo "TIMEOUT (>${TIMEOUT}s)" | tee -a "$OUTPUT_FILE"
        fi

        # Kill the app
        pkill -f "$APP_NAME" || true
        sleep 2
    done

    # Calculate average
    if [ $(echo "$TOTAL_TIME > 0" | bc) -eq 1 ]; then
        local AVG_TIME=$(echo "scale=2; $TOTAL_TIME / 3" | bc)
        echo "  Average: ${AVG_TIME}s" | tee -a "$OUTPUT_FILE"
    fi

    echo "" | tee -a "$OUTPUT_FILE"
}

# Function to measure memory usage
test_memory_usage() {
    local APP_NAME=$1
    local APP_PATH="${SCRIPT_DIR}/${APP_NAME}.app"

    echo "=== Memory Usage Test: ${APP_NAME} ===" | tee -a "$OUTPUT_FILE"

    # Start app
    open "$APP_PATH" &
    sleep 10  # Wait for VM to start

    # Get memory usage
    local MEM_KB=$(ps aux | grep "$APP_NAME" | grep -v grep | awk '{sum+=$6} END {print sum}')
    if [ -n "$MEM_KB" ]; then
        local MEM_MB=$(echo "scale=2; $MEM_KB / 1024" | bc)
        echo "Memory usage (idle): ${MEM_MB} MB" | tee -a "$OUTPUT_FILE"
    else
        echo "Could not measure memory (app not running)" | tee -a "$OUTPUT_FILE"
    fi

    # Kill app
    pkill -f "$APP_NAME" || true
    sleep 2

    echo "" | tee -a "$OUTPUT_FILE"
}

# Test both apps
if [ -d "${SCRIPT_DIR}/BasicVibeCode.app" ]; then
    test_app_performance "BasicVibeCode"
fi

if [ -d "${SCRIPT_DIR}/LiquidGlassVibeCode.app" ]; then
    test_app_performance "LiquidGlassVibeCode"
fi

# Memory usage tests
if [ -d "${SCRIPT_DIR}/BasicVibeCode.app" ]; then
    test_memory_usage "BasicVibeCode"
fi

if [ -d "${SCRIPT_DIR}/LiquidGlassVibeCode.app" ]; then
    test_memory_usage "LiquidGlassVibeCode"
fi

echo "=== Performance Test Complete ===" | tee -a "$OUTPUT_FILE"
echo "Results saved to: $OUTPUT_FILE"
cat "$OUTPUT_FILE"
