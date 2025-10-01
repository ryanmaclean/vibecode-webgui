#!/bin/bash
# Download VS Code extensions from Open VSX for offline installation

set -e

EXTENSIONS_DIR="docker/code-server/extensions-vsix"
mkdir -p "$EXTENSIONS_DIR"

echo "📦 Downloading extensions from Open VSX..."

# Function to download extension
download_extension() {
    local publisher=$1
    local name=$2
    local version=${3:-latest}
    
    echo "Downloading ${publisher}.${name}..."
    
    if [ "$version" = "latest" ]; then
        # Get latest version
        curl -sL "https://open-vsx.org/api/${publisher}/${name}" | \
            jq -r '.version' > /tmp/version.txt
        version=$(cat /tmp/version.txt)
    fi
    
    # Download VSIX
    curl -L "https://open-vsx.org/api/${publisher}/${name}/${version}/file/${publisher}.${name}-${version}.vsix" \
        -o "$EXTENSIONS_DIR/${publisher}.${name}-${version}.vsix"
    
    echo "✓ Downloaded ${publisher}.${name} v${version}"
}

# Download AI extensions
download_extension "anthropic" "claude-code" "latest"
download_extension "openai" "chatgpt" "latest"
download_extension "GitHub" "copilot" "latest"
download_extension "GitHub" "copilot-chat" "latest"
download_extension "Codeium" "codeium" "latest"
download_extension "saoudrizwan" "claude-dev" "latest"

# Download development extensions
download_extension "ms-vscode" "vscode-typescript-next" "latest"
download_extension "dbaeumer" "vscode-eslint" "latest"
download_extension "esbenp" "prettier-vscode" "latest"
download_extension "eamodio" "gitlens" "latest"

echo ""
echo "✅ All extensions downloaded to $EXTENSIONS_DIR"
echo ""
ls -lh "$EXTENSIONS_DIR"
