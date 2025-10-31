#!/bin/bash
# Verify Datadog metrics are being sent and received

set -e

echo "Datadog Metrics Verification"
echo "============================="
echo ""

# Check DogStatsD is running
echo "[1/6] Checking DogStatsD status..."
if datadog-agent status 2>&1 | grep -q "DogStatsD"; then
    PACKETS=$(datadog-agent status 2>&1 | grep "Metric Packets:" | awk '{print $3}')
    echo "  PASS: DogStatsD running ($PACKETS packets received)"
else
    echo "  FAIL: DogStatsD not running"
    exit 1
fi

# Test UDP port
echo "[2/6] Testing UDP port 8125..."
if nc -vzu 127.0.0.1 8125 2>&1 | grep -q "succeeded"; then
    echo "  PASS: Port 8125 UDP open"
else
    echo "  WARN: Cannot verify UDP port (may still work)"
fi

# Send test metric
echo "[3/6] Sending test metric..."
echo "vibecode.test.verification:1|c|#source:verification_script" | nc -u -w1 127.0.0.1 8125
sleep 2
echo "  PASS: Test metric sent"

# Check if app is running
echo "[4/6] Checking if VibeCode app is running..."
if ps aux | grep -v grep | grep "VibeCode.*MacOS" > /dev/null; then
    echo "  PASS: VibeCode app is running"
else
    echo "  INFO: VibeCode app not running"
    echo "  Launching app to generate metrics..."
    killall VibeCode 2>/dev/null || true
    sleep 2
    ./scripts/launch-vibecode.sh > /dev/null 2>&1
    sleep 10
fi

# Check app logs for metric sends
echo "[5/6] Checking app logs for metrics..."
if grep -q "vibecode.vm" /Users/ryan.maclean/vibecode-webgui/logs/vibecode.log 2>/dev/null; then
    echo "  PASS: App is logging metric activity"
    VM_COUNT=$(grep "discovered_count" /Users/ryan.maclean/vibecode-webgui/logs/vibecode.log 2>/dev/null | tail -1)
    echo "  Last discovery: $VM_COUNT"
else
    echo "  INFO: No metric activity in logs yet"
fi

# Query Datadog for metrics
echo "[6/6] Checking Datadog dashboard..."
echo ""
echo "To verify metrics in Datadog:"
echo "  1. Go to: https://app.datadoghq.com/metric/summary"
echo "  2. Search for: vibecode.vm"
echo "  3. Expected metrics:"
echo "     - vibecode.vm.discovered_count"
echo "     - vibecode.vm.start.attempt"
echo "     - vibecode.vm.start.success"
echo "     - vibecode.vm.running_count"
echo ""

# Show recent metric packet count
echo "DogStatsD stats:"
datadog-agent status 2>&1 | grep -A 5 "DogStatsD"

echo ""
echo "============================="
echo "Verification complete"
echo ""
echo "Note: Metrics may take 1-2 minutes to appear in Datadog UI"

