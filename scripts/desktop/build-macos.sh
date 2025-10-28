#!/usr/bin/env bash

# VibeCode Desktop - macOS Build Script
# Builds universal binary for both Intel and Apple Silicon

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Build configuration
BUILD_TYPE="${BUILD_TYPE:-release}"
SIGN_BUILD="${SIGN_BUILD:-false}"
CREATE_DMG="${CREATE_DMG:-true}"

echo -e "${GREEN}VibeCode Desktop - macOS Build Script${NC}"
echo "========================================="
echo "Project Root: $PROJECT_ROOT"
echo "Build Type: $BUILD_TYPE"
echo "Sign Build: $SIGN_BUILD"
echo "Create DMG: $CREATE_DMG"
echo ""

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

# Check for required tools
command -v node >/dev/null 2>&1 || { echo -e "${RED}Error: Node.js not found${NC}"; exit 1; }
command -v npm >/dev/null 2>&1 || { echo -e "${RED}Error: npm not found${NC}"; exit 1; }
command -v cargo >/dev/null 2>&1 || { echo -e "${RED}Error: Rust/Cargo not found${NC}"; exit 1; }
command -v rustc >/dev/null 2>&1 || { echo -e "${RED}Error: Rust compiler not found${NC}"; exit 1; }

echo "✓ Node.js $(node --version)"
echo "✓ npm v$(npm --version)"
echo "✓ Rust $(rustc --version)"

# Check for macOS-specific tools
if ! command -v pkg-config >/dev/null 2>&1; then
    echo -e "${YELLOW}Warning: pkg-config not found. Installing via Homebrew...${NC}"
    brew install pkg-config
fi

if ! brew list openssl@3 >/dev/null 2>&1; then
    echo -e "${YELLOW}Warning: openssl@3 not found. Installing via Homebrew...${NC}"
    brew install openssl@3
fi

# Setup environment
export PKG_CONFIG_PATH="/opt/homebrew/opt/openssl@3/lib/pkgconfig:$PKG_CONFIG_PATH"
export NEXT_CONFIG_FILE="next.config.tauri.js"

# Install Rust targets
echo -e "${YELLOW}Installing Rust targets...${NC}"
rustup target add x86_64-apple-darwin aarch64-apple-darwin

# Navigate to project root
cd "$PROJECT_ROOT"

# Install dependencies
echo -e "${YELLOW}Installing npm dependencies...${NC}"
npm ci --legacy-peer-deps

# Build frontend
echo -e "${YELLOW}Building frontend...${NC}"
npm run build

# Determine build command
if [ "$BUILD_TYPE" = "debug" ]; then
    BUILD_CMD="npm run tauri build -- --debug --target universal-apple-darwin"
else
    BUILD_CMD="npm run tauri build -- --target universal-apple-darwin"
fi

# Build Tauri app
echo -e "${YELLOW}Building Tauri application...${NC}"
eval "$BUILD_CMD"

# Build artifacts location
BUNDLE_DIR="$PROJECT_ROOT/src-tauri/target/universal-apple-darwin/$BUILD_TYPE/bundle"
APP_PATH="$BUNDLE_DIR/macos/VibeCode.app"
DMG_DIR="$BUNDLE_DIR/dmg"

# Verify build
if [ ! -d "$APP_PATH" ]; then
    echo -e "${RED}Error: Build failed - app bundle not found${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Build successful${NC}"
echo "App bundle: $APP_PATH"

# Code signing
if [ "$SIGN_BUILD" = "true" ]; then
    echo -e "${YELLOW}Signing application...${NC}"

    if [ -z "${APPLE_SIGNING_IDENTITY:-}" ]; then
        echo -e "${RED}Error: APPLE_SIGNING_IDENTITY not set${NC}"
        exit 1
    fi

    ENTITLEMENTS="$PROJECT_ROOT/src-tauri/entitlements.plist"

    if [ ! -f "$ENTITLEMENTS" ]; then
        echo -e "${RED}Error: entitlements.plist not found${NC}"
        exit 1
    fi

    codesign --force --deep --sign "$APPLE_SIGNING_IDENTITY" \
        --options runtime \
        --entitlements "$ENTITLEMENTS" \
        --timestamp \
        "$APP_PATH"

    # Verify signature
    codesign --verify --deep --strict --verbose=2 "$APP_PATH"

    echo -e "${GREEN}✓ Application signed${NC}"
