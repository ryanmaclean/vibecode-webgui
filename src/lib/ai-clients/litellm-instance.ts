/**
 * LiteLLM Client Instance
 * Shared instance of LiteLLM client for the application
 */

import { existsSync, readFileSync } from 'node:fs';
import { LiteLLMClient } from './litellm-client';
import type { ChatCompletionRequest, ChatCompletionResponse } from './litellm-client';
import { logger } from '@/lib/logger';
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
  'openai/gpt-oss-20b:free',
  'deepseek/deepseek-chat-v3.1:free',
  'moonshotai/kimi-k2:free'
];
const FREE_LLM_MODELS_FILE = process.env['FREE_LLM_MODELS_FILE'];
const FREE_LLM_MODELS_FILE_CACHE_MS = Number(process.env['FREE_LLM_MODELS_FILE_CACHE_MS'] ?? 5 * 60 * 1000);
let cachedFileModels: string[] = [];
let cachedFileModelsExpiresAt = 0;
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

function loadModelsFromFile(): string[] {
  if (!FREE_LLM_MODELS_FILE) {
    return [];
  }

  const now = Date.now();
  if (now < cachedFileModelsExpiresAt) {
    return cachedFileModels;
  }

  if (!existsSync(FREE_LLM_MODELS_FILE)) {
    cachedFileModels = [];
    cachedFileModelsExpiresAt = now + FREE_LLM_MODELS_FILE_CACHE_MS;
    return cachedFileModels;
  }

  try {
    const raw = readFileSync(FREE_LLM_MODELS_FILE, 'utf8').trim();
    if (!raw) {
      cachedFileModels = [];
    } else if (FREE_LLM_MODELS_FILE.endsWith('.json')) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        cachedFileModels = parsed.filter((value: unknown): value is string => typeof value === 'string' && value.length > 0);
      } else if (
        typeof parsed === 'object' &&
        parsed !== null &&
        Array.isArray((parsed as { models?: unknown }).models)
      ) {
        cachedFileModels = (parsed as { models: unknown[] }).models.filter(
          (value: unknown): value is string => typeof value === 'string' && value.length > 0
        );
      } else {
        cachedFileModels = [];
      }
    } else {
      cachedFileModels = raw
        .split(/[\n,]/)
        .map(entry => entry.trim())
        .filter(Boolean);
    }
    cachedFileModelsExpiresAt = now + FREE_LLM_MODELS_FILE_CACHE_MS;
  } catch (error) {
    logger.warn('[LiteLLM] Failed to read FREE_LLM_MODELS_FILE', FREE_LLM_MODELS_FILE, error);
    cachedFileModels = [];
    cachedFileModelsExpiresAt = now + FREE_LLM_MODELS_FILE_CACHE_MS;
  }

  return cachedFileModels;
}

function hasOpenRouterKey(): boolean {
  return Boolean(process.env['OPENROUTER_API_KEY']);
}

let dynamicOpenRouterFreeModels: string[] = [];
let dynamicFreeModelFetchStarted = false;

async function fetchOpenRouterFreeModels(): Promise<string[]> {
  if (!hasOpenRouterKey()) {
    return [];
  }

  try {
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${process.env['OPENROUTER_API_KEY']}`,
      'Content-Type': 'application/json',
    };

    if (process.env['OPENROUTER_HTTP_REFERER']) {
      headers['HTTP-Referer'] = process.env['OPENROUTER_HTTP_REFERER'];
    }

    if (process.env['OPENROUTER_APP_TITLE']) {
      headers['X-Title'] = process.env['OPENROUTER_APP_TITLE'];
    }

    const fetchImpl: typeof fetch = typeof fetch !== 'undefined'
      ? fetch.bind(globalThis)
      : (await import('node-fetch')).default as unknown as typeof fetch;

    const res = await fetchImpl('https://openrouter.ai/api/v1/models', { headers });
    if (!res.ok) {
      logger.warn('[LiteLLM] Failed to fetch OpenRouter models', res.status, await res.text());
      return [];
    }

    const payload = await res.json() as { data?: Array<{ id?: string }> };
    const freeModels = (payload.data || [])
      .map((model) => model.id || '')
      .filter((id) => id.endsWith(':free'))
      .slice(0, 10);

    return freeModels;
  } catch (error) {
    logger.warn('[LiteLLM] Unable to load OpenRouter free models', error);
    return [];
  }
}

function ensureOpenRouterFreeModelFetch(): void {
  if (!dynamicFreeModelFetchStarted && hasOpenRouterKey()) {
    dynamicFreeModelFetchStarted = true;
    fetchOpenRouterFreeModels().then((models) => {
      if (models.length) {
        dynamicOpenRouterFreeModels = models;
      }
    }).catch((error) => {
      logger.warn('[LiteLLM] Error fetching OpenRouter free models', error);
    });
  }
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
  ensureOpenRouterFreeModelFetch();
  const defaults = new Set<string>(DEFAULT_OPENROUTER_FREE_MODELS);
  const envModels = parseModelList(process.env['FREE_LLM_MODELS']);
  for (const model of envModels) defaults.add(model);
  const fileModels = loadModelsFromFile();
  for (const model of fileModels) defaults.add(model);
  for (const dynamicModel of dynamicOpenRouterFreeModels) defaults.add(dynamicModel);
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

  if (hasOpenRouterKey()) {
    addEntry('openrouter', preferredModel);
    for (const model of getFreeModelPool()) {
      addEntry('openrouter', model);
    }
  }

  if (hasOpenAIKey()) {
    addEntry('openai', openAIChatModel);
  }

  return chain;
}

const RECOVERABLE_ERROR_PATTERNS = [
  /HTTP\s*401/i,
  /HTTP\s*403/i,
  /HTTP\s*429/i,
  /key limit exceeded/i,
  /rate limit/i,
  /quota/i,
  /timeout/i,
  /operation was aborted/i
];

const OPENROUTER_HARD_FAIL_PATTERNS = [
  /user not found/i,
  /invalid api key/i,
  /invalid authorization/i,
  /key limit exceeded/i,
  /plan inactive/i
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
  let skipOpenRouterProviders = false;

  for (const entry of fallbackChain) {
    if (skipOpenRouterProviders && entry.provider === 'openrouter') {
      continue;
    }

    const client = entry.provider === 'openrouter' ? getLiteLLMClient() : getOpenAIClient();
    try {
      const requestPayload: ChatCompletionRequest = {
        ...request,
        model: entry.model
      };

      const payloadForProvider = entry.provider === 'openai'
        ? (() => {
            const sanitizedPayload: Partial<ChatCompletionRequest> & Record<string, unknown> = {
              ...requestPayload
            };
            delete sanitizedPayload.metadata;
            return sanitizedPayload as ChatCompletionRequest;
          })()
        : requestPayload;

      const response = await client.createChatCompletion(payloadForProvider);

      if (attempts.length > 0) {
        logger.warn(`[LLM Fallback] Switched to ${entry.provider}:${entry.model} after ${attempts.length} failure(s).`);
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

      if (entry.provider === 'openrouter' && OPENROUTER_HARD_FAIL_PATTERNS.some(pattern => pattern.test(error.message))) {
        skipOpenRouterProviders = true;
      }

      if (!isRecoverableLLMError(error)) {
        error.message = `[${entry.provider}:${entry.model}] ${error.message}`;
        throw error;
      }
    }
  }

  const summary = attempts.map(a => `${a.provider}:${a.model} -> ${a.error}`).join('; ');
  throw new Error(`All fallback models failed. Attempts: ${summary}`);
}
