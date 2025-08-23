/**
 * Enhanced AI Model Client
 * Supports multiple AI providers for VibeCode platform
 * 
 * Providers supported:
 * - OpenRouter (primary)
 * - Azure OpenAI (enterprise)
 * - Anthropic Claude (direct)
 * - Local models (Ollama)
 * - Google Gemini
 * - AWS Bedrock
 */

import { OpenAI } from 'openai';

export type AIProvider = 'openrouter' | 'azure-openai' | 'anthropic' | 'ollama' | 'gemini' | 'bedrock';

export interface AIModelConfig {
  provider: AIProvider;
  model: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  apiKey?: string;
  endpoint?: string;
  region?: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionResponse {
  id: string;
  content: string;
  model: string;
  provider: AIProvider;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason: string;
  metadata?: Record<string, any>;
}

export interface EmbeddingResponse {
  embeddings: number[][];
  model: string;
  provider: AIProvider;
  usage: {
    promptTokens: number;
    totalTokens: number;
  };
}

/**
 * Enhanced AI Model Client with multi-provider support
 */
export class EnhancedAIClient {
  private defaultConfig: AIModelConfig;
  private clients: Map<AIProvider, any> = new Map();

  constructor(defaultConfig: AIModelConfig) {
    this.defaultConfig = defaultConfig;
    this.initializeClients();
  }

  /**
   * Initialize clients for all configured providers
   */
  private initializeClients() {
    // OpenRouter client
    if (process.env.OPENROUTER_API_KEY) {
      this.clients.set('openrouter', new OpenAI({
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: process.env.OPENROUTER_API_KEY,
        defaultHeaders: {
          'HTTP-Referer': process.env.NEXTAUTH_URL || 'http://localhost:3000',
          'X-Title': 'VibeCode WebGUI'
        }
      }));
    }

    // Azure OpenAI client
    if (process.env.AZURE_OPENAI_API_KEY) {
      this.clients.set('azure-openai', new OpenAI({
        baseURL: `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT}`,
        apiKey: process.env.AZURE_OPENAI_API_KEY,
        defaultQuery: { 'api-version': process.env.AZURE_OPENAI_API_VERSION || '2024-02-01' },
        defaultHeaders: {
          'api-key': process.env.AZURE_OPENAI_API_KEY
        }
      }));
    }

    // Anthropic client (direct)
    if (process.env.ANTHROPIC_API_KEY) {
      // Note: Using OpenAI-compatible wrapper for consistency
      this.clients.set('anthropic', new OpenAI({
        baseURL: 'https://api.anthropic.com/v1',
        apiKey: process.env.ANTHROPIC_API_KEY,
        defaultHeaders: {
          'anthropic-version': '2023-06-01'
        }
      }));
    }

    // Ollama client (local models)
    if (process.env.OLLAMA_ENDPOINT) {
      this.clients.set('ollama', new OpenAI({
        baseURL: `${process.env.OLLAMA_ENDPOINT}/v1`,
        apiKey: 'ollama' // Ollama doesn't require real API key
      }));
    }

    // Google Gemini client
    if (process.env.GOOGLE_AI_API_KEY) {
      // Note: This would need a custom implementation or wrapper
      // For now, we'll prepare the structure
      this.clients.set('gemini', {
        apiKey: process.env.GOOGLE_AI_API_KEY,
        endpoint: 'https://generativelanguage.googleapis.com/v1'
      });
    }

    // AWS Bedrock client
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      this.clients.set('bedrock', {
        region: process.env.AWS_REGION || 'us-east-1',
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      });
    }
  }

