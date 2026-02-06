/**
 * TokenCounter - Accurate token counting for multiple AI models
 *
 * Provides model-specific token counting with caching for performance.
 * Supports GPT-4, Claude, Llama, and other major model families.
 */

import { encoding_for_model, Tiktoken, TiktokenModel } from 'tiktoken';
import {
  TokenCountResult,
  ModelFamily,
  ModelTokenConfig,
  MODEL_CONFIGS
} from '../../../types/context';

/**
 * Cache entry for token counts
 */
interface TokenCacheEntry {
  count: number;
  timestamp: number;
  model: string;
}

/**
 * Options for TokenCounter initialization
 */
export interface TokenCounterOptions {
  /** Enable caching (default: true) */
  enableCache?: boolean;
  /** Cache TTL in milliseconds (default: 1 hour) */
  cacheTtl?: number;
  /** Maximum cache size (default: 10000 entries) */
  maxCacheSize?: number;
  /** Default model to use (default: 'gpt-4') */
  defaultModel?: string;
}

/**
 * Model family to tiktoken model mapping
 */
const TIKTOKEN_MODEL_MAP: Record<ModelFamily, TiktokenModel> = {
  [ModelFamily.GPT4]: 'gpt-4',
  [ModelFamily.GPT4_TURBO]: 'gpt-4-turbo',
  [ModelFamily.GPT35_TURBO]: 'gpt-3.5-turbo',
  [ModelFamily.CLAUDE]: 'gpt-4', // Claude uses similar tokenization
  [ModelFamily.CLAUDE_3]: 'gpt-4', // Claude 3 approximation
  [ModelFamily.LLAMA]: 'gpt-4', // Llama approximation
  [ModelFamily.LLAMA_3]: 'gpt-4', // Llama 3 approximation
  [ModelFamily.MISTRAL]: 'gpt-4', // Mistral approximation
  [ModelFamily.GEMINI]: 'gpt-4', // Gemini approximation
  [ModelFamily.UNKNOWN]: 'gpt-4' // Fallback
};

/**
 * Approximate characters per token for different model families
 * Used for fast estimation when exact counting is not needed
 */
const CHARS_PER_TOKEN: Record<ModelFamily, number> = {
  [ModelFamily.GPT4]: 4,
  [ModelFamily.GPT4_TURBO]: 4,
  [ModelFamily.GPT35_TURBO]: 4,
  [ModelFamily.CLAUDE]: 3.5, // Claude tends to have slightly more tokens per character
  [ModelFamily.CLAUDE_3]: 3.5,
  [ModelFamily.LLAMA]: 4,
  [ModelFamily.LLAMA_3]: 4,
  [ModelFamily.MISTRAL]: 4,
  [ModelFamily.GEMINI]: 4,
  [ModelFamily.UNKNOWN]: 4
};

/**
 * TokenCounter class for accurate token counting across AI models
 */
export class TokenCounter {
  private encoders: Map<string, Tiktoken> = new Map();
  private cache: Map<string, TokenCacheEntry> = new Map();
  private readonly options: Required<TokenCounterOptions>;
  private cacheHits = 0;
  private cacheMisses = 0;

  constructor(options: TokenCounterOptions = {}) {
    this.options = {
      enableCache: options.enableCache ?? true,
      cacheTtl: options.cacheTtl ?? 60 * 60 * 1000, // 1 hour
      maxCacheSize: options.maxCacheSize ?? 10000,
      defaultModel: options.defaultModel ?? 'gpt-4'
    };
  }

  /**
   * Get or create a tiktoken encoder for a model
   */
  private getEncoder(model: string): Tiktoken {
    const modelConfig = this.getModelConfig(model);
    const tiktokenModel = TIKTOKEN_MODEL_MAP[modelConfig.family];

    if (!this.encoders.has(tiktokenModel)) {
      try {
        const encoder = encoding_for_model(tiktokenModel);
        this.encoders.set(tiktokenModel, encoder);
      } catch {
        // Fallback to gpt-4 if model not found
        if (!this.encoders.has('gpt-4')) {
          const fallbackEncoder = encoding_for_model('gpt-4');
          this.encoders.set('gpt-4', fallbackEncoder);
        }
        return this.encoders.get('gpt-4')!;
      }
    }

    return this.encoders.get(tiktokenModel)!;
  }

