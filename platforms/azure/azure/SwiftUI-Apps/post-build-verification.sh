#!/bin/bash
#
# post-build-verification.sh
# VibeCode Post-Build Verification Master Script
#
# Purpose: Comprehensive post-build verification for UnifiedServicesVibeCodeApp
# This script orchestrates all verification tests including:
#   - Building the app
#   - Launching the app
#   - Waiting for services to be ready
#   - Verifying Datadog extension (SSH + Browser)
#   - Testing terminal functionality (Browser)
#   - Generating comprehensive test report
#
# Usage:
#   ./post-build-verification.sh [OPTIONS]
#
# Options:
#   --skip-build        Skip the build step (use existing app)
#   --skip-launch       Skip launching the app (use already running app)
#   --headless          Run browser tests in headless mode (for CI/CD)
#   --quick             Skip non-critical tests for faster verification
#   --verbose           Enable verbose output
#   --help              Show this help message
#
# Exit codes:
#   0 = All tests passed
#   1 = Tests failed
#   2 = Build or launch failed
#   3 = Prerequisites not met
#

set -euo pipefail

# Script directory
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Configuration
APP_PATH="$SCRIPT_DIR/Apps/UnifiedServicesVibeCodeApp.app"
BUILD_SCRIPT="$SCRIPT_DIR/build-unified-menubar.sh"
RESULTS_DIR="$SCRIPT_DIR/test-results"
REPORT_FILE="$RESULTS_DIR/post-build-verification-report.md"

# Test scripts
SSH_TEST="$SCRIPT_DIR/verify-datadog-extension-ssh.sh"
DATADOG_TEST="$SCRIPT_DIR/test-datadog-extension-post-build.js"
TERMINAL_TEST="$SCRIPT_DIR/test-terminal-functionality-post-build.js"

# Options
SKIP_BUILD=false
SKIP_LAUNCH=false
HEADLESS=false
QUICK_MODE=false
VERBOSE=false

# Service check configuration
OPENVSCODE_URL="http://localhost:8080"
MAX_WAIT_TIME=120  # seconds
CHECK_INTERVAL=5    # seconds

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

# Test tracking
declare -A TEST_RESULTS
TESTS_TOTAL=0
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_SKIPPED=0

# Timing
START_TIME=$(date +%s)

log() {
  local color="${2:-NC}"
  echo -e "${!color}$1${NC}"
}

log_verbose() {
  if [[ "$VERBOSE" == true ]]; then
    log "$1" "CYAN"
  fi
}

log_step() {
  log "\n═══════════════════════════════════════════════════════════════" "BLUE"
  log "  $1" "BLUE"
  log "═══════════════════════════════════════════════════════════════" "BLUE"
}

log_test_result() {
  local test_name="$1"
  local status="$2"
  local details="${3:-}"

  TEST_RESULTS["$test_name"]="$status"
  TESTS_TOTAL=$((TESTS_TOTAL + 1))

  case "$status" in
    "PASS")
      TESTS_PASSED=$((TESTS_PASSED + 1))
      log "✓ [PASS] $test_name" "GREEN"
      ;;
    "FAIL")
      TESTS_FAILED=$((TESTS_FAILED + 1))
      log "✗ [FAIL] $test_name" "RED"
      ;;
    "SKIP")
      TESTS_SKIPPED=$((TESTS_SKIPPED + 1))
      log "⊘ [SKIP] $test_name" "YELLOW"
      ;;
  esac

  if [[ -n "$details" ]]; then
    echo "         $details"
  fi
}

show_help() {
  cat << EOF
VibeCode Post-Build Verification Master Script

Usage: $0 [OPTIONS]

Options:
  --skip-build        Skip the build step (use existing app)
  --skip-launch       Skip launching the app (use already running app)
  --headless          Run browser tests in headless mode (for CI/CD)
  --quick             Skip non-critical tests for faster verification
  --verbose           Enable verbose output
  --help              Show this help message

Examples:
  # Full verification (build, launch, test)
  $0

  # Quick verification (skip build, use running app)
  $0 --skip-build --skip-launch

  # CI/CD mode (headless browser tests)
  $0 --headless

  # Fast check for development
  $0 --skip-build --skip-launch --quick

Exit codes:
  0 = All tests passed
  1 = Tests failed
  2 = Build or launch failed
  3 = Prerequisites not met

EOF
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --skip-build)
        SKIP_BUILD=true
        shift
        ;;
      --skip-launch)
        SKIP_LAUNCH=true
        shift
        ;;
      --headless)
        HEADLESS=true
        shift
        ;;
      --quick)
        QUICK_MODE=true
        shift
        ;;
      --verbose)
        VERBOSE=true
        shift
        ;;
      --help)
        show_help
        exit 0
        ;;
      *)
        log "Unknown option: $1" "RED"
        show_help
        exit 3
        ;;
    esac
  done
}

