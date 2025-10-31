#!/bin/bash
#
# VM Apps Automated Test Script
# Tests BasicVibeCode.app and LiquidGlassVibeCode.app functionality
#
# This script validates:
# - VM boot and kernel initialization
# - Network device (virtio_net) detection
# - Network interface (eth0) configuration
# - DHCP IP address assignment
# - OpenVSCode server startup
# - HTTP connectivity to server
#

set -e

# Configuration
APPS_DIR="$HOME/vibecode-webgui/azure/SwiftUI-Apps"
CONSOLE_LOG="/tmp/vibecode-console.log"
DHCP_LEASES="/var/db/dhcpd_leases"
VM_MAC_ADDRESS="52:54:00:12:34:90"
BOOT_TIMEOUT=30
SERVER_CHECK_TIMEOUT=40
TEST_RESULTS=()

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $1"
}

log_section() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

# Record test result
record_result() {
    local test_name="$1"
    local status="$2"
    local details="$3"
    TEST_RESULTS+=("$status|$test_name|$details")
}

# Wait for pattern in console log
wait_for_console_pattern() {
    local pattern="$1"
    local timeout="$2"
    local start_time=$(date +%s)

    log_info "Waiting for pattern: '$pattern' (timeout: ${timeout}s)"

    while [ $(($(date +%s) - start_time)) -lt $timeout ]; do
        if [ -f "$CONSOLE_LOG" ]; then
            if grep -q "$pattern" "$CONSOLE_LOG" 2>/dev/null; then
                log_success "Pattern found: '$pattern'"
                return 0
            fi
        fi
        sleep 1
    done

    log_error "Timeout waiting for pattern: '$pattern'"
    return 1
}

