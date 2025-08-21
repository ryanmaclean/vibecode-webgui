/**
 * OpenAI Vector Embedding Provider
 * Generates embeddings using OpenAI API
 */

import OpenAI from 'openai';
import { BaseVectorEmbeddingProvider } from './base-vector-embedding-provider';

export class OpenAIEmbeddingProvider extends BaseVectorEmbeddingProvider {
  private openai: OpenAI | null = null;
  private useOpenRouter: boolean;

  constructor(
    apiKey: string,
    model: string = 'text-embedding-3-small',
    dimension: number = 1536,
    options: Record<string, any> = {}
  ) {
    super(apiKey, model, dimension, options);
    this.useOpenRouter = options.useOpenRouter || false;
    this.initClient();
  }

  /**
   * Initialize the OpenAI client
   */
  private initClient(): void {
    this.verifyApiKey();
    
    if (this.useOpenRouter) {
      this.openai = new OpenAI({
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: this.apiKey,
        ...this.options.clientOptions
      });
    } else {
      this.openai = new OpenAI({
        apiKey: this.apiKey,
        ...this.options.clientOptions
      });
    }
  }

  /**
   * Generate an embedding vector for the given text
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.openai) {
      this.initClient();
      if (!this.openai) {
        throw new Error('OpenAI client not initialized. Check API key.');
      }
    }

    try {
      const normalizedText = this.normalizeText(text);
      
      if (!normalizedText) {
        return this.generateZeroVector();
      }

      const response = await this.openai.embeddings.create({
        model: this.model,
        input: normalizedText,
        ...this.options.requestOptions
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error('Error generating OpenAI embedding:', error);
      // Return zero vector as fallback
      return this.generateZeroVector();
    }
  }
}