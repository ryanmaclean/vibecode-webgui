#!/bin/bash
# Setup script for MCP server Datadog tracing

set -e

echo "Setting up MCP server Datadog tracing..."

# Check if Python ddtrace is installed
if ! python3.13 -c "import ddtrace" 2>/dev/null; then
  echo "Installing Python ddtrace..."
  pip3 install --user ddtrace
else
  echo "✓ Python ddtrace already installed"
fi

# Check if Node.js dd-trace is installed
if ! node -e "require('dd-trace')" 2>/dev/null; then
  echo "Installing Node.js dd-trace..."
  npm install -g dd-trace
else
  echo "✓ Node.js dd-trace already installed"
fi

# Make wrapper scripts executable
chmod +x scripts/roundtable-mcp-wrapper.py
chmod +x scripts/mcp-wrapper.js

echo ""
echo "✓ MCP tracing setup complete!"
echo ""
echo "Next steps:"
echo "1. Copy config/mcp_config.json to ~/.codeium/windsurf/mcp_config.json"
echo "2. Update paths in the config if needed"
echo "3. Restart Windsurf/Cascade"
echo "4. Check for 'Datadog tracing enabled' messages in stderr"
echo ""
echo "Documentation: docs/MCP_DATADOG_INTEGRATION.md"
