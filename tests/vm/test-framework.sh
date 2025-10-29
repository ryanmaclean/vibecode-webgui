#!/bin/bash
# VM Test Framework
# Common utilities and assertions for VM testing

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0
TEST_START_TIME=0

# Test report array
declare -a TEST_RESULTS=()

# Initialize test suite
init_test_suite() {
    local suite_name="$1"
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}Starting Test Suite: $suite_name${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
    TEST_START_TIME=$(date +%s)
}

# Finalize test suite
finalize_test_suite() {
    local suite_name="$1"
    local end_time=$(date +%s)
    local duration=$((end_time - TEST_START_TIME))

    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}Test Suite Complete: $suite_name${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo -e "Duration: ${duration}s"
    echo -e "Tests Run: $TESTS_RUN"
    echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
    echo -e "${RED}Failed: $TESTS_FAILED${NC}"

    if [ $TESTS_FAILED -eq 0 ]; then
        echo -e "${GREEN}All tests PASSED!${NC}"
        return 0
    else
        echo -e "${RED}Some tests FAILED!${NC}"
        return 1
    fi
}

# Assert equals
assert_equals() {
    local expected="$1"
    local actual="$2"
    local message="${3:-Assertion failed}"

    TESTS_RUN=$((TESTS_RUN + 1))

    if [[ "$expected" == "$actual" ]]; then
        TESTS_PASSED=$((TESTS_PASSED + 1))
        echo -e "${GREEN}✓${NC} PASS: $message"
        TEST_RESULTS+=("PASS: $message")
        return 0
    else
        TESTS_FAILED=$((TESTS_FAILED + 1))
        echo -e "${RED}✗${NC} FAIL: $message"
        echo -e "  Expected: $expected"
        echo -e "  Actual: $actual"
        TEST_RESULTS+=("FAIL: $message (expected: $expected, got: $actual)")
        return 1
    fi
}

# Assert contains
assert_contains() {
    local haystack="$1"
    local needle="$2"
    local message="${3:-String contains check}"

    TESTS_RUN=$((TESTS_RUN + 1))

    if [[ "$haystack" == *"$needle"* ]]; then
        TESTS_PASSED=$((TESTS_PASSED + 1))
        echo -e "${GREEN}✓${NC} PASS: $message"
        TEST_RESULTS+=("PASS: $message")
        return 0
    else
        TESTS_FAILED=$((TESTS_FAILED + 1))
        echo -e "${RED}✗${NC} FAIL: $message"
        echo -e "  Expected to contain: $needle"
        echo -e "  In: $haystack"
        TEST_RESULTS+=("FAIL: $message (expected substring: $needle)")
        return 1
    fi
}

# Assert success (command runs successfully)
assert_success() {
    local message="${1:-Command execution}"
    shift

    TESTS_RUN=$((TESTS_RUN + 1))

    if "$@" 2>&1; then
        TESTS_PASSED=$((TESTS_PASSED + 1))
        echo -e "${GREEN}✓${NC} PASS: $message"
        TEST_RESULTS+=("PASS: $message")
        return 0
    else
        TESTS_FAILED=$((TESTS_FAILED + 1))
        echo -e "${RED}✗${NC} FAIL: $message"
        echo -e "  Command: $*"
        TEST_RESULTS+=("FAIL: $message (command: $*)")
        return 1
    fi
}

# Assert port is open
assert_port_open() {
    local host="${1:-localhost}"
    local port="$2"
    local timeout="${3:-5}"
    local message="${4:-Port $port on $host should be open}"

    TESTS_RUN=$((TESTS_RUN + 1))

    if nc -z -w "$timeout" "$host" "$port" 2>/dev/null; then
        TESTS_PASSED=$((TESTS_PASSED + 1))
        echo -e "${GREEN}✓${NC} PASS: $message"
        TEST_RESULTS+=("PASS: $message")
        return 0
    else
        TESTS_FAILED=$((TESTS_FAILED + 1))
        echo -e "${RED}✗${NC} FAIL: $message"
        TEST_RESULTS+=("FAIL: $message")
        return 1
    fi
}

