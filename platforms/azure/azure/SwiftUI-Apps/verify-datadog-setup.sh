#!/bin/bash
# Verify Datadog test instrumentation setup

echo "============================================"
echo "Datadog Test Instrumentation Verification"
echo "============================================"
echo ""

# Check Datadog agent
echo "1. Checking Datadog agent..."
if ps aux | grep -v grep | grep "datadog-agent" > /dev/null; then
    echo "   ✓ Datadog agent is running"
else
    echo "   ✗ Datadog agent is NOT running"
    exit 1
fi

# Check APM port
echo ""
echo "2. Checking APM trace port (8136)..."
if lsof -i :8136 > /dev/null 2>&1; then
    echo "   ✓ APM trace port 8136 is listening"
else
    echo "   ✗ APM trace port 8136 is NOT listening"
    exit 1
fi

# Check StatsD port
echo ""
echo "3. Checking StatsD port (8135)..."
if lsof -i :8135 > /dev/null 2>&1; then
    echo "   ✓ StatsD port 8135 is listening"
else
    echo "   ✗ StatsD port 8135 is NOT listening"
    exit 1
fi

# Check Node.js dependencies
echo ""
echo "4. Checking Node.js dependencies..."
cd /Users/ryan.maclean/vibecode-webgui
if npm list dd-trace > /dev/null 2>&1; then
    VERSION=$(npm list dd-trace 2>/dev/null | grep dd-trace | sed 's/.*@//')
    echo "   ✓ dd-trace installed: $VERSION"
else
    echo "   ✗ dd-trace is NOT installed"
    exit 1
fi

if npm list hot-shots > /dev/null 2>&1; then
    VERSION=$(npm list hot-shots 2>/dev/null | grep hot-shots | sed 's/.*@//')
    echo "   ✓ hot-shots installed: $VERSION"
else
    echo "   ✗ hot-shots is NOT installed"
    exit 1
fi

# Check Python dependencies
echo ""
echo "5. Checking Python dependencies..."
if pip list 2>/dev/null | grep ddtrace > /dev/null || pip3 list 2>/dev/null | grep ddtrace > /dev/null; then
    VERSION=$(pip list 2>/dev/null | grep ddtrace | awk '{print $2}' || pip3 list 2>/dev/null | grep ddtrace | awk '{print $2}')
    echo "   ✓ ddtrace installed: $VERSION"
else
    echo "   ✗ ddtrace is NOT installed"
fi

# Check instrumentation files
echo ""
echo "6. Checking instrumentation files..."
cd /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps

if [ -f "test-with-datadog.js" ]; then
    echo "   ✓ test-with-datadog.js exists"
else
    echo "   ✗ test-with-datadog.js is missing"
    exit 1
fi

if [ -f "run-tests-with-datadog.js" ]; then
    echo "   ✓ run-tests-with-datadog.js exists"
else
    echo "   ✗ run-tests-with-datadog.js is missing"
    exit 1
fi

if [ -f "test_with_datadog.py" ]; then
    echo "   ✓ test_with_datadog.py exists"
else
    echo "   ✗ test_with_datadog.py is missing"
fi

if [ -f "DATADOG_TEST_INSTRUMENTATION_GUIDE.md" ]; then
    echo "   ✓ DATADOG_TEST_INSTRUMENTATION_GUIDE.md exists"
else
    echo "   ✗ DATADOG_TEST_INSTRUMENTATION_GUIDE.md is missing"
    exit 1
fi

# Check test files
echo ""
echo "7. Checking test files..."
if [ -f "test-terminal-functionality-post-build.js" ]; then
    echo "   ✓ test-terminal-functionality-post-build.js exists"
else
    echo "   ✗ test-terminal-functionality-post-build.js is missing"
fi

if [ -f "test-datadog-extension-post-build.js" ]; then
    echo "   ✓ test-datadog-extension-post-build.js exists"
else
    echo "   ✗ test-datadog-extension-post-build.js is missing"
fi

# Test StatsD connectivity
echo ""
echo "8. Testing StatsD connectivity..."
echo "test.metric:1|g" | nc -u -w1 localhost 8135 2>/dev/null
if [ $? -eq 0 ]; then
    echo "   ✓ StatsD connectivity test passed"
else
    echo "   ⚠ StatsD connectivity test failed (this may be normal)"
fi

echo ""
echo "============================================"
echo "Verification Complete!"
echo "============================================"
echo ""
echo "Next steps:"
echo "  1. Run tests: node run-tests-with-datadog.js"
echo "  2. View traces: https://app.datadoghq.com/apm/traces?query=service:vibecode-tests"
echo "  3. View metrics: https://app.datadoghq.com/metric/explorer?query=vibecode.tests"
echo ""
echo "Configuration:"
echo "  APM Port: 8136"
echo "  StatsD Port: 8135"
echo "  Service: vibecode-tests"
echo "  Version: 3.3.0"
echo ""
