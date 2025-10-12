/**
 * Weaviate Vector Database Client
 * Implementation of vector database operations using Weaviate
 */

import { VectorChunk, SearchResult, SearchOptions } from '../vector-db/vector-types';
import { logger } from '@/lib/logger';

export interface WeaviateConfig {
  host: string;
  port?: number;
  protocol?: 'http' | 'https';
  apiKey?: string;
  openaiApiKey?: string;
  model?: string;
  timeout?: number;
  retries?: number;
}

export interface WeaviateClass {
  class: string;
  description?: string;
  vectorIndexType?: 'hnsw' | 'flat';
  vectorIndexConfig?: {
    distance?: 'cosine' | 'l2-squared' | 'manhattan' | 'hamming';
    ef?: number;
    efConstruction?: number;
    maxConnections?: number;
  };
  properties?: Array<{
    name: string;
    dataType: string[];
    description?: string;
  }>;
}

/**
 * Weaviate Vector Database Client
 */
export class WeaviateClient {
  private config: WeaviateConfig;
  private client: any = null;
  private isConnected = false;

  constructor(config: WeaviateConfig) {
    this.config = {
      port: 8080,
      protocol: 'http',
      timeout: 30000,
      retries: 3,
      ...config
    };
  }

  /**
   * Initialize the Weaviate client connection
   */
  async initialize(): Promise<void> {
    try {
      // Initialize Weaviate client
      const weaviate = await import('weaviate-ts-client');

      this.client = weaviate.weaviate.client({
        scheme: this.config.protocol,
        host: this.config.host,
        ...(this.config.apiKey && { apiKey: this.config.apiKey }),
        ...(this.config.timeout && { timeout: this.config.timeout }),
        ...(this.config.retries && { retries: this.config.retries })
      });

      // Test connection
      await this.client.misc.readyChecker().do();

      this.isConnected = true;
      logger.info('Weaviate client initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize Weaviate client:', error);
      throw error;
    }
  }

  /**
   * Close the Weaviate connection
   */
  async close(): Promise<void> {
    if (this.client) {
      // Weaviate client doesn't have a specific close method
      this.client = null;
    }
    this.isConnected = false;
  }

  /**
   * Check if the Weaviate connection is healthy
   */
  async ping(): Promise<boolean> {
    try {
      if (!this.client) return false;

      await this.client.misc.readyChecker().do();
      return true;
    } catch (error) {
      logger.error('Weaviate ping failed:', error);
      return false;
    }
  }

  /**
   * Check if connected to Weaviate
   */
  isHealthy(): boolean {
    return this.client !== null && this.isConnected;
  }

  /**
   * Create a class (collection) in Weaviate
   */
  async createClass(classDefinition: WeaviateClass): Promise<void> {
    if (!this.client) {
      throw new Error('Weaviate client not initialized');
    }

    try {
      const schema = await this.client.schema.getter().do();
      const existingClass = schema.classes.find((c: any) => c.class === classDefinition.class);

      if (!existingClass) {
        await this.client.schema.classCreator().withClass(classDefinition).do();
        logger.info(`Created Weaviate class: ${classDefinition.class}`);
      }
    } catch (error) {
      logger.error(`Failed to create Weaviate class ${classDefinition.class}:`, error);
      throw error;
    }
  }

  /**
   * Store vector chunks in Weaviate
   */
  async store(chunks: VectorChunk[]): Promise<number> {
    if (!this.client) {
      throw new Error('Weaviate client not initialized');
    }

    try {
      let storedCount = 0;

      for (const chunk of chunks) {
        const dataObject = {
          class: 'VectorChunk',
          properties: {
            content: chunk.content,
            metadata: JSON.stringify(chunk.metadata),
            workspaceId: chunk.metadata.fileId || 0,
            fileId: chunk.metadata.fileId || 0,
            fileName: chunk.metadata.fileName || '',
            language: chunk.metadata.language || '',
            tokens: chunk.metadata.tokens || 0
          },
          vector: chunk.embedding
        };

        // Store with automatic vectorization if OpenAI key is provided
        if (this.config.openaiApiKey) {
          await this.client.data.creator().withClassName('VectorChunk').withProperties(dataObject.properties).do();
        } else {
          await this.client.data.creator().withClassName('VectorChunk').withVector(dataObject.vector).withProperties(dataObject.properties).do();
        }

        storedCount++;
      }

      return storedCount;
    } catch (error) {
      logger.error('Failed to store chunks in Weaviate:', error);
      throw error;
    }
  }