  /**
   * Get model configuration
   */
  getModelConfig(model: string): ModelTokenConfig {
    // Direct match
    if (MODEL_CONFIGS[model]) {
      return MODEL_CONFIGS[model];
    }

    // Partial match (e.g., 'gpt-4-0125-preview' -> 'gpt-4-turbo')
    for (const [key, config] of Object.entries(MODEL_CONFIGS)) {
      if (model.includes(key) || key.includes(model)) {
        return config;
      }
    }

    // Infer from model name
    if (model.includes('gpt-4-turbo') || model.includes('gpt-4o')) {
      return MODEL_CONFIGS['gpt-4-turbo'];
    }
    if (model.includes('gpt-4')) {
      return MODEL_CONFIGS['gpt-4'];
    }
    if (model.includes('gpt-3.5')) {
      return MODEL_CONFIGS['gpt-3.5-turbo'];
    }
    if (model.includes('claude-3-opus')) {
      return MODEL_CONFIGS['claude-3-opus'];
    }
    if (model.includes('claude-3-sonnet') || model.includes('claude-3.5-sonnet')) {
      return MODEL_CONFIGS['claude-3-sonnet'];
    }
    if (model.includes('claude-3-haiku')) {
      return MODEL_CONFIGS['claude-3-haiku'];
    }
    if (model.includes('claude')) {
      return MODEL_CONFIGS['claude-3-sonnet'];
    }
    if (model.includes('llama')) {
      return MODEL_CONFIGS['llama-3-70b'];
    }
    if (model.includes('mistral')) {
      return MODEL_CONFIGS['mistral-large'];
    }
    if (model.includes('gemini')) {
      return MODEL_CONFIGS['gemini-pro'];
    }

    // Default fallback
    return {
      model,
      family: ModelFamily.UNKNOWN,
      maxContextTokens: 8192,
      maxOutputTokens: 4096,
      systemPromptReserved: 500,
      responseReserved: 2000
    };
  }

  /**
   * Generate a cache key for a text and model combination
   */
  private getCacheKey(text: string, model: string): string {
    // Use a simple hash of the text to reduce memory usage
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `${model}:${hash}:${text.length}`;
  }

  /**
   * Check if a cache entry is still valid
   */
  private isCacheValid(entry: TokenCacheEntry): boolean {
    return Date.now() - entry.timestamp < this.options.cacheTtl;
  }

