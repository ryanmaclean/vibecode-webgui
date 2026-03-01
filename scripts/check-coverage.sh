#!/usr/bin/env bash
# Coverage Check Script - VibeCode Platform
# Validates test coverage against defined thresholds

set -euo pipefail

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default configuration
COVERAGE_FILE="coverage/coverage-summary.json"
DEFAULT_THRESHOLD=30
THRESHOLD=${DEFAULT_THRESHOLD}
STRICT_MODE=false
SHOW_REPORT=false

# Usage function
usage() {
  cat << EOF
Usage: $0 [OPTIONS]

Validates test coverage against defined thresholds.

OPTIONS:
  --help              Show this help message
  --threshold N       Set custom threshold percentage (default: ${DEFAULT_THRESHOLD})
  --strict            Fail if ANY metric is below threshold (default: fail if total is below)
  --report            Show detailed coverage report
  --coverage-file F   Path to coverage-summary.json (default: ${COVERAGE_FILE})

EXAMPLES:
  $0                           # Check coverage against 30% threshold
  $0 --threshold 50            # Check against 50% threshold
  $0 --strict                  # Strict mode: all metrics must pass
  $0 --report                  # Show detailed coverage breakdown
  $0 --threshold 40 --strict   # Strict 40% threshold

EXIT CODES:
  0  - Coverage meets or exceeds thresholds
  1  - Coverage below threshold or validation error
  2  - Coverage file not found or invalid

EOF
}

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --help|-h)
      usage
      exit 0
      ;;
    --threshold)
      THRESHOLD="$2"
      shift 2
      ;;
    --strict)
      STRICT_MODE=true
      shift
      ;;
    --report)
      SHOW_REPORT=true
      shift
      ;;
    --coverage-file)
      COVERAGE_FILE="$2"
      shift 2
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      usage
      exit 1
      ;;
  esac
done

# Validate threshold is a number
if ! [[ "$THRESHOLD" =~ ^[0-9]+$ ]] || [ "$THRESHOLD" -lt 0 ] || [ "$THRESHOLD" -gt 100 ]; then
  echo -e "${RED}Error: Threshold must be a number between 0 and 100${NC}"
  exit 1
fi

# Check if coverage file exists
if [ ! -f "$COVERAGE_FILE" ]; then
  echo -e "${RED}Error: Coverage file not found: $COVERAGE_FILE${NC}"
  echo ""
  echo "Please run tests with coverage first:"
  echo "  npm run test:coverage"
  exit 2
fi

# Check if jq is available
if ! command -v jq &> /dev/null; then
  echo -e "${RED}Error: jq is required but not installed${NC}"
  echo "Install with: brew install jq (macOS) or apt-get install jq (Linux)"
  exit 2
fi

echo "=== Coverage Validation Report ==="
echo "Threshold: ${THRESHOLD}%"
echo "Mode: $([ "$STRICT_MODE" = true ] && echo "Strict (all metrics)" || echo "Standard (overall)")"
echo ""

# Extract coverage metrics
LINES_PCT=$(jq -r '.total.lines.pct' "$COVERAGE_FILE" 2>/dev/null || echo "0")
STATEMENTS_PCT=$(jq -r '.total.statements.pct' "$COVERAGE_FILE" 2>/dev/null || echo "0")
FUNCTIONS_PCT=$(jq -r '.total.functions.pct' "$COVERAGE_FILE" 2>/dev/null || echo "0")
BRANCHES_PCT=$(jq -r '.total.branches.pct' "$COVERAGE_FILE" 2>/dev/null || echo "0")

# Check if extraction was successful
if [ "$LINES_PCT" = "null" ] || [ -z "$LINES_PCT" ]; then
  echo -e "${RED}Error: Invalid coverage file format${NC}"
  exit 2
fi

# Function to format percentage with color
format_pct() {
  local pct=$1
  local threshold=$2

  # Handle decimal comparison
  if (( $(echo "$pct >= $threshold" | bc -l) )); then
    echo -e "${GREEN}${pct}%${NC}"
  elif (( $(echo "$pct >= $threshold - 5" | bc -l) )); then
    echo -e "${YELLOW}${pct}%${NC}"
  else
    echo -e "${RED}${pct}%${NC}"
  fi
}

# Display coverage metrics
echo "--- Coverage Metrics ---"
echo -n "Lines:      "
format_pct "$LINES_PCT" "$THRESHOLD"
echo -n "Statements: "
format_pct "$STATEMENTS_PCT" "$THRESHOLD"
echo -n "Functions:  "
format_pct "$FUNCTIONS_PCT" "$THRESHOLD"
echo -n "Branches:   "
format_pct "$BRANCHES_PCT" "$THRESHOLD"
echo ""

