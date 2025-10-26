#!/usr/bin/env bash

# VibeCode Desktop - Build All Platforms
# Convenience script for building on all supported platforms

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo -e "${BLUE}"
echo "╔═══════════════════════════════════════╗"
echo "║  VibeCode Desktop - Build All        ║"
echo "╚═══════════════════════════════════════╝"
echo -e "${NC}"

# Detect platform
PLATFORM=$(uname -s)
case "$PLATFORM" in
    Darwin)
        PLATFORM_NAME="macOS"
        ;;
    Linux)
        PLATFORM_NAME="Linux"
        ;;
    MINGW*|MSYS*|CYGWIN*)
        PLATFORM_NAME="Windows"
        ;;
    *)
        echo -e "${RED}Unsupported platform: $PLATFORM${NC}"
        exit 1
        ;;
esac

echo "Detected platform: $PLATFORM_NAME"
echo ""

# Parse arguments
BUILD_CURRENT_ONLY=false
BUILD_TYPE="release"

while [[ $# -gt 0 ]]; do
    case $1 in
        --current-only)
            BUILD_CURRENT_ONLY=true
            shift
            ;;
        --debug)
            BUILD_TYPE="debug"
            shift
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --current-only    Only build for current platform"
            echo "  --debug           Build in debug mode"
            echo "  --help            Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                      # Build for current platform"
            echo "  $0 --debug              # Debug build for current platform"
            echo ""
            echo "Note: Cross-platform builds require platform-specific setup."
            echo "See docs/DESKTOP_BUILD_GUIDE.md for details."
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

cd "$PROJECT_ROOT"

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

if ! command -v node >/dev/null 2>&1; then
    echo -e "${RED}Error: Node.js not found${NC}"
    exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
    echo -e "${RED}Error: npm not found${NC}"
    exit 1
fi

if ! command -v cargo >/dev/null 2>&1; then
    echo -e "${RED}Error: Rust/Cargo not found${NC}"
    exit 1
fi

echo "✓ Node.js $(node --version)"
echo "✓ npm v$(npm --version)"
echo "✓ Rust $(rustc --version)"
echo ""

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    npm ci --legacy-peer-deps
    echo ""
fi

# Build function
build_platform() {
    local platform=$1
    local script=$2

    echo -e "${BLUE}╔═══════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║  Building for $platform${NC}"
    echo -e "${BLUE}╚═══════════════════════════════════════╝${NC}"
    echo ""

    if [ -f "$script" ]; then
        BUILD_TYPE="$BUILD_TYPE" bash "$script"
        local status=$?
        echo ""

        if [ $status -eq 0 ]; then
            echo -e "${GREEN}✓ $platform build completed successfully${NC}"
        else
            echo -e "${RED}✗ $platform build failed${NC}"
            return $status
        fi
    else
        echo -e "${RED}Build script not found: $script${NC}"
        return 1
    fi

    echo ""
}

# Build for current platform
case "$PLATFORM_NAME" in
    macOS)
        build_platform "macOS" "$SCRIPT_DIR/build-macos.sh"
        ;;
    Linux)
        build_platform "Linux" "$SCRIPT_DIR/build-linux.sh"
        ;;
    Windows)
        echo -e "${YELLOW}For Windows, please use PowerShell:${NC}"
        echo "  .\scripts\desktop\build-windows.ps1"
        exit 0
        ;;
esac

# Summary
echo -e "${GREEN}╔═══════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Build Complete!                      ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════╝${NC}"
echo ""
echo "Build artifacts location:"
echo "  src-tauri/target/*/release/bundle/"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Test the build on your platform"
echo "2. Verify package installation"
echo "3. Run functional tests"
echo "4. Create release tag when ready"
echo ""
echo "For testing guidance, see:"
echo "  docs/DESKTOP_BUILD_TESTING.md"
echo ""
