#!/bin/bash
# Comprehensive SwiftUI VM Test Suite
# Tests all specialized VMs built with Swift apps and reports status

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

RESULTS_DIR="/tmp/vm-test-results-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$RESULTS_DIR"

echo -e "${BLUE}=================================${NC}"
echo -e "${BLUE}  VibeCode SwiftUI VM Test Suite${NC}"
echo -e "${BLUE}=================================${NC}"
echo ""
echo "Results will be saved to: $RESULTS_DIR"
echo ""

# Initialize results CSV
echo "VM,Result,Timestamp,Boot_Time,Port_Status,Service_Status,Details" > "$RESULTS_DIR/test-results.csv"

# Function to test a VM
test_vm() {
    local VM_NAME=$1
    local INITRAMFS=$2
    local PORT=$3
    local TEST_COMMAND=$4
    local APP_NAME=$5

    echo -e "${BLUE}=================================${NC}"
    echo -e "${BLUE}Testing $VM_NAME VM${NC}"
    echo -e "${BLUE}=================================${NC}"

    # Check if initramfs exists
    if [ ! -f ~/vibecode-webgui/azure/"$INITRAMFS" ]; then
        echo -e "${RED}✗${NC} Initramfs not found: $INITRAMFS"
        echo "$VM_NAME,FAIL,$(date),N/A,N/A,N/A,Initramfs not found" >> "$RESULTS_DIR/test-results.csv"
        echo ""
        return 1
    fi

    # Backup and swap initramfs using NodeJS app as test harness
    cd ~/vibecode-webgui/azure
    if [ -f nodejs-complete.cpio.gz ]; then
        cp nodejs-complete.cpio.gz nodejs-backup.cpio.gz
    fi
    cp "$INITRAMFS" nodejs-complete.cpio.gz

    # Kill any running VMs
    killall NodeJS 2>/dev/null || true
    killall BasicVibeCode 2>/dev/null || true
    killall "$APP_NAME" 2>/dev/null || true
    sleep 2

    # Clean old console logs
    rm -f /tmp/vibecode-console-*.log

    # Launch VM
    echo "Launching VM..."
    BOOT_START=$(date +%s)
    ~/vibecode-webgui/azure/SwiftUI-Apps/NodeJSVibeCode.app/Contents/MacOS/NodeJS > /dev/null 2>&1 &
    VM_PID=$!

    # Wait for boot (max 60 seconds)
    echo "Waiting for VM to boot..."
    BOOT_TIMEOUT=60
    BOOT_COUNT=0
    while [ $BOOT_COUNT -lt $BOOT_TIMEOUT ]; do
        sleep 1
        BOOT_COUNT=$((BOOT_COUNT + 1))

        # Check if VM process is still running
        if ! kill -0 $VM_PID 2>/dev/null; then
            echo -e "${RED}✗${NC} VM process died during boot"
            echo "$VM_NAME,FAIL,$(date),${BOOT_COUNT}s,N/A,N/A,VM process died" >> "$RESULTS_DIR/test-results.csv"
            mv nodejs-backup.cpio.gz nodejs-complete.cpio.gz 2>/dev/null || true
            echo ""
            return 1
        fi

        # Check for network up message in console log
        CONSOLE_LOG=$(ls -t /tmp/vibecode-console-*.log 2>/dev/null | head -1)
        if [ -n "$CONSOLE_LOG" ] && grep -q "inet " "$CONSOLE_LOG" 2>/dev/null; then
            BOOT_END=$(date +%s)
            BOOT_TIME=$((BOOT_END - BOOT_START))
            echo -e "${GREEN}✓${NC} VM booted in ${BOOT_TIME}s"
            break
        fi
    done

    if [ $BOOT_COUNT -ge $BOOT_TIMEOUT ]; then
        echo -e "${RED}✗${NC} VM boot timeout (${BOOT_TIMEOUT}s)"
        echo "$VM_NAME,FAIL,$(date),${BOOT_TIMEOUT}s+,N/A,N/A,Boot timeout" >> "$RESULTS_DIR/test-results.csv"
        killall NodeJS 2>/dev/null || true
        mv nodejs-backup.cpio.gz nodejs-complete.cpio.gz 2>/dev/null || true
        echo ""
        return 1
    fi

    # Get VM IP address
    sleep 5
    CONSOLE_LOG=$(ls -t /tmp/vibecode-console-*.log 2>/dev/null | head -1)
    VM_IP=$(tail -100 "$CONSOLE_LOG" 2>/dev/null | grep -oE "inet [0-9]+\.[0-9]+\.[0-9]+\.[0-9]+" | awk '{print $2}' | head -1)

    if [ -z "$VM_IP" ]; then
        echo -e "${YELLOW}⚠${NC} Could not determine VM IP address"
        VM_IP="unknown"
        PORT_STATUS="UNKNOWN"
    else
        echo "VM IP: $VM_IP"

        # Test port connectivity
        echo "Testing port $PORT..."
        if nc -zv -w 3 "$VM_IP" "$PORT" 2>&1 | grep -q succeeded; then
            echo -e "${GREEN}✓${NC} Port $PORT reachable"
            PORT_STATUS="OPEN"
        else
            echo -e "${RED}✗${NC} Port $PORT not reachable"
            PORT_STATUS="CLOSED"
        fi
    fi

    # Run service-specific test
    SERVICE_STATUS="UNKNOWN"
    SERVICE_DETAILS=""
    if [ "$PORT_STATUS" = "OPEN" ] && [ -n "$TEST_COMMAND" ]; then
        echo "Running service test..."
        # Replace $VM_IP in test command
        TEST_CMD=$(echo "$TEST_COMMAND" | sed "s/\$VM_IP/$VM_IP/g")

        if eval "$TEST_CMD" > "$RESULTS_DIR/${VM_NAME}-test-output.txt" 2>&1; then
            echo -e "${GREEN}✓${NC} Service test passed"
            SERVICE_STATUS="PASS"
            SERVICE_DETAILS=$(head -5 "$RESULTS_DIR/${VM_NAME}-test-output.txt" | tr '\n' ' ')
        else
            echo -e "${YELLOW}⚠${NC} Service test failed"
            SERVICE_STATUS="FAIL"
            SERVICE_DETAILS=$(head -5 "$RESULTS_DIR/${VM_NAME}-test-output.txt" | tr '\n' ' ')
        fi
    fi

    # Determine overall result
    if [ "$PORT_STATUS" = "OPEN" ] && [ "$SERVICE_STATUS" = "PASS" ]; then
        RESULT="PASS"
        echo -e "${GREEN}✓${NC} $VM_NAME: PASS"
    elif [ "$PORT_STATUS" = "OPEN" ]; then
        RESULT="PARTIAL"
        echo -e "${YELLOW}⚠${NC} $VM_NAME: PARTIAL (port open but service issues)"
    else
        RESULT="FAIL"
        echo -e "${RED}✗${NC} $VM_NAME: FAIL"
    fi

    # Save results
    echo "$VM_NAME,$RESULT,$(date),$BOOT_TIME,$PORT_STATUS,$SERVICE_STATUS,\"$SERVICE_DETAILS\"" >> "$RESULTS_DIR/test-results.csv"

    # Copy console log
    if [ -n "$CONSOLE_LOG" ]; then
        cp "$CONSOLE_LOG" "$RESULTS_DIR/$VM_NAME-console.log" 2>/dev/null || true
    fi

    # Cleanup
    echo "Cleaning up..."
    killall NodeJS 2>/dev/null || true
    if [ -f nodejs-backup.cpio.gz ]; then
        mv nodejs-backup.cpio.gz nodejs-complete.cpio.gz
    fi
    sleep 3

    echo ""
    return 0
}

