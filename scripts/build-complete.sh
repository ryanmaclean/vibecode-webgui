#!/bin/bash
# MIT License - Complete VibeCode build process
# Builds Swift VM manager, Next.js frontend (if needed), and Tauri app

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

echo "🚀 Building VibeCode - Complete Build Process"
echo "=============================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check prerequisites
echo "📋 Checking prerequisites..."

MISSING_DEPS=0

if ! command -v swift &> /dev/null; then
    echo -e "${RED}❌ Swift not found${NC}"
    MISSING_DEPS=1
fi

if ! command -v cargo &> /dev/null; then
    echo -e "${RED}❌ Cargo (Rust) not found${NC}"
    MISSING_DEPS=1
fi

if ! command -v bun &> /dev/null && ! command -v npm &> /dev/null; then
    echo -e "${YELLOW}⚠️  Bun/npm not found (needed for frontend)${NC}"
fi

if [ $MISSING_DEPS -eq 1 ]; then
    echo ""
    echo "Please install missing dependencies and try again."
    exit 1
fi

echo -e "${GREEN}✅ Prerequisites OK${NC}"
echo ""

# Step 1: Build Swift VM Manager
echo "📦 Step 1: Building Swift VM Manager..."
echo "--------------------------------------"
cd VibeCodeSwift

if swift build -c release; then
    echo -e "${GREEN}✅ Swift build successful${NC}"
else
    echo -e "${RED}❌ Swift build failed${NC}"
    exit 1
fi

# Code signing
echo ""
echo "🔐 Code signing Swift binary..."
if codesign --force --sign - --entitlements VibeCode.entitlements .build/release/VibeCode 2>/dev/null; then
    echo -e "${GREEN}✅ Code signing successful${NC}"
else
    echo -e "${YELLOW}⚠️  Code signing skipped (development mode)${NC}"
fi

cd "$PROJECT_ROOT"
echo ""

# Step 2: Check if frontend needs building
echo "📦 Step 2: Checking frontend..."
echo "--------------------------------"

if [ -d "src-tauri" ] && [ -f "src-tauri/tauri.conf.json" ]; then
    # Check if Tauri needs frontend build
    FRONTEND_DIST=$(grep -A 5 '"build"' src-tauri/tauri.conf.json | grep '"frontendDist"' | cut -d'"' -f4 || echo "")
    
    if [ -n "$FRONTEND_DIST" ] && [ ! -d "$FRONTEND_DIST" ]; then
        echo "Frontend dist not found, checking if build is needed..."
        
        if [ -f "package.json" ]; then
            echo "Building Next.js frontend..."
            if command -v bun &> /dev/null; then
                bun run build:tauri || npm run build:tauri
            else
                npm run build:tauri
            fi
            echo -e "${GREEN}✅ Frontend build complete${NC}"
        fi
    else
        echo -e "${GREEN}✅ Frontend already built${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Tauri config not found, skipping frontend check${NC}"
fi

echo ""

# Step 3: Build Tauri app
echo "📦 Step 3: Building Tauri application..."
echo "--------------------------------------"

if [ -d "src-tauri" ]; then
    cd src-tauri
    
    # Check if VM binaries exist
    if [ ! -d "binaries" ]; then
        echo -e "${YELLOW}⚠️  Creating binaries directory...${NC}"
        mkdir -p binaries
    fi
    
    # Copy Swift binary if it exists
    if [ -f "../VibeCodeSwift/.build/release/VibeCode" ]; then
        echo "Copying VM manager binary..."
        cp ../VibeCodeSwift/.build/release/VibeCode binaries/vibecode-vm 2>/dev/null || true
    fi
    
    # Build Tauri
    echo "Running cargo tauri build..."
    if cargo tauri build; then
        echo -e "${GREEN}✅ Tauri build successful${NC}"
    else
        echo -e "${RED}❌ Tauri build failed${NC}"
        exit 1
    fi
    
    cd "$PROJECT_ROOT"
else
    echo -e "${YELLOW}⚠️  src-tauri directory not found, skipping Tauri build${NC}"
fi

echo ""

# Summary
echo "=============================================="
echo -e "${GREEN}✅ Build Complete!${NC}"
echo "=============================================="
echo ""

# Show output locations
echo "📦 Output locations:"
echo ""

if [ -f "VibeCodeSwift/.build/release/VibeCode" ]; then
    echo "  Swift VM Manager:"
    echo "    $(ls -lh VibeCodeSwift/.build/release/VibeCode | awk '{print $9, "(" $5 ")"}')"
fi

if [ -d "src-tauri/target/release/bundle" ]; then
    echo ""
    echo "  Tauri App Bundle:"
    find src-tauri/target/release/bundle -name "*.app" -o -name "*.dmg" 2>/dev/null | head -5 | while read file; do
        if [ -f "$file" ]; then
            echo "    $(ls -lh "$file" | awk '{print $9, "(" $5 ")"}')"
        elif [ -d "$file" ]; then
            echo "    $file/"
        fi
    done
fi

echo ""
echo "🎯 Next steps:"
echo "  1. Test Swift VM manager: ./VibeCodeSwift/.build/release/VibeCode"
echo "  2. Test Tauri app: open src-tauri/target/release/bundle/macos/VibeCode.app"
echo "  3. Verify VM control functionality"
echo ""
echo "🎉 Done!"

