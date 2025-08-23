/**
 * LiteLLM Unified AI Client
 * Provides a single interface to multiple AI models through LiteLLM proxy
 */

import { cache, CacheKeys, CacheTTL } from '../cache/valkey-client';
import { trackAIOperation } from '../performance/metrics-collector';
import { logAIRequest } from '../prisma';

export interface LiteLLMConfig {
  baseURL: string;
  apiKey: string;
  defaultModel: string;
  timeout: number;
  maxRetries: number;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'function';
  content: string;
  name?: string;
  function_call?: any;
}

export interface ChatCompletionRequest {
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stream?: boolean;
  stop?: string[];
  user?: string;
  functions?: any[];
  function_call?: any;
}

export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: ChatMessage;
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  cost?: number;
  response_time_ms?: number;
}

export interface EmbeddingRequest {
  input: string | string[];
  model?: string;
  user?: string;
  encoding_format?: 'float' | 'base64';
  dimensions?: number;
}

export interface EmbeddingResponse {
  object: string;
  data: Array<{
    object: string;
    embedding: number[];
    index: number;
  }>;
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
  cost?: number;
}

/**
 * Model capabilities and metadata
 */
export interface ModelInfo {
  name: string;
  provider: string;
  maxTokens: number;
  supportsStreaming: boolean;
  supportsFunctionCalling: boolean;
  supportsVision: boolean;
  costPerInputToken: number;
  costPerOutputToken: number;
  category: 'chat' | 'embedding' | 'code' | 'vision';
  quality: 'premium' | 'standard' | 'economy';
}

/**
 * LiteLLM Unified Client
 */
export class LiteLLMClient {
  private config: LiteLLMConfig;
  private modelCache = new Map<string, ModelInfo>();

  constructor(config?: Partial<LiteLLMConfig>) {
    this.config = {
      baseURL: process.env.LITELLM_BASE_URL || 'http://localhost:4000',
      apiKey: process.env.LITELLM_API_KEY || 'sk-1234',
      defaultModel: 'gpt-4o-mini',
      timeout: 60000,
      maxRetries: 3,
      ...config
    };
  }

