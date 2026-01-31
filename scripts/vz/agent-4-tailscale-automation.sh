#!/bin/bash
# Agent 4: Create Tailscale Automation Script
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=== Agent 4: Creating Tailscale Automation ==="

cat > "$SCRIPT_DIR/setup-tailscale-vm.sh" << 'SCRIPTEOF'
#!/bin/bash
# Automated Tailscale Setup for OpenClaw VM
set -e

TAILSCALE_AUTH_KEY="${TAILSCALE_AUTH_KEY:-}"
TAILSCALE_HOSTNAME="${TAILSCALE_HOSTNAME:-openclaw-vm}"

echo "=== Tailscale Setup for OpenClaw VM ==="

# 1. Check Tailscale installed
if ! command -v tailscale &> /dev/null; then
    echo "Installing Tailscale..."
    brew install tailscale || {
        echo "ERROR: Failed to install Tailscale"
        exit 1
    }
fi

# 2. Get or use auth key
if [ -z "$TAILSCALE_AUTH_KEY" ]; then
    echo "⚠️  TAILSCALE_AUTH_KEY not set"
    echo "Get one from: https://login.tailscale.com/admin/settings/keys"
    echo "Then run: TAILSCALE_AUTH_KEY=your-key ./setup-tailscale-vm.sh"
    exit 1
fi

# 3. Start Tailscale
echo "Starting Tailscale..."
sudo tailscale up --authkey="$TAILSCALE_AUTH_KEY" --hostname="$TAILSCALE_HOSTNAME" --accept-routes || {
    echo "ERROR: Failed to start Tailscale"
    exit 1
}

# 4. Get Tailscale IP
TAILSCALE_IP=$(tailscale ip -4)
echo "✅ Tailscale IP: $TAILSCALE_IP"

# 5. Configure OpenClaw gateway to use Tailscale IP
echo "Configuring OpenClaw gateway..."
openclaw configure gateway --section gateway || {
    echo "⚠️  Manual configuration needed"
    echo "Set gateway URL to: ws://$TAILSCALE_IP:18789"
}

# 6. Test connectivity
echo "Testing connectivity..."
sleep 2
curl -s http://$TAILSCALE_IP:18789/health >/dev/null 2>&1 && echo "✅ Gateway accessible via Tailscale" || echo "⚠️  Gateway not yet accessible"

echo ""
echo "✅ Tailscale configured!"
echo "Gateway URL: http://$TAILSCALE_IP:18789"
SCRIPTEOF

chmod +x "$SCRIPT_DIR/setup-tailscale-vm.sh"
echo "✅ Tailscale automation script created"
echo "Location: $SCRIPT_DIR/setup-tailscale-vm.sh"
