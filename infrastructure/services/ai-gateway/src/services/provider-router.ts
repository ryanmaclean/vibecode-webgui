import { ChatRequest, ChatResponse, Provider } from '../providers/provider';
import { OpenRouterProvider } from '../providers/openrouter-provider';
import { OpenAIProvider } from '../providers/openai-provider';
import { AzureOpenAIProvider } from '../providers/azure-openai-provider';
import { HuggingFaceProvider } from '../providers/hf-provider';
import { OllamaProvider } from '../providers/ollama-provider';

const DEFAULT_PROVIDER_ORDER = ['openrouter', 'openai', 'azure', 'hf', 'ollama'];
const KNOWN_PROVIDERS = new Set(DEFAULT_PROVIDER_ORDER);

function normalizeProvider(value?: string): string | undefined {
  const normalized = value?.trim().toLowerCase();
  return normalized ? normalized : undefined;
}

function parseProviderList(): string[] {
  const raw = process.env.PROVIDERS_ENABLED || 'openrouter';
  const providers = raw
    .split(',')
    .map(normalizeProvider)
    .filter((provider): provider is string => !!provider);
  const filtered = providers.filter(provider => KNOWN_PROVIDERS.has(provider));
  return filtered.length ? filtered : DEFAULT_PROVIDER_ORDER.slice();
}

function inferProvider(
  req: ChatRequest,
  enabled: Set<string>,
  order: string[],
  forced?: string
): { provider: string; normalizedModel?: string } {
  if (forced && enabled.has(forced)) {
    return { provider: forced };
  }
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
  for (const provider of order) {
    if (enabled.has(provider)) return { provider };
  }
  return { provider: 'openrouter' };
}

function isRateLimitError(error: unknown): boolean {
  const err = error as { response?: { status?: number; data?: any }; message?: string };
  const status = err?.response?.status;
  if (status === 429) return true;
  const message = [
    err?.message,
    err?.response?.data?.error?.message,
    err?.response?.data?.error,
    err?.response?.data?.message,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return (
    message.includes('rate limit') ||
    message.includes('ratelimit') ||
    message.includes('too many requests') ||
    message.includes('quota') ||
    message.includes('insufficient')
  );
}

export class ProviderRouter {
  private enabled: Set<string>;
  private order: string[];
  private forced?: string;
  private allowFallback: boolean;
  // Providers
  private openrouter?: Provider;
  private openai?: Provider;
  private azure?: Provider;
  private hf?: Provider;
  private ollama?: Provider;

  constructor() {
    this.order = parseProviderList();
    this.enabled = new Set(this.order);
    this.forced =
      normalizeProvider(process.env.FORCE_PROVIDER) ||
      normalizeProvider(process.env.PREFERRED_PROVIDER) ||
      normalizeProvider(process.env.DEFAULT_PROVIDER);
    this.allowFallback = process.env.ALLOW_PROVIDER_FALLBACK !== 'false';
    if (this.forced && KNOWN_PROVIDERS.has(this.forced) && !this.enabled.has(this.forced)) {
      this.enabled.add(this.forced);
      this.order = [this.forced, ...this.order.filter(provider => provider !== this.forced)];
    }
    if (this.enabled.has('openrouter')) this.openrouter = new OpenRouterProvider();
    if (this.enabled.has('openai')) this.openai = new OpenAIProvider();
    if (this.enabled.has('azure')) this.azure = new AzureOpenAIProvider();
    if (this.enabled.has('hf')) this.hf = new HuggingFaceProvider();
    if (this.enabled.has('ollama')) this.ollama = new OllamaProvider();
  }

  private getProvider(provider: string): Provider | undefined {
    switch (provider) {
      case 'openrouter':
        return this.openrouter;
      case 'openai':
        return this.openai;
      case 'azure':
        return this.azure;
      case 'hf':
        return this.hf;
      case 'ollama':
        return this.ollama;
      default:
        return undefined;
    }
  }

  private getProviderOrder(primary: string): string[] {
    const order = [primary, ...this.order.filter(provider => provider !== primary)];
    const seen = new Set<string>();
    return order.filter(provider => {
      if (seen.has(provider)) return false;
      seen.add(provider);
      return true;
    });
  }

  public async chatCompletion(req: ChatRequest, userId?: string): Promise<ChatResponse> {
    const { provider, normalizedModel } = inferProvider(req, this.enabled, this.order, this.forced);
    const effReq: ChatRequest = normalizedModel ? { ...req, model: normalizedModel } : req;

    const providersToTry = this.getProviderOrder(provider);
    let lastError: unknown;

    for (const target of providersToTry) {
      const instance = this.getProvider(target);
      if (!instance) {
        lastError = new Error(`${target} provider not enabled`);
        continue;
      }
      try {
        return await instance.chatCompletion(effReq, userId);
      } catch (error) {
        lastError = error;
        if (!this.allowFallback || !isRateLimitError(error)) {
          break;
        }
      }
    }

    if (lastError) throw lastError;
    throw new Error(`No provider available to handle request (wanted: ${provider})`);
  }
}
