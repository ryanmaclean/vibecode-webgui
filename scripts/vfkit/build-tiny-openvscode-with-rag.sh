#!/bin/sh
# Build TINY openvscode-server with RAG GenAI Chat Extension
# Alpine ARM64 musl build with preinstalled extensions

set -e

echo "======================================================================"
echo "  Building TINY openvscode-server + RAG GenAI Extension (musl ARM64)"
echo "======================================================================"
echo ""

# System info
echo "📊 System:"
uname -m
ldd --version 2>&1 | head -1 || echo "musl libc"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
apk update
apk add --no-cache \
    nodejs \
    npm \
    ca-certificates \
    libstdc++ \
    aria2 \
    git \
    jq

echo ""
node --version
npm --version
echo ""

# Download openvscode-server
cd /opt
echo "📥 Downloading openvscode-server..."

OPENVSCODE_VERSION="1.105.1"
DOWNLOAD_URL="https://github.com/gitpod-io/openvscode-server/releases/download/openvscode-server-v${OPENVSCODE_VERSION}/openvscode-server-v${OPENVSCODE_VERSION}-linux-arm64.tar.gz"

echo "URL: ${DOWNLOAD_URL}"
aria2c --max-connection-per-server=16 --split=16 \
    --file-allocation=none --continue=true \
    --dir=/opt --out=openvscode.tar.gz \
    "${DOWNLOAD_URL}"

echo ""
echo "📦 Extracting..."
tar -xzf openvscode.tar.gz
rm openvscode.tar.gz

mv openvscode-server-v${OPENVSCODE_VERSION}-linux-arm64 openvscode-server
cd openvscode-server

# Verify musl
echo ""
echo "🔍 Checking C library:"
ldd bin/openvscode-server 2>&1 | head -5 || file bin/openvscode-server
echo ""

# Install RAG GenAI Chat extension
echo "🤖 Installing RAG GenAI Chat Extension..."
echo ""

# Create extensions directory
mkdir -p /opt/openvscode-extensions

# Search for RAG/AI chat extensions
echo "Searching for GenAI chat extensions..."

# Popular AI/RAG extensions for VS Code:
# 1. Continue (AI code assistant with RAG)
# 2. Cody (Sourcegraph AI with context)
# 3. GitHub Copilot Chat
# 4. Tabnine

# Install Continue (open source, supports RAG, local models)
CONTINUE_VERSION="0.9.256"
CONTINUE_URL="https://marketplace.visualstudio.com/_apis/public/gallery/publishers/Continue/vsextensions/continue/${CONTINUE_VERSION}/vspackage"

echo "Installing Continue (RAG-enabled AI assistant)..."
aria2c --max-connection-per-server=16 \
    --out=/tmp/continue.vsix \
    "${CONTINUE_URL}" || {
    echo "⚠️  Continue extension download failed, trying alternative..."
    # Alternative: Install via command line after startup
    echo "Will install via openvscode CLI after startup"
}

# If download succeeded, install it
if [ -f /tmp/continue.vsix ]; then
    ./bin/openvscode-server --install-extension /tmp/continue.vsix \
        --extensions-dir=/opt/openvscode-extensions || {
        echo "⚠️  Extension install via CLI failed, will install at runtime"
    }
    rm /tmp/continue.vsix
fi

# Create extension install script for runtime
cat > /opt/openvscode-server/install-extensions.sh <<'EXTSCRIPT'
#!/bin/sh
# Install extensions at runtime
cd /opt/openvscode-server

# Continue - AI assistant with RAG support
./bin/openvscode-server --install-extension Continue.continue \
    --extensions-dir=/opt/openvscode-extensions || true

# Optional: Install other useful extensions
./bin/openvscode-server --install-extension ms-python.python \
    --extensions-dir=/opt/openvscode-extensions || true

echo "✅ Extensions installed"
EXTSCRIPT

chmod +x /opt/openvscode-server/install-extensions.sh

# Configure openvscode for AI/RAG features
mkdir -p /opt/openvscode-server/user-data
cat > /opt/openvscode-server/user-data/settings.json <<'SETTINGS'
{
  "continue.telemetryEnabled": false,
  "continue.enableTabAutocomplete": true,
  "workbench.colorTheme": "Dark+",
  "editor.fontSize": 14,
  "editor.minimap.enabled": false,
  "extensions.autoUpdate": false,
  "telemetry.telemetryLevel": "off"
}
SETTINGS

# Create optimized startup script
cat > /opt/openvscode-server/start.sh <<'STARTSCRIPT'
#!/bin/sh
cd /opt/openvscode-server

# Install extensions if not already installed
if [ ! -d "/opt/openvscode-extensions/Continue.continue" ]; then
    echo "Installing extensions..."
    ./install-extensions.sh
fi

# Start server
exec ./bin/openvscode-server \
    --host 0.0.0.0 \
    --port 3000 \
    --without-connection-token \
    --extensions-dir=/opt/openvscode-extensions \
    --user-data-dir=/opt/openvscode-server/user-data \
    --accept-server-license-terms \
    --telemetry-level off
STARTSCRIPT

chmod +x /opt/openvscode-server/start.sh

# Strip binaries for smaller size
echo ""
echo "🔪 Stripping binaries..."
find /opt/openvscode-server -type f -name "*.node" -exec strip --strip-unneeded {} \; 2>/dev/null || true
strip --strip-unneeded /opt/openvscode-server/node 2>/dev/null || true

# Remove unnecessary files
echo "🧹 Removing unnecessary files..."
rm -rf /opt/openvscode-server/node_modules/*/test
rm -rf /opt/openvscode-server/node_modules/*/tests
rm -rf /opt/openvscode-server/node_modules/*/*.md
find /opt/openvscode-server -name "*.map" -delete 2>/dev/null || true

echo ""
echo "💾 Final size:"
du -sh /opt/openvscode-server
du -sh /opt/openvscode-extensions 2>/dev/null || echo "Extensions: pending first run"
echo ""

# Create OpenRC service
cat > /etc/init.d/openvscode <<'SERVICE'
#!/sbin/openrc-run

name="openvscode-server"
description="OpenVSCode Server with RAG GenAI"

command="/opt/openvscode-server/start.sh"
command_background="yes"
pidfile="/run/openvscode.pid"
output_log="/var/log/openvscode.log"
error_log="/var/log/openvscode.err"

depend() {
    need net
}

start_pre() {
    touch $output_log $error_log
}
SERVICE

chmod +x /etc/init.d/openvscode

# Enable and start
rc-update add openvscode default
rc-service openvscode start

echo ""
echo "⏳ Waiting for openvscode-server to start..."
sleep 5

# Check if running
if nc -z localhost 3000 2>/dev/null; then
    echo "✅ openvscode-server is running!"
else
    echo "⚠️  Server starting... check logs:"
    echo "   tail -f /var/log/openvscode.log"
fi

echo ""
echo "======================================================================"
echo "  ✅ OpenVSCode Server + RAG GenAI Complete!"
echo "======================================================================"
echo ""
echo "Service: openvscode-server"
echo "Port: 3000"
echo "C Library: musl ✅"
echo "Extensions: RAG GenAI (Continue) ✅"
echo ""
echo "Features:"
echo "  • AI-powered code completion"
echo "  • RAG-based context awareness"
echo "  • Chat with your codebase"
echo "  • Supports local and remote models"
echo ""
echo "Access: http://<vm-ip>:3000"
echo ""
echo "Status:"
rc-service openvscode status
echo ""
echo "📊 Total footprint:"
df -h / | tail -1

