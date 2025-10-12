/**
 * CosmosDB Vector Database Adapter
 * Implementation of vector database operations using Azure Cosmos DB
 */

import { BaseVectorDatabaseAdapter } from './base-vector-database-adapter';
import { VectorDatabaseConfig, VectorDatabaseProvider } from './vector-types';
import { VectorChunk, SearchResult, SearchOptions } from './vector-types';
import { VectorDbErrorHandler, VectorDbErrorType } from './vector-db-error-handler';
import { logger } from '@/lib/logger';
/**
 * CosmosDB-specific configuration options
 */
export interface CosmosDbVectorDatabaseConfig extends VectorDatabaseConfig {
  provider: VectorDatabaseProvider.COSMOSDB;
  endpoint: string;
  key: string;
  database: string;
  container: string;
  partitionKey?: string;
  consistencyLevel?: 'Strong' | 'BoundedStaleness' | 'Session' | 'ConsistentPrefix' | 'Eventual';
}

/**
 * CosmosDB Vector Database Adapter
 */
export class CosmosDbVectorDatabaseAdapter extends BaseVectorDatabaseAdapter {
  private cosmosConfig: CosmosDbVectorDatabaseConfig;
  private errorHandler: VectorDbErrorHandler;
  private client: any = null; // CosmosClient
  private database: any = null;
  private container: any = null;

  /**
   * Constructor for CosmosDB Vector Database Adapter
   */
  constructor(config: CosmosDbVectorDatabaseConfig) {
    super(config);
    this.cosmosConfig = config;
    this.errorHandler = new VectorDbErrorHandler();
  }

  /**
   * Initialize the CosmosDB vector database connection
   */
  async initialize(): Promise<void> {
    try {
      // Initialize CosmosDB client
      const { CosmosClient } = await import('@azure/cosmos');

      this.client = new CosmosClient({
        endpoint: this.cosmosConfig.endpoint,
        key: this.cosmosConfig.key,
        connectionPolicy: {
          requestTimeout: 60000,
          retryOptions: {
            maxRetryAttemptCount: 3,
            fixedRetryIntervalInMilliseconds: 1000
          }
        }
      });

      // Get database and container
      this.database = this.client.database(this.cosmosConfig.database);
      this.container = this.database.container(this.cosmosConfig.container);

      // Test connection by creating container if it doesn't exist
      await this.ensureContainer();

      this.isInitialized = true;
      logger.info('CosmosDB vector database adapter initialized successfully');

    } catch (error) {
      const vectorDbError = this.errorHandler.handleError(error, 'initialize');
      throw vectorDbError;
    }
  }

  /**
   * Close the CosmosDB connection
   */
  async close(): Promise<void> {
    if (this.client) {
      await this.client.dispose();
      this.client = null;
    }
    this.isInitialized = false;
  }

  /**
   * Check if the CosmosDB connection is healthy
   */
  async ping(): Promise<boolean> {
    try {
      if (!this.database) return false;

      await this.database.read();
      return true;
    } catch (error) {
      logger.error('CosmosDB ping failed:', error);
      return false;
    }
  }

  /**
   * Check if connected to CosmosDB
   */
  isConnected(): boolean {
    return this.client !== null && this.isInitialized;
  }

  /**
   * Ensure the vector container exists
   */
  private async ensureContainer(): Promise<void> {
    try {
      // Try to read the container
      await this.container.read();
    } catch (error: any) {
      if (error.code === 404) {
        // Container doesn't exist, create it
        logger.info('Creating CosmosDB container for vectors...');

        const partitionKey = this.cosmosConfig.partitionKey || '/workspaceId';

        await this.database.containers.createIfNotExists({
          id: this.cosmosConfig.container,
          partitionKey: partitionKey,
          indexingPolicy: {
            indexingMode: 'consistent',
            includedPaths: [
              {
                path: '/*'
              }
            ],
            excludedPaths: [
              {
                path: '/embedding/*'
              }
            ]
          },
          vectorEmbeddingPolicy: {
            vectorEmbeddings: [
              {
                path: '/embedding',
                dataType: 'float32',
                distanceFunction: 'cosine',
                dimensions: 1536
              }
            ]
          }
        });
      } else {
        throw error;
      }
    }
  }

