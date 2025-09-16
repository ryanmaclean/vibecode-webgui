/**
 * AI Provider Factory
 * Creates and manages AI provider instances
 */

import { EnhancedAIManager, AIProviderConfig } from './enhanced-ai-manager';

export interface AIProvider {
  createChatCompletion: (messages: any[], options?: any) => Promise<ReadableStream>;
  createEmbedding?: (text: string) => Promise<number[]>;
  getModelInfo?: (model: string) => any;
}

export interface AIProviderOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

// Default AI provider configuration
const defaultConfig: AIProviderConfig = {
  primaryProvider: 'openrouter',
  fallbackProviders: ['azure-openai', 'anthropic'],
  models: {
    'openrouter': ['openai/gpt-4o', 'openai/gpt-4o-mini'],
    'azure-openai': ['gpt-4o', 'gpt-4o-mini'],
    'anthropic': ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022']
  },
  apiKeys: {
    openrouter: process.env.OPENROUTER_API_KEY || '',
    azureOpenai: process.env.AZURE_OPENAI_API_KEY || '',
    anthropic: process.env.ANTHROPIC_API_KEY || ''
  }
};

let aiManagerInstance: EnhancedAIManager | null = null;

/**
 * Get or create AI provider instance
 */
export function getAIProvider(options: AIProviderOptions = {}): AIProvider {
  if (!aiManagerInstance) {
    aiManagerInstance = new EnhancedAIManager(defaultConfig);
  }

  return {
    createChatCompletion: async (messages: any[], opts: any = {}) => {
      const response = await aiManagerInstance.executeWorkflow({
        messages,
        model: options.model || 'openai/gpt-4o-mini',
        temperature: options.temperature || 0.7,
        maxTokens: options.maxTokens || 1000,
        stream: options.stream || true,
        ...opts
      });

      if (response.error) {
        throw new Error(response.error);
      }

      // Convert response to ReadableStream
      return new ReadableStream({
        start(controller) {
          if (response.content) {
            controller.enqueue(response.content);
          }
          controller.close();
        }
      });
    },

    createEmbedding: async (text: string) => {
      // Implementation would depend on the embedding service
      return []; // Placeholder
    },

    getModelInfo: (model: string) => {
      return {
        model,
        provider: 'openrouter',
        maxTokens: 4000,
        supportsStreaming: true
      };
    }
  };
}

/**
 * Create a new AI provider instance with custom configuration
 */
export function createAIProvider(config: AIProviderConfig): AIProvider {
  const manager = new EnhancedAIManager(config);
  
  return {
    createChatCompletion: async (messages: any[], opts: any = {}) => {
      const response = await manager.executeWorkflow({
        messages,
        model: opts.model || 'openai/gpt-4o-mini',
        temperature: opts.temperature || 0.7,
        maxTokens: opts.maxTokens || 1000,
        stream: opts.stream || true,
        ...opts
      });

      if (response.error) {
        throw new Error(response.error);
      }

      return new ReadableStream({
        start(controller) {
          if (response.content) {
            controller.enqueue(response.content);
          }
          controller.close();
        }
      });
    },

    createEmbedding: async (text: string) => {
      return []; // Placeholder
    },

    getModelInfo: (model: string) => {
      return {
        model,
        provider: 'openrouter',
        maxTokens: 4000,
        supportsStreaming: true
      };
    }
  };
}

export default getAIProvider;