  /**
   * Evict old entries if cache is full
   */
  private evictIfNeeded(): void {
    if (this.cache.size >= this.options.maxCacheSize) {
      // Remove oldest 20% of entries
      const entriesToRemove = Math.floor(this.options.maxCacheSize * 0.2);
      const entries = Array.from(this.cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)
        .slice(0, entriesToRemove);

      for (const [key] of entries) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Count tokens in a text string
   */
  count(text: string, model?: string): TokenCountResult {
    const startTime = performance.now();
    const targetModel = model || this.options.defaultModel;

    // Check cache first
    if (this.options.enableCache) {
      const cacheKey = this.getCacheKey(text, targetModel);
      const cached = this.cache.get(cacheKey);

      if (cached && this.isCacheValid(cached)) {
        this.cacheHits++;
        return {
          count: cached.count,
          model: targetModel,
          isExact: true,
          durationMs: performance.now() - startTime,
          fromCache: true
        };
      }
      this.cacheMisses++;
    }

    // Count tokens using encoder
    const encoder = this.getEncoder(targetModel);
    const tokens = encoder.encode(text);
    const count = tokens.length;

    // Cache the result
    if (this.options.enableCache) {
      this.evictIfNeeded();
      const cacheKey = this.getCacheKey(text, targetModel);
      this.cache.set(cacheKey, {
        count,
        timestamp: Date.now(),
        model: targetModel
      });
    }

    return {
      count,
      model: targetModel,
      isExact: true,
      durationMs: performance.now() - startTime,
      fromCache: false
    };
  }

  /**
   * Count tokens in multiple texts (batch operation)
   */
  countBatch(texts: string[], model?: string): TokenCountResult[] {
    return texts.map(text => this.count(text, model));
  }

  /**
   * Estimate token count without using the encoder (faster but less accurate)
   */
  estimate(text: string, model?: string): TokenCountResult {
    const startTime = performance.now();
    const targetModel = model || this.options.defaultModel;
    const modelConfig = this.getModelConfig(targetModel);
    const charsPerToken = CHARS_PER_TOKEN[modelConfig.family];

    const count = Math.ceil(text.length / charsPerToken);

    return {
      count,
      model: targetModel,
      isExact: false,
      durationMs: performance.now() - startTime,
      fromCache: false
    };
  }

  /**
   * Count tokens for a chat message array (includes message overhead)
   */
  countMessages(
    messages: Array<{ role: string; content: string; name?: string }>,
    model?: string
  ): TokenCountResult {
    const startTime = performance.now();
    const targetModel = model || this.options.defaultModel;
    const modelConfig = this.getModelConfig(targetModel);

    let totalTokens = 0;

    // Message overhead varies by model
    // GPT-4/3.5: ~4 tokens per message for role/formatting
    // Claude: ~3 tokens per message
    const messageOverhead = modelConfig.family === ModelFamily.CLAUDE ||
                           modelConfig.family === ModelFamily.CLAUDE_3 ? 3 : 4;

    for (const message of messages) {
      // Count content tokens
      const contentResult = this.count(message.content, targetModel);
      totalTokens += contentResult.count;

      // Add message overhead
      totalTokens += messageOverhead;

      // Add tokens for role
      totalTokens += this.count(message.role, targetModel).count;

      // Add tokens for name if present
      if (message.name) {
        totalTokens += this.count(message.name, targetModel).count + 1;
      }
    }

    // Add conversation priming tokens
    totalTokens += 3;

    return {
      count: totalTokens,
      model: targetModel,
      isExact: true,
      durationMs: performance.now() - startTime,
      fromCache: false
    };
  }

  /**
   * Calculate available tokens for context after reserving space
   */
  getAvailableContextTokens(model?: string): number {
    const targetModel = model || this.options.defaultModel;
    const config = this.getModelConfig(targetModel);

    return config.maxContextTokens -
           config.systemPromptReserved -
           config.responseReserved;
  }

  /**
   * Check if text fits within available tokens
   */
  fitsInContext(text: string, model?: string, usedTokens: number = 0): boolean {
    const result = this.count(text, model);
    const available = this.getAvailableContextTokens(model);
    return result.count + usedTokens <= available;
  }

  /**
   * Truncate text to fit within a token limit
   */
  truncateToFit(text: string, maxTokens: number, model?: string): string {
    const result = this.count(text, model);

    if (result.count <= maxTokens) {
      return text;
    }

    const targetModel = model || this.options.defaultModel;
    const encoder = this.getEncoder(targetModel);
    const tokens = encoder.encode(text);
    const truncatedTokens = tokens.slice(0, maxTokens);

    // Decode back to string
    const decoder = new TextDecoder();
    try {
      return decoder.decode(encoder.decode(truncatedTokens));
    } catch {
      // Fallback: estimate characters needed
      const modelConfig = this.getModelConfig(targetModel);
      const charsPerToken = CHARS_PER_TOKEN[modelConfig.family];
      return text.slice(0, Math.floor(maxTokens * charsPerToken));
    }
  }

  /**
   * Split text into chunks that fit within a token limit
   */
  splitIntoChunks(
    text: string,
    maxTokensPerChunk: number,
    model?: string,
    overlap: number = 0
  ): string[] {
    const targetModel = model || this.options.defaultModel;
    const encoder = this.getEncoder(targetModel);
    const tokens = encoder.encode(text);
    const chunks: string[] = [];

    const decoder = new TextDecoder();
    let i = 0;

    while (i < tokens.length) {
      const chunkTokens = tokens.slice(i, i + maxTokensPerChunk);

      try {
        const chunk = decoder.decode(encoder.decode(chunkTokens));
        chunks.push(chunk);
      } catch {
        // Fallback for decoding errors
        const modelConfig = this.getModelConfig(targetModel);
        const charsPerToken = CHARS_PER_TOKEN[modelConfig.family];
        const startChar = Math.floor(i * charsPerToken);
        const endChar = Math.floor((i + maxTokensPerChunk) * charsPerToken);
        chunks.push(text.slice(startChar, endChar));
      }

      i += maxTokensPerChunk - overlap;
    }

    return chunks;
  }

  /**
   * Estimate cost for a given token count
   */
  estimateCost(
    inputTokens: number,
    outputTokens: number,
    model?: string
  ): { inputCost: number; outputCost: number; totalCost: number } | null {
    const targetModel = model || this.options.defaultModel;
    const config = this.getModelConfig(targetModel);

    if (!config.inputCostPer1K || !config.outputCostPer1K) {
      return null;
    }

    const inputCost = (inputTokens / 1000) * config.inputCostPer1K;
    const outputCost = (outputTokens / 1000) * config.outputCostPer1K;

    return {
      inputCost,
      outputCost,
      totalCost: inputCost + outputCost
    };
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    hits: number;
    misses: number;
    hitRate: number;
  } {
    const total = this.cacheHits + this.cacheMisses;
    return {
      size: this.cache.size,
      hits: this.cacheHits,
      misses: this.cacheMisses,
      hitRate: total > 0 ? this.cacheHits / total : 0
    };
  }

  /**
   * Clear the token cache
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  /**
   * Free all encoder resources
   */
  dispose(): void {
    Array.from(this.encoders.values()).forEach(encoder => {
      encoder.free();
    });
    this.encoders.clear();
    this.cache.clear();
  }
}

/**
 * Singleton instance for convenience
 */
let defaultInstance: TokenCounter | null = null;

/**
 * Get the default TokenCounter instance
 */
export function getTokenCounter(): TokenCounter {
  if (!defaultInstance) {
    defaultInstance = new TokenCounter();
  }
  return defaultInstance;
}

/**
 * Quick token count using default instance
 */
export function countTokens(text: string, model?: string): number {
  return getTokenCounter().count(text, model).count;
}

/**
 * Quick token estimate using default instance
 */
export function estimateTokens(text: string, model?: string): number {
  return getTokenCounter().estimate(text, model).count;
}

export default TokenCounter;
