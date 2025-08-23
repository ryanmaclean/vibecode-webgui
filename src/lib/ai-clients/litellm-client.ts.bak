// LiteLLM Client for VibeCode AI Platform
// =====================================

import { EventEmitter } from 'events';

// Types and Interfaces
interface LiteLLMConfig {
  baseUrl: string;
  apiKey: string;
  defaultModel?: string;
  timeout?: number;
  maxRetries?: number;
  enableLogging?: boolean;
  enableCaching?: boolean;
  userAgent?: string;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'function';
  content: string;
  name?: string;
  function_call?: any;
}

interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string | string[];
  stream?: boolean;
  functions?: any[];
  function_call?: any;
  user?: string;
  metadata?: Record<string, any>;
}

interface ChatCompletionResponse {
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
  cost?: {
    input_cost: number;
    output_cost: number;
    total_cost: number;
  };
}

interface EmbeddingRequest {
  model: string;
  input: string | string[];
  user?: string;
  encoding_format?: 'float' | 'base64';
  dimensions?: number;
}

interface EmbeddingResponse {
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
  cost?: {
    total_cost: number;
  };
}

interface ModelInfo {
  id: string;
  object: string;
  created: number;
  owned_by: string;
  provider: string;
  mode: string;
  supports_function_calling: boolean;
  supports_vision: boolean;
  input_cost_per_token?: number;
  output_cost_per_token?: number;
}

interface UsageStats {
  requests_total: number;
  tokens_total: number;
  cost_total: number;
  errors_total: number;
  latency_avg: number;
  cache_hit_ratio: number;
  top_models: Array<{
    model: string;
    requests: number;
    cost: number;
  }>;
}

interface BudgetInfo {
  remaining_budget: number;
  budget_limit: number;
  spend_today: number;
  spend_this_month: number;
  alerts_enabled: boolean;
}

interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  models: number;
  uptime: number;
  version: string;
  database: boolean;
  redis: boolean;
}

// Main LiteLLM Client Class
export class LiteLLMClient extends EventEmitter {
  private config: LiteLLMConfig;
  private requestCount: number = 0;
  private totalCost: number = 0;
  private errorCount: number = 0;

  constructor(config: LiteLLMConfig) {
    super();
    this.config = {
      timeout: 60000,
      maxRetries: 3,
      enableLogging: true,
      enableCaching: false,
      defaultModel: 'gpt-4o-mini',
      userAgent: 'VibeCode-LiteLLM-Client/1.0.0',
      ...config
    };

    if (this.config.enableLogging) {
      this.setupLogging();
    }
  }

  // Chat Completions
  async createChatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const startTime = Date.now();
    this.requestCount++;