fi

# Create DMG
if [ "$CREATE_DMG" = "true" ]; then
    echo -e "${YELLOW}Creating DMG installer...${NC}"

    mkdir -p "$DMG_DIR"

    # Install create-dmg if not available
    if ! command -v create-dmg >/dev/null 2>&1; then
        echo "Installing create-dmg..."
        npm install -g create-dmg
    fi

    DMG_NAME="VibeCode_$(date +%Y%m%d).dmg"

    # Create DMG with custom styling
    create-dmg \
        --volname "VibeCode" \
        --volicon "$PROJECT_ROOT/src-tauri/icons/icon.icns" \
        --window-pos 200 120 \
        --window-size 800 400 \
        --icon-size 100 \
        --icon "VibeCode.app" 200 190 \
        --hide-extension "VibeCode.app" \
        --app-drop-link 600 185 \
        --no-internet-enable \
        "$DMG_DIR/$DMG_NAME" \
        "$APP_PATH" || {
            # Fallback: simple DMG creation
            echo "Falling back to hdiutil..."
            hdiutil create -volname "VibeCode" \
                -srcfolder "$APP_PATH" \
                -ov -format UDZO \
                "$DMG_DIR/$DMG_NAME"
        }

    echo -e "${GREEN}✓ DMG created: $DMG_DIR/$DMG_NAME${NC}"

    # Sign DMG if signing is enabled
    if [ "$SIGN_BUILD" = "true" ]; then
        echo -e "${YELLOW}Signing DMG...${NC}"

        codesign --force --sign "$APPLE_SIGNING_IDENTITY" \
            --timestamp \
            "$DMG_DIR/$DMG_NAME"

        codesign --verify --verbose=2 "$DMG_DIR/$DMG_NAME"

        echo -e "${GREEN}✓ DMG signed${NC}"
    fi

    # Generate checksums
    echo -e "${YELLOW}Generating checksums...${NC}"
    cd "$DMG_DIR"
    shasum -a 256 "$DMG_NAME" > "$DMG_NAME.sha256"
    shasum -a 512 "$DMG_NAME" > "$DMG_NAME.sha512"

    echo "SHA256:"
    cat "$DMG_NAME.sha256"
fi

# Create app tarball
echo -e "${YELLOW}Creating app bundle archive...${NC}"
TARBALL_NAME="VibeCode.app.tar.gz"
cd "$(dirname "$APP_PATH")"
tar -czf "$TARBALL_NAME" "$(basename "$APP_PATH")"
echo -e "${GREEN}✓ Archive created: $(dirname "$APP_PATH")/$TARBALL_NAME${NC}"

# Summary
echo ""
echo -e "${GREEN}========================================="
echo "Build Complete!"
echo "=========================================${NC}"
echo ""
echo "Build artifacts:"
echo "  App Bundle: $APP_PATH"
if [ "$CREATE_DMG" = "true" ]; then
    echo "  DMG: $DMG_DIR/$DMG_NAME"
    echo "  SHA256: $DMG_DIR/$DMG_NAME.sha256"
    echo "  SHA512: $DMG_DIR/$DMG_NAME.sha512"
fi
echo "  Archive: $(dirname "$APP_PATH")/$TARBALL_NAME"
echo ""

# App size
APP_SIZE=$(du -sh "$APP_PATH" | cut -f1)
echo "App size: $APP_SIZE"

if [ "$CREATE_DMG" = "true" ]; then
    DMG_SIZE=$(ls -lh "$DMG_DIR/$DMG_NAME" | awk '{print $5}')
    echo "DMG size: $DMG_SIZE"
fi

echo ""
echo -e "${GREEN}Done!${NC}"
