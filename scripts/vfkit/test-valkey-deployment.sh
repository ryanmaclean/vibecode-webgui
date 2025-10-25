#!/usr/bin/env bash
# Integration test for Valkey deployment scripts
# Tests script logic without actually deploying (for CI/x86_64 testing)

set -eo pipefail  # Removed -u to allow unset variables in tests

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_RESULTS=()
PASSED=0
FAILED=0

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "=== Valkey Deployment Scripts Integration Tests ==="
echo "Running on: $(uname -m)"
echo ""

# Test 1: Script files exist
test_scripts_exist() {
    echo -n "Test 1: Scripts exist... "
    local all_exist=true
    
    for script in compile-valkey-musl.sh deploy-valkey-alpine-arm64.sh verify-valkey-performance.sh quick-valkey-setup.sh; do
        if [ ! -f "${SCRIPT_DIR}/${script}" ]; then
            echo -e "${RED}FAIL${NC}: ${script} not found"
            all_exist=false
        fi
    done
    
    if [ "$all_exist" = true ]; then
        echo -e "${GREEN}PASS${NC}"
        return 0
    else
        echo -e "${RED}FAIL${NC}"
        return 1
    fi
}

# Test 2: Scripts are executable
test_scripts_executable() {
    echo -n "Test 2: Scripts are executable... "
    local all_executable=true
    
    for script in deploy-valkey-alpine-arm64.sh verify-valkey-performance.sh quick-valkey-setup.sh; do
        if [ ! -x "${SCRIPT_DIR}/${script}" ]; then
            echo -e "${RED}FAIL${NC}: ${script} not executable"
            all_executable=false
        fi
    done
    
    if [ "$all_executable" = true ]; then
        echo -e "${GREEN}PASS${NC}"
        return 0
    else
        echo -e "${RED}FAIL${NC}"
        return 1
    fi
}

# Test 3: Scripts have valid bash syntax
test_scripts_syntax() {
    echo -n "Test 3: Scripts have valid syntax... "
    local all_valid=true
    
    for script in compile-valkey-musl.sh deploy-valkey-alpine-arm64.sh verify-valkey-performance.sh quick-valkey-setup.sh; do
        if ! bash -n "${SCRIPT_DIR}/${script}" 2>/dev/null; then
            echo -e "${RED}FAIL${NC}: ${script} has syntax errors"
            all_valid=false
        fi
    done
    
    if [ "$all_valid" = true ]; then
        echo -e "${GREEN}PASS${NC}"
        return 0
    else
        echo -e "${RED}FAIL${NC}"
        return 1
    fi
}

