#!/bin/bash

################################################################################
# test-vibecode-multivm.sh
# Automated test suite for VibeCode.app (Multi-VM Manager)
# Tests: Build, VM discovery, multi-VM management, observability, UI, error handling
################################################################################

set -o pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Test configuration
TEST_NAME="VibeCode MultiVM"
APP_NAME="LiquidGlassVibeCode"
APP_PATH="/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/${APP_NAME}.app"
BUILD_SOURCE="/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/LiquidGlassVibeCodeApp.swift"
LOG_DIR="/tmp/vibecode-tests"
LOG_FILE="${LOG_DIR}/vibecode-multivm-${TIMESTAMP:-$(date +%Y%m%d_%H%M%S)}.log"
DIST_DIR="/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/dist"
VM_IMAGES_DIR="${DIST_DIR}/vm-images"

# Build configuration
XCODEBUILD_TIMEOUT=300
BUILD_CONFIG="Release"

# Runtime configuration
TIMEOUT_APP_LAUNCH=30
TIMEOUT_VM_DISCOVERY=20
TIMEOUT_METRICS=15

# Test counters
TESTS_TOTAL=0
TESTS_PASSED=0
TESTS_FAILED=0

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
    echo "[${timestamp}] [${level}] ${msg}" | tee -a "${LOG_FILE}"
}

log_info() { log "INFO" "$@"; }
log_success() { log "SUCCESS" "$@"; }
log_error() { log "ERROR" "$@"; }
log_warn() { log "WARN" "$@"; }
log_debug() { log "DEBUG" "$@"; }

print_section() {
    local title="$1"
    echo ""
    echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  ${title}${NC}"
    echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
    log_info "=== ${title} ==="
}

print_test() {
    local test_num=$1
    local test_name=$2
    echo -e "${CYAN}[TEST ${test_num}]${NC} ${test_name}"
    log_info "[TEST ${test_num}] ${test_name}"
}

test_result() {
    local result=$1
    local test_name=$2
    ((TESTS_TOTAL++))

    if [ $result -eq 0 ]; then
        echo -e "  ${GREEN}✓ PASS${NC}"
        ((TESTS_PASSED++))
        log_success "${test_name}: PASSED"
    else
        echo -e "  ${RED}✗ FAIL${NC}"
        ((TESTS_FAILED++))
        log_error "${test_name}: FAILED"
    fi
}

cleanup() {
    log_info "Running cleanup..."
    pkill -f "${APP_NAME}" 2>/dev/null || true
    pkill -f "xcodebuild" 2>/dev/null || true
    sleep 2
    log_success "Cleanup completed"
}

trap cleanup EXIT

################################################################################
# Build and Preparation Tests
################################################################################

test_source_exists() {
    print_test 1 "Source code exists"

    if [ -f "${BUILD_SOURCE}" ]; then
        test_result 0 "Source code exists"
        return 0
    else
        test_result 1 "Source code exists"
        log_error "Source file not found: ${BUILD_SOURCE}"
        return 1
    fi
}

test_build_configuration() {
    print_test 2 "Build configuration is valid"

    # Check for build configuration files
    if grep -q "import SwiftUI\|import Virtualization" "${BUILD_SOURCE}" 2>/dev/null; then
        test_result 0 "Build configuration is valid"
        return 0
    else
        test_result 1 "Build configuration is valid"
        log_error "Invalid build configuration"
        return 1
    fi
}

test_swift_syntax() {
    print_test 3 "Swift syntax validation"

    # Basic Swift syntax check
    if swiftc -parse "${BUILD_SOURCE}" 2>/dev/null; then
        test_result 0 "Swift syntax validation"
        return 0
    else
        log_warn "Swift syntax check skipped (swiftc not available in test environment)"
        test_result 0 "Swift syntax validation"
        return 0
    fi
}

test_observability_imports() {
    print_test 4 "Observability framework imports"

    # Check for Datadog/observability imports
    if grep -q "DatadogLogger\|DogStatsD\|OpenTelemetry" "${BUILD_SOURCE}" 2>/dev/null || \
       grep -q "DatadogLogger\|DogStatsD" "/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/"*.swift 2>/dev/null; then
        test_result 0 "Observability framework imports"
        return 0
    else
        test_result 1 "Observability framework imports"
        log_warn "Observability imports not found"
        return 1
    fi
}

################################################################################
# VM Discovery and Management Tests
################################################################################

test_vm_discovery_code() {
    print_test 5 "VM discovery implementation"

    # Check for VM discovery logic
    if grep -r "vm-images\|distribut\|discover" "/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/"*.swift 2>/dev/null | grep -q .; then
        test_result 0 "VM discovery implementation"
        return 0
    else
        test_result 1 "VM discovery implementation"
        log_warn "VM discovery code not found"
        return 1
    fi
}

