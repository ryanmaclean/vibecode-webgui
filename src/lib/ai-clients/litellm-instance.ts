/**
 * LiteLLM Client Instance
 * Shared instance of LiteLLM client for the application
 */

import { LiteLLMClient } from './litellm-client';
import type { ChatCompletionRequest, ChatCompletionResponse } from './litellm-client';

type Provider = 'openrouter' | 'openai';

interface FallbackEntry {
  provider: Provider;
  model: string;
}

interface FallbackAttempt {
  provider: Provider;
  model: string;
  error: string;
}

export interface ChatCompletionFallbackResult {
  response: ChatCompletionResponse;
  modelUsed: string;
  provider: Provider;
  attempts: FallbackAttempt[];
}

const DEFAULT_OPENROUTER_FREE_MODELS = [
  'mistralai/mistral-small-3.2-24b-instruct:free',
  'x-ai/grok-4-fast:free',
  'deepseek/deepseek-chat-v3.1:free',
  'openai/gpt-oss-20b:free',
  'openai/gpt-oss-120b:free',
  'nvidia/nemotron-nano-9b-v2:free',
  'z-ai/glm-4.5-air:free',
  'google/gemma-3n-e4b-it:free',
  'tencent/hunyuan-a13b-instruct:free',
  'moonshotai/kimi-dev-72b:free'
];
const openAIChatModel = process.env['OPENAI_CHAT_MODEL'] || 'gpt-4o-mini';
const openAIBaseUrl = process.env['OPENAI_BASE_URL'] || 'https://api.openai.com/v1';
let cachedOpenAIClient: LiteLLMClient | null = null;

function parseModelList(raw?: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(/[\n,]/)
    .map(model => model.trim())
    .filter(Boolean);
}

function hasOpenRouterKey(): boolean {
  return Boolean(process.env['OPENROUTER_API_KEY']);
}

function hasOpenAIKey(): boolean {
  return Boolean(process.env['OPENAI_API_KEY']);
}

function hasLiteLLMKey(): boolean {
  return Boolean(process.env['LITELLM_MASTER_KEY']);
}

function hasExplicitBase(): boolean {
  return Boolean(process.env['LITELLM_BASE_URL']);
}

function resolveDefaultModel(): string {
  return process.env['VIBECODE_DEFAULT_LLM_MODEL']
    || parseModelList(process.env['FREE_LLM_MODELS'])[0]
    || DEFAULT_OPENROUTER_FREE_MODELS[0];
}

export function getFreeModelPool(): string[] {
  const defaults = new Set<string>(DEFAULT_OPENROUTER_FREE_MODELS);
  const envModels = parseModelList(process.env['FREE_LLM_MODELS']);
  for (const model of envModels) defaults.add(model);
  defaults.add(resolveDefaultModel());
  return Array.from(defaults);
}

export function pickFreeModel(): string {
  const pool = getFreeModelPool();
  return pool[Math.floor(Math.random() * pool.length)] || resolveDefaultModel();
}

function createLiteLLMClient(): LiteLLMClient {
  const defaultModel = resolveDefaultModel();
  const baseUrl = process.env['LITELLM_BASE_URL']
    || (hasOpenRouterKey() ? 'https://openrouter.ai/api/v1' : undefined)
    || (hasOpenAIKey() ? 'https://api.openai.com/v1' : undefined)
    || 'http://localhost:4000';

  const apiKey = process.env['LITELLM_MASTER_KEY']
    || process.env['OPENROUTER_API_KEY']
    || process.env['OPENAI_API_KEY']
    || 'sk-vibecode-master-key-12345';

  const extraHeaders: Record<string, string> | undefined = hasExplicitBase() || hasLiteLLMKey()
    ? undefined
    : hasOpenRouterKey()
      ? {
          'HTTP-Referer': process.env['OPENROUTER_HTTP_REFERER'] || 'https://vibecode.ai',
          'X-Title': process.env['OPENROUTER_APP_TITLE'] || 'VibeCode WebGUI'
        }
      : undefined;

  return new LiteLLMClient({
    baseUrl,
    apiKey,
    defaultModel,
    enableLogging: process.env.NODE_ENV !== 'production',
    enableCaching: true,
    extraHeaders
  });
}