# Show detailed report if requested
if [ "$SHOW_REPORT" = true ]; then
  echo "--- Detailed Coverage ---"

  LINES_COVERED=$(jq -r '.total.lines.covered' "$COVERAGE_FILE")
  LINES_TOTAL=$(jq -r '.total.lines.total' "$COVERAGE_FILE")
  STATEMENTS_COVERED=$(jq -r '.total.statements.covered' "$COVERAGE_FILE")
  STATEMENTS_TOTAL=$(jq -r '.total.statements.total' "$COVERAGE_FILE")
  FUNCTIONS_COVERED=$(jq -r '.total.functions.covered' "$COVERAGE_FILE")
  FUNCTIONS_TOTAL=$(jq -r '.total.functions.total' "$COVERAGE_FILE")
  BRANCHES_COVERED=$(jq -r '.total.branches.covered' "$COVERAGE_FILE")
  BRANCHES_TOTAL=$(jq -r '.total.branches.total' "$COVERAGE_FILE")

  echo "Lines:      $LINES_COVERED / $LINES_TOTAL"
  echo "Statements: $STATEMENTS_COVERED / $STATEMENTS_TOTAL"
  echo "Functions:  $FUNCTIONS_COVERED / $FUNCTIONS_TOTAL"
  echo "Branches:   $BRANCHES_COVERED / $BRANCHES_TOTAL"
  echo ""
fi

# Determine pass/fail
FAILED=false
FAILED_METRICS=()

if [ "$STRICT_MODE" = true ]; then
  # Strict mode: all metrics must meet threshold
  echo "--- Strict Mode Validation ---"

  if (( $(echo "$LINES_PCT < $THRESHOLD" | bc -l) )); then
    FAILED=true
    FAILED_METRICS+=("lines")
  fi

  if (( $(echo "$STATEMENTS_PCT < $THRESHOLD" | bc -l) )); then
    FAILED=true
    FAILED_METRICS+=("statements")
  fi

  if (( $(echo "$FUNCTIONS_PCT < $THRESHOLD" | bc -l) )); then
    FAILED=true
    FAILED_METRICS+=("functions")
  fi

  if (( $(echo "$BRANCHES_PCT < $THRESHOLD" | bc -l) )); then
    FAILED=true
    FAILED_METRICS+=("branches")
  fi

  if [ "$FAILED" = true ]; then
    echo -e "${RED}✗ Coverage check failed${NC}"
    echo -e "${RED}Failed metrics: ${FAILED_METRICS[*]}${NC}"
    echo ""
    echo "The following metrics are below ${THRESHOLD}%:"
    for metric in "${FAILED_METRICS[@]}"; do
      case $metric in
        lines) echo "  - Lines: ${LINES_PCT}%" ;;
        statements) echo "  - Statements: ${STATEMENTS_PCT}%" ;;
        functions) echo "  - Functions: ${FUNCTIONS_PCT}%" ;;
        branches) echo "  - Branches: ${BRANCHES_PCT}%" ;;
      esac
    done
    exit 1
  else
    echo -e "${GREEN}✓ All metrics meet or exceed ${THRESHOLD}% threshold${NC}"
    exit 0
  fi
else
  # Standard mode: average of all metrics must meet threshold
  AVERAGE=$(echo "scale=2; ($LINES_PCT + $STATEMENTS_PCT + $FUNCTIONS_PCT + $BRANCHES_PCT) / 4" | bc)

  echo "--- Standard Mode Validation ---"
  echo -n "Overall average: "
  format_pct "$AVERAGE" "$THRESHOLD"
  echo ""

  if (( $(echo "$AVERAGE < $THRESHOLD" | bc -l) )); then
    echo -e "${RED}✗ Coverage check failed${NC}"
    echo -e "${RED}Overall average (${AVERAGE}%) is below threshold (${THRESHOLD}%)${NC}"
    echo ""
    echo "To pass, improve coverage in the following areas:"
    if (( $(echo "$LINES_PCT < $THRESHOLD" | bc -l) )); then
      echo "  - Lines: ${LINES_PCT}% (need $(echo "$THRESHOLD - $LINES_PCT" | bc)% more)"
    fi
    if (( $(echo "$STATEMENTS_PCT < $THRESHOLD" | bc -l) )); then
      echo "  - Statements: ${STATEMENTS_PCT}% (need $(echo "$THRESHOLD - $STATEMENTS_PCT" | bc)% more)"
    fi
    if (( $(echo "$FUNCTIONS_PCT < $THRESHOLD" | bc -l) )); then
      echo "  - Functions: ${FUNCTIONS_PCT}% (need $(echo "$THRESHOLD - $FUNCTIONS_PCT" | bc)% more)"
    fi
    if (( $(echo "$BRANCHES_PCT < $THRESHOLD" | bc -l) )); then
      echo "  - Branches: ${BRANCHES_PCT}% (need $(echo "$THRESHOLD - $BRANCHES_PCT" | bc)% more)"
    fi
    exit 1
  else
    echo -e "${GREEN}✓ Overall coverage meets ${THRESHOLD}% threshold${NC}"
    exit 0
  fi
fi
