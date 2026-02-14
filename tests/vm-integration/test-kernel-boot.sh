#!/usr/bin/env bash
# Test: Verify kernel boots to init
# Validates that the Alpine kernel can boot and reach a login prompt

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/common.sh"

TEST_NAME="Kernel Boot"
ARCH="${1:-x86_64}"

info "Starting test: ${TEST_NAME}"
info "Architecture: ${ARCH}"

# Check prerequisites
check_qemu

# Download kernel if needed
info "Checking for Alpine kernel..."
kernel=$(download_alpine_kernel "3.22" "$ARCH")
initramfs="${kernel/kernel/initramfs}"

if [ ! -f "$kernel" ] || [ ! -f "$initramfs" ]; then
    fail "Kernel or initramfs not found"
fi

info "Kernel: ${kernel}"
info "Initramfs: ${initramfs}"

# Create output capture file
output_file=$(create_temp_output)
info "Output log: ${output_file}"

# Build QEMU command
qemu_bin=$(get_qemu_binary "$ARCH")
qemu_cmd=(
    "$qemu_bin"
    -nographic
    -serial mon:stdio
    -m 2048
    -smp 2
    -kernel "$kernel"
    -initrd "$initramfs"
    -append "console=ttyS0 quiet"
)

# Add KVM if available
if [ -e /dev/kvm ]; then
    qemu_cmd+=(-enable-kvm -cpu host)
else
    qemu_cmd+=(-cpu max)
fi

info "Starting QEMU..."
info "Command: ${qemu_cmd[*]}"

# Start QEMU in background
"${qemu_cmd[@]}" > "$output_file" 2>&1 &
qemu_pid=$!

# Ensure cleanup on exit
trap 'cleanup "$qemu_pid"; rm -f "$output_file"' EXIT INT TERM

info "QEMU started (PID: ${qemu_pid})"
info "Waiting for boot messages (timeout: ${BOOT_WAIT}s)..."

# Wait for boot messages
if wait_for_string "$output_file" "Welcome to Alpine Linux" "$BOOT_WAIT"; then
    pass "Kernel booted successfully - 'Welcome to Alpine Linux' message found"
    boot_success=1
elif wait_for_string "$output_file" "login:" "$BOOT_WAIT"; then
    pass "Kernel booted successfully - login prompt reached"
    boot_success=1
else
    warn "Boot messages not found within timeout"
    info "Checking output for errors..."

    if grep -i "kernel panic" "$output_file" 2>/dev/null; then
        fail "Kernel panic detected"
    elif grep -i "error" "$output_file" 2>/dev/null; then
        warn "Errors found in output (may be non-fatal)"
        boot_success=0
    else
        warn "No obvious errors, but boot messages not detected"
        boot_success=0
    fi
fi

# Show last few lines of output
info "Last 10 lines of output:"
tail -10 "$output_file" || true

# Stop QEMU
cleanup "$qemu_pid"

if [ "${boot_success:-0}" -eq 1 ]; then
    pass "${TEST_NAME} completed successfully"
    exit 0
else
    fail "${TEST_NAME} did not complete successfully"
fi
