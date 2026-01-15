#!/bin/bash
#
# build-release.sh - Build, DMG, and release UnifiedServicesVibeCode menubar app
#
# Usage: ./build-release.sh <version> [--skip-dmg] [--skip-publish]
# Example: ./build-release.sh 4.1.1
#

set -e

if [ -z "$1" ]; then
    echo "Usage: $0 <version> [--skip-dmg] [--skip-publish]"
    echo "Example: $0 4.1.1"
    exit 1
fi

VERSION="$1"
SKIP_DMG=false
SKIP_PUBLISH=false

# Parse flags
shift
while [ "$#" -gt 0 ]; do
    case "$1" in
        --skip-dmg) SKIP_DMG=true ;;
        --skip-publish) SKIP_PUBLISH=true ;;
        *) echo "Unknown flag: $1"; exit 1 ;;
    esac
    shift
done

cd "$(dirname "$0")"

APP_DIR="/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/Apps/UnifiedServicesVibeCodeApp.app"
SOURCE_DIR="/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/Apps/UnifiedServicesVibeCodeApp"
SHARED_DIR="/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/Shared"
ENTITLEMENTS="/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/entitlements.plist"
REFERENCE_APP="/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/UnifiedServicesVibeCode.app"
DMG_NAME="VibeCode-Unified-v${VERSION}.dmg"
VOLUME_NAME="VibeCode Unified v${VERSION}"

echo "========================================"
echo "  Building VibeCode v${VERSION}"
echo "========================================"
echo ""

# Step 1: Build app
echo "Step 1: Compiling Swift sources..."
mkdir -p "$APP_DIR/Contents/MacOS"
mkdir -p "$APP_DIR/Contents/Resources"

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
echo "Step 2: Copying resources..."
cp "$REFERENCE_APP/Contents/Resources/vmlinux-raw" "$APP_DIR/Contents/Resources/"
cp "$REFERENCE_APP/Contents/Resources/unified-vm-initramfs.cpio.gz" "$APP_DIR/Contents/Resources/"

if [ -f "$REFERENCE_APP/Contents/Resources/AppIcon.icns" ]; then
    cp "$REFERENCE_APP/Contents/Resources/AppIcon.icns" "$APP_DIR/Contents/Resources/"
fi

echo ""
echo "Step 3: Creating Info.plist with version ${VERSION}..."
sed "s/VERSION_NUMBER/$VERSION/g" "$SOURCE_DIR/Info.plist.template" > "$APP_DIR/Contents/Info.plist"

echo ""
echo "Step 4: Signing app..."
codesign --force --sign - --entitlements "$ENTITLEMENTS" --deep "$APP_DIR"

echo ""
echo "✅ App build complete: $APP_DIR"
plutil -p "$APP_DIR/Contents/Info.plist" | grep Version

# Step 5: Run console color test
echo ""
echo "Step 5: Verifying console colors..."
if [ -f "Tests/verify-console-colors.sh" ]; then
    (cd Tests && ./verify-console-colors.sh)
else
    echo "⚠️  Warning: Console color test not found"
fi

# Step 6: Create DMG
if [ "$SKIP_DMG" = false ]; then
    echo ""
    echo "========================================"
    echo "  Creating DMG v${VERSION}"
    echo "========================================"
    echo ""

    TMP_DIR=$(mktemp -d)
    echo "Staging files in $TMP_DIR..."

    cp -R "$APP_DIR" "$TMP_DIR/"
    ln -s /Applications "$TMP_DIR/Applications"

    cat > "$TMP_DIR/README.txt" << EOF
VibeCode Unified Services v${VERSION}
================================

INSTALLATION
------------
1. Drag "UnifiedServicesVibeCodeApp.app" to Applications folder
2. Launch from Applications or menubar

FEATURES (v${VERSION})
-----------------
✅ Menubar app (no Dock icon)
✅ All 5 services accessible on localhost:
   - SSH: ssh -p 2222 root@localhost (password: vibecode)
   - OpenVSCode: http://localhost:8080
   - Valkey/Redis: redis-cli -p 6379
   - PostgreSQL: psql -h localhost -p 5432 -U postgres
   - Docker: docker -H tcp://localhost:2375 ps
✅ Datadog v2.0.0 installed and active
✅ Console output: GREEN text on BLACK background

RELEASE NOTES
-------------
For release notes and known issues, see:
https://github.com/ryanmaclean/vibecode-webgui/releases/tag/v${VERSION}
EOF

    echo "Creating DMG..."
    hdiutil create -volname "$VOLUME_NAME" \
        -srcfolder "$TMP_DIR" \
        -ov -format UDZO \
        "tmp-${DMG_NAME}"

    rm -rf "$TMP_DIR"
    mv "tmp-${DMG_NAME}" "$DMG_NAME"

    echo ""
    echo "✅ DMG created successfully!"
    echo "Location: $(pwd)/$DMG_NAME"
    echo "Size: $(du -h "$DMG_NAME" | cut -f1)"
    echo ""
    echo "SHA256: $(shasum -a 256 "$DMG_NAME" | cut -d' ' -f1)"
else
    echo ""
    echo "⏭️  Skipping DMG creation"
fi

# Step 7: Open DMG for testing
if [ "$SKIP_DMG" = false ]; then
    echo ""
    echo "Opening DMG for manual testing..."
    open "$DMG_NAME"

    echo ""
    echo "📋 Manual Testing Required:"
    echo "  1. Verify installation (drag to Applications)"
    echo "  2. Launch app and check menubar"
    echo "  3. Test all 5 services"
    echo "  4. Click 'Show Console Output' - verify GREEN text on BLACK background"
    echo "  5. If all tests pass, run: ./publish-release.sh $VERSION"
fi

echo ""
echo "========================================"
echo "  Build Complete: v${VERSION}"
echo "========================================"
echo ""
echo "Next steps:"
echo "  1. Test the app thoroughly"
echo "  2. If tests pass, publish: ./publish-release.sh $VERSION"
echo ""
