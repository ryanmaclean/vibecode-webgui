#!/bin/bash
# MIT License - Run VibeCode (rebuild if needed)

set -e

cd "$(dirname "$0")/../VibeCodeSwift"

# Check if binary exists and is newer than source
BINARY=".build/arm64-apple-macosx/release/VibeCode"
NEEDS_BUILD=false

if [ ! -f "$BINARY" ]; then
    NEEDS_BUILD=true
else
    # Check if any source files are newer than the binary
    if find Sources -type f -newer "$BINARY" | grep -q .; then
        NEEDS_BUILD=true
    fi
fi

if [ "$NEEDS_BUILD" = true ]; then
    echo "🔨 Building VibeCode..."
    swift build -c release
fi

# Kill any existing instances
pkill VibeCode 2>/dev/null || true
sleep 0.5

# Sign with entitlements (ad-hoc signing for local dev)
echo "🔐 Signing binary..."
codesign --force --sign - --entitlements VibeCode.entitlements "$BINARY"

# Run
echo "🚀 Launching VibeCode..."
echo ""
exec "$BINARY"