# Assert process is running
assert_process_running() {
    local process_name="$1"
    local message="${2:-Process $process_name should be running}"

    TESTS_RUN=$((TESTS_RUN + 1))

    if pgrep -f "$process_name" >/dev/null; then
        TESTS_PASSED=$((TESTS_PASSED + 1))
        echo -e "${GREEN}✓${NC} PASS: $message"
        TEST_RESULTS+=("PASS: $message")
        return 0
    else
        TESTS_FAILED=$((TESTS_FAILED + 1))
        echo -e "${RED}✗${NC} FAIL: $message"
        TEST_RESULTS+=("FAIL: $message")
        return 1
    fi
}

# Assert file exists
assert_file_exists() {
    local file_path="$1"
    local message="${2:-File $file_path should exist}"

    TESTS_RUN=$((TESTS_RUN + 1))

    if [[ -f "$file_path" ]]; then
        TESTS_PASSED=$((TESTS_PASSED + 1))
        echo -e "${GREEN}✓${NC} PASS: $message"
        TEST_RESULTS+=("PASS: $message")
        return 0
    else
        TESTS_FAILED=$((TESTS_FAILED + 1))
        echo -e "${RED}✗${NC} FAIL: $message"
        TEST_RESULTS+=("FAIL: $message")
        return 1
    fi
}

# Measure execution time
measure_time() {
    local command="$1"
    local start_time=$(date +%s%N)
    eval "$command" >/dev/null 2>&1
    local end_time=$(date +%s%N)
    local duration=$(( (end_time - start_time) / 1000000 )) # Convert to milliseconds
    echo "$duration"
}

# Wait for port to be available
wait_for_port() {
    local host="$1"
    local port="$2"
    local timeout="${3:-30}"
    local interval="${4:-1}"

    local elapsed=0
    while [ $elapsed -lt $timeout ]; do
        if nc -z -w 1 "$host" "$port" 2>/dev/null; then
            echo "Port $port on $host is now available"
            return 0
        fi
        sleep "$interval"
        elapsed=$((elapsed + interval))
    done

    echo "Timeout waiting for port $port on $host"
    return 1
}

# Wait for VM to boot
wait_for_vm() {
    local vm_name="$1"
    local timeout="${2:-60}"
    local interval="${3:-2}"

    echo "Waiting for VM '$vm_name' to boot..."
    local elapsed=0
    while [ $elapsed -lt $timeout ]; do
        if pgrep -f "vfkit.*$vm_name" >/dev/null; then
            echo "VM '$vm_name' is running"
            sleep 5  # Give it a few more seconds to fully initialize
            return 0
        fi
        sleep "$interval"
        elapsed=$((elapsed + interval))
    done

    echo "Timeout waiting for VM '$vm_name' to boot"
    return 1
}

# Get VM resource usage
get_vm_stats() {
    local vm_name="$1"
    local pid=$(pgrep -f "vfkit.*$vm_name" | head -1)

    if [[ -z "$pid" ]]; then
        echo "VM not running"
        return 1
    fi

    # Get CPU and memory usage on macOS
    local stats=$(ps -p "$pid" -o %cpu=,%mem=,rss= 2>/dev/null)
    if [[ -n "$stats" ]]; then
        echo "CPU: $(echo $stats | awk '{print $1}')% | MEM: $(echo $stats | awk '{print $2}')% | RSS: $(echo $stats | awk '{print $3/1024}')MB"
    else
        echo "Unable to get stats"
        return 1
    fi
}

# Export test results to JSON
export_results_json() {
    local output_file="$1"

    cat > "$output_file" <<EOF
{
  "suite": "$(basename $0)",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "duration": $(($(date +%s) - TEST_START_TIME)),
  "tests_run": $TESTS_RUN,
  "tests_passed": $TESTS_PASSED,
  "tests_failed": $TESTS_FAILED,
  "results": [
EOF

    local first=true
    for result in "${TEST_RESULTS[@]}"; do
        if [ "$first" = true ]; then
            first=false
        else
            echo "," >> "$output_file"
        fi
        echo "    \"$result\"" >> "$output_file"
    done

    echo "  ]" >> "$output_file"
    echo "}" >> "$output_file"
}

# Log helper
log_info() {
    echo -e "${BLUE}[INFO]${NC} $*"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $*"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $*"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $*"
}
