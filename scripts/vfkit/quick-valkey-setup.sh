#!/usr/bin/env bash
# Quick deployment script for Valkey on Alpine ARM64 VM
# This script can be called from VM setup or run standalone

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VALKEY_VERSION="${VALKEY_VERSION:-7.2.5}"

echo "=== Quick Valkey Setup for Alpine VM ==="
echo ""

# Function to check if Valkey is already installed
check_valkey_installed() {
    if command -v valkey-server &> /dev/null; then
        INSTALLED_VERSION=$(valkey-server --version | grep -oP 'v=\K[0-9.]+' || echo "unknown")
        echo "Valkey ${INSTALLED_VERSION} is already installed"
        read -p "Reinstall? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Skipping Valkey installation"
            return 1
        fi
    fi
    return 0
}

# Main installation
main() {
    # Check if already installed
    if ! check_valkey_installed; then
        echo "✅ Valkey setup complete (already installed)"
        exit 0
    fi
    
    # Run full deployment
    echo "Starting Valkey deployment..."
    echo ""
    
    if [ -f "${SCRIPT_DIR}/deploy-valkey-alpine-arm64.sh" ]; then
        bash "${SCRIPT_DIR}/deploy-valkey-alpine-arm64.sh" "${VALKEY_VERSION}"
    else
        echo "⚠️  deploy-valkey-alpine-arm64.sh not found, running compile script directly"
        if [ -f "${SCRIPT_DIR}/compile-valkey-musl.sh" ]; then
            bash "${SCRIPT_DIR}/compile-valkey-musl.sh" "${VALKEY_VERSION}"
            
            # Start service
            if command -v rc-service &> /dev/null; then
                echo "Enabling and starting service..."
                rc-update add valkey default 2>/dev/null || true
                rc-service valkey start || true
            fi
        else
            echo "❌ Error: compile-valkey-musl.sh not found"
            exit 1
        fi
    fi
    
    echo ""
    echo "=== Quick Test ==="
    
    # Wait for service to start
    sleep 2
    
    # Test connection
    if command -v valkey-cli &> /dev/null; then
        if valkey-cli ping &> /dev/null; then
            echo "✅ Valkey is responding"
            
            # Quick performance check
            echo ""
            echo "Quick performance check:"
            valkey-benchmark -t get,set -n 10000 -q 2>/dev/null || echo "Benchmark tool not available"
        else
            echo "⚠️  Valkey installed but not responding"
            echo "Try starting it with: rc-service valkey start"
        fi
    fi
    
    echo ""
    echo "✅ Setup complete!"
    echo ""
    echo "Next steps:"
    echo "  1. Verify performance: ${SCRIPT_DIR}/verify-valkey-performance.sh"
    echo "  2. Check logs: tail -f /var/log/valkey/valkey.log"
    echo "  3. Test CLI: valkey-cli ping"
}

main "$@"