  /**
   * Chat completion with intelligent model routing
   */
  async chatCompletion(
    request: ChatCompletionRequest,
    userId?: string,
    projectId?: number
  ): Promise<ChatCompletionResponse> {
    const startTime = Date.now();
    const model = request.model || this.config.defaultModel;
    
    // Check cache for identical requests
    const cacheKey = this.getCacheKey('chat', {
      model,
      messages: request.messages,
      temperature: request.temperature,
      max_tokens: request.max_tokens
    });

    const cached = await cache.get<ChatCompletionResponse>(cacheKey);
    if (cached && !request.stream) {
      trackAIOperation('openai', model, 'chat_completion', Date.now() - startTime, {
        input: cached.usage.prompt_tokens,
        output: cached.usage.completion_tokens
      }, cached.cost);
      
      return cached;
    }

    try {
      const response = await this.makeRequest<ChatCompletionResponse>('/chat/completions', {
        method: 'POST',
        body: JSON.stringify({
          ...request,
          model,
          user: userId || 'anonymous'
        })
      });

      const duration = Date.now() - startTime;
      response.response_time_ms = duration;

      // Calculate cost if not provided
      if (!response.cost && response.usage) {
        const modelInfo = await this.getModelInfo(model);
        response.cost = this.calculateCost(response.usage, modelInfo);
      }

      // Cache response for non-streaming requests
      if (!request.stream && response.choices[0]?.finish_reason === 'stop') {
        await cache.set(cacheKey, response, CacheTTL.HOUR);
      }

      // Log to database
      if (userId && projectId) {
        await this.logAIRequest({
          userId: parseInt(userId),
          projectId,
          requestType: 'chat_completion',
          prompt: JSON.stringify(request.messages.slice(-1)[0]?.content || ''),
          model,
          provider: 'litellm',
          inputTokens: response.usage.prompt_tokens,
          outputTokens: response.usage.completion_tokens,
          cost: response.cost,
          durationMs: duration,
          status: 'completed',
          response: response.choices[0]?.message
        });
      }

      // Track performance metrics
      trackAIOperation('litellm', model, 'chat_completion', duration, {
        input: response.usage.prompt_tokens,
        output: response.usage.completion_tokens
      }, response.cost);

      return response;

    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Log failed request
      if (userId && projectId) {
        await this.logAIRequest({
          userId: parseInt(userId),
          projectId,
          requestType: 'chat_completion',
          prompt: JSON.stringify(request.messages.slice(-1)[0]?.content || ''),
          model,
          provider: 'litellm',
          durationMs: duration,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      throw this.handleError(error);
    }
  }

  /**
   * Generate embeddings with caching
   */
  async createEmbedding(
    request: EmbeddingRequest,
    userId?: string
  ): Promise<EmbeddingResponse> {
    const startTime = Date.now();
    const model = request.model || 'text-embedding-3-small';
    const input = Array.isArray(request.input) ? request.input : [request.input];

    // Check cache for embeddings
    const cachePromises = input.map(text => {
      const contentHash = this.hashContent(text);
      return cache.get<number[]>(CacheKeys.embeddings(contentHash));
    });

    const cachedEmbeddings = await Promise.all(cachePromises);
    const uncachedIndices: number[] = [];
    const uncachedTexts: string[] = [];

    cachedEmbeddings.forEach((cached, index) => {
      if (!cached) {
        uncachedIndices.push(index);
        uncachedTexts.push(input[index]);
      }
    });

    let response: EmbeddingResponse;

    if (uncachedTexts.length > 0) {
      // Generate embeddings for uncached texts
      response = await this.makeRequest<EmbeddingResponse>('/embeddings', {
        method: 'POST',
        body: JSON.stringify({
          ...request,
          input: uncachedTexts,
          model,
          user: userId || 'anonymous'
        })
      });

      // Cache new embeddings
      const cachePromises = response.data.map((item, responseIndex) => {
        const originalIndex = uncachedIndices[responseIndex];
        const contentHash = this.hashContent(input[originalIndex]);
        return cache.set(CacheKeys.embeddings(contentHash), item.embedding, CacheTTL.EMBEDDINGS);
      });

      await Promise.all(cachePromises);
    } else {
      // All embeddings were cached
      response = {
        object: 'list',
        data: cachedEmbeddings.map((embedding, index) => ({
          object: 'embedding',
          embedding: embedding!,
          index
        })),
        model,
        usage: {
          prompt_tokens: input.join(' ').length / 4, // Rough estimate
          total_tokens: input.join(' ').length / 4
        }
      };
    }

    const duration = Date.now() - startTime;

    // Calculate cost
    const modelInfo = await this.getModelInfo(model);
    response.cost = this.calculateCost(response.usage, modelInfo);

    // Track performance
    trackAIOperation('litellm', model, 'embedding', duration, {
      input: response.usage.prompt_tokens,
      output: 0
    }, response.cost);

    return response;
  }

  /**
   * Get available models from LiteLLM proxy
   */
  async getModels(): Promise<ModelInfo[]> {
    try {
      const response = await this.makeRequest<{ data: any[] }>('/models');
      
      return response.data.map(model => ({
        name: model.id,
        provider: this.extractProvider(model.id),
        maxTokens: model.max_tokens || 4096,
        supportsStreaming: model.supports_streaming || false,
        supportsFunctionCalling: model.supports_function_calling || false,
        supportsVision: model.supports_vision || false,
        costPerInputToken: model.input_cost_per_token || 0,
        costPerOutputToken: model.output_cost_per_token || 0,
        category: this.categorizeModel(model.id),
        quality: this.assessModelQuality(model.id)
      }));
    } catch (error) {
      console.error('Failed to fetch models:', error);
      return this.getFallbackModels();
    }
  }

  /**
   * Get model information with caching
   */
  async getModelInfo(modelName: string): Promise<ModelInfo> {
    if (this.modelCache.has(modelName)) {
      return this.modelCache.get(modelName)!;
    }

    const models = await this.getModels();
    const model = models.find(m => m.name === modelName);
    
    if (model) {
      this.modelCache.set(modelName, model);
      return model;
    }

    // Fallback model info
    const fallback: ModelInfo = {
      name: modelName,
      provider: 'unknown',
      maxTokens: 4096,
      supportsStreaming: false,
      supportsFunctionCalling: false,
      supportsVision: false,
      costPerInputToken: 0.00001,
      costPerOutputToken: 0.00003,
      category: 'chat',
      quality: 'standard'
    };

    this.modelCache.set(modelName, fallback);
    return fallback;
  }

  /**
   * Stream chat completion
   */
  async streamChatCompletion(
    request: ChatCompletionRequest,
    onChunk: (chunk: any) => void,
    userId?: string,
    projectId?: number
  ): Promise<void> {
    const startTime = Date.now();
    const model = request.model || this.config.defaultModel;

    try {
      const response = await fetch(`${this.config.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify({
          ...request,
          model,
          stream: true,
          user: userId || 'anonymous'
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Stream not available');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let totalTokens = 0;
      let responseContent = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;

              try {
                const chunk = JSON.parse(data);
                onChunk(chunk);

                // Track tokens and content
                if (chunk.choices?.[0]?.delta?.content) {
                  responseContent += chunk.choices[0].delta.content;
                }
                if (chunk.usage) {
                  totalTokens = chunk.usage.total_tokens;
                }
              } catch (parseError) {
                console.warn('Failed to parse SSE chunk:', parseError);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      const duration = Date.now() - startTime;

      // Log streaming request
      if (userId && projectId && responseContent) {
        await this.logAIRequest({
          userId: parseInt(userId),
          projectId,
          requestType: 'chat_completion_stream',
          prompt: JSON.stringify(request.messages.slice(-1)[0]?.content || ''),
          model,
          provider: 'litellm',
          outputTokens: totalTokens,
          durationMs: duration,
          status: 'completed',
          response: { content: responseContent }
        });
      }

      trackAIOperation('litellm', model, 'chat_completion_stream', duration, {
        input: 0, // Will be updated when final usage is available
        output: totalTokens
      });

    } catch (error) {
      const duration = Date.now() - startTime;

      if (userId && projectId) {
        await this.logAIRequest({
          userId: parseInt(userId),
          projectId,
          requestType: 'chat_completion_stream',
          prompt: JSON.stringify(request.messages.slice(-1)[0]?.content || ''),
          model,
          provider: 'litellm',
          durationMs: duration,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      throw this.handleError(error);
    }
  }

  /**
   * Get usage statistics and costs
   */
  async getUsageStats(userId?: string, timeframe = '24h'): Promise<{
    requests: number;
    tokens: { input: number; output: number; total: number };
    cost: number;
    models: Record<string, { requests: number; tokens: number; cost: number }>;
  }> {
    try {
      const params = new URLSearchParams({
        user_id: userId || '',
        timeframe
      });

      const response = await this.makeRequest<any>(`/usage?${params}`);
      return response;
    } catch (error) {
      console.error('Failed to get usage stats:', error);
      return {
        requests: 0,
        tokens: { input: 0, output: 0, total: 0 },
        cost: 0,
        models: {}
      };
    }
  }

  /**
   * Health check for LiteLLM proxy
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    models: Record<string, 'healthy' | 'unhealthy'>;
    latency: number;
  }> {
    const startTime = Date.now();

    try {
      const response = await this.makeRequest<any>('/health');
      const latency = Date.now() - startTime;

      return {
        status: response.status || 'healthy',
        models: response.models || {},
        latency
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        models: {},
        latency: Date.now() - startTime
      };
    }
  }

  // Private helper methods

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.config.baseURL}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
        ...options.headers
      },
      signal: AbortSignal.timeout(this.config.timeout)
    });

    if (!response.ok) {
      throw new Error(`LiteLLM API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  private getCacheKey(operation: string, params: any): string {
    const hash = this.hashContent(JSON.stringify(params));
    return `litellm:${operation}:${hash}`;
  }

  private hashContent(content: string): string {
    // Simple hash function for cache keys
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  private calculateCost(usage: { prompt_tokens: number; completion_tokens?: number }, model: ModelInfo): number {
    const inputCost = usage.prompt_tokens * model.costPerInputToken;
    const outputCost = (usage.completion_tokens || 0) * model.costPerOutputToken;
    return inputCost + outputCost;
  }

  private extractProvider(modelName: string): string {
    if (modelName.includes('gpt') || modelName.includes('openai')) return 'openai';
    if (modelName.includes('claude') || modelName.includes('anthropic')) return 'anthropic';
    if (modelName.includes('llama') || modelName.includes('ollama')) return 'ollama';
    return 'unknown';
  }

  private categorizeModel(modelName: string): 'chat' | 'embedding' | 'code' | 'vision' {
    if (modelName.includes('embedding')) return 'embedding';
    if (modelName.includes('code') || modelName.includes('coder')) return 'code';
    if (modelName.includes('vision') || modelName.includes('4o')) return 'vision';
    return 'chat';
  }

  private assessModelQuality(modelName: string): 'premium' | 'standard' | 'economy' {
    if (modelName.includes('gpt-4') || modelName.includes('claude-3.5-sonnet')) return 'premium';
    if (modelName.includes('mini') || modelName.includes('haiku') || modelName.includes('llama')) return 'economy';
    return 'standard';
  }

  private getFallbackModels(): ModelInfo[] {
    return [
      {
        name: 'gpt-4o-mini',
        provider: 'openai',
        maxTokens: 128000,
        supportsStreaming: true,
        supportsFunctionCalling: true,
        supportsVision: true,
        costPerInputToken: 0.00000015,
        costPerOutputToken: 0.0000006,
        category: 'chat',
        quality: 'economy'
      },
      {
        name: 'claude-3.5-haiku',
        provider: 'anthropic',
        maxTokens: 200000,
        supportsStreaming: true,
        supportsFunctionCalling: true,
        supportsVision: true,
        costPerInputToken: 0.00000025,
        costPerOutputToken: 0.00000125,
        category: 'chat',
        quality: 'economy'
      }
    ];
  }

  private async logAIRequest(data: {
    userId: number;
    projectId?: number;
    requestType: string;
    prompt: string;
    model: string;
    provider: string;
    inputTokens?: number;
    outputTokens?: number;
    cost?: number;
    durationMs: number;
    status: string;
    response?: any;
    error?: string;
  }) {
    try {
      await logAIRequest({
        user_id: data.userId,
        project_id: data.projectId,
        request_type: data.requestType,
        prompt: data.prompt,
        model: data.model,
        provider: data.provider,
        input_tokens: data.inputTokens,
        output_tokens: data.outputTokens,
        cost: data.cost,
        duration_ms: data.durationMs,
        status: data.status,
        response: data.response,
        error: data.error
      });
    } catch (error) {
      console.error('Failed to log AI request:', error);
    }
  }

  private handleError(error: any): Error {
    if (error instanceof Error) {
      return error;
    }
    
    return new Error(`LiteLLM request failed: ${JSON.stringify(error)}`);
  }
}

// Export singleton instance
export const litellmClient = new LiteLLMClient();

export default litellmClient;