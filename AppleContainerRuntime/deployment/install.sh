#!/bin/bash
# VibeCode Apple Container Setup Script
# Installs Apple Container CLI and configures for VibeCode

set -e

echo "=== VibeCode Apple Container Installer ==="
echo ""

# Check requirements
if [[ $(uname -m) != "arm64" ]]; then
  echo "❌ Error: Apple Silicon (ARM64) required"
  exit 1
fi

if [[ $(sw_vers -productVersion | cut -d. -f1) -lt 15 ]]; then
  echo "❌ Error: macOS 15+ (Sequoia) required"
  exit 1
fi

echo "✅ Requirements met"
echo ""

# Download Apple Container CLI
echo "Downloading Apple Container CLI v0.4.1..."
cd /tmp
curl -L -o container.pkg \
  "https://github.com/apple/container/releases/download/0.4.1/container-0.4.1-installer-signed.pkg"

echo "Installing..."
sudo installer -pkg container.pkg -target /

echo "✅ Apple Container CLI installed"
echo ""

# Start system service
echo "Starting container system service..."
container system start

echo "✅ System service started"
echo ""

# Test installation
echo "Testing installation..."
container run alpine:latest echo "✅ Apple Container working!"

echo ""
echo "=== Installation Complete ==="
echo ""
echo "Next steps:"
echo "1. Run code-server: container run -d -p 8080:8080 -e PASSWORD=yourpass codercom/code-server:latest"
echo "2. Access at: http://localhost:8080"
echo "3. View containers: container list"
echo ""
echo "Documentation: https://github.com/ryanmaclean/vibecode-webgui/blob/main/docs/APPLE_CONTAINER_SUCCESS.md"
