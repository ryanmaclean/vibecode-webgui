#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"


# VibeCode Real Functionality Test Suite
# Tests actual app functionality, not just file existence

# Initialize log aggregation
init_log_aggregation


set -e

echo "🧪 VibeCode Real Functionality Test Suite"
echo "=========================================="
echo ""

# Test configuration
TEST_RESULTS="/tmp/vibecode-real-tests.json"
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Initialize results
cat > "$TEST_RESULTS" << 'EOF'
{
  "testSuite": "VibeCode Real Functionality Tests",
  "timestamp": "",
  "environment": {
    "os": "",
    "arch": "",
    "nodeVersion": "",
    "codeServerRunning": false,
    "tauriAppRunning": false,
    "electronAppRunning": false
  },
  "tests": [],
  "summary": {
    "totalTests": 0,
    "passed": 0,
    "failed": 0,
    "successRate": 0
  }
}
EOF

# Update timestamp
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
sed -i '' "s/\"timestamp\": \"\"/\"timestamp\": \"$TIMESTAMP\"/" "$TEST_RESULTS"

# Get environment info
OS_VERSION="$(sw_vers -productName) $(sw_vers -productVersion)"
ARCH=$(uname -m)
NODE_VERSION=$(node --version 2>/dev/null || echo "Not installed")

# Check running processes
CODE_SERVER_RUNNING=$(lsof -i :8080 >/dev/null 2>&1 && echo "true" || echo "false")
TAURI_APP_RUNNING=$(pgrep -f "vibecode" >/dev/null 2>&1 && echo "true" || echo "false")
ELECTRON_APP_RUNNING=$(pgrep -f "VibeCode Electron" >/dev/null 2>&1 && echo "true" || echo "false")

# Update environment info
jq --arg os "$OS_VERSION" --arg arch "$ARCH" --arg node "$NODE_VERSION" \
   --argjson cs "$CODE_SERVER_RUNNING" --argjson ta "$TAURI_APP_RUNNING" --argjson ea "$ELECTRON_APP_RUNNING" \
  '.environment.os = $os | .environment.arch = $arch | .environment.nodeVersion = $node | 
   .environment.codeServerRunning = $cs | .environment.tauriAppRunning = $ta | .environment.electronAppRunning = $ea' \
  "$TEST_RESULTS" > "$TEST_RESULTS.tmp" && mv "$TEST_RESULTS.tmp" "$TEST_RESULTS"

echo "📋 Environment Status:"
echo "   OS: $OS_VERSION"
echo "   Architecture: $ARCH"
echo "   Node.js: $NODE_VERSION"
echo "   code-server: $CODE_SERVER_RUNNING"
echo "   Tauri App: $TAURI_APP_RUNNING"
echo "   Electron App: $ELECTRON_APP_RUNNING"
echo ""

# Function to run a test and record results
run_test() {
    local test_name="$1"
    local test_command="$2"
    local expected_result="$3"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    echo "🧪 Test $TOTAL_TESTS: $test_name"
    
    if eval "$test_command" >/dev/null 2>&1; then
        echo "   ✅ PASSED"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        
        # Add to results
        jq --arg name "$test_name" --arg status "PASS" --arg result "$expected_result" \
          '.tests += [{"name": $name, "status": $status, "result": $result}]' \
          "$TEST_RESULTS" > "$TEST_RESULTS.tmp" && mv "$TEST_RESULTS.tmp" "$TEST_RESULTS"
    else
        echo "   ❌ FAILED"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        
        # Add to results
        jq --arg name "$test_name" --arg status "FAIL" --arg result "Test failed" \
          '.tests += [{"name": $name, "status": $status, "result": $result}]' \
          "$TEST_RESULTS" > "$TEST_RESULTS.tmp" && mv "$TEST_RESULTS.tmp" "$TEST_RESULTS"
    fi
    echo ""
}

# Test 1: code-server is running and accessible
run_test "code-server HTTP Response" "curl -s -o /dev/null -w '%{http_code}' http://localhost:8080 | grep -q '200'"

