import { VectorService } from '../db/vector';
import { PrismaClient } from '@prisma/client';

interface OpenRouterBYOKOptions {
  openrouterApiKey: string;
  openaiApiKey: string;
  model?: string;
  fallbackToDirect?: boolean;
}

export class OpenRouterBYOKEmbeddingService {
  private openrouterApiKey: string;
  private openaiApiKey: string;
  private vectorService: VectorService;
  private model: string;
  private fallbackToDirect: boolean;

  constructor(options: OpenRouterBYOKOptions, prismaClient: PrismaClient) {
    this.openrouterApiKey = options.openrouterApiKey;
    this.openaiApiKey = options.openaiApiKey;
    this.model = options.model || 'openai/text-embedding-3-small';
    this.fallbackToDirect = options.fallbackToDirect || false;
    this.vectorService = new VectorService(prismaClient);
  }

  /**
   * Generate embeddings for a piece of text using OpenRouter BYOK
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openrouterApiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
          'X-Title': 'VibeCode WebGUI',
        },
        body: JSON.stringify({
          model: this.model,
          input: text,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.data || !data.data[0] || !data.data[0].embedding) {
        throw new Error('Invalid response from OpenRouter API');
      }

      return data.data[0].embedding;
    } catch (error) {
      console.error('Error generating embedding with OpenRouter:', error);

      // Fallback to direct OpenAI if enabled
      if (this.fallbackToDirect) {
        console.log('Falling back to direct OpenAI embedding...');
        return this.generateDirectEmbedding(text);
      }

      throw new Error('Failed to generate embedding');
    }
  }

  /**
   * Fallback method to generate embeddings directly with OpenAI
   */
  private async generateDirectEmbedding(text: string): Promise<number[]> {
    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model.replace('openai/', ''), // Remove prefix for direct API
          input: text,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.data || !data.data[0] || !data.data[0].embedding) {
        throw new Error('Invalid response from OpenAI API');
      }

      return data.data[0].embedding;
    } catch (error) {
      console.error('Error generating direct OpenAI embedding:', error);
      throw new Error('Failed to generate embedding with fallback');
    }
  }

  /**
   * Store a document and its embedding in the database
   */
  async storeDocument(
    documentId: string,
    content: string,
    metadata: Record<string, any> = {}
  ) {
    try {
      const embedding = await this.generateEmbedding(content);

      return this.vectorService.upsertEmbedding({
        documentId,
        content,
        embedding,
        metadata: {
          ...metadata,
          model: this.model,
          provider: 'openrouter-byok',
          contentLength: content.length,
          updatedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('Error storing document:', error);
      throw new Error('Failed to store document');
    }
  }

  /**
   * Find similar documents to the given query
   */
  async findSimilarDocuments(
    query: string,
    options: { threshold?: number; limit?: number } = {}
  ) {
    try {
      const embedding = await this.generateEmbedding(query);
      return await this.vectorService.findSimilarDocuments({
        embedding,
        threshold: options.threshold ?? 0.7,
        limit: options.limit ?? 5,
      });
    } catch (error) {
      console.error('Error finding similar documents:', error);
      throw new Error('Failed to find similar documents');
    }
  }

  /**
   * Perform a RAG (Retrieval-Augmented Generation) query
   */
  async ragQuery(
    query: string,
    options: { threshold?: number; limit?: number } = {}
  ) {
    try {
      const similarDocs = await this.findSimilarDocuments(query, options);

      const context = similarDocs
        .map((doc, i) => `Document ${i + 1}:\n${doc.content}`)
        .join('\n\n');

      return {
        query,
        context,
        documents: similarDocs,
        model: this.model,
        provider: 'openrouter-byok',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error in RAG query:', error);
      throw new Error('Failed to process RAG query');
    }
  }

  /**
   * Get statistics about embeddings
   */
  async getStats() {
    try {
      const stats = await this.vectorService.getEmbeddingStats();
      return {
        stats,
        model: this.model,
        provider: 'openrouter-byok',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error getting embedding stats:', error);
      throw new Error('Failed to retrieve embedding statistics');
    }
  }

  /**
   * Clean up old embeddings
   */
  async cleanupOldEmbeddings(daysToKeep: number = 30) {
    if (daysToKeep < 1) {
      throw new Error('daysToKeep must be at least 1');
    }

    try {
      const result = await this.vectorService.cleanupOldEmbeddings(daysToKeep);
      return {
        deletedCount: result.deletedCount,
        model: this.model,
        provider: 'openrouter-byok',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error cleaning up old embeddings:', error);
      throw new Error('Failed to clean up old embeddings');
    }
  }
}
