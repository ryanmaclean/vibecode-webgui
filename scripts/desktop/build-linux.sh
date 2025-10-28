#!/usr/bin/env bash

# VibeCode Desktop - Linux Build Script
# Builds .deb, .AppImage, and .rpm packages for x86_64 and ARM64

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
ARCH="${ARCH:-x86_64}"  # x86_64 or arm64
CREATE_DEB="${CREATE_DEB:-true}"
CREATE_APPIMAGE="${CREATE_APPIMAGE:-true}"
CREATE_RPM="${CREATE_RPM:-true}"

echo -e "${GREEN}VibeCode Desktop - Linux Build Script${NC}"
echo "========================================="
echo "Project Root: $PROJECT_ROOT"
echo "Build Type: $BUILD_TYPE"
echo "Architecture: $ARCH"
echo "Create .deb: $CREATE_DEB"
echo "Create .AppImage: $CREATE_APPIMAGE"
echo "Create .rpm: $CREATE_RPM"
echo ""

# Determine Rust target based on architecture
if [ "$ARCH" = "x86_64" ]; then
    RUST_TARGET="x86_64-unknown-linux-gnu"
elif [ "$ARCH" = "arm64" ]; then
    RUST_TARGET="aarch64-unknown-linux-gnu"
else
    echo -e "${RED}Error: Unsupported architecture: $ARCH${NC}"
    exit 1
fi

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

# Check for Linux-specific dependencies
check_dependency() {
    local dep=$1
    if ! dpkg -l | grep -q "^ii  $dep"; then
        echo -e "${YELLOW}Warning: $dep not installed${NC}"
        return 1
    fi
    return 0
}

echo -e "${YELLOW}Checking Linux dependencies...${NC}"

MISSING_DEPS=()

# Check required dependencies
REQUIRED_DEPS=(
    "libwebkit2gtk-4.1-dev"
    "libappindicator3-dev"
    "librsvg2-dev"
    "patchelf"
    "libssl-dev"
    "pkg-config"
    "build-essential"
)

for dep in "${REQUIRED_DEPS[@]}"; do
    if ! check_dependency "$dep"; then
        MISSING_DEPS+=("$dep")
    fi
done

