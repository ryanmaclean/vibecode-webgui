#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

# VibeCode Development Menu
# Quick access to common operations

# Initialize log aggregation
init_log_aggregation


set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

show_menu() {
    clear
    cat << 'EOF'
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║                   VibeCode Dev Menu                       ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝

Development:
  1) Build and launch VibeCode
  2) Run Swift tests
  3) Run integration tests
  4) Clean build artifacts

VM Operations:
  5) Build VZ VMs (parallel)
  6) Build VZ VMs (sequential)
  7) Check VM status
  8) List Lima VMs

Testing:
  9) Run full test suite
  10) Run regression tests
  11) Run functional tests (VM launch)
  12) Run GUI tests (entitlements)
  13) Run service tests (connectivity)
  14) Run E2E with Datadog

Datadog:
  15) Test Datadog integration
  16) Start Lima VMs with Datadog

Utilities:
  17) View logs
  18) Check system requirements
  19) Git status

  0) Exit

EOF
    echo -n "Select option: "
}

build_and_launch() {
    echo "Building and launching VibeCode..."
    "$SCRIPT_DIR/launch-vibecode.sh"
}

run_swift_tests() {
    echo "Running Swift unit tests..."
    cd "$PROJECT_ROOT/VibeCodeSwift"
    swift test
}

run_integration_tests() {
    echo "Running integration tests..."
    "$SCRIPT_DIR/test-vibecode-vms.sh"
}

clean_build() {
    echo "Cleaning build artifacts..."
    cd "$PROJECT_ROOT/VibeCodeSwift"
    swift package clean
    rm -rf .build
    echo "Clean complete"
}

build_vms_parallel() {
    echo "Building VMs in parallel..."
    "$SCRIPT_DIR/run-with-secure-datadog-key.sh" "$SCRIPT_DIR/build-vz-vms-parallel.sh"
}

check_vm_status() {
    echo "VM Image Status:"
    echo "================"
    ls -lh "$PROJECT_ROOT/dist/vm-images"/*.img 2>/dev/null || echo "No VMs found"
    echo ""
    echo "EFI NVRAM Files:"
    ls -lh "$PROJECT_ROOT/dist/vm-images"/*-efi.nvram 2>/dev/null || echo "No NVRAM files found"
}

list_lima_vms() {
    echo "Lima VMs:"
    limactl list
}

run_full_tests() {
    echo "Running full test suite..."
    "$SCRIPT_DIR/regression-tests.sh"
    echo ""
    "$SCRIPT_DIR/test-vibecode-vms.sh"
    echo ""
    "$SCRIPT_DIR/functional-tests.sh"
    echo ""
    "$SCRIPT_DIR/test-gui.sh"
    echo ""
    "$SCRIPT_DIR/service-tests.sh"
    echo ""
    "$SCRIPT_DIR/test-e2e-with-datadog.sh"
    echo ""
    echo "Full test suite complete"
}

run_functional_tests() {
    echo "Running functional tests..."
    "$SCRIPT_DIR/functional-tests.sh"
}

run_service_tests() {
    echo "Running service tests..."
    "$SCRIPT_DIR/service-tests.sh"
}

test_datadog() {
    echo "Testing Datadog integration..."
    "$SCRIPT_DIR/run-with-secure-datadog-key.sh" "$SCRIPT_DIR/test-parallel-datadog.sh"
}

view_logs() {
    echo "Recent logs:"
    tail -50 "$PROJECT_ROOT/logs/vibecode.log" 2>/dev/null || echo "No logs found"
}

check_requirements() {
    echo "System Requirements Check:"
    echo "========================="
    echo "macOS version: $(sw_vers -productVersion)"
    echo "Swift version: $(swift --version | head -1)"
    echo "Xcode version: $(xcodebuild -version | head -1 || echo 'Not installed')"
    echo ""
    echo "Disk space in dist/vm-images:"
    du -sh "$PROJECT_ROOT/dist/vm-images" 2>/dev/null || echo "No VMs found"
    echo ""
    echo "Available disk space:"
    df -h "$PROJECT_ROOT" | tail -1
}

git_status() {
    cd "$PROJECT_ROOT"
    echo "Git Status:"
    git status --short
    echo ""
    echo "Current branch:"
    git branch --show-current
}

# Main loop
while true; do
    show_menu
    read -r choice
    
    case $choice in
        1) build_and_launch ;;
        2) run_swift_tests ;;
        3) run_integration_tests ;;
        4) clean_build ;;
        5) build_vms_parallel ;;
        6) echo "Sequential build not yet implemented" ;;
        7) check_vm_status ;;
        8) list_lima_vms ;;
        9) run_full_tests ;;
        10) "$SCRIPT_DIR/regression-tests.sh" ;;
        11) "$SCRIPT_DIR/functional-tests.sh" ;;
        12) "$SCRIPT_DIR/test-gui.sh" ;;
        13) "$SCRIPT_DIR/service-tests.sh" ;;
        14) "$SCRIPT_DIR/test-e2e-with-datadog.sh" ;;
        15) "$SCRIPT_DIR/test-all-datadog-solutions.sh" ;;
        16) "$SCRIPT_DIR/start-lima-vms-with-datadog.sh" ;;
        17) view_logs ;;
        18) check_requirements ;;
        19) git_status ;;
        0) echo "Exiting..."; exit 0 ;;
        *) echo "Invalid option" ;;
    esac
    
    echo ""
    echo "Press Enter to continue..."
    read -r
done

