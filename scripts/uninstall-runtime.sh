#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

set -euo pipefail

# Apple Container Runtime Uninstallation Script

# Initialize log aggregation
init_log_aggregation


if [[ $EUID -ne 0 ]]; then
   echo "Error: This script must be run as root (use sudo)"
   exit 1
fi

echo "Uninstalling Apple Container Runtime..."

# Unload service
if launchctl list | grep -q "com.vibecode.container-runtime"; then
    echo "Stopping service..."
    launchctl unload /Library/LaunchDaemons/com.vibecode.container-runtime.plist 2>/dev/null || true
fi

# Remove launchd plist
echo "Removing launchd service..."
rm -f /Library/LaunchDaemons/com.vibecode.container-runtime.plist

# Remove executable
echo "Removing executable..."
rm -f /usr/local/bin/apple-container-runtime

# Ask about data removal
read -p "Remove runtime data and containers? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Removing data directories..."
    rm -rf /usr/local/var/vibecode
    rm -rf /usr/local/var/log/vibecode
    rm -rf /usr/local/etc/vibecode

    # Also remove user-specific data
    for user_home in /Users/*; do
        if [[ -d "$user_home/.vibecode/containers" ]]; then
            echo "Removing containers for user: $(basename "$user_home")"
            rm -rf "$user_home/.vibecode/containers"
        fi
    done
else
    echo "Keeping data directories intact"
fi

echo ""
echo "Uninstallation complete!"
