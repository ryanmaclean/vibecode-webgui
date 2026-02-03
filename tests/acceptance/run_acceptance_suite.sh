#!/bin/bash
# Master Acceptance Test Suite
# Maps to SCOPE_OF_WORK.md

FAILURES=0
echo "=== 🧪 OpenClaw VM Acceptance Suite ==="
echo "Started at: $(date)"
echo ""

test_req_01_footprint() {
    # Check config files for resource limits
    # Looking for: config.memorySize = UInt64(2 * 1024 * 1024 * 1024)
    if grep -q "memorySize = UInt64(2 \* 1024 \* 1024 \* 1024)" platforms/macos/vz-swift/Sources/VibeCodeVM/OpenClawVM.swift; then
        MEM_CHECK="PASS"
    else
        MEM_CHECK="FAIL"
    fi

    # Looking for: config.cpuCount = 2
    if grep -q "cpuCount = 2" platforms/macos/vz-swift/Sources/VibeCodeVM/OpenClawVM.swift; then
        CPU_CHECK="PASS"
    else
        CPU_CHECK="FAIL"
    fi
    
    if [[ "$MEM_CHECK" == "PASS" && "$CPU_CHECK" == "PASS" ]]; then
        echo "✅ REQ-01 PASS: Configured for 2GB RAM / 2 CPU"
    else
        echo "❌ REQ-01 FAIL: Resource config mismatch (Mem: $MEM_CHECK, CPU: $CPU_CHECK)"
        ((FAILURES++))
    fi
}

test_req_02_networking() {
    # Verify MAC address fix (No explicit MAC = Auto)
    if grep -q "macAddress =" platforms/macos/vz-swift/Sources/VibeCodeVM/OpenClawVM.swift; then
        echo "❌ REQ-02 FAIL: Explicit MAC address found (causes carrier issue)"
        ((FAILURES++))
    else
        echo "✅ REQ-02 PASS: Networking uses Auto-MAC (Fix applied)"
    fi
    
    # Verify NAT config
    if grep -q "VZNATNetworkDeviceAttachment" platforms/macos/vz-swift/Sources/VibeCodeVM/OpenClawVM.swift; then
        echo "✅ REQ-02 PASS: NAT Attachment configured"
    else
        echo "❌ REQ-02 FAIL: NAT Attachment missing"
        ((FAILURES++))
    fi
}

test_req_03_functional() {
    # Check installation script for critical steps
    SCRIPT="scripts/vz/install-openclaw-in-vm-enhanced.sh"
    if grep -q "openclaw gateway install" "$SCRIPT" && grep -q "health" "$SCRIPT"; then
        echo "✅ REQ-03 PASS: Install script includes Gateway & Health check"
    else
        echo "❌ REQ-03 FAIL: Install script missing critical steps"
        ((FAILURES++))
    fi
}

test_req_04_tailscale() {
    SCRIPT="scripts/vz/setup-tailscale-vm.sh"
    if grep -q "tailscale up" "$SCRIPT" && grep -q "accept-routes" "$SCRIPT"; then
        echo "✅ REQ-04 PASS: Tailscale automation includes routing"
    else
        echo "❌ REQ-04 FAIL: Tailscale script incomplete"
        ((FAILURES++))
    fi
}

test_req_06_security() {
    ENT="platforms/macos/vz-swift/entitlements.plist"
    if grep -q "com.apple.security.virtualization" "$ENT"; then
        echo "✅ REQ-06 PASS: Virtualization entitlement present"
    else
        echo "❌ REQ-06 FAIL: Critical entitlement missing"
        ((FAILURES++))
    fi
}

test_req_ubuntu_pivot() {
    echo "Running REQ-UBUNTU: Verify Ubuntu/vfkit Pivot Scripts"
    if [ -f "scripts/launch_ubuntu_vm.py" ] && [ -f "scripts/ralph_loop.py" ]; then
         echo "✅ REQ-UBUNTU PASS: Pivot scripts present"
    else
         echo "❌ REQ-UBUNTU FAIL: Scripts missing"
         ((FAILURES++))
    fi
}

# Execute Tests
test_req_01_footprint
test_req_02_networking
test_req_03_functional
test_req_04_tailscale
test_req_06_security
test_req_ubuntu_pivot

echo ""
if [ $FAILURES -eq 0 ]; then
    echo "🎉 ALL CRITICAL REQUIREMENTS PASSED"
    exit 0
else
    echo "💥 FAILED: $FAILURES critical requirements failed validation"
    exit 1
fi
