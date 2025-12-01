#!/bin/bash
# Build Standalone VM Apps (Valkey, PostgreSQL)
# This script compiles and packages standalone VM apps with correct initramfs files

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
AZURE_DIR="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="$SCRIPT_DIR/.build"

echo "=== Building Standalone VM Apps ==="
echo "Script directory: $SCRIPT_DIR"
echo "Azure directory: $AZURE_DIR"

# Kill any running VMs
echo ""
echo "Stopping any running VMs..."
killall -9 ValkeyVibeCode PostgreSQLVibeCode 2>/dev/null || true
sleep 2

# Clean previous builds
echo ""
echo "Cleaning previous builds..."
rm -rf "$SCRIPT_DIR/ValkeyVibeCode.app"
rm -rf "$SCRIPT_DIR/PostgreSQLVibeCode.app"
rm -f "$SCRIPT_DIR/ValkeyVibeCodeBinary"
rm -f "$SCRIPT_DIR/PostgreSQLVibeCodeBinary"

# Function to compile a standalone app
compile_app() {
    local APP_NAME=$1
    local BINARY_NAME="${APP_NAME}Binary"
    local APP_DIR="Apps/${APP_NAME}App"

    echo ""
    echo "=== Compiling $APP_NAME ==="

    if [ ! -d "$APP_DIR" ]; then
        echo "ERROR: $APP_DIR not found"
        return 1
    fi

    # Collect all Swift files
    # APP_NAME is like "ValkeyVibeCode", we need "ValkeyVMManager.swift"
    local VM_MANAGER_NAME="${APP_NAME/VibeCode/VMManager}.swift"

    local SWIFT_FILES=""
    SWIFT_FILES+="$APP_DIR/${APP_NAME}App.swift "
    SWIFT_FILES+="$APP_DIR/$VM_MANAGER_NAME "
    SWIFT_FILES+="Shared/Core/BaseVMManager.swift "
    SWIFT_FILES+="Shared/Core/PTYManager.swift "
    SWIFT_FILES+="Shared/Core/VMLogger.swift "
    SWIFT_FILES+="Shared/Networking/NetworkingStrategy.swift "
    SWIFT_FILES+="Shared/Networking/NATNetworkStrategy.swift "
    SWIFT_FILES+="Shared/Networking/VsockNetworkStrategy.swift "
    SWIFT_FILES+="Shared/Networking/VsockProxyServer.swift "
    SWIFT_FILES+="Shared/Networking/ProxyConnection.swift "
    SWIFT_FILES+="Shared/Networking/DHCPLeaseMonitor.swift "
    SWIFT_FILES+="Shared/Observability/ObservabilityProvider.swift "

    echo "Compiling with files:"
    for f in $SWIFT_FILES; do
        if [ -f "$f" ]; then
            echo "  ✓ $f"
        else
            echo "  ✗ $f (missing)"
            return 1
        fi
    done

    # Compile
    swiftc -o "$BINARY_NAME" \
        $SWIFT_FILES \
        -framework SwiftUI \
        -framework Virtualization \
        -framework Network \
        -target arm64-apple-macos13.0 \
        -O

    if [ -f "$BINARY_NAME" ]; then
        echo "✓ Compiled $BINARY_NAME ($(du -h $BINARY_NAME | cut -f1))"
        return 0
    else
        echo "✗ Failed to compile $BINARY_NAME"
        return 1
    fi
}

