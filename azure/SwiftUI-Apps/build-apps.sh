#!/bin/bash
set -e

echo "=== Building VibeCode SwiftUI Applications ==="

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Compile BasicVibeCode
echo ""
echo "Compiling BasicVibeCodeApp..."
swiftc -o BasicVibeCodeApp \
    BasicVibeCodeApp.swift \
    DHCPLeaseParser.swift \
    -framework SwiftUI \
    -framework Virtualization \
    -framework Network \
    -target arm64-apple-macos13.0

if [ $? -eq 0 ]; then
    echo "  Successfully compiled BasicVibeCodeApp"
    ls -lh BasicVibeCodeApp
else
    echo "  ERROR: Failed to compile BasicVibeCodeApp"
    exit 1
fi

# Compile LiquidGlassVibeCode
echo ""
echo "Compiling LiquidGlassVibeCodeApp..."
swiftc -o LiquidGlassVibeCodeApp \
    LiquidGlassVibeCodeApp.swift \
    DHCPLeaseParser.swift \
    DatadogLogger.swift \
    DogStatsDClient.swift \
    -framework SwiftUI \
    -framework Virtualization \
    -framework Network \
    -target arm64-apple-macos13.0

if [ $? -eq 0 ]; then
    echo "  Successfully compiled LiquidGlassVibeCodeApp"
    ls -lh LiquidGlassVibeCodeApp
else
    echo "  ERROR: Failed to compile LiquidGlassVibeCodeApp"
    exit 1
fi

echo ""
echo "=== Compilation Complete ==="
echo ""
echo "Executables ready:"
ls -lh BasicVibeCodeApp LiquidGlassVibeCodeApp

echo ""
echo "Next steps:"
echo "  1. Run ./bundle-apps.sh to create signed .app bundles"
echo "  2. Test with: open BasicVibeCode.app"
echo ""
