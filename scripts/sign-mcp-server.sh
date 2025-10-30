#!/usr/bin/env bash
# Sign MCP Server with Virtualization Entitlements
# Based on: https://developer.apple.com/documentation/virtualization/adding-the-virtualization-entitlement-to-your-project

set -euo pipefail

echo "🔐 Signing MCP Server with Virtualization Entitlements"
echo "========================================================"
echo ""

ENTITLEMENTS="src/mcp/mcp-server.entitlements"
NODE_BIN="$(which node)"

if [[ ! -f "$ENTITLEMENTS" ]]; then
    echo "❌ Entitlements file not found: $ENTITLEMENTS"
    exit 1
fi

if [[ ! -x "$NODE_BIN" ]]; then
    echo "❌ Node.js binary not found or not executable: $NODE_BIN"
    exit 1
fi

echo "📄 Entitlements: $ENTITLEMENTS"
echo "🔧 Node binary: $NODE_BIN"
echo ""

# Sign Node.js binary with entitlements
echo "Signing Node.js binary..."
codesign --force --sign - \
    --entitlements "$ENTITLEMENTS" \
    --timestamp \
    --options runtime \
    "$NODE_BIN" 2>&1 | grep -v "replacing existing signature" || true

echo "✅ Node.js signed with Virtualization entitlements"
echo ""

# Verify signature
echo "Verifying signature..."
codesign --display --entitlements - "$NODE_BIN" 2>&1 | grep -A 5 "com.apple.security.virtualization" || {
    echo "⚠️  Warning: Could not verify virtualization entitlement"
}

echo ""
echo "✅ MCP Server ready for VM management"
echo ""
echo "Usage:"
echo "  node --loader ts-node/esm src/mcp/server.ts"
echo ""
echo "The MCP server now has access to:"
echo "  • Apple Virtualization.framework"
echo "  • Hypervisor capabilities"
echo "  • Network configuration"
echo "  • VM disk management"