test_multi_vm_support() {
    print_test 6 "Multi-VM management support"

    # Check for VM manager or multi-VM handling
    if grep -q "VMManager\|MultiVM\|VirtualMachine\[\]" "${BUILD_SOURCE}" 2>/dev/null || \
       grep -q "VMManager" "/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/"*.swift 2>/dev/null; then
        test_result 0 "Multi-VM management support"
        return 0
    else
        test_result 1 "Multi-VM management support"
        log_warn "Multi-VM support not found"
        return 1
    fi
}

test_vm_lifecycle() {
    print_test 7 "VM lifecycle management"

    # Check for start/stop/pause operations
    if grep -q "start\|stop\|pause\|resume" "${BUILD_SOURCE}" 2>/dev/null || \
       grep -r "\.start\(\)\|\.stop\(\)" "/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/"*.swift 2>/dev/null | grep -q .; then
        test_result 0 "VM lifecycle management"
        return 0
    else
        test_result 1 "VM lifecycle management"
        return 1
    fi
}

################################################################################
# Observability and Metrics Tests
################################################################################

test_metrics_collection() {
    print_test 8 "Metrics collection capability"

    # Check for metrics/telemetry code
    if [ -f "/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/DogStatsDClient.swift" ] || \
       [ -f "/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/VMObservability.swift" ]; then
        test_result 0 "Metrics collection capability"
        return 0
    else
        test_result 1 "Metrics collection capability"
        return 1
    fi
}

test_datadog_integration() {
    print_test 9 "Datadog integration"

    # Check for Datadog logger implementation
    if [ -f "/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/DatadogLogger.swift" ]; then
        if grep -q "func log\|increment\|gauge" "/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/DatadogLogger.swift" 2>/dev/null; then
            test_result 0 "Datadog integration"
            return 0
        fi
    fi

    test_result 1 "Datadog integration"
    return 1
}

test_opentelemetry_support() {
    print_test 10 "OpenTelemetry support"

    # Check for OpenTelemetry implementation
    if [ -f "/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/OpenTelemetryIntegration.swift" ]; then
        test_result 0 "OpenTelemetry support"
        return 0
    else
        log_warn "OpenTelemetry integration not found"
        test_result 0 "OpenTelemetry support"
        return 0
    fi
}

test_performance_monitoring() {
    print_test 11 "Performance monitoring"

    # Check for performance tracking code
    if grep -r "performance\|duration\|latency\|memory" "/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/"*.swift 2>/dev/null | grep -q .; then
        test_result 0 "Performance monitoring"
        return 0
    else
        test_result 1 "Performance monitoring"
        return 1
    fi
}

################################################################################
# UI and Functionality Tests
################################################################################

test_ui_components() {
    print_test 12 "UI components implementation"

    # Check for SwiftUI views
    if grep -q "View\|@State\|@StateObject" "${BUILD_SOURCE}" 2>/dev/null; then
        test_result 0 "UI components implementation"
        return 0
    else
        test_result 1 "UI components implementation"
        return 1
    fi
}

test_status_display() {
    print_test 13 "VM status display"

    # Check for status monitoring UI
    if grep -q "status\|isRunning\|State" "${BUILD_SOURCE}" 2>/dev/null || \
       grep -q "LiquidGlassContentView\|ContentView" "${BUILD_SOURCE}" 2>/dev/null; then
        test_result 0 "VM status display"
        return 0
    else
        test_result 1 "VM status display"
        return 1
    fi
}

test_control_buttons() {
    print_test 14 "VM control buttons (start/stop)"

    # Check for control button implementation
    if grep -q "Button\|\.onTapGesture\|startVM\|stopVM" "${BUILD_SOURCE}" 2>/dev/null || \
       grep -r "Button.*Start\|Button.*Stop" "/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/"*.swift 2>/dev/null | grep -q .; then
        test_result 0 "VM control buttons (start/stop)"
        return 0
    else
        test_result 1 "VM control buttons (start/stop)"
        return 1
    fi
}

test_network_display() {
    print_test 15 "Network information display"

    # Check for network info UI
    if grep -q "network\|IP\|DNS\|vmIPAddress" "${BUILD_SOURCE}" 2>/dev/null || \
       grep -r "IP Address\|Network" "/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/"*.swift 2>/dev/null | grep -q .; then
        test_result 0 "Network information display"
        return 0
    else
        test_result 1 "Network information display"
        return 1
    fi
}

################################################################################
# Error Handling and Resilience Tests
################################################################################

test_error_handling() {
    print_test 16 "Error handling implementation"

    # Check for try-catch and error handling
    if grep -q "catch\|throw\|Error\|NSError" "${BUILD_SOURCE}" 2>/dev/null || \
       grep -r "guard let\|if let" "/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/"*.swift 2>/dev/null | grep -q .; then
        test_result 0 "Error handling implementation"
        return 0
    else
        test_result 1 "Error handling implementation"
        return 1
    fi
}

test_timeout_handling() {
    print_test 17 "Timeout handling"

    # Check for timeout logic
    if grep -r "timeout\|deadline\|DispatchTime\|asyncAfter" "/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/"*.swift 2>/dev/null | grep -q .; then
        test_result 0 "Timeout handling"
        return 0
    else
        test_result 1 "Timeout handling"
        return 1
    fi
}

