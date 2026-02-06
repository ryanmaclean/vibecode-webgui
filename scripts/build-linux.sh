#!/usr/bin/env bash
# VibeCode Linux Build Script
# Builds AppImage, deb, and rpm packages for x86_64 and arm64
#
# Usage:
#   ./scripts/build-linux.sh [--arch x64|arm64|all] [--sign] [--debug]
#
# Requirements:
#   - Rust toolchain with target support
#   - Node.js 18+
#   - libwebkit2gtk-4.1-dev, libappindicator3-dev, librsvg2-dev
#   - For signing: GPG key configured

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TAURI_DIR="$PROJECT_ROOT/platforms/tauri"
BUILD_DIR="$TAURI_DIR/target"

# Default options
ARCH="all"
SIGN=false
DEBUG=false
VERBOSE=false

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --arch)
            ARCH="$2"
            shift 2
            ;;
        --sign)
            SIGN=true
            shift
            ;;
        --debug)
            DEBUG=true
            shift
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        --help)
            echo "Usage: $0 [--arch x64|arm64|all] [--sign] [--debug] [--verbose]"
            echo ""
            echo "Options:"
            echo "  --arch     Target architecture: x64, arm64, or all (default: all)"
            echo "  --sign     Sign packages with GPG if available"
            echo "  --debug    Build in debug mode (faster, larger binaries)"
            echo "  --verbose  Show verbose build output"
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

check_dependency() {
    local cmd=$1
    local package=${2:-$1}

    if ! command -v "$cmd" &> /dev/null; then
        log_error "Required command '$cmd' not found."
        echo "Install it with:"
        echo "  Ubuntu/Debian: sudo apt install $package"
        echo "  Fedora: sudo dnf install $package"
        echo "  Arch: sudo pacman -S $package"
        return 1
    fi
    return 0
}

check_dependencies() {
    log_info "Checking build dependencies..."

    local missing=0

    # Core build tools
    check_dependency "rustc" "rustup" || missing=1
    check_dependency "cargo" "rustup" || missing=1
    check_dependency "node" "nodejs" || missing=1
    check_dependency "npm" "npm" || missing=1

    # Check Rust version
    local rust_version
    rust_version=$(rustc --version | cut -d' ' -f2)
    log_info "Rust version: $rust_version"

    # Check Node version
    local node_version
    node_version=$(node --version)
    log_info "Node version: $node_version"

    # Linux-specific dependencies
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Check for required libraries via pkg-config
        if command -v pkg-config &> /dev/null; then
            local libs=(
                "webkit2gtk-4.1"
                "gtk+-3.0"
                "glib-2.0"
                "dbus-1"
                "openssl"
            )

            for lib in "${libs[@]}"; do
                if ! pkg-config --exists "$lib" 2>/dev/null; then
                    log_warn "Library '$lib' not found via pkg-config"
                    case $lib in
                        webkit2gtk-4.1)
                            echo "  Install: libwebkit2gtk-4.1-dev (Ubuntu) or webkit2gtk4.1-devel (Fedora)"
                            ;;
                        gtk+-3.0)
                            echo "  Install: libgtk-3-dev (Ubuntu) or gtk3-devel (Fedora)"
                            ;;
                        dbus-1)
                            echo "  Install: libdbus-1-dev (Ubuntu) or dbus-devel (Fedora)"
                            ;;
                    esac
                fi
            done
        fi

        # AppImage tools
        if [[ "$ARCH" == "x64" || "$ARCH" == "all" ]]; then
            check_dependency "appimagetool" "appimagetool" || log_warn "appimagetool not found - AppImage may not be built"
        fi
    fi

    if [[ $missing -eq 1 ]]; then
        log_error "Missing required dependencies. Please install them and try again."
        exit 1
    fi

    log_success "All core dependencies satisfied"
}

install_rust_targets() {
    log_info "Installing Rust targets..."

    case $ARCH in
        x64)
            rustup target add x86_64-unknown-linux-gnu
            ;;
        arm64)
            rustup target add aarch64-unknown-linux-gnu
            ;;
        all)
            rustup target add x86_64-unknown-linux-gnu
            rustup target add aarch64-unknown-linux-gnu
            ;;
    esac

    log_success "Rust targets installed"
}

