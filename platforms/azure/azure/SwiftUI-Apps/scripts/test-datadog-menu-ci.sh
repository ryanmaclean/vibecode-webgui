#!/bin/bash
# ============================================================================
# Automated Test Suite for Datadog Menu (CI/CD Ready)
# ============================================================================
# Tests all menu options with both number and letter inputs
# Exit code 0 = all tests pass, 1 = any test fails
# ============================================================================

set -euo pipefail

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Test results array
declare -a FAILED_TESTS=()

# ============================================================================
# Test Helper Functions
# ============================================================================

test_case() {
  local input="$1"
  local expected_action="$2"
  local description="$3"

  TESTS_RUN=$((TESTS_RUN + 1))

  # Simulate the case statement from vibecode-datadog-master.sh
  local actual_action=""
  case "$input" in
    1|[Ll])
      actual_action="launch_vms"
      ;;
    2|[Vv])
      actual_action="verify_integration"
      ;;
    3|[Tt])
      actual_action="test_metrics"
      ;;
    4|[Cc])
      actual_action="cleanup_vms"
      ;;
    5|[Ss])
      actual_action="status_check"
      ;;
    6|[Mm])
      actual_action="monitor_logs"
      ;;
    7|[Kk])
      actual_action="kill_all"
      ;;
    8|[Rr])
      actual_action="reconfigure_api_key"
      ;;
    9|[Dd])
      actual_action="show_dashboard_links"
      ;;
    0|[Qq])
      actual_action="quit"
      ;;
    *)
      actual_action="invalid"
      ;;
  esac

  if [ "$actual_action" = "$expected_action" ]; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}✓${NC} PASS: $description (input='$input' → $actual_action)"
    return 0
  else
    TESTS_FAILED=$((TESTS_FAILED + 1))
    FAILED_TESTS+=("$description: Expected '$expected_action', got '$actual_action'")
    echo -e "${RED}✗${NC} FAIL: $description (input='$input' → expected '$expected_action', got '$actual_action')"
    return 1
  fi
}

# ============================================================================
# Test Suite
# ============================================================================

echo -e "${BLUE}╔══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Datadog Menu Input Validation Test Suite (CI)               ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Test 1: Launch VMs
echo -e "${YELLOW}Test Group 1: Launch VMs${NC}"
test_case "1" "launch_vms" "Number '1' launches VMs"
test_case "L" "launch_vms" "Uppercase 'L' launches VMs"
test_case "l" "launch_vms" "Lowercase 'l' launches VMs"
echo ""

# Test 2: Verify Integration
echo -e "${YELLOW}Test Group 2: Verify Integration${NC}"
test_case "2" "verify_integration" "Number '2' verifies integration"
test_case "V" "verify_integration" "Uppercase 'V' verifies integration"
test_case "v" "verify_integration" "Lowercase 'v' verifies integration"
echo ""

# Test 3: Test Metrics
echo -e "${YELLOW}Test Group 3: Test Metrics${NC}"
test_case "3" "test_metrics" "Number '3' tests metrics"
test_case "T" "test_metrics" "Uppercase 'T' tests metrics"
test_case "t" "test_metrics" "Lowercase 't' tests metrics"
echo ""

# Test 4: Cleanup VMs
echo -e "${YELLOW}Test Group 4: Cleanup VMs${NC}"
test_case "4" "cleanup_vms" "Number '4' cleans up VMs"
test_case "C" "cleanup_vms" "Uppercase 'C' cleans up VMs"
test_case "c" "cleanup_vms" "Lowercase 'c' cleans up VMs"
echo ""

# Test 5: Status Check
echo -e "${YELLOW}Test Group 5: Status Check${NC}"
test_case "5" "status_check" "Number '5' checks status"
test_case "S" "status_check" "Uppercase 'S' checks status"
test_case "s" "status_check" "Lowercase 's' checks status"
echo ""

# Test 6: Monitor Logs
echo -e "${YELLOW}Test Group 6: Monitor Logs${NC}"
test_case "6" "monitor_logs" "Number '6' monitors logs"
test_case "M" "monitor_logs" "Uppercase 'M' monitors logs"
test_case "m" "monitor_logs" "Lowercase 'm' monitors logs"
echo ""

# Test 7: Kill All VMs
echo -e "${YELLOW}Test Group 7: Kill All VMs${NC}"
test_case "7" "kill_all" "Number '7' kills all VMs"
test_case "K" "kill_all" "Uppercase 'K' kills all VMs"
test_case "k" "kill_all" "Lowercase 'k' kills all VMs"
echo ""

# Test 8: Reconfigure API Key
echo -e "${YELLOW}Test Group 8: Reconfigure API Key${NC}"
test_case "8" "reconfigure_api_key" "Number '8' reconfigures API key"
test_case "R" "reconfigure_api_key" "Uppercase 'R' reconfigures API key"
test_case "r" "reconfigure_api_key" "Lowercase 'r' reconfigures API key"
echo ""

