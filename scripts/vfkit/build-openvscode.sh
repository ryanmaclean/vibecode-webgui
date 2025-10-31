#!/usr/bin/env bash
# Build OpenVSCode Server in vfkit VM
# Native macOS build using Virtualization Framework
# No Docker required - uses Swift 5 + Rust + Node.js

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
VFKIT="$PROJECT_ROOT/src-tauri/resources/vfkit-aarch64-apple-darwin"
VM_CONFIG="$PROJECT_ROOT/config/vfkit/openvscode-build-vm.yaml"
VM_DIR="$HOME/.vibecode/build-vms"
BUILD_LOG="$VM_DIR/build.log"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() { echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $*"; }
success() { echo -e "${GREEN}✓${NC} $*"; }
error() { echo -e "${RED}✗${NC} $*" >&2; }
warn() { echo -e "${YELLOW}⚠${NC} $*"; }

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."

    if [[ ! -x "$VFKIT" ]]; then
        error "vfkit not found at $VFKIT"
        exit 1
    fi

    if [[ ! -f "$VM_CONFIG" ]]; then
        error "VM config not found at $VM_CONFIG"
        exit 1
    fi

    if [[ ! -d "$PROJECT_ROOT/openvscode-server" ]]; then
        error "openvscode-server submodule not initialized"
        log "Run: git submodule update --init openvscode-server"
        exit 1
    fi

    success "Prerequisites OK"
}

# Create VM directories
setup_vm_dirs() {
    log "Setting up VM directories..."
    mkdir -p "$VM_DIR"
    mkdir -p "$VM_DIR/build-output"
    mkdir -p "$VM_DIR/disks"
    success "VM directories created"
}

# Create build disk image
create_build_disk() {
    local disk_path="$VM_DIR/disks/openvscode-build.img"

    if [[ -f "$disk_path" ]]; then
        warn "Build disk already exists at $disk_path"
        read -p "Recreate? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            return 0
        fi
        rm "$disk_path"
    fi

    log "Creating 50GB build disk..."
    hdiutil create -size 50g -fs "APFS" -volname "OpenVSCode Build" "$disk_path"
    success "Build disk created"
}

# Start build VM
start_vm() {
    log "Starting build VM..."
    log "VM config: $VM_CONFIG"

    # For now, we'll use a simpler vfkit command until we have a full macOS VM
    # This creates a Linux-based build environment

    local kernel_url="https://dl-cdn.alpinelinux.org/alpine/v3.19/releases/aarch64/alpine-virt-3.19.0-aarch64.iso"
    local kernel_path="$VM_DIR/alpine-virt.iso"

    if [[ ! -f "$kernel_path" ]]; then
        log "Downloading Alpine Linux for build VM..."
        curl -fsSL -o "$kernel_path" "$kernel_url"
        success "Alpine Linux downloaded"
    fi

    log "Starting Alpine Linux VM for build testing..."
    log "Note: For full macOS builds, you'll need a macOS VM image"
    warn "Current setup uses Alpine Linux as a build test environment"

    # TODO: Full vfkit macOS VM launch
    # For now, provide instructions

    cat <<EOF

${YELLOW}=== Next Steps ===${NC}

To build openvscode-server natively on macOS:

${BLUE}Option 1: Native macOS Build (Recommended)${NC}
Build directly on your Mac without VM:

  cd openvscode-server
  npm install
  npm run compile
  cd cli && cargo build --release

  # Test the build
  ./cli/target/release/code serve-web --port 8081

${BLUE}Option 2: Linux Build VM${NC}
Use Alpine Linux VM for cross-platform testing:

  # Start Alpine Linux VM
  $VFKIT \\
    --cpus 8 --memory 8192 \\
    --disk "$VM_DIR/disks/openvscode-build.img" \\
    --cdrom "$kernel_path" \\
    --device virtio-net,nat,mac=52:54:00:12:34:57

${BLUE}Option 3: Full macOS VM${NC}
For complete macOS-in-VM testing:

  1. Create macOS VM image:
     See: docs/vfkit-macos-quickstart.md

  2. Launch with vfkit:
     $VFKIT \\
       --cpus 8 --memory 16384 \\
       --disk /path/to/macos-vm.img \\
       --aux /path/to/aux.img \\
       --device virtio-net,nat

  3. Inside VM, build openvscode-server

${BLUE}Build Commands (inside VM or native):${NC}

  # Install dependencies
  brew install node rust # macOS
  # or
  apk add nodejs npm cargo # Alpine

  # Build
  cd /mnt/openvscode
  npm install
  npm run compile
  cd cli && cargo build --release

  # Test
  ./cli/target/release/code serve-web --port 8081 --host 0.0.0.0

  # Access from host
  open http://localhost:8081

EOF
}

# Build OpenVSCode Server natively (no VM)
build_native() {
    log "Building OpenVSCode Server natively on macOS..."

    cd "$PROJECT_ROOT/openvscode-server"

    # Check Node.js
    if ! command -v node &> /dev/null; then
        error "Node.js not found. Install with: brew install node"
        exit 1
    fi

    # Check Rust
    if ! command -v cargo &> /dev/null; then
        error "Rust not found. Install with: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
        exit 1
    fi

    log "Node version: $(node --version)"
    log "npm version: $(npm --version)"
    log "Rust version: $(cargo --version)"

    # Install dependencies
    log "Installing Node.js dependencies (this may take 10-15 minutes)..."
    npm install 2>&1 | tee "$BUILD_LOG"
    success "Dependencies installed"

    # Compile TypeScript/JavaScript
    log "Compiling OpenVSCode Server (this may take 15-20 minutes)..."
    npm run compile 2>&1 | tee -a "$BUILD_LOG"
    success "Compilation complete"

    # Build Rust CLI
    log "Building Rust CLI (this may take 5-10 minutes)..."
    cd cli
    cargo build --release 2>&1 | tee -a "$BUILD_LOG"
    success "Rust CLI built"

    # Test the build
    log "Build artifacts:"
    ls -lh target/release/code

    success "OpenVSCode Server built successfully!"
    log "Binary location: $PROJECT_ROOT/openvscode-server/cli/target/release/code"
    log "Build log: $BUILD_LOG"

    cat <<EOF

${GREEN}=== Build Complete! ===${NC}

To test the server:
  cd openvscode-server
  ./cli/target/release/code serve-web --port 8081 --host 0.0.0.0

Then open: ${BLUE}http://localhost:8081${NC}

To create a distributable:
  npm run gulp vscode-darwin-arm64

Next steps:
  1. Test the built server
  2. Rebrand for VibeCode
  3. Integrate with Swift 5 + Virtualization Framework
  4. Create .app bundle

See: docs/CODE_SERVER_COMPARISON.md for implementation strategy

EOF
}

# Main execution
main() {
    log "OpenVSCode Server Build Script"
    log "Using Virtualization Framework via vfkit"
    echo

    check_prerequisites
    setup_vm_dirs

    if [[ "${1:-}" == "--native" ]]; then
        build_native
    elif [[ "${1:-}" == "--vm" ]]; then
        create_build_disk
        start_vm
    else
        cat <<EOF
${BLUE}OpenVSCode Server Build Options:${NC}

  ${GREEN}--native${NC}  Build natively on macOS (recommended, no VM needed)
  ${GREEN}--vm${NC}      Set up build VM (for isolated testing)

Example:
  $0 --native   # Build now
  $0 --vm       # Set up VM environment

EOF
    fi
}

main "$@"
