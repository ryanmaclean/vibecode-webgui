#!/bin/bash
#
# test-pty-functionality.sh
# VibeCode PTY Functionality Test
#
# Purpose: Test PTY/TTY terminal functionality without starting a full VM
# Usage: ./scripts/test-pty-functionality.sh
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_header() {
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
}

print_test() {
    echo -e "\n${YELLOW}[TEST]${NC} $1"
}

print_pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

print_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# Test counter
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

run_test() {
    local test_name=$1
    shift
    print_test "$test_name"
    TESTS_RUN=$((TESTS_RUN + 1))

    if "$@"; then
        print_pass "$test_name"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        print_fail "$test_name"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

# Test 1: Check if PTY device creation is possible
test_pty_device_creation() {
    print_info "Checking PTY device support..."

    # Try to list PTY devices
    if ls /dev/ptmx &>/dev/null; then
        print_info "PTY master device exists: /dev/ptmx"
    else
        print_info "Warning: /dev/ptmx not found"
        return 1
    fi

    # Check for tty devices
    if ls /dev/tty* &>/dev/null; then
        local count=$(ls /dev/tty* 2>/dev/null | wc -l)
        print_info "Found $count TTY devices"
    else
        print_info "Warning: No TTY devices found"
        return 1
    fi

    return 0
}

# Test 2: Check required tools
test_required_tools() {
    print_info "Checking for required terminal tools..."

    local all_found=true

    # Check for screen
    if command -v screen &>/dev/null; then
        print_info "✓ GNU screen: $(screen -v 2>&1 | head -1)"
    else
        print_info "✗ GNU screen not found (install: brew install screen)"
        all_found=false
    fi

    # Check for tmux
    if command -v tmux &>/dev/null; then
        print_info "✓ tmux: $(tmux -V)"
    else
        print_info "✗ tmux not found (install: brew install tmux)"
    fi

    # Check for stty
    if command -v stty &>/dev/null; then
        print_info "✓ stty: available"
    else
        print_info "✗ stty not found"
        all_found=false
    fi

    $all_found
}

# Test 3: Create a test PTY pair
test_create_pty_pair() {
    print_info "Creating test PTY pair..."

    # Use script command to create a PTY
    local test_log="/tmp/pty-test-$$.log"

    # Run script in background to create PTY
    timeout 2 script -q "$test_log" /bin/sh -c "tty; sleep 1" &>/dev/null &
    local script_pid=$!

    sleep 0.5

    # Check if process is running
    if kill -0 $script_pid 2>/dev/null; then
        print_info "PTY creation successful"
        kill $script_pid 2>/dev/null || true
        rm -f "$test_log"
        return 0
    else
        print_info "PTY creation failed"
        rm -f "$test_log"
        return 1
    fi
}

# Test 4: Test terminal size detection
test_terminal_size() {
    print_info "Testing terminal size detection..."

    if command -v tput &>/dev/null; then
        local rows=$(tput lines)
        local cols=$(tput cols)
        print_info "Current terminal size: ${rows}x${cols}"

        if [ "$rows" -gt 0 ] && [ "$cols" -gt 0 ]; then
            return 0
        fi
    fi

    print_info "Could not detect terminal size"
    return 1
}

# Test 5: Test stty functionality
test_stty_functionality() {
    print_info "Testing stty functionality..."

    local settings=$(stty -g 2>&1)
    if [ $? -eq 0 ]; then
        print_info "Current terminal settings: ${settings:0:50}..."
        return 0
    else
        print_info "Failed to get terminal settings"
        return 1
    fi
}

# Test 6: Check script permissions
test_script_permissions() {
    print_info "Checking script permissions..."

    local scripts=(
        "scripts/connect-vm-terminal.sh"
        "scripts/vm-terminal-resize.sh"
    )

    local all_executable=true

    for script in "${scripts[@]}"; do
        if [ -x "$script" ]; then
            print_info "✓ $script is executable"
        else
            print_info "✗ $script is not executable"
            all_executable=false
        fi
    done

    $all_executable
}

# Test 7: Test connect script syntax
test_connect_script_syntax() {
    print_info "Testing connect-vm-terminal.sh syntax..."

    if bash -n scripts/connect-vm-terminal.sh; then
        print_info "✓ Script syntax is valid"
        return 0
    else
        print_info "✗ Script has syntax errors"
        return 1
    fi
}

# Test 8: Test resize script syntax
test_resize_script_syntax() {
    print_info "Testing vm-terminal-resize.sh syntax..."

    if bash -n scripts/vm-terminal-resize.sh; then
        print_info "✓ Script syntax is valid"
        return 0
    else
        print_info "✗ Script has syntax errors"
        return 1
    fi
}

# Test 9: Test help output
test_help_output() {
    print_info "Testing help output..."

    if bash scripts/connect-vm-terminal.sh --help &>/dev/null; then
        print_info "✓ Help output works"
        return 0
    else
        print_info "✗ Help output failed"
        return 1
    fi
}

# Test 10: Test PTY list functionality
test_list_functionality() {
    print_info "Testing PTY list functionality..."

    if bash scripts/connect-vm-terminal.sh --list &>/dev/null; then
        print_info "✓ List functionality works"
        return 0
    else
        print_info "✗ List functionality failed"
        return 1
    fi
}

# Main test execution
main() {
    print_header "VibeCode PTY Functionality Tests"

    echo ""
    print_info "Starting PTY functionality tests..."
    echo ""

    # Run all tests
    run_test "PTY Device Creation" test_pty_device_creation
    run_test "Required Tools" test_required_tools
    run_test "Create PTY Pair" test_create_pty_pair
    run_test "Terminal Size Detection" test_terminal_size
    run_test "stty Functionality" test_stty_functionality
    run_test "Script Permissions" test_script_permissions
    run_test "Connect Script Syntax" test_connect_script_syntax
    run_test "Resize Script Syntax" test_resize_script_syntax
    run_test "Help Output" test_help_output
    run_test "List Functionality" test_list_functionality

    # Print summary
    echo ""
    print_header "Test Results"
    echo ""
    echo "Tests Run:    $TESTS_RUN"
    echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
    echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
    echo ""

    if [ $TESTS_FAILED -eq 0 ]; then
        print_pass "All tests passed!"
        echo ""
        print_info "PTY functionality is ready to use."
        print_info "Next steps:"
        echo "  1. Enable PTY in your VM manager: override func enablePTY() -> Bool { return true }"
        echo "  2. Start your VM"
        echo "  3. Connect with: bash scripts/connect-vm-terminal.sh --auto"
        echo ""
        exit 0
    else
        print_fail "Some tests failed. Please review the output above."
        echo ""
        exit 1
    fi
}

# Run tests
main