  /**
   * Get available models for a provider
   */
  async getAvailableModels(provider: AIProvider): Promise<string[]> {
    switch (provider) {
      case 'openrouter':
        return [
          'anthropic/claude-3.5-sonnet',
          'anthropic/claude-3-haiku',
          'openai/gpt-4o',
          'openai/gpt-4-turbo',
          'openai/gpt-3.5-turbo',
          'meta-llama/llama-3.1-405b-instruct',
          'google/gemini-pro-1.5',
          'mistralai/mistral-large-2407'
        ];

      case 'azure-openai':
        return [
          'gpt-4o',
          'gpt-4-turbo',
          'gpt-35-turbo',
          'text-embedding-ada-002',
          'dall-e-3'
        ];

      case 'anthropic':
        return [
          'claude-3-5-sonnet-20241022',
          'claude-3-haiku-20240307',
          'claude-3-opus-20240229'
        ];

      case 'ollama':
        // Would query Ollama API for available models
        return [
          'llama3.1:8b',
          'llama3.1:70b',
          'codellama:13b',
          'mistral:7b',
          'qwen2.5:14b'
        ];

      case 'gemini':
        return [
          'gemini-1.5-pro',
          'gemini-1.5-flash',
          'gemini-pro'
        ];

      case 'bedrock':
        return [
          'anthropic.claude-3-sonnet-20240229-v1:0',
          'anthropic.claude-3-haiku-20240307-v1:0',
          'meta.llama3-1-405b-instruct-v1:0',
          'amazon.titan-text-premier-v1:0'
        ];

      default:
        return [];
    }
  }

  /**
   * Chat completion with automatic provider selection and fallback
   */
  async createChatCompletion(
    messages: ChatMessage[],
    config?: Partial<AIModelConfig>
  ): Promise<ChatCompletionResponse> {
    const finalConfig = { ...this.defaultConfig, ...config };
    
    try {
      return await this.createChatCompletionWithProvider(messages, finalConfig);
    } catch (error) {
      console.warn(`Primary provider ${finalConfig.provider} failed:`, error);
      
      // Fallback strategy
      const fallbackProviders = this.getFallbackProviders(finalConfig.provider);
      
      for (const fallbackProvider of fallbackProviders) {
        try {
          console.log(`Trying fallback provider: ${fallbackProvider}`);
          const fallbackConfig = { ...finalConfig, provider: fallbackProvider };
          return await this.createChatCompletionWithProvider(messages, fallbackConfig);
        } catch (fallbackError) {
          console.warn(`Fallback provider ${fallbackProvider} failed:`, fallbackError);
          continue;
        }
      }
      
      throw new Error(`All providers failed. Last error: ${error.message}`);
    }
  }

  /**
   * Create chat completion with specific provider
   */
  private async createChatCompletionWithProvider(
    messages: ChatMessage[],
    config: AIModelConfig
  ): Promise<ChatCompletionResponse> {
    const client = this.clients.get(config.provider);
    
    if (!client) {
      throw new Error(`Provider ${config.provider} not configured`);
    }

    switch (config.provider) {
      case 'openrouter':
      case 'azure-openai':
        return await this.handleOpenAICompatible(client, messages, config);
      
      case 'anthropic':
        return await this.handleAnthropic(client, messages, config);
      
      case 'ollama':
        return await this.handleOllama(client, messages, config);
      
      case 'gemini':
        return await this.handleGemini(client, messages, config);
      
      case 'bedrock':
        return await this.handleBedrock(client, messages, config);
      
      default:
        throw new Error(`Unsupported provider: ${config.provider}`);
    }
  }

  /**
   * Handle OpenAI-compatible APIs (OpenRouter, Azure OpenAI)
   */
  private async handleOpenAICompatible(
    client: OpenAI,
    messages: ChatMessage[],
    config: AIModelConfig
  ): Promise<ChatCompletionResponse> {
    const response = await client.chat.completions.create({
      model: config.model,
      messages: messages as any,
      max_tokens: config.maxTokens || 4000,
      temperature: config.temperature || 0.7,
      top_p: config.topP || 1.0
    });

    const choice = response.choices[0];
    
    return {
      id: response.id,
      content: choice.message.content || '',
      model: response.model,
      provider: config.provider,
      usage: {
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0
      },
      finishReason: choice.finish_reason || 'stop',
      metadata: {
        systemFingerprint: response.system_fingerprint,
        created: response.created
      }
    };
  }