  /**
   * Search for similar vectors using the provided query embedding
   */
  async searchWithVector(
    queryEmbedding: number[],
    options: SearchOptions
  ): Promise<SearchResult[]> {
    if (!this.client) {
      throw new Error('Weaviate client not initialized');
    }

    try {
      const limit = options.limit || 10;
      const threshold = options.threshold || 0.1;

      const query = this.client.graphql
        .get()
        .withClassName('VectorChunk')
        .withFields('id content metadata _additional { distance certainty }')
        .withNearVector({
          vector: queryEmbedding,
          distance: 1 - threshold // Convert similarity threshold to distance
        })
        .withLimit(limit);

      const result = await query.do();

      if (!result.data || !result.data.Get || !result.data.Get.VectorChunk) {
        return [];
      }

      return result.data.Get.VectorChunk.map((item: any) => ({
        chunk: {
          id: item.id,
          content: item.content,
          embedding: queryEmbedding, // We don't get the original embedding back
          metadata: JSON.parse(item.metadata || '{}')
        },
        similarity: item._additional.certainty || 0
      }));
    } catch (error) {
      logger.error('Failed to search in Weaviate:', error);
      throw error;
    }
  }

  /**
   * Search for similar vectors using text query (generates embedding internally)
   */
  async searchWithText(
    query: string,
    options: SearchOptions
  ): Promise<SearchResult[]> {
    if (!this.client) {
      throw new Error('Weaviate client not initialized');
    }

    try {
      const limit = options.limit || 10;

      // Use Weaviate's text-based search (nearText)
      const query = this.client.graphql
        .get()
        .withClassName('VectorChunk')
        .withFields('id content metadata _additional { distance certainty }')
        .withNearText({
          concepts: [query],
          distance: 0.7 // Default distance threshold for text search
        })
        .withLimit(limit);

      const result = await query.do();

      if (!result.data || !result.data.Get || !result.data.Get.VectorChunk) {
        return [];
      }

      return result.data.Get.VectorChunk.map((item: any) => ({
        chunk: {
          id: item.id,
          content: item.content,
          embedding: [], // We don't get the original embedding back
          metadata: JSON.parse(item.metadata || '{}')
        },
        similarity: item._additional.certainty || 0
      }));
    } catch (error) {
      logger.error('Failed to search with text in Weaviate:', error);
      throw error;
    }
  }

  /**
   * Delete vectors by their IDs
   */
  async delete(ids: string[]): Promise<number> {
    if (!this.client) {
      throw new Error('Weaviate client not initialized');
    }

    try {
      let deletedCount = 0;

      for (const id of ids) {
        try {
          await this.client.data.deleter().withClassName('VectorChunk').withId(id).do();
          deletedCount++;
        } catch (error: any) {
          // Item might not exist, which is fine
          if (error.statusCode !== 404) {
            throw error;
          }
        }
      }

      return deletedCount;
    } catch (error) {
      logger.error('Failed to delete from Weaviate:', error);
      throw error;
    }
  }

  /**
   * Get statistics about the vector database
   */
  async getStats(): Promise<{
    totalVectors: number;
    indexSize: number;
    lastUpdated: Date;
  }> {
    if (!this.client) {
      throw new Error('Weaviate client not initialized');
    }

    try {
      // Get object count from Weaviate
      const result = await this.client.graphql
        .aggregate()
        .withClassName('VectorChunk')
        .withFields('meta { count }')
        .do();

      const totalVectors = result.data.Aggregate.VectorChunk[0]?.meta?.count || 0;

      return {
        totalVectors,
        indexSize: totalVectors * 1000, // Rough estimate
        lastUpdated: new Date()
      };
    } catch (error) {
      logger.error('Failed to get Weaviate stats:', error);
      throw error;
    }
  }

  /**
   * Generate embeddings for the given text (placeholder implementation)
   */
  async generateEmbedding(text: string): Promise<number[]> {
    // This would integrate with an embedding service (OpenAI, etc.)
    // For now, return a placeholder embedding
    const dimensions = 1536; // OpenAI text-embedding-ada-002 dimensions
    return new Array(dimensions).fill(0).map(() => Math.random() * 2 - 1);
  }

  /**
   * Get the dimensionality of vectors in this database
   */
  getDimensions(): number {
    return 1536; // Standard for OpenAI embeddings
  }

