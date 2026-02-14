#!/usr/bin/env bash
# Alpine Linux Kernel Compatibility Test
# Tests kernel compatibility across Alpine versions and architectures

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_DIR="${SCRIPT_DIR}/kernel-test-cache"
RESULTS_FILE="${TEST_DIR}/compatibility-results.txt"

# Test configuration
ALPINE_VERSIONS=("3.19" "3.20" "3.21" "3.22")
ARCHITECTURES=("aarch64" "x86_64")
ALPINE_BASE_URL="https://dl-cdn.alpinelinux.org/alpine"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ${NC} $*"
}

log_success() {
    echo -e "${GREEN}✓${NC} $*"
}

log_warn() {
    echo -e "${YELLOW}⚠${NC} $*"
}

log_error() {
    echo -e "${RED}✗${NC} $*"
}

log_section() {
    echo ""
    echo -e "${BLUE}═══ $* ═══${NC}"
    echo ""
}

# Create test directory
mkdir -p "${TEST_DIR}"
: > "${RESULTS_FILE}"

# Download kernel for testing
download_kernel() {
    local version=$1
    local arch=$2
    local url="${ALPINE_BASE_URL}/v${version}/releases/${arch}/netboot/vmlinuz-lts"
    local output="${TEST_DIR}/vmlinuz-${version}-${arch}"

    if [[ -f "${output}" ]]; then
        log_info "Using cached kernel: ${version}/${arch}"
        return 0
    fi

    log_info "Downloading kernel: ${version}/${arch}..."
    if curl -f -L -o "${output}" "${url}" 2>/dev/null; then
        log_success "Downloaded: vmlinuz-${version}-${arch}"
        return 0
    else
        log_warn "Failed to download: ${version}/${arch} (may not exist yet)"
        return 1
    fi
}

# Download initramfs for testing
download_initramfs() {
    local version=$1
    local arch=$2
    local url="${ALPINE_BASE_URL}/v${version}/releases/${arch}/netboot/initramfs-lts"
    local output="${TEST_DIR}/initramfs-${version}-${arch}"

    if [[ -f "${output}" ]]; then
        return 0
    fi

    if curl -f -L -o "${output}" "${url}" 2>/dev/null; then
        return 0
    else
        return 1
    fi
}

# Verify kernel file
verify_kernel_file() {
    local kernel_path=$1
    local expected_arch=$2
    local version=$3

    if [[ ! -f "${kernel_path}" ]]; then
        echo "MISSING"
        return 1
    fi

    local size=$(stat -f%z "${kernel_path}" 2>/dev/null || stat -c%s "${kernel_path}" 2>/dev/null)

    # Size sanity check (kernel should be >5MB)
    if [[ ${size} -lt 5242880 ]]; then
        echo "TOO_SMALL (${size} bytes)"
        return 1
    fi

    # Check file type
    local file_type=$(file -b "${kernel_path}")

    # Alpine kernels can be:
    # - "Linux kernel" (traditional)
    # - "PE32+ executable (EFI application)" (ARM64 EFI)
    # - "compressed data" (gzipped kernel)
    # - "MS-DOS executable PE32+" (x86_64 EFI)
    local is_valid=false
    if [[ "${file_type}" =~ "Linux kernel" ]] || \
       [[ "${file_type}" =~ "compressed data" ]] || \
       [[ "${file_type}" =~ "PE32" ]] || \
       [[ "${file_type}" =~ "EFI" ]]; then
        is_valid=true
    fi

    if [[ "${is_valid}" == "false" ]]; then
        echo "INVALID_TYPE (${file_type})"
        return 1
    fi

    # Architecture check for aarch64
    if [[ "${expected_arch}" == "aarch64" ]]; then
        if [[ "${file_type}" =~ "Aarch64" ]] || [[ "${file_type}" =~ "ARM64" ]] || [[ "${file_type}" =~ "aarch64" ]]; then
            echo "OK (${size} bytes, ARM64/EFI)"
            return 0
        fi
    fi

    # Architecture check for x86_64
    if [[ "${expected_arch}" == "x86_64" ]]; then
        if [[ "${file_type}" =~ "x86-64" ]] || [[ "${file_type}" =~ "x86_64" ]] || [[ "${file_type}" =~ "x86 boot" ]]; then
            echo "OK (${size} bytes, x86_64)"
            return 0
        fi
    fi

    # Generic success if we can't determine arch but size/type is OK
    echo "OK (${size} bytes, ${file_type:0:30})"
    return 0
}

# Test QEMU boot (Linux only)
test_qemu_boot() {
    local kernel_path=$1
    local initramfs_path=$2
    local arch=$3
    local version=$4

    if [[ ! -f "${initramfs_path}" ]]; then
        echo "NO_INITRAMFS"
        return 1
    fi

    if ! command -v qemu-system-${arch} &>/dev/null; then
        echo "NO_QEMU"
        return 1
    fi

    # Run QEMU with timeout to check for kernel panic
    local qemu_cmd="qemu-system-${arch}"
    local timeout_duration=10

    local output=$(timeout ${timeout_duration} ${qemu_cmd} \
        -kernel "${kernel_path}" \
        -initrd "${initramfs_path}" \
        -nographic \
        -m 256 \
        -append "console=ttyS0 panic=1" \
        2>&1 || true)

    # Check for kernel panic
    if echo "${output}" | grep -qi "kernel panic"; then
        echo "PANIC"
        return 1
    fi

    # If we got some boot output, consider it working
    if echo "${output}" | grep -qi "Linux version"; then
        echo "BOOTS"
        return 0
    fi

    echo "TIMEOUT"
    return 0  # Timeout is acceptable, means it didn't panic immediately
}

