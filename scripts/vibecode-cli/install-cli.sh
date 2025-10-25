#!/usr/bin/env bash

#####################################################################
# VibeCode CLI Installation Script
#####################################################################

set -euo pipefail

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="${HOME}/.local/bin"

echo -e "${BLUE}Installing VibeCode CLI...${NC}\n"

# Create install directory if it doesn't exist
mkdir -p "${INSTALL_DIR}"

# Create symlink
if [[ -L "${INSTALL_DIR}/vibecode-cli" ]]; then
    rm "${INSTALL_DIR}/vibecode-cli"
fi

ln -s "${SCRIPT_DIR}/main.sh" "${INSTALL_DIR}/vibecode-cli"
chmod +x "${SCRIPT_DIR}/main.sh"

echo -e "${GREEN}✓ VibeCode CLI installed successfully!${NC}\n"

# Check if ~/.local/bin is in PATH
if [[ ":$PATH:" != *":${INSTALL_DIR}:"* ]]; then
    echo -e "${YELLOW}Note: ${INSTALL_DIR} is not in your PATH${NC}"
    echo "Add the following to your ~/.bashrc or ~/.zshrc:"
    echo ""
    echo "  export PATH=\"\${HOME}/.local/bin:\${PATH}\""
    echo ""
else
    echo -e "${GREEN}You can now run: vibecode-cli${NC}"
fi

echo -e "\nTo get started:"
echo "  vibecode-cli                    # Run the interactive menu"
echo "  ${SCRIPT_DIR}/main.sh           # Or run directly"