  /**
   * Clear all vectors from the database
   */
  async clear(): Promise<void> {
    if (!this.client) {
      throw new Error('Weaviate client not initialized');
    }

    try {
      // Delete all objects in the VectorChunk class
      const query = this.client.graphql
        .get()
        .withClassName('VectorChunk')
        .withFields('id')
        .withLimit(10000); // Get all IDs

      const result = await query.do();

      if (result.data?.Get?.VectorChunk) {
        const ids = result.data.Get.VectorChunk.map((item: any) => item.id);

        // Delete in batches
        const batchSize = 100;
        for (let i = 0; i < ids.length; i += batchSize) {
          const batch = ids.slice(i, i + batchSize);
          await Promise.all(
            batch.map(id => this.client.data.deleter().withClassName('VectorChunk').withId(id).do())
          );
        }
      }
    } catch (error) {
      logger.error('Failed to clear Weaviate data:', error);
      throw error;
    }
  }

  /**
   * Create an index for the given field if it doesn't exist
   */
  async createIndex(field: string, options?: any): Promise<void> {
    // Weaviate handles indexing automatically through schema configuration
    logger.info(`Index for ${field} is handled by Weaviate schema configuration`);
  }

  /**
   * Delete an index for the given field
   */
  async deleteIndex(field: string): Promise<void> {
    // Weaviate index management is handled at the class level
    logger.info(`Index deletion for ${field} is handled by Weaviate class management`);
  }

  /**
   * Get all available indexes
   */
  async getIndexes(): Promise<string[]> {
    // Weaviate doesn't expose indexes in the same way as traditional databases
    return ['vector_index']; // Placeholder
  }

  /**
   * Invalidate cache for specific table and content type
   */
  async invalidateCache(table: string, contentType?: string): Promise<number> {
    // Weaviate doesn't have traditional cache invalidation
    // This would integrate with your caching layer
    return 0;
  }

  /**
   * Get vector by ID
   */
  async getById(id: string): Promise<VectorChunk | null> {
    if (!this.client) {
      throw new Error('Weaviate client not initialized');
    }

    try {
      const result = await this.client.data.getter().withClassName('VectorChunk').withId(id).do();

      if (!result || !result.properties) {
        return null;
      }

      return {
        id: result.id,
        content: result.properties.content,
        embedding: result.vector || [],
        metadata: JSON.parse(result.properties.metadata || '{}')
      };
    } catch (error: any) {
      if (error.statusCode === 404) {
        return null; // Item not found
      }

      logger.error('Failed to get vector by ID:', error);
      throw error;
    }
  }

  /**
   * Update vector by ID
   */
  async update(id: string, chunk: Partial<VectorChunk>): Promise<boolean> {
    if (!this.client) {
      throw new Error('Weaviate client not initialized');
    }

    try {
      const existing = await this.getById(id);
      if (!existing) return false;

      const updated = {
        ...existing,
        ...chunk
      };

      await this.client.data.updater()
        .withClassName('VectorChunk')
        .withId(id)
        .withProperties({
          content: updated.content,
          metadata: JSON.stringify(updated.metadata)
        })
        .withVector(updated.embedding)
        .do();

      return true;
    } catch (error) {
      logger.error('Failed to update vector:', error);
      return false;
    }
  }

  /**
   * Batch operation for multiple vectors
   */
  async batch(operations: Array<{
    type: 'insert' | 'update' | 'delete';
    data?: VectorChunk;
    id?: string;
  }>): Promise<number> {
    if (!this.client) {
      throw new Error('Weaviate client not initialized');
    }

    let processedCount = 0;

    try {
      for (const operation of operations) {
        switch (operation.type) {
          case 'insert':
            if (operation.data) {
              await this.store([operation.data]);
              processedCount++;
            }
            break;

          case 'update':
            if (operation.id && operation.data) {
              await this.update(operation.id, operation.data);
              processedCount++;
            }
            break;

          case 'delete':
            if (operation.id) {
              await this.delete([operation.id]);
              processedCount++;
            }
            break;
        }
      }

      return processedCount;
    } catch (error) {
      logger.error('Failed to execute batch operation:', error);
      throw error;
    }
  }

  /**
   * Get similar vectors within a specific workspace
   */
  async searchByWorkspace(
    workspaceId: number,
    queryEmbedding: number[],
    options: SearchOptions
  ): Promise<SearchResult[]> {
    if (!this.client) {
      throw new Error('Weaviate client not initialized');
    }

    try {
      const limit = options.limit || 10;
      const threshold = options.threshold || 0.1;

      const query = this.client.graphql
        .get()
        .withClassName('VectorChunk')
        .withFields('id content metadata _additional { distance certainty }')
        .withWhere({
          path: ['workspaceId'],
          operator: 'Equal',
          valueNumber: workspaceId
        })
        .withNearVector({
          vector: queryEmbedding,
          distance: 1 - threshold
        })
        .withLimit(limit);

      const result = await query.do();

      if (!result.data?.Get?.VectorChunk) {
        return [];
      }

      return result.data.Get.VectorChunk.map((item: any) => ({
        chunk: {
          id: item.id,
          content: item.content,
          embedding: queryEmbedding,
          metadata: JSON.parse(item.metadata || '{}')
        },
        similarity: item._additional.certainty || 0
      }));
    } catch (error) {
      logger.error('Failed to search by workspace in Weaviate:', error);
      throw error;
    }
  }

