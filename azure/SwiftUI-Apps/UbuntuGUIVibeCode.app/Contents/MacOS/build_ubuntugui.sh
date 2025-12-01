#!/bin/bash
set -e

cd "$(dirname "$0")"
APP_DIR="/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/UbuntuGUIVibeCode.app"

echo "Building UbuntuGUIVibeCode..."

swiftc -target arm64-apple-macosx14.0 \
    -parse-as-library \
    -framework Cocoa \
    -framework Virtualization \
    -o "$APP_DIR/Contents/MacOS/UbuntuGUIVibeCode" \
    "$APP_DIR/Contents/MacOS/UbuntuGUIVibeCode.swift"

echo "✅ Build complete: $APP_DIR"
echo ""
echo "Run with: open '$APP_DIR'"
