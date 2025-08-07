#!/bin/sh
# Docker Package.json Cleanup Script
# Removes platform-specific dependencies that cause Docker build issues

set -e

echo "🧹 Cleaning up package.json for Docker build..."

# Create backup of original package.json
cp package.json package.json.bak

# Remove platform-specific SWC dependencies using jq if available, otherwise use sed
if command -v jq >/dev/null 2>&1; then
    echo "Using jq for JSON manipulation..."
    jq 'del(.devDependencies."@next/swc-darwin-arm64")' package.json > package.tmp.json
    mv package.tmp.json package.json
else
    echo "Using sed for JSON manipulation (jq not available)..."
    # Remove the @next/swc-darwin-arm64 line and its comma if it's not the last line
    sed -i.backup '/\"@next\/swc-darwin-arm64\":/d' package.json
    # Clean up any trailing commas that might be left
    sed -i.backup ':a;N;$!ba;s/,\([[:space:]]*\)}/\1}/g' package.json
fi

echo "✅ Package.json cleaned for Docker build"

# Show what was changed
if command -v diff >/dev/null 2>&1; then
    echo "Changes made:"
    diff package.json.bak package.json || true
fi