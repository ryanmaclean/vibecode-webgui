#!/bin/bash
# Test script to verify code-server extensions are installed correctly

set -e

echo "🧪 Testing Code-Server Extensions"
echo "=================================="

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASSED=0
FAILED=0

# Function to test if extension is installed
test_extension() {
    local extension_id=$1
    local extension_name=$2
    
    echo -n "Testing ${extension_name}... "
    
    if docker exec code-server-test code-server --list-extensions | grep -q "^${extension_id}$"; then
        echo -e "${GREEN}✓ PASSED${NC}"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}✗ FAILED${NC}"
        ((FAILED++))
        return 1
    fi
}

# Start test container
echo "Starting test container..."
docker run -d --name code-server-test \
    -p 8080:8080 \
    vibecode/code-server:latest \
    tail -f /dev/null

# Wait for container to be ready
sleep 5

echo ""
echo "Testing AI Coding Assistants:"
echo "-----------------------------"
test_extension "continue.continue" "Continue"
test_extension "codeium.codeium" "Codeium"
test_extension "saoudrizwan.claude-dev" "Cline (Claude Dev)"
test_extension "aider.aider-vscode" "Aider"

echo ""
echo "Testing Productivity Tools:"
echo "---------------------------"
test_extension "usernamehw.errorlens" "Error Lens"
test_extension "streetsidesoftware.code-spell-checker" "Code Spell Checker"
test_extension "wayou.vscode-todo-highlight" "TODO Highlight"
test_extension "gruntfuggly.todo-tree" "TODO Tree"
test_extension "pkief.material-icon-theme" "Material Icon Theme"
test_extension "oderwat.indent-rainbow" "Indent Rainbow"
test_extension "christian-kohler.path-intellisense" "Path Intellisense"

echo ""
echo "Testing Database Tools:"
echo "----------------------"
test_extension "mtxr.sqltools" "SQLTools"
test_extension "mtxr.sqltools-driver-pg" "SQLTools PostgreSQL Driver"

echo ""
echo "Testing DevOps Tools:"
echo "--------------------"
test_extension "ms-azuretools.vscode-docker" "Docker"
test_extension "ms-kubernetes-tools.vscode-kubernetes-tools" "Kubernetes"
test_extension "humao.rest-client" "REST Client"

echo ""
echo "Testing Documentation Tools:"
echo "---------------------------"
test_extension "yzhang.markdown-all-in-one" "Markdown All in One"
test_extension "davidanson.vscode-markdownlint" "Markdown Lint"

echo ""
echo "Testing Language Support:"
echo "------------------------"
test_extension "ms-python.python" "Python"
test_extension "ms-python.vscode-pylance" "Pylance"
test_extension "ms-python.black-formatter" "Black Formatter"
test_extension "ms-vscode.vscode-typescript-next" "TypeScript"
test_extension "ms-vscode.vscode-eslint" "ESLint"

echo ""
echo "Testing Remote Development:"
echo "--------------------------"
test_extension "ms-vscode-remote.remote-ssh" "Remote SSH"
test_extension "ms-vscode-remote.remote-containers" "Remote Containers"

# Cleanup
echo ""
echo "Cleaning up test container..."
docker stop code-server-test
docker rm code-server-test

# Summary
echo ""
echo "=================================="
echo "Test Summary:"
echo "  Passed: ${PASSED}"
echo "  Failed: ${FAILED}"
echo "=================================="

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed!${NC}"
    exit 1
fi
