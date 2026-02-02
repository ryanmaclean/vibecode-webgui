#!/usr/bin/env bash

# Extension Auto-Installer for OpenVSCode Server
# This script runs on first boot to install bundled extensions

set -euo pipefail

EXTENSION_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OPENVSCODE_CLI="/usr/local/bin/openvscode-server"

# Wait for OpenVSCode Server to be available
MAX_WAIT=30
WAIT_COUNT=0
while [ ! -f "$OPENVSCODE_CLI" ] && [ $WAIT_COUNT -lt $MAX_WAIT ]; do
    echo "Waiting for OpenVSCode Server... ($WAIT_COUNT/$MAX_WAIT)"
    sleep 1
    ((WAIT_COUNT++))
done

if [ ! -f "$OPENVSCODE_CLI" ]; then
    echo "WARNING: OpenVSCode Server CLI not found at $OPENVSCODE_CLI"
    exit 0
fi

echo "Installing bundled extensions..."

# Install each .vsix file
for vsix_file in "$EXTENSION_DIR"/*.vsix; do
    if [ -f "$vsix_file" ]; then
        echo "Installing $(basename "$vsix_file")..."
        "$OPENVSCODE_CLI" --install-extension "$vsix_file" --force || {
            echo "WARNING: Failed to install $(basename "$vsix_file")"
        }
    fi
done

echo "Extension installation complete"
