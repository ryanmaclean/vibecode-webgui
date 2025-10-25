#!/bin/bash
# scripts/macos-vm/test-vm.sh
# Verification and health check script for VibeCode macOS Native VM

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🧪 VibeCode VM - Health Check & Verification"
echo "============================================="
echo ""

ERRORS=0
WARNINGS=0

# Helper functions
check_pass() {
    echo -e "${GREEN}✅ $1${NC}"
}

check_warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
    ((WARNINGS++))
}

check_fail() {
    echo -e "${RED}❌ $1${NC}"
    ((ERRORS++))
}

# 1. Platform Check
echo "📋 1. Platform Verification"
echo "   Checking operating system..."
if [[ "$(uname)" == "Darwin" ]]; then
    check_pass "Running on macOS"
    
    MACOS_VERSION=$(sw_vers -productVersion)
    MAJOR_VERSION=$(echo "$MACOS_VERSION" | cut -d. -f1)
    
    echo "   Checking macOS version..."
    if [[ $MAJOR_VERSION -ge 13 ]]; then
        check_pass "macOS $MACOS_VERSION (>= 13.0 required)"
    else
        check_fail "macOS $MACOS_VERSION is too old (13.0+ required)"
    fi
    
    echo "   Checking architecture..."
    ARCH=$(uname -m)
    if [[ "$ARCH" == "arm64" ]]; then
        check_pass "Apple Silicon ($ARCH)"
    elif [[ "$ARCH" == "x86_64" ]]; then
        check_warn "Intel x86_64 (Apple Silicon recommended)"
    else
        check_fail "Unsupported architecture: $ARCH"
    fi
else
    check_fail "Not running on macOS (current: $(uname))"
    echo ""
    echo "ℹ️  This test must be run on macOS to verify the VM."
    echo "   The VM uses Apple's Virtualization.framework which is macOS-only."
    exit 1
fi
echo ""

# 2. Dependencies Check
echo "📋 2. Dependencies"
echo "   Checking for Xcode Command Line Tools..."
if xcode-select -p &>/dev/null; then
    check_pass "Xcode Command Line Tools installed"
else
    check_fail "Xcode Command Line Tools not found"
    echo "      Install with: xcode-select --install"
fi

echo "   Checking for Swift..."
if command -v swift &>/dev/null; then
    SWIFT_VERSION=$(swift --version | head -n1)
    check_pass "Swift available ($SWIFT_VERSION)"
else
    check_fail "Swift not found"
fi
echo ""

# 3. File Structure Check
echo "📋 3. File Structure"
echo "   Checking project structure..."

if [[ -f "macos-vm/Package.swift" ]]; then
    check_pass "Package.swift exists"
else
    check_fail "Package.swift not found"
fi

if [[ -f "macos-vm/Sources/main.swift" ]]; then
    check_pass "main.swift exists"
    
    # Verify Swift code compiles
    echo "   Verifying Swift code syntax..."
    if swift build --package-path macos-vm --dry-run &>/dev/null; then
        check_pass "Swift code syntax valid"
    else
        check_warn "Swift code may have syntax errors"
    fi
else
    check_fail "main.swift not found"
fi

if [[ -d "scripts/macos-vm" ]]; then
    check_pass "Scripts directory exists"
    
    for script in download-kernel.sh build.sh install.sh benchmark.sh; do
        if [[ -f "scripts/macos-vm/$script" ]]; then
            if [[ -x "scripts/macos-vm/$script" ]]; then
                check_pass "scripts/macos-vm/$script (executable)"
            else
                check_warn "scripts/macos-vm/$script (not executable)"
            fi
        else
            check_fail "scripts/macos-vm/$script not found"
        fi
    done
else
    check_fail "scripts/macos-vm directory not found"
fi
echo ""

# 4. Build Status
echo "📋 4. Build Status"
if [[ -f "bin/vibecode-vm" ]]; then
    check_pass "Binary exists: bin/vibecode-vm"
    
    # Check binary type
    BINARY_TYPE=$(file bin/vibecode-vm)
    if [[ "$BINARY_TYPE" == *"Mach-O 64-bit"* ]]; then
        check_pass "Valid Mach-O executable"
        
        if [[ "$BINARY_TYPE" == *"arm64"* ]]; then
            check_pass "ARM64 (Apple Silicon native)"
        elif [[ "$BINARY_TYPE" == *"x86_64"* ]]; then
            check_warn "x86_64 (Intel, will use Rosetta on Apple Silicon)"
        fi
    else
        check_fail "Invalid binary type: $BINARY_TYPE"
    fi
    
    # Check binary size
    BINARY_SIZE=$(stat -f%z bin/vibecode-vm 2>/dev/null || stat -c%s bin/vibecode-vm 2>/dev/null || echo "0")
    BINARY_SIZE_KB=$((BINARY_SIZE / 1024))
    
    if [[ $BINARY_SIZE_KB -lt 100 ]]; then
        check_pass "Binary size: ${BINARY_SIZE_KB}KB (< 100KB target)"
    elif [[ $BINARY_SIZE_KB -lt 500 ]]; then
        check_warn "Binary size: ${BINARY_SIZE_KB}KB (target: < 100KB)"
    else
        check_fail "Binary size: ${BINARY_SIZE_KB}KB (too large)"
    fi
else
    check_fail "Binary not found: bin/vibecode-vm"
    echo "      Build with: ./scripts/macos-vm/build.sh"
