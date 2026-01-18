#!/bin/bash
set -e

cd "$(dirname "$0")"

APP_DIR="$(pwd)/Apps/UnifiedServicesVibeCodeApp.app"
SOURCE_DIR="$(pwd)/Apps/UnifiedServicesVibeCodeApp"
SHARED_DIR="$(pwd)/Shared"
ENTITLEMENTS="$(pwd)/entitlements.plist"
REFERENCE_APP="$(pwd)/VibeCodeServicesVibeCode.app"

echo "========================================"
echo "  Building UnifiedServices Test App"
echo "========================================"
echo ""

# Create app bundle structure
mkdir -p "$APP_DIR/Contents/MacOS"
mkdir -p "$APP_DIR/Contents/Resources"

# Compile Swift files
echo "Compiling Swift sources..."
swiftc -target arm64-apple-macosx14.0 \
    -parse-as-library \
    -framework Cocoa \
    -framework SwiftUI \
    -framework Virtualization \
    -o "$APP_DIR/Contents/MacOS/UnifiedServicesVibeCode" \
    "$SOURCE_DIR/UnifiedServicesVibeCodeApp.swift" \
    "$SOURCE_DIR/UnifiedServicesVMManager.swift" \
    "$SHARED_DIR/Core/BaseVMManager.swift" \
    "$SHARED_DIR/Core/VMLogger.swift" \
    "$SHARED_DIR/Core/PTYManager.swift" \
    "$SHARED_DIR/Networking/NetworkingStrategy.swift" \
    "$SHARED_DIR/Networking/NATNetworkStrategy.swift" \
    "$SHARED_DIR/Networking/VsockNetworkStrategy.swift" \
    "$SHARED_DIR/Networking/DHCPLeaseMonitor.swift" \
    "$SHARED_DIR/Networking/VMPortForwarder.swift" \
    "$SHARED_DIR/Networking/VsockProxyServer.swift" \
    "$SHARED_DIR/Networking/ProxyConnection.swift"

echo ""
echo "Copying resources..."
# Copy kernel from reference app
cp "$REFERENCE_APP/Contents/MacOS/vmlinux-raw" "$APP_DIR/Contents/Resources/" 2>/dev/null || \
    echo "Warning: vmlinux-raw not found in reference app"

# Copy NEW initramfs from Azure build
cp "$(pwd)/../unified-services-fast.cpio.gz" "$APP_DIR/Contents/Resources/unified-vm-initramfs.cpio.gz"
echo "✓ Deployed Solution B initramfs (65MB)"

# Copy Info.plist
cp "$REFERENCE_APP/Contents/Info.plist" "$APP_DIR/Contents/"

# Copy icon if exists
if [ -f "$REFERENCE_APP/Contents/Resources/AppIcon.icns" ]; then
    cp "$REFERENCE_APP/Contents/Resources/AppIcon.icns" "$APP_DIR/Contents/Resources/"
fi

echo ""
echo "Signing app..."
codesign --force --sign - --entitlements "$ENTITLEMENTS" --deep "$APP_DIR"

echo ""
echo "✅ Build complete: $APP_DIR"
ls -lh "$APP_DIR/Contents/Resources/"
echo ""