  /**
   * Store vector embeddings for the given chunks
   */
  async store(chunks: VectorChunk[]): Promise<number> {
    if (!this.container) {
      throw new Error('Container not initialized');
    }

    try {
      let storedCount = 0;

      for (const chunk of chunks) {
        const document = {
          id: chunk.id,
          content: chunk.content,
          embedding: chunk.embedding,
          metadata: chunk.metadata,
          workspaceId: chunk.metadata.fileId || 0,
          fileId: chunk.metadata.fileId || 0,
          fileName: chunk.metadata.fileName || '',
          language: chunk.metadata.language || '',
          tokens: chunk.metadata.tokens || 0,
          type: 'vector_chunk',
          createdAt: new Date(),
          updatedAt: new Date()
        };

        // Upsert the document
        await this.container.items.upsert(document);
        storedCount++;
      }

      return storedCount;
    } catch (error) {
      const vectorDbError = this.errorHandler.handleError(error, 'store');
      throw vectorDbError;
    }
  }

  /**
   * Search for similar vectors using the provided query embedding
   */
  async searchWithVector(
    queryEmbedding: number[],
    options: SearchOptions
  ): Promise<SearchResult[]> {
    if (!this.container) {
      throw new Error('Container not initialized');
    }

    try {
      const limit = options.limit || 10;
      const threshold = options.threshold || 0.1;

      // Use CosmosDB vector search
      const querySpec = {
        query: `
          SELECT TOP @limit
            c.id,
            c.content,
            c.embedding,
            c.metadata,
            VectorDistance(c.embedding, @queryEmbedding) as distance,
            1 - VectorDistance(c.embedding, @queryEmbedding) as similarity
          FROM c
          WHERE VectorDistance(c.embedding, @queryEmbedding) < (1 - @threshold)
          ORDER BY VectorDistance(c.embedding, @queryEmbedding)
        `,
        parameters: [
          { name: '@limit', value: limit },
          { name: '@queryEmbedding', value: queryEmbedding },
          { name: '@threshold', value: threshold }
        ]
      };

      const { resources } = await this.container.items.query(querySpec).fetchAll();

      return resources.map((resource: any) => ({
        chunk: {
          id: resource.id,
          content: resource.content,
          embedding: resource.embedding,
          metadata: resource.metadata || {}
        },
        similarity: parseFloat(resource.similarity)
      }));
    } catch (error) {
      const vectorDbError = this.errorHandler.handleError(error, 'searchWithVector');
      throw vectorDbError;
    }
  }

  /**
   * Search for similar vectors using text query (generates embedding internally)
   */
  async searchWithText(
    query: string,
    options: SearchOptions
  ): Promise<SearchResult[]> {
    if (!this.container) {
      throw new Error('Container not initialized');
    }

    try {
      // Generate embedding for the text query (placeholder)
      const queryEmbedding = await this.generateEmbedding(query);

      return this.searchWithVector(queryEmbedding, options);
    } catch (error) {
      const vectorDbError = this.errorHandler.handleError(error, 'searchWithText');
      throw vectorDbError;
    }
  }

