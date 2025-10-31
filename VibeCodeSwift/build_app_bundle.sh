#!/bin/bash
set -e

APP_NAME="VibeCode"
BUILD_DIR=".build/debug"
BUNDLE_DIR="$BUILD_DIR/$APP_NAME.app"

echo "📦 Creating app bundle structure..."
mkdir -p "$BUNDLE_DIR/Contents/MacOS"
mkdir -p "$BUNDLE_DIR/Contents/Resources"

echo "📋 Copying executable..."
cp "$BUILD_DIR/$APP_NAME" "$BUNDLE_DIR/Contents/MacOS/$APP_NAME"

echo "📋 Creating Info.plist..."
cat > "$BUNDLE_DIR/Contents/Info.plist" << 'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>VibeCode</string>
    <key>CFBundleIdentifier</key>
    <string>com.vibecode.app</string>
    <key>CFBundleName</key>
    <string>VibeCode</string>
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
PLIST

echo "🔐 Signing app bundle..."
codesign --force --deep --sign - --entitlements VibeCode.entitlements "$BUNDLE_DIR"

echo "✅ App bundle created at: $BUNDLE_DIR"