check_prerequisites() {
  log_step "Checking Prerequisites"

  local all_ok=true

  # Check for Node.js
  if command -v node &>/dev/null; then
    local node_version
    node_version=$(node --version)
    log "✓ Node.js: $node_version" "GREEN"
  else
    log "✗ Node.js not found" "RED"
    all_ok=false
  fi

  # Check for npm
  if command -v npm &>/dev/null; then
    local npm_version
    npm_version=$(npm --version)
    log "✓ npm: v$npm_version" "GREEN"
  else
    log "✗ npm not found" "RED"
    all_ok=false
  fi

  # Check for Playwright
  if npm list playwright &>/dev/null 2>&1 || npm list -g playwright &>/dev/null 2>&1; then
    log "✓ Playwright installed" "GREEN"
  else
    log "⚠ Playwright not found - will attempt to use if available" "YELLOW"
    log "  Install with: npm install playwright" "CYAN"
  fi

  # Check for sshpass (optional)
  if command -v sshpass &>/dev/null; then
    log "✓ sshpass installed" "GREEN"
  else
    log "⚠ sshpass not found (optional)" "YELLOW"
    log "  Install with: brew install hudochenkov/sshpass/sshpass" "CYAN"
  fi

  # Check test scripts exist
  for script in "$SSH_TEST" "$DATADOG_TEST" "$TERMINAL_TEST"; do
    if [[ -f "$script" ]]; then
      log "✓ Test script exists: $(basename "$script")" "GREEN"
    else
      log "✗ Test script missing: $(basename "$script")" "RED"
      all_ok=false
    fi
  done

  if [[ "$all_ok" != true ]]; then
    log "\n❌ Prerequisites not met" "RED"
    exit 3
  fi

  log "\n✅ All prerequisites met" "GREEN"
}

build_app() {
  if [[ "$SKIP_BUILD" == true ]]; then
    log_step "Skipping Build (--skip-build)"
    log_test_result "Build app" "SKIP" "User requested skip"
    return 0
  fi

  log_step "Building App"

  if [[ ! -f "$BUILD_SCRIPT" ]]; then
    log "✗ Build script not found: $BUILD_SCRIPT" "RED"
    log_test_result "Build app" "FAIL" "Build script not found"
    return 1
  fi

  log "Building with: $BUILD_SCRIPT" "CYAN"
  log ""

  if [[ "$VERBOSE" == true ]]; then
    bash "$BUILD_SCRIPT"
  else
    bash "$BUILD_SCRIPT" > /tmp/build-output.log 2>&1
  fi

  local build_exit_code=$?

  if [[ $build_exit_code -eq 0 ]]; then
    log "\n✅ Build successful" "GREEN"
    log_test_result "Build app" "PASS"
    return 0
  else
    log "\n❌ Build failed (exit code: $build_exit_code)" "RED"
    if [[ "$VERBOSE" != true ]]; then
      log "Build log saved to: /tmp/build-output.log" "YELLOW"
      log "Last 20 lines of build output:" "YELLOW"
      tail -20 /tmp/build-output.log
    fi
    log_test_result "Build app" "FAIL" "Exit code: $build_exit_code"
    return 1
  fi
}

launch_app() {
  if [[ "$SKIP_LAUNCH" == true ]]; then
    log_step "Skipping Launch (--skip-launch)"
    log_test_result "Launch app" "SKIP" "User requested skip"
    return 0
  fi

  log_step "Launching App"

  if [[ ! -d "$APP_PATH" ]]; then
    log "✗ App not found: $APP_PATH" "RED"
    log_test_result "Launch app" "FAIL" "App bundle not found"
    return 1
  fi

  # Check if app is already running
  if pgrep -f "UnifiedServicesVibeCode" > /dev/null; then
    log "⚠ App appears to be already running" "YELLOW"
    log "  Killing existing instance..." "YELLOW"
    pkill -f "UnifiedServicesVibeCode" || true
    sleep 2
  fi

  log "Launching: $APP_PATH" "CYAN"

  # Launch in background
  open "$APP_PATH" &

  log "✓ App launched" "GREEN"
  log_test_result "Launch app" "PASS"

  # Give it a moment to start
  sleep 3

  # Check if app is running
  if pgrep -f "UnifiedServicesVibeCode" > /dev/null; then
    log "✓ App process is running" "GREEN"
    return 0
  else
    log "✗ App process not found after launch" "RED"
    log_test_result "Launch app" "FAIL" "Process not found"
    return 1
  fi
}

