#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

# Install VibeCode extension when code-server reloads

# Initialize log aggregation
init_log_aggregation


set -euo pipefail

# Configuration
EXTENSION_VSIX=".vscode/extensions/vibecode-ai-assistant-1.0.0.vsix"
CODE_SERVER_DATA_DIR="${HOME}/.config/code-server"

echo "🔧 Setting up VibeCode AI Assistant for code-server reload..."

# 1. Install extension if not already installed
if [ -f "$EXTENSION_VSIX" ]; then
    echo "📦 Installing VibeCode AI Assistant extension..."
    code-server --install-extension "$EXTENSION_VSIX" || echo "⚠️  Extension may already be installed"
else
    echo "⚠️  Extension VSIX not found: $EXTENSION_VSIX"
fi

# 2. Create/update settings.json to show extension
mkdir -p "${CODE_SERVER_DATA_DIR}/User"

cat > "${CODE_SERVER_DATA_DIR}/User/settings.json" << 'EOF'
{
  "workbench.startupEditor": "none",
  "workbench.tips.enabled": false,
  "workbench.welcome.enabled": false,
  
  // Extension recommendations
  "extensions.autoUpdate": false,
  "extensions.autoCheckUpdates": false,
  "extensions.ignoreRecommendations": false,
  "extensions.showRecommendationsOnlyOnDemand": false,
  
  // Enable VibeCode AI Assistant
  "vibecode-ai-assistant.enableOnStartup": true,
  "vibecode-ai-assistant.showWelcome": true,
  
  // Security settings (bypass warnings)
  "security.workspace.trust.enabled": false,
  "security.workspace.trust.banner": "never",
  
  // Disable telemetry
  "telemetry.telemetryLevel": "off",
  "update.mode": "none"
}
EOF

echo "✅ Settings configured"

# 3. Create workspace recommendation
mkdir -p .vscode

cat > .vscode/extensions.json << 'EOF'
{
  "recommendations": [
    "vibecode.vibecode-ai-assistant"
  ]
}
EOF

echo "✅ Workspace recommendation added"

# 4. Create startup script
cat > scripts/code-server-with-extension.sh << 'EOF'
#!/bin/bash
# Start code-server with VibeCode extension

echo "🚀 Starting code-server with VibeCode AI Assistant..."
echo ""

# Install extension if needed
if [ -f ".vscode/extensions/vibecode-ai-assistant-1.0.0.vsix" ]; then
    echo "📦 Installing extension..."
    code-server --install-extension .vscode/extensions/vibecode-ai-assistant/vibecode-ai-assistant-1.0.0.vsix || true
fi

# Start code-server
code-server \
    --bind-addr 0.0.0.0:8080 \
    --auth none \
    --disable-telemetry \
    --disable-update-check \
    --disable-workspace-trust \
    --user-data-dir .vscode/code-server-data \
    --extensions-dir .vscode/extensions-installed \
    .

echo ""
echo "✅ code-server started at http://localhost:8080"
echo "💡 VibeCode AI Assistant should be available!"
EOF

chmod +x scripts/code-server-with-extension.sh

echo "✅ Startup script created: scripts/code-server-with-extension.sh"
echo ""
echo "To start code-server with extension:"
echo "  ./scripts/code-server-with-extension.sh"