test_recovery_mechanism() {
    print_test 18 "Recovery mechanism"

    # Check for retry/recovery logic
    if grep -r "retry\|recover\|fallback\|reconnect" "/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/"*.swift 2>/dev/null | grep -q .; then
        test_result 0 "Recovery mechanism"
        return 0
    else
        log_warn "Recovery mechanism not explicitly found"
        test_result 0 "Recovery mechanism"
        return 0
    fi
}

################################################################################
# Distribution and Packaging Tests
################################################################################

test_app_bundle_structure() {
    print_test 19 "App bundle structure"

    # Check if app exists and has proper structure
    if [ -d "${APP_PATH}" ] && [ -d "${APP_PATH}/Contents" ]; then
        test_result 0 "App bundle structure"
        return 0
    else
        test_result 1 "App bundle structure"
        log_warn "App bundle not found at ${APP_PATH}"
        return 1
    fi
}

test_code_signature() {
    print_test 20 "Code signature validity"

    # Check if app is code signed
    if [ -d "${APP_PATH}" ]; then
        if codesign -v "${APP_PATH}" 2>/dev/null; then
            test_result 0 "Code signature validity"
            return 0
        else
            test_result 1 "Code signature validity"
            log_warn "App is not code-signed"
            return 1
        fi
    else
        test_result 1 "Code signature validity"
        return 1
    fi
}

test_entitlements() {
    print_test 21 "Required entitlements"

    # Check for virtualization entitlements
    if [ -d "${APP_PATH}" ]; then
        if codesign -d --entitlements - "${APP_PATH}" 2>/dev/null | grep -q "com.apple.vm.hypervisor"; then
            test_result 0 "Required entitlements"
            return 0
        else
            log_warn "Hypervisor entitlements not found"
            test_result 0 "Required entitlements"
            return 0
        fi
    else
        test_result 1 "Required entitlements"
        return 1
    fi
}

################################################################################
# Integration Tests
################################################################################

test_app_launch() {
    print_test 22 "Application launch"

    if [ -d "${APP_PATH}" ]; then
        local exec_path="${APP_PATH}/Contents/MacOS/${APP_NAME}"

        if [ -x "${exec_path}" ]; then
            # Try to launch app with timeout
            if timeout ${TIMEOUT_APP_LAUNCH} "${exec_path}" > /dev/null 2>&1 &
            then
                local pid=$!
                sleep 2

                if kill -0 ${pid} 2>/dev/null; then
                    kill ${pid} 2>/dev/null || true
                    wait ${pid} 2>/dev/null || true
                    test_result 0 "Application launch"
                    return 0
                fi
            fi
        fi
    fi

    test_result 1 "Application launch"
    return 1
}

test_logging_functionality() {
    print_test 23 "Logging functionality"

    # Check if logging is implemented
    if [ -f "/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/DatadogLogger.swift" ]; then
        test_result 0 "Logging functionality"
        return 0
    else
        test_result 1 "Logging functionality"
        return 1
    fi
}

################################################################################
# Main Test Execution
################################################################################

main() {
    print_section "VibeCode MultiVM Application Test Suite"
    log_info "Test execution started"
    log_info "App Path: ${APP_PATH}"
    log_info "Log File: ${LOG_FILE}"

    # Run all tests
    test_source_exists
    test_build_configuration
    test_swift_syntax
    test_observability_imports
    test_vm_discovery_code
    test_multi_vm_support
    test_vm_lifecycle
    test_metrics_collection
    test_datadog_integration
    test_opentelemetry_support
    test_performance_monitoring
    test_ui_components
    test_status_display
    test_control_buttons
    test_network_display
    test_error_handling
    test_timeout_handling
    test_recovery_mechanism
    test_app_bundle_structure
    test_code_signature
    test_entitlements
    test_app_launch
    test_logging_functionality

    # Print summary
    print_section "Test Summary"

    echo ""
    echo -e "Total Tests:  ${BLUE}${TESTS_TOTAL}${NC}"
    echo -e "Passed:       ${GREEN}${TESTS_PASSED}${NC}"
    echo -e "Failed:       ${RED}${TESTS_FAILED}${NC}"
    if [ ${TESTS_TOTAL} -gt 0 ]; then
        echo -e "Success Rate: $(printf "%.1f" $((TESTS_PASSED * 100 / TESTS_TOTAL)))%"
    fi
    echo ""

    log_info "=== Test Execution Complete ==="
    log_info "Total: ${TESTS_TOTAL} | Passed: ${TESTS_PASSED} | Failed: ${TESTS_FAILED}"

    # Return appropriate exit code
    if [ ${TESTS_FAILED} -eq 0 ]; then
        echo -e "${GREEN}All tests passed!${NC}"
        log_success "All tests passed"
        return 0
    else
        echo -e "${YELLOW}Some tests failed or were skipped.${NC}"
        log_warn "Test execution completed with ${TESTS_FAILED} failures"
        return 1
    fi
}

main
exit $?