let cachedLiteLLMClient: LiteLLMClient | null = null;

export function getLiteLLMClient(): LiteLLMClient {
  if (!cachedLiteLLMClient) {
    cachedLiteLLMClient = createLiteLLMClient();
  }
  return cachedLiteLLMClient;
}

function getOpenAIClient(): LiteLLMClient {
  if (!hasOpenAIKey()) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  if (!cachedOpenAIClient) {
    cachedOpenAIClient = new LiteLLMClient({
      baseUrl: openAIBaseUrl,
      apiKey: process.env['OPENAI_API_KEY'] as string,
      defaultModel: openAIChatModel,
      enableLogging: process.env.NODE_ENV !== 'production',
      enableCaching: true,
      maxRetries: 2
    });
  }

  return cachedOpenAIClient;
}

function buildFallbackChain(preferredModel?: string): FallbackEntry[] {
  const chain: FallbackEntry[] = [];
  const seen = new Set<string>();

  const addEntry = (provider: Provider, model: string | undefined) => {
    if (!model) return;
    const key = `${provider}:${model}`;
    if (seen.has(key)) return;
    chain.push({ provider, model });
    seen.add(key);
  };

  if (hasOpenAIKey()) {
    addEntry('openai', openAIChatModel);
  }

  if (hasOpenRouterKey()) {
    addEntry('openrouter', preferredModel);
    for (const model of getFreeModelPool()) {
      addEntry('openrouter', model);
    }
  }

  return chain;
}

const RECOVERABLE_ERROR_PATTERNS = [
  /HTTP\s*401/i,
  /HTTP\s*403/i,
  /HTTP\s*429/i,
  /key limit exceeded/i,
  /rate limit/i,
  /quota/i
];

function isRecoverableLLMError(error: Error): boolean {
  return RECOVERABLE_ERROR_PATTERNS.some(pattern => pattern.test(error.message));
}

export async function createChatCompletionWithFallback(
  request: ChatCompletionRequest
): Promise<ChatCompletionFallbackResult> {
  const fallbackChain = buildFallbackChain(request.model);
  if (!fallbackChain.length) {
    throw new Error('No LLM providers are configured. Set OPENROUTER_API_KEY or OPENAI_API_KEY.');
  }

  const attempts: FallbackAttempt[] = [];

  for (const entry of fallbackChain) {
    const client = entry.provider === 'openrouter' ? getLiteLLMClient() : getOpenAIClient();
    try {
      const requestPayload: ChatCompletionRequest = {
        ...request,
        model: entry.model
      };

      const payloadForProvider = entry.provider === 'openai'
        ? (() => {
            const { metadata: _ignored, ...rest } = requestPayload as any;
            return rest as ChatCompletionRequest;
          })()
        : requestPayload;

      const response = await client.createChatCompletion(payloadForProvider);

      if (attempts.length > 0) {
        console.warn(`[LLM Fallback] Switched to ${entry.provider}:${entry.model} after ${attempts.length} failure(s).`);
      }

      return {
        response,
        modelUsed: entry.model,
        provider: entry.provider,
        attempts
      };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      attempts.push({ provider: entry.provider, model: entry.model, error: error.message });

      if (!isRecoverableLLMError(error)) {
        error.message = `[${entry.provider}:${entry.model}] ${error.message}`;
        throw error;
      }
    }
  }

  const summary = attempts.map(a => `${a.provider}:${a.model} -> ${a.error}`).join('; ');
  throw new Error(`All fallback models failed. Attempts: ${summary}`);
}