  /**
   * Get vectors by file IDs
   */
  async getByFileIds(fileIds: number[]): Promise<VectorChunk[]> {
    if (!this.client) {
      throw new Error('Weaviate client not initialized');
    }

    try {
      const chunks: VectorChunk[] = [];

      for (const fileId of fileIds) {
        const query = this.client.graphql
          .get()
          .withClassName('VectorChunk')
          .withFields('id content metadata _additional { vector }')
          .withWhere({
            path: ['fileId'],
            operator: 'Equal',
            valueNumber: fileId
          })
          .withLimit(1000);

        const result = await query.do();

        if (result.data?.Get?.VectorChunk) {
          chunks.push(...result.data.Get.VectorChunk.map((item: any) => ({
            id: item.id,
            content: item.content,
            embedding: item._additional.vector || [],
            metadata: JSON.parse(item.metadata || '{}')
          })));
        }
      }

      return chunks;
    } catch (error) {
      logger.error('Failed to get vectors by file IDs:', error);
      throw error;
    }
  }

  /**
   * Search with hybrid scoring (semantic + keyword)
   */
  async hybridSearch(
    query: string,
    queryEmbedding: number[],
    options: SearchOptions & {
      keywordWeight?: number;
      semanticWeight?: number;
    }
  ): Promise<SearchResult[]> {
    if (!this.client) {
      throw new Error('Weaviate client not initialized');
    }

    try {
      const limit = options.limit || 10;
      const keywordWeight = options.keywordWeight || 0.3;
      const semanticWeight = options.semanticWeight || 0.7;

      // Weaviate supports hybrid search through nearText with vector
      const query = this.client.graphql
        .get()
        .withClassName('VectorChunk')
        .withFields('id content metadata _additional { distance certainty }')
        .withHybrid({
          query: query,
          vector: queryEmbedding,
          alpha: semanticWeight // Weight for semantic vs keyword search
        })
        .withLimit(limit);

      const result = await query.do();

      if (!result.data?.Get?.VectorChunk) {
        return [];
      }

      return result.data.Get.VectorChunk.map((item: any) => ({
        chunk: {
          id: item.id,
          content: item.content,
          embedding: queryEmbedding,
          metadata: JSON.parse(item.metadata || '{}')
        },
        similarity: item._additional.certainty || 0
      }));
    } catch (error) {
      logger.error('Failed to perform hybrid search in Weaviate:', error);
      throw error;
    }
  }

  /**
   * Get recommendations based on user behavior
   */
  async getRecommendations(
    userId: string,
    currentFileId: number,
    options: {
      limit?: number;
      excludeCurrentFile?: boolean;
    }
  ): Promise<VectorChunk[]> {
    // Simplified implementation for Weaviate
    return [];
  }

  /**
   * Get trending content based on recent activity
   */
  async getTrendingContent(
    workspaceId: number,
    options: {
      limit?: number;
      timeWindow?: number;
    }
  ): Promise<VectorChunk[]> {
    if (!this.client) {
      throw new Error('Weaviate client not initialized');
    }

    try {
      const limit = options.limit || 10;

      const query = this.client.graphql
        .get()
        .withClassName('VectorChunk')
        .withFields('id content metadata _additional { vector }')
        .withWhere({
          path: ['workspaceId'],
          operator: 'Equal',
          valueNumber: workspaceId
        })
        .withLimit(limit)
        .withSort([{ path: ['_creationTimeUnix'], order: 'desc' }]);

      const result = await query.do();

      if (!result.data?.Get?.VectorChunk) {
        return [];
      }

      return result.data.Get.VectorChunk.map((item: any) => ({
        id: item.id,
        content: item.content,
        embedding: item._additional.vector || [],
        metadata: JSON.parse(item.metadata || '{}')
      }));
    } catch (error) {
      logger.error('Failed to get trending content from Weaviate:', error);
      throw error;
    }
  }

