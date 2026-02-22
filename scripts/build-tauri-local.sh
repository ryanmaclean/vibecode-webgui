#!/usr/bin/env bash
# VibeCode Tauri Local Build Script
# Quick build script for local macOS Tauri development
#
# Usage:
#   ./scripts/build-tauri-local.sh [--dev] [--skip-frontend] [--target aarch64|x86_64|universal]
#
# Requirements:
#   - Rust toolchain with macOS targets
#   - Node.js 20+
#   - Tauri CLI (installed via npm)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TAURI_DIR="$PROJECT_ROOT/platforms/tauri"

# Default options
DEV_MODE=false
SKIP_FRONTEND=false
FRONTEND_ONLY=false
TARGET="aarch64-apple-darwin"  # Default to ARM64 for Apple Silicon
ROUTES_BACKUP_DIR=""

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
        --dev)
            DEV_MODE=true
            shift
            ;;
        --skip-frontend)
            SKIP_FRONTEND=true
            shift
            ;;
        --frontend-only)
            FRONTEND_ONLY=true
            shift
            ;;
        --target)
            case $2 in
                aarch64|arm64)
                    TARGET="aarch64-apple-darwin"
                    ;;
                x86_64|x64|intel)
                    TARGET="x86_64-apple-darwin"
                    ;;
                universal)
                    TARGET="universal-apple-darwin"
                    ;;
                *)
                    log_error "Unknown target: $2"
                    exit 1
                    ;;
            esac
            shift 2
            ;;
        --help)
            echo "Usage: $0 [--dev] [--skip-frontend] [--frontend-only] [--target aarch64|x86_64|universal]"
            echo ""
            echo "Options:"
            echo "  --dev              Build in dev mode (faster, for testing)"
            echo "  --skip-frontend    Skip frontend build (use existing build)"
            echo "  --frontend-only    Build frontend export only (no Rust/Tauri build)"
            echo "  --target TARGET    Target architecture:"
            echo "                     - aarch64|arm64: Apple Silicon (default)"
            echo "                     - x86_64|x64|intel: Intel Mac"
            echo "                     - universal: Universal binary (both architectures)"
            echo ""
            echo "Examples:"
            echo "  $0                           # Production build for ARM64"
            echo "  $0 --dev                     # Dev build for ARM64"
            echo "  $0 --skip-frontend           # Skip frontend, build Tauri only"
            echo "  $0 --target universal        # Universal binary"
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

if [[ "$FRONTEND_ONLY" == true && "$SKIP_FRONTEND" == true ]]; then
    log_error "--frontend-only and --skip-frontend cannot be used together"
    exit 1
fi

check_dependency() {
    local cmd=$1
    local install_msg=$2

    if ! command -v "$cmd" &> /dev/null; then
        log_error "Required command '$cmd' not found."
        echo "$install_msg"
        return 1
    fi
    return 0
}

check_dependencies() {
    log_info "Checking build dependencies..."

    local missing=0

    if [[ "$FRONTEND_ONLY" != true ]]; then
        check_dependency "rustc" "Install Rust from https://rustup.rs" || missing=1
        check_dependency "cargo" "Install Rust from https://rustup.rs" || missing=1
        check_dependency "rustup" "Install Rustup from https://rustup.rs" || missing=1
    fi

    check_dependency "node" "Install Node.js 20+ from https://nodejs.org" || missing=1
    check_dependency "npm" "Install Node.js 20+ from https://nodejs.org" || missing=1

    if [[ "$FRONTEND_ONLY" != true ]]; then
        local rust_version
        rust_version=$(rustc --version | cut -d' ' -f2)
        log_info "Rust version: $rust_version"
    fi

    # Check Node version
    local node_version
    node_version=$(node --version)
    log_info "Node version: $node_version"

    # macOS-specific checks
    if [[ "$OSTYPE" != "darwin"* ]]; then
        log_warn "Not running on macOS. This script is optimized for macOS builds."
    fi

    if [[ $missing -eq 1 ]]; then
        log_error "Missing required dependencies. Please install them and try again."
        exit 1
    fi

    log_success "All core dependencies satisfied"
}

