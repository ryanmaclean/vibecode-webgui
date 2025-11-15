#!/bin/bash
# Build standalone OpenVSCode VM with code signing
# Requires: macOS 26.0+ (Tahoe), Swift 5.9+

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="${SCRIPT_DIR}/.build"
BINARY_NAME="vibecode-vm-standalone"
ENTITLEMENTS="${SCRIPT_DIR}/vibecode-vm.entitlements"

echo "🔨 Building Standalone OpenVSCode VM..."
echo "   Swift: $(swift --version | head -1)"
echo ""

# Build
cd "$SCRIPT_DIR"
swift build -c release

# Copy binary to bin directory
mkdir -p "${SCRIPT_DIR}/../bin"
cp "${BUILD_DIR}/release/${BINARY_NAME}" "${SCRIPT_DIR}/../bin/${BINARY_NAME}"

# Code sign with entitlements
if [ -f "$ENTITLEMENTS" ]; then
    echo "🔐 Code signing with entitlements..."
    codesign --sign - --entitlements "$ENTITLEMENTS" --force "${SCRIPT_DIR}/../bin/${BINARY_NAME}"
    echo "✅ Code signed"
else
    echo "⚠️  Warning: Entitlements file not found, VM may not work"
fi

chmod +x "${SCRIPT_DIR}/../bin/${BINARY_NAME}"

echo ""
echo "✅ Build complete!"
echo "   Binary: ${SCRIPT_DIR}/../bin/${BINARY_NAME}"
echo ""
echo "Verification:"
codesign -vv "${SCRIPT_DIR}/../bin/${BINARY_NAME}" 2>&1 | head -2
