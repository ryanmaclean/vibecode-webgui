#!/bin/bash
set -e

# Master VM Build Script
# Builds all specialized VMs with validation

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
AZURE_DIR="$PROJECT_ROOT/azure"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=================================${NC}"
echo -e "${BLUE}  VibeCode VM Build Suite${NC}"
echo -e "${BLUE}=================================${NC}"
echo ""

# Function to check prerequisites
check_prerequisites() {
    echo "Checking prerequisites..."

    local missing=0

    if ! command -v docker &> /dev/null; then
        echo -e "${RED}✗${NC} Docker not installed"
        missing=1
    else
        echo -e "${GREEN}✓${NC} Docker installed"
    fi

    if ! command -v redis-cli &> /dev/null; then
        echo -e "${YELLOW}⚠${NC} redis-cli not installed (needed for Valkey tests)"
        echo "  Install with: brew install redis"
    else
        echo -e "${GREEN}✓${NC} redis-cli installed"
    fi

    if ! command -v psql &> /dev/null; then
        echo -e "${YELLOW}⚠${NC} psql not installed (needed for PostgreSQL tests)"
        echo "  Install with: brew install postgresql"
    else
        echo -e "${GREEN}✓${NC} psql installed"
    fi

    if [ $missing -eq 1 ]; then
        echo ""
        echo -e "${RED}ERROR: Missing required prerequisites${NC}"
        exit 1
    fi

    echo ""
}

# Function to build a VM
build_vm() {
    local VM_NAME=$1
    local BUILD_SCRIPT=$2

    echo -e "${BLUE}Building $VM_NAME...${NC}"

    if [ -f "$BUILD_SCRIPT" ]; then
        bash "$BUILD_SCRIPT"
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✓${NC} $VM_NAME built successfully"
            return 0
        else
            echo -e "${RED}✗${NC} $VM_NAME build failed"
            return 1
        fi
    else
        echo -e "${YELLOW}⚠${NC} Build script not found: $BUILD_SCRIPT"
        return 1
    fi
}

# Main build process
main() {
    check_prerequisites

    echo "=== Building VMs ==="
    echo ""

    declare -A BUILD_STATUS

    # Build Valkey VM
    echo "1. Valkey VM"
    if build_vm "Valkey" "$SCRIPT_DIR/build-valkey-vm.sh"; then
        BUILD_STATUS["Valkey"]="SUCCESS"
    else
        BUILD_STATUS["Valkey"]="FAILED"
    fi
    echo ""

    # Build PostgreSQL VM (Docker)
    echo "2. PostgreSQL VM (requires Docker)"
    if build_vm "PostgreSQL" "$SCRIPT_DIR/rebuild-postgresql-docker.sh"; then
        BUILD_STATUS["PostgreSQL"]="SUCCESS"
    else
        BUILD_STATUS["PostgreSQL"]="FAILED"
    fi
    echo ""

    # Build Unified VM
    echo "3. Unified Services VM"
    if build_vm "Unified" "$SCRIPT_DIR/build-unified-vm.sh"; then
        BUILD_STATUS["Unified"]="SUCCESS"
    else
        BUILD_STATUS["Unified"]="FAILED"
    fi
    echo ""

    # Summary
    echo "=== Build Summary ==="
    for vm in "${!BUILD_STATUS[@]}"; do
        status="${BUILD_STATUS[$vm]}"
        if [ "$status" = "SUCCESS" ]; then
            echo -e "$vm: ${GREEN}✓ SUCCESS${NC}"
        else
            echo -e "$vm: ${RED}✗ FAILED${NC}"
        fi
    done
}

main "$@"
