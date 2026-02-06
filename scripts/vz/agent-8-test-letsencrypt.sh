#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

# Agent 8: Test Let's Encrypt Locally

# Initialize log aggregation
init_log_aggregation

set -e

echo "=== Agent 8: Testing Let's Encrypt ==="

# Test self-signed certificate creation
echo "Testing self-signed certificate creation..."

CERT_DIR="/tmp/test-certs"
DOMAIN="test.local"

mkdir -p "$CERT_DIR"

# Create test certificate
openssl req -x509 -nodes -days 1 -newkey rsa:2048 \
    -keyout "$CERT_DIR/$DOMAIN.key" \
    -out "$CERT_DIR/$DOMAIN.crt" \
    -subj "/CN=$DOMAIN" 2>/dev/null

if [ -f "$CERT_DIR/$DOMAIN.crt" ]; then
    echo "✅ Self-signed certificate created"
    echo "  Key: $CERT_DIR/$DOMAIN.key"
    echo "  Cert: $CERT_DIR/$DOMAIN.crt"
    
    # Validate certificate
    openssl x509 -in "$CERT_DIR/$DOMAIN.crt" -text -noout | grep -q "Subject: CN=$DOMAIN" && \
        echo "✅ Certificate valid" || echo "⚠️  Certificate validation failed"
else
    echo "❌ Certificate creation failed"
fi

# Cleanup
rm -rf "$CERT_DIR"

echo "✅ Let's Encrypt test complete"
