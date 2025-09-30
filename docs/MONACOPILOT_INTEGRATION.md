# Monacopilot Integration Guide

AI-powered code completion for Monaco Editor 0.52 using Monacopilot.

## Overview

Monacopilot adds GitHub Copilot-style AI completions to Monaco Editor with support for multiple AI providers.

**Features:**
- ✅ Compatible with Monaco Editor 0.52.2
- ✅ Multiple AI providers (OpenAI, Mistral, Anthropic, Groq, etc.)
- ✅ Real-time code suggestions
- ✅ Context-aware completions
- ✅ Easy integration

## Quick Start

### 1. Environment Variables

Add to your `.env.local`:

```bash
# Choose your AI provider
AI_COMPLETION_PROVIDER=openai  # or: mistral, anthropic, groq, cohere, fireworks-ai

# OpenAI (recommended)
OPENAI_API_KEY=sk-...
AI_COMPLETION_MODEL=gpt-4-turbo-preview

# Or Mistral (fast and free tier available)
MISTRAL_API_KEY=...
AI_COMPLETION_MODEL=codestral-latest

# Or Anthropic
ANTHROPIC_API_KEY=...
AI_COMPLETION_MODEL=claude-3-sonnet-20240229
```

### 2. Frontend Integration

```typescript
import * as monaco from 'monaco-editor';
import { setupMonacopilot } from '@/lib/monaco/monacopilot-integration';
import type { EnhancedMonacopilotConfig } from '@/types/monacopilot';

// Create your Monaco editor
const editor = monaco.editor.create(document.getElementById('editor'), {
  language: 'typescript',
  theme: 'vs-dark',
  automaticLayout: true,
});

// Enable AI completion with enhanced configuration
const config: EnhancedMonacopilotConfig = {
  endpoint: '/api/code-completion',
  language: 'typescript',
  provider: 'mistral',
  model: 'codestral',
  debug: process.env.NODE_ENV === 'development',
  trigger: 'onIdle',
  maxContextLines: 100,
  enableCaching: true,
  technologies: ['react', 'nextjs', 'typescript'],
  modelParameters: {
    temperature: 0.2,
    maxTokens: 1000
  },
  onCompletionAccepted: () => console.log('Completion accepted!'),
  onError: (error) => console.error('Completion error:', error)
};

const registration = setupMonacopilot(monaco, editor, config);

// Later, cleanup when component unmounts
registration.deregister();
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

### OpenAI (Recommended)
```bash
AI_COMPLETION_PROVIDER=openai
OPENAI_API_KEY=sk-...
AI_COMPLETION_MODEL=gpt-4-turbo-preview  # or gpt-3.5-turbo
```

### Mistral (Fast & Free Tier)
```bash
AI_COMPLETION_PROVIDER=mistral
MISTRAL_API_KEY=...
AI_COMPLETION_MODEL=codestral-latest  # Optimized for code
```

### Anthropic Claude
```bash
AI_COMPLETION_PROVIDER=anthropic
ANTHROPIC_API_KEY=...
AI_COMPLETION_MODEL=claude-3-sonnet-20240229
```

### Groq (Very Fast)
```bash
AI_COMPLETION_PROVIDER=groq
GROQ_API_KEY=...
AI_COMPLETION_MODEL=mixtral-8x7b-32768
```

## TypeScript Support

VibeCode includes comprehensive TypeScript type definitions for Monacopilot configuration in `src/types/monacopilot.d.ts`.

### Available Types

```typescript
import type {
  // Basic configuration
  MonacopilotConfig,
  EnhancedMonacopilotConfig,
  
  // AI providers and models  
  AIProvider,
  OpenAIModel,
  MistralModel,
  AnthropicModel,
  GroqModel,
  
  // Configuration options
  CompletionTrigger,
  SupportedLanguage,
  ModelParameters,
  RelatedFile,
  
  // Provider-specific configs
  OpenAIConfig,
  MistralConfig,
  AnthropicConfig,
  
  // Callback types
  OnCompletionAccepted,
  OnCompletionRejected,
  OnError
} from '@/types/monacopilot';
```

### Provider-Specific Configuration

```typescript
// OpenAI configuration
const openaiConfig: OpenAIConfig = {
  provider: 'openai',
  model: 'gpt-4-turbo',
  endpoint: '/api/code-completion',
  language: 'typescript',
  apiKey: process.env.OPENAI_API_KEY
};

// Mistral configuration
const mistralConfig: MistralConfig = {
  provider: 'mistral',
  model: 'codestral',
  endpoint: '/api/code-completion',
  language: 'typescript',
  apiKey: process.env.MISTRAL_API_KEY
};
```

### Enhanced Configuration Example

```typescript
const enhancedConfig: EnhancedMonacopilotConfig = {
  // Required
  endpoint: '/api/code-completion',
  language: 'typescript',
  
  // AI Provider
  provider: 'mistral',
  model: 'codestral',
  
  // Behavior
  trigger: 'onIdle',
  enableCaching: true,
  allowFollowUpCompletions: true,
  
  // Context
  filename: 'utils.ts',
  technologies: ['react', 'nextjs', 'tailwindcss'],
  maxContextLines: 150,
  
  // Model parameters
  modelParameters: {
    temperature: 0.2,
    maxTokens: 1000,
    topP: 0.95
  },
  
  // Callbacks
  onCompletionAccepted: () => {
    console.log('User accepted completion');
  },
  onError: (error) => {
    console.error('Completion error:', error.message);
  }
};
```

## Advanced Configuration

### Custom Headers

```typescript
import type { EnhancedMonacopilotConfig } from '@/types/monacopilot';

const config: EnhancedMonacopilotConfig = {
  endpoint: '/api/code-completion',
  language: 'typescript',
  headers: {
    'Authorization': 'Bearer your-token',
    'X-Custom-Header': 'value',
  },
  // Enhanced configuration options
  provider: 'openai',
  model: 'gpt-4-turbo',
  trigger: 'onIdle',
  technologies: ['react', 'nextjs'],
  modelParameters: {
    temperature: 0.2,
    maxTokens: 500
  }
};

setupMonacopilot(monaco, editor, config);
```

### Multiple Editors

```typescript
import { setupMonacopilotMulti } from '@/lib/monaco/monacopilot-integration';
import type { EnhancedMonacopilotConfig } from '@/types/monacopilot';

const editors = [editor1, editor2, editor3];

const config: EnhancedMonacopilotConfig = {
  endpoint: '/api/code-completion',
  language: 'typescript',
  provider: 'mistral',
  model: 'codestral',
  trigger: 'onIdle',
  enableCaching: true
};

const registrations = setupMonacopilotMulti(monaco, editors, config);

// Cleanup all registrations later
registrations.forEach(reg => reg.deregister());
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

1. **Use Mistral Codestral** - Optimized for code, very fast
2. **Use Groq** - Extremely fast inference
3. **Lower temperature** - Faster and more deterministic (0.1-0.3)
4. **Reduce maxTokens** - Shorter completions = faster response

## Cost Optimization

1. **Mistral** - Free tier available, cheap paid tier
2. **Groq** - Very generous free tier
3. **OpenAI** - Use `gpt-3.5-turbo` for cost savings
4. **Cache completions** - Add caching layer for repeated patterns

## Resources

- [Monacopilot Documentation](https://monacopilot.dev/)
- [Monaco Editor API](https://microsoft.github.io/monaco-editor/api/index.html)
- [Supported AI Providers](https://monacopilot.dev/configuration/copilot-options.html)

## Examples

See `examples/monaco-with-ai/` for complete working examples.

## License

Monacopilot is MIT licensed.
