#!/bin/bash

# License compatibility check for package.json
# Ensures all dependencies use MIT, BSD, or Apache licenses

set -e

echo "🔍 Checking license compatibility..."

# Install license-checker if not available
if ! command -v license-checker &> /dev/null; then
    echo "Installing license-checker..."
    npm install -g license-checker
fi

# Allowed licenses (MIT, BSD variants, Apache) - NO GPL/LGPL/AGPL EVER!
ALLOWED_LICENSES=(
    "MIT"
    "BSD"
    "BSD-2-Clause"
    "BSD-3-Clause"
    "Apache-2.0"
    "ISC"
    "Unlicense"
    "CC0-1.0"
    "0BSD"
    "CC-BY-4.0"
)

# Convert array to semicolon-separated string (license-checker v17+ format)
IFS=';'
ALLOWED_LIST="${ALLOWED_LICENSES[*]}"
IFS=$'\n\t'

echo "✅ Allowed licenses: $ALLOWED_LIST"

# Check licenses (exclude current directory)
if [ -d "node_modules" ]; then
    cd node_modules
    if license-checker --onlyAllow "$ALLOWED_LIST" --production . 2>/dev/null; then
        echo "✅ All licenses are compatible"
        cd ..
        exit 0
    else
        echo "❌ Found incompatible licenses"
        echo "📋 Detailed license report:"
        license-checker --production . 2>/dev/null || echo "Unable to generate detailed report"
        cd ..
        exit 1
    fi
else
    echo "⚠️  No node_modules directory found, skipping license check"
    exit 0
fi