#!/bin/bash

################################################################################
# test-all-apps.sh
# Master test runner for VibeCode applications
# Runs: BasicVibeCode tests + VibeCode MultiVM tests
# Generates comprehensive test report
################################################################################

set -o pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

# Test configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="/tmp/vibecode-tests"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
MAIN_LOG_FILE="${LOG_DIR}/test-results-${TIMESTAMP}.log"
REPORT_FILE="${LOG_DIR}/test-report-${TIMESTAMP}.txt"
JSON_REPORT_FILE="${LOG_DIR}/test-report-${TIMESTAMP}.json"

# Individual test script paths
TEST_BASICVIBECODE="${SCRIPT_DIR}/test-basicvibecode.sh"
TEST_MULTIVM="${SCRIPT_DIR}/test-vibecode-multivm.sh"

# Test results storage
declare -A TEST_RESULTS
declare -A TEST_DURATIONS
declare -A TEST_LOGS

# Global counters
TOTAL_TESTS=0
TOTAL_PASSED=0
TOTAL_FAILED=0
TOTAL_SKIPPED=0

# Create log directory
mkdir -p "${LOG_DIR}"

################################################################################
# Utility Functions
################################################################################

log() {
    local level=$1
    shift
    local msg="$@"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[${timestamp}] [${level}] ${msg}" | tee -a "${MAIN_LOG_FILE}"
}

log_info() { log "INFO" "$@"; }
log_success() { log "SUCCESS" "$@"; }
log_error() { log "ERROR" "$@"; }
log_warn() { log "WARN" "$@"; }

print_header() {
    local title="$1"
    echo ""
    echo -e "${MAGENTA}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${MAGENTA}║  ${WHITE}${title}${NC}${MAGENTA}║${NC}"
    echo -e "${MAGENTA}╚════════════════════════════════════════════════════════════╝${NC}"
    log_info "=== ${title} ==="
}

print_separator() {
    echo -e "${BLUE}────────────────────────────────────────────────────────────${NC}"
}

print_app_section() {
    local app_name=$1
    echo ""
    echo -e "${CYAN}>>> Testing: ${app_name}${NC}"
    log_info ">>> Testing: ${app_name}"
}

print_result() {
    local app_name=$1
    local result=$2
    local duration=$3

    if [ "$result" == "PASS" ]; then
        echo -e "    ${GREEN}✓ ${app_name}: PASSED${NC} (${duration}s)"
    elif [ "$result" == "FAIL" ]; then
        echo -e "    ${RED}✗ ${app_name}: FAILED${NC} (${duration}s)"
    elif [ "$result" == "SKIP" ]; then
        echo -e "    ${YELLOW}⊘ ${app_name}: SKIPPED${NC} (${duration}s)"
    fi
}

check_prerequisites() {
    print_header "Checking Prerequisites"

    local all_ok=true

    # Check if test scripts exist
    if [ ! -f "${TEST_BASICVIBECODE}" ]; then
        log_error "Test script not found: ${TEST_BASICVIBECODE}"
        all_ok=false
    else
        log_info "Found BasicVibeCode test script"
    fi

    if [ ! -f "${TEST_MULTIVM}" ]; then
        log_error "Test script not found: ${TEST_MULTIVM}"
        all_ok=false
    else
        log_info "Found VibeCode MultiVM test script"
    fi

    # Check if test scripts are executable
    if [ -f "${TEST_BASICVIBECODE}" ] && [ ! -x "${TEST_BASICVIBECODE}" ]; then
        log_warn "Making ${TEST_BASICVIBECODE} executable"
        chmod +x "${TEST_BASICVIBECODE}"
    fi

    if [ -f "${TEST_MULTIVM}" ] && [ ! -x "${TEST_MULTIVM}" ]; then
        log_warn "Making ${TEST_MULTIVM} executable"
        chmod +x "${TEST_MULTIVM}"
    fi

    if [ "$all_ok" = false ]; then
        log_error "Some prerequisites are missing"
        return 1
    fi

    log_success "All prerequisites check passed"
    return 0
}

