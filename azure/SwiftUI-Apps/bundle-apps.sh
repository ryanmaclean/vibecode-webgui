#!/bin/bash
set -e

echo "=== Creating macOS .app bundles with embedded VM resources ==="

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Paths to resources
# Using Ubuntu kernel with full virtio-net support for networking
KERNEL="$HOME/.vfkit/vms/vibecode-alpine/kernel/vmlinux-ubuntu-uncompressed"
INITRD="$HOME/vibecode-webgui/azure/bun-openvscode.cpio.gz"

# Function to create app bundle
create_bundle() {
    local APP_NAME="$1"
    local EXECUTABLE="$2"
    local BUNDLE_ID="$3"

    echo ""
    echo "Creating $APP_NAME.app bundle..."

    # Create bundle structure
    mkdir -p "$APP_NAME.app/Contents/MacOS"
    mkdir -p "$APP_NAME.app/Contents/Resources"

    # Copy executable
    cp "$EXECUTABLE" "$APP_NAME.app/Contents/MacOS/$APP_NAME"
    chmod +x "$APP_NAME.app/Contents/MacOS/$APP_NAME"

    # Copy VM resources
    echo "  Copying Ubuntu kernel with virtio-net support (45MB)..."
    cp "$KERNEL" "$APP_NAME.app/Contents/Resources/vmlinux-raw"

    echo "  Copying initramfs (108MB)..."
    cp "$INITRD" "$APP_NAME.app/Contents/Resources/bun-openvscode.cpio.gz"

    # Create Info.plist
    cat > "$APP_NAME.app/Contents/Info.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>$APP_NAME</string>
    <key>CFBundleIdentifier</key>
    <string>$BUNDLE_ID</string>
    <key>CFBundleName</key>
    <string>$APP_NAME</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0</string>
    <key>CFBundleVersion</key>
    <string>1</string>
    <key>LSMinimumSystemVersion</key>
    <string>13.0</string>
    <key>NSHighResolutionCapable</key>
    <true/>
</dict>
</plist>
EOF

    # Create PkgInfo
    echo -n "APPL????" > "$APP_NAME.app/Contents/PkgInfo"

    # Code sign the bundle
    echo "  Code signing bundle..."
    codesign --force --deep --sign - --entitlements entitlements.plist "$APP_NAME.app"

    # Show bundle size
    local SIZE=$(du -sh "$APP_NAME.app" | cut -f1)
    echo "  Bundle created: $SIZE"
}

# Create both bundles
create_bundle "BasicVibeCode" "BasicVibeCodeApp" "com.vibecode.basic"
create_bundle "LiquidGlassVibeCode" "LiquidGlassVibeCodeApp" "com.vibecode.liquidglass"

echo ""
echo "=== Bundle Summary ==="
ls -lh *.app/Contents/MacOS/* 2>/dev/null | awk '{print $9, $5}'
echo ""
du -sh BasicVibeCode.app LiquidGlassVibeCode.app

echo ""
echo "=== Bundles ready for distribution ==="
echo "Test with: open BasicVibeCode.app"
echo "         or: open LiquidGlassVibeCode.app"