  /**
   * Delete vectors by their IDs
   */
  async delete(ids: string[]): Promise<number> {
    if (!this.container) {
      throw new Error('Container not initialized');
    }

    try {
      let deletedCount = 0;

      for (const id of ids) {
        try {
          await this.container.item(id, id).delete();
          deletedCount++;
        } catch (error: any) {
          // Item might not exist, which is fine
          if (error.code !== 404) {
            throw error;
          }
        }
      }

      return deletedCount;
    } catch (error) {
      const vectorDbError = this.errorHandler.handleError(error, 'delete');
      throw vectorDbError;
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
    if (!this.container) {
      throw new Error('Container not initialized');
    }

    try {
      const { resources } = await this.container.items.query(`
        SELECT VALUE COUNT(1) FROM c WHERE c.type = 'vector_chunk'
      `).fetchAll();

      const totalVectors = resources[0] || 0;

      // Get the most recently updated vector
      const { resources: recentResources } = await this.container.items.query(`
        SELECT TOP 1 c._ts FROM c WHERE c.type = 'vector_chunk' ORDER BY c._ts DESC
      `).fetchAll();

      const lastUpdated = recentResources.length > 0
        ? new Date(recentResources[0]._ts * 1000)
        : new Date();

      return {
        totalVectors,
        indexSize: totalVectors * 1000, // Rough estimate
        lastUpdated
      };
    } catch (error) {
      const vectorDbError = this.errorHandler.handleError(error, 'getStats');
      throw vectorDbError;
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
    if (!this.container) {
      throw new Error('Container not initialized');
    }

    try {
      // Query all vector chunks
      const { resources } = await this.container.items.query(`
        SELECT c.id FROM c WHERE c.type = 'vector_chunk'
      `).fetchAll();

      // Delete in batches
      const batchSize = 100;
      for (let i = 0; i < resources.length; i += batchSize) {
        const batch = resources.slice(i, i + batchSize);
        await Promise.all(
          batch.map(resource => this.container.item(resource.id, resource.id).delete())
        );
      }
    } catch (error) {
      const vectorDbError = this.errorHandler.handleError(error, 'clear');
      throw vectorDbError;
    }
  }

  /**
   * Create an index for the given field if it doesn't exist
   */
  async createIndex(field: string, options?: any): Promise<void> {
    // CosmosDB handles vector indexing through the vectorEmbeddingPolicy
    // This is configured when the container is created
    logger.info(`Vector index for ${field} is handled by CosmosDB container configuration`);
  }

  /**
   * Delete an index for the given field
   */
  async deleteIndex(field: string): Promise<void> {
    // Vector indexes in CosmosDB are managed at the container level
    logger.info(`Vector index deletion for ${field} is handled by CosmosDB container management`);
  }

  /**
   * Get all available indexes
   */
  async getIndexes(): Promise<string[]> {
    // CosmosDB vector indexes are part of the container configuration
    return ['embedding_vector_index']; // Placeholder
  }

  /**
   * Invalidate cache for specific table and content type
   */
  async invalidateCache(table: string, contentType?: string): Promise<number> {
    // CosmosDB doesn't have traditional cache invalidation
    // This would integrate with your caching layer
    return 0;
  }

  /**
   * Get vector by ID
   */
  async getById(id: string): Promise<VectorChunk | null> {
    if (!this.container) {
      throw new Error('Container not initialized');
    }

    try {
      const { resource } = await this.container.item(id, id).read();

      if (!resource) return null;

      return {
        id: resource.id,
        content: resource.content,
        embedding: resource.embedding,
        metadata: resource.metadata || {}
      };
    } catch (error: any) {
      if (error.code === 404) {
        return null; // Item not found
      }

      const vectorDbError = this.errorHandler.handleError(error, 'getById');
      throw vectorDbError;
    }
  }

  /**
   * Update vector by ID
   */
  async update(id: string, chunk: Partial<VectorChunk>): Promise<boolean> {
    if (!this.container) {
      throw new Error('Container not initialized');
    }

    try {
      const existing = await this.getById(id);
      if (!existing) return false;

      const updated = {
        ...existing,
        ...chunk,
        updatedAt: new Date()
      };

      await this.container.items.upsert(updated);
      return true;
    } catch (error) {
      const vectorDbError = this.errorHandler.handleError(error, 'update');
      throw vectorDbError;
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
    if (!this.container) {
      throw new Error('Container not initialized');
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
      const vectorDbError = this.errorHandler.handleError(error, 'batch');
      throw vectorDbError;
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
    if (!this.container) {
      throw new Error('Container not initialized');
    }

    try {
      const limit = options.limit || 10;
      const threshold = options.threshold || 0.1;

      const querySpec = {
        query: `
          SELECT TOP @limit
            c.id,
            c.content,
            c.embedding,
            c.metadata,
            VectorDistance(c.embedding, @queryEmbedding) as distance,
            1 - VectorDistance(c.embedding, @queryEmbedding) as similarity
          FROM c
          WHERE c.workspaceId = @workspaceId
          AND VectorDistance(c.embedding, @queryEmbedding) < (1 - @threshold)
          ORDER BY VectorDistance(c.embedding, @queryEmbedding)
        `,
        parameters: [
          { name: '@limit', value: limit },
          { name: '@workspaceId', value: workspaceId },
          { name: '@queryEmbedding', value: queryEmbedding },
          { name: '@threshold', value: threshold }
        ]
      };

      const { resources } = await this.container.items.query(querySpec).fetchAll();

      return resources.map((resource: any) => ({
        chunk: {
          id: resource.id,
          content: resource.content,
          embedding: resource.embedding,
          metadata: resource.metadata || {}
        },
        similarity: parseFloat(resource.similarity)
      }));
    } catch (error) {
      const vectorDbError = this.errorHandler.handleError(error, 'searchByWorkspace');
      throw vectorDbError;
    }
  }

  /**
   * Get vectors by file IDs
   */
  async getByFileIds(fileIds: number[]): Promise<VectorChunk[]> {
    if (!this.container) {
      throw new Error('Container not initialized');
    }

    try {
      const chunks: VectorChunk[] = [];

      for (const fileId of fileIds) {
        const { resources } = await this.container.items.query({
          query: `
            SELECT c.id, c.content, c.embedding, c.metadata
            FROM c
            WHERE c.fileId = @fileId AND c.type = 'vector_chunk'
          `,
          parameters: [{ name: '@fileId', value: fileId }]
        }).fetchAll();

        chunks.push(...resources.map((resource: any) => ({
          id: resource.id,
          content: resource.content,
          embedding: resource.embedding,
          metadata: resource.metadata || {}
        })));
      }

      return chunks;
    } catch (error) {
      const vectorDbError = this.errorHandler.handleError(error, 'getByFileIds');
      throw vectorDbError;
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
    if (!this.container) {
      throw new Error('Container not initialized');
    }

    try {
      const limit = options.limit || 10;
      const keywordWeight = options.keywordWeight || 0.3;
      const semanticWeight = options.semanticWeight || 0.7;

      const querySpec = {
        query: `
          SELECT TOP @limit
            c.id,
            c.content,
            c.embedding,
            c.metadata,
            (${semanticWeight} * (1 - VectorDistance(c.embedding, @queryEmbedding)) +
             ${keywordWeight} * (CASE WHEN CONTAINS(c.content, @query) THEN 1 ELSE 0 END)) as combined_score
          FROM c
          WHERE CONTAINS(c.content, @query)
          ORDER BY (${semanticWeight} * (1 - VectorDistance(c.embedding, @queryEmbedding)) +
                   ${keywordWeight} * (CASE WHEN CONTAINS(c.content, @query) THEN 1 ELSE 0 END)) DESC
        `,
        parameters: [
          { name: '@limit', value: limit },
          { name: '@queryEmbedding', value: queryEmbedding },
          { name: '@query', value: query }
        ]
      };

      const { resources } = await this.container.items.query(querySpec).fetchAll();

      return resources.map((resource: any) => ({
        chunk: {
          id: resource.id,
          content: resource.content,
          embedding: resource.embedding,
          metadata: resource.metadata || {}
        },
        similarity: parseFloat(resource.combined_score)
      }));
    } catch (error) {
      const vectorDbError = this.errorHandler.handleError(error, 'hybridSearch');
      throw vectorDbError;
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
    if (!this.container) {
      throw new Error('Container not initialized');
    }

    try {
      const limit = options.limit || 5;
      let whereClause = '';

      if (options.excludeCurrentFile) {
        whereClause = 'AND c.fileId != @currentFileId';
      }

      const querySpec = {
        query: `
          SELECT TOP @limit c.id, c.content, c.embedding, c.metadata
          FROM c
          WHERE c.type = 'vector_chunk' ${whereClause}
          ORDER BY c._ts DESC
        `,
        parameters: [
          { name: '@limit', value: limit },
          ...(options.excludeCurrentFile ? [{ name: '@currentFileId', value: currentFileId }] : [])
        ]
      };

      const { resources } = await this.container.items.query(querySpec).fetchAll();

      return resources.map((resource: any) => ({
        id: resource.id,
        content: resource.content,
        embedding: resource.embedding,
        metadata: resource.metadata || {}
      }));
    } catch (error) {
      const vectorDbError = this.errorHandler.handleError(error, 'getRecommendations');
      throw vectorDbError;
    }
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
    if (!this.container) {
      throw new Error('Container not initialized');
    }

    try {
      const limit = options.limit || 10;

      const querySpec = {
        query: `
          SELECT TOP @limit c.id, c.content, c.embedding, c.metadata
          FROM c
          WHERE c.workspaceId = @workspaceId AND c.type = 'vector_chunk'
          ORDER BY c._ts DESC
        `,
        parameters: [
          { name: '@limit', value: limit },
          { name: '@workspaceId', value: workspaceId }
        ]
      };

      const { resources } = await this.container.items.query(querySpec).fetchAll();

      return resources.map((resource: any) => ({
        id: resource.id,
        content: resource.content,
        embedding: resource.embedding,
        metadata: resource.metadata || {}
      }));
    } catch (error) {
      const vectorDbError = this.errorHandler.handleError(error, 'getTrendingContent');
      throw vectorDbError;
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
    if (!this.container) {
      throw new Error('Container not initialized');
    }

    try {
      const limit = options.limit || 10;
      const threshold = options.threshold || 0.1;

      let whereClause = 'VectorDistance(c.embedding, @queryEmbedding) < (1 - @threshold)';
      const parameters: Array<{ name: string; value: any }> = [
        { name: '@queryEmbedding', value: queryEmbedding },
        { name: '@threshold', value: threshold },
        { name: '@limit', value: limit }
      ];

      if (filters.language) {
        whereClause += ' AND c.language = @language';
        parameters.push({ name: '@language', value: filters.language });
      }

      if (filters.minTokens) {
        whereClause += ' AND c.tokens >= @minTokens';
        parameters.push({ name: '@minTokens', value: filters.minTokens });
      }

      if (filters.maxTokens) {
        whereClause += ' AND c.tokens <= @maxTokens';
        parameters.push({ name: '@maxTokens', value: filters.maxTokens });
      }

      const querySpec = {
        query: `
          SELECT TOP @limit
            c.id,
            c.content,
            c.embedding,
            c.metadata,
            VectorDistance(c.embedding, @queryEmbedding) as distance,
            1 - VectorDistance(c.embedding, @queryEmbedding) as similarity
          FROM c
          WHERE ${whereClause}
          ORDER BY VectorDistance(c.embedding, @queryEmbedding)
        `,
        parameters
      };

      const { resources } = await this.container.items.query(querySpec).fetchAll();

      return resources.map((resource: any) => ({
        chunk: {
          id: resource.id,
          content: resource.content,
          embedding: resource.embedding,
          metadata: resource.metadata || {}
        },
        similarity: parseFloat(resource.similarity)
      }));
    } catch (error) {
      const vectorDbError = this.errorHandler.handleError(error, 'searchWithFilters');
      throw vectorDbError;
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
    if (!this.container) {
      throw new Error('Container not initialized');
    }

    try {
      // Get total counts
      const { resources: countResources } = await this.container.items.query({
        query: `
          SELECT
            COUNT(DISTINCT c.fileId) as totalFiles,
            COUNT(1) as totalChunks
          FROM c
          WHERE c.workspaceId = @workspaceId AND c.type = 'vector_chunk'
        `,
        parameters: [{ name: '@workspaceId', value: workspaceId }]
      }).fetchAll();

      const countRow = countResources[0] || { totalFiles: 0, totalChunks: 0 };

      // Get language breakdown
      const { resources: languageResources } = await this.container.items.query({
        query: `
          SELECT
            c.language,
            COUNT(1) as count
          FROM c
          WHERE c.workspaceId = @workspaceId AND c.type = 'vector_chunk' AND c.language IS NOT NULL
          GROUP BY c.language
        `,
        parameters: [{ name: '@workspaceId', value: workspaceId }]
      }).fetchAll();

      const languageBreakdown: Record<string, number> = {};
      languageResources.forEach((resource: any) => {
        if (resource.language) {
          languageBreakdown[resource.language] = resource.count;
        }
      });

      return {
        totalFiles: countRow.totalFiles || 0,
        totalChunks: countRow.totalChunks || 0,
        languageBreakdown,
        recentActivity: [
          {
            date: new Date(),
            filesAdded: countRow.totalFiles || 0,
            searchesPerformed: 0 // Would need search tracking
          }
        ]
      };
    } catch (error) {
      const vectorDbError = this.errorHandler.handleError(error, 'getAnalytics');
      throw vectorDbError;
    }
  }
}