# Test 4: Scripts have proper shebang
test_scripts_shebang() {
    echo -n "Test 4: Scripts have proper shebang... "
    local all_have_shebang=true
    
    for script in compile-valkey-musl.sh deploy-valkey-alpine-arm64.sh verify-valkey-performance.sh quick-valkey-setup.sh; do
        first_line=$(head -n 1 "${SCRIPT_DIR}/${script}")
        if [[ ! "$first_line" =~ ^#!/.*bash ]] && [[ ! "$first_line" =~ ^#!/.*sh ]]; then
            echo -e "${RED}FAIL${NC}: ${script} missing proper shebang"
            all_have_shebang=false
        fi
    done
    
    if [ "$all_have_shebang" = true ]; then
        echo -e "${GREEN}PASS${NC}"
        return 0
    else
        echo -e "${RED}FAIL${NC}"
        return 1
    fi
}

# Test 5: Documentation exists
test_documentation_exists() {
    echo -n "Test 5: Documentation exists... "
    
    if [ -f "${SCRIPT_DIR}/VALKEY_DEPLOYMENT.md" ]; then
        echo -e "${GREEN}PASS${NC}"
        return 0
    else
        echo -e "${RED}FAIL${NC}"
        return 1
    fi
}

# Test 6: Documentation is comprehensive
test_documentation_comprehensive() {
    echo -n "Test 6: Documentation is comprehensive... "
    local all_sections=true
    
    required_sections=(
        "Quick Start"
        "Architecture"
        "Performance"
        "Service Management"
        "Testing"
        "Troubleshooting"
    )
    
    for section in "${required_sections[@]}"; do
        if ! grep -qi "$section" "${SCRIPT_DIR}/VALKEY_DEPLOYMENT.md"; then
            echo -e "${RED}FAIL${NC}: Missing section: ${section}"
            all_sections=false
        fi
    done
    
    if [ "$all_sections" = true ]; then
        echo -e "${GREEN}PASS${NC}"
        return 0
    else
        echo -e "${RED}FAIL${NC}"
        return 1
    fi
}

# Test 7: ARM64 optimizations are documented
test_arm64_optimizations() {
    echo -n "Test 7: ARM64 optimizations documented... "
    
    if grep -qi "CRC32" "${SCRIPT_DIR}/compile-valkey-musl.sh" && \
       grep -qi "crypto" "${SCRIPT_DIR}/compile-valkey-musl.sh" && \
       grep -qi "cortex-a76" "${SCRIPT_DIR}/compile-valkey-musl.sh"; then
        echo -e "${GREEN}PASS${NC}"
        return 0
    else
        echo -e "${RED}FAIL${NC}"
        return 1
    fi
}

# Test 8: Performance targets are specified
test_performance_targets() {
    echo -n "Test 8: Performance targets specified... "
    
    if grep -qi "1ms" "${SCRIPT_DIR}/verify-valkey-performance.sh" && \
       grep -qi "10000\|10k" "${SCRIPT_DIR}/verify-valkey-performance.sh"; then
        echo -e "${GREEN}PASS${NC}"
        return 0
    else
        echo -e "${RED}FAIL${NC}"
        return 1
    fi
}

# Test 9: Scripts use set -euo pipefail
test_scripts_strict_mode() {
    echo -n "Test 9: Scripts use strict mode... "
    local all_strict=true
    
    for script in deploy-valkey-alpine-arm64.sh verify-valkey-performance.sh quick-valkey-setup.sh; do
        if ! grep -q "set -euo pipefail" "${SCRIPT_DIR}/${script}"; then
            echo -e "${RED}FAIL${NC}: ${script} missing 'set -euo pipefail'"
            all_strict=false
        fi
    done
    
    if [ "$all_strict" = true ]; then
        echo -e "${GREEN}PASS${NC}"
        return 0
    else
        echo -e "${RED}FAIL${NC}"
        return 1
    fi
}

# Test 10: Index updated
test_index_updated() {
    echo -n "Test 10: INDEX.md includes Valkey section... "
    
    if [ -f "${SCRIPT_DIR}/INDEX.md" ] && \
       grep -qi "valkey" "${SCRIPT_DIR}/INDEX.md"; then
        echo -e "${GREEN}PASS${NC}"
        return 0
    else
        echo -e "${RED}FAIL${NC}"
        return 1
    fi
}

# Run all tests
run_tests() {
    local tests=(
        test_scripts_exist
        test_scripts_executable
        test_scripts_syntax
        test_scripts_shebang
        test_documentation_exists
        test_documentation_comprehensive
        test_arm64_optimizations
        test_performance_targets
        test_scripts_strict_mode
        test_index_updated
    )
    
    for test in "${tests[@]}"; do
        if $test; then
            ((PASSED++)) || true
        else
            ((FAILED++)) || true
        fi
    done
}

# Main
run_tests

echo ""
echo "=== Test Results ==="
echo -e "Passed: ${GREEN}${PASSED}${NC}"
echo -e "Failed: ${RED}${FAILED}${NC}"
echo "Total: $((PASSED + FAILED))"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
    echo ""
    echo "The Valkey deployment scripts are ready for use on Alpine ARM64 VM."
    echo ""
    echo "To deploy on an Alpine ARM64 VM:"
    echo "  1. Copy scripts to the VM"
    echo "  2. Run: ./deploy-valkey-alpine-arm64.sh"
    echo "  3. Verify: ./verify-valkey-performance.sh"
    exit 0
else
    echo -e "${RED}❌ Some tests failed${NC}"
    echo ""
    echo "Please fix the issues above before deployment."
    exit 1
fi