  /**
   * Handle Anthropic Claude API
   */
  private async handleAnthropic(
    client: any,
    messages: ChatMessage[],
    config: AIModelConfig
  ): Promise<ChatCompletionResponse> {
    // Convert messages to Anthropic format
    const anthropicMessages = messages.map(msg => ({
      role: msg.role === 'system' ? 'user' : msg.role,
      content: msg.content
    }));

    // System messages need special handling in Anthropic
    const systemMessage = messages.find(m => m.role === 'system');
    
    const requestBody = {
      model: config.model,
      max_tokens: config.maxTokens || 4000,
      temperature: config.temperature || 0.7,
      messages: anthropicMessages,
      ...(systemMessage && { system: systemMessage.content })
    };

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': client.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      id: data.id,
      content: data.content[0]?.text || '',
      model: data.model,
      provider: 'anthropic',
      usage: {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        totalTokens: data.usage.input_tokens + data.usage.output_tokens
      },
      finishReason: data.stop_reason || 'stop',
      metadata: {
        type: data.type,
        role: data.role
      }
    };
  }

  /**
   * Handle Ollama local models
   */
  private async handleOllama(
    client: OpenAI,
    messages: ChatMessage[],
    config: AIModelConfig
  ): Promise<ChatCompletionResponse> {
    const response = await client.chat.completions.create({
      model: config.model,
      messages: messages as any,
      max_tokens: config.maxTokens || 4000,
      temperature: config.temperature || 0.7,
      stream: false
    });

    const choice = response.choices[0];
    
    return {
      id: response.id || `ollama-${Date.now()}`,
      content: choice.message.content || '',
      model: config.model,
      provider: 'ollama',
      usage: {
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0
      },
      finishReason: choice.finish_reason || 'stop',
      metadata: {
        localModel: true,
        endpoint: process.env.OLLAMA_ENDPOINT
      }
    };
  }

  /**
   * Handle Google Gemini API
   */
  private async handleGemini(
    client: any,
    messages: ChatMessage[],
    config: AIModelConfig
  ): Promise<ChatCompletionResponse> {
    // Convert messages to Gemini format
    const contents = messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    const requestBody = {
      contents,
      generationConfig: {
        maxOutputTokens: config.maxTokens || 4000,
        temperature: config.temperature || 0.7,
        topP: config.topP || 1.0
      }
    };

    const response = await fetch(
      `${client.endpoint}/models/${config.model}:generateContent?key=${client.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.statusText}`);
    }

    const data = await response.json();
    const candidate = data.candidates[0];
    
    return {
      id: `gemini-${Date.now()}`,
      content: candidate.content.parts[0].text,
      model: config.model,
      provider: 'gemini',
      usage: {
        promptTokens: data.usageMetadata?.promptTokenCount || 0,
        completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: data.usageMetadata?.totalTokenCount || 0
      },
      finishReason: candidate.finishReason || 'STOP',
      metadata: {
        safetyRatings: candidate.safetyRatings
      }
    };
  }

  /**
   * Handle AWS Bedrock
   */
  private async handleBedrock(
    client: any,
    messages: ChatMessage[],
    config: AIModelConfig
  ): Promise<ChatCompletionResponse> {
    // This would require AWS SDK integration
    // For now, we'll throw an error indicating it needs implementation
    throw new Error('AWS Bedrock integration requires AWS SDK implementation');
  }

  /**
   * Create embeddings with provider selection
   */
  async createEmbedding(
    input: string | string[],
    config?: Partial<AIModelConfig>
  ): Promise<EmbeddingResponse> {
    const finalConfig = { ...this.defaultConfig, ...config };
    
    // Default to embedding-specific models
    if (!finalConfig.model.includes('embedding')) {
      switch (finalConfig.provider) {
        case 'openrouter':
          finalConfig.model = 'text-embedding-ada-002';
          break;
        case 'azure-openai':
          finalConfig.model = 'text-embedding-ada-002';
          break;
        default:
          finalConfig.model = 'text-embedding-ada-002';
      }
    }

    const client = this.clients.get(finalConfig.provider);
    
    if (!client) {
      throw new Error(`Provider ${finalConfig.provider} not configured for embeddings`);
    }

    const response = await client.embeddings.create({
      model: finalConfig.model,
      input: input
    });

    return {
      embeddings: response.data.map((item: any) => item.embedding),
      model: response.model,
      provider: finalConfig.provider,
      usage: {
        promptTokens: response.usage.prompt_tokens,
        totalTokens: response.usage.total_tokens
      }
    };
  }

  /**
   * Get fallback providers for high availability
   */
  private getFallbackProviders(primaryProvider: AIProvider): AIProvider[] {
    const fallbackMap: Record<AIProvider, AIProvider[]> = {
      'openrouter': ['azure-openai', 'anthropic', 'ollama'],
      'azure-openai': ['openrouter', 'anthropic'],
      'anthropic': ['openrouter', 'azure-openai'],
      'ollama': ['openrouter', 'azure-openai'],
      'gemini': ['openrouter', 'azure-openai'],
      'bedrock': ['openrouter', 'azure-openai']
    };

    return fallbackMap[primaryProvider] || [];
  }

  /**
   * Check provider health and availability
   */
  async checkProviderHealth(provider: AIProvider): Promise<{
    available: boolean;
    latency?: number;
    error?: string;
  }> {
    const client = this.clients.get(provider);
    
    if (!client) {
      return { available: false, error: 'Provider not configured' };
    }

    try {
      const startTime = Date.now();
      
      // Simple health check with minimal token usage
      await this.createChatCompletion(
        [{ role: 'user', content: 'Hello' }],
        { provider, model: await this.getDefaultModel(provider), maxTokens: 1 }
      );
      
      const latency = Date.now() - startTime;
      
      return { available: true, latency };
    } catch (error) {
      return { 
        available: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Get default model for a provider
   */
  private async getDefaultModel(provider: AIProvider): Promise<string> {
    const models = await this.getAvailableModels(provider);
    return models[0] || 'gpt-3.5-turbo';
  }

  /**
   * Get provider statistics and costs
   */
  getProviderStats(): Record<AIProvider, {
    configured: boolean;
    models: number;
    estimatedCostPer1kTokens: number;
  }> {
    return {
      'openrouter': {
        configured: this.clients.has('openrouter'),
        models: 8,
        estimatedCostPer1kTokens: 0.002
      },
      'azure-openai': {
        configured: this.clients.has('azure-openai'),
        models: 5,
        estimatedCostPer1kTokens: 0.001
      },
      'anthropic': {
        configured: this.clients.has('anthropic'),
        models: 3,
        estimatedCostPer1kTokens: 0.003
      },
      'ollama': {
        configured: this.clients.has('ollama'),
        models: 5,
        estimatedCostPer1kTokens: 0.0 // Local models are free
      },
      'gemini': {
        configured: this.clients.has('gemini'),
        models: 3,
        estimatedCostPer1kTokens: 0.0015
      },
      'bedrock': {
        configured: this.clients.has('bedrock'),
        models: 4,
        estimatedCostPer1kTokens: 0.0025
      }
    };
  }
}

/**
 * Create enhanced AI client with environment-based configuration
 */
export function createEnhancedAIClient(): EnhancedAIClient {
  const defaultConfig: AIModelConfig = {
    provider: (process.env.AI_DEFAULT_PROVIDER as AIProvider) || 'openrouter',
    model: process.env.AI_DEFAULT_MODEL || 'anthropic/claude-3.5-sonnet',
    maxTokens: parseInt(process.env.AI_MAX_TOKENS || '4000'),
    temperature: parseFloat(process.env.AI_TEMPERATURE || '0.7')
  };

  return new EnhancedAIClient(defaultConfig);
}

// Export singleton instance
export const enhancedAI = createEnhancedAIClient(); 