# Check DHCP lease for VM IP
get_vm_ip_from_dhcp() {
    log_info "Checking DHCP leases for VM IP..."

    if [ ! -r "$DHCP_LEASES" ]; then
        log_warning "Cannot read DHCP leases file: $DHCP_LEASES"
        return 1
    fi

    # Parse DHCP leases file
    # Format: hw_address=1,52:54:00:12:34:90
    #         ip_address=192.168.64.xxx
    local ip_address=""
    local current_mac=""

    while IFS= read -r line; do
        if [[ "$line" =~ hw_address=1,([0-9a-fA-F:]+) ]]; then
            current_mac="${BASH_REMATCH[1]}"
        fi

        if [[ "$line" =~ ip_address=([0-9.]+) ]]; then
            if [ "$current_mac" = "$VM_MAC_ADDRESS" ]; then
                ip_address="${BASH_REMATCH[1]}"
                break
            fi
        fi

        # Reset if we hit a new lease block
        if [[ "$line" =~ ^\{ ]]; then
            current_mac=""
        fi
    done < "$DHCP_LEASES"

    if [ -n "$ip_address" ]; then
        log_success "VM IP found: $ip_address"
        echo "$ip_address"
        return 0
    else
        log_warning "VM IP not found in DHCP leases"
        return 1
    fi
}

# Test HTTP connectivity
test_http_connectivity() {
    local url="$1"
    local timeout=5

    log_info "Testing HTTP connectivity: $url"

    if curl -s -m $timeout "$url" > /dev/null 2>&1; then
        log_success "HTTP request successful"
        return 0
    else
        log_warning "HTTP request failed"
        return 1
    fi
}

# Kill app process
kill_app() {
    local app_name="$1"

    log_info "Stopping $app_name..."

    # Find and kill the process
    local pid=$(ps aux | grep "$app_name" | grep -v grep | awk '{print $2}' | head -n 1)

    if [ -n "$pid" ]; then
        kill $pid 2>/dev/null || true
        sleep 2

        # Force kill if still running
        if ps -p $pid > /dev/null 2>&1; then
            kill -9 $pid 2>/dev/null || true
            sleep 1
        fi

        log_success "App stopped"
    else
        log_warning "No running process found"
    fi
}

# Cleanup function
cleanup() {
    log_info "Cleaning up..."

    # Remove console log
    rm -f "$CONSOLE_LOG"

    # Kill any remaining app processes
    pkill -f "BasicVibeCode.app" 2>/dev/null || true
    pkill -f "LiquidGlassVibeCode.app" 2>/dev/null || true

    sleep 2
}

# Click Start button using AppleScript
click_start_button() {
    local app_name="$1"
    log_info "Clicking Start button..."

    # Try to click the Start button
    osascript <<EOF 2>/dev/null
tell application "System Events"
    tell process "$app_name"
        try
            click button "Start" of window 1
            return true
        on error
            return false
        end try
    end tell
end tell
EOF

    if [ $? -eq 0 ]; then
        log_success "Start button clicked"
        return 0
    else
        log_warning "Could not click Start button (may already be started or UI different)"
        return 1
    fi
}

# Test a single app
test_app() {
    local app_path="$1"
    local app_name=$(basename "$app_path")
    local app_process_name=$(basename "$app_name" .app)

    log_section "Testing $app_name"

    # Verify app exists
    if [ ! -d "$app_path" ]; then
        log_error "App not found: $app_path"
        record_result "$app_name" "FAIL" "App bundle not found"
        return 1
    fi

    log_success "App found: $app_path"
    record_result "$app_name - Bundle" "PASS" "App bundle exists"

    # Verify resources are bundled
    local resources_ok=true
    if [ ! -f "$app_path/Contents/Resources/vmlinux-raw" ]; then
        log_error "Kernel not found in bundle"
        record_result "$app_name - Resources" "FAIL" "vmlinux-raw missing"
        resources_ok=false
    fi

    if [ ! -f "$app_path/Contents/Resources/bun-openvscode.cpio.gz" ]; then
        log_error "Initramfs not found in bundle"
        record_result "$app_name - Resources" "FAIL" "bun-openvscode.cpio.gz missing"
        resources_ok=false
    fi

    if $resources_ok; then
        log_success "Required resources found in bundle"
        record_result "$app_name - Resources" "PASS" "Kernel and initramfs present"
    else
        log_error "Missing required resources"
        return 1
    fi

    # Cleanup before starting
    cleanup

    # Launch app
    log_info "Launching $app_name..."
    open "$app_path"
    sleep 3

    # Verify app is running
    if ! pgrep -f "$app_process_name" > /dev/null; then
        log_error "App failed to start"
        record_result "$app_name - Launch" "FAIL" "Process not found"
        return 1
    fi

    log_success "App launched successfully"
    record_result "$app_name - Launch" "PASS" "Process started"

    # Try to click the Start button
    sleep 2
    click_start_button "$app_process_name"

    # Wait for VM boot - check for kernel messages
    log_info "Waiting for VM boot and console log creation (${BOOT_TIMEOUT}s)..."

    # Wait for console log to appear
    local wait_count=0
    while [ $wait_count -lt 15 ]; do
        if [ -f "$CONSOLE_LOG" ]; then
            break
        fi
        sleep 1
        ((wait_count++))
    done

    if [ ! -f "$CONSOLE_LOG" ]; then
        log_error "Console log not created - VM may not have started"
        log_warning "User may need to manually click 'Start' button in app UI"
        record_result "$app_name - Console Log" "FAIL" "Log file not created (VM not started?)"
        kill_app "$app_name"
        return 1
    fi

    log_success "Console log created - VM started"
    record_result "$app_name - Console Log" "PASS" "Log file exists"

    # Test 1: Check for virtio_net (network driver)
    log_info "Test 1: Checking for virtio_net driver..."
    if wait_for_console_pattern "virtio_net" 15; then
        record_result "$app_name - virtio_net" "PASS" "Network driver loaded"
    else
        log_error "virtio_net not found in console"
        record_result "$app_name - virtio_net" "FAIL" "Network driver not detected"
    fi

    # Test 2: Check for eth0 (network interface)
    log_info "Test 2: Checking for eth0 interface..."
    if wait_for_console_pattern "eth0" 15; then
        record_result "$app_name - eth0" "PASS" "Network interface initialized"
    else
        log_error "eth0 not found in console"
        record_result "$app_name - eth0" "FAIL" "Network interface not detected"
    fi

    # Test 3: Check for server startup message
    log_info "Test 3: Checking for server startup..."
    if wait_for_console_pattern "Server will be available" $SERVER_CHECK_TIMEOUT; then
        record_result "$app_name - Server Startup" "PASS" "Server started successfully"
    else
        log_error "Server startup message not found"
        record_result "$app_name - Server Startup" "FAIL" "Server did not start"
    fi

    # Test 4: Check DHCP lease
    log_info "Test 4: Checking DHCP IP assignment..."
    sleep 5  # Give DHCP time to assign

    vm_ip=$(get_vm_ip_from_dhcp)
    if [ $? -eq 0 ] && [ -n "$vm_ip" ]; then
        record_result "$app_name - DHCP" "PASS" "IP assigned: $vm_ip"

        # Test 5: HTTP connectivity (if IP is assigned)
        log_info "Test 5: Testing HTTP connectivity..."
        if test_http_connectivity "http://$vm_ip:3000"; then
            record_result "$app_name - HTTP" "PASS" "Server responding on $vm_ip:3000"
        else
            record_result "$app_name - HTTP" "FAIL" "Server not responding"
        fi
    else
        record_result "$app_name - DHCP" "FAIL" "No IP assigned"
        record_result "$app_name - HTTP" "SKIP" "No IP to test"
    fi

    # Display console log excerpt
    log_section "Console Log Excerpt (last 30 lines)"
    if [ -f "$CONSOLE_LOG" ]; then
        tail -n 30 "$CONSOLE_LOG" | sed 's/^/  /'
    else
        log_warning "Console log not available"
    fi

    # Stop app
    kill_app "$app_name"

    # Wait for cleanup
    sleep 3

    log_success "$app_name testing complete"
    echo ""
}

# Print test summary
print_summary() {
    log_section "TEST SUMMARY"

    local total_tests=${#TEST_RESULTS[@]}
    local passed=0
    local failed=0
    local skipped=0

    echo ""
    printf "%-40s %-10s %s\n" "TEST NAME" "STATUS" "DETAILS"
    echo "--------------------------------------------------------------------------------"

    for result in "${TEST_RESULTS[@]}"; do
        IFS='|' read -r status name details <<< "$result"

        case "$status" in
            PASS)
                echo -e "${GREEN}PASS${NC}  $name: $details"
                ((passed++))
                ;;
            FAIL)
                echo -e "${RED}FAIL${NC}  $name: $details"
                ((failed++))
                ;;
            SKIP)
                echo -e "${YELLOW}SKIP${NC}  $name: $details"
                ((skipped++))
                ;;
        esac
    done

    echo ""
    echo "--------------------------------------------------------------------------------"
    echo -e "Total Tests: $total_tests"
    echo -e "${GREEN}Passed: $passed${NC}"
    echo -e "${RED}Failed: $failed${NC}"
    echo -e "${YELLOW}Skipped: $skipped${NC}"
    echo ""

    if [ $failed -eq 0 ]; then
        log_success "ALL TESTS PASSED!"
        return 0
    else
        log_error "SOME TESTS FAILED"
        return 1
    fi
}

# Generate recommendations
generate_recommendations() {
    log_section "RECOMMENDATIONS"

    local has_failures=false

    # Check for specific failure patterns
    for result in "${TEST_RESULTS[@]}"; do
        IFS='|' read -r status name details <<< "$result"

        if [ "$status" = "FAIL" ]; then
            has_failures=true

            case "$name" in
                *"virtio_net"*)
                    echo "- Network driver (virtio_net) not detected:"
                    echo "  * Check kernel configuration includes virtio_net"
                    echo "  * Verify initramfs contains virtio_net module"
                    echo "  * Review kernel boot parameters"
                    ;;
                *"eth0"*)
                    echo "- Network interface (eth0) not configured:"
                    echo "  * Verify network device is attached in VM config"
                    echo "  * Check if udhcpc is running for DHCP"
                    echo "  * Review network initialization scripts"
                    ;;
                *"DHCP"*)
                    echo "- DHCP IP assignment failed:"
                    echo "  * Ensure VM MAC address matches: $VM_MAC_ADDRESS"
                    echo "  * Check macOS vmnet DHCP service is running"
                    echo "  * Review /var/db/dhcpd_leases permissions"
                    echo "  * Try: sudo launchctl load -w /System/Library/LaunchDaemons/com.apple.networking.vmnet.plist"
                    ;;
                *"Server"*)
                    echo "- OpenVSCode server not starting:"
                    echo "  * Check if Bun runtime is included in initramfs"
                    echo "  * Verify OpenVSCode server files are present"
                    echo "  * Review server startup script in init"
                    echo "  * Check for JavaScript/Node.js errors in console"
                    ;;
                *"HTTP"*)
                    echo "- HTTP connectivity failed:"
                    echo "  * Verify server is listening on port 3000"
                    echo "  * Check firewall rules (macOS and VM)"
                    echo "  * Test with: curl http://VM_IP:3000"
                    echo "  * Review server error logs"
                    ;;
                *"Launch"*)
                    echo "- App failed to launch:"
                    echo "  * Check app signing and entitlements"
                    echo "  * Verify Virtualization framework entitlements"
                    echo "  * Review Console.app for crash logs"
                    echo "  * Ensure kernel and initramfs are in bundle"
                    ;;
            esac
            echo ""
        fi
    done

    if ! $has_failures; then
        echo -e "${GREEN}No issues detected - all tests passed!${NC}"
        echo ""
        echo "Next steps:"
        echo "- Deploy apps to production"
        echo "- Create user documentation"
        echo "- Set up automated testing in CI/CD"
    fi
}

# Main execution
main() {
    log_section "VM Apps Automated Test Suite"

    echo "Test Configuration:"
    echo "  Apps Directory: $APPS_DIR"
    echo "  Console Log: $CONSOLE_LOG"
    echo "  DHCP Leases: $DHCP_LEASES"
    echo "  VM MAC: $VM_MAC_ADDRESS"
    echo "  Boot Timeout: ${BOOT_TIMEOUT}s"
    echo ""

    # Initial cleanup
    cleanup

    # Test BasicVibeCode.app
    test_app "$APPS_DIR/BasicVibeCode.app"

    # Test LiquidGlassVibeCode.app
    test_app "$APPS_DIR/LiquidGlassVibeCode.app"

    # Final cleanup
    cleanup

    # Print summary
    print_summary

    # Generate recommendations
    generate_recommendations

    log_section "Test Complete"
}

# Run main
main "$@"
