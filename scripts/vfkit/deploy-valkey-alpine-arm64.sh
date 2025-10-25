#!/usr/bin/env bash
# Deploy Valkey on Alpine ARM64 VM
# This script orchestrates the compilation, installation, and configuration of Valkey
# optimized for Alpine Linux ARM64 with musl libc

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VALKEY_VERSION="${1:-7.2.5}"

echo "=== Valkey Alpine ARM64 Deployment ==="
echo "Version: ${VALKEY_VERSION}"
echo "Architecture: ARM64 (aarch64)"
echo "Libc: musl"
echo ""

# Check if running on Alpine Linux
check_alpine() {
    if [ -f /etc/alpine-release ]; then
        ALPINE_VERSION=$(cat /etc/alpine-release)
        echo "✅ Running on Alpine Linux ${ALPINE_VERSION}"
        return 0
    else
        echo "⚠️  Warning: Not running on Alpine Linux"
        echo "This script is optimized for Alpine Linux ARM64"
        read -p "Continue anyway? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

# Check architecture
check_architecture() {
    ARCH=$(uname -m)
    echo "Current architecture: ${ARCH}"
    
    if [ "$ARCH" != "aarch64" ] && [ "$ARCH" != "arm64" ]; then
        echo "⚠️  Warning: Not running on ARM64 architecture"
        echo "ARM64 optimizations in compile-valkey-musl.sh will not apply"
        read -p "Continue anyway? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    else
        echo "✅ ARM64 architecture detected"
    fi
}

# Run pre-deployment checks
echo "=== Pre-deployment Checks ==="
check_alpine
check_architecture
echo ""

# Run the compilation script
echo "=== Compiling Valkey ${VALKEY_VERSION} ==="
echo "Running: ${SCRIPT_DIR}/compile-valkey-musl.sh ${VALKEY_VERSION}"
echo ""

if [ -f "${SCRIPT_DIR}/compile-valkey-musl.sh" ]; then
    bash "${SCRIPT_DIR}/compile-valkey-musl.sh" "${VALKEY_VERSION}"
else
    echo "❌ Error: compile-valkey-musl.sh not found"
    exit 1
fi

# Enable and start the service
echo ""
echo "=== Configuring Service ==="

# Add to default runlevel
if command -v rc-update &> /dev/null; then
    echo "Adding valkey to default runlevel..."
    rc-update add valkey default || echo "⚠️  Service already added to runlevel"
    
    echo "Starting valkey service..."
    rc-service valkey start || echo "⚠️  Service may already be running"
    
    sleep 2
    
    echo "Checking service status..."
    rc-service valkey status
else
    echo "⚠️  OpenRC not found - skipping service registration"
    echo "You can start Valkey manually with: valkey-server /etc/valkey/valkey.conf"
fi

echo ""
echo "=== Deployment Summary ==="
echo "✅ Valkey ${VALKEY_VERSION} compiled with ARM64 optimizations"
echo "✅ Service configured and started"
echo ""
echo "Configuration:"
echo "  Config: /etc/valkey/valkey.conf"
echo "  Data: /var/lib/valkey"
echo "  Logs: /var/log/valkey/valkey.log"
echo "  Port: 6379"
echo ""
echo "Service management:"
echo "  Status: rc-service valkey status"
echo "  Start:  rc-service valkey start"
echo "  Stop:   rc-service valkey stop"
echo "  Logs:   tail -f /var/log/valkey/valkey.log"
echo ""
echo "Next steps:"
echo "  1. Run performance verification: ${SCRIPT_DIR}/verify-valkey-performance.sh"
echo "  2. Test with valkey-cli: valkey-cli ping"
echo "  3. Monitor: tail -f /var/log/valkey/valkey.log"
echo ""