    try {
      const response = await this.makeRequest('/chat/completions', {
        method: 'POST',
        body: JSON.stringify({
          ...request,
          model: request.model || this.config.defaultModel,
          stream: false
        })
      });

      const data = await response.json();
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Track costs
      if (data.cost) {
        this.totalCost += data.cost.total_cost;
      }

      // Emit events for monitoring
      this.emit('chat_completion', {
        request,
        response: data,
        duration,
        cost: data.cost
      });

      if (this.config.enableLogging) {
        console.log(`[LiteLLM] Chat completion: ${request.model}, ${duration}ms, $${data.cost?.total_cost?.toFixed(6) || '0'}`);
      }

      return data;
    } catch (error) {
      this.errorCount++;
      this.emit('error', {
        type: 'chat_completion_error',
        request,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      });
      throw error;
    }
  }

  // Streaming Chat Completions
  async createChatCompletionStream(
    request: ChatCompletionRequest,
    onChunk: (chunk: any) => void
  ): Promise<void> {
    const startTime = Date.now();
    this.requestCount++;

    try {
      const response = await this.makeRequest('/chat/completions', {
        method: 'POST',
        body: JSON.stringify({
          ...request,
          model: request.model || this.config.defaultModel,
          stream: true
        })
      });

      if (!response.body) {
        throw new Error('Response body is null');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              const duration = Date.now() - startTime;
              this.emit('stream_complete', {
                request,
                duration
              });
              return;
            }

            try {
              const chunk = JSON.parse(data);
              onChunk(chunk);
            } catch (e) {
              // Ignore invalid JSON chunks
            }
          }
        }
      }
    } catch (error) {
      this.errorCount++;
      this.emit('error', {
        type: 'stream_error',
        request,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      });
      throw error;
    }
  }

  // Embeddings
  async createEmbedding(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    const startTime = Date.now();
    this.requestCount++;

    try {
      const response = await this.makeRequest('/embeddings', {
        method: 'POST',
        body: JSON.stringify(request)
      });

      const data = await response.json();
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Track costs
      if (data.cost) {
        this.totalCost += data.cost.total_cost;
      }

      this.emit('embedding_created', {
        request,
        response: data,
        duration,
        cost: data.cost
      });

      if (this.config.enableLogging) {
        console.log(`[LiteLLM] Embedding: ${request.model}, ${duration}ms, $${data.cost?.total_cost?.toFixed(6) || '0'}`);
      }

      return data;
    } catch (error) {
      this.errorCount++;
      this.emit('error', {
        type: 'embedding_error',
        request,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      });
      throw error;
    }
  }

  // Model Management
  async listModels(): Promise<{ data: ModelInfo[] }> {
    try {
      const response = await this.makeRequest('/models');
      const data = await response.json();

      this.emit('models_listed', {
        models: data.data,
        count: data.data.length
      });

      return data;
    } catch (error) {
      this.emit('error', {
        type: 'list_models_error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async getModel(modelId: string): Promise<ModelInfo> {
    try {
      const response = await this.makeRequest(`/models/${modelId}`);
      return await response.json();
    } catch (error) {
      this.emit('error', {
        type: 'get_model_error',
        modelId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  // Health and Status
  async checkHealth(): Promise<HealthStatus> {
    try {
      const response = await this.makeRequest('/health');
      const data = await response.json();

      this.emit('health_checked', {
        status: data.status,
        healthy: data.status === 'healthy'
      });

      return data;
    } catch (error) {
      this.emit('error', {
        type: 'health_check_error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  // Usage Statistics
  async getUsageStats(timeframe: string = '24h'): Promise<UsageStats> {
    try {
      const response = await this.makeRequest(`/usage/stats?timeframe=${timeframe}`);
      return await response.json();
    } catch (error) {
      this.emit('error', {
        type: 'usage_stats_error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  // Budget Information
  async getBudgetInfo(): Promise<BudgetInfo> {
    try {
      const response = await this.makeRequest('/budget');
      return await response.json();
    } catch (error) {
      this.emit('error', {
        type: 'budget_info_error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  // Configuration Management
  getConfig(): LiteLLMConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<LiteLLMConfig>): void {
    this.config = { ...this.config, ...updates };
    this.emit('config_updated', updates);
  }

  // Statistics
  getClientStats() {
    return {
      requests_total: this.requestCount,
      errors_total: this.errorCount,
      cost_total: this.totalCost,
      error_rate: this.requestCount > 0 ? this.errorCount / this.requestCount : 0,
      uptime: process.uptime()
    };
  }

  // Private Methods
  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const url = `${this.config.baseUrl}${endpoint}`;
    
    const headers = new Headers({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.apiKey}`,
      'User-Agent': this.config.userAgent || 'VibeCode-LiteLLM-Client/1.0.0',
      ...((options.headers as Record<string, string>) || {})
    });

    const requestOptions: RequestInit = {
      ...options,
      headers,
      signal: AbortSignal.timeout(this.config.timeout || 60000)
    };

    let lastError: Error;
    for (let attempt = 0; attempt <= (this.config.maxRetries || 3); attempt++) {
      try {
        const response = await fetch(url, requestOptions);

        if (!response.ok) {
          const errorData = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorData}`);
        }

        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (attempt < (this.config.maxRetries || 3)) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, delay));
          
          this.emit('retry', {
            attempt: attempt + 1,
            maxRetries: this.config.maxRetries || 3,
            delay,
            error: lastError.message
          });
        }
      }
    }

    throw lastError!;
  }

  private setupLogging(): void {
    this.on('chat_completion', (data) => {
      console.log(`[LiteLLM] Chat completion completed: ${data.request.model}`);
    });

    this.on('embedding_created', (data) => {
      console.log(`[LiteLLM] Embedding created: ${data.request.model}`);
    });

    this.on('error', (data) => {
      console.error(`[LiteLLM] Error: ${data.type} - ${data.error}`);
    });

    this.on('retry', (data) => {
      console.warn(`[LiteLLM] Retrying request (attempt ${data.attempt}/${data.maxRetries}): ${data.error}`);
    });
  }

  // Utility Methods
  formatCost(cost: number): string {
    return `$${cost.toFixed(6)}`;
  }

  formatTokens(tokens: number): string {
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(1)}M`;
    } else if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}K`;
    }
    return tokens.toString();
  }

  // Cleanup
  destroy(): void {
    this.removeAllListeners();
  }
}

// Export types for external use
export type {
  LiteLLMConfig,
  ChatMessage,
  ChatCompletionRequest,
  ChatCompletionResponse,
  EmbeddingRequest,
  EmbeddingResponse,
  ModelInfo,
  UsageStats,
  BudgetInfo,
  HealthStatus
}; 