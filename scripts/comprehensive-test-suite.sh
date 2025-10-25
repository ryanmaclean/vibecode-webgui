#!/bin/bash

# VibeCode Comprehensive Test Suite
# Tests all releases for actual functionality, not just launch

set -e

echo "🧪 VibeCode Comprehensive Test Suite"
echo "===================================="
echo ""

# Configuration
TEST_DIR="/tmp/vibecode-test-suite"
RESULTS_FILE="$TEST_DIR/test-results.json"
LOG_FILE="$TEST_DIR/test.log"

# Create test directory
mkdir -p "$TEST_DIR"

# Initialize results
cat > "$RESULTS_FILE" << 'EOF'
{
  "testSuite": "VibeCode Comprehensive Tests",
  "timestamp": "",
  "environment": {
    "os": "",
    "arch": "",
    "nodeVersion": "",
    "codeServerAvailable": false
  },
  "releases": {},
  "summary": {
    "totalTests": 0,
    "passed": 0,
    "failed": 0,
    "overallStatus": "UNKNOWN"
  }
}
EOF

# Update timestamp
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
sed -i '' "s/\"timestamp\": \"\"/\"timestamp\": \"$TIMESTAMP\"/" "$RESULTS_FILE"

# Get environment info
OS_VERSION="$(sw_vers -productName) $(sw_vers -productVersion)"
ARCH=$(uname -m)
NODE_VERSION=$(node --version 2>/dev/null || echo "Not installed")
CODE_SERVER_AVAILABLE=$(which code-server >/dev/null 2>&1 && echo "true" || echo "false")

# Update environment info
jq --arg os "$OS_VERSION" --arg arch "$ARCH" --arg node "$NODE_VERSION" --argjson cs "$CODE_SERVER_AVAILABLE" \
  '.environment.os = $os | .environment.arch = $arch | .environment.nodeVersion = $node | .environment.codeServerAvailable = $cs' \
  "$RESULTS_FILE" > "$RESULTS_FILE.tmp" && mv "$RESULTS_FILE.tmp" "$RESULTS_FILE"

echo "📋 Environment Information:"
echo "   OS: $OS_VERSION"
echo "   Architecture: $ARCH"
echo "   Node.js: $NODE_VERSION"
echo "   code-server: $CODE_SERVER_AVAILABLE"
echo ""

# Function to run a test
run_test() {
    local test_name="$1"
    local test_command="$2"
    local expected_result="$3"
    
    echo "🧪 Running test: $test_name"
    echo "   Command: $test_command"
    
    if eval "$test_command" > "$LOG_FILE" 2>&1; then
        echo "   ✅ PASSED"
        return 0
    else
        echo "   ❌ FAILED"
        echo "   Error: $(cat "$LOG_FILE")"
        return 1
    fi
}

# Function to test app functionality
test_app_functionality() {
    local app_path="$1"
    local app_name="$2"
    local release_version="$3"
    
    echo "🔍 Testing $app_name ($release_version)"
    
    local tests_passed=0
    local tests_total=0
    
    # Test 1: App launches
    tests_total=$((tests_total + 1))
    if run_test "App Launch" "open '$app_path' && sleep 5 && pgrep -f '$app_name' > /dev/null"; then
        tests_passed=$((tests_passed + 1))
    fi
    
    # Test 2: App process is running
    tests_total=$((tests_total + 1))
    if run_test "Process Running" "pgrep -f '$app_name' > /dev/null"; then
        tests_passed=$((tests_passed + 1))
    fi
    
    # Test 3: code-server is accessible
    tests_total=$((tests_total + 1))
    if run_test "code-server Accessible" "curl -s -o /dev/null -w '%{http_code}' http://localhost:8080 | grep -q '200'"; then
        tests_passed=$((tests_passed + 1))
    fi
    
    # Test 4: code-server serves VS Code interface
    tests_total=$((tests_total + 1))
    if run_test "VS Code Interface" "curl -s http://localhost:8080 | grep -q 'code-server'"; then
        tests_passed=$((tests_passed + 1))
    fi
    
    # Test 5: No welcome screen (should load directly)
    tests_total=$((tests_total + 1))
    if run_test "No Welcome Screen" "curl -s http://localhost:8080 | grep -q -v 'Welcome'"; then
        tests_passed=$((tests_passed + 1))
    fi
    
    # Test 6: App can be quit cleanly
    tests_total=$((tests_total + 1))
    if run_test "Clean Quit" "pkill -f '$app_name' && sleep 2 && ! pgrep -f '$app_name' > /dev/null"; then
        tests_passed=$((tests_passed + 1))
    fi
    
    # Update results
    jq --arg app "$app_name" --arg version "$release_version" --argjson passed "$tests_passed" --argjson total "$tests_total" \
      '.releases[$app] = {
        "version": $version,
        "testsPassed": $passed,
        "testsTotal": $total,
        "status": (if $passed == $total then "PASS" else "FAIL" end)
      }' \
      "$RESULTS_FILE" > "$RESULTS_FILE.tmp" && mv "$RESULTS_FILE.tmp" "$RESULTS_FILE"
    
    echo "   📊 Results: $tests_passed/$tests_total tests passed"
    echo ""
}

