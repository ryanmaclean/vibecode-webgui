# Custom AI Model Plugin

An example plugin demonstrating how to register and integrate custom AI models and providers with VibeCode.

## Overview

This plugin shows developers how to:

- Define custom AI model providers
- Register models with VibeCode's AI system
- Implement model inference endpoints
- Integrate with third-party AI services
- Support streaming and function calling
- Handle authentication and API keys

## Use Cases

This pattern is useful for:

- **Self-Hosted LLMs**: Integrate local models via Ollama, LocalAI, or vLLM
- **Proprietary Models**: Connect to internal AI services
- **Fine-Tuned Models**: Use specialized models trained for specific tasks
- **Alternative Providers**: Add support for AI services not included by default
- **Cost Optimization**: Route certain tasks to cheaper or faster models

## Features

- **Custom Provider Registration**: Add new AI providers to VibeCode
- **Multiple Model Support**: Define multiple models per provider
- **Full Model Metadata**: Context windows, pricing, capabilities
- **Lifecycle Management**: Proper initialization and cleanup
- **Type Safety**: Full TypeScript type definitions

## Installation

### Via CLI

```bash
vibecode plugin install ./plugins/examples/custom-model
```

### Via UI

1. Navigate to Settings → Plugins
2. Click "Install Plugin"
3. Select the `custom-model` directory
4. Click "Install" and "Enable"

### Via API

```bash
curl -X POST http://localhost:3000/api/plugins/install \
  -H "Content-Type: application/json" \
  -d '{"source": "./plugins/examples/custom-model", "autoEnable": true}'
```

## Plugin Structure

```
custom-model/
├── plugin.json       # Plugin manifest with metadata
├── index.ts         # Main plugin implementation
└── README.md        # This file
```

## Configuration

### Provider Definition

The plugin defines a custom AI provider with the following structure:

```typescript
const customProvider: AIProvider = {
  id: 'custom-ai',
  name: 'Custom AI Provider',
  company: 'Example Corp',
  models: [
    {
      id: 'custom-code-model',
      name: 'Custom Code Model',
      description: 'A specialized model fine-tuned for code generation',
      contextWindow: 16384,
      maxTokens: 4096,
      supportsFunctionCalling: true,
      supportsVision: false,
      costPer1kTokens: {
        input: 0.001,
        output: 0.002
      }
    }
  ],
  capabilities: {
    streaming: true,
    functionCalling: true,
    vision: false,
    codeGeneration: true,
    reasoning: true
  },
  pricing: 'low',
  status: 'active'
}
```

### Model Capabilities

Each model can specify:

- **Context Window**: Maximum input tokens (e.g., 16384)
- **Max Tokens**: Maximum output tokens (e.g., 4096)
- **Function Calling**: Whether model supports tool/function calling
- **Vision**: Whether model can process images
- **Pricing**: Cost per 1,000 input/output tokens

### Provider Capabilities

Providers define their capabilities:

- **Streaming**: Real-time token streaming support
- **Function Calling**: Structured tool/API calling
- **Vision**: Image/multimodal understanding
- **Code Generation**: Optimized for code tasks
- **Reasoning**: Advanced reasoning and analysis

## Usage Examples

### Querying Available Models

```typescript
import { getCustomModels, getProviderInfo } from 'custom-model';

// Get all custom models
const models = getCustomModels();
console.log(`Available models: ${models.length}`);

// Get provider information
const provider = getProviderInfo();
console.log(`Provider: ${provider.name}`);
console.log(`Company: ${provider.company}`);
console.log(`Pricing: ${provider.pricing}`);
```

### Running Inference

```typescript
import { executeInference } from 'custom-model';

// Basic inference
const response = await executeInference(
  'custom-code-model',
  'Write a function to calculate fibonacci numbers'
);

// With options
const streamedResponse = await executeInference(
  'custom-chat-model',
  'Explain how plugins work in VibeCode',
  {
    temperature: 0.7,
    maxTokens: 2048,
    stream: true
  }
);
```

### Integration with VibeCode

Once registered, custom models appear in:

1. **Model Selector**: UI dropdown for model selection
2. **API Endpoints**: Available via `/api/ai/models`
3. **Workflows**: Can be used in automated workflows
4. **Settings**: Configurable in user preferences

## Implementing Your Own Provider

### Step 1: Define Your Provider

Create an `AIProvider` object with your model specifications:

```typescript
import { AIProvider } from '@/lib/ai-providers';

const myProvider: AIProvider = {
  id: 'my-provider',
  name: 'My AI Service',
  company: 'My Company',
  models: [
    {
      id: 'my-model-v1',
      name: 'My Model v1',
      description: 'Description of model capabilities',
      contextWindow: 8192,
      maxTokens: 2048,
      supportsFunctionCalling: false,
      supportsVision: false,
      costPer1kTokens: { input: 0.001, output: 0.002 }
    }
  ],
  capabilities: {
    streaming: true,
    functionCalling: false,
    vision: false,
    codeGeneration: true,
    reasoning: false
  },
  pricing: 'low',
  status: 'active'
};
```

### Step 2: Implement Inference

Create an inference function that calls your AI service:

