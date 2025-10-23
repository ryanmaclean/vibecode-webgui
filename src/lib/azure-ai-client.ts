// Azure AI Services Client
// Provides OpenRouter-like functionality using Azure AI Services

import OpenAI from 'openai';
// import { logger } from '@/lib/logger';
export interface AzureAIConfig {
  // Azure OpenAI configuration
  openai: {
    endpoint: string;
    apiKey?: string;
    deployments: {
      chat: string;        // GPT-4 deployment name
      completion: string;  // GPT-3.5-turbo deployment name  
      embedding: string;   // text-embedding-ada-002 deployment name
    };
    apiVersion: string;
  };
  
  // Cognitive Services configuration
  cognitive: {
    endpoint: string;
    apiKey?: string;
  };
  
  // Computer Vision configuration
  vision: {
    endpoint: string;
    apiKey?: string;
  };
  
  // Language Service configuration
  language: {
    endpoint: string;
    apiKey?: string;
  };
  
  // Authentication method
  useCredentials?: boolean; // Use Azure credentials vs API keys
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionRequest {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stream?: boolean;
}

export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: ChatMessage;
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface EmbeddingRequest {
  input: string | string[];
  model?: string;
}

export interface EmbeddingResponse {
  object: string;
  data: {
    object: string;
    embedding: number[];
    index: number;
  }[];
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

export class AzureAIClient {
  private openaiClient: OpenAI;
  // Optional Azure SDK clients, loaded lazily if dependencies are available
  private visionClient?: any;
  private languageClient?: any;
  private config: AzureAIConfig;

  constructor(config: AzureAIConfig) {
    this.config = config;
    this.initializeClients();
  }

  private initializeClients() {
    // Initialize Azure OpenAI client (OpenAI v4 SDK)
    this.openaiClient = new OpenAI({
      apiKey: this.config.openai.apiKey,
      baseURL: `${this.config.openai.endpoint}/openai/deployments`,
      defaultQuery: { 'api-version': this.config.openai.apiVersion },
      defaultHeaders: { 'api-key': this.config.openai.apiKey },
    });
    // NOTE: Azure SDK clients are optional to keep dependencies light.
    // If you need them, install @azure/cognitiveservices-computervision and @azure/ai-text-analytics
    // and replace the lazy loading below.
  }

  /**
   * Create a chat completion using Azure OpenAI
   * Compatible with OpenRouter API format
   */
  async createChatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    try {
      const deployment = request.model?.includes('gpt-4') 
        ? this.config.openai.deployments.chat 
        : this.config.openai.deployments.completion;

      const response = await this.openaiClient.chat.completions.create({
        model: deployment, // Use Azure deployment name
        messages: request.messages as any,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.max_tokens ?? 1000,
        top_p: request.top_p ?? 1,
        frequency_penalty: request.frequency_penalty ?? 0,
        presence_penalty: request.presence_penalty ?? 0,
        // Force non-streaming to avoid union types and simplify consumers
        stream: false as const,
      });

      return {
        id: response.id,
        object: response.object,
        created: response.created as number,
        model: request.model || deployment,
        choices: response.choices.map(choice => ({
          index: choice.index ?? 0,
          message: {
            role: (choice.message?.role || 'assistant') as 'assistant',
            content: choice.message?.content || '',
          },
          finish_reason: (choice.finish_reason as string) || 'stop',
        })),
        usage: {
          prompt_tokens: response.usage?.prompt_tokens || 0,
          completion_tokens: response.usage?.completion_tokens || 0,
          total_tokens: response.usage?.total_tokens || 0,
        },
      };
    } catch (error) {
      console.error('Azure OpenAI chat completion error:', error);
      throw new Error(`Azure OpenAI request failed: ${error}`);
    }
  }

  /**
   * Create embeddings using Azure OpenAI
   * Compatible with OpenRouter API format
   */
  async createEmbedding(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    try {
      const deployment = this.config.openai.deployments.embedding;
      
      const response = await this.openaiClient.embeddings.create({
        model: deployment,
        input: request.input as any,
      });

      return {
        object: response.object,
        data: response.data.map((item, index) => ({
          object: 'embedding',
          embedding: item.embedding,
          index: index,
        })),
        model: request.model || deployment,
        usage: {
          prompt_tokens: (response.usage as any)?.prompt_tokens ?? 0,
          total_tokens: (response.usage as any)?.total_tokens ?? 0,
        },
      };
    } catch (error) {
      console.error('Azure OpenAI embedding error:', error);
      throw new Error(`Azure OpenAI embedding request failed: ${error}`);
    }
  }