# Test all VMs
echo "Starting VM test suite..."
echo ""

# Test 1: Valkey Standalone VM
test_vm "Valkey" \
    "valkey-standalone-v2.cpio.gz" \
    "6379" \
    "timeout 5 redis-cli -h \$VM_IP -p 6379 PING 2>&1 | grep -q PONG" \
    "ValkeyVibeCode"

# Test 2: PostgreSQL Standalone VM
test_vm "PostgreSQL" \
    "postgresql-standalone.cpio.gz" \
    "5432" \
    "timeout 5 pg_isready -h \$VM_IP -p 5432 2>&1 | grep -q 'accepting connections'" \
    "PostgreSQLVibeCode"

# Test 3: Unified Services VM (Optimized)
test_vm "UnifiedOptimized" \
    "unified-services-optimized.cpio.gz" \
    "22" \
    "timeout 5 ssh -o StrictHostKeyChecking=no -o ConnectTimeout=3 root@\$VM_IP 'echo test' 2>&1 | grep -q test" \
    "UnifiedServicesVibeCode"

# Test 4: Node.js Reference VM (restore original)
test_vm "NodeJS" \
    "nodejs-complete.cpio.gz" \
    "3000" \
    "timeout 5 curl -s http://\$VM_IP:3000 2>&1 | grep -q 'Hello'" \
    "NodeJSVibeCode"