build_frontend() {
    log_info "Building frontend..."

    cd "$PROJECT_ROOT"

    # Install dependencies
    npm ci --legacy-peer-deps

    # Generate Prisma client
    npx prisma generate || log_warn "Prisma generate failed (may not be needed)"

    # Build for Tauri
    npm run build:tauri || npm run build

    # Prepare public directory for Tauri
    mkdir -p "$TAURI_DIR/../public"

    if [ -d "out" ]; then
        cp -r out/* "$TAURI_DIR/../public/"
    elif [ -d ".next/static" ]; then
        cp -r .next/static "$TAURI_DIR/../public/"
        echo '<!DOCTYPE html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=http://localhost:8080"></head><body>Redirecting to VibeCode...</body></html>' > "$TAURI_DIR/../public/index.html"
    fi

    log_success "Frontend built successfully"
}

create_sidecar_binary() {
    local target=$1
    local binaries_dir="$TAURI_DIR/binaries"

    mkdir -p "$binaries_dir"

    local sidecar_name="vibecode-vm-${target}"

    log_info "Creating sidecar stub: $sidecar_name"

    # Create a stub binary that explains VMs need QEMU/KVM on Linux
    cat > "$binaries_dir/$sidecar_name" << 'STUB_EOF'
#!/bin/sh
# VibeCode VM Stub for Linux
# On Linux, VM functionality requires QEMU/KVM

echo "VibeCode VM Management"
echo "======================"
echo ""
echo "To use VM functionality on Linux, please ensure:"
echo "  1. QEMU/KVM is installed:"
echo "     - Ubuntu/Debian: sudo apt install qemu-system-x86 qemu-utils"
echo "     - Fedora: sudo dnf install qemu-kvm qemu-img"
echo "     - Arch: sudo pacman -S qemu"
echo ""
echo "  2. Your user is in the kvm group:"
echo "     sudo usermod -aG kvm \$USER"
echo "     (Log out and back in after this)"
echo ""
echo "  3. KVM is enabled in your BIOS/UEFI"
echo ""

# Check if KVM is available
if [ -e /dev/kvm ]; then
    if [ -r /dev/kvm ] && [ -w /dev/kvm ]; then
        echo "KVM Status: Available and accessible"
    else
        echo "KVM Status: Available but not accessible (permission issue)"
    fi
else
    echo "KVM Status: Not available"
fi

exit 0
STUB_EOF

    chmod +x "$binaries_dir/$sidecar_name"
}

build_tauri() {
    local target=$1
    local bundle_types=$2

    log_info "Building Tauri for target: $target"
    log_info "Bundle types: $bundle_types"

    cd "$TAURI_DIR"

    # Create sidecar binary for this target
    create_sidecar_binary "$target"

    # Build command
    local build_cmd="npx tauri build --target $target"

    if [[ -n "$bundle_types" ]]; then
        build_cmd="$build_cmd --bundles $bundle_types"
    fi

    if [[ "$DEBUG" == true ]]; then
        build_cmd="$build_cmd --debug"
    fi

    if [[ "$VERBOSE" == true ]]; then
        build_cmd="$build_cmd --verbose"
    fi

    log_info "Running: $build_cmd"
    eval "$build_cmd"

    log_success "Tauri build completed for $target"
}

generate_checksums() {
    local output_dir=$1

    log_info "Generating checksums..."

    find "$output_dir" -type f \( -name "*.deb" -o -name "*.rpm" -o -name "*.AppImage" \) | while read -r file; do
        sha256sum "$file" > "${file}.sha256"
        log_info "Checksum: ${file}.sha256"
    done

    log_success "Checksums generated"
}

sign_packages() {
    local output_dir=$1

    if [[ "$SIGN" != true ]]; then
        log_info "Signing skipped (use --sign to enable)"
        return
    fi

    if ! command -v gpg &> /dev/null; then
        log_warn "GPG not found, skipping signing"
        return
    fi

    # Check for signing key
    if ! gpg --list-secret-keys 2>/dev/null | grep -q "sec"; then
        log_warn "No GPG secret key found, skipping signing"
        return
    fi

    log_info "Signing packages with GPG..."

    find "$output_dir" -type f \( -name "*.deb" -o -name "*.rpm" -o -name "*.AppImage" \) | while read -r file; do
        gpg --armor --detach-sign "$file" 2>/dev/null && log_info "Signed: $file" || log_warn "Failed to sign: $file"
    done

    log_success "Package signing complete"
}

collect_artifacts() {
    local arch=$1
    local artifacts_dir="$PROJECT_ROOT/dist/linux-$arch"

    mkdir -p "$artifacts_dir"

    log_info "Collecting artifacts to $artifacts_dir"

    local target
    case $arch in
        x64)
            target="x86_64-unknown-linux-gnu"
            ;;
        arm64)
            target="aarch64-unknown-linux-gnu"
            ;;
    esac

    local bundle_dir="$BUILD_DIR/$target/release/bundle"

    # Copy all artifacts
    if [[ -d "$bundle_dir/deb" ]]; then
        cp "$bundle_dir/deb/"*.deb "$artifacts_dir/" 2>/dev/null || true
        cp "$bundle_dir/deb/"*.sha256 "$artifacts_dir/" 2>/dev/null || true
    fi

    if [[ -d "$bundle_dir/rpm" ]]; then
        cp "$bundle_dir/rpm/"*.rpm "$artifacts_dir/" 2>/dev/null || true
        cp "$bundle_dir/rpm/"*.sha256 "$artifacts_dir/" 2>/dev/null || true
    fi

    if [[ -d "$bundle_dir/appimage" ]]; then
        cp "$bundle_dir/appimage/"*.AppImage "$artifacts_dir/" 2>/dev/null || true
        cp "$bundle_dir/appimage/"*.sha256 "$artifacts_dir/" 2>/dev/null || true
    fi

    # Copy signatures if present
    cp "$bundle_dir/"**/*.asc "$artifacts_dir/" 2>/dev/null || true

    log_success "Artifacts collected: $(ls -1 "$artifacts_dir" | wc -l) files"
    ls -lh "$artifacts_dir"
}

