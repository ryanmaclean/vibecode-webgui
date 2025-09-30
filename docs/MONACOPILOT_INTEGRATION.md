# Monacopilot Integration Guide

AI-powered code completion for Monaco Editor 0.52 using Monacopilot.

## Overview

Monacopilot adds GitHub Copilot-style AI completions to Monaco Editor with support for multiple AI providers.

**Features:**
- ✅ Compatible with Monaco Editor 0.52.2
- ✅ Multiple AI providers (OpenAI, Gemini, OpenCode via OpenRouter, Claude Code)
- ✅ Real-time code suggestions
- ✅ Context-aware completions
- ✅ Easy integration

## Quick Start

### 1. Environment Variables

Add to your `.env.local`:

```bash
# Choose your AI provider
AI_COMPLETION_PROVIDER=openai   # openai | codex | gemini | opencode | claude
AI_COMPLETION_MODEL=gpt-4o-mini
AI_COMPLETION_MAX_TOKENS=512
AI_COMPLETION_TEMPERATURE=0.2

# OpenAI / Codex (providers: openai, codex)
OPENAI_API_KEY=sk-...
CODEX_API_KEY=sk-...          # optional override for provider=codex
CODEX_MODEL=gpt-4o-mini       # optional override

# Google Gemini (provider: gemini)
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-1.5-pro-latest

# OpenCode via OpenRouter (provider: opencode)
OPENCODE_API_KEY=...
OPENCODE_MODEL=anthropic/claude-3.5-sonnet
OPENROUTER_HTTP_REFERER=https://vibecode.ai
OPENROUTER_APP_TITLE=VibeCode WebGUI

# Claude Code (provider: claude)
CLAUDE_CODE_API_KEY=...
CLAUDE_CODE_MODEL=claude-3.5-sonnet-20240620
```

### 2. Frontend Integration

```typescript
import * as monaco from 'monaco-editor';
import { setupMonacopilot } from '@/lib/monaco/monacopilot-integration';

// Create your Monaco editor
const editor = monaco.editor.create(document.getElementById('editor'), {
  language: 'typescript',
  theme: 'vs-dark',
  automaticLayout: true,
});

// Enable AI completion
setupMonacopilot(monaco, editor, {
  endpoint: '/api/code-completion',
  language: 'typescript',
  debug: process.env.NODE_ENV === 'development',
});
```

### 3. That's it!

Start typing and you'll see AI-powered suggestions appear automatically.

## Supported Languages

Monacopilot works with all Monaco-supported languages:
- TypeScript/JavaScript
- Python
- Java
- C/C++/C#
- Go
- Rust
- PHP
- Ruby
- And many more...

## Supported AI Providers

### OpenAI / Codex
```bash
AI_COMPLETION_PROVIDER=openai   # or codex
OPENAI_API_KEY=sk-...
CODEX_API_KEY=sk-...            # optional override
AI_COMPLETION_MODEL=gpt-4o-mini
```

### Gemini
```bash
AI_COMPLETION_PROVIDER=gemini
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-1.5-pro-latest
```

### OpenCode (OpenRouter)
```bash
AI_COMPLETION_PROVIDER=opencode
OPENCODE_API_KEY=...
OPENCODE_MODEL=anthropic/claude-3.5-sonnet
OPENROUTER_HTTP_REFERER=https://vibecode.ai
OPENROUTER_APP_TITLE=VibeCode WebGUI
```

### Claude Code
```bash
AI_COMPLETION_PROVIDER=claude
CLAUDE_CODE_API_KEY=...
CLAUDE_CODE_MODEL=claude-3.5-sonnet-20240620
```

## Advanced Configuration

### Custom Headers

```typescript
setupMonacopilot(monaco, editor, {
  endpoint: '/api/code-completion',
  language: 'typescript',
  headers: {
    'Authorization': 'Bearer your-token',
    'X-Custom-Header': 'value',
  },
});
```

### Multiple Editors

```typescript
import { setupMonacopilotMulti } from '@/lib/monaco/monacopilot-integration';

const editors = [editor1, editor2, editor3];

setupMonacopilotMulti(monaco, editors, {
  endpoint: '/api/code-completion',
  language: 'typescript',
});
```

### Custom Backend

You can customize the completion logic in `src/app/api/code-completion/route.ts`:

```typescript
const copilot = new CompletionCopilot(apiKey, {
  provider: 'openai',
  model: 'gpt-4-turbo-preview',
  temperature: 0.2,  // Lower = more deterministic
  maxTokens: 1000,   // Max completion length
  topP: 0.95,
  frequencyPenalty: 0.0,
  presencePenalty: 0.0,
});
```

## Troubleshooting

### No completions appearing

1. Check API key is set in `.env.local`
2. Check browser console for errors
3. Verify API endpoint is accessible: `curl http://localhost:3000/api/code-completion`
4. Enable debug mode: `debug: true` in config

### Slow completions

1. Try Groq provider (very fast)
2. Reduce `maxTokens` in backend config
3. Use a faster model (e.g., `gpt-3.5-turbo` instead of `gpt-4`)

### CORS errors

The API route handles CORS automatically. If you're using a custom backend, ensure CORS is configured:

```typescript
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000'
}));
```

## Performance Tips

1. **Use OpenCode (OpenRouter)** - Access high-throughput hosted models
2. **Use Gemini 1.5** - Great for long context + strong code quality
3. **Lower temperature** - Faster and more deterministic (0.1-0.3)
4. **Reduce maxTokens** - Shorter completions = faster response

## Cost Optimization

1. **Gemini** - Generous free tier for experimentation
2. **OpenCode (OpenRouter)** - Mix and match cheaper OSS models
3. **OpenAI** - Use `gpt-4o-mini`/`gpt-3.5` to balance cost and quality
4. **Cache completions** - Add caching layer for repeated patterns

## Resources

- [Monacopilot Documentation](https://monacopilot.dev/)
- [Monaco Editor API](https://microsoft.github.io/monaco-editor/api/index.html)
- [Supported AI Providers](https://monacopilot.dev/configuration/copilot-options.html)

## Examples

See `examples/monaco-with-ai/` for complete working examples.

## License

Monacopilot is MIT licensed.
