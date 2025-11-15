#!/usr/bin/env bash

# Install Extensions to OpenVSCode Server VM
# Configures extensions to be pre-installed in VM images

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
EXTENSIONS_SOURCE_DIR="$PROJECT_ROOT/dist/extensions"
VM_EXTENSIONS_DIR="$PROJECT_ROOT/src-tauri/resources/extensions"

echo -e "${GREEN}Installing Extensions to VM Resources${NC}"
echo "========================================="
echo "Source: $EXTENSIONS_SOURCE_DIR"
echo "Destination: $VM_EXTENSIONS_DIR"
echo ""

# Create VM extensions directory
mkdir -p "$VM_EXTENSIONS_DIR"

# Copy all .vsix files
echo -e "${YELLOW}Copying extension packages...${NC}"

if [ ! -d "$EXTENSIONS_SOURCE_DIR" ]; then
    echo -e "${RED}Error: Extensions source directory not found${NC}"
    echo "Run scripts/extensions/package-workspace-rag.sh first"
    exit 1
fi

VSIX_COUNT=0
for vsix_file in "$EXTENSIONS_SOURCE_DIR"/*.vsix; do
    if [ -f "$vsix_file" ]; then
        cp "$vsix_file" "$VM_EXTENSIONS_DIR/"
        echo "OK - Copied $(basename "$vsix_file")"
        ((VSIX_COUNT++))
    fi
done

if [ $VSIX_COUNT -eq 0 ]; then
    echo -e "${RED}Error: No .vsix files found in $EXTENSIONS_SOURCE_DIR${NC}"
    exit 1
fi

# Create extension installation script for VM
echo -e "${YELLOW}Creating VM extension installer script...${NC}"

cat > "$VM_EXTENSIONS_DIR/install-extensions.sh" << 'EOF'
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
EOF

chmod +x "$VM_EXTENSIONS_DIR/install-extensions.sh"

echo -e "${GREEN}OK - Extension installer script created${NC}"

# Create systemd service for extension installation (runs on first boot)
echo -e "${YELLOW}Creating systemd service for auto-installation...${NC}"

cat > "$VM_EXTENSIONS_DIR/vscode-extensions-installer.service" << 'EOF'
[Unit]
Description=Install VS Code Extensions on First Boot
After=network-online.target
Wants=network-online.target
ConditionPathExists=!/var/lib/vscode-extensions-installed

[Service]
Type=oneshot
ExecStart=/usr/local/share/extensions/install-extensions.sh
ExecStartPost=/usr/bin/touch /var/lib/vscode-extensions-installed
StandardOutput=journal
StandardError=journal
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
EOF

echo -e "${GREEN}OK - Systemd service created${NC}"

# Create manifest file
echo -e "${YELLOW}Creating extensions manifest...${NC}"

cat > "$VM_EXTENSIONS_DIR/manifest.json" << EOF
{
  "version": "1.0.0",
  "installed_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "extensions": [
EOF

FIRST=true
for vsix_file in "$VM_EXTENSIONS_DIR"/*.vsix; do
    if [ -f "$vsix_file" ]; then
        if [ "$FIRST" = false ]; then
            echo "," >> "$VM_EXTENSIONS_DIR/manifest.json"
        fi
        FIRST=false
        FILENAME=$(basename "$vsix_file")
        FILESIZE=$(stat -f%z "$vsix_file" 2>/dev/null || stat -c%s "$vsix_file")
        cat >> "$VM_EXTENSIONS_DIR/manifest.json" << EOF
    {
      "filename": "$FILENAME",
      "size": $FILESIZE,
      "sha256": "$(shasum -a 256 "$vsix_file" | awk '{print $1}')"
    }
EOF
    fi
done

cat >> "$VM_EXTENSIONS_DIR/manifest.json" << EOF

  ]
}
EOF

echo -e "${GREEN}OK - Manifest created${NC}"

# Summary
echo ""
echo -e "${GREEN}========================================="
echo "Installation Complete"
echo "=========================================${NC}"
echo ""
echo "Installed Extensions: $VSIX_COUNT"
echo "Destination: $VM_EXTENSIONS_DIR"
echo ""
echo "Files created:"
echo "  - Extensions: $VM_EXTENSIONS_DIR/*.vsix"
echo "  - Installer: $VM_EXTENSIONS_DIR/install-extensions.sh"
echo "  - Service: $VM_EXTENSIONS_DIR/vscode-extensions-installer.service"
echo "  - Manifest: $VM_EXTENSIONS_DIR/manifest.json"
echo ""
echo -e "${GREEN}Done${NC}"

