#!/bin/bash
# EFI NVRAM Initialization Wrapper
# Compiles and runs the Swift EFI initialization tool

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TOOL_DIR="$SCRIPT_DIR/../tools/efi-init"

# Check macOS version
if ! sw_vers -productVersion | grep -qE "^1[3-9]\.|^[2-9][0-9]\."; then
    echo "❌ This tool requires macOS 13.0 (Ventura) or later"
    exit 1
fi

# Build the tool if needed
if [ ! -f "$TOOL_DIR/.build/debug/efi-init" ] || [ "$TOOL_DIR/Sources/main.swift" -nt "$TOOL_DIR/.build/debug/efi-init" ]; then
    echo "🔨 Building EFI initialization tool..."
    cd "$TOOL_DIR"
    swift build -c debug > /dev/null 2>&1
    echo "✅ Build complete"
fi

# Run the tool
exec "$TOOL_DIR/.build/debug/efi-init" "$@"
