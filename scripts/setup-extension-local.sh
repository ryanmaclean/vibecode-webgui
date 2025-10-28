#!/bin/bash
# Setup extension for code-server testing

echo "🔧 Setting up VibeCode AI Assistant for code-server testing..."

# 1. Copy extension to .vscode/extensions
mkdir -p .vscode/extensions
cp extensions/vibecode-ai-assistant/vibecode-ai-assistant-1.0.0.vsix .vscode/extensions/

echo "✅ Extension copied to .vscode/extensions"

# 2. Create extension recommendation
cat > .vscode/extensions.json << 'EOF'
{
  "recommendations": [
    "vibecode.vibecode-ai-assistant"
  ]
}
EOF

echo "✅ Extension recommendation added"

# 3. Create code-server startup script with extension install
cat > scripts/test-extension.sh << 'EOF'
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
EOF

chmod +x scripts/test-extension.sh

echo "✅ Test script created: scripts/test-extension.sh"
echo ""
echo "To test locally:"
echo "  ./scripts/test-extension.sh"