main() {
    log_info "VibeCode Linux Build Script"
    log_info "==========================="
    log_info "Architecture: $ARCH"
    log_info "Sign packages: $SIGN"
    log_info "Debug mode: $DEBUG"
    echo ""

    # Check we're on Linux or at least have the right tools
    if [[ "$OSTYPE" != "linux-gnu"* ]]; then
        log_warn "Not running on Linux. Some checks may be skipped."
        log_warn "For best results, build on a Linux system or use Docker."
    fi

    check_dependencies
    install_rust_targets
    build_frontend

    # Build for each architecture
    case $ARCH in
        x64)
            build_tauri "x86_64-unknown-linux-gnu" "deb,appimage,rpm"
            generate_checksums "$BUILD_DIR/x86_64-unknown-linux-gnu/release/bundle"
            sign_packages "$BUILD_DIR/x86_64-unknown-linux-gnu/release/bundle"
            collect_artifacts "x64"
            ;;
        arm64)
            # ARM64 can't build AppImage in cross-compilation
            build_tauri "aarch64-unknown-linux-gnu" "deb,rpm"
            generate_checksums "$BUILD_DIR/aarch64-unknown-linux-gnu/release/bundle"
            sign_packages "$BUILD_DIR/aarch64-unknown-linux-gnu/release/bundle"
            collect_artifacts "arm64"
            ;;
        all)
            build_tauri "x86_64-unknown-linux-gnu" "deb,appimage,rpm"
            generate_checksums "$BUILD_DIR/x86_64-unknown-linux-gnu/release/bundle"
            sign_packages "$BUILD_DIR/x86_64-unknown-linux-gnu/release/bundle"
            collect_artifacts "x64"

            build_tauri "aarch64-unknown-linux-gnu" "deb,rpm"
            generate_checksums "$BUILD_DIR/aarch64-unknown-linux-gnu/release/bundle"
            sign_packages "$BUILD_DIR/aarch64-unknown-linux-gnu/release/bundle"
            collect_artifacts "arm64"
            ;;
    esac

    echo ""
    log_success "Build complete!"
    log_info "Artifacts are in: $PROJECT_ROOT/dist/"
    ls -lhR "$PROJECT_ROOT/dist/" 2>/dev/null || true
}

main "$@"
