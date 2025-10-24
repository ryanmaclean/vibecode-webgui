#!/bin/sh
# Install AI tools in vfkit Alpine VM

echo "🤖 Installing AI Coding Tools in vfkit VM"
echo "========================================"

# Update package list
echo "📦 Updating package list..."
apk update

# Install required packages
echo "📦 Installing required packages..."
apk add --no-cache curl wget git python3 py3-pip nodejs npm

# Install Node.js AI tools globally
echo "📦 Installing Node.js AI tools..."
npm install -g @anthropic-ai/claude-code
npm install -g @openai/codex
npm install -g @just-every/code
npm install -g @google/gemini-cli

# Install Python AI tools
echo "📦 Installing Python AI tools..."
pip3 install aider

# Install OpenCode
echo "📦 Installing OpenCode..."
curl -fsSL https://opencode.ai/install | sh

# Create verification script
echo "📦 Creating verification script..."
cat > /usr/local/bin/verify-ai-tools << 'SCRIPT_EOF'
#!/bin/sh
echo "🤖 AI Coding Tools Verification"
echo "================================"
echo "📦 Checking Node.js AI Tools..."
if command -v claude >/dev/null 2>&1; then
    echo "✅ Claude Code CLI: $(claude --version 2>/dev/null || echo 'installed')"
else
    echo "❌ Claude Code CLI: not found"
fi

if command -v codex >/dev/null 2>&1; then
    echo "✅ OpenAI Codex CLI: $(codex --version 2>/dev/null || echo 'installed')"
else
    echo "❌ OpenAI Codex CLI: not found"
fi

if command -v coder >/dev/null 2>&1; then
    echo "✅ just-every/code (Coder) CLI: $(coder --version 2>/dev/null || echo 'installed')"
else
    echo "❌ just-every/code (Coder) CLI: not found"
fi

if command -v gemini >/dev/null 2>&1; then
    echo "✅ Google Gemini CLI: $(gemini --version 2>/dev/null || echo 'installed')"
else
    echo "❌ Google Gemini CLI: not found"
fi

echo ""
echo "🐍 Checking Python AI Tools..."
if command -v aider >/dev/null 2>&1; then
    echo "✅ Aider: $(aider --version 2>/dev/null || echo 'installed')"
else
    echo "❌ Aider: not found"
fi

echo ""
echo "🔧 Checking OpenCode..."
if command -v opencode >/dev/null 2>&1; then
    echo "✅ OpenCode: $(opencode --version 2>/dev/null || echo 'installed')"
else
    echo "❌ OpenCode: not found"
fi
SCRIPT_EOF

chmod +x /usr/local/bin/verify-ai-tools

echo ""
echo "✅ AI tools installation complete!"
echo "Run 'verify-ai-tools' to check installation"
