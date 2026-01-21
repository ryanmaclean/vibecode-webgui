#!/bin/bash
#
# Build UnifiedServicesVibeCodeApp as menubar app
#

set -e

cd "$(dirname "$0")"

APP_DIR="/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/Apps/UnifiedServicesVibeCodeApp.app"
SOURCE_DIR="/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/Apps/UnifiedServicesVibeCodeApp"
SHARED_DIR="/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/Shared"
ENTITLEMENTS="/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/entitlements.plist"
REFERENCE_APP="/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/UnifiedServicesVibeCode.app"

echo "========================================"
echo "  Building UnifiedServices Menubar App"
echo "========================================"
echo ""

# Create app bundle structure if needed
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
# Copy kernel and initramfs from reference app
cp "$REFERENCE_APP/Contents/Resources/vmlinux-raw" "$APP_DIR/Contents/Resources/"
cp "$REFERENCE_APP/Contents/Resources/unified-vm-initramfs.cpio.gz" "$APP_DIR/Contents/Resources/"

# Copy Info.plist (already updated with LSUIElement)
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
echo ""
echo "Run with: open '$APP_DIR'"
echo ""
echo "Note: This is a menubar app - no window will appear."
echo "Look for the VibeCode icon in your menubar."
