#!/bin/bash
set -euo pipefail

echo "🚀 Starting code-server with VibeCode AI Assistant..."

# Install extension automatically
if [ -f ".vscode/extensions/vibecode-ai-assistant-1.0.0.vsix" ]; then
    echo "📦 Installing VibeCode AI Assistant extension..."
    code-server --install-extension .vscode/extensions/vibecode-ai-assistant-1.0.0.vsix || echo "Extension may already be installed"
fi

# Start code-server
code-server \
    --bind-addr 0.0.0.0:8080 \
    --auth none \
    --disable-telemetry \
    --disable-update-check \
    --disable-workspace-trust \
    --user-data-dir .vscode/code-server \
    --extensions-dir .vscode/extensions \
    --log trace \
    .

echo "✅ code-server started at http://localhost:8080"
echo "💡 VibeCode AI Assistant should be installed automatically!"
