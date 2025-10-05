#!/bin/bash
set -euo pipefail

# Apple Container Runtime Installation Script
#
# Installs the runtime as a system-wide service with launchd

if [[ $EUID -ne 0 ]]; then
   echo "Error: This script must be run as root (use sudo)"
   exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "Installing Apple Container Runtime..."

# Build runtime if not already built
if [[ ! -f "$PROJECT_ROOT/bin/apple-container-runtime" ]]; then
    echo "Building runtime..."
    sudo -u "$SUDO_USER" "$SCRIPT_DIR/build-apple-runtime.sh" release
fi

# Install executable
echo "Installing executable..."
install -m 755 "$PROJECT_ROOT/bin/apple-container-runtime" /usr/local/bin/

# Create directories
echo "Creating directories..."
mkdir -p /usr/local/var/vibecode
mkdir -p /usr/local/var/log/vibecode
mkdir -p /usr/local/etc/vibecode

# Install configuration
echo "Installing configuration..."
install -m 644 "$PROJECT_ROOT/config/container-runtime.json" /usr/local/etc/vibecode/
install -m 644 "$PROJECT_ROOT/config/container-runtime.schema.json" /usr/local/etc/vibecode/

# Install launchd plist
echo "Installing launchd service..."
install -m 644 "$PROJECT_ROOT/launchd/com.vibecode.container-runtime.plist" /Library/LaunchDaemons/

# Load service
echo "Loading launchd service..."
launchctl load /Library/LaunchDaemons/com.vibecode.container-runtime.plist

# Wait for service to start
sleep 2

# Check service status
if launchctl list | grep -q "com.vibecode.container-runtime"; then
    echo ""
    echo "Installation complete!"
    echo ""
    echo "Service status:"
    launchctl list com.vibecode.container-runtime
    echo ""
    echo "To view logs:"
    echo "  tail -f /usr/local/var/log/vibecode/container-runtime.log"
    echo ""
    echo "To manage the service:"
    echo "  sudo launchctl unload /Library/LaunchDaemons/com.vibecode.container-runtime.plist"
    echo "  sudo launchctl load /Library/LaunchDaemons/com.vibecode.container-runtime.plist"
else
    echo ""
    echo "Warning: Service may not have started correctly"
    echo "Check logs at: /usr/local/var/log/vibecode/container-runtime.error.log"
    exit 1
fi
