#!/bin/sh
# Install Gitpod OpenVSCode Server in Alpine VM
# Run this inside the VM after it boots

set -e

OPENVSCODE_VERSION="1.105.1"

echo "═══════════════════════════════════════════════════════"
echo "  Installing OpenVSCode Server v${OPENVSCODE_VERSION}"
echo "═══════════════════════════════════════════════════════"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
apk add --no-cache libstdc++ ca-certificates wget tar

# Download OpenVSCode Server
echo "📥 Downloading OpenVSCode Server..."
cd /tmp
wget "https://github.com/gitpod-io/openvscode-server/releases/download/openvscode-server-v${OPENVSCODE_VERSION}/openvscode-server-v${OPENVSCODE_VERSION}-linux-arm64.tar.gz"

# Extract to /opt
echo "📦 Installing to /opt..."
mkdir -p /opt
tar -xzf "openvscode-server-v${OPENVSCODE_VERSION}-linux-arm64.tar.gz" -C /opt
mv "/opt/openvscode-server-v${OPENVSCODE_VERSION}-linux-arm64" /opt/openvscode-server

# Cleanup
rm "openvscode-server-v${OPENVSCODE_VERSION}-linux-arm64.tar.gz"

# Create start script
cat > /usr/local/bin/start-vscode << 'EOF'
#!/bin/sh
echo "Starting OpenVSCode Server on http://localhost:3000"
/opt/openvscode-server/bin/openvscode-server \
  --host 0.0.0.0 \
  --port 3000 \
  --without-connection-token \
  --accept-server-license-terms \
  "$@"
EOF
chmod +x /usr/local/bin/start-vscode

echo ""
echo "✅ OpenVSCode Server installed successfully!"
echo ""
echo "To start:"
echo "  start-vscode"
echo ""
echo "Access from macOS:"
echo "  http://localhost:3000"
echo ""
