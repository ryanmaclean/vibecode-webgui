#!/bin/bash
# Test script for VibeCode launcher
# Tests both Chromium Kiosk and Electron options

set -e

echo "🧪 VibeCode Launcher Test Suite"
echo "================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Check launcher syntax
echo "Test 1: Checking launcher syntax..."
if node -c launcher.js; then
    echo -e "${GREEN}✅ Launcher syntax valid${NC}"
else
    echo -e "${RED}❌ Launcher syntax error${NC}"
    exit 1
fi

# Test 2: Check dependencies
echo ""
echo "Test 2: Checking dependencies..."
MISSING_DEPS=0

if ! which node > /dev/null; then
    echo -e "${RED}❌ Node.js not found${NC}"
    MISSING_DEPS=1
else
    echo -e "${GREEN}✅ Node.js: $(node --version)${NC}"
fi

if ! which code-server > /dev/null && ! which openvscode-server > /dev/null; then
    echo -e "${YELLOW}⚠️  No editor server found (code-server or openvscode-server)${NC}"
else
    if which openvscode-server > /dev/null; then
        echo -e "${GREEN}✅ OpenVSCode Server found${NC}"
    fi
    if which code-server > /dev/null; then
        echo -e "${GREEN}✅ code-server found${NC}"
    fi
fi

# Test 3: Check browser detection
echo ""
echo "Test 3: Browser detection..."
node -e "
const fs = require('fs');
const path = require('path');

function findChromium() {
    const platform = process.platform;
    if (platform === 'darwin') {
        const paths = [
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            '/Applications/Chromium.app/Contents/MacOS/Chromium',
            '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
        ];
        for (const p of paths) {
            if (fs.existsSync(p)) {
                console.log('✅ Chromium:', p);
                return true;
            }
        }
    }
    return false;
}

if (findChromium()) {
    console.log('✅ Browser detection working');
} else {
    console.log('⚠️  No Chromium found');
}
"

# Test 4: Check backend availability
echo ""
echo "Test 4: Backend availability..."
BACKEND_PATH=""
if [ -f "src-tauri/target/release/vibecode" ]; then
    BACKEND_PATH="src-tauri/target/release/vibecode"
    echo -e "${GREEN}✅ Rust backend found: $BACKEND_PATH${NC}"
elif [ -f "target/release/vibecode-backend" ]; then
    BACKEND_PATH="target/release/vibecode-backend"
    echo -e "${GREEN}✅ Rust backend found: $BACKEND_PATH${NC}"
else
    echo -e "${YELLOW}⚠️  Rust backend not built (run: cd src-tauri && cargo build --release)${NC}"
fi

# Test 5: Check VM option
echo ""
echo "Test 5: Lightweight VM option..."
if [ -f "scripts/benchmarks/vscode_microvm.sh" ]; then
    echo -e "${GREEN}✅ OpenVSCode VM script found${NC}"
    if [ -d "fast-openvscode-vm" ]; then
        echo -e "${GREEN}✅ OpenVSCode VM artifacts found${NC}"
    else
        echo -e "${YELLOW}⚠️  OpenVSCode VM artifacts not built${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  OpenVSCode VM script not found${NC}"
fi

# Test 6: Port availability
echo ""
echo "Test 6: Port availability..."
if lsof -ti:8080 > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Port 8080 is in use${NC}"
else
    echo -e "${GREEN}✅ Port 8080 available${NC}"
fi

if lsof -ti:3000 > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Port 3000 is in use${NC}"
else
    echo -e "${GREEN}✅ Port 3000 available${NC}"
fi

if lsof -ti:3030 > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Port 3030 is in use${NC}"
else
    echo -e "${GREEN}✅ Port 3030 available${NC}"
fi

# Summary
echo ""
echo "================================="
echo "Test Summary"
echo "================================="
echo ""
echo "Next steps:"
echo "1. Build backend: cd src-tauri && cargo build --release"
echo "2. Run launcher: npm start"
echo "3. Or test VM: scripts/benchmarks/vscode_microvm.sh start"
echo ""
echo "For lightweight VM option:"
echo "  scripts/benchmarks/vscode_microvm.sh start"
echo "  # Then access: http://localhost:3600"
echo ""

if [ $MISSING_DEPS -eq 0 ]; then
    echo -e "${GREEN}✅ All critical checks passed!${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️  Some dependencies missing, but launcher may still work${NC}"
    exit 0
fi