  /**
   * Analyze image using Azure Computer Vision
   */
  async analyzeImage(imageUrl: string, features: string[] = ['Description', 'Tags']) {
    // Optional feature not enabled (to avoid heavy Azure SDK dependency)
    throw new Error(
      'Azure Computer Vision is not enabled. Install @azure/cognitiveservices-computervision and wire up initializeClients() to enable.'
    );
  }

  /**
   * Analyze text sentiment using Azure Language Service
   */
  async analyzeSentiment(text: string | string[]) {
    // Optional feature not enabled
    throw new Error(
      'Azure Text Analytics (sentiment) is not enabled. Install @azure/ai-text-analytics and wire up initializeClients() to enable.'
    );
  }

  /**
   * Extract key phrases using Azure Language Service
   */
  async extractKeyPhrases(text: string | string[]) {
    // Optional feature not enabled
    throw new Error(
      'Azure Text Analytics (key phrases) is not enabled. Install @azure/ai-text-analytics and wire up initializeClients() to enable.'
    );
  }

  /**
   * Get available models information
   * Returns Azure deployment information in OpenRouter-compatible format
   */
  getAvailableModels() {
    return {
      chat_models: [
        {
          id: this.config.openai.deployments.chat,
          name: 'GPT-4 Turbo',
          description: 'Azure OpenAI GPT-4 Turbo deployment',
          context_length: 128000,
          pricing: { prompt: 0.01, completion: 0.03 },
        },
        {
          id: this.config.openai.deployments.completion,
          name: 'GPT-3.5 Turbo',
          description: 'Azure OpenAI GPT-3.5 Turbo deployment',
          context_length: 16385,
          pricing: { prompt: 0.0015, completion: 0.002 },
        },
      ],
      embedding_models: [
        {
          id: this.config.openai.deployments.embedding,
          name: 'Text Embedding Ada 002',
          description: 'Azure OpenAI text-embedding-ada-002 deployment',
          dimensions: 1536,
          pricing: { input: 0.0001 },
        },
      ],
      vision_models: [
        {
          id: 'azure-computer-vision',
          name: 'Azure Computer Vision',
          description: 'Azure Computer Vision service for image analysis',
          features: ['description', 'tags', 'objects', 'faces', 'categories'],
        },
      ],
      language_models: [
        {
          id: 'azure-language-service',
          name: 'Azure Language Service',
          description: 'Azure Language Service for text analysis',
          features: ['sentiment', 'key_phrases', 'entities', 'language_detection'],
        },
      ],
    };
  }
}

// Factory function to create Azure AI client from environment variables
export function createAzureAIClient(): AzureAIClient {
  const config: AzureAIConfig = {
    openai: {
      endpoint: process.env.AZURE_OPENAI_ENDPOINT || '',
      apiKey: process.env.AZURE_OPENAI_API_KEY || '',
      deployments: {
        chat: process.env.AZURE_OPENAI_CHAT_DEPLOYMENT || 'gpt-4-turbo',
        completion: process.env.AZURE_OPENAI_COMPLETION_DEPLOYMENT || 'gpt-35-turbo',
        embedding: process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT || 'text-embedding-ada-002',
      },
      apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2024-02-01',
    },
    cognitive: {
      endpoint: process.env.AZURE_COGNITIVE_ENDPOINT || '',
      apiKey: process.env.AZURE_COGNITIVE_KEY || '',
    },
    vision: {
      endpoint: process.env.AZURE_VISION_ENDPOINT || '',
      apiKey: process.env.AZURE_VISION_KEY || '',
    },
    language: {
      endpoint: process.env.AZURE_LANGUAGE_ENDPOINT || '',
      apiKey: process.env.AZURE_LANGUAGE_KEY || '',
    },
    useCredentials: process.env.AZURE_USE_CREDENTIALS === 'true',
  };

  return new AzureAIClient(config);
}

// Singleton instance
let azureAIClient: AzureAIClient | null = null;

export function getAzureAIClient(): AzureAIClient {
  if (!azureAIClient) {
    azureAIClient = createAzureAIClient();
  }
  return azureAIClient;
} 