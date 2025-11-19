#!/bin/bash

# WebView Rendering Test Script
# Tests OpenVSCode Server rendering across different WebView engines
# Usage: ./scripts/test-webview-rendering.sh

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TAURI_DIR="$PROJECT_ROOT/src-tauri"
DOCS_DIR="$PROJECT_ROOT/docs"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}WebView Rendering Test${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""

# Detect platform
PLATFORM="unknown"
case "$(uname -s)" in
    Darwin)
        PLATFORM="macos"
        ;;
    Linux)
        PLATFORM="linux"
        ;;
    MINGW*|MSYS*|CYGWIN*)
        PLATFORM="windows"
        ;;
esac

echo -e "${BLUE}Platform:${NC} $PLATFORM"
echo ""

# Get WebView information
get_webview_info() {
    case "$PLATFORM" in
        macos)
            echo -e "${YELLOW}Detecting WebKit version...${NC}"
            WEBKIT_VERSION=$(defaults read /System/Library/Frameworks/WebKit.framework/Versions/Current/Resources/Info.plist CFBundleVersion 2>/dev/null || echo "unknown")
            MACOS_VERSION=$(sw_vers -productVersion)
            echo -e "${GREEN}WebKit Version:${NC} $WEBKIT_VERSION"
            echo -e "${GREEN}macOS Version:${NC} $MACOS_VERSION"
            ;;
        linux)
            echo -e "${YELLOW}Detecting WebKitGTK version...${NC}"
            if command -v pkg-config &> /dev/null; then
                WEBKIT_VERSION=$(pkg-config --modversion webkit2gtk-4.1 2>/dev/null || pkg-config --modversion webkit2gtk-4.0 2>/dev/null || echo "not found")
                echo -e "${GREEN}WebKitGTK Version:${NC} $WEBKIT_VERSION"
            else
                echo -e "${RED}pkg-config not found, cannot detect WebKitGTK version${NC}"
            fi
            ;;
        windows)
            echo -e "${YELLOW}Detecting WebView2 version...${NC}"
            # Try to detect WebView2 runtime
            if command -v reg &> /dev/null; then
                WEBVIEW2_VERSION=$(reg query "HKLM\\SOFTWARE\\Microsoft\\EdgeUpdate\\Clients\\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" /v pv 2>/dev/null | grep "pv" | awk '{print $NF}' || echo "not found")
                echo -e "${GREEN}WebView2 Version:${NC} $WEBVIEW2_VERSION"
            fi
            ;;
    esac
    echo ""
}

# Check if Tauri app is built
check_tauri_build() {
    echo -e "${YELLOW}Checking Tauri build...${NC}"

    if [ ! -f "$TAURI_DIR/target/release/vibecode" ] && [ ! -d "$TAURI_DIR/target/release/VibeCode.app" ]; then
        echo -e "${RED}Tauri app not built!${NC}"
        echo -e "Building now..."
        cd "$TAURI_DIR"
        cargo build --release
        cd "$PROJECT_ROOT"
    else
        echo -e "${GREEN}Tauri app is built${NC}"
    fi
    echo ""
}

# Get binary size
get_binary_size() {
    echo -e "${YELLOW}Binary size:${NC}"

    case "$PLATFORM" in
        macos)
            if [ -d "$TAURI_DIR/target/release/VibeCode.app" ]; then
                SIZE=$(du -sh "$TAURI_DIR/target/release/VibeCode.app" | awk '{print $1}')
                echo -e "${GREEN}VibeCode.app:${NC} $SIZE"
            fi
            ;;
        linux|windows)
            if [ -f "$TAURI_DIR/target/release/vibecode" ]; then
                SIZE=$(du -h "$TAURI_DIR/target/release/vibecode" | awk '{print $1}')
                echo -e "${GREEN}vibecode:${NC} $SIZE"
            fi
            ;;
    esac
    echo ""
}

# Create test results file
create_test_results() {
    RESULTS_FILE="$DOCS_DIR/WEBVIEW_TEST_RESULTS_$(date +%Y%m%d_%H%M%S).md"

    cat > "$RESULTS_FILE" << EOF
# WebView Rendering Test Results

**Date:** $(date +"%Y-%m-%d %H:%M:%S")
**Platform:** $PLATFORM
**Tester:** ${USER:-unknown}

## System Information

EOF

    case "$PLATFORM" in
        macos)
            cat >> "$RESULTS_FILE" << EOF
