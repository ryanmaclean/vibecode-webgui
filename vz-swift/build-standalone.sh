#!/bin/bash
# Build standalone OpenVSCode VM
# Requires: macOS 26.0+ (Tahoe), Swift 5.9+

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="${SCRIPT_DIR}/.build"
BINARY_NAME="vibecode-vm-standalone"

echo "🔨 Building Standalone OpenVSCode VM..."
echo "   Swift: $(swift --version | head -1)"
echo ""

# Build
cd "$SCRIPT_DIR"
swift build -c release

# Copy binary to bin directory
mkdir -p "${SCRIPT_DIR}/../bin"
cp "${BUILD_DIR}/release/${BINARY_NAME}" "${SCRIPT_DIR}/../bin/${BINARY_NAME}"
chmod +x "${SCRIPT_DIR}/../bin/${BINARY_NAME}"

echo ""
echo "✅ Build complete!"
echo "   Binary: ${SCRIPT_DIR}/../bin/${BINARY_NAME}"
