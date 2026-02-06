#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

set -euo pipefail

# Apple Container Runtime Build Script
#
# Builds the Swift runtime executable and prepares for deployment

# Initialize log aggregation
init_log_aggregation


SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RUNTIME_DIR="$PROJECT_ROOT/AppleContainerRuntime"

BUILD_TYPE="${1:-release}"
VERBOSE="${VERBOSE:-false}"

echo "Building Apple Container Runtime..."
echo "Build type: $BUILD_TYPE"
echo "Project root: $PROJECT_ROOT"

# Check macOS version
if [[ $(sw_vers -productVersion | cut -d. -f1) -lt 14 ]]; then
    echo "Error: macOS 14.0 or later is required"
    exit 1
fi

# Check architecture
ARCH=$(uname -m)
if [[ "$ARCH" != "arm64" ]]; then
    echo "Error: Apple Silicon (arm64) is required"
    exit 1
fi

# Check Swift version
if ! command -v swift &> /dev/null; then
    echo "Error: Swift is not installed"
    echo "Install Xcode from the App Store or download Swift from swift.org"
    exit 1
fi

SWIFT_VERSION=$(swift --version | head -n1)
echo "Swift version: $SWIFT_VERSION"

# Navigate to runtime directory
cd "$RUNTIME_DIR"

# Clean previous build
if [[ "$BUILD_TYPE" == "clean" ]]; then
    echo "Cleaning build artifacts..."
    rm -rf .build
    exit 0
fi

# Build Swift package
echo "Building Swift package..."
if [[ "$VERBOSE" == "true" ]]; then
    swift build -c "$BUILD_TYPE" -v
else
    swift build -c "$BUILD_TYPE"
fi

# Create bin directory
mkdir -p "$PROJECT_ROOT/bin"

# Copy executable
EXECUTABLE=".build/$BUILD_TYPE/apple-container-runtime"
if [[ -f "$EXECUTABLE" ]]; then
    cp "$EXECUTABLE" "$PROJECT_ROOT/bin/"
    chmod +x "$PROJECT_ROOT/bin/apple-container-runtime"
    echo "Executable copied to: $PROJECT_ROOT/bin/apple-container-runtime"
else
    echo "Error: Executable not found at $EXECUTABLE"
    exit 1
fi

# Run tests
if [[ "${RUN_TESTS:-true}" == "true" ]]; then
    echo "Running tests..."
    swift test -c "$BUILD_TYPE"
fi

# Create required directories
echo "Creating runtime directories..."
mkdir -p ~/.vibecode/containers/instances
mkdir -p ~/.vibecode/containers/images
mkdir -p ~/.vibecode/containers/bundles

echo "Build complete!"
echo ""
echo "To run the runtime:"
echo "  $PROJECT_ROOT/bin/apple-container-runtime --help"
echo ""
echo "To install system-wide (requires sudo):"
echo "  sudo ./scripts/install-runtime.sh"
