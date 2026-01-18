#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "================================================================"
echo "VibeCode VM - PostgreSQL 9p Persistence Setup"
echo "================================================================"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
WORK_DIR="/tmp/unified-vm-rebuild-$$"
APP_PATH="$PROJECT_ROOT/menubar/Apps/UnifiedServicesVibeCodeApp.app"

# Function to print colored messages
log_info() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    if ! command -v cpio &> /dev/null; then
        log_error "cpio not found. Please install: brew install cpio"
        exit 1
    fi

    if ! command -v gzip &> /dev/null; then
        log_error "gzip not found"
        exit 1
    fi

    if ! command -v swiftc &> /dev/null; then
        log_error "Swift compiler not found. Please install Xcode or Command Line Tools"
        exit 1
    fi

    log_info "All prerequisites met"
}

# Step 1: Extract current initramfs
extract_initramfs() {
    log_info "Step 1: Extracting current initramfs..."

    mkdir -p "$WORK_DIR/initramfs"
    cd "$WORK_DIR/initramfs"

    gzip -dc "$APP_PATH/Contents/Resources/unified-vm-initramfs.cpio.gz" | cpio -idm 2>/dev/null

    if [ ! -f "$WORK_DIR/initramfs/init" ]; then
        log_error "Failed to extract initramfs"
        exit 1
    fi

    log_info "Initramfs extracted to $WORK_DIR/initramfs"
}

# Step 2: Update init script with 9p support
update_init_script() {
    log_info "Step 2: Updating init script with 9p support..."

    if [ ! -f "$SCRIPT_DIR/init-9p-updated.sh" ]; then
        log_error "Updated init script not found: $SCRIPT_DIR/init-9p-updated.sh"
        exit 1
    fi

    # Backup original init
    cp "$WORK_DIR/initramfs/init" "$WORK_DIR/initramfs/init.backup"

    # Copy updated init script
    cp "$SCRIPT_DIR/init-9p-updated.sh" "$WORK_DIR/initramfs/init"
    chmod +x "$WORK_DIR/initramfs/init"

    log_info "Init script updated (backup saved as init.backup)"
}

# Step 3: Rebuild initramfs
rebuild_initramfs() {
    log_info "Step 3: Rebuilding initramfs..."

    cd "$WORK_DIR/initramfs"

    # Create new initramfs
    find . -print0 | cpio --null -o --format=newc 2>/dev/null | gzip -9 > "$WORK_DIR/unified-vm-initramfs.cpio.gz"

    if [ ! -f "$WORK_DIR/unified-vm-initramfs.cpio.gz" ]; then
        log_error "Failed to rebuild initramfs"
        exit 1
    fi

    INITRAMFS_SIZE=$(du -h "$WORK_DIR/unified-vm-initramfs.cpio.gz" | cut -f1)
    log_info "Initramfs rebuilt: $INITRAMFS_SIZE"
}

# Step 4: Compile Swift VM manager
compile_swift() {
    log_info "Step 4: Compiling Swift VM manager..."

    if [ ! -f "$SCRIPT_DIR/UnifiedServicesVM-9p.swift" ]; then
        log_error "Swift source not found: $SCRIPT_DIR/UnifiedServicesVM-9p.swift"
        exit 1
    fi

    cd "$WORK_DIR"

    swiftc \
        -O \
        -target arm64-apple-macos14.0 \
        -import-objc-header <(echo "") \
        -framework Foundation \
        -framework Virtualization \
        "$SCRIPT_DIR/UnifiedServicesVM-9p.swift" \
        -o "$WORK_DIR/UnifiedServicesVibeCode"

    if [ ! -f "$WORK_DIR/UnifiedServicesVibeCode" ]; then
        log_error "Swift compilation failed"
        exit 1
    fi

    # Strip debug symbols
    strip "$WORK_DIR/UnifiedServicesVibeCode"

    BINARY_SIZE=$(du -h "$WORK_DIR/UnifiedServicesVibeCode" | cut -f1)
    log_info "Binary compiled: $BINARY_SIZE"
}

# Step 5: Deploy to app bundle
deploy_to_app() {
    log_info "Step 5: Deploying to app bundle..."

    # Backup existing app
    BACKUP_DIR="$PROJECT_ROOT/menubar/Apps/UnifiedServicesVibeCodeApp-backup-$(date +%Y%m%d-%H%M%S).app"
    cp -a "$APP_PATH" "$BACKUP_DIR"
    log_info "Backup created: $(basename "$BACKUP_DIR")"

    # Replace initramfs
    cp "$WORK_DIR/unified-vm-initramfs.cpio.gz" \
       "$APP_PATH/Contents/Resources/unified-vm-initramfs.cpio.gz"
    log_info "Initramfs deployed"

    # Replace binary
    cp "$WORK_DIR/UnifiedServicesVibeCode" \
       "$APP_PATH/Contents/MacOS/UnifiedServicesVibeCode"
    chmod +x "$APP_PATH/Contents/MacOS/UnifiedServicesVibeCode"
    log_info "Binary deployed"

    # Re-sign the app (remove existing signature)
    codesign --remove-signature "$APP_PATH" 2>/dev/null || true
    log_info "App signature removed (will need to run with quarantine override)"
}

# Step 6: Create host data directory
setup_host_storage() {
    log_info "Step 6: Setting up host storage directory..."

    HOST_DATA_DIR="$HOME/.vibecode/vm-data"
    mkdir -p "$HOST_DATA_DIR/postgresql"

    log_info "Host data directory created: $HOST_DATA_DIR"
    log_info "PostgreSQL data will persist in: $HOST_DATA_DIR/postgresql"
}

# Step 7: Cleanup
cleanup() {
    log_info "Step 7: Cleaning up temporary files..."

    rm -rf "$WORK_DIR"

    log_info "Cleanup complete"
}

# Main execution
main() {
    check_prerequisites
    extract_initramfs
    update_init_script
    rebuild_initramfs
    compile_swift
    deploy_to_app
    setup_host_storage
    cleanup

    echo ""
    echo "================================================================"
    echo -e "${GREEN}✓ PostgreSQL 9p Persistence Setup Complete${NC}"
    echo "================================================================"
    echo ""
    echo "Next Steps:"
    echo ""
    echo "1. Test the VM:"
    echo "   ./postgresql-9p-persistence/test-persistence.sh"
    echo ""
    echo "2. Run the app:"
    echo "   open \"$APP_PATH\""
    echo ""
    echo "3. Check PostgreSQL data:"
    echo "   ls -la $HOME/.vibecode/vm-data/postgresql/"
    echo ""
    echo "4. Connect to services:"
    echo "   psql -h localhost -p 5432 -U postgres"
    echo "   redis-cli -h localhost -p 6379"
    echo "   open http://localhost:3000"
    echo ""
    echo "Note: On first run, macOS may ask for security permission."
    echo "      Go to System Settings → Privacy & Security if blocked."
    echo ""
}

# Run main function
main
