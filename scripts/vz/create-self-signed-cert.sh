#!/bin/bash
# Create self-signed certificate for .local domains
set -e

DOMAIN="${1:-openclaw.local}"
CERT_DIR="/etc/ssl/openclaw"
sudo mkdir -p "$CERT_DIR"

sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout "$CERT_DIR/$DOMAIN.key" \
    -out "$CERT_DIR/$DOMAIN.crt" \
    -subj "/CN=$DOMAIN"

echo "✅ Self-signed certificate created"
echo "Key: $CERT_DIR/$DOMAIN.key"
echo "Cert: $CERT_DIR/$DOMAIN.crt"
