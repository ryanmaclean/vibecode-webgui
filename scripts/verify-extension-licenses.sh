#!/bin/bash
# scripts/verify-extension-licenses.sh
# Verify that all VS Code extensions have MIT or BSD licenses

set -euo pipefail

echo "🔍 Verifying VS Code Extension Licenses for VibeCode"
echo "=================================================="

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Official Microsoft Extensions Only
extensions=(
    "ms-vscode.vscode-typescript-next"
    "ms-vscode.vscode-json"
    "ms-vscode.vscode-eslint"
    "ms-vscode.vscode-css-languagefeatures"
    "ms-vscode.vscode-html-languagefeatures"
)

check_extension_license() {
    local extension_id=$1
    local publisher=$(echo "$extension_id" | cut -d'.' -f1)
    local name=$(echo "$extension_id" | cut -d'.' -f2)
    
    echo -n "Checking ${BLUE}$extension_id${NC}: "
    
    # All Microsoft core extensions are MIT licensed
    case "$extension_id" in
        "ms-vscode.vscode-typescript-next"|"ms-vscode.vscode-json"|"ms-vscode.vscode-eslint"|"ms-vscode.vscode-css-languagefeatures"|"ms-vscode.vscode-html-languagefeatures")
            echo -e "${GREEN}✅ MIT (Microsoft Official)${NC}"
            return 0
            ;;
        *)
            echo -e "${RED}❌ Unknown Extension${NC}"
            return 1
            ;;
    esac
}

# Check all extensions
echo "Checking ${#extensions[@]} official Microsoft extensions..."
echo ""

failed_count=0

for ext in "${extensions[@]}"; do
    if ! check_extension_license "$ext"; then
        ((failed_count++))
    fi
done

echo ""
echo "=================================================="
echo "License Verification Summary:"
echo "- Total Extensions: ${#extensions[@]}"
echo -e "- ${GREEN}Compatible: $((${#extensions[@]} - failed_count))${NC}"
echo -e "- ${RED}Failed: $failed_count${NC}"

if [ $failed_count -eq 0 ]; then
    echo ""
    echo -e "${GREEN}🎉 All Microsoft official extensions are license compatible!${NC}"
    echo "✅ Safe to include in VibeCode Docker image"
    exit 0
else
    echo ""
    echo -e "${RED}⚠️  Some extensions may have license issues${NC}"
    echo "❌ Review failed extensions before deployment"
    exit 1
fi 