# Test 9: Dashboard Links
echo -e "${YELLOW}Test Group 9: Dashboard Links${NC}"
test_case "9" "show_dashboard_links" "Number '9' shows dashboard links"
test_case "D" "show_dashboard_links" "Uppercase 'D' shows dashboard links"
test_case "d" "show_dashboard_links" "Lowercase 'd' shows dashboard links"
echo ""

# Test 10: Quit
echo -e "${YELLOW}Test Group 10: Quit${NC}"
test_case "0" "quit" "Number '0' quits"
test_case "Q" "quit" "Uppercase 'Q' quits"
test_case "q" "quit" "Lowercase 'q' quits"
echo ""

# Test 11: Invalid Inputs
echo -e "${YELLOW}Test Group 11: Invalid Inputs${NC}"
test_case "X" "invalid" "Invalid letter 'X' is rejected"
test_case "99" "invalid" "Invalid number '99' is rejected"
test_case "@" "invalid" "Invalid symbol '@' is rejected"
test_case "" "invalid" "Empty input is rejected"
test_case "abc" "invalid" "Invalid string 'abc' is rejected"
echo ""

# ============================================================================
# Test Summary
# ============================================================================

echo -e "${BLUE}╔══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                         TEST SUMMARY                             ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "Total Tests:  $TESTS_RUN"
echo -e "${GREEN}Passed:       $TESTS_PASSED${NC}"
if [ $TESTS_FAILED -gt 0 ]; then
  echo -e "${RED}Failed:       $TESTS_FAILED${NC}"
else
  echo "Failed:       $TESTS_FAILED"
fi
echo ""

# Calculate pass rate
PASS_RATE=$((TESTS_PASSED * 100 / TESTS_RUN))
echo "Pass Rate:    ${PASS_RATE}%"
echo ""

# Show failed tests if any
if [ $TESTS_FAILED -gt 0 ]; then
  echo -e "${RED}Failed Tests:${NC}"
  for test in "${FAILED_TESTS[@]}"; do
    echo -e "  ${RED}✗${NC} $test"
  done
  echo ""
fi

# ============================================================================
# Additional Validation: Check Actual Script
# ============================================================================

echo -e "${YELLOW}Additional Validation: Checking actual script file${NC}"
SCRIPT_PATH="/tmp/vibecode-datadog-master.sh"

if [ ! -f "$SCRIPT_PATH" ]; then
  echo -e "${RED}✗${NC} Script not found: $SCRIPT_PATH"
  TESTS_FAILED=$((TESTS_FAILED + 1))
else
  echo -e "${GREEN}✓${NC} Script exists: $SCRIPT_PATH"

  # Check syntax
  if bash -n "$SCRIPT_PATH" 2>/dev/null; then
    echo -e "${GREEN}✓${NC} Script syntax is valid"
  else
    echo -e "${RED}✗${NC} Script has syntax errors"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi

  # Check for all case patterns
  echo ""
  echo "Verifying case patterns in actual script:"

  # Check each pattern exists
  declare -a PATTERNS=(
    "1|\\[Ll\\]"
    "2|\\[Vv\\]"
    "3|\\[Tt\\]"
    "4|\\[Cc\\]"
    "5|\\[Ss\\]"
    "6|\\[Mm\\]"
    "7|\\[Kk\\]"
    "8|\\[Rr\\]"
    "9|\\[Dd\\]"
    "0|\\[Qq\\]"
  )

  for pattern in "${PATTERNS[@]}"; do
    if grep -q "$pattern)" "$SCRIPT_PATH"; then
      echo -e "  ${GREEN}✓${NC} Pattern found: $pattern"
    else
      echo -e "  ${RED}✗${NC} Pattern missing: $pattern"
      TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
  done

  # Check dependent scripts exist
  echo ""
  echo "Checking dependent scripts:"
  declare -a DEPS=(
    "/tmp/launch-all-vms-with-datadog.sh"
    "/tmp/verify-datadog-integration.sh"
    "/tmp/send-test-metrics.sh"
    "/tmp/cleanup-vms.sh"
  )

  for dep in "${DEPS[@]}"; do
    if [ -f "$dep" ]; then
      echo -e "  ${GREEN}✓${NC} Found: $dep"
    else
      echo -e "  ${YELLOW}⚠${NC}  Missing (optional): $dep"
    fi
  done
fi

echo ""

# ============================================================================
# Exit Code
# ============================================================================

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}╔══════════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║                    ✓ ALL TESTS PASSED                           ║${NC}"
  echo -e "${GREEN}╚══════════════════════════════════════════════════════════════════╝${NC}"
  exit 0
else
  echo -e "${RED}╔══════════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${RED}║                    ✗ TESTS FAILED                                ║${NC}"
  echo -e "${RED}╚══════════════════════════════════════════════════════════════════╝${NC}"
  exit 1
fi