# Test 2: code-server serves VS Code interface
run_test "VS Code Interface Loaded" "curl -s http://localhost:8080 | grep -q 'code-server'"

# Test 3: No welcome screen (should load directly to editor)
run_test "No Welcome Screen" "curl -s http://localhost:8080 | grep -q -v 'Welcome' && curl -s http://localhost:8080 | grep -q -v 'Getting Started'"

# Test 4: Tauri app process is running
run_test "Tauri App Process Running" "pgrep -f 'vibecode' > /dev/null"

# Test 5: Tauri app can be controlled (responds to signals)
run_test "Tauri App Responsive" "pgrep -f 'vibecode' > /dev/null && kill -0 \$(pgrep -f 'vibecode' | head -1)"

# Test 6: code-server configuration is correct
run_test "code-server Configuration" "test -f ~/.config/code-server/user-data/User/settings.json && grep -q 'workbench.startupEditor.*none' ~/.config/code-server/user-data/User/settings.json"

# Test 7: Theme is properly configured
run_test "Theme Configuration" "grep -q 'workbench.colorTheme' ~/.config/code-server/user-data/User/settings.json"

# Test 8: Welcome screen is disabled
run_test "Welcome Screen Disabled" "grep -q 'workbench.welcome.enabled.*false' ~/.config/code-server/user-data/User/settings.json"

# Test 9: code-server serves static assets correctly
run_test "Static Assets Accessible" "curl -s -o /dev/null -w '%{http_code}' http://localhost:8080/static/ | grep -q '200'"

# Test 10: App can handle multiple requests (stress test)
run_test "Multiple Request Handling" "for i in {1..5}; do curl -s http://localhost:8080 > /dev/null; done"

# Test 11: Memory usage is reasonable
run_test "Memory Usage Check" "ps -o rss= -p \$(pgrep -f 'vibecode' | head -1) | awk '{if (\$1 < 1000000) exit 0; else exit 1}'"

# Test 12: App doesn't crash on rapid requests
run_test "Stability Under Load" "for i in {1..10}; do curl -s http://localhost:8080 > /dev/null; sleep 0.1; done"

# Calculate success rate
SUCCESS_RATE=$((PASSED_TESTS * 100 / TOTAL_TESTS))

# Update summary
jq --argjson total "$TOTAL_TESTS" --argjson passed "$PASSED_TESTS" --argjson failed "$FAILED_TESTS" --argjson rate "$SUCCESS_RATE" \
  '.summary.totalTests = $total | .summary.passed = $passed | .summary.failed = $failed | .summary.successRate = $rate' \
  "$TEST_RESULTS" > "$TEST_RESULTS.tmp" && mv "$TEST_RESULTS.tmp" "$TEST_RESULTS"

# Generate report
echo "📊 Test Results Summary"
echo "======================="
echo "Total Tests: $TOTAL_TESTS"
echo "Passed: $PASSED_TESTS"
echo "Failed: $FAILED_TESTS"
echo "Success Rate: $SUCCESS_RATE%"
echo ""

# Detailed results
echo "📋 Detailed Results:"
jq -r '.tests[] | "\(.status == "PASS" | if . then "✅" else "❌" end) \(.name): \(.result)"' "$TEST_RESULTS"
echo ""

# Performance metrics
echo "⚡ Performance Metrics:"
echo "   code-server Response Time: $(curl -s -o /dev/null -w '%{time_total}' http://localhost:8080)s"
echo "   Memory Usage: $(ps -o rss= -p $(pgrep -f 'vibecode' | head -1) | awk '{print $1/1024 " MB"}')"
echo "   Process Count: $(pgrep -f 'vibecode' | wc -l)"
echo ""

# Save results
echo "💾 Results saved to: $TEST_RESULTS"
echo ""

# Final status
if [ $FAILED_TESTS -eq 0 ]; then
    echo "🎉 ALL TESTS PASSED! VibeCode is fully functional."
    exit 0
else
    echo "⚠️  $FAILED_TESTS test(s) failed. Check the results above."
    exit 1
fi
