// Azure AI Services Client
// Provides OpenRouter-like functionality using Azure AI Services

import { OpenAIApi, Configuration } from 'openai';
import { DefaultAzureCredential } from '@azure/identity';
import { ComputerVisionClient } from '@azure/cognitiveservices-computervision';
import { TextAnalyticsClient, AzureKeyCredential } from '@azure/ai-text-analytics';

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
  private openaiClient: OpenAIApi;
  private visionClient?: ComputerVisionClient;
  private languageClient?: TextAnalyticsClient;
  private config: AzureAIConfig;

  constructor(config: AzureAIConfig) {
    this.config = config;
    this.initializeClients();
  }

  private initializeClients() {
    // Initialize Azure OpenAI client
    const openaiConfig = new Configuration({
      apiKey: this.config.openai.apiKey,
      basePath: `${this.config.openai.endpoint}/openai/deployments`,
      baseOptions: {
        headers: {
          'api-key': this.config.openai.apiKey,
        },
        params: {
          'api-version': this.config.openai.apiVersion,
        },
      },
    });
    
    this.openaiClient = new OpenAIApi(openaiConfig);

    // Initialize Computer Vision client
    if (this.config.vision.endpoint) {
      if (this.config.useCredentials) {
        const credential = new DefaultAzureCredential();
        this.visionClient = new ComputerVisionClient(credential, this.config.vision.endpoint);
      } else if (this.config.vision.apiKey) {
        this.visionClient = new ComputerVisionClient(
          new AzureKeyCredential(this.config.vision.apiKey),
          this.config.vision.endpoint
        );
      }
    }

    // Initialize Language Service client
    if (this.config.language.endpoint) {
      if (this.config.useCredentials) {
        const credential = new DefaultAzureCredential();
        // Note: Language client with DefaultAzureCredential requires additional setup
        console.warn('Language client with DefaultAzureCredential not fully implemented');
      } else if (this.config.language.apiKey) {
        this.languageClient = new TextAnalyticsClient(
          this.config.language.endpoint,
          new AzureKeyCredential(this.config.language.apiKey)
        );
      }
    }
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

      const response = await this.openaiClient.createChatCompletion({
        model: deployment, // Use Azure deployment name
        messages: request.messages,
        temperature: request.temperature || 0.7,
        max_tokens: request.max_tokens || 1000,
        top_p: request.top_p || 1,
        frequency_penalty: request.frequency_penalty || 0,
        presence_penalty: request.presence_penalty || 0,
        stream: request.stream || false,
      });

      return {
        id: response.data.id,
        object: response.data.object,
        created: response.data.created,
        model: request.model || deployment,
        choices: response.data.choices.map(choice => ({
          index: choice.index!,
          message: {
            role: choice.message?.role as 'assistant',
            content: choice.message?.content || '',
          },
          finish_reason: choice.finish_reason || 'stop',
        })),
        usage: {
          prompt_tokens: response.data.usage?.prompt_tokens || 0,
          completion_tokens: response.data.usage?.completion_tokens || 0,
          total_tokens: response.data.usage?.total_tokens || 0,
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
      
      const response = await this.openaiClient.createEmbedding({
        model: deployment,
        input: request.input,
      });

      return {
        object: response.data.object,
        data: response.data.data.map((item, index) => ({
          object: 'embedding',
          embedding: item.embedding,
          index: index,
        })),
        model: request.model || deployment,
        usage: {
          prompt_tokens: response.data.usage.prompt_tokens,
          total_tokens: response.data.usage.total_tokens,
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
    if (!this.visionClient) {
      throw new Error('Computer Vision client not initialized');
    }

    try {
      const result = await this.visionClient.analyzeImage(imageUrl, {
        visualFeatures: features,
        language: 'en',
      });

      return {
        description: result.description?.captions?.[0]?.text || '',
        tags: result.tags?.map(tag => ({ name: tag.name, confidence: tag.confidence })) || [],
        categories: result.categories?.map(cat => ({ name: cat.name, score: cat.score })) || [],
        objects: result.objects?.map(obj => ({
          object: obj.objectProperty,
          confidence: obj.confidence,
          rectangle: obj.rectangle,
        })) || [],
      };
    } catch (error) {
      console.error('Computer Vision analysis error:', error);
      throw new Error(`Computer Vision request failed: ${error}`);
    }
  }

  /**
   * Analyze text sentiment using Azure Language Service
   */
  async analyzeSentiment(text: string | string[]) {
    if (!this.languageClient) {
      throw new Error('Language client not initialized');
    }

    try {
      const documents = Array.isArray(text) 
        ? text.map((t, i) => ({ id: i.toString(), text: t }))
        : [{ id: '0', text }];

      const results = await this.languageClient.analyzeSentiment(documents);
      
      return results.map(result => ({
        id: result.id,
        sentiment: result.sentiment,
        confidence: result.confidenceScores,
        sentences: result.sentences?.map(sentence => ({
          text: sentence.text,
          sentiment: sentence.sentiment,
          confidence: sentence.confidenceScores,
        })) || [],
      }));
    } catch (error) {
      console.error('Language sentiment analysis error:', error);
      throw new Error(`Language sentiment analysis failed: ${error}`);
    }
  }

  /**
   * Extract key phrases using Azure Language Service
   */
  async extractKeyPhrases(text: string | string[]) {
    if (!this.languageClient) {
      throw new Error('Language client not initialized');
    }

    try {
      const documents = Array.isArray(text) 
        ? text.map((t, i) => ({ id: i.toString(), text: t }))
        : [{ id: '0', text }];

      const results = await this.languageClient.extractKeyPhrases(documents);
      
      return results.map(result => ({
        id: result.id,
        keyPhrases: result.keyPhrases || [],
      }));
    } catch (error) {
      console.error('Language key phrase extraction error:', error);
      throw new Error(`Language key phrase extraction failed: ${error}`);
    }
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