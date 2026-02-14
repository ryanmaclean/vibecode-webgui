#!/usr/bin/env bash
# Test: Full E2E boot chain orchestrator
# Runs all VM integration tests in sequence and generates summary

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/common.sh"

ARCH="${1:-x86_64}"

info "================================================"
info "VM Boot Chain Integration Tests"
info "================================================"
info "Architecture: ${ARCH}"
info "Date: $(date)"
info ""

# Test results tracking
declare -A test_results
tests=(
    "test-kernel-boot.sh"
    "test-initramfs.sh"
    "test-services.sh"
)

total_tests=${#tests[@]}
passed_tests=0
failed_tests=0
skipped_tests=0

info "Running ${total_tests} tests..."
info ""

# Run each test
for test in "${tests[@]}"; do
    test_path="${SCRIPT_DIR}/${test}"
    test_name=$(basename "$test" .sh)

    info "================================================"
    info "Running: ${test_name}"
    info "================================================"

    if [ ! -x "$test_path" ]; then
        warn "Test not executable: ${test}"
        test_results[$test]="SKIP"
        skipped_tests=$((skipped_tests + 1))
        continue
    fi

    # Run test and capture result
    if "$test_path" "$ARCH"; then
        test_results[$test]="PASS"
        passed_tests=$((passed_tests + 1))
    else
        test_results[$test]="FAIL"
        failed_tests=$((failed_tests + 1))
    fi

    info ""
done

# Generate summary report
info "================================================"
info "Test Summary"
info "================================================"
info ""
info "Total tests:   ${total_tests}"
info "Passed:        ${passed_tests}"
info "Failed:        ${failed_tests}"
info "Skipped:       ${skipped_tests}"
info ""

# Show individual results
info "Individual Results:"
for test in "${tests[@]}"; do
    result="${test_results[$test]}"
    test_name=$(basename "$test" .sh)

    if [ "$result" = "PASS" ]; then
        pass "${test_name}"
    elif [ "$result" = "FAIL" ]; then
        fail "${test_name}"
    else
        warn "${test_name} - SKIPPED"
    fi
done

info ""
info "================================================"

# Determine exit code
if [ "$failed_tests" -eq 0 ]; then
    pass "All tests passed!"
    exit 0
else
    fail "${failed_tests} test(s) failed"
    exit 1
fi
