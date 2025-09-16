/**
 * AI Provider Factory
 * Creates and manages AI provider instances
 */

import { EnhancedAIManager, AIProviderConfig } from './enhanced-ai-manager';

export interface AIProvider {
  createChatCompletion: (
    messages: Array<{ role: string; content: string }>,
    options?: AIProviderOptions
  ) => Promise<ReadableStream<Uint8Array>>;
  createEmbedding?: (text: string) => Promise<number[]>;
  getModelInfo?: (model: string) => Record<string, unknown>;
}

export interface AIProviderOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  workflowType?: 'code-generation' | 'code-review' | 'documentation' | 'custom';
}

const textEncoder = new TextEncoder();

// Default AI provider configuration aligned with EnhancedAIManager
const defaultConfig: AIProviderConfig = {
  openai: {
    apiKey:
      process.env.OPENAI_API_KEY ||
      process.env.OPENROUTER_API_KEY ||
      '',
    model: 'gpt-4o-mini',
    temperature: 0.7
  }
};

let aiManagerInstance: EnhancedAIManager | null = null;

function ensureManager(): EnhancedAIManager {
  if (!aiManagerInstance) {
    aiManagerInstance = new EnhancedAIManager(defaultConfig);
  }

  return aiManagerInstance;
}

/**
 * Get or create AI provider instance
 */
export function getAIProvider(baseOptions: AIProviderOptions = {}): AIProvider {
  return {
    createChatCompletion: async (messages, overrides = {}) => {
      const manager = ensureManager();
      const request = {
        type: overrides.workflowType || baseOptions.workflowType || 'custom',
        requirements: JSON.stringify({ messages }),
        customSteps: [],
        useLocalAI: false,
        outputFormat: 'text' as const
      };

      const response = await manager.executeWorkflow(request);

      if (!response.success) {
        throw new Error(response.error || 'AI workflow execution failed');
      }

      return new ReadableStream<Uint8Array>({
        start(controller) {
          const payload = {
            metadata: response.metadata,
            results: response.results
          };
          controller.enqueue(textEncoder.encode(JSON.stringify(payload)));
          controller.close();
        }
      });
    },

    createEmbedding: async () => {
      return [];
    },

    getModelInfo: (model: string) => ({
      model,
      provider: 'openai',
      maxTokens: baseOptions.maxTokens || 4000,
      supportsStreaming: true
    })
  };
}

/**
 * Create a new AI provider instance with custom configuration
 */
export function createAIProvider(config: AIProviderConfig): AIProvider {
  const manager = new EnhancedAIManager(config);

  return {
    createChatCompletion: async (messages, overrides = {}) => {
      const request = {
        type: overrides.workflowType || 'custom',
        requirements: JSON.stringify({ messages }),
        customSteps: [],
        useLocalAI: false,
        outputFormat: 'text' as const
      };

      const response = await manager.executeWorkflow(request);

      if (!response.success) {
        throw new Error(response.error || 'AI workflow execution failed');
      }

      return new ReadableStream<Uint8Array>({
        start(controller) {
          const payload = {
            metadata: response.metadata,
            results: response.results
          };
          controller.enqueue(textEncoder.encode(JSON.stringify(payload)));
          controller.close();
        }
      });
    },

    createEmbedding: async () => {
      return [];
    },

    getModelInfo: (model: string) => ({
      model,
      provider: 'openai',
      maxTokens: 4000,
      supportsStreaming: true
    })
  };
}

export default getAIProvider;
