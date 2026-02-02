#!/bin/bash
#
# Verify ARM64 Kernel Build Prerequisites
# Checks if all required tools are available before attempting kernel build
#

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
CHECKS_PASSED=0
CHECKS_FAILED=0
CHECKS_WARNED=0

# Logging functions
log_pass() {
    echo -e "${GREEN}✓${NC} $*"
    ((CHECKS_PASSED++))
}

log_fail() {
    echo -e "${RED}✗${NC} $*"
    ((CHECKS_FAILED++))
}

log_warn() {
    echo -e "${YELLOW}⚠${NC} $*"
    ((CHECKS_WARNED++))
}

log_info() {
    echo -e "${BLUE}ℹ${NC} $*"
}

log_section() {
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${BLUE}$*${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

# Check system requirements
check_system() {
    log_section "System Requirements"

    # Check macOS version
    if [[ "$(uname -s)" == "Darwin" ]]; then
        local macos_version=$(sw_vers -productVersion)
        log_pass "macOS detected: ${macos_version}"
    else
        log_fail "Not running on macOS (detected: $(uname -s))"
        return
    fi

    # Check architecture
    local arch=$(uname -m)
    if [[ "$arch" == "arm64" ]]; then
        log_pass "Apple Silicon (arm64) detected"
    elif [[ "$arch" == "x86_64" ]]; then
        log_pass "Intel (x86_64) detected"
        log_warn "Note: Cross-compiling from Intel may be slower"
    else
        log_fail "Unknown architecture: $arch"
    fi

    # Check disk space
    local available_gb=$(df -h . | awk 'NR==2 {print $4}' | sed 's/Gi//')
    if [[ "$available_gb" =~ ^[0-9]+$ ]] && [[ $available_gb -ge 20 ]]; then
        log_pass "Disk space: ${available_gb}GB available (need 20GB minimum)"
    else
        log_warn "Disk space: ${available_gb} available (recommended: 30GB+)"
    fi

    # Check RAM
    local ram_gb=$(sysctl hw.memsize | awk '{print int($2/1024/1024/1024)}')
    if [[ $ram_gb -ge 8 ]]; then
        log_pass "RAM: ${ram_gb}GB (sufficient)"
    else
        log_warn "RAM: ${ram_gb}GB (recommended: 8GB+)"
    fi

    # Check CPU cores
    local cores=$(sysctl -n hw.ncpu)
    log_pass "CPU cores: ${cores} (parallel build: make -j${cores})"
}

# Check essential tools
check_essential_tools() {
    log_section "Essential Build Tools"

    # Homebrew
    if command -v brew >/dev/null 2>&1; then
        local brew_version=$(brew --version | head -1)
        log_pass "Homebrew: ${brew_version}"
    else
        log_fail "Homebrew not found"
        log_info "Install: /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
    fi

    # Xcode Command Line Tools
    if xcode-select -p >/dev/null 2>&1; then
        local xcode_path=$(xcode-select -p)
        log_pass "Xcode Command Line Tools: ${xcode_path}"
    else
        log_fail "Xcode Command Line Tools not found"
        log_info "Install: xcode-select --install"
    fi

    # Make
    if command -v make >/dev/null 2>&1; then
        local make_version=$(make --version | head -1)
        log_pass "Make: ${make_version}"
    else
        log_fail "Make not found"
    fi

    # Flex
    if command -v flex >/dev/null 2>&1; then
        local flex_version=$(flex --version 2>&1 | head -1)
        log_pass "Flex: ${flex_version}"
    else
        log_fail "Flex not found (install: brew install flex)"
    fi

    # Bison
    if command -v bison >/dev/null 2>&1; then
        local bison_version=$(bison --version | head -1)
        log_pass "Bison: ${bison_version}"
    else
        log_fail "Bison not found (install: brew install bison)"
    fi

    # BC
    if command -v bc >/dev/null 2>&1; then
        log_pass "BC: $(which bc)"
    else
        log_fail "BC not found (install: brew install bc)"
    fi
}

# Check cross-compiler
check_cross_compiler() {
    log_section "ARM64 Cross-Compiler"

    if command -v aarch64-elf-gcc >/dev/null 2>&1; then
        local gcc_version=$(aarch64-elf-gcc --version | head -1)
        log_pass "aarch64-elf-gcc: ${gcc_version}"

        # Test compilation
        local test_file=$(mktemp).c
        echo 'int main() { return 0; }' > "$test_file"

        if aarch64-elf-gcc -c "$test_file" -o "${test_file}.o" 2>/dev/null; then
            log_pass "Cross-compiler test: Compilation successful"

            # Check output format
            if file "${test_file}.o" | grep -q "ARM aarch64"; then
                log_pass "Cross-compiler test: Output is ARM64 format"
            else
                log_warn "Cross-compiler test: Unexpected output format"
            fi

            rm -f "${test_file}.o"
        else
            log_fail "Cross-compiler test: Compilation failed"
        fi

        rm -f "$test_file"

    else
        log_fail "aarch64-elf-gcc not found"
        log_info "Install: brew install aarch64-elf-gcc"
        log_info "This is REQUIRED for kernel build"
    fi

    # Check binutils
    if command -v aarch64-elf-as >/dev/null 2>&1; then
        log_pass "ARM64 binutils: $(aarch64-elf-as --version | head -1)"
    else
        log_warn "aarch64-elf-as not found (usually installed with gcc)"
    fi
}

# Check recommended tools
check_recommended_tools() {
    log_section "Recommended Tools"

    # GNU sed
    if command -v gsed >/dev/null 2>&1; then
        log_pass "GNU sed: installed"
    else
        log_warn "GNU sed not found (install: brew install gnu-sed)"
        log_info "BSD sed may cause issues, GNU sed recommended"
    fi

    # GNU coreutils
    if brew list coreutils >/dev/null 2>&1; then
        log_pass "GNU coreutils: installed"
    else
        log_warn "GNU coreutils not found (install: brew install coreutils)"
    fi

    # ncurses
    if brew list ncurses >/dev/null 2>&1; then
        log_pass "ncurses: installed (for menuconfig)"
    else
        log_warn "ncurses not found (install: brew install ncurses)"
        log_info "Required for 'make menuconfig'"
    fi

    # OpenSSL
    if brew list openssl@3 >/dev/null 2>&1; then
        log_pass "OpenSSL 3: installed"
    else
        log_warn "OpenSSL 3 not found (install: brew install openssl@3)"
    fi

    # wget
    if command -v wget >/dev/null 2>&1; then
        log_pass "wget: installed"
    else
        log_warn "wget not found (install: brew install wget)"
        log_info "Alternative: use curl for downloading kernel"
    fi
}

# Check optional tools
check_optional_tools() {
    log_section "Optional Tools"

    # QEMU (for testing)
    if command -v qemu-system-aarch64 >/dev/null 2>&1; then
        local qemu_version=$(qemu-system-aarch64 --version | head -1)
        log_pass "QEMU: ${qemu_version}"
        log_info "Can test built kernel with QEMU"
    else
        log_info "QEMU not found (install: brew install qemu)"
        log_info "Optional: Useful for testing kernel without physical hardware"
    fi

    # ccache (for faster rebuilds)
    if command -v ccache >/dev/null 2>&1; then
        local ccache_version=$(ccache --version | head -1)
        log_pass "ccache: ${ccache_version}"
        log_info "Will speed up subsequent builds"
    else
        log_info "ccache not found (install: brew install ccache)"
        log_info "Optional: Speeds up recompilation"
    fi
}

# Generate installation commands
generate_install_commands() {
    log_section "Installation Commands"

    if [[ $CHECKS_FAILED -gt 0 ]]; then
        echo ""
        echo -e "${YELLOW}To install missing REQUIRED tools:${NC}"
        echo ""

        if ! command -v brew >/dev/null 2>&1; then
            echo "# Install Homebrew"
            echo '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
            echo ""
        fi

        if ! xcode-select -p >/dev/null 2>&1; then
            echo "# Install Xcode Command Line Tools"
            echo "xcode-select --install"
            echo ""
        fi

        if ! command -v aarch64-elf-gcc >/dev/null 2>&1; then
            echo "# Install ARM64 cross-compiler (REQUIRED)"
            echo "brew install aarch64-elf-gcc"
            echo ""
        fi

        local missing_tools=()
        command -v flex >/dev/null 2>&1 || missing_tools+=(flex)
        command -v bison >/dev/null 2>&1 || missing_tools+=(bison)
        command -v bc >/dev/null 2>&1 || missing_tools+=(bc)

        if [[ ${#missing_tools[@]} -gt 0 ]]; then
            echo "# Install missing build tools"
            echo "brew install ${missing_tools[*]}"
            echo ""
        fi
    fi

    if [[ $CHECKS_WARNED -gt 0 ]]; then
        echo ""
        echo -e "${YELLOW}To install RECOMMENDED tools:${NC}"
        echo ""
        echo "brew install gnu-sed coreutils ncurses openssl@3 wget"
        echo ""
    fi

    echo -e "${BLUE}To install ALL tools (one command):${NC}"
    echo ""
    echo "brew install aarch64-elf-gcc gnu-sed coreutils ncurses openssl@3 wget bc"
    echo ""
    echo -e "${BLUE}To install OPTIONAL testing tools:${NC}"
    echo ""
    echo "brew install qemu ccache"
    echo ""
}

# Print summary
print_summary() {
    log_section "Summary"

    echo ""
    echo "Checks passed:  ${CHECKS_PASSED}"
    echo "Checks warned:  ${CHECKS_WARNED}"
    echo "Checks failed:  ${CHECKS_FAILED}"
    echo ""

    if [[ $CHECKS_FAILED -eq 0 ]]; then
        if [[ $CHECKS_WARNED -eq 0 ]]; then
            echo -e "${GREEN}✓ All prerequisites satisfied!${NC}"
            echo -e "${GREEN}✓ Ready to build ARM64 kernel${NC}"
            echo ""
            echo "Next steps:"
            echo "  1. Read: docs/KERNEL-BUILD-GUIDE.md"
            echo "  2. Download kernel: wget https://cdn.kernel.org/pub/linux/kernel/v6.x/linux-6.6.60.tar.xz"
            echo "  3. Start build: See KERNEL-BUILD-GUIDE.md for detailed instructions"
        else
            echo -e "${YELLOW}⚠ Minimum prerequisites satisfied, but some recommended tools are missing${NC}"
            echo -e "${GREEN}✓ Can proceed with kernel build${NC}"
            echo ""
            echo "Recommendation: Install recommended tools for better experience"
        fi
    else
        echo -e "${RED}✗ Missing required prerequisites${NC}"
        echo -e "${RED}✗ Cannot build kernel until requirements are met${NC}"
        echo ""
        echo "Please install required tools using commands above"
    fi

    echo ""
}

# Main execution
main() {
    clear
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║   ARM64 Linux Kernel Build - Prerequisites Verification   ║"
    echo "║                      macOS Edition                         ║"
    echo "╚════════════════════════════════════════════════════════════╝"

    check_system
    check_essential_tools
    check_cross_compiler
    check_recommended_tools
    check_optional_tools
    generate_install_commands
    print_summary

    # Exit code based on required checks
    if [[ $CHECKS_FAILED -eq 0 ]]; then
        exit 0
    else
        exit 1
    fi
}

# Run main function
main "$@"
