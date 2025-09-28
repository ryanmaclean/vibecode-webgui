import OpenAI from 'openai';
import type { Span } from 'dd-trace';
import { VectorService } from '../db/vector';
import { PrismaClient } from '@prisma/client';
import { llmObservability } from '../datadog-llm';
import { metrics } from '../server-monitoring';

export interface EmbeddingServiceOptions {
  baseURL?: string;
  defaultHeaders?: Record<string, string>;
  dangerouslyAllowBrowser?: boolean;
}

const EMBEDDING_DIMENSIONS: Record<string, number> = {
  'text-embedding-ada-002': 1536,
  'text-embedding-3-small': 1536,
  'text-embedding-3-large': 3072,
};

export class EmbeddingService {
  private openai: OpenAI;
  private vectorService: VectorService;
  private readonly apiModel: string;
  private readonly modelTag: string;
  private readonly providerTag: string;
  private readonly expectedDimensions: number;

  constructor(
    apiKey: string,
    model: string = 'text-embedding-3-small',
    prismaClient: PrismaClient,
    clientOptions: EmbeddingServiceOptions = {}
  ) {
    const { baseURL, defaultHeaders, dangerouslyAllowBrowser } = clientOptions;

    this.openai = new OpenAI({
      apiKey,
      ...(baseURL ? { baseURL } : {}),
      ...(defaultHeaders && Object.keys(defaultHeaders).length > 0
        ? { defaultHeaders }
        : {}),
      ...(dangerouslyAllowBrowser ? { dangerouslyAllowBrowser } : {}),
    });
    this.apiModel = model;
    this.modelTag = this.normalizeModelTag(model);
    this.providerTag = baseURL && baseURL.includes('openrouter') ? 'openrouter' : 'openai';
    this.expectedDimensions = EMBEDDING_DIMENSIONS[this.modelTag] ?? 1536;
    this.vectorService = new VectorService(prismaClient);
  }

  /**
   * Generate embeddings for a piece of text
   */
  async generateEmbedding(text: string): Promise<number[]> {
    return llmObservability.createTaskSpan(
      'embedding.generate',
      async (span?: Span) => {
        const start = Date.now();

        try {
          const response = await this.openai.embeddings.create({
            model: this.apiModel,
            input: text,
          });

          const embedding = response.data[0].embedding;
          const duration = Date.now() - start;

          span?.setTag('embedding.model', this.modelTag);
          span?.setTag('embedding.provider', this.providerTag);
          span?.setTag('embedding.dimensions', embedding.length);
          span?.setTag('embedding.input_length', text.length);
          span?.setTag('embedding.duration_ms', duration);

          metrics.histogram('embedding.generate.duration_ms', duration, {
            model: this.modelTag,
            provider: this.providerTag,
          });
          metrics.increment('embedding.generate.success', {
            model: this.modelTag,
            provider: this.providerTag,
          });

          if (embedding.length !== this.expectedDimensions) {
            metrics.increment('embedding.generate.dimension_mismatch', {
              expected: String(this.expectedDimensions),
              actual: String(embedding.length),
              model: this.modelTag,
            });
            span?.setTag('embedding.dimension_mismatch', true);
            span?.setTag('embedding.expected_dimensions', this.expectedDimensions);
          }

          llmObservability.annotate({
            metadata: {
              embedding_model: this.modelTag,
              embedding_provider: this.providerTag,
              embedding_dimensions: embedding.length,
              duration_ms: duration,
            },
            tags: ['embedding', this.providerTag],
          });

          return embedding;
        } catch (error) {
          metrics.increment('embedding.generate.error', {
            model: this.modelTag,
            provider: this.providerTag,
          });

          if (span) {
            span.setTag('error', true);
            span.setTag('error.message', error instanceof Error ? error.message : String(error));
          }

          console.error('Error generating embedding:', error);
          throw new Error('Failed to generate embedding');
        }
      },
      {
        tags: ['embedding', this.providerTag],
        input: { textLength: text.length },
        context: {
          model: this.modelTag,
          provider: this.providerTag,
        },
      }
    );
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
          model: this.modelTag,
          provider: this.providerTag,
          embeddingDimensions: embedding.length,
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
        model: this.modelTag,
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
        model: this.modelTag,
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
        model: this.modelTag,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error cleaning up old embeddings:', error);
      throw new Error('Failed to clean up old embeddings');
    }
  }

  /**
   * Normalize a model string for tagging/metrics (strip provider prefixes)
   */
  private normalizeModelTag(model: string): string {
    const trimmed = (model || '').trim();
    if (!trimmed) {
      return 'text-embedding-3-small';
    }

    if (trimmed.startsWith('openai/')) {
      return trimmed.replace(/^openai\//, '');
    }

    return trimmed;
  }
}
