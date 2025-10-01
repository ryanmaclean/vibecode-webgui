#!/bin/bash
set -e

echo "🧪 Testing Roundtable AI MCP Configuration"
echo "=========================================="
echo ""

# Test 1: Check Python version
echo "1️⃣  Checking Python 3.11 availability..."
if command -v python3.11 &> /dev/null; then
    echo "   ✅ Python 3.11 found: $(python3.11 --version)"
else
    echo "   ❌ Python 3.11 not found"
    exit 1
fi
echo ""

# Test 2: Check uvx
echo "2️⃣  Checking uvx installation..."
if command -v uvx &> /dev/null; then
    echo "   ✅ uvx found: $(uvx --version)"
else
    echo "   ❌ uvx not found"
    exit 1
fi
echo ""

# Test 3: Check CLI tools
echo "3️⃣  Checking AI CLI tools..."
for tool in codex cursor gemini; do
    if command -v $tool &> /dev/null; then
        echo "   ✅ $tool: $(which $tool)"
    else
        echo "   ⚠️  $tool: not found"
    fi
done
echo ""

# Test 4: Run availability check
echo "4️⃣  Running roundtable-ai availability check..."
CLI_MCP_SUBAGENTS="codex,cursor,gemini" uvx --python python3.11 roundtable-ai@latest --check 2>&1 | tail -20
echo ""

# Test 5: Verify config file
echo "5️⃣  Verifying Windsurf MCP config..."
if [ -f ~/.codeium/windsurf/mcp_config.json ]; then
    echo "   ✅ Config file exists"
    echo "   📄 Validating JSON syntax..."
    if jq empty ~/.codeium/windsurf/mcp_config.json 2>/dev/null; then
        echo "   ✅ JSON is valid"
        echo ""
        echo "   📋 Roundtable-ai configuration:"
        jq '.mcpServers."roundtable-ai"' ~/.codeium/windsurf/mcp_config.json
    else
        echo "   ❌ Invalid JSON syntax"
        exit 1
    fi
else
    echo "   ❌ Config file not found"
    exit 1
fi
echo ""

echo "=========================================="
echo "✅ All tests passed!"
echo ""
echo "🎯 Next steps:"
echo "   1. Quit Windsurf completely (Cmd+Q)"
echo "   2. Restart Windsurf"
echo "   3. Roundtable-ai MCP server will be available"
echo ""
echo "🤖 Available agents: codex, cursor, gemini"
echo "=========================================="