# Function to test PKG installer
test_pkg_installer() {
    local pkg_path="$1"
    
    echo "📦 Testing PKG Installer"
    
    local tests_passed=0
    local tests_total=0
    
    # Test 1: PKG file exists and is readable
    tests_total=$((tests_total + 1))
    if run_test "PKG File Valid" "test -f '$pkg_path' && file '$pkg_path' | grep -q 'package'"; then
        tests_passed=$((tests_passed + 1))
    fi
    
    # Test 2: PKG can be expanded
    tests_total=$((tests_total + 1))
    if run_test "PKG Expandable" "pkgutil --expand '$pkg_path' '$TEST_DIR/pkg-expanded'"; then
        tests_passed=$((tests_passed + 1))
    fi
    
    # Test 3: PKG contains expected app bundle
    tests_total=$((tests_total + 1))
    if run_test "Contains App Bundle" "test -d '$TEST_DIR/pkg-expanded/Applications/VibeCode.app'"; then
        tests_passed=$((tests_passed + 1))
    fi
    
    # Test 4: App bundle has correct structure
    tests_total=$((tests_total + 1))
    if run_test "App Bundle Structure" "test -f '$TEST_DIR/pkg-expanded/Applications/VibeCode.app/Contents/Info.plist'"; then
        tests_passed=$((tests_passed + 1))
    fi
    
    # Test 5: PKG metadata is valid
    tests_total=$((tests_total + 1))
    if run_test "PKG Metadata" "pkgutil --check-signature '$pkg_path' > /dev/null 2>&1"; then
        tests_passed=$((tests_passed + 1))
    fi
    
    # Update results
    jq --argjson passed "$tests_passed" --argjson total "$tests_total" \
      '.releases["PKG Installer"] = {
        "testsPassed": $passed,
        "testsTotal": $total,
        "status": (if $passed == $total then "PASS" else "FAIL" end)
      }' \
      "$RESULTS_FILE" > "$RESULTS_FILE.tmp" && mv "$RESULTS_FILE.tmp" "$RESULTS_FILE"
    
    echo "   📊 Results: $tests_passed/$tests_total tests passed"
    echo ""
}

# Download and test releases
echo "📥 Downloading releases for testing..."

# Download v1.2.0 releases
cd "$TEST_DIR"
gh release download v1.2.0 --pattern "*.dmg" --pattern "*.zip" || echo "Failed to download v1.2.0"

# Download v1.3.0-ard releases  
gh release download v1.3.0-ard --pattern "*.pkg" || echo "Failed to download v1.3.0-ard"

echo ""

# Test Tauri build
if [ -f "VibeCode_0.1.0_aarch64.dmg" ]; then
    hdiutil attach "VibeCode_0.1.0_aarch64.dmg" -mountpoint "$TEST_DIR/tauri-mount" -quiet
    test_app_functionality "$TEST_DIR/tauri-mount/VibeCode.app" "vibecode" "0.1.0"
    hdiutil detach "$TEST_DIR/tauri-mount" -quiet
fi

# Test Electron build
if [ -f "VibeCode.Electron-1.0.0-arm64.dmg" ]; then
    hdiutil attach "VibeCode.Electron-1.0.0-arm64.dmg" -mountpoint "$TEST_DIR/electron-mount" -quiet
    test_app_functionality "$TEST_DIR/electron-mount/VibeCode Electron.app" "VibeCode Electron" "1.0.0"
    hdiutil detach "$TEST_DIR/electron-mount" -quiet
fi

# Test PKG installer
if [ -f "VibeCode-1.2.0.pkg" ]; then
    test_pkg_installer "VibeCode-1.2.0.pkg"
fi

# Calculate summary
TOTAL_TESTS=$(jq '[.releases[].testsTotal] | add' "$RESULTS_FILE")
PASSED_TESTS=$(jq '[.releases[].testsPassed] | add' "$RESULTS_FILE")
FAILED_TESTS=$((TOTAL_TESTS - PASSED_TESTS))

# Update summary
jq --argjson total "$TOTAL_TESTS" --argjson passed "$PASSED_TESTS" --argjson failed "$FAILED_TESTS" \
  '.summary.totalTests = $total | .summary.passed = $passed | .summary.failed = $failed | .summary.overallStatus = (if $failed == 0 then "PASS" else "FAIL" end)' \
  "$RESULTS_FILE" > "$RESULTS_FILE.tmp" && mv "$RESULTS_FILE.tmp" "$RESULTS_FILE"

# Generate report
echo "📊 Test Summary"
echo "==============="
echo "Total Tests: $TOTAL_TESTS"
echo "Passed: $PASSED_TESTS"
echo "Failed: $FAILED_TESTS"
echo "Overall Status: $(jq -r '.summary.overallStatus' "$RESULTS_FILE")"
echo ""

# Generate detailed report
echo "📋 Detailed Results:"
jq -r '.releases | to_entries[] | "\(.key): \(.value.status) (\(.value.testsPassed)/\(.value.testsTotal) tests)"' "$RESULTS_FILE"
echo ""

# Save results
echo "💾 Results saved to:"
echo "   JSON: $RESULTS_FILE"
echo "   Log: $LOG_FILE"
echo ""

# Cleanup
echo "🧹 Cleaning up test environment..."
pkill -f "vibecode" 2>/dev/null || true
pkill -f "VibeCode Electron" 2>/dev/null || true

echo "✅ Test suite complete!"