```typescript
async function executeInference(modelId: string, prompt: string) {
  // 1. Get API credentials from environment or config
  const apiKey = process.env.MY_AI_API_KEY;

  // 2. Make API request to your AI service
  const response = await fetch('https://api.myai.com/v1/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: modelId,
      prompt: prompt,
      max_tokens: 2048
    })
  });

  // 3. Parse and return the response
  const data = await response.json();
  return data.completion;
}
```

### Step 3: Register Provider on Initialize

```typescript
async function initialize(ctx: PluginContext): Promise<void> {
  context = ctx;

  // Register your provider
  ctx.logger.info(`Registering ${myProvider.name}...`);
  registerCustomProvider(ctx, myProvider);

  ctx.logger.info('Provider registered successfully!');
}
```

### Step 4: Handle Lifecycle Events

```typescript
async function destroy(): Promise<void> {
  if (context) {
    // Clean up: unregister provider, close connections, etc.
    unregisterCustomProvider(context);
    context = null;
  }
}
```

## Real-World Examples

### Ollama Integration

```typescript
const ollamaProvider: AIProvider = {
  id: 'ollama',
  name: 'Ollama',
  company: 'Ollama',
  models: [
    {
      id: 'llama2',
      name: 'Llama 2',
      description: 'Meta\'s open source LLM running locally',
      contextWindow: 4096,
      maxTokens: 2048,
      supportsFunctionCalling: false,
      supportsVision: false,
      costPer1kTokens: { input: 0, output: 0 } // Free - runs locally
    }
  ],
  capabilities: {
    streaming: true,
    functionCalling: false,
    vision: false,
    codeGeneration: true,
    reasoning: true
  },
  pricing: 'free',
  status: 'active'
};
```

### OpenRouter Integration

```typescript
const openRouterProvider: AIProvider = {
  id: 'openrouter',
  name: 'OpenRouter',
  company: 'OpenRouter',
  models: [
    {
      id: 'mistral-7b',
      name: 'Mistral 7B',
      description: 'Fast and efficient open source model',
      contextWindow: 8192,
      maxTokens: 4096,
      supportsFunctionCalling: true,
      supportsVision: false,
      costPer1kTokens: { input: 0.0002, output: 0.0006 }
    }
  ],
  capabilities: {
    streaming: true,
    functionCalling: true,
    vision: false,
    codeGeneration: true,
    reasoning: true
  },
  pricing: 'low',
  status: 'active'
};
```

## Environment Variables

Configure your custom provider with environment variables:

```bash
# Add to .env.local
CUSTOM_AI_API_KEY=your-api-key-here
CUSTOM_AI_BASE_URL=https://api.example.com/v1
CUSTOM_AI_MODEL=custom-code-model
```

Access in your plugin:

```typescript
const apiKey = process.env.CUSTOM_AI_API_KEY;
const baseUrl = process.env.CUSTOM_AI_BASE_URL;
```

## Permissions

This plugin requires:

- `ai-models:access`: Access to AI model registry
- `network:outbound`: Make external API calls

## Security Considerations

1. **API Keys**: Store API keys in environment variables, never in code
2. **Rate Limiting**: Implement rate limiting to prevent abuse
3. **Input Validation**: Validate all inputs before sending to AI service
4. **Error Handling**: Handle API errors gracefully
5. **Timeout**: Set reasonable timeouts for API calls
6. **Cost Monitoring**: Track token usage to prevent unexpected costs

## Testing

Test your custom model plugin:

```bash
# Install the plugin
vibecode plugin install ./plugins/examples/custom-model

# Check plugin status
vibecode plugin list

# Test model inference (if CLI support exists)
vibecode ai chat --model custom-code-model "Write a hello world function"

# Uninstall
vibecode plugin uninstall custom-model
```

## Troubleshooting

### Plugin Not Loading

- Check that `plugin.json` is valid JSON
- Verify all required permissions are listed
- Check console for initialization errors

### Model Not Appearing

- Ensure `providesAIModel: true` in capabilities
- Verify provider registration in `initialize()`
- Check that provider ID is unique

### API Errors

- Verify API key is set in environment
- Check network connectivity
- Review API service status and rate limits
- Enable debug logging: `ctx.logger.debug()`

## Advanced Features

### Streaming Support

Implement streaming for real-time responses:

```typescript
async function* streamInference(modelId: string, prompt: string) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { /* ... */ },
    body: JSON.stringify({ model: modelId, prompt, stream: true })
  });

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    yield chunk;
  }
}
```

### Function Calling

Support function calling for tool use:

```typescript
interface FunctionCall {
  name: string;
  arguments: Record<string, unknown>;
}

async function inferenceWithFunctions(
  modelId: string,
  prompt: string,
  functions: Array<{ name: string; description: string; parameters: object }>
) {
  // Implementation that supports function calling
}
```

## Related Resources

- [Plugin API Documentation](/docs/PLUGIN_API.md)
- [AI Provider Configuration](/src/lib/ai-providers.ts)
- [Hello World Plugin](/plugins/examples/hello-world)
- [Workflow Plugin Example](/plugins/examples/workflow-automation)

## License

MIT

## Author

VibeCode Team
- Email: team@vibecode.dev
- Website: https://vibecode.dev

## Contributing

Contributions welcome! Please:

1. Follow the existing code style
2. Add tests for new features
3. Update documentation
4. Submit a pull request

## Support

- Documentation: https://vibecode.dev/docs
- Issues: https://github.com/vibecode/vibecode/issues
- Discord: https://discord.gg/vibecode
