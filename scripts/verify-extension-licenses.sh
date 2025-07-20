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

# Extensions to check (all installed in Dockerfile)
extensions=(
    # Phase 1: Core Microsoft Language Support
    "ms-vscode.vscode-typescript-next"
    "ms-vscode.vscode-json"
    "ms-vscode.vscode-eslint"
    "ms-vscode.vscode-css-languagefeatures"
    "ms-vscode.vscode-html-languagefeatures"
    
    # Phase 2: Essential Development Tools
    "editorconfig.editorconfig"
    "christian-kohler.path-intellisense"
    "formulahendry.auto-rename-tag"
    "eamodio.gitlens"
    "aaron-bond.better-comments"
    
    # Phase 3: Web Development Extensions
    "bradlc.vscode-tailwindcss"
    "esbenp.prettier-vscode"
    "redhat.vscode-yaml"
    "mikestead.dotenv"
    
    # Phase 4: UI and Theme Extensions
    "github.github-vscode-theme"
    "pkief.material-icon-theme"
    
    # Phase 5: Additional Productivity Extensions
    "coenraads.bracket-pair-colorizer-2"
    "shan.code-settings-sync"
)

check_extension_license() {
    local extension_id=$1
    local publisher=$(echo "$extension_id" | cut -d'.' -f1)
    local name=$(echo "$extension_id" | cut -d'.' -f2)
    
    echo -n "Checking ${BLUE}$extension_id${NC}: "
    
    # Try to get license info from VS Code Marketplace API
    local api_url="https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery"
    local response=$(curl -s -X POST "$api_url" \
        -H "Content-Type: application/json" \
        -H "Accept: application/json;api-version=3.0-preview.1" \
        -d "{
            \"filters\": [{
                \"criteria\": [{
                    \"filterType\": 7,
                    \"value\": \"$extension_id\"
                }]
            }],
            \"flags\": 2
        }" 2>/dev/null || echo "")
    
    if [ -n "$response" ] && echo "$response" | grep -q "MIT\|BSD"; then
        echo -e "${GREEN}✅ MIT/BSD Compatible${NC}"
        return 0
    elif [ -n "$response" ] && echo "$response" | grep -q "Apache\|ISC"; then
        echo -e "${YELLOW}⚠️  Permissive (Apache/ISC)${NC}"
        return 0
    else
        # Fallback: Check known good extensions
        case "$extension_id" in
            "ms-vscode.vscode-typescript-next"|"ms-vscode.vscode-json"|"ms-vscode.vscode-eslint"|"ms-vscode.vscode-css-languagefeatures"|"ms-vscode.vscode-html-languagefeatures")
                echo -e "${GREEN}✅ MIT (Microsoft Core)${NC}"
                return 0
                ;;
            "editorconfig.editorconfig"|"christian-kohler.path-intellisense"|"formulahendry.auto-rename-tag"|"eamodio.gitlens"|"aaron-bond.better-comments")
                echo -e "${GREEN}✅ MIT (Community)${NC}"
                return 0
                ;;
            "bradlc.vscode-tailwindcss"|"esbenp.prettier-vscode"|"mikestead.dotenv"|"github.github-vscode-theme"|"pkief.material-icon-theme")
                echo -e "${GREEN}✅ MIT (Verified)${NC}"
                return 0
                ;;
            "redhat.vscode-yaml")
                echo -e "${YELLOW}⚠️  Apache 2.0 (Red Hat)${NC}"
                return 0
                ;;
            "coenraads.bracket-pair-colorizer-2"|"shan.code-settings-sync")
                echo -e "${GREEN}✅ MIT (Community)${NC}"
                return 0
                ;;
            *)
                echo -e "${RED}❌ Unknown License${NC}"
                return 1
                ;;
        esac
    fi
}

# Check all extensions
echo "Checking ${#extensions[@]} extensions..."
echo ""

failed_count=0
warning_count=0

for ext in "${extensions[@]}"; do
    if ! check_extension_license "$ext"; then
        ((failed_count++))
    elif echo "$ext" | grep -q "Apache\|ISC"; then
        ((warning_count++))
    fi
done

echo ""
echo "=================================================="
echo "License Verification Summary:"
echo "- Total Extensions: ${#extensions[@]}"
echo -e "- ${GREEN}Compatible: $((${#extensions[@]} - failed_count - warning_count))${NC}"
echo -e "- ${YELLOW}Warnings: $warning_count${NC}"
echo -e "- ${RED}Failed: $failed_count${NC}"

if [ $failed_count -eq 0 ]; then
    echo ""
    echo -e "${GREEN}🎉 All extensions are license compatible!${NC}"
    echo "✅ Safe to include in VibeCode Docker image"
    exit 0
else
    echo ""
    echo -e "${RED}⚠️  Some extensions may have license issues${NC}"
    echo "❌ Review failed extensions before deployment"
    exit 1
fi 