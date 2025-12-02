#!/bin/bash
set -e

cd "$(dirname "$0")"
APP_DIR="/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/VibeCodeServicesVibeCode.app"
ENTITLEMENTS="$(dirname "$APP_DIR")/VibeCodeServicesVibeCode.entitlements"
BINARY="$APP_DIR/Contents/MacOS/VibeCodeServicesVibeCode"
SOURCE="$(dirname "$APP_DIR")/VibeCodeServicesVibeCode.swift"

echo "Building VibeCodeServicesVibeCode..."

swiftc -target arm64-apple-macosx14.0 \
    -parse-as-library \
    -framework Cocoa \
    -framework Virtualization \
    -o "$BINARY" \
    "$SOURCE"

# Source stays outside bundle, no need to remove

echo "Signing binary with entitlements..."
codesign --force --sign - --entitlements "$ENTITLEMENTS" "$BINARY"

echo "✅ Build complete: $APP_DIR"
echo ""
echo "Run with: open '$APP_DIR'"
