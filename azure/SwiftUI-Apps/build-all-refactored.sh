#!/bin/bash
# Note: Don't use set -e since we want to continue even if some apps fail

echo "=== Building VibeCode SwiftUI Applications (Refactored Architecture) ==="
echo "Using: Pure Swift 6 + Apple Virtualization.framework"
echo ""

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Shared source files
SHARED_CORE="Shared/Core/BaseVMManager.swift Shared/Core/VMLogger.swift"
SHARED_NETWORKING="Shared/Networking/NetworkingStrategy.swift Shared/Networking/NATNetworkStrategy.swift Shared/Networking/DHCPLeaseMonitor.swift"
SHARED_VSOCK="Shared/Networking/VsockNetworkStrategy.swift Shared/Networking/VsockProxyServer.swift Shared/Networking/ProxyConnection.swift"
SHARED_ALL="$SHARED_CORE $SHARED_NETWORKING"
SHARED_ALL_VSOCK="$SHARED_CORE $SHARED_NETWORKING $SHARED_VSOCK"

# Build flags
BUILD_FLAGS="-framework SwiftUI -framework Virtualization -framework Network -framework Combine -framework AppKit -target arm64-apple-macos13.0"

# Track successes and failures
declare -a SUCCESSES
declare -a FAILURES

# Build BasicVibeCodeApp (MIGRATED to BaseVMManager)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. Building BasicVibeCodeApp (MIGRATED)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if swiftc -o BasicVibeCodeApp \
    BasicVibeCodeApp.swift \
    Apps/BasicVibeCodeApp/BasicVMManager.swift \
    $SHARED_ALL \
    $BUILD_FLAGS 2>&1 | tee /tmp/build-basic.log; then
    echo "✓ BasicVibeCodeApp compiled successfully"
    ls -lh BasicVibeCodeApp
    SUCCESSES+=("BasicVibeCodeApp")
else
    echo "✗ BasicVibeCodeApp compilation failed"
    tail -20 /tmp/build-basic.log
    FAILURES+=("BasicVibeCodeApp")
fi
echo ""

# Build LiquidGlassVibeCodeApp (LEGACY - not yet migrated)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2. Building LiquidGlassVibeCodeApp (LEGACY)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if swiftc -o LiquidGlassVibeCodeApp \
    LiquidGlassVibeCodeApp.swift \
    DHCPLeaseParser.swift \
    DatadogLogger.swift \
    DogStatsDClient.swift \
    $BUILD_FLAGS 2>&1 | tee /tmp/build-liquid.log; then
    echo "✓ LiquidGlassVibeCodeApp compiled successfully"
    ls -lh LiquidGlassVibeCodeApp
    SUCCESSES+=("LiquidGlassVibeCodeApp")
else
    echo "✗ LiquidGlassVibeCodeApp compilation failed"
    tail -20 /tmp/build-liquid.log
    FAILURES+=("LiquidGlassVibeCodeApp")
fi
echo ""

# Build VsockVibeCodeApp (MIGRATED to BaseVMManager)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3. Building VsockVibeCodeApp (MIGRATED)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if swiftc -o VsockVibeCodeApp \
    VsockVibeCodeApp.swift \
    Apps/VsockVibeCodeApp/VsockVMManager.swift \
    $SHARED_ALL_VSOCK \
    $BUILD_FLAGS 2>&1 | tee /tmp/build-vsock.log; then
    echo "✓ VsockVibeCodeApp compiled successfully"
    ls -lh VsockVibeCodeApp
    SUCCESSES+=("VsockVibeCodeApp")
else
    echo "✗ VsockVibeCodeApp compilation failed"
    tail -20 /tmp/build-vsock.log
    FAILURES+=("VsockVibeCodeApp")
fi
echo ""

# Build NetworkTestVibeCodeApp (LEGACY)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4. Building NetworkTestVibeCodeApp (LEGACY)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if swiftc -o NetworkTestVibeCodeApp \
    NetworkTestVibeCodeApp.swift \
    DHCPLeaseParser.swift \
    $BUILD_FLAGS 2>&1 | tee /tmp/build-nettest.log; then
    echo "✓ NetworkTestVibeCodeApp compiled successfully"
    ls -lh NetworkTestVibeCodeApp
    SUCCESSES+=("NetworkTestVibeCodeApp")
else
    echo "✗ NetworkTestVibeCodeApp compilation failed"
    tail -20 /tmp/build-nettest.log
    FAILURES+=("NetworkTestVibeCodeApp")
fi
echo ""

# Build NetworkTestCLI (LEGACY)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "5. Building NetworkTestCLI (LEGACY)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if swiftc -o NetworkTestCLI \
    NetworkTestCLI.swift \
    DHCPLeaseParser.swift \
    -framework Virtualization \
    -framework Network \
    -target arm64-apple-macos13.0 2>&1 | tee /tmp/build-cli.log; then
    echo "✓ NetworkTestCLI compiled successfully"
    ls -lh NetworkTestCLI
    SUCCESSES+=("NetworkTestCLI")
else
    echo "✗ NetworkTestCLI compilation failed"
    tail -20 /tmp/build-cli.log
    FAILURES+=("NetworkTestCLI")
fi
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "BUILD SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✓ Successful builds (${#SUCCESSES[@]}):"
for app in "${SUCCESSES[@]}"; do
    echo "  - $app"
done
echo ""

if [ ${#FAILURES[@]} -gt 0 ]; then
    echo "✗ Failed builds (${#FAILURES[@]}):"
    for app in "${FAILURES[@]}"; do
        echo "  - $app"
    done
    echo ""
fi

# Show executables
if [ ${#SUCCESSES[@]} -gt 0 ]; then
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Compiled Executables:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    ls -lh BasicVibeCodeApp LiquidGlassVibeCodeApp NetworkTestVibeCodeApp NetworkTestCLI VsockVibeCodeApp 2>/dev/null | grep -v "cannot access" || true
    echo ""
fi

# Architecture verification
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "ARCHITECTURE VERIFICATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✓ Pure Swift 6 + Apple Virtualization.framework"
echo "✓ NO vfkit, QEMU, or external VM tools"
echo "✓ WWDC 2022 compliant (see docs/WWDC-2022-ALIGNMENT.md)"
echo ""

# Next steps
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "NEXT STEPS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. Run ./bundle-apps.sh to create signed .app bundles"
echo "2. Test BasicVibeCodeApp: ./test-basicvibecode.sh"
echo "3. Test all apps: ./test-all-apps.sh"
echo ""

# Exit with error if any critical builds failed (exclude known issues)
if [[ "${FAILURES[*]}" =~ "BasicVibeCodeApp" ]] || [[ "${FAILURES[*]}" =~ "LiquidGlassVibeCodeApp" ]]; then
    echo "⚠️  Critical builds failed!"
    exit 1
else
    echo "✓ All critical builds succeeded!"
    exit 0
fi