- **macOS Version:** $MACOS_VERSION
- **WebKit Version:** $WEBKIT_VERSION
- **WebView Engine:** WebKit (Safari-based)

EOF
            ;;
        linux)
            cat >> "$RESULTS_FILE" << EOF
- **Linux Distribution:** $(lsb_release -ds 2>/dev/null || cat /etc/os-release | grep PRETTY_NAME | cut -d '"' -f 2)
- **WebKitGTK Version:** $WEBKIT_VERSION
- **WebView Engine:** WebKitGTK

EOF
            ;;
        windows)
            cat >> "$RESULTS_FILE" << EOF
- **Windows Version:** $(systeminfo | findstr /B /C:"OS Name" /C:"OS Version")
- **WebView2 Version:** $WEBVIEW2_VERSION
- **WebView Engine:** WebView2 (Edge Chromium)

EOF
            ;;
    esac

    cat >> "$RESULTS_FILE" << 'EOF'
## OpenVSCode Server Rendering Test

### Test Checklist

Complete this checklist while testing the app:

#### Monaco Editor
- [ ] Editor loads without errors
- [ ] Syntax highlighting works correctly
- [ ] Code completion popup appears and is positioned correctly
- [ ] Cursor position is accurate
- [ ] Line numbers display properly
- [ ] Minimap renders correctly
- [ ] Find/Replace widget works

#### File Explorer
- [ ] File tree renders properly
- [ ] Folder icons display
- [ ] Expand/collapse animations are smooth
- [ ] Scrolling is performant
- [ ] Context menus appear correctly

#### Terminal
- [ ] Terminal text renders clearly
- [ ] Colors display correctly
- [ ] Cursor is visible and positioned correctly
- [ ] Output doesn't overlap
- [ ] ANSI colors work

#### Layout & UI
- [ ] Split editor views work
- [ ] Sidebar panels render
- [ ] Status bar is visible
- [ ] Activity bar icons display
- [ ] Modal dialogs appear centered
- [ ] Tooltips position correctly

#### Extensions
- [ ] Extensions panel loads
- [ ] Extension webviews render (if any)
- [ ] Extension icons display

#### Git Integration
- [ ] Git diff view works
- [ ] Inline diff decorations visible
- [ ] Source control panel renders

#### Performance
- [ ] Initial load time: _____ seconds
- [ ] Editor response time: _____ (Fast/Normal/Slow)
- [ ] Memory usage: _____ MB (check Activity Monitor/Task Manager)
- [ ] CPU usage at idle: _____ %

### Issues Found

List any rendering issues, visual bugs, or functional problems:

1.
2.
3.

### Screenshots

Attach screenshots of any issues:

- Issue 1: [description]
- Issue 2: [description]

### Comparison with Chromium

If you tested in Chrome/Edge browser, note differences:

-
-

### Overall Assessment

**Rating:** ⭐⭐⭐⭐⭐ (1-5 stars)

**Usability:** [ ] Excellent [ ] Good [ ] Acceptable [ ] Poor [ ] Unusable

**Rendering Quality:** [ ] Perfect [ ] Minor issues [ ] Major issues [ ] Broken

**Recommendation:**
- [ ] Stick with Tauri (works well enough)
- [ ] Need minor CSS fixes
- [ ] Requires major workarounds
- [ ] Consider Electron migration

### Notes

Additional observations:


---

**Next Steps:**

Based on results:
- If 4-5 stars + Excellent/Good: Update WEBVIEW_QUIRKS.md with minor notes
- If 2-3 stars + Acceptable: Create workarounds, test again
- If 1 star + Poor/Unusable: Run Electron POC (see ELECTRON_POC.md)

EOF

    echo -e "${GREEN}Created test results template:${NC} $RESULTS_FILE"
    echo ""
    echo -e "${YELLOW}Please fill out this file after testing the app!${NC}"
    echo ""
}

