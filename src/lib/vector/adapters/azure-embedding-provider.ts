// import { logger } from '@/lib/logger';


/**
 * Azure Vector Embedding Provider
 * Generates embeddings using Azure OpenAI API
 */

// Mock types for Azure OpenAI since we don't have the package installed
// These would be replaced with actual imports when the package is installed
interface AzureKeyCredential {
  new (key: string): AzureKeyCredential;
}

interface OpenAIClient {
  getEmbeddings(deploymentName: string, texts: string[]): Promise<{
    data: { embedding: number[] }[];
  }>;
}

// Mock implementation for development
const AzureKeyCredential = function(key: string) { return { key } } as any as AzureKeyCredential;
const OpenAIClient = function(endpoint: string, credential: any, options?: any) { 
  return { 
    getEmbeddings: async () => ({ data: [{ embedding: new Array(1536).fill(0) }] }) 
  }; 
} as any as { new(endpoint: string, credential: any, options?: any): OpenAIClient };

import { BaseVectorEmbeddingProvider } from './base-vector-embedding-provider';
export class AzureEmbeddingProvider extends BaseVectorEmbeddingProvider {
  private client: OpenAIClient | null = null;
  private endpoint: string;
  private deploymentName: string;

  constructor(
    apiKey: string,
    endpoint: string,
    deploymentName: string,
    model: string = 'text-embedding-ada-002',
    dimension: number = 1536,
    options: Record<string, any> = {}
  ) {
    super(apiKey, model, dimension, options);
    this.endpoint = endpoint;
    this.deploymentName = deploymentName;
    this.initClient();
  }

  /**
   * Initialize the Azure OpenAI client
   */
  private initClient(): void {
    this.verifyApiKey();
    
    if (!this.endpoint) {
      throw new Error('Azure OpenAI endpoint is required');
    }

    if (!this.deploymentName) {
      throw new Error('Azure OpenAI deployment name is required');
    }

    try {
      const credential = new AzureKeyCredential(this.apiKey);
      this.client = new OpenAIClient(this.endpoint, credential, this.options.clientOptions);
    } catch (error) {
      console.error('Error initializing Azure OpenAI client:', error);
      throw new Error('Failed to initialize Azure OpenAI client');
    }
  }

  /**
   * Generate an embedding vector for the given text
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.client) {
      this.initClient();
      if (!this.client) {
        throw new Error('Azure OpenAI client not initialized. Check API key and endpoint.');
      }
    }

    try {
      const normalizedText = this.normalizeText(text);
      
      if (!normalizedText) {
        return this.generateZeroVector();
      }

      // Call Azure OpenAI embedding API
      const response = await this.client.getEmbeddings(this.deploymentName, [normalizedText]);
      
      if (!response.data || response.data.length === 0) {
        throw new Error('No embedding data returned from Azure OpenAI');
      }

      return response.data[0].embedding;
    } catch (error) {
      console.error('Error generating Azure embedding:', error);
      // Return zero vector as fallback
      return this.generateZeroVector();
    }
  }
}