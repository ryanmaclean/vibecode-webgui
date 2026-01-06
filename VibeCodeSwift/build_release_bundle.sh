#!/bin/bash
set -e

APP_NAME="VibeCode"
BUILD_DIR=".build/arm64-apple-macosx/release"
BUNDLE_DIR="$BUILD_DIR/$APP_NAME.app"

echo "📦 Creating app bundle structure..."
mkdir -p "$BUNDLE_DIR/Contents/MacOS"
mkdir -p "$BUNDLE_DIR/Contents/Resources"

echo "📋 Copying executable..."
cp "$BUILD_DIR/$APP_NAME" "$BUNDLE_DIR/Contents/MacOS/$APP_NAME"

echo "📋 Copying Info.plist..."
cp Info.plist "$BUNDLE_DIR/Contents/Info.plist"

echo "🔐 Signing app bundle..."
codesign --force --deep --sign - --entitlements VibeCode.entitlements "$BUNDLE_DIR"

echo "✅ App bundle created at: $BUNDLE_DIR"
echo "📍 Full path: $(pwd)/$BUNDLE_DIR"