# Function to create app bundle
create_app_bundle() {
    local APP_NAME=$1
    local BINARY_NAME="${APP_NAME}Binary"
    local BUNDLE_ID=$2
    local INITRAMFS_FILE=$3
    local INITRAMFS_RESOURCE_NAME=$4
    local DISPLAY_NAME=$5

    echo ""
    echo "=== Creating $APP_NAME.app Bundle ==="

    # Create bundle structure
    local BUNDLE="$APP_NAME.app"
    local CONTENTS="$BUNDLE/Contents"
    local MACOS="$CONTENTS/MacOS"
    local RESOURCES="$CONTENTS/Resources"

    mkdir -p "$MACOS"
    mkdir -p "$RESOURCES"

    # Copy binary
    echo "Copying binary..."
    cp "$BINARY_NAME" "$MACOS/$APP_NAME"
    chmod +x "$MACOS/$APP_NAME"

    # Copy kernel (use linux-kernel-arm64 which matches 5.15.0-161)
    echo "Copying kernel..."
    if [ -f "$AZURE_DIR/linux-kernel-arm64" ]; then
        cp "$AZURE_DIR/linux-kernel-arm64" "$RESOURCES/vmlinux-raw"
        echo "  ✓ vmlinux-raw (5.15.0-161-generic, $(du -h $RESOURCES/vmlinux-raw | cut -f1))"
    elif [ -f "$AZURE_DIR/vmlinux-raw" ]; then
        cp "$AZURE_DIR/vmlinux-raw" "$RESOURCES/vmlinux-raw"
        echo "  ⚠ vmlinux-raw (old version, $(du -h $RESOURCES/vmlinux-raw | cut -f1))"
    else
        echo "  ✗ No kernel found"
        return 1
    fi

    # Copy initramfs with correct resource name
    echo "Copying initramfs..."
    if [ -f "$AZURE_DIR/$INITRAMFS_FILE" ]; then
        cp "$AZURE_DIR/$INITRAMFS_FILE" "$RESOURCES/${INITRAMFS_RESOURCE_NAME}.cpio.gz"
        echo "  ✓ ${INITRAMFS_RESOURCE_NAME}.cpio.gz ($(du -h $RESOURCES/${INITRAMFS_RESOURCE_NAME}.cpio.gz | cut -f1))"
    else
        echo "  ✗ $INITRAMFS_FILE not found"
        return 1
    fi

    # Create Info.plist
    echo "Creating Info.plist..."
    cat > "$CONTENTS/Info.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>$APP_NAME</string>
    <key>CFBundleIdentifier</key>
    <string>$BUNDLE_ID</string>
    <key>CFBundleName</key>
    <string>$DISPLAY_NAME</string>
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
    echo -n "APPL????" > "$CONTENTS/PkgInfo"

    # Code sign
    echo "Code signing..."
    if [ -f "entitlements.plist" ]; then
        codesign --force --deep --sign - --entitlements entitlements.plist "$BUNDLE" 2>&1 | grep -v "replacing existing signature" || true
    else
        echo "Warning: entitlements.plist not found, signing without entitlements"
        codesign --force --deep --sign - "$BUNDLE" 2>&1 | grep -v "replacing existing signature" || true
    fi

    # Verify bundle
    echo "Verifying bundle..."
    echo "  Bundle size: $(du -sh $BUNDLE | cut -f1)"
    echo "  Binary: $(file $MACOS/$APP_NAME | cut -d: -f2)"
    echo "  Kernel: $(ls -lh $RESOURCES/vmlinux-raw | awk '{print $5}')"
    echo "  Initramfs: $(ls -lh $RESOURCES/${INITRAMFS_RESOURCE_NAME}.cpio.gz | awk '{print $5}')"

    echo "✓ Created $BUNDLE"
    return 0
}

# Build Valkey
echo ""
echo "========================================"
echo "Building Valkey VM App"
echo "========================================"

if compile_app "ValkeyVibeCode"; then
    create_app_bundle \
        "ValkeyVibeCode" \
        "com.vibecode.valkey" \
        "valkey-standalone-complete.cpio.gz" \
        "valkey-standalone" \
        "Valkey VibeCode"
else
    echo "Failed to build Valkey app"
    exit 1
fi

# Build PostgreSQL
echo ""
echo "========================================"
echo "Building PostgreSQL VM App"
echo "========================================"

if compile_app "PostgreSQLVibeCode"; then
    create_app_bundle \
        "PostgreSQLVibeCode" \
        "com.vibecode.postgresql" \
        "postgresql-standalone-complete.cpio.gz" \
        "postgresql-standalone" \
        "PostgreSQL VibeCode"
else
    echo "Failed to build PostgreSQL app"
    exit 1
fi

echo ""
echo "========================================"
echo "Build Complete!"
echo "========================================"
echo ""
echo "Applications created:"
echo "  - ValkeyVibeCode.app ($(du -sh ValkeyVibeCode.app | cut -f1))"
echo "  - PostgreSQLVibeCode.app ($(du -sh PostgreSQLVibeCode.app | cut -f1))"
echo ""
echo "To test:"
echo "  ./ValkeyVibeCode.app/Contents/MacOS/ValkeyVibeCode"
echo "  ./PostgreSQLVibeCode.app/Contents/MacOS/PostgreSQLVibeCode"
