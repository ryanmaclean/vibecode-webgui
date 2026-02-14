#!/usr/bin/env bash
# Test: Verify initramfs unpacks and /init executes
# Validates that the initramfs is correctly loaded and the init process starts

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/common.sh"

TEST_NAME="Initramfs Unpack"
ARCH="${1:-x86_64}"

info "Starting test: ${TEST_NAME}"
info "Architecture: ${ARCH}"

# Check prerequisites
check_qemu

# Download kernel if needed
info "Checking for Alpine kernel and initramfs..."
kernel=$(download_alpine_kernel "3.22" "$ARCH")
initramfs="${kernel/kernel/initramfs}"

if [ ! -f "$kernel" ] || [ ! -f "$initramfs" ]; then
    fail "Kernel or initramfs not found"
fi

info "Kernel: ${kernel}"
info "Initramfs: ${initramfs}"

# Verify initramfs is not empty
initramfs_size=$(stat -f%z "$initramfs" 2>/dev/null || stat -c%s "$initramfs" 2>/dev/null)
if [ "$initramfs_size" -lt 1000000 ]; then
    fail "Initramfs too small (${initramfs_size} bytes) - may be corrupted"
fi

info "Initramfs size: $(numfmt --to=iec-i --suffix=B "$initramfs_size" 2>/dev/null || echo "${initramfs_size} bytes")"

# Create output capture file
output_file=$(create_temp_output)
info "Output log: ${output_file}"

# Build QEMU command with verbose boot
qemu_bin=$(get_qemu_binary "$ARCH")
qemu_cmd=(
    "$qemu_bin"
    -nographic
    -serial mon:stdio
    -m 2048
    -smp 2
    -kernel "$kernel"
    -initrd "$initramfs"
    -append "console=ttyS0 debug initcall_debug loglevel=7"
)

# Add KVM if available
if [ -e /dev/kvm ]; then
    qemu_cmd+=(-enable-kvm -cpu host)
else
    qemu_cmd+=(-cpu max)
fi

info "Starting QEMU with debug logging..."

# Start QEMU in background
"${qemu_cmd[@]}" > "$output_file" 2>&1 &
qemu_pid=$!

# Ensure cleanup on exit
trap 'cleanup "$qemu_pid"; rm -f "$output_file"' EXIT INT TERM

info "QEMU started (PID: ${qemu_pid})"
info "Waiting for initramfs messages (timeout: ${BOOT_WAIT}s)..."

sleep 3  # Give kernel time to start

# Check for initramfs unpack messages
initramfs_checks=0

if wait_for_string "$output_file" "Unpacking initramfs" 10; then
    pass "Initramfs unpacking started"
    initramfs_checks=$((initramfs_checks + 1))
else
    warn "Initramfs unpack message not found (may not be logged)"
fi

if wait_for_string "$output_file" "Freeing initrd memory" 15; then
    pass "Initramfs loaded and freed"
    initramfs_checks=$((initramfs_checks + 1))
else
    warn "Initramfs free message not found"
fi

# Check for init execution
if wait_for_string "$output_file" "/init" 10; then
    pass "/init process started"
    initramfs_checks=$((initramfs_checks + 1))
else
    warn "/init message not found in logs"
fi

# Check for successful rootfs mount
if wait_for_string "$output_file" "mounted root" 10; then
    pass "Root filesystem mounted"
    initramfs_checks=$((initramfs_checks + 1))
else
    warn "Root mount message not found"
fi

# Wait a bit longer for full boot
sleep 5

# Check final boot state
if wait_for_string "$output_file" "Welcome to Alpine Linux" 5; then
    pass "Alpine Linux userspace reached"
    initramfs_checks=$((initramfs_checks + 1))
elif wait_for_string "$output_file" "login:" 5; then
    pass "Login prompt reached (init successful)"
    initramfs_checks=$((initramfs_checks + 1))
fi

# Show relevant log excerpts
info "Boot log excerpts:"
grep -i "initramfs\|init\|mounted root" "$output_file" 2>/dev/null | head -20 || warn "No initramfs messages in log"

# Stop QEMU
cleanup "$qemu_pid"

# Evaluate results
if [ "$initramfs_checks" -ge 2 ]; then
    pass "${TEST_NAME} completed successfully (${initramfs_checks} checks passed)"
    exit 0
else
    fail "${TEST_NAME} failed (only ${initramfs_checks} checks passed)"
fi
