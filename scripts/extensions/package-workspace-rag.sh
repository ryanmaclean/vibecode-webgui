#!/usr/bin/env bash

# Package Workspace RAG Extension
# Creates a .vsix file for distribution

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
EXTENSION_DIR="$PROJECT_ROOT/extensions/workspace-rag"
OUTPUT_DIR="$PROJECT_ROOT/dist/extensions"

echo -e "${GREEN}Packaging Workspace RAG Extension${NC}"
echo "========================================="
echo "Extension Dir: $EXTENSION_DIR"
echo "Output Dir: $OUTPUT_DIR"
echo ""

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

if ! command -v node >/dev/null 2>&1; then
    echo -e "${RED}Error: Node.js not found${NC}"
    exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
    echo -e "${RED}Error: npm not found${NC}"
    exit 1
fi

echo "OK - Node.js $(node --version)"
echo "OK - npm v$(npm --version)"

# Install vsce if not available
if ! command -v vsce >/dev/null 2>&1; then
    echo -e "${YELLOW}Installing @vscode/vsce...${NC}"
    npm install -g @vscode/vsce
fi

echo "OK - vsce installed"

# Navigate to extension directory
cd "$EXTENSION_DIR"

# Install dependencies
echo -e "${YELLOW}Installing extension dependencies...${NC}"
npm install

# Compile extension
echo -e "${YELLOW}Compiling extension...${NC}"
npm run compile

# Run tests
echo -e "${YELLOW}Running tests...${NC}"
npm run compile-tests || echo "FAIL - Test compilation failed (continuing anyway)"
npm run test:unit || echo "FAIL - Unit tests failed (continuing anyway)"

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Package extension
echo -e "${YELLOW}Packaging extension as .vsix...${NC}"
vsce package --out "$OUTPUT_DIR"

# Find the generated .vsix file
VSIX_FILE=$(find "$OUTPUT_DIR" -name "workspace-rag-*.vsix" -type f | head -n 1)

if [ -z "$VSIX_FILE" ]; then
    echo -e "${RED}Error: Failed to create .vsix package${NC}"
    exit 1
fi

echo -e "${GREEN}OK - Extension packaged successfully${NC}"
echo "Package: $VSIX_FILE"

# Generate checksums
echo -e "${YELLOW}Generating checksums...${NC}"
cd "$OUTPUT_DIR"
VSIX_FILENAME=$(basename "$VSIX_FILE")
shasum -a 256 "$VSIX_FILENAME" > "$VSIX_FILENAME.sha256"
shasum -a 512 "$VSIX_FILENAME" > "$VSIX_FILENAME.sha512"

echo "SHA256:"
cat "$VSIX_FILENAME.sha256"

# Package size
VSIX_SIZE=$(ls -lh "$VSIX_FILE" | awk '{print $5}')
echo ""
echo -e "${GREEN}========================================="
echo "Packaging Complete"
echo "=========================================${NC}"
echo ""
echo "Package: $VSIX_FILE"
echo "Size: $VSIX_SIZE"
echo "SHA256: $OUTPUT_DIR/$VSIX_FILENAME.sha256"
echo "SHA512: $OUTPUT_DIR/$VSIX_FILENAME.sha512"
echo ""
echo -e "${GREEN}Done${NC}"