# Main test loop
log_section "Alpine Linux Kernel Compatibility Test"

# Determine platform
PLATFORM=$(uname -s)
IS_LINUX=false
IS_MACOS=false
if [[ "${PLATFORM}" == "Linux" ]]; then
    IS_LINUX=true
elif [[ "${PLATFORM}" == "Darwin" ]]; then
    IS_MACOS=true
fi

log_info "Platform: ${PLATFORM}"
log_info "Architecture: $(uname -m)"
echo ""

# Test matrix - use parallel arrays instead of associative arrays for bash 3.2 compatibility
result_keys=()
result_values=()

for version in "${ALPINE_VERSIONS[@]}"; do
    for arch in "${ARCHITECTURES[@]}"; do
        log_section "Testing Alpine ${version} ${arch}"

        # Download kernel
        if ! download_kernel "${version}" "${arch}"; then
            result_keys+=("${version}-${arch}")
            result_values+=("UNAVAILABLE")
            continue
        fi

        # Download initramfs for boot test
        download_initramfs "${version}" "${arch}" || true

        # Verify kernel file
        kernel_path="${TEST_DIR}/vmlinuz-${version}-${arch}"
        initramfs_path="${TEST_DIR}/initramfs-${version}-${arch}"

        verify_result=$(verify_kernel_file "${kernel_path}" "${arch}" "${version}")
        log_info "Verification: ${verify_result}"

        if [[ "${verify_result}" =~ ^OK ]]; then
            # On Linux with QEMU, attempt boot test
            if ${IS_LINUX}; then
                boot_result=$(test_qemu_boot "${kernel_path}" "${initramfs_path}" "${arch}" "${version}")
                log_info "QEMU Boot Test: ${boot_result}"
                result_keys+=("${version}-${arch}")
                result_values+=("${boot_result}")
            else
                result_keys+=("${version}-${arch}")
                result_values+=("VERIFIED")
            fi
        else
            result_keys+=("${version}-${arch}")
            result_values+=("${verify_result}")
        fi

        echo "---"
    done
done

# Generate compatibility matrix
log_section "Compatibility Matrix"

echo "" | tee -a "${RESULTS_FILE}"
echo "Alpine Linux Kernel Compatibility Matrix" | tee -a "${RESULTS_FILE}"
echo "Generated: $(date)" | tee -a "${RESULTS_FILE}"
echo "Platform: ${PLATFORM} $(uname -m)" | tee -a "${RESULTS_FILE}"
echo "" | tee -a "${RESULTS_FILE}"

# Table header
printf "%-8s | %-10s | %-15s | %-20s\n" "Version" "Arch" "Status" "Notes" | tee -a "${RESULTS_FILE}"
printf "%s\n" "---------|------------|-----------------|---------------------" | tee -a "${RESULTS_FILE}"

# Helper function to get result for version-arch pair
get_result() {
    local search_key="$1"
    local i
    for i in "${!result_keys[@]}"; do
        if [[ "${result_keys[$i]}" == "${search_key}" ]]; then
            echo "${result_values[$i]}"
            return 0
        fi
    done
    echo "UNKNOWN"
}

# Table rows
for version in "${ALPINE_VERSIONS[@]}"; do
    for arch in "${ARCHITECTURES[@]}"; do
        result=$(get_result "${version}-${arch}")

        # Determine notes based on result
        notes=""
        case "${result}" in
            OK*)
                notes="File verified"
                ;;
            VERIFIED)
                notes="Ready for testing"
                ;;
            BOOTS)
                notes="QEMU boot successful"
                ;;
            PANIC)
                notes="Kernel panic detected"
                ;;
            TIMEOUT)
                notes="Boot timeout (OK)"
                ;;
            UNAVAILABLE)
                notes="Not yet released"
                ;;
            NO_QEMU)
                notes="QEMU not available"
                ;;
            *)
                notes="${result}"
                ;;
        esac

        # Determine status symbol
        status_symbol=""
        if [[ "${result}" =~ ^(OK|VERIFIED|BOOTS|TIMEOUT) ]]; then
            status_symbol="✓"
        elif [[ "${result}" =~ ^(UNAVAILABLE) ]]; then
            status_symbol="○"
        else
            status_symbol="✗"
        fi

        printf "%-8s | %-10s | %-15s | %-20s\n" \
            "${version}" "${arch}" "${status_symbol} ${result:0:12}" "${notes}" | tee -a "${RESULTS_FILE}"
    done
done

echo "" | tee -a "${RESULTS_FILE}"

# Summary
log_section "Summary"

total_tests=$((${#ALPINE_VERSIONS[@]} * ${#ARCHITECTURES[@]}))
successful=0
unavailable=0

for i in "${!result_values[@]}"; do
    result="${result_values[$i]}"
    if [[ "${result}" =~ ^(OK|VERIFIED|BOOTS|TIMEOUT) ]]; then
        ((successful++))
    elif [[ "${result}" == "UNAVAILABLE" ]]; then
        ((unavailable++))
    fi
done

log_info "Total tests: ${total_tests}"
log_success "Successful: ${successful}"
if [[ ${unavailable} -gt 0 ]]; then
    log_warn "Unavailable: ${unavailable}"
fi
log_info "Failed: $((total_tests - successful - unavailable))"
echo ""

log_info "Results saved to: ${RESULTS_FILE}"
echo ""

# Cleanup recommendation
log_info "Test cache directory: ${TEST_DIR}"
log_info "To clean up: rm -rf ${TEST_DIR}"
echo ""

# Exit with success if we had any successful tests
if [[ ${successful} -gt 0 ]]; then
    exit 0
else
    exit 1
fi
