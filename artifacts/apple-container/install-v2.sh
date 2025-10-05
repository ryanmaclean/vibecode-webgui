#!/bin/bash
# VibeCode Apple Container Setup - Simplified
# Uses Homebrew (the standard way)

set -e

echo "=== VibeCode Apple Container Installer v2 ==="
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

# Check Homebrew
if ! command -v brew &> /dev/null; then
  echo "❌ Homebrew not found. Install from: https://brew.sh"
  exit 1
fi

echo "✅ Requirements met"
echo ""

# Install container via Homebrew (the standard way)
echo "Installing Apple Container via Homebrew..."
if brew list --cask container &> /dev/null; then
  echo "✅ Apple Container already installed"
else
  brew install --cask container
  echo "✅ Apple Container installed"
fi

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
echo "1. Run VibeCode: ./run-stack.sh"
echo "2. Or manually: container run -d -p 8080:8080 -e PASSWORD=yourpass codercom/code-server:latest"
echo "3. View containers: container list"
echo ""
echo "Installed via: Homebrew Cask (9,160+ users)"