fi
echo ""

# 5. Kernel Components
echo "📋 5. Kernel Components"
VM_DIR="$HOME/.vibecode/vm"

if [[ -d "$VM_DIR" ]]; then
    check_pass "VM directory exists: $VM_DIR"
    
    if [[ -f "$VM_DIR/vmlinuz" ]]; then
        KERNEL_SIZE=$(stat -f%z "$VM_DIR/vmlinuz" 2>/dev/null || stat -c%s "$VM_DIR/vmlinuz" 2>/dev/null)
        KERNEL_SIZE_MB=$((KERNEL_SIZE / 1024 / 1024))
        check_pass "Kernel: vmlinuz (${KERNEL_SIZE_MB}MB)"
    else
        check_fail "Kernel not found: $VM_DIR/vmlinuz"
        echo "      Download with: ./scripts/macos-vm/download-kernel.sh"
    fi
    
    if [[ -f "$VM_DIR/initramfs" ]]; then
        INITRD_SIZE=$(stat -f%z "$VM_DIR/initramfs" 2>/dev/null || stat -c%s "$VM_DIR/initramfs" 2>/dev/null)
        INITRD_SIZE_MB=$(echo "scale=1; $INITRD_SIZE / 1024 / 1024" | bc)
        check_pass "Initramfs: initramfs (${INITRD_SIZE_MB}MB)"
    else
        check_fail "Initramfs not found: $VM_DIR/initramfs"
        echo "      Download with: ./scripts/macos-vm/download-kernel.sh"
    fi
    
    if [[ -f "$VM_DIR/disk.img" ]]; then
        DISK_SIZE=$(stat -f%z "$VM_DIR/disk.img" 2>/dev/null || stat -c%s "$VM_DIR/disk.img" 2>/dev/null)
        DISK_SIZE_GB=$(echo "scale=1; $DISK_SIZE / 1024 / 1024 / 1024" | bc)
        check_pass "Disk image: disk.img (${DISK_SIZE_GB}GB)"
    else
        check_warn "Disk image not found (will be created on first run)"
    fi
else
    check_fail "VM directory not found: $VM_DIR"
    echo "      Create with: ./scripts/macos-vm/download-kernel.sh"
fi
echo ""

# 6. Documentation
echo "📋 6. Documentation"
for doc in README.md VERIFIED.md RELATED_ISSUES.md API.md BENCHMARKING.md; do
    if [[ -f "macos-vm/$doc" ]]; then
        check_pass "macos-vm/$doc exists"
    else
        check_fail "macos-vm/$doc not found"
    fi
done
echo ""

# 7. LaunchAgent (optional)
echo "📋 7. LaunchAgent Service (optional)"
PLIST="$HOME/Library/LaunchAgents/com.vibecode.vm.plist"
if [[ -f "$PLIST" ]]; then
    check_pass "LaunchAgent plist exists"
    
    if launchctl list | grep -q "com.vibecode.vm"; then
        check_pass "Service is loaded"
    else
        check_warn "Service exists but not loaded"
        echo "      Load with: launchctl load $PLIST"
    fi
else
    check_warn "LaunchAgent not installed (optional)"
    echo "      Install with: ./scripts/macos-vm/install.sh"
fi
echo ""

# 8. Runtime Test (if components exist)
if [[ -f "bin/vibecode-vm" ]] && [[ -f "$VM_DIR/vmlinuz" ]] && [[ -f "$VM_DIR/initramfs" ]]; then
    echo "📋 8. Runtime Test"
    echo "   Starting VM (5 second test)..."
    
    timeout 5 ./bin/vibecode-vm > /tmp/vm-test.log 2>&1 &
    VM_PID=$!
    
    sleep 3
    
    if ps -p $VM_PID > /dev/null; then
        check_pass "VM process started successfully"
        
        if grep -q "VM started successfully" /tmp/vm-test.log; then
            check_pass "VM initialization completed"
        else
            check_warn "VM started but initialization not confirmed"
        fi
        
        kill $VM_PID 2>/dev/null || true
        wait $VM_PID 2>/dev/null || true
    else
        check_fail "VM process failed to start"
        echo "      Check logs: /tmp/vm-test.log"
    fi
    
    rm -f /tmp/vm-test.log
    echo ""
fi

# Summary
echo "============================================="
echo "📊 Summary"
echo "============================================="

if [[ $ERRORS -eq 0 ]] && [[ $WARNINGS -eq 0 ]]; then
    echo -e "${GREEN}✅ All checks passed!${NC}"
    echo ""
    echo "🚀 Ready to run:"
    echo "   ./bin/vibecode-vm"
    echo ""
    exit 0
elif [[ $ERRORS -eq 0 ]]; then
    echo -e "${YELLOW}⚠️  $WARNINGS warning(s) found${NC}"
    echo ""
    echo "System is functional but some optimizations recommended."
    echo ""
    exit 0
else
    echo -e "${RED}❌ $ERRORS error(s), $WARNINGS warning(s) found${NC}"
    echo ""
    echo "Please address the errors above before running the VM."
    echo ""
    echo "Common fixes:"
    echo "  1. Download kernel: ./scripts/macos-vm/download-kernel.sh"
    echo "  2. Build binary:    ./scripts/macos-vm/build.sh"
    echo "  3. Install service: ./scripts/macos-vm/install.sh"
    echo ""
    exit 1
fi
