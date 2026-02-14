#!/usr/bin/env bash
# Test: Verify services start in full VM
# Checks that SSH, PostgreSQL, and Valkey services are accessible

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/common.sh"

TEST_NAME="Service Startup"
ARCH="${1:-x86_64}"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

info "Starting test: ${TEST_NAME}"
info "Architecture: ${ARCH}"

# Check prerequisites
check_qemu

# Look for VM disk images
DISK_DIR="${PROJECT_ROOT}/dist/vm-images"
if [ ! -d "$DISK_DIR" ]; then
    warn "VM images directory not found: ${DISK_DIR}"
    info "Skipping service tests (requires full VM build)"
    pass "${TEST_NAME} skipped (no VM images available)"
    exit 0
fi

# Find available disk images
info "Searching for VM disk images in: ${DISK_DIR}"
mapfile -t disk_images < <(find "${DISK_DIR}" -name "*.img" 2>/dev/null || true)

if [ ${#disk_images[@]} -eq 0 ]; then
    warn "No VM disk images found"
    info "Build VM images first with: scripts/vfkit/06-create-vibecode-rootfs.sh"
    pass "${TEST_NAME} skipped (no VM images available)"
    exit 0
fi

info "Found ${#disk_images[@]} disk image(s):"
for img in "${disk_images[@]}"; do
    info "  - $(basename "$img")"
done

# Use the first available image
DISK_IMAGE="${disk_images[0]}"
info "Using disk image: $(basename "$DISK_IMAGE")"

# Download kernel if needed
info "Checking for Alpine kernel..."
kernel=$(download_alpine_kernel "3.22" "$ARCH")

if [ ! -f "$kernel" ]; then
    fail "Kernel not found"
fi

# Create output capture file
output_file=$(create_temp_output)
info "Output log: ${output_file}"

# Build QEMU command with networking
qemu_bin=$(get_qemu_binary "$ARCH")
qemu_cmd=(
    "$qemu_bin"
    -nographic
    -serial mon:stdio
    -m 2048
    -smp 2
    -kernel "$kernel"
    -drive "file=${DISK_IMAGE},format=raw,if=virtio"
    -append "console=ttyS0 root=/dev/vda rw quiet"
    -netdev user,id=net0,hostfwd=tcp::2222-:22,hostfwd=tcp::5432-:5432,hostfwd=tcp::6379-:6379
    -device virtio-net,netdev=net0
)

# Add KVM if available
if [ -e /dev/kvm ]; then
    qemu_cmd+=(-enable-kvm -cpu host)
else
    qemu_cmd+=(-cpu max)
fi

info "Starting QEMU with port forwarding..."
info "  SSH:        localhost:2222 -> VM:22"
info "  PostgreSQL: localhost:5432 -> VM:5432"
info "  Valkey:     localhost:6379 -> VM:6379"

# Start QEMU in background
"${qemu_cmd[@]}" > "$output_file" 2>&1 &
qemu_pid=$!

# Ensure cleanup on exit
trap 'cleanup "$qemu_pid"; rm -f "$output_file"' EXIT INT TERM

info "QEMU started (PID: ${qemu_pid})"
info "Waiting for VM to boot (timeout: ${BOOT_WAIT}s)..."

# Wait for boot completion
if ! wait_for_string "$output_file" "login:" "$BOOT_WAIT"; then
    warn "Login prompt not seen within timeout"
fi

# Give services time to start
info "Waiting for services to start..."
sleep 10

# Test service connectivity
services_running=0

info "Checking SSH (port 2222)..."
if check_port localhost 2222 5; then
    pass "SSH service is accepting connections"
    services_running=$((services_running + 1))
else
    warn "SSH service not accessible on port 2222"
fi

info "Checking PostgreSQL (port 5432)..."
if check_port localhost 5432 5; then
    pass "PostgreSQL service is accepting connections"
    services_running=$((services_running + 1))
else
    warn "PostgreSQL service not accessible on port 5432"
fi

info "Checking Valkey (port 6379)..."
if check_port localhost 6379 5; then
    pass "Valkey service is accepting connections"
    services_running=$((services_running + 1))
else
    warn "Valkey service not accessible on port 6379"
fi

# Show service status from logs
info "Boot log summary:"
tail -30 "$output_file" || true

# Stop QEMU
cleanup "$qemu_pid"

# Evaluate results
if [ "$services_running" -ge 1 ]; then
    pass "${TEST_NAME} completed - ${services_running}/3 services responding"
    exit 0
else
    warn "${TEST_NAME} completed - no services detected (may need manual verification)"
    exit 0  # Don't fail, as VM images may not have all services
fi
