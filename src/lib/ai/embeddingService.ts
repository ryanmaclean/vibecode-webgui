import OpenAI from 'openai';
import { VectorService } from '../db/vector';
import { PrismaClient } from '@prisma/client';
// import { logger } from '@/lib/logger';
export class EmbeddingService {
  private openai: OpenAI;
  private vectorService: VectorService;
  private model: string;

  constructor(apiKey: string, model: string = 'text-embedding-3-small', prismaClient: PrismaClient) {
    this.openai = new OpenAI({
      apiKey,
    });
    this.model = model;
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
      console.error('Error generating embedding:', error);
      throw new Error('Failed to generate embedding');
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
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error cleaning up old embeddings:', error);
      throw new Error('Failed to clean up old embeddings');
    }
  }
}
