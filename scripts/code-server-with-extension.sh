#!/bin/bash
# Start code-server with VibeCode extension

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXTENSION_VSIX="$REPO_ROOT/.vscode/extensions/vibecode-ai-assistant-1.0.0.vsix"

echo "🚀 Starting code-server with VibeCode AI Assistant..."
echo "📁 Extension: $EXTENSION_VSIX"
echo ""

# Install extension if it exists
if [ -f "$EXTENSION_VSIX" ]; then
    echo "📦 Installing VibeCode AI Assistant extension..."
    code-server --install-extension "$EXTENSION_VSIX" 2>&1 | grep -v "already installed" || true
    echo ""
fi

# Start code-server
echo "🌐 Starting code-server..."
echo "   Access at: http://localhost:8080"
echo ""

code-server \
    --bind-addr 0.0.0.0:8080 \
    --auth none \
    --disable-telemetry \
    --disable-update-check \
    --disable-workspace-trust \
    --user-data-dir "$REPO_ROOT/.vscode/code-server-data" \
    --extensions-dir "$REPO_ROOT/.vscode/extensions" \
    "$REPO_ROOT"

echo ""
echo "✅ code-server started!"
echo "💡 VibeCode AI Assistant should be available in Extensions view"
