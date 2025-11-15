#!/usr/bin/env bash

# VS Code Extension GUI Testing Script
# Uses AppleScript (built-in, free) and macOS automation
# License: Compatible with MIT/BSD/Apache (uses only built-in macOS tools)

set -e

echo "╔══════════════════════════════════════════════════════╗"
echo "║   Workspace RAG Extension - GUI Testing Script      ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if VS Code is installed
if [ ! -d "/Applications/Visual Studio Code.app" ]; then
    echo -e "${RED}✗ VS Code not found at /Applications/Visual Studio Code.app${NC}"
    echo "Please install VS Code first."
    exit 1
fi

echo -e "${GREEN}✓ VS Code found${NC}"

# Check if extension is packaged
VSIX_FILE="dist/extensions/workspace-rag-1.0.0.vsix"
if [ ! -f "$VSIX_FILE" ]; then
    echo -e "${RED}✗ Extension .vsix not found at $VSIX_FILE${NC}"
    echo "Run: python3 scripts/extensions/package_workspace_rag.py package --skip-tests"
    exit 1
fi

echo -e "${GREEN}✓ Extension package found${NC}"

# Install extension
echo ""
echo "📦 Installing extension..."
code --install-extension "$VSIX_FILE" --force 2>&1 | grep -E "(Installing|Successfully)" || true
sleep 2
echo -e "${GREEN}✓ Extension installed${NC}"

# Create test workspace
TEST_WORKSPACE="/tmp/vscode-rag-test"
mkdir -p "$TEST_WORKSPACE"
cat > "$TEST_WORKSPACE/test.js" << 'TESTFILE'
// Test file for Workspace RAG Extension
function helloWorld() {
    console.log("Hello from Workspace RAG test!");
    return "success";
}

module.exports = { helloWorld };
TESTFILE

echo -e "${GREEN}✓ Test workspace created at $TEST_WORKSPACE${NC}"

# Open VS Code with test workspace
echo ""
echo "🚀 Opening VS Code with test workspace..."
code "$TEST_WORKSPACE" &
sleep 5

echo ""
echo "════════════════════════════════════════════════════════"
echo "Manual Testing Steps:"
echo "════════════════════════════════════════════════════════"
echo ""
echo "1. ${YELLOW}Verify Extension is Loaded:${NC}"
echo "   - Press Cmd+Shift+X (Extensions view)"
echo "   - Search for 'Workspace RAG'"
echo "   - Should show as installed"
echo ""
echo "2. ${YELLOW}Configure Extension:${NC}"
echo "   - Press Cmd+Shift+P (Command Palette)"
echo "   - Type: 'Workspace RAG: Configure'"
echo "   - Set your LLM provider (OpenAI, Anthropic, etc.)"
echo "   - Add API key if needed"
echo ""
echo "3. ${YELLOW}Index Workspace:${NC}"
echo "   - Press Cmd+Shift+P"
echo "   - Type: 'Workspace RAG: Index Workspace'"
echo "   - Wait for indexing to complete"
echo ""
echo "4. ${YELLOW}Open RAG Chat:${NC}"
echo "   - Press Cmd+Shift+P"
echo "   - Type: 'Workspace RAG: Open Chat'"
echo "   - Chat panel should appear"
echo ""
echo "5. ${YELLOW}Ask a Question:${NC}"
echo "   - In chat panel, ask: 'What does helloWorld do?'"
echo "   - Extension should find test.js and explain the function"
echo ""
echo "════════════════════════════════════════════════════════"
echo ""
echo "🤖 Attempting automated testing with AppleScript..."
echo ""

# AppleScript automation (may require accessibility permissions)
osascript << 'APPLESCRIPT'
try
    tell application "Visual Studio Code"
        activate
        delay 2
    end tell
    
    -- Open command palette (Cmd+Shift+P)
    tell application "System Events"
        keystroke "p" using {command down, shift down}
        delay 1
        
        -- Type command to open extensions
        keystroke "Extensions: Install Extensions"
        delay 1
        keystroke return
        delay 2
        
        -- Search for Workspace RAG
        keystroke "Workspace RAG"
        delay 1
    end tell
    
    display notification "Extension search complete" with title "VS Code Test"
    
on error errMsg
    display dialog "Automation failed: " & errMsg buttons {"OK"} default button 1
end try
APPLESCRIPT

echo ""
echo -e "${GREEN}✓ Automated steps attempted${NC}"
echo ""
echo "════════════════════════════════════════════════════════"
echo "Additional Verification:"
echo "════════════════════════════════════════════════════════"
echo ""
echo "Check Output Panel:"
echo "  - View → Output"
echo "  - Select 'Workspace RAG' from dropdown"
echo "  - Look for initialization logs"
echo ""
echo "Check Developer Tools:"
echo "  - Help → Toggle Developer Tools"
echo "  - Console tab: Check for errors"
echo "  - Look for: [Workspace RAG] messages"
echo ""
echo "Test Database Connection:"
echo "  - Extension should log PostgreSQL connection status"
echo "  - Check if pgvector tables were created"
echo ""
echo "════════════════════════════════════════════════════════"
echo ""
echo -e "${YELLOW}Press Enter when done testing, or Ctrl+C to abort...${NC}"
read

echo ""
echo "✅ GUI Testing Complete!"
echo ""
echo "Next steps:"
echo "  - Review extension logs in VS Code Output panel"
echo "  - Check for any errors in Developer Tools console"
echo "  - Verify workspace was indexed successfully"
echo "  - Test RAG queries return relevant results"