if [ ${#MISSING_DEPS[@]} -ne 0 ]; then
    echo -e "${RED}Missing dependencies: ${MISSING_DEPS[*]}${NC}"
    echo "Install with:"
    echo "  sudo apt-get install -y ${MISSING_DEPS[*]}"
    exit 1
fi

# Check for RPM tools if creating RPM
if [ "$CREATE_RPM" = "true" ] && [ "$ARCH" = "x86_64" ]; then
    if ! command -v rpmbuild >/dev/null 2>&1; then
        echo -e "${YELLOW}Warning: rpm tools not found. Installing...${NC}"
        sudo apt-get install -y rpm
    fi
fi

# Setup cross-compilation for ARM64
if [ "$ARCH" = "arm64" ] && [ "$(uname -m)" != "aarch64" ]; then
    echo -e "${YELLOW}Setting up ARM64 cross-compilation...${NC}"

    # Check for cross-compilation tools
    if ! command -v aarch64-linux-gnu-gcc >/dev/null 2>&1; then
        echo -e "${YELLOW}Installing ARM64 cross-compilation tools...${NC}"
        sudo dpkg --add-architecture arm64
        sudo apt-get update
        sudo apt-get install -y \
            gcc-aarch64-linux-gnu \
            g++-aarch64-linux-gnu \
            libc6-dev-arm64-cross
    fi

    # Configure cargo for cross-compilation
    CARGO_CONFIG="$HOME/.cargo/config.toml"
    if ! grep -q "aarch64-unknown-linux-gnu" "$CARGO_CONFIG" 2>/dev/null; then
        echo -e "${YELLOW}Configuring cargo for cross-compilation...${NC}"
        mkdir -p "$HOME/.cargo"
        cat >> "$CARGO_CONFIG" << EOF

[target.aarch64-unknown-linux-gnu]
linker = "aarch64-linux-gnu-gcc"
EOF
    fi

    # Note: RPM building not supported for ARM64 cross-compilation
    if [ "$CREATE_RPM" = "true" ]; then
        echo -e "${YELLOW}Note: RPM building disabled for ARM64 cross-compilation${NC}"
        CREATE_RPM="false"
    fi
fi

# Install Rust target
echo -e "${YELLOW}Installing Rust target: $RUST_TARGET...${NC}"
rustup target add "$RUST_TARGET"

# Navigate to project root
cd "$PROJECT_ROOT"

# Install dependencies
echo -e "${YELLOW}Installing npm dependencies...${NC}"
npm ci --legacy-peer-deps

# Build frontend
echo -e "${YELLOW}Building frontend...${NC}"
npm run build

# Setup environment
export NEXT_CONFIG_FILE="next.config.tauri.js"

# Determine build command
if [ "$BUILD_TYPE" = "debug" ]; then
    BUILD_CMD="npm run tauri build -- --debug --target $RUST_TARGET"
else
    BUILD_CMD="npm run tauri build -- --target $RUST_TARGET"
fi

# Build Tauri app
echo -e "${YELLOW}Building Tauri application...${NC}"
eval "$BUILD_CMD"

# Build artifacts location
BUNDLE_DIR="$PROJECT_ROOT/src-tauri/target/$RUST_TARGET/$BUILD_TYPE/bundle"

# Verify build
if [ ! -d "$BUNDLE_DIR" ]; then
    echo -e "${RED}Error: Build failed - bundle directory not found${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Build successful${NC}"

# Generate checksums for all packages
generate_checksums() {
    local dir=$1
    if [ -d "$dir" ]; then
        cd "$dir"
        for file in *; do
            if [ -f "$file" ] && [[ ! "$file" =~ \.sha256$ ]]; then
                sha256sum "$file" > "$file.sha256"
                echo "✓ Checksum: $file.sha256"
            fi
        done
    fi
}

# List created packages
echo ""
echo -e "${GREEN}========================================="
echo "Build Complete!"
echo "=========================================${NC}"
echo ""
echo "Build artifacts:"

# .deb package
if [ "$CREATE_DEB" = "true" ] && [ -d "$BUNDLE_DIR/deb" ]; then
    DEB_FILE=$(find "$BUNDLE_DIR/deb" -name "*.deb" -type f | head -n 1)
    if [ -n "$DEB_FILE" ]; then
        DEB_SIZE=$(ls -lh "$DEB_FILE" | awk '{print $5}')
        echo "  .deb package: $DEB_FILE ($DEB_SIZE)"
        generate_checksums "$BUNDLE_DIR/deb"
    fi
fi

# .AppImage
if [ "$CREATE_APPIMAGE" = "true" ] && [ -d "$BUNDLE_DIR/appimage" ]; then
    APPIMAGE_FILE=$(find "$BUNDLE_DIR/appimage" -name "*.AppImage" -type f | head -n 1)
    if [ -n "$APPIMAGE_FILE" ]; then
        APPIMAGE_SIZE=$(ls -lh "$APPIMAGE_FILE" | awk '{print $5}')
        echo "  .AppImage: $APPIMAGE_FILE ($APPIMAGE_SIZE)"
        generate_checksums "$BUNDLE_DIR/appimage"
    fi
fi

# .rpm package
if [ "$CREATE_RPM" = "true" ] && [ -d "$BUNDLE_DIR/rpm" ]; then
    RPM_FILE=$(find "$BUNDLE_DIR/rpm" -name "*.rpm" -type f | head -n 1)
    if [ -n "$RPM_FILE" ]; then
        RPM_SIZE=$(ls -lh "$RPM_FILE" | awk '{print $5}')
        echo "  .rpm package: $RPM_FILE ($RPM_SIZE)"
        generate_checksums "$BUNDLE_DIR/rpm"
    fi
fi

echo ""

# Installation instructions
echo -e "${GREEN}Installation Instructions:${NC}"
echo ""

if [ -n "${DEB_FILE:-}" ]; then
    echo "Debian/Ubuntu (.deb):"
    echo "  sudo dpkg -i $DEB_FILE"
    echo ""
fi

if [ -n "${RPM_FILE:-}" ]; then
    echo "Fedora/RHEL (.rpm):"
    echo "  sudo rpm -i $RPM_FILE"
    echo ""
fi

if [ -n "${APPIMAGE_FILE:-}" ]; then
    echo "AppImage (any distro):"
    echo "  chmod +x $APPIMAGE_FILE"
    echo "  $APPIMAGE_FILE"
    echo ""
fi

echo -e "${GREEN}Done!${NC}"
