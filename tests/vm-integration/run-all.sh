#!/usr/bin/env bash
# VM Integration Test Suite Entry Point
# Runs all tests or specific ones with configurable options

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/common.sh"

# Default configuration
ARCH="x86_64"
QUICK_MODE=0
VERBOSE=0
SPECIFIC_TEST=""

# Usage information
usage() {
    cat <<EOF
Usage: $0 [OPTIONS] [TEST]

Run VM integration tests for the VibeCode boot chain.

OPTIONS:
  --arch ARCH          Set architecture (x86_64 or aarch64, default: x86_64)
  --quick              Run in quick mode (skip slow tests)
  --verbose            Enable verbose output
  -h, --help           Show this help message

TEST:
  kernel-boot          Test kernel boot to login prompt
  initramfs            Test initramfs unpacking and init execution
  services             Test service startup (SSH, PostgreSQL, Valkey)
  boot-chain           Run full E2E test suite (default)

EXAMPLES:
  $0                           # Run all tests (x86_64)
  $0 --arch aarch64            # Run all tests on ARM64
  $0 kernel-boot               # Run only kernel boot test
  $0 --quick boot-chain        # Run quick boot chain tests
  $0 --verbose services        # Run services test with verbose output

EOF
    exit 0
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --arch)
            ARCH="$2"
            shift 2
            ;;
        --quick)
            QUICK_MODE=1
            shift
            ;;
        --verbose)
            VERBOSE=1
            shift
            ;;
        -h|--help)
            usage
            ;;
        kernel-boot|initramfs|services|boot-chain)
            SPECIFIC_TEST="$1"
            shift
            ;;
        *)
            warn "Unknown option: $1"
            usage
            ;;
    esac
done

# Validate architecture
if [ "$ARCH" != "x86_64" ] && [ "$ARCH" != "aarch64" ]; then
    fail "Unsupported architecture: ${ARCH} (must be x86_64 or aarch64)"
fi

# Display configuration
info "================================================"
info "VM Integration Test Suite"
info "================================================"
info "Architecture:  ${ARCH}"
info "Quick mode:    $([ $QUICK_MODE -eq 1 ] && echo 'Yes' || echo 'No')"
info "Verbose:       $([ $VERBOSE -eq 1 ] && echo 'Yes' || echo 'No')"
info "Test:          ${SPECIFIC_TEST:-all}"
info ""

# Check prerequisites
info "Checking prerequisites..."
check_qemu
check_kvm || true  # KVM is optional
check_arch

info ""

# Determine which test to run
if [ -n "$SPECIFIC_TEST" ]; then
    # Run specific test
    case "$SPECIFIC_TEST" in
        kernel-boot)
            info "Running kernel boot test..."
            exec "${SCRIPT_DIR}/test-kernel-boot.sh" "$ARCH"
            ;;
        initramfs)
            info "Running initramfs test..."
            exec "${SCRIPT_DIR}/test-initramfs.sh" "$ARCH"
            ;;
        services)
            if [ $QUICK_MODE -eq 1 ]; then
                warn "Skipping services test in quick mode"
                exit 0
            fi
            info "Running services test..."
            exec "${SCRIPT_DIR}/test-services.sh" "$ARCH"
            ;;
        boot-chain)
            info "Running full boot chain test..."
            exec "${SCRIPT_DIR}/test-boot-chain.sh" "$ARCH"
            ;;
    esac
else
    # Run all tests via boot-chain orchestrator
    info "Running all tests..."
    exec "${SCRIPT_DIR}/test-boot-chain.sh" "$ARCH"
fi
