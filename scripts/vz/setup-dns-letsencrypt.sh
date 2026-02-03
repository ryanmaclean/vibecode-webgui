#!/bin/bash
# Configure private DNS and Let's Encrypt in VM
# Run this INSIDE the VM

set -e

DOMAIN="${1:-openclaw.local}"
TAILSCALE_IP=$(tailscale ip -4)

echo "=== Setting up DNS and Let's Encrypt ==="
echo "Domain: $DOMAIN"
echo "Tailscale IP: $TAILSCALE_IP"
echo ""

# 1. Install dnsmasq for private DNS
echo "Installing dnsmasq..."
brew install dnsmasq

# 2. Configure dnsmasq
echo "Configuring dnsmasq..."
sudo mkdir -p /usr/local/etc
cat > /tmp/dnsmasq.conf << DNSMASQ
# Private DNS for OpenClaw
address=/$DOMAIN/$TAILSCALE_IP
listen-address=127.0.0.1
DNSMASQ
sudo mv /tmp/dnsmasq.conf /usr/local/etc/dnsmasq.conf

# 3. Start dnsmasq
echo "Starting dnsmasq..."
sudo brew services start dnsmasq

# 4. Configure Let's Encrypt (if domain is public)
if [[ "$DOMAIN" != *.local ]]; then
    echo "Setting up Let's Encrypt for $DOMAIN..."
    sudo certbot certonly --standalone -d "$DOMAIN" --email admin@$DOMAIN --agree-tos --non-interactive || echo "⚠️  Certbot failed - may need public DNS"
else
    echo "⚠️  .local domain - skipping Let's Encrypt (use public domain for SSL)"
fi

echo ""
echo "✅ DNS and SSL configured!"
echo "Access OpenClaw at: http://$DOMAIN:18789"
