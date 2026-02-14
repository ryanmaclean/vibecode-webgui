#!/usr/bin/env bash
# Common functions for VM integration tests

set -euo pipefail

# Test configuration
export QEMU_TIMEOUT=120
export BOOT_WAIT=30
export HEALTH_TIMEOUT=60
CACHE_DIR="${HOME}/.cache/vibecode-vm-tests"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Output functions
pass() { echo -e "${GREEN}✓ PASS${NC}: $1"; }
fail() { echo -e "${RED}✗ FAIL${NC}: $1"; exit 1; }
warn() { echo -e "${YELLOW}⚠ WARN${NC}: $1"; }
info() { echo -e "${BLUE}ℹ INFO${NC}: $1"; }

# Check if QEMU is installed
check_qemu() {
    if command -v qemu-system-x86_64 >/dev/null 2>&1; then
        info "QEMU found: $(qemu-system-x86_64 --version | head -1)"
        return 0
    else
        fail "QEMU not installed. Install with: brew install qemu"
    fi
}

# Check if KVM is available
check_kvm() {
    if [ -e /dev/kvm ]; then
        info "KVM acceleration available"
        return 0
    else
        warn "No KVM - tests will be slow (expected on macOS)"
        return 1
    fi
}

# Check if running on ARM64 (macOS M1/M2)
check_arch() {
    local arch
    arch=$(uname -m)
    if [ "$arch" = "arm64" ]; then
        info "Running on ARM64 (${arch})"
        return 0
    else
        info "Running on x86_64 (${arch})"
        return 1
    fi
}

# Download Alpine kernel if not cached
download_alpine_kernel() {
    local version="${1:-3.22}"
    local arch="${2:-x86_64}"

    mkdir -p "${CACHE_DIR}"

    local kernel_url="https://dl-cdn.alpinelinux.org/alpine/v${version}/releases/${arch}/alpine-virt-${version}.0-${arch}.iso"
    local kernel_file="${CACHE_DIR}/alpine-${version}-${arch}-kernel"
    local initramfs_file="${CACHE_DIR}/alpine-${version}-${arch}-initramfs"

    if [ -f "$kernel_file" ] && [ -f "$initramfs_file" ]; then
        info "Using cached kernel: ${kernel_file}"
        echo "$kernel_file"
        return 0
    fi

    info "Downloading Alpine kernel from ${kernel_url}..."

    local iso_file="${CACHE_DIR}/alpine-${version}-${arch}.iso"
    if ! curl -L -o "$iso_file" "$kernel_url" 2>/dev/null; then
        fail "Failed to download Alpine ISO"
    fi

    # Extract kernel and initramfs from ISO
    local mount_point="${CACHE_DIR}/alpine-iso-mount"
    mkdir -p "$mount_point"

    # On macOS, use hdiutil to mount ISO
    if [ "$(uname)" = "Darwin" ]; then
        local device
        device=$(hdiutil attach -nomount "$iso_file" | head -1 | awk '{print $1}')
        mount -t cd9660 "$device" "$mount_point" 2>/dev/null || {
            hdiutil detach "$device" 2>/dev/null
            fail "Failed to mount ISO"
        }

        cp "$mount_point/boot/vmlinuz-virt" "$kernel_file" || fail "Failed to extract kernel"
        cp "$mount_point/boot/initramfs-virt" "$initramfs_file" || fail "Failed to extract initramfs"

        hdiutil detach "$device" 2>/dev/null
    else
        # On Linux, use mount
        sudo mount -o loop "$iso_file" "$mount_point" 2>/dev/null || fail "Failed to mount ISO"

        cp "$mount_point/boot/vmlinuz-virt" "$kernel_file" || fail "Failed to extract kernel"
        cp "$mount_point/boot/initramfs-virt" "$initramfs_file" || fail "Failed to extract initramfs"

        sudo umount "$mount_point" 2>/dev/null
    fi

    rm -rf "$mount_point" "$iso_file"

    info "Kernel cached at: ${kernel_file}"
    echo "$kernel_file"
}

# Get QEMU binary for architecture
get_qemu_binary() {
    local arch="${1:-x86_64}"

    if [ "$arch" = "x86_64" ]; then
        echo "qemu-system-x86_64"
    elif [ "$arch" = "aarch64" ]; then
        echo "qemu-system-aarch64"
    else
        fail "Unsupported architecture: $arch"
    fi
}

# Build QEMU command line
build_qemu_cmd() {
    local kernel="$1"
    local initramfs="${2:-}"
    local disk="${3:-}"
    local arch="${4:-x86_64}"

    local qemu_bin
    qemu_bin=$(get_qemu_binary "$arch")
    local qemu_cmd=("$qemu_bin")

    # Basic configuration
    qemu_cmd+=(-nographic)
    qemu_cmd+=(-serial mon:stdio)
    qemu_cmd+=(-m 2048)
    qemu_cmd+=(-smp 2)

    # KVM acceleration if available
    if [ -e /dev/kvm ]; then
        qemu_cmd+=(-enable-kvm -cpu host)
    else
        qemu_cmd+=(-cpu max)
    fi

    # Kernel and initramfs
    qemu_cmd+=(-kernel "$kernel")
    if [ -n "$initramfs" ]; then
        qemu_cmd+=(-initrd "$initramfs")
    fi

    # Disk image if provided
    if [ -n "$disk" ]; then
        qemu_cmd+=(-drive "file=${disk},format=raw,if=virtio")
    fi

    # Kernel command line
    qemu_cmd+=(-append "console=ttyS0 quiet")

    echo "${qemu_cmd[@]}"
}

# Wait for string in output with timeout
wait_for_string() {
    local output_file="$1"
    local search_string="$2"
    local timeout="${3:-$BOOT_WAIT}"

    local elapsed=0
    while [ $elapsed -lt "$timeout" ]; do
        if grep -q "$search_string" "$output_file" 2>/dev/null; then
            return 0
        fi
        sleep 1
        elapsed=$((elapsed + 1))
    done

    return 1
}

# Check if port is open
check_port() {
    local host="${1:-localhost}"
    local port="$2"
    local timeout="${3:-5}"

    if command -v nc >/dev/null 2>&1; then
        timeout "$timeout" nc -z "$host" "$port" 2>/dev/null
        return $?
    else
        warn "netcat not available, skipping port check"
        return 1
    fi
}

# Create temporary output file
create_temp_output() {
    mktemp "${CACHE_DIR}/vm-test-output.XXXXXX"
}

# Cleanup function
cleanup() {
    local pid="$1"
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
        info "Stopping VM (PID: $pid)..."
        kill "$pid" 2>/dev/null || true
        wait "$pid" 2>/dev/null || true
    fi
}

# Export functions for use in other scripts
export -f pass fail warn info
export -f check_qemu check_kvm check_arch
export -f download_alpine_kernel get_qemu_binary build_qemu_cmd
export -f wait_for_string check_port create_temp_output cleanup