  /**
   * Search with filters
   */
  async searchWithFilters(
    queryEmbedding: number[],
    filters: {
      language?: string;
      fileType?: string;
      minTokens?: number;
      maxTokens?: number;
      dateRange?: { start: Date; end: Date };
    },
    options: SearchOptions
  ): Promise<SearchResult[]> {
    if (!this.client) {
      throw new Error('Weaviate client not initialized');
    }

    try {
      const limit = options.limit || 10;
      const threshold = options.threshold || 0.1;

      // Build where clause from filters
      const whereConditions: any[] = [];

      if (filters.language) {
        whereConditions.push({
          path: ['language'],
          operator: 'Equal',
          valueString: filters.language
        });
      }

      if (filters.minTokens) {
        whereConditions.push({
          path: ['tokens'],
          operator: 'GreaterThanEqual',
          valueNumber: filters.minTokens
        });
      }

      if (filters.maxTokens) {
        whereConditions.push({
          path: ['tokens'],
          operator: 'LessThanEqual',
          valueNumber: filters.maxTokens
        });
      }

      let whereClause: any = {};
      if (whereConditions.length > 0) {
        whereClause = {
          operator: 'And',
          operands: whereConditions
        };
      }

      const query = this.client.graphql
        .get()
        .withClassName('VectorChunk')
        .withFields('id content metadata _additional { distance certainty }')
        .withWhere(whereClause)
        .withNearVector({
          vector: queryEmbedding,
          distance: 1 - threshold
        })
        .withLimit(limit);

      const result = await query.do();

      if (!result.data?.Get?.VectorChunk) {
        return [];
      }

      return result.data.Get.VectorChunk.map((item: any) => ({
        chunk: {
          id: item.id,
          content: item.content,
          embedding: queryEmbedding,
          metadata: JSON.parse(item.metadata || '{}')
        },
        similarity: item._additional.certainty || 0
      }));
    } catch (error) {
      logger.error('Failed to search with filters in Weaviate:', error);
      throw error;
    }
  }

  /**
   * Get content analytics
   */
  async getAnalytics(workspaceId: number): Promise<{
    totalFiles: number;
    totalChunks: number;
    languageBreakdown: Record<string, number>;
    recentActivity: Array<{
      date: Date;
      filesAdded: number;
      searchesPerformed: number;
    }>;
  }> {
    if (!this.client) {
      throw new Error('Weaviate client not initialized');
    }

    try {
      // Get total counts
      const countQuery = this.client.graphql
        .aggregate()
        .withClassName('VectorChunk')
        .withWhere({
          path: ['workspaceId'],
          operator: 'Equal',
          valueNumber: workspaceId
        })
        .withFields('meta { count }');

      const countResult = await countQuery.do();
      const totalChunks = countResult.data.Aggregate.VectorChunk[0]?.meta?.count || 0;

      // Get unique file count
      const fileQuery = this.client.graphql
        .aggregate()
        .withClassName('VectorChunk')
        .withWhere({
          path: ['workspaceId'],
          operator: 'Equal',
          valueNumber: workspaceId
        })
        .withGroupBy(['fileId'])
        .withFields('groupedBy { value } meta { count }');

      const fileResult = await fileQuery.do();

      const totalFiles = fileResult.data.Aggregate.VectorChunk.length || 0;

      // Get language breakdown
      const languageQuery = this.client.graphql
        .aggregate()
        .withClassName('VectorChunk')
        .withWhere({
          path: ['workspaceId'],
          operator: 'Equal',
          valueNumber: workspaceId
        })
        .withGroupBy(['language'])
        .withFields('groupedBy { value } meta { count }');

      const languageResult = await languageQuery.do();

      const languageBreakdown: Record<string, number> = {};
      languageResult.data.Aggregate.VectorChunk.forEach((group: any) => {
        if (group.groupedBy.value) {
          languageBreakdown[group.groupedBy.value] = group.meta.count;
        }
      });

      return {
        totalFiles,
        totalChunks,
        languageBreakdown,
        recentActivity: [
          {
            date: new Date(),
            filesAdded: totalFiles,
            searchesPerformed: 0 // Would need search tracking
          }
        ]
      };
    } catch (error) {
      logger.error('Failed to get Weaviate analytics:', error);
      throw error;
    }
  }

  /**
   * Get the underlying Weaviate client
   */
  getClient(): any {
    return this.client;
  }

  /**
   * Get configuration
   */
  getConfig(): WeaviateConfig {
    return { ...this.config };
  }
}

// Export singleton instance for global use
export const weaviateClient = new WeaviateClient({
  host: process.env.WEAVIATE_HOST || 'localhost',
  port: parseInt(process.env.WEAVIATE_PORT || '8080'),
  protocol: (process.env.WEAVIATE_PROTOCOL as 'http' | 'https') || 'http',
  apiKey: process.env.WEAVIATE_API_KEY,
  openaiApiKey: process.env.OPENAI_API_KEY,
  model: process.env.WEAVIATE_MODEL || 'text-embedding-ada-002'
});
