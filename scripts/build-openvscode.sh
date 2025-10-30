#!/usr/bin/env bash
# Build openvscode-server with Liquid Glass UI
# Optimized for M4 Max, Apple Silicon

set -euo pipefail

echo "🚀 Building openvscode-server with Liquid Glass UI"
echo "=================================================="
echo ""

OPENVSCODE_DIR="openvscode-server"
VIBECODE_THEME_DIR="src/vs/workbench/contrib/vibecode"

# Clone openvscode-server if not present
if [[ ! -d "$OPENVSCODE_DIR" ]]; then
    echo "📥 Cloning openvscode-server..."
    git clone --depth 1 https://github.com/gitpod-io/openvscode-server.git
    cd "$OPENVSCODE_DIR"
else
    echo "📂 Using existing openvscode-server"
    cd "$OPENVSCODE_DIR"
    git pull
fi

echo ""
echo "📦 Installing dependencies..."
yarn install --frozen-lockfile

echo ""
echo "🎨 Applying Liquid Glass theme..."

# Create VibeCode theme directory
mkdir -p "$VIBECODE_THEME_DIR"

# Copy Liquid Glass CSS
cp ../src/styles/liquid-glass.css "$VIBECODE_THEME_DIR/liquid-glass.css"

# Inject Liquid Glass into workbench
cat >> "src/vs/workbench/workbench.web.main.ts" <<'EOF'

// VibeCode Liquid Glass Theme
import '../contrib/vibecode/liquid-glass.css';
EOF

echo ""
echo "🔨 Building openvscode-server (this may take 10-15 minutes)..."
yarn run compile-web

echo ""
echo "📦 Building extensions..."
yarn run compile-extensions

echo ""
echo "✅ Build complete!"
echo ""
echo "Start server:"
echo "  cd $OPENVSCODE_DIR"
echo "  yarn run server --port 3001"
echo ""
echo "Access at: http://localhost:3001"

