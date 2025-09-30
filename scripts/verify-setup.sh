#!/bin/bash
# Quick verification script for VibeCode setup
# Checks that all major components are properly configured

set -e

echo "🔍 VibeCode Setup Verification"
echo "=============================="
echo ""

PASS=0
FAIL=0

# Check Node.js
echo -n "✓ Node.js version: "
node --version && ((PASS++)) || ((FAIL++))

# Check npm
echo -n "✓ npm version: "
npm --version && ((PASS++)) || ((FAIL++))

# Check dependencies installed
echo -n "✓ node_modules exists: "
[ -d "node_modules" ] && echo "yes" && ((PASS++)) || (echo "no" && ((FAIL++)))

# Check Monaco Editor
echo -n "✓ Monaco Editor 0.53.0: "
if grep -q '"monaco-editor": "0.53.0"' package.json; then
  echo "yes"
  ((PASS++))
else
  echo "no"
  ((FAIL++))
fi

# Check Monacopilot
echo -n "✓ Monacopilot installed: "
if grep -q '"monacopilot"' package.json; then
  echo "yes"
  ((PASS++))
else
  echo "no"
  ((FAIL++))
fi

# Check MCP SDK
echo -n "✓ MCP SDK installed: "
if grep -q '@modelcontextprotocol/sdk' package.json; then
  echo "yes"
  ((PASS++))
else
  echo "no"
  ((FAIL++))
fi

# Check MCP server exists
echo -n "✓ MCP server exists: "
[ -f "src/mcp/server.ts" ] && echo "yes" && ((PASS++)) || (echo "no" && ((FAIL++)))

# Check MCP server executable
echo -n "✓ MCP server executable: "
[ -x "src/mcp/server.ts" ] && echo "yes" && ((PASS++)) || (echo "no" && ((FAIL++)))

# Check Pydantic AI example
echo -n "✓ Pydantic AI example exists: "
[ -f "examples/pydantic-ai-cli-agent/agent.py" ] && echo "yes" && ((PASS++)) || (echo "no" && ((FAIL++)))

# Check documentation
echo -n "✓ MCP documentation exists: "
[ -f "docs/MCP_INTEGRATION.md" ] && echo "yes" && ((PASS++)) || (echo "no" && ((FAIL++)))

# Check Monacopilot docs
echo -n "✓ Monacopilot docs exist: "
[ -f "docs/MONACOPILOT_INTEGRATION.md" ] && echo "yes" && ((PASS++)) || (echo "no" && ((FAIL++)))

# Check verification scripts
echo -n "✓ Monaco verification script: "
[ -f "scripts/verify-monacopilot.js" ] && echo "yes" && ((PASS++)) || (echo "no" && ((FAIL++)))

# Check version lock
echo -n "✓ Monaco version lock exists: "
[ -f ".monaco-version-lock" ] && echo "yes" && ((PASS++)) || (echo "no" && ((FAIL++)))

echo ""
echo "=============================="
echo "Results: $PASS passed, $FAIL failed"
echo ""

if [ $FAIL -eq 0 ]; then
  echo "✅ All checks passed! Setup is complete."
  exit 0
else
  echo "⚠️  Some checks failed. Review the output above."
  exit 1
fi
