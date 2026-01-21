#!/bin/bash
# AI Tools Verification Script
# Verifies that all AI coding tools are installed and accessible

echo "🤖 AI Coding Tools Verification"
echo "================================"

# Check Node.js tools
echo "📦 Checking Node.js AI Tools..."
if command -v claude &> /dev/null; then
    echo "✅ Claude Code CLI: $(claude --version 2>/dev/null || echo 'installed')"
else
    echo "❌ Claude Code CLI: not found"
fi

if command -v codex &> /dev/null; then
    echo "✅ OpenAI Codex CLI: $(codex --version 2>/dev/null || echo 'installed')"
else
    echo "❌ OpenAI Codex CLI: not found"
fi

if command -v coder &> /dev/null; then
    echo "✅ just-every/code Fork: $(coder --version 2>/dev/null || echo 'installed')"
else
    echo "❌ just-every/code Fork: not found"
fi

if command -v gemini &> /dev/null; then
    echo "✅ Google Gemini CLI: $(gemini --version 2>/dev/null || echo 'installed')"
else
    echo "❌ Google Gemini CLI: not found"
fi

# Check if packages are available
echo ""
echo "📋 Checking npm packages..."
if npm list -g @anthropic-ai/claude-code &> /dev/null; then
    echo "✅ @anthropic-ai/claude-code: installed"
else
    echo "❌ @anthropic-ai/claude-code: not found"
fi

if npm list -g @openai/codex &> /dev/null; then
    echo "✅ @openai/codex: installed"
else
    echo "❌ @openai/codex: not found"
fi

if npm list -g @just-every/code &> /dev/null; then
    echo "✅ @just-every/code: installed"
else
    echo "❌ @just-every/code: not found"
fi

if npm list -g @google/gemini-cli &> /dev/null; then
    echo "✅ @google/gemini-cli: installed"
else
    echo "❌ @google/gemini-cli: not found"
fi

# Check Python tools
echo ""
echo "🐍 Checking Python AI Tools..."
if command -v aider &> /dev/null; then
    echo "✅ Aider: $(aider --version 2>/dev/null || echo 'installed')"
else
    echo "❌ Aider: not found"
fi

# Check environment variables
echo ""
echo "🔑 Checking API Key Environment Variables..."
if [ -n "$ANTHROPIC_API_KEY" ]; then
    echo "✅ ANTHROPIC_API_KEY: set"
else
    echo "⚠️  ANTHROPIC_API_KEY: not set"
fi

if [ -n "$OPENAI_API_KEY" ]; then
    echo "✅ OPENAI_API_KEY: set"
else
    echo "⚠️  OPENAI_API_KEY: not set"
fi

if [ -n "$GOOGLE_API_KEY" ]; then
    echo "✅ GOOGLE_API_KEY: set"
else
    echo "⚠️  GOOGLE_API_KEY: not set"
fi

if [ -n "$OPENCODE_API_KEY" ]; then
    echo "✅ OPENCODE_API_KEY: set"
else
    echo "⚠️  OPENCODE_API_KEY: not set"
fi

echo ""
echo "🎯 Usage Examples:"
echo "  claude --help                    # Claude Code CLI"
echo "  codex --help                    # OpenAI Codex CLI"
echo "  coder --help                    # just-every/code Fork"
echo "  gemini --help                   # Google Gemini CLI"
echo "  aider --help                    # Aider AI assistant"
echo ""
echo "💡 To set API keys:"
echo "  export ANTHROPIC_API_KEY='your-key-here'"
echo "  export OPENAI_API_KEY='your-key-here'"
echo "  export GOOGLE_API_KEY='your-key-here'"
echo "  export OPENCODE_API_KEY='your-key-here'"
