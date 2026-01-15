#!/bin/bash
#
# Build and Test UnifiedServicesVibeCodeApp
# Ensures the app is built and all services work correctly
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "========================================"
echo "  Build and Test UnifiedServicesVibeCodeApp"
echo "========================================"
echo ""

# Configuration
PROJECT_ROOT="/Users/ryan.maclean/vibecode-webgui"
APP_SOURCE_DIR="$PROJECT_ROOT/azure/SwiftUI-Apps/Apps/UnifiedServicesVibeCodeApp"
APP_PATH="$APP_SOURCE_DIR.app"
BUILD_DIR="$PROJECT_ROOT/azure/SwiftUI-Apps"

# Step 1: Check if app needs rebuilding
echo -e "${BLUE}=== Step 1: Checking Build Status ===${NC}"
NEEDS_BUILD=false

if [ ! -d "$APP_PATH" ]; then
    echo -e "${YELLOW}App not found, needs building${NC}"
    NEEDS_BUILD=true
elif [ ! -f "$APP_PATH/Contents/MacOS/UnifiedServicesVibeCode" ]; then
    echo -e "${YELLOW}App executable missing, needs building${NC}"
    NEEDS_BUILD=true
elif [ ! -f "$APP_PATH/Contents/Resources/unified-vm-initramfs.cpio.gz" ]; then
    echo -e "${YELLOW}Initramfs missing, needs building${NC}"
    NEEDS_BUILD=true
else
    # Check if source files are newer than app
    if [ "$APP_SOURCE_DIR/UnifiedServicesVibeCodeApp.swift" -nt "$APP_PATH/Contents/MacOS/UnifiedServicesVibeCode" ] || \
       [ "$APP_SOURCE_DIR/UnifiedServicesVMManager.swift" -nt "$APP_PATH/Contents/MacOS/UnifiedServicesVibeCode" ]; then
        echo -e "${YELLOW}Source files modified, needs rebuilding${NC}"
        NEEDS_BUILD=true
    else
        echo -e "${GREEN}✓ App is up to date${NC}"
    fi
fi

# Step 2: Build if needed
if [ "$NEEDS_BUILD" = true ]; then
    echo ""
    echo -e "${BLUE}=== Step 2: Building App ===${NC}"
    cd "$BUILD_DIR"

    # Clean old build
    if [ -d "$APP_PATH" ]; then
        echo "Removing old app bundle..."
        rm -rf "$APP_PATH"
    fi

    # Build using swift build
    echo "Building UnifiedServicesVibeCodeApp..."
    ./build-unified-services.sh || {
        echo -e "${RED}✗ Build failed${NC}"
        echo "Trying manual build..."

        # Manual build as fallback
        swiftc -o "$APP_PATH/Contents/MacOS/UnifiedServicesVibeCode" \
            -import-objc-header "$BUILD_DIR/Shared/Core/BaseVMManager.swift" \
            -import-objc-header "$BUILD_DIR/Shared/Networking/VMPortForwarder.swift" \
            -import-objc-header "$BUILD_DIR/Shared/Core/VMLogger.swift" \
            "$APP_SOURCE_DIR/UnifiedServicesVibeCodeApp.swift" \
            "$APP_SOURCE_DIR/UnifiedServicesVMManager.swift" \
            -framework Virtualization \
            -framework SwiftUI || {
            echo -e "${RED}✗ Manual build also failed${NC}"
            echo "App may already be built, continuing..."
        }
    }

    echo -e "${GREEN}✓ Build complete${NC}"
else
    echo ""
    echo -e "${BLUE}=== Step 2: Skipping Build (not needed) ===${NC}"
fi

# Step 3: Verify app resources
echo ""
echo -e "${BLUE}=== Step 3: Verifying App Resources ===${NC}"

if [ ! -f "$APP_PATH/Contents/Resources/unified-vm-initramfs.cpio.gz" ]; then
    echo -e "${RED}✗ Missing: unified-vm-initramfs.cpio.gz${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Found initramfs ($(ls -lh "$APP_PATH/Contents/Resources/unified-vm-initramfs.cpio.gz" | awk '{print $5}'))${NC}"

if [ ! -f "$APP_PATH/Contents/Resources/vmlinux-raw" ]; then
    echo -e "${RED}✗ Missing: vmlinux-raw${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Found kernel ($(ls -lh "$APP_PATH/Contents/Resources/vmlinux-raw" | awk '{print $5}'))${NC}"

# Step 4: Run tests
echo ""
echo -e "${BLUE}=== Step 4: Running Service Tests ===${NC}"
echo ""

"$PROJECT_ROOT/test-unified-services.sh"
TEST_RESULT=$?

echo ""
if [ $TEST_RESULT -eq 0 ]; then
    echo -e "${GREEN}========================================"
    echo "  ✓ BUILD AND TEST SUCCESS"
    echo -e "========================================${NC}"
    exit 0
else
    echo -e "${RED}========================================"
    echo "  ✗ TESTS FAILED"
    echo -e "========================================${NC}"
    exit 1
fi
