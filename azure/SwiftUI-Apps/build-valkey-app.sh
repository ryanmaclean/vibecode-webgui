#!/bin/bash
set -e

echo "=== Building ValkeyVibeCode App with MAC Address Normalization Fix ==="

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Verify the MAC normalization fix is present
echo ""
echo "Verifying MAC address normalization fix..."
if grep -q "normalizeMACAddress" Shared/Networking/DHCPLeaseMonitor.swift; then
    echo "  ✓ MAC normalization fix confirmed in DHCPLeaseMonitor.swift"
else
    echo "  ✗ ERROR: MAC normalization fix not found!"
    exit 1
fi

# Build ValkeyVibeCode
echo ""
echo "Compiling ValkeyVibeCodeApp..."
echo "  Including:"
echo "    - Apps/ValkeyVibeCodeApp/ValkeyVibeCodeApp.swift"
echo "    - Apps/ValkeyVibeCodeApp/ValkeyVMManager.swift"
echo "    - Shared/Core/BaseVMManager.swift"
echo "    - Shared/Core/VMLogger.swift"
echo "    - Shared/Core/PTYManager.swift"
echo "    - Shared/Networking/NetworkingStrategy.swift"
echo "    - Shared/Networking/NATNetworkStrategy.swift"
echo "    - Shared/Networking/DHCPLeaseMonitor.swift (with MAC normalization)"
echo "    - Shared/Networking/VMPortForwarder.swift"
echo "    - Shared/Networking/ProxyConnection.swift"
echo "    - Shared/Networking/VsockNetworkStrategy.swift"
echo "    - Shared/Networking/VsockProxyServer.swift"
echo "    - Shared/Observability/ObservabilityProvider.swift"
echo "    - Shared/Observability/DatadogProvider.swift"
echo "    - Shared/Observability/OpenTelemetryProvider.swift"
echo "    - OpenTelemetryIntegration.swift"
echo "    - VMObservability.swift"

swiftc -o ValkeyVibeCodeApp \
    Apps/ValkeyVibeCodeApp/ValkeyVibeCodeApp.swift \
    Apps/ValkeyVibeCodeApp/ValkeyVMManager.swift \
    Shared/Core/BaseVMManager.swift \
    Shared/Core/VMLogger.swift \
    Shared/Core/PTYManager.swift \
    Shared/Networking/NetworkingStrategy.swift \
    Shared/Networking/NATNetworkStrategy.swift \
    Shared/Networking/VsockNetworkStrategy.swift \
    Shared/Networking/VsockProxyServer.swift \
    Shared/Networking/DHCPLeaseMonitor.swift \
    Shared/Networking/VMPortForwarder.swift \
    Shared/Networking/ProxyConnection.swift \
    Shared/Observability/ObservabilityProvider.swift \
    Shared/Observability/DatadogProvider.swift \
    Shared/Observability/OpenTelemetryProvider.swift \
    OpenTelemetryIntegration.swift \
    VMObservability.swift \
    -framework SwiftUI \
    -framework Virtualization \
    -framework Network \
    -target arm64-apple-macos13.0

if [ $? -eq 0 ]; then
    echo ""
    echo "  ✓ Successfully compiled ValkeyVibeCodeApp"
    ls -lh ValkeyVibeCodeApp

    # Verify the binary contains MAC normalization code
    if strings ValkeyVibeCodeApp | grep -q "normalizeMACAddress"; then
        echo "  ✓ Verified: Binary contains MAC normalization function"
    else
        echo "  ⚠ Warning: Could not verify MAC normalization in binary (may be optimized)"
    fi
else
    echo ""
    echo "  ✗ ERROR: Failed to compile ValkeyVibeCodeApp"
    exit 1
fi

echo ""
echo "=== Compilation Complete ==="
echo ""
echo "Next step: Run bundle-valkey-app.sh to create signed ValkeyVibeCode.app bundle"
echo ""
