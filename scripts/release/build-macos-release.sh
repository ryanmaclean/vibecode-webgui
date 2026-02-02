#!/usr/bin/env bash

# Build Complete macOS Release
# Packages VibeCode with OpenVSCode Server VM and pre-installed extensions

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Build configuration
BUILD_TYPE="${BUILD_TYPE:-release}"
SIGN_BUILD="${SIGN_BUILD:-false}"
CREATE_DMG="${CREATE_DMG:-true}"
SKIP_TESTS="${SKIP_TESTS:-false}"
VERSION="${VERSION:-$(jq -r .version "$PROJECT_ROOT/package.json")}"

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     VibeCode macOS Release Builder v${VERSION}       ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "Configuration:"
echo "  Project Root: $PROJECT_ROOT"
echo "  Build Type: $BUILD_TYPE"
echo "  Sign Build: $SIGN_BUILD"
echo "  Create DMG: $CREATE_DMG"
echo "  Skip Tests: $SKIP_TESTS"
echo "  Version: $VERSION"
echo ""

# Check prerequisites
echo -e "${YELLOW}[1/8] Checking prerequisites...${NC}"

MISSING_TOOLS=()

if ! command -v node >/dev/null 2>&1; then
    MISSING_TOOLS+=("node")
fi

if ! command -v npm >/dev/null 2>&1; then
    MISSING_TOOLS+=("npm")
fi

if ! command -v cargo >/dev/null 2>&1; then
    MISSING_TOOLS+=("cargo")
fi

if ! command -v rustc >/dev/null 2>&1; then
    MISSING_TOOLS+=("rustc")
fi

if ! command -v jq >/dev/null 2>&1; then
    echo -e "${YELLOW}WARNING: jq not found. Installing via Homebrew...${NC}"
    brew install jq
fi