run_test_suite() {
    local test_script=$1
    local app_name=$2
    local output_file="${LOG_DIR}/${app_name}-test-output-${TIMESTAMP}.log"

    print_app_section "${app_name}"

    local start_time=$(date +%s)

    # Run the test script and capture output
    if bash "${test_script}" > "${output_file}" 2>&1; then
        local result="PASS"
        ((TOTAL_PASSED++))
        log_success "${app_name} tests passed"
    else
        local result="FAIL"
        ((TOTAL_FAILED++))
        log_error "${app_name} tests failed"
    fi

    local end_time=$(date +%s)
    local duration=$((end_time - start_time))

    TEST_RESULTS["${app_name}"]="${result}"
    TEST_DURATIONS["${app_name}"]="${duration}"
    TEST_LOGS["${app_name}"]="${output_file}"

    print_result "${app_name}" "${result}" "${duration}"

    return $([[ "$result" == "PASS" ]] && echo 0 || echo 1)
}

generate_text_report() {
    {
        echo "╔════════════════════════════════════════════════════════════╗"
        echo "║         VibeCode Test Execution Report                      ║"
        echo "╠════════════════════════════════════════════════════════════╣"
        echo ""
        echo "Execution Timestamp: $(date '+%Y-%m-%d %H:%M:%S')"
        echo ""
        echo "Test Environment:"
        echo "  - Machine: $(uname -n)"
        echo "  - OS: $(uname -s) $(uname -r)"
        echo "  - Architecture: $(uname -m)"
        echo ""
        echo "════════════════════════════════════════════════════════════"
        echo "TEST RESULTS"
        echo "════════════════════════════════════════════════════════════"
        echo ""

        for app_name in "${!TEST_RESULTS[@]}"; do
            local result="${TEST_RESULTS[$app_name]}"
            local duration="${TEST_DURATIONS[$app_name]}"
            local log_file="${TEST_LOGS[$app_name]}"

            echo "Application: ${app_name}"
            echo "Result: ${result}"
            echo "Duration: ${duration}s"
            echo "Log File: ${log_file}"
            echo ""
        done

        echo "════════════════════════════════════════════════════════════"
        echo "SUMMARY"
        echo "════════════════════════════════════════════════════════════"
        echo ""
        echo "Total Test Suites:   ${#TEST_RESULTS[@]}"
        echo "Passed:              ${TOTAL_PASSED}"
        echo "Failed:              ${TOTAL_FAILED}"
        echo "Skipped:             ${TOTAL_SKIPPED}"
        echo ""

        local success_rate=0
        if [ ${#TEST_RESULTS[@]} -gt 0 ]; then
            success_rate=$((TOTAL_PASSED * 100 / ${#TEST_RESULTS[@]}))
        fi

        echo "Success Rate: ${success_rate}%"
        echo ""

        if [ ${TOTAL_FAILED} -eq 0 ]; then
            echo "Status: ALL TESTS PASSED ✓"
        else
            echo "Status: SOME TESTS FAILED ✗"
        fi

        echo ""
        echo "════════════════════════════════════════════════════════════"
        echo "LOG FILE LOCATIONS"
        echo "════════════════════════════════════════════════════════════"
        echo ""

        for app_name in "${!TEST_LOGS[@]}"; do
            echo "  ${app_name}: ${TEST_LOGS[$app_name]}"
        done

        echo ""
        echo "Main Log: ${MAIN_LOG_FILE}"
        echo ""
        echo "════════════════════════════════════════════════════════════"
        echo "Generated: $(date '+%Y-%m-%d %H:%M:%S')"
        echo "════════════════════════════════════════════════════════════"
    } | tee "${REPORT_FILE}"
}

generate_json_report() {
    local json_output="{"
    json_output="${json_output}\"timestamp\": \"$(date -u +'%Y-%m-%dT%H:%M:%SZ')\","
    json_output="${json_output}\"environment\": {"
    json_output="${json_output}\"machine\": \"$(uname -n)\","
    json_output="${json_output}\"os\": \"$(uname -s)\","
    json_output="${json_output}\"architecture\": \"$(uname -m)\""
    json_output="${json_output}},"
    json_output="${json_output}\"results\": {"

    local first=true
    for app_name in "${!TEST_RESULTS[@]}"; do
        if [ "$first" = false ]; then
            json_output="${json_output},"
        fi
        first=false

        local result="${TEST_RESULTS[$app_name]}"
        local duration="${TEST_DURATIONS[$app_name]}"

        json_output="${json_output}\"${app_name}\": {"
        json_output="${json_output}\"status\": \"${result}\","
        json_output="${json_output}\"duration_seconds\": ${duration}"
        json_output="${json_output}}"
    done

    json_output="${json_output}},"
    json_output="${json_output}\"summary\": {"
    json_output="${json_output}\"total_suites\": ${#TEST_RESULTS[@]},"
    json_output="${json_output}\"passed\": ${TOTAL_PASSED},"
    json_output="${json_output}\"failed\": ${TOTAL_FAILED},"
    json_output="${json_output}\"skipped\": ${TOTAL_SKIPPED}"
    json_output="${json_output}}"
    json_output="${json_output}}"

    echo "${json_output}" | python3 -m json.tool > "${JSON_REPORT_FILE}" 2>/dev/null || \
    echo "${json_output}" > "${JSON_REPORT_FILE}"
}

print_console_summary() {
    print_header "Test Execution Summary"

    echo ""
    echo -e "Total Test Suites: ${BLUE}${#TEST_RESULTS[@]}${NC}"
    echo -e "Passed:            ${GREEN}${TOTAL_PASSED}${NC}"
    echo -e "Failed:            ${RED}${TOTAL_FAILED}${NC}"
    echo -e "Skipped:           ${YELLOW}${TOTAL_SKIPPED}${NC}"
    echo ""

    local success_rate=0
    if [ ${#TEST_RESULTS[@]} -gt 0 ]; then
        success_rate=$((TOTAL_PASSED * 100 / ${#TEST_RESULTS[@]}))
    fi

    echo -e "Success Rate: ${BLUE}${success_rate}%${NC}"
    echo ""

    if [ ${TOTAL_FAILED} -eq 0 ]; then
        echo -e "${GREEN}Status: ALL TESTS PASSED${NC}"
    else
        echo -e "${RED}Status: SOME TESTS FAILED${NC}"
    fi

    print_separator

    echo ""
    echo "Report Files:"
    echo "  Text Report:   ${REPORT_FILE}"
    echo "  JSON Report:   ${JSON_REPORT_FILE}"
    echo "  Main Log:      ${MAIN_LOG_FILE}"
    echo ""
}

cleanup() {
    log_info "Running cleanup and finalization..."

    # Kill any remaining test processes
    pkill -f "test-basicvibecode\|test-vibecode-multivm" 2>/dev/null || true
    pkill -f "BasicVibeCode\|LiquidGlassVibeCode" 2>/dev/null || true

    sleep 1

    log_success "Cleanup completed"
}

main() {
    print_header "VibeCode Application Test Suite - Master Runner"

    log_info "Starting comprehensive test execution"
    log_info "Timestamp: ${TIMESTAMP}"
    log_info "Log Directory: ${LOG_DIR}"

    # Check prerequisites
    if ! check_prerequisites; then
        log_error "Prerequisites check failed"
        return 1
    fi

    print_separator

    # Run test suites
    run_test_suite "${TEST_BASICVIBECODE}" "BasicVibeCode"
    print_separator

    run_test_suite "${TEST_MULTIVM}" "VibeCode MultiVM"
    print_separator

    # Generate reports
    generate_text_report
    generate_json_report

    # Print console summary
    print_console_summary

    # Determine exit code
    if [ ${TOTAL_FAILED} -eq 0 ]; then
        log_success "All test suites completed successfully"
        return 0
    else
        log_error "Test execution completed with failures"
        return 1
    fi
}

# Set trap for cleanup
trap cleanup EXIT

# Run main
main
exit $?