install_rust_targets() {
    log_info "Installing Rust targets..."

    case $TARGET in
        aarch64-apple-darwin)
            rustup target add aarch64-apple-darwin
            ;;
        x86_64-apple-darwin)
            rustup target add x86_64-apple-darwin
            ;;
        universal-apple-darwin)
            rustup target add aarch64-apple-darwin
            rustup target add x86_64-apple-darwin
            ;;
    esac

    log_success "Rust targets installed"
}

build_frontend() {
    log_info "Building frontend for Tauri..."

    cd "$PROJECT_ROOT"

    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        log_info "Installing dependencies..."
        npm ci --legacy-peer-deps
    fi

    cleanup_frontend() {
        local exit_code=$?
        local route route_name

        if [[ -n "$ROUTES_BACKUP_DIR" && -d "$ROUTES_BACKUP_DIR" ]]; then
            shopt -s nullglob
            for route in "$ROUTES_BACKUP_DIR"/*; do
                route_name=$(basename "$route")
                mv "$route" "$PROJECT_ROOT/src/app/$route_name" 2>/dev/null || true
                log_info "Restored $route_name"
            done
            shopt -u nullglob
            rmdir "$ROUTES_BACKUP_DIR" 2>/dev/null || true
        fi

        ROUTES_BACKUP_DIR=""
        trap - EXIT INT TERM
        return $exit_code
    }

    # Move incompatible routes out of src/app for static export.
    # Static export fails when dynamic API/routes are present in src/app.
    log_info "Temporarily moving incompatible routes..."
    ROUTES_BACKUP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/vibecode-tauri-routes.XXXXXX")"
    trap cleanup_frontend EXIT INT TERM

    # Move API routes
    if [ -d "src/app/api" ]; then
        mv src/app/api "$ROUTES_BACKUP_DIR/api"
        log_info "Moved API routes to temporary location"
    fi

    # Move dynamic page routes that lack generateStaticParams
    for route in "experiments" "workspace" "workspaces" "wiki"; do
        if [ -d "src/app/$route" ]; then
            mv "src/app/$route" "$ROUTES_BACKUP_DIR/$route"
            log_info "Moved dynamic route $route to temporary location"
        fi
    done

    # Clean Next.js cache
    log_info "Cleaning Next.js cache..."
    rm -rf .next
    rm -rf out
    rm -rf platforms/public

    # Build static export with the main Next.js config in export mode.
    if ! NEXT_TELEMETRY_DISABLED=1 NEXT_OUTPUT_MODE=export npx next build --webpack; then
        log_error "Frontend build failed"
        return 1
    fi

    # Verify static export was created
    if [ ! -d "out" ]; then
        log_error "Static export directory 'out' not created"
        return 1
    fi

    # Copy to platforms/public
    log_info "Copying static export to platforms/public..."
    mkdir -p platforms/public
    cp -r out/. platforms/public/

    local file_count
    file_count=$(find platforms/public -type f | wc -l | tr -d ' ')
    log_success "Frontend build complete - $file_count files"

    cleanup_frontend
}

verify_sidecar_binary() {
    log_info "Verifying vibecode-vm sidecar binary..."

    local binaries_dir="$TAURI_DIR/binaries"

    if [ ! -d "$binaries_dir" ]; then
        log_error "Binaries directory not found: $binaries_dir"
        exit 1
    fi

    # Check for required binary based on target
    case $TARGET in
        aarch64-apple-darwin)
            if [ ! -f "$binaries_dir/vibecode-vm-aarch64-apple-darwin" ]; then
                log_error "ARM64 binary not found: vibecode-vm-aarch64-apple-darwin"
                exit 1
            fi
            log_success "ARM64 sidecar binary verified"
            ;;
        x86_64-apple-darwin)
            if [ ! -f "$binaries_dir/vibecode-vm-x86_64-apple-darwin" ]; then
                log_error "Intel x86_64 binary not found: vibecode-vm-x86_64-apple-darwin"
                exit 1
            fi
            log_success "Intel x86_64 sidecar binary verified"
            ;;
        universal-apple-darwin)
            local has_arm64=false
            local has_x86_64=false

            if [ -f "$binaries_dir/vibecode-vm-aarch64-apple-darwin" ]; then
                has_arm64=true
            fi
            if [ -f "$binaries_dir/vibecode-vm-x86_64-apple-darwin" ]; then
                has_x86_64=true
            fi

            if [ "$has_arm64" = false ] || [ "$has_x86_64" = false ]; then
                log_error "Universal build requires both ARM64 and Intel binaries"
                exit 1
            fi
            log_success "Both ARM64 and Intel sidecar binaries verified"
            ;;
    esac
}

build_tauri() {
    log_info "Building Tauri app for target: $TARGET"

    cd "$TAURI_DIR"

    # Verify Tauri CLI is available
    if ! npx tauri --version &> /dev/null; then
        log_error "Tauri CLI not available. Run: npm install"
        exit 1
    fi

    # Build command
    local -a build_cmd=(npx tauri build --target "$TARGET")

    if [[ "$DEV_MODE" == true ]]; then
        build_cmd=(npx tauri build --debug --target "$TARGET")
        log_info "Building in DEBUG mode (faster, larger binaries)"
    fi

    log_info "Running: ${build_cmd[*]}"
    "${build_cmd[@]}"

    log_success "Tauri build completed"
}

show_output_locations() {
    log_info "Build output locations:"
    echo ""

    local bundle_dir="$TAURI_DIR/target"

    # Find the actual target directory based on what was built
    local target_subdir=""
    if [[ "$TARGET" == "universal-apple-darwin" ]]; then
        target_subdir="universal-apple-darwin"
    elif [[ "$TARGET" == "aarch64-apple-darwin" ]]; then
        target_subdir="aarch64-apple-darwin"
    elif [[ "$TARGET" == "x86_64-apple-darwin" ]]; then
        target_subdir="x86_64-apple-darwin"
    fi

    local build_type="release"
    if [[ "$DEV_MODE" == true ]]; then
        build_type="debug"
    fi

    local app_bundle="$bundle_dir/$target_subdir/$build_type/bundle/macos/VibeCode.app"
    local dmg_file="$bundle_dir/$target_subdir/$build_type/bundle/dmg/VibeCode.dmg"

    if [ -d "$app_bundle" ]; then
        echo -e "  ${GREEN}App Bundle:${NC} $app_bundle"
        echo "  Run with: open \"$app_bundle\""
    fi

    if [ -f "$dmg_file" ]; then
        echo -e "  ${GREEN}DMG:${NC} $dmg_file"
        echo "  Install with: open \"$dmg_file\""
    fi

    echo ""
}

main() {
    echo ""
    log_info "VibeCode Tauri Local Build"
    log_info "=========================="
    log_info "Target: $TARGET"
    log_info "Mode: $([ "$DEV_MODE" = true ] && echo "Development" || echo "Production")"
    log_info "Skip frontend: $SKIP_FRONTEND"
    log_info "Frontend only: $FRONTEND_ONLY"
    echo ""

    check_dependencies

    if [[ "$FRONTEND_ONLY" == true ]]; then
        build_frontend
        echo ""
        log_success "Frontend export complete!"
        echo ""
        exit 0
    fi

    install_rust_targets

    if [[ "$SKIP_FRONTEND" != true ]]; then
        build_frontend
    else
        log_info "Skipping frontend build (using existing build)"
    fi

    verify_sidecar_binary
    build_tauri
    show_output_locations

    echo ""
    log_success "Build complete!"
    echo ""
}

main "$@"