wait_for_services() {
  log_step "Waiting for Services to be Ready"

  log "Checking OpenVSCode Server on $OPENVSCODE_URL" "CYAN"
  log "Maximum wait time: ${MAX_WAIT_TIME}s" "CYAN"
  log ""

  local elapsed=0
  local ready=false

  while [[ $elapsed -lt $MAX_WAIT_TIME ]]; do
    log_verbose "Attempt $(($elapsed / $CHECK_INTERVAL + 1)): Checking $OPENVSCODE_URL"

    if curl -s -f -o /dev/null --max-time 5 "$OPENVSCODE_URL"; then
      log "✓ OpenVSCode Server is responding" "GREEN"
      ready=true
      break
    fi

    sleep $CHECK_INTERVAL
    elapsed=$((elapsed + CHECK_INTERVAL))

    if [[ $(($elapsed % 15)) -eq 0 ]]; then
      log "  Still waiting... (${elapsed}s elapsed)" "YELLOW"
    fi
  done

  if [[ "$ready" == true ]]; then
    log "\n✅ Services are ready (took ${elapsed}s)" "GREEN"
    log_test_result "Wait for services" "PASS" "Ready in ${elapsed}s"
    return 0
  else
    log "\n❌ Services did not become ready within ${MAX_WAIT_TIME}s" "RED"
    log_test_result "Wait for services" "FAIL" "Timeout after ${MAX_WAIT_TIME}s"
    return 1
  fi
}

run_ssh_verification() {
  log_step "Running SSH-Based Extension Verification"

  if [[ ! -x "$SSH_TEST" ]]; then
    log "✗ SSH test script not executable: $SSH_TEST" "RED"
    log_test_result "SSH extension verification" "FAIL" "Script not executable"
    return 1
  fi

  log "Running: $SSH_TEST" "CYAN"
  log ""

  local exit_code=0
  if [[ "$VERBOSE" == true ]]; then
    bash "$SSH_TEST" --verbose || exit_code=$?
  else
    bash "$SSH_TEST" || exit_code=$?
  fi

  echo ""

  if [[ $exit_code -eq 0 ]]; then
    log "✅ SSH verification passed" "GREEN"
    log_test_result "SSH extension verification" "PASS"
    return 0
  else
    log "❌ SSH verification failed (exit code: $exit_code)" "RED"
    log_test_result "SSH extension verification" "FAIL" "Exit code: $exit_code"
    return 1
  fi
}

run_datadog_browser_test() {
  log_step "Running Browser-Based Datadog Extension Test"

  if [[ ! -f "$DATADOG_TEST" ]]; then
    log "✗ Datadog test script not found: $DATADOG_TEST" "RED"
    log_test_result "Browser Datadog verification" "FAIL" "Script not found"
    return 1
  fi

  local node_args=""
  if [[ "$HEADLESS" == true ]]; then
    node_args="--headless"
  fi

  log "Running: node $DATADOG_TEST $node_args" "CYAN"
  log ""

  local exit_code=0
  node "$DATADOG_TEST" $node_args || exit_code=$?

  echo ""

  if [[ $exit_code -eq 0 ]]; then
    log "✅ Browser Datadog test passed" "GREEN"
    log_test_result "Browser Datadog verification" "PASS"
    return 0
  else
    log "❌ Browser Datadog test failed (exit code: $exit_code)" "RED"
    log_test_result "Browser Datadog verification" "FAIL" "Exit code: $exit_code"
    return 1
  fi
}

run_terminal_browser_test() {
  log_step "Running Browser-Based Terminal Functionality Test"

  if [[ ! -f "$TERMINAL_TEST" ]]; then
    log "✗ Terminal test script not found: $TERMINAL_TEST" "RED"
    log_test_result "Browser terminal verification" "FAIL" "Script not found"
    return 1
  fi

  local node_args=""
  if [[ "$HEADLESS" == true ]]; then
    node_args="--headless"
  fi

  log "Running: node $TERMINAL_TEST $node_args" "CYAN"
  log ""

  local exit_code=0
  node "$TERMINAL_TEST" $node_args || exit_code=$?

  echo ""

  if [[ $exit_code -eq 0 ]]; then
    log "✅ Browser terminal test passed" "GREEN"
    log_test_result "Browser terminal verification" "PASS"
    return 0
  else
    log "❌ Browser terminal test failed (exit code: $exit_code)" "RED"
    log_test_result "Browser terminal verification" "FAIL" "Exit code: $exit_code"
    return 1
  fi
}