# Provide testing instructions
show_instructions() {
    echo -e "${BLUE}======================================${NC}"
    echo -e "${BLUE}Testing Instructions${NC}"
    echo -e "${BLUE}======================================${NC}"
    echo ""

    case "$PLATFORM" in
        macos)
            echo -e "${YELLOW}1. Launch the app:${NC}"
            echo -e "   open $TAURI_DIR/target/release/VibeCode.app"
            echo ""
            echo -e "${YELLOW}2. Enable Web Inspector (if needed):${NC}"
            echo -e "   defaults write com.vibecode.app WebKitDeveloperExtras -bool true"
            echo -e "   Then restart app and right-click → Inspect Element"
            echo ""
            ;;
        linux)
            echo -e "${YELLOW}1. Launch the app:${NC}"
            echo -e "   $TAURI_DIR/target/release/vibecode"
            echo ""
            echo -e "${YELLOW}2. Enable Web Inspector:${NC}"
            echo -e "   WEBKIT_INSPECTOR_SERVER=127.0.0.1:9222 $TAURI_DIR/target/release/vibecode"
            echo -e "   Then open http://127.0.0.1:9222 in browser"
            echo ""
            ;;
        windows)
            echo -e "${YELLOW}1. Launch the app:${NC}"
            echo -e "   $TAURI_DIR/target/release/vibecode.exe"
            echo ""
            echo -e "${YELLOW}2. DevTools are enabled in debug builds${NC}"
            echo ""
            ;;
    esac

    echo -e "${YELLOW}3. Test OpenVSCode Server:${NC}"
    echo -e "   - Open files and check editor rendering"
    echo -e "   - Test syntax highlighting"
    echo -e "   - Try code completion"
    echo -e "   - Open terminal"
    echo -e "   - Test file explorer"
    echo -e "   - Try git diff view"
    echo ""

    echo -e "${YELLOW}4. Take screenshots of any issues${NC}"
    echo ""

    echo -e "${YELLOW}5. Fill out the test results file${NC}"
    echo ""

    echo -e "${GREEN}For comparison, also test in Chrome/Edge:${NC}"
    echo -e "   1. Open http://localhost:8080 in Chrome/Edge"
    echo -e "   2. Note any differences from the Tauri app"
    echo -e "   3. Document in test results file"
    echo ""
}

# Quick automated checks
run_automated_checks() {
    echo -e "${BLUE}======================================${NC}"
    echo -e "${BLUE}Automated Checks${NC}"
    echo -e "${BLUE}======================================${NC}"
    echo ""

    # Check for common WebKit incompatibilities in code
    echo -e "${YELLOW}Scanning for potential WebKit issues...${NC}"

    ISSUES_FOUND=0

    # Check for backdrop-filter usage
    if grep -r "backdrop-filter" "$PROJECT_ROOT/src" "$PROJECT_ROOT/public" 2>/dev/null | grep -v node_modules > /dev/null; then
        echo -e "${YELLOW}⚠️  Found backdrop-filter usage (may be slow on WebKit)${NC}"
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
    fi

    # Check for gap in flexbox
    if grep -r "display: *flex" "$PROJECT_ROOT/src" "$PROJECT_ROOT/public" 2>/dev/null | grep -v node_modules > /dev/null; then
        if grep -r "gap:" "$PROJECT_ROOT/src" "$PROJECT_ROOT/public" 2>/dev/null | grep -v node_modules > /dev/null; then
            echo -e "${YELLOW}⚠️  Found flexbox with gap (check browser support)${NC}"
            ISSUES_FOUND=$((ISSUES_FOUND + 1))
        fi
    fi

    # Check for WebRTC usage
    if grep -r "getUserMedia\|RTCPeerConnection" "$PROJECT_ROOT/src" 2>/dev/null | grep -v node_modules > /dev/null; then
        echo -e "${YELLOW}⚠️  Found WebRTC usage (test on all platforms)${NC}"
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
    fi

    if [ $ISSUES_FOUND -eq 0 ]; then
        echo -e "${GREEN}✓ No obvious compatibility issues found${NC}"
    else
        echo -e "${YELLOW}Found $ISSUES_FOUND potential issues - test carefully!${NC}"
    fi
    echo ""
}

# Main execution
main() {
    get_webview_info
    check_tauri_build
    get_binary_size
    run_automated_checks
    create_test_results
    show_instructions

    echo -e "${BLUE}======================================${NC}"
    echo -e "${GREEN}Ready to test!${NC}"
    echo -e "${BLUE}======================================${NC}"
    echo ""
    echo -e "Test results will be saved to:"
    echo -e "${GREEN}$RESULTS_FILE${NC}"
    echo ""
}

# Run main function
main "$@"