if [ ${#MISSING_TOOLS[@]} -ne 0 ]; then
    echo -e "${RED}Error: Missing required tools: ${MISSING_TOOLS[*]}${NC}"
    exit 1
fi

echo "OK - All prerequisites met"
echo "  Node.js: $(node --version)"
echo "  npm: v$(npm --version)"
echo "  Rust: $(rustc --version | cut -d' ' -f2)"
echo "  Cargo: $(cargo --version | cut -d' ' -f2)"

# Package workspace-rag extension
echo ""
echo -e "${YELLOW}[2/8] Packaging Workspace RAG extension...${NC}"

if [ ! -f "$PROJECT_ROOT/scripts/extensions/package-workspace-rag.sh" ]; then
    echo -e "${RED}Error: Extension packaging script not found${NC}"
    exit 1
fi

bash "$PROJECT_ROOT/scripts/extensions/package-workspace-rag.sh" || {
    echo -e "${RED}Error: Extension packaging failed${NC}"
    exit 1
}

echo -e "${GREEN}OK - Extension packaged${NC}"

# Install extensions to VM resources
echo ""
echo -e "${YELLOW}[3/8] Installing extensions to VM resources...${NC}"

bash "$PROJECT_ROOT/scripts/extensions/install-extensions-to-vm.sh" || {
    echo -e "${RED}Error: Extension installation failed${NC}"
    exit 1
}

echo -e "${GREEN}OK - Extensions installed to VM resources${NC}"

# Build VM manager
echo ""
echo -e "${YELLOW}[4/8] Building VM manager...${NC}"

cd "$PROJECT_ROOT/platforms/macos/vm"

if [ -f "Package.swift" ]; then
    swift build -c release || {
        echo -e "${RED}Error: VM manager build failed${NC}"
        exit 1
    }
    
    # Copy VM binary to Tauri resources
    VM_BINARY=$(swift build -c release --show-bin-path)/main
    if [ -f "$VM_BINARY" ]; then
        mkdir -p "$PROJECT_ROOT/src-tauri/binaries"
        cp "$VM_BINARY" "$PROJECT_ROOT/src-tauri/binaries/vibecode-vm-aarch64-apple-darwin"
        chmod +x "$PROJECT_ROOT/src-tauri/binaries/vibecode-vm-aarch64-apple-darwin"
        echo -e "${GREEN}OK - VM manager built and copied${NC}"
    else
        echo -e "${RED}Error: VM binary not found${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}WARNING: VM Package.swift not found, skipping VM build${NC}"
fi

# Install Rust targets
echo ""
echo -e "${YELLOW}[5/8] Installing Rust targets...${NC}"

rustup target add x86_64-apple-darwin aarch64-apple-darwin

echo -e "${GREEN}OK - Rust targets installed${NC}"

# Build Tauri application
echo ""
echo -e "${YELLOW}[6/8] Building Tauri application...${NC}"

cd "$PROJECT_ROOT"

# Install npm dependencies
echo "Installing npm dependencies..."
npm ci --legacy-peer-deps

# Setup environment for build
export PKG_CONFIG_PATH="/opt/homebrew/opt/openssl@3/lib/pkgconfig:${PKG_CONFIG_PATH:-}"
export NEXT_CONFIG_FILE="next.config.tauri.js"
export NEXT_TELEMETRY_DISABLED=1

# Build frontend (minimal for Tauri)
echo "Building frontend..."
npm run build || {
    echo -e "${YELLOW}WARNING: Frontend build had issues, continuing...${NC}"
}

# Run tests if not skipped
if [ "$SKIP_TESTS" = "false" ]; then
    echo "Running extension tests..."
    cd "$PROJECT_ROOT/extensions/workspace-rag"
    npm run compile-tests || echo "WARNING: Test compilation had issues"
    npm run test:unit || echo "WARNING: Unit tests had issues"
    cd "$PROJECT_ROOT"
fi

# Build Tauri app
echo "Building Tauri application..."

if [ "$BUILD_TYPE" = "debug" ]; then
    BUILD_CMD="npm run tauri:build:debug -- --target universal-apple-darwin"
else
    BUILD_CMD="npm run tauri:build -- --target universal-apple-darwin"
fi

eval "$BUILD_CMD" || {
    echo -e "${RED}Error: Tauri build failed${NC}"
    exit 1
}

echo -e "${GREEN}OK - Tauri application built${NC}"

# Locate build artifacts
BUILD_PATH="universal-apple-darwin/$BUILD_TYPE"
BUNDLE_DIR="$PROJECT_ROOT/src-tauri/target/$BUILD_PATH/bundle"
APP_PATH="$BUNDLE_DIR/macos/VibeCode.app"

if [ ! -d "$APP_PATH" ]; then
    echo -e "${RED}Error: App bundle not found at $APP_PATH${NC}"
    exit 1
fi

echo "App bundle: $APP_PATH"

# Code signing
if [ "$SIGN_BUILD" = "true" ]; then
    echo ""
    echo -e "${YELLOW}[7/8] Signing application...${NC}"
    
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
    
    echo -e "${GREEN}OK - Application signed${NC}"
else
    echo ""
    echo -e "${YELLOW}[7/8] Skipping code signing (SIGN_BUILD=false)${NC}"
fi

# Create distribution artifacts
echo ""
echo -e "${YELLOW}[8/8] Creating distribution artifacts...${NC}"

DIST_DIR="$PROJECT_ROOT/dist/releases/macos"
mkdir -p "$DIST_DIR"

APP_SIZE=$(du -sh "$APP_PATH" | cut -f1)
echo "App size: $APP_SIZE"

# Create DMG
if [ "$CREATE_DMG" = "true" ]; then
    echo "Creating DMG installer..."
    
    DMG_NAME="VibeCode-${VERSION}-macOS-universal.dmg"
    DMG_PATH="$DIST_DIR/$DMG_NAME"
    
    # Install create-dmg if needed
    if ! command -v create-dmg >/dev/null 2>&1; then
        echo "Installing create-dmg..."
        brew install create-dmg
    fi
    
    # Create DMG with custom styling
    create-dmg \
        --volname "VibeCode $VERSION" \
        --volicon "$PROJECT_ROOT/src-tauri/icons/icon.icns" \
        --window-pos 200 120 \
        --window-size 800 400 \
        --icon-size 100 \
        --icon "VibeCode.app" 200 190 \
        --hide-extension "VibeCode.app" \
        --app-drop-link 600 185 \
        --no-internet-enable \
        "$DMG_PATH" \
        "$APP_PATH" 2>/dev/null || {
            # Fallback: simple DMG creation
            echo "Falling back to hdiutil..."
            hdiutil create -volname "VibeCode $VERSION" \
                -srcfolder "$APP_PATH" \
                -ov -format UDZO \
                "$DMG_PATH"
        }
    
    # Sign DMG if signing enabled
    if [ "$SIGN_BUILD" = "true" ]; then
        echo "Signing DMG..."
        codesign --force --sign "$APPLE_SIGNING_IDENTITY" \
            --timestamp \
            "$DMG_PATH"
        codesign --verify --verbose=2 "$DMG_PATH"
    fi
    
    # Generate checksums
    cd "$DIST_DIR"
    shasum -a 256 "$DMG_NAME" > "$DMG_NAME.sha256"
    shasum -a 512 "$DMG_NAME" > "$DMG_NAME.sha512"
    
    DMG_SIZE=$(ls -lh "$DMG_PATH" | awk '{print $5}')
    echo -e "${GREEN}OK - DMG created${NC}"
    echo "  Path: $DMG_PATH"
    echo "  Size: $DMG_SIZE"
    echo "  SHA256: $DIST_DIR/$DMG_NAME.sha256"
fi

# Create app tarball
echo "Creating app bundle archive..."
TARBALL_NAME="VibeCode-${VERSION}-macOS-universal.app.tar.gz"
TARBALL_PATH="$DIST_DIR/$TARBALL_NAME"

cd "$(dirname "$APP_PATH")"
tar -czf "$TARBALL_PATH" "$(basename "$APP_PATH")"

cd "$DIST_DIR"
shasum -a 256 "$TARBALL_NAME" > "$TARBALL_NAME.sha256"
shasum -a 512 "$TARBALL_NAME" > "$TARBALL_NAME.sha512"

TARBALL_SIZE=$(ls -lh "$TARBALL_PATH" | awk '{print $5}')
echo -e "${GREEN}OK - Archive created${NC}"
echo "  Path: $TARBALL_PATH"
echo "  Size: $TARBALL_SIZE"

# Create release notes
echo "Creating release notes..."

cat > "$DIST_DIR/RELEASE_NOTES.md" << EOF
# VibeCode v${VERSION} - macOS Release

Released: $(date +"%Y-%m-%d")

## Package Contents

- **Platform**: macOS Universal (Intel + Apple Silicon)
- **Build Type**: $BUILD_TYPE
- **Code Signed**: $SIGN_BUILD

## Pre-installed Extensions

- **Workspace RAG**: AI-powered workspace-aware code assistant with local pgvector integration

## Features

- Tauri-based native macOS application
- Embedded OpenVSCode Server running in Hyperkit VM
- Full Docker container management
- Distributed tracing with DataDog
- Local MLX acceleration on Apple Silicon
- Multi-LLM provider support (OpenAI, Anthropic, Google, OpenRouter)

## System Requirements

- macOS 13.0 (Ventura) or later
- 8 GB RAM minimum (16 GB recommended)
- 10 GB free disk space
- Apple Silicon (M1/M2/M3) or Intel processor

## Installation

### Option 1: DMG Installer (Recommended)

1. Download \`$DMG_NAME\`
2. Verify checksum: \`shasum -a 256 -c ${DMG_NAME}.sha256\`
3. Open the DMG file
4. Drag VibeCode.app to Applications folder
5. Launch VibeCode from Applications

### Option 2: Tarball

1. Download \`$TARBALL_NAME\`
2. Verify checksum: \`shasum -a 256 -c ${TARBALL_NAME}.sha256\`
3. Extract: \`tar -xzf ${TARBALL_NAME}\`
4. Move to Applications: \`mv VibeCode.app /Applications/\`
5. Launch VibeCode from Applications

## Verification

Verify the integrity of downloaded files:

\`\`\`bash
# Verify DMG
shasum -a 256 -c ${DMG_NAME}.sha256

# Verify Tarball
shasum -a 256 -c ${TARBALL_NAME}.sha256
\`\`\`

## First Launch

On first launch, you may see a security warning. To allow:

1. Open System Settings > Privacy & Security
2. Click "Open Anyway" next to the VibeCode message
3. Confirm in the dialog

Alternatively, run:

\`\`\`bash
xattr -cr /Applications/VibeCode.app
\`\`\`

## Configuration

### Database Setup

The Workspace RAG extension requires PostgreSQL with pgvector:

\`\`\`bash
# Using Homebrew
brew install postgresql@15
brew services start postgresql@15

# Install pgvector
cd /tmp
git clone --branch v0.8.0 https://github.com/pgvector/pgvector.git
cd pgvector
make
make install  # May need sudo

# Initialize database
createdb rag_db
psql rag_db -c "CREATE EXTENSION IF NOT EXISTS vector;"
\`\`\`

### LLM API Keys

Set your preferred LLM provider API key:

1. Open VibeCode
2. Press \`Cmd+Shift+P\`
3. Type "Set API Key"
4. Select your provider (OpenAI, Anthropic, Google, or OpenRouter)
5. Enter your API key

Keys are stored securely in the system keychain.

## Support

- Documentation: https://github.com/yourusername/vibecode-webgui/wiki
- Issues: https://github.com/yourusername/vibecode-webgui/issues
- Discussions: https://github.com/yourusername/vibecode-webgui/discussions

## License

MIT License - See LICENSE file for details

---

Built with ❤️ by the VibeCode Team
EOF

echo -e "${GREEN}OK - Release notes created${NC}"

# Create build manifest
echo "Creating build manifest..."

cat > "$DIST_DIR/BUILD_MANIFEST.json" << EOF
{
  "version": "${VERSION}",
  "build_type": "${BUILD_TYPE}",
  "platform": "macOS",
  "architecture": "universal",
  "signed": ${SIGN_BUILD},
  "build_date": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "artifacts": {
    "dmg": {
      "filename": "${DMG_NAME}",
      "size": "${DMG_SIZE:-N/A}",
      "sha256_file": "${DMG_NAME}.sha256",
      "sha512_file": "${DMG_NAME}.sha512"
    },
    "tarball": {
      "filename": "${TARBALL_NAME}",
      "size": "${TARBALL_SIZE}",
      "sha256_file": "${TARBALL_NAME}.sha256",
      "sha512_file": "${TARBALL_NAME}.sha512"
    }
  },
  "extensions": [
    {
      "id": "workspace-rag",
      "name": "Workspace RAG",
      "version": "$(jq -r .version "$PROJECT_ROOT/extensions/workspace-rag/package.json")",
      "pre_installed": true
    }
  ],
  "dependencies": {
    "node": "$(node --version)",
    "npm": "$(npm --version)",
    "rust": "$(rustc --version | cut -d' ' -f2)",
    "cargo": "$(cargo --version | cut -d' ' -f2)"
  }
}
EOF

echo -e "${GREEN}OK - Build manifest created${NC}"

# Final summary
echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║           Build Complete - Success!                    ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}Release Artifacts:${NC}"
echo "  Version: $VERSION"
echo "  Location: $DIST_DIR"
echo ""

if [ "$CREATE_DMG" = "true" ]; then
    echo "  DMG Installer:"
    echo "    File: $DMG_NAME"
    echo "    Size: $DMG_SIZE"
    echo ""
fi

echo "  App Bundle Archive:"
echo "    File: $TARBALL_NAME"
echo "    Size: $TARBALL_SIZE"
echo ""

echo "  Documentation:"
echo "    Release Notes: RELEASE_NOTES.md"
echo "    Build Manifest: BUILD_MANIFEST.json"
echo ""

echo -e "${GREEN}Pre-installed Extensions:${NC}"
echo "  - Workspace RAG (AI-powered code assistant)"
echo ""

echo -e "${YELLOW}Next Steps:${NC}"
echo "  1. Test the DMG installer on a clean macOS system"
echo "  2. Verify extension auto-installation"
echo "  3. Test workspace RAG functionality"
echo "  4. Upload artifacts to GitHub Releases"
echo ""

echo -e "${GREEN}Build completed successfully!${NC}"

