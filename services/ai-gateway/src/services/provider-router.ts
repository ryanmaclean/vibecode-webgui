import { ChatRequest, ChatResponse, Provider } from '../providers/provider';
import { OpenRouterProvider } from '../providers/openrouter-provider';
import { OpenAIProvider } from '../providers/openai-provider';
import { AzureOpenAIProvider } from '../providers/azure-openai-provider';
import { HuggingFaceProvider } from '../providers/hf-provider';
import { OllamaProvider } from '../providers/ollama-provider';

function parseEnabledProviders(): Set<string> {
  const raw = process.env.PROVIDERS_ENABLED || 'openrouter';
  return new Set(
    raw.split(',')
      .map(s => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

function inferProvider(req: ChatRequest, enabled: Set<string>): { provider: string; normalizedModel?: string } {
  if (req.provider && enabled.has(req.provider)) {
    return { provider: req.provider };
  }
  const model = req.model || '';
  // Allow explicit prefix: openai:gpt-4o, azure:gpt4o, hf:mistralai/Mixtral, openrouter:anthropic/claude-3
  const idx = model.indexOf(':');
  if (idx > 0) {
    const prefix = model.slice(0, idx).toLowerCase();
    const rest = model.slice(idx + 1);
    if (enabled.has(prefix)) {
      return { provider: prefix, normalizedModel: rest };
    }
  }
  // Default preference order based on what's enabled
  const order = ['openrouter', 'openai', 'azure', 'hf', 'ollama'];
  for (const p of order) {
    if (enabled.has(p)) return { provider: p };
  }
  // Fallback
  return { provider: 'openrouter' };
}

export class ProviderRouter {
  private enabled: Set<string>;
  // Providers
  private openrouter?: Provider;
  private openai?: Provider;
  private azure?: Provider;
  private hf?: Provider;
  private ollama?: Provider;

  constructor() {
    this.enabled = parseEnabledProviders();
    if (this.enabled.has('openrouter')) this.openrouter = new OpenRouterProvider();
    if (this.enabled.has('openai')) this.openai = new OpenAIProvider();
    if (this.enabled.has('azure')) this.azure = new AzureOpenAIProvider();
    if (this.enabled.has('hf')) this.hf = new HuggingFaceProvider();
    if (this.enabled.has('ollama')) this.ollama = new OllamaProvider();
  }

  public async chatCompletion(req: ChatRequest, userId?: string): Promise<ChatResponse> {
    const { provider, normalizedModel } = inferProvider(req, this.enabled);
    const effReq: ChatRequest = normalizedModel ? { ...req, model: normalizedModel } : req;

    switch (provider) {
      case 'openrouter':
        if (!this.openrouter) throw new Error('OpenRouter provider not enabled');
        return this.openrouter.chatCompletion(effReq, userId);
      case 'openai':
        if (!this.openai) throw new Error('OpenAI provider not enabled');
        return this.openai.chatCompletion(effReq, userId);
      case 'azure':
        if (!this.azure) throw new Error('Azure OpenAI provider not enabled');
        return this.azure.chatCompletion(effReq, userId);
      case 'hf':
        if (!this.hf) throw new Error('Hugging Face provider not enabled');
        return this.hf.chatCompletion(effReq, userId);
      case 'ollama':
        if (!this.ollama) throw new Error('Ollama provider not enabled');
        return this.ollama.chatCompletion(effReq, userId);
      default:
        // For now, until other providers are implemented, route to OpenRouter if available
        if (this.openrouter) return this.openrouter.chatCompletion(effReq, userId);
        throw new Error(`No provider available to handle request (wanted: ${provider})`);
    }
  }
}