# Generate summary report
echo ""
echo -e "${BLUE}=================================${NC}"
echo -e "${BLUE}  Test Results Summary${NC}"
echo -e "${BLUE}=================================${NC}"
echo ""

# Count results
TOTAL_TESTS=$(grep -c "^[^VM]" "$RESULTS_DIR/test-results.csv" || echo 0)
PASS_COUNT=$(grep -c ",PASS," "$RESULTS_DIR/test-results.csv" || echo 0)
PARTIAL_COUNT=$(grep -c ",PARTIAL," "$RESULTS_DIR/test-results.csv" || echo 0)
FAIL_COUNT=$(grep -c ",FAIL," "$RESULTS_DIR/test-results.csv" || echo 0)

echo "Total VMs Tested: $TOTAL_TESTS"
echo -e "${GREEN}Passed:${NC} $PASS_COUNT"
echo -e "${YELLOW}Partial:${NC} $PARTIAL_COUNT"
echo -e "${RED}Failed:${NC} $FAIL_COUNT"
echo ""

if [ $TOTAL_TESTS -gt 0 ]; then
    SUCCESS_RATE=$(awk "BEGIN {printf \"%.1f\", ($PASS_COUNT / $TOTAL_TESTS) * 100}")
    echo "Success Rate: ${SUCCESS_RATE}%"
    echo ""
fi

# Display results table
echo "Detailed Results:"
echo "----------------------------------------"
column -t -s',' "$RESULTS_DIR/test-results.csv"
echo ""

# Generate markdown report
cat > "$RESULTS_DIR/TEST_REPORT.md" <<EOF
# VM Test Suite Results

**Date:** $(date)
**Test Suite Version:** 1.0

## Summary

- **Total VMs Tested:** $TOTAL_TESTS
- **Passed:** $PASS_COUNT
- **Partial:** $PARTIAL_COUNT
- **Failed:** $FAIL_COUNT
- **Success Rate:** ${SUCCESS_RATE:-0}%

## Detailed Results

| VM | Result | Boot Time | Port Status | Service Status | Details |
|----|--------|-----------|-------------|----------------|---------|
EOF

# Add results to markdown (skip header)
tail -n +2 "$RESULTS_DIR/test-results.csv" | while IFS=',' read -r vm result timestamp boot port service details; do
    echo "| $vm | $result | $boot | $port | $service | ${details//\"/} |" >> "$RESULTS_DIR/TEST_REPORT.md"
done

cat >> "$RESULTS_DIR/TEST_REPORT.md" <<EOF

## Console Logs

Console logs for each VM are saved in: \`$RESULTS_DIR\`

## Test Commands Used

- **Valkey:** \`redis-cli -h VM_IP -p 6379 PING\`
- **PostgreSQL:** \`pg_isready -h VM_IP -p 5432\`
- **Unified Services:** \`ssh root@VM_IP 'echo test'\`
- **Node.js:** \`curl http://VM_IP:3000\`

## Notes

- All tests use the NodeJSVibeCode.app as a test harness
- Tests swap initramfs files to test each VM variant
- Boot timeout: 60 seconds
- Service test timeout: 5 seconds

EOF

echo "Full results saved to: $RESULTS_DIR"
echo "Markdown report: $RESULTS_DIR/TEST_REPORT.md"
echo ""

# Final exit code based on results
if [ $FAIL_COUNT -gt 0 ]; then
    exit 1
elif [ $PARTIAL_COUNT -gt 0 ]; then
    exit 2
else
    exit 0
fi
