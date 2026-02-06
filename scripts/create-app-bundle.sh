#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

# MIT License - Create VibeCode.app Bundle

# Initialize log aggregation
init_log_aggregation


set -e

echo "📦 Creating VibeCode.app Bundle"
echo ""

cd /Users/ryan.maclean/vibecode-webgui/VibeCodeSwift

# Create app bundle structure
APP_BUNDLE=".build/release/VibeCode.app"
echo "🏗️  Creating app bundle structure..."
mkdir -p "$APP_BUNDLE/Contents/MacOS"
mkdir -p "$APP_BUNDLE/Contents/Resources/vms"

# Copy binary
echo "📋 Copying binary..."
cp .build/release/VibeCode "$APP_BUNDLE/Contents/MacOS/"
chmod +x "$APP_BUNDLE/Contents/MacOS/VibeCode"

# Copy Info.plist
echo "📄 Copying Info.plist..."
cp Info.plist "$APP_BUNDLE/Contents/"

# Copy entitlements (for reference)
echo "🔐 Copying entitlements..."
cp VibeCode.entitlements "$APP_BUNDLE/Contents/"

# Symlink VM images (for testing)
echo "🔗 Symlinking VM images..."
ln -sf ../../../../dist/vm-images/vibecode-postgresql.img "$APP_BUNDLE/Contents/Resources/vms/"
ln -sf ../../../../dist/vm-images/vibecode-postgresql-efi.nvram "$APP_BUNDLE/Contents/Resources/vms/"

echo ""
echo "✅ App bundle created!"
echo ""
echo "Location: $APP_BUNDLE"
echo "Size: $(du -sh "$APP_BUNDLE" | cut -f1)"
echo ""
echo "📊 Bundle contents:"
ls -lh "$APP_BUNDLE/Contents/MacOS/"
echo ""
echo "🎯 To test:"
echo "  open $APP_BUNDLE"
echo ""
echo "⚠️  Note: For distribution, you'll need to:"
echo "  1. Code sign with: codesign --deep --force --sign 'Developer ID' --entitlements VibeCode.entitlements VibeCode.app"
echo "  2. Create DMG with: hdiutil create -volname VibeCode -srcfolder VibeCode.app -ov -format UDZO VibeCode.dmg"
echo "  3. Notarize (optional)"

