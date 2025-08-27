import OpenAI from 'openai';
import { VectorService } from '../db/vector';
import { PrismaClient } from '@prisma/client';

export class AzureEmbeddingService {
  private openai: OpenAI;
  private vectorService: VectorService;
  private model: string;

  constructor(
    apiKey: string,
    endpoint: string,
    deploymentName: string = 'text-embedding-3-small',
    apiVersion: string = '2023-05-15',
    prismaClient: PrismaClient
  ) {
    this.openai = new OpenAI({
      apiKey,
      baseURL: `${endpoint}/openai/deployments/${deploymentName}`,
      defaultQuery: { 'api-version': apiVersion },
      defaultHeaders: { 'api-key': apiKey },
    });
    this.model = deploymentName;
    this.vectorService = new VectorService(prismaClient);
  }

  /**
   * Generate embeddings for a piece of text
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: this.model,
        input: text
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error('Error generating Azure embedding:', error);
      throw new Error('Failed to generate Azure embedding');
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
          provider: 'azure',
          contentLength: content.length,
          updatedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('Error storing document with Azure embedding:', error);
      throw new Error('Failed to store document with Azure embedding');
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
        threshold: options.threshold ?? 0.7, // Default threshold
        limit: options.limit ?? 5, // Default limit
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
      
      // Format context from similar documents
      const context = similarDocs
        .map((doc, i) => `Document ${i + 1}:\n${doc.content}`)
        .join('\n\n');

      return {
        query,
        context,
        documents: similarDocs,
        model: this.model,
        provider: 'azure',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error in Azure RAG query:', error);
      throw new Error('Failed to process Azure RAG query');
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
        provider: 'azure',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error getting Azure embedding stats:', error);
      throw new Error('Failed to retrieve Azure embedding statistics');
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
        provider: 'azure',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error cleaning up old Azure embeddings:', error);
      throw new Error('Failed to clean up old Azure embeddings');
    }
  }
}