generate_report() {
  log_step "Generating Test Report"

  mkdir -p "$RESULTS_DIR"

  local end_time
  end_time=$(date +%s)
  local duration=$((end_time - START_TIME))

  cat > "$REPORT_FILE" << EOF
# VibeCode Post-Build Verification Report

**Generated:** $(date -u +"%Y-%m-%d %H:%M:%S UTC")
**Duration:** ${duration}s

## Configuration

- **App Path:** $APP_PATH
- **Skip Build:** $SKIP_BUILD
- **Skip Launch:** $SKIP_LAUNCH
- **Headless Mode:** $HEADLESS
- **Quick Mode:** $QUICK_MODE
- **OpenVSCode URL:** $OPENVSCODE_URL

## Test Summary

- **Total Tests:** $TESTS_TOTAL
- **Passed:** ✅ $TESTS_PASSED
- **Failed:** ❌ $TESTS_FAILED
- **Skipped:** ⊘ $TESTS_SKIPPED

## Test Results

EOF

  # Add individual test results
  for test_name in "${!TEST_RESULTS[@]}"; do
    local status="${TEST_RESULTS[$test_name]}"
    local icon=""
    case "$status" in
      "PASS") icon="✅" ;;
      "FAIL") icon="❌" ;;
      "SKIP") icon="⊘" ;;
    esac
    echo "- $icon **$test_name:** $status" >> "$REPORT_FILE"
  done

  cat >> "$REPORT_FILE" << EOF

## Verdict

EOF

  if [[ $TESTS_FAILED -eq 0 ]]; then
    cat >> "$REPORT_FILE" << EOF
✅ **ALL TESTS PASSED**

The UnifiedServicesVibeCodeApp has passed all post-build verification tests.
The app is ready for distribution.
EOF
  else
    cat >> "$REPORT_FILE" << EOF
❌ **TESTS FAILED**

$TESTS_FAILED test(s) failed. The app requires fixes before distribution.
Please review the failed tests and address the issues.
EOF
  fi

  cat >> "$REPORT_FILE" << EOF

## Test Artifacts

Test results and screenshots can be found in:
- **Results Directory:** $RESULTS_DIR
- **Datadog Test Results:** $RESULTS_DIR/datadog-extension/
- **Terminal Test Results:** $RESULTS_DIR/terminal-functionality/

## Next Steps

EOF

  if [[ $TESTS_FAILED -eq 0 ]]; then
    cat >> "$REPORT_FILE" << EOF
1. Review test artifacts for any warnings
2. Proceed with distribution preparation
3. Create DMG installer if needed
4. Update release notes
EOF
  else
    cat >> "$REPORT_FILE" << EOF
1. Review failed test details in test artifacts
2. Fix identified issues
3. Re-run verification: \`./post-build-verification.sh\`
4. Ensure all tests pass before distribution
EOF
  fi

  log "✅ Report generated: $REPORT_FILE" "GREEN"
}

print_summary() {
  log_step "Verification Summary"

  log "Test Statistics:" "CYAN"
  log "  Total:   $TESTS_TOTAL" "CYAN"
  log "  Passed:  $TESTS_PASSED" "GREEN"
  log "  Failed:  $TESTS_FAILED" "$([ $TESTS_FAILED -eq 0 ] && echo "GREEN" || echo "RED")"
  log "  Skipped: $TESTS_SKIPPED" "YELLOW"
  log ""

  local end_time
  end_time=$(date +%s)
  local duration=$((end_time - START_TIME))
  log "Total Duration: ${duration}s" "CYAN"
  log ""

  log "Report: $REPORT_FILE" "CYAN"
  log "Results: $RESULTS_DIR" "CYAN"
  log ""

  if [[ $TESTS_FAILED -eq 0 ]]; then
    log "╔═══════════════════════════════════════════════════════════════╗" "GREEN"
    log "║                  ✅ ALL TESTS PASSED                          ║" "GREEN"
    log "╚═══════════════════════════════════════════════════════════════╝" "GREEN"
    return 0
  else
    log "╔═══════════════════════════════════════════════════════════════╗" "RED"
    log "║                  ❌ TESTS FAILED                              ║" "RED"
    log "╚═══════════════════════════════════════════════════════════════╝" "RED"
    return 1
  fi
}

main() {
  log "╔═══════════════════════════════════════════════════════════════╗" "MAGENTA"
  log "║      VibeCode Post-Build Verification Master Script          ║" "MAGENTA"
  log "╚═══════════════════════════════════════════════════════════════╝" "MAGENTA"
  log ""
  log "Started: $(date)" "CYAN"
  log ""

  # Parse arguments
  parse_args "$@"

  # Run verification pipeline
  check_prerequisites || exit 3

  build_app || exit 2
  launch_app || exit 2
  wait_for_services || exit 2

  # Run tests (continue even if some fail)
  run_ssh_verification || true
  run_datadog_browser_test || true
  run_terminal_browser_test || true

  # Generate report and summary
  generate_report
  print_summary

  # Exit with appropriate code
  if [[ $TESTS_FAILED -eq 0 ]]; then
    exit 0
  else
    exit 1
  fi
}

# Run main
main "$@"
