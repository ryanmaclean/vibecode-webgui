#!/bin/bash
# Rebuild bundle with SSH-enabled initramfs

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
AZURE_DIR="$(dirname "$APP_DIR")"
BUNDLE_PATH="$APP_DIR/DatadogDevMenu.app"

echo "=== Preparing SSH-enabled VM Files ==="
echo "Azure dir: $AZURE_DIR"
echo "Bundle: $BUNDLE_PATH"
echo ""

# Check if SSH initramfs exists
if [ ! -f "$AZURE_DIR/bun-openvscode-with-ssh.cpio.gz" ]; then
    echo "ERROR: SSH-enabled initramfs not found at $AZURE_DIR/bun-openvscode-with-ssh.cpio.gz"
    exit 1
fi

echo "SSH-enabled initramfs ready at:"
echo "  $AZURE_DIR/bun-openvscode-with-ssh.cpio.gz"
echo ""

# Check if bundle exists
if [ -d "$BUNDLE_PATH" ]; then
    RESOURCES_DIR="$BUNDLE_PATH/Contents/Resources"

    # Find kernel in bundle
    if [ -f "$RESOURCES_DIR/vmlinuz" ]; then
        echo "Updating existing bundle..."
        echo "Copying SSH-enabled initramfs to bundle..."
        cp "$AZURE_DIR/bun-openvscode-with-ssh.cpio.gz" "$RESOURCES_DIR/initrd"
        echo "Bundle updated successfully!"
    else
        echo "WARNING: Bundle exists but kernel not found at $RESOURCES_DIR/vmlinuz"
        echo "Please rebuild the app using build-apps.sh first"
    fi
else
    echo "Bundle not found. You'll need to:"
    echo "1. Build the app first using build-apps.sh"
    echo "2. Manually copy the SSH initramfs to the bundle"
    echo ""
    echo "Or edit the build script to use bun-openvscode-with-ssh.cpio.gz instead of bun-openvscode-with-modules.cpio.gz"
fi

echo ""
echo "Bundle updated successfully!"
echo "Bundle location: $BUNDLE_PATH"
echo ""
echo "Next steps:"
echo "1. Run the app: open $BUNDLE_PATH"
echo "2. Wait for VM to boot (check logs with: $APP_DIR/scripts/view-vm-logs.sh)"
echo "3. Find VM IP: Check logs for 'DHCP successful' message"
echo "4. Test SSH: ssh root@<VM_IP> (password: password)"
echo "5. Create tunnel: ssh -L 3000:127.0.0.1:3000 root@<VM_IP>"
echo "6. Access OpenVSCode: http://localhost:3000"
