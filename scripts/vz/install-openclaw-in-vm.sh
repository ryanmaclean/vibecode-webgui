#!/bin/bash
# Install OpenClaw + Tailscale + DNS + Let's Encrypt in macOS VM
# Run this INSIDE the VM after first boot

set -e

echo "=== Installing OpenClaw in VM ==="

# 1. Install Homebrew if not present
if ! command -v brew &> /dev/null; then
    echo "Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi

# 2. Install OpenClaw
echo "Installing OpenClaw..."
brew install openclaw

# 3. Install Tailscale
echo "Installing Tailscale..."
brew install tailscale

# 4. Configure Tailscale
echo "Configuring Tailscale..."
sudo tailscale up --accept-routes

# 5. Install certbot for Let's Encrypt
echo "Installing certbot..."
brew install certbot

# 6. Install OpenClaw gateway
echo "Installing OpenClaw gateway..."
openclaw gateway install

# 7. Configure OpenClaw to use Tailscale IP
TAILSCALE_IP=$(tailscale ip -4)
echo "Tailscale IP: $TAILSCALE_IP"
openclaw configure gateway --section gateway

# 8. Start services
echo "Starting services..."
sudo launchctl bootstrap system /Library/LaunchDaemons/com.tailscale.tailscaled.plist || true
launchctl bootstrap gui/$UID/ai.openclaw.gateway.plist || true

echo ""
echo "✅ OpenClaw installed and configured!"
echo "Gateway: http://$TAILSCALE_IP:18789"
