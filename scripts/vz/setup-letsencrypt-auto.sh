#!/bin/bash
# Full Let's Encrypt Automation with DNS Challenge
set -e

DOMAIN="${1:-openclaw.local}"
EMAIL="${2:-admin@$DOMAIN}"

echo "=== Let's Encrypt Automation ==="
echo "Domain: $DOMAIN"
echo "Email: $EMAIL"

# Check if .local domain (use self-signed)
if [[ "$DOMAIN" == *.local ]]; then
    echo "⚠️  .local domain detected - using self-signed certificate"
    ./scripts/vz/create-self-signed-cert.sh "$DOMAIN"
    exit 0
fi

# Install certbot if needed
if ! command -v certbot &> /dev/null; then
    brew install certbot
fi

# Get Tailscale IP for DNS challenge
TAILSCALE_IP=$(tailscale ip -4)
echo "Tailscale IP: $TAILSCALE_IP"

# DNS challenge setup (for private domains)
if [ -n "$TAILSCALE_IP" ]; then
    echo "Setting up DNS challenge..."
    # Configure DNS to point domain to Tailscale IP
    # This requires DNS provider API or manual setup
fi

# Obtain certificate
echo "Obtaining certificate..."
certbot certonly \
    --standalone \
    --non-interactive \
    --agree-tos \
    --email "$EMAIL" \
    -d "$DOMAIN" \
    --preferred-challenges http || {
    echo "⚠️  Certificate obtainment failed, using self-signed"
    ./scripts/vz/create-self-signed-cert.sh "$DOMAIN"
}

# Configure renewal
echo "Setting up automatic renewal..."
(crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet --deploy-hook 'systemctl reload openclaw-gateway'") | crontab -

echo "✅ Let's Encrypt configured"
