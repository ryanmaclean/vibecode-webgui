/**
 * Redis Vector Database Adapter
 * Implementation of vector database operations using Redis
 */

import { BaseVectorDatabaseAdapter } from './base-vector-database-adapter';
import { VectorDatabaseConfig, VectorDatabaseProvider } from './vector-types';
import { VectorChunk, SearchResult, SearchOptions } from './vector-types';
import { VectorDbErrorHandler, VectorDbErrorType } from './vector-db-error-handler';

/**
 * Redis-specific configuration options
 */
export interface RedisVectorDatabaseConfig extends VectorDatabaseConfig {
  provider: VectorDatabaseProvider.REDIS;
  keyPrefix?: string;
  ttl?: number; // Default TTL for vectors in seconds
}

/**
 * Redis Vector Database Adapter
 */
export class RedisVectorDatabaseAdapter extends BaseVectorDatabaseAdapter {
  private redis: any = null; // Redis client
  private redisConfig: RedisVectorDatabaseConfig;
  private errorHandler: VectorDbErrorHandler;

  /**
   * Constructor for Redis Vector Database Adapter
   */
  constructor(config: RedisVectorDatabaseConfig) {
    super(config);
    this.redisConfig = config;
    this.errorHandler = new VectorDbErrorHandler();
  }

  /**
   * Initialize the Redis vector database connection
   */
  async initialize(): Promise<void> {
    try {
      // Initialize Redis client
      const { createClient } = await import('redis');
      this.redis = createClient({
        url: this.redisConfig.connectionString,
        socket: {
          host: this.redisConfig.host,
          port: this.redisConfig.port,
        },
        password: this.redisConfig.password,
        database: this.redisConfig.database || 0
      });

      this.redis.on('error', (error: Error) => {
        console.error('Redis client error:', error);
      });

      await this.redis.connect();

      this.isInitialized = true;
      console.log('Redis vector database adapter initialized successfully');

    } catch (error) {
      const vectorDbError = this.errorHandler.handleError(error, 'initialize');
      throw vectorDbError;
    }
  }

  /**
   * Close the Redis connection
   */
  async close(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
    }
    this.isInitialized = false;
  }

  /**
   * Check if the Redis connection is healthy
   */
  async ping(): Promise<boolean> {
    try {
      if (!this.redis) return false;

      await this.redis.ping();
      return true;
    } catch (error) {
      console.error('Redis ping failed:', error);
      return false;
    }
  }

  /**
   * Check if connected to Redis
   */
  isConnected(): boolean {
    return this.redis !== null && this.isInitialized;
  }

  /**
   * Store vector embeddings for the given chunks
   */
  async store(chunks: VectorChunk[]): Promise<number> {
    if (!this.redis) {
      throw new Error('Redis not initialized');
    }

    try {
      let storedCount = 0;
      const keyPrefix = this.redisConfig.keyPrefix || 'vector:';

      for (const chunk of chunks) {
        const key = `${keyPrefix}chunk:${chunk.id}`;
        const data = {
          id: chunk.id,
          content: chunk.content,
          embedding: chunk.embedding,
          metadata: chunk.metadata,
          storedAt: new Date().toISOString()
        };

        // Store the vector data
        await this.redis.set(key, JSON.stringify(data));

        // Set TTL if configured
        if (this.redisConfig.ttl) {
          await this.redis.expire(key, this.redisConfig.ttl);
        }

        // Add to search index (simplified - in production would use Redisearch or similar)
        await this.addToSearchIndex(chunk);

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
    if (!this.redis) {
      throw new Error('Redis not initialized');
    }

    try {
      const limit = options.limit || 10;
      const threshold = options.threshold || 0.1;

      // Get all vector keys for similarity search
      const keys = await this.redis.keys(`${this.redisConfig.keyPrefix || 'vector:'}chunk:*`);

      if (keys.length === 0) {
        return [];
      }

      // Get all vectors for comparison (in production, this would be optimized)
      const vectors: Array<{
        key: string;
        data: any;
        similarity: number;
      }> = [];

      for (const key of keys) {
        const data = await this.redis.get(key);
        if (data) {
          try {
            const parsed = JSON.parse(data);
            const similarity = this.calculateCosineSimilarity(queryEmbedding, parsed.embedding);

            if (similarity > threshold) {
              vectors.push({
                key,
                data: parsed,
                similarity
              });
            }
          } catch (parseError) {
            console.warn(`Failed to parse vector data for key ${key}:`, parseError);
          }
        }
      }

      // Sort by similarity and return top results
      vectors.sort((a, b) => b.similarity - a.similarity);

      return vectors.slice(0, limit).map(vector => ({
        chunk: {
          id: vector.data.id,
          content: vector.data.content,
          embedding: vector.data.embedding,
          metadata: vector.data.metadata || {}
        },
        similarity: vector.similarity
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
    if (!this.redis) {
      throw new Error('Redis not initialized');
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
    if (!this.redis) {
      throw new Error('Redis not initialized');
    }

    try {
      let deletedCount = 0;
      const keyPrefix = this.redisConfig.keyPrefix || 'vector:';

      for (const id of ids) {
        const key = `${keyPrefix}chunk:${id}`;

        // Delete the vector data
        const deleted = await this.redis.del(key);
        if (deleted > 0) {
          deletedCount++;

          // Remove from search index
          await this.removeFromSearchIndex(id);
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
    if (!this.redis) {
      throw new Error('Redis not initialized');
    }

    try {
      const keyPrefix = this.redisConfig.keyPrefix || 'vector:';
      const keys = await this.redis.keys(`${keyPrefix}chunk:*`);

      // Get the most recently updated vector
      let lastUpdated = new Date();
      if (keys.length > 0) {
        const sampleKey = keys[0];
        const data = await this.redis.get(sampleKey);
        if (data) {
          const parsed = JSON.parse(data);
          lastUpdated = new Date(parsed.storedAt || Date.now());
        }
      }

      return {
        totalVectors: keys.length,
        indexSize: keys.length * 1000, // Rough estimate
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
    if (!this.redis) {
      throw new Error('Redis not initialized');
    }

    try {
      const keyPrefix = this.redisConfig.keyPrefix || 'vector:';
      const pattern = `${keyPrefix}chunk:*`;

      // Get all keys matching the pattern
      const keys = await this.redis.keys(pattern);

      if (keys.length > 0) {
        await this.redis.del(keys);
      }

      // Clear search index
      await this.clearSearchIndex();
    } catch (error) {
      const vectorDbError = this.errorHandler.handleError(error, 'clear');
      throw vectorDbError;
    }
  }

  /**
   * Create an index for the given field if it doesn't exist
   */
  async createIndex(field: string, options?: any): Promise<void> {
    // Redis doesn't have traditional indexes like SQL databases
    // This would integrate with Redisearch or similar for vector indexing
    console.log(`Index creation requested for field: ${field}`);
  }

  /**
   * Delete an index for the given field
   */
  async deleteIndex(field: string): Promise<void> {
    // Redis index deletion would be handled here
    console.log(`Index deletion requested for field: ${field}`);
  }

  /**
   * Get all available indexes
   */
  async getIndexes(): Promise<string[]> {
    // Return available Redisearch indexes or similar
    return [];
  }

  /**
   * Invalidate cache for specific table and content type
   */
  async invalidateCache(table: string, contentType?: string): Promise<number> {
    // Redis doesn't have traditional cache invalidation
    // This would integrate with your caching layer
    return 0;
  }

  /**
   * Get vector by ID
   */
  async getById(id: string): Promise<VectorChunk | null> {
    if (!this.redis) {
      throw new Error('Redis not initialized');
    }

    try {
      const keyPrefix = this.redisConfig.keyPrefix || 'vector:';
      const key = `${keyPrefix}chunk:${id}`;

      const data = await this.redis.get(key);
      if (!data) return null;

      const parsed = JSON.parse(data);

      return {
        id: parsed.id,
        content: parsed.content,
        embedding: parsed.embedding,
        metadata: parsed.metadata || {}
      };
    } catch (error) {
      const vectorDbError = this.errorHandler.handleError(error, 'getById');
      throw vectorDbError;
    }
  }

  /**
   * Update vector by ID
   */
  async update(id: string, chunk: Partial<VectorChunk>): Promise<boolean> {
    if (!this.redis) {
      throw new Error('Redis not initialized');
    }

    try {
      const keyPrefix = this.redisConfig.keyPrefix || 'vector:';
      const key = `${keyPrefix}chunk:${id}`;

      const existing = await this.redis.get(key);
      if (!existing) return false;

      const current = JSON.parse(existing);
      const updated = {
        ...current,
        ...chunk,
        updatedAt: new Date().toISOString()
      };

      await this.redis.set(key, JSON.stringify(updated));

      // Set TTL if configured
      if (this.redisConfig.ttl) {
        await this.redis.expire(key, this.redisConfig.ttl);
      }

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
    if (!this.redis) {
      throw new Error('Redis not initialized');
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
    // For Redis, we'd need to implement workspace-based filtering
    // This is a simplified implementation
    return this.searchWithVector(queryEmbedding, options);
  }

  /**
   * Get vectors by file IDs
   */
  async getByFileIds(fileIds: number[]): Promise<VectorChunk[]> {
    if (!this.redis) {
      throw new Error('Redis not initialized');
    }

    try {
      const chunks: VectorChunk[] = [];
      const keyPrefix = this.redisConfig.keyPrefix || 'vector:';

      for (const fileId of fileIds) {
        // Find vectors by file ID in metadata
        const keys = await this.redis.keys(`${keyPrefix}chunk:*`);

        for (const key of keys) {
          const data = await this.redis.get(key);
          if (data) {
            const parsed = JSON.parse(data);
            if (parsed.metadata && parsed.metadata.fileId === fileId) {
              chunks.push({
                id: parsed.id,
                content: parsed.content,
                embedding: parsed.embedding,
                metadata: parsed.metadata || {}
              });
            }
          }
        }
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
    // For Redis, hybrid search would need more complex implementation
    // For now, fall back to semantic search
    return this.searchWithVector(queryEmbedding, options);
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
    // Simplified implementation for Redis
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
    // Simplified implementation for Redis
    return [];
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
    // Simplified implementation for Redis
    return this.searchWithVector(queryEmbedding, options);
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
    // Simplified implementation for Redis
    return {
      totalFiles: 0,
      totalChunks: 0,
      languageBreakdown: {},
      recentActivity: []
    };
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private calculateCosineSimilarity(vectorA: number[], vectorB: number[]): number {
    if (vectorA.length !== vectorB.length) {
      throw new Error('Vectors must have the same dimensions');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vectorA.length; i++) {
      dotProduct += vectorA[i] * vectorB[i];
      normA += vectorA[i] * vectorA[i];
      normB += vectorB[i] * vectorB[i];
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Add vector to search index (simplified implementation)
   */
  private async addToSearchIndex(chunk: VectorChunk): Promise<void> {
    // In a production implementation, this would add to Redisearch or similar
    const indexKey = `${this.redisConfig.keyPrefix || 'vector:'}index:chunks`;

    // Store a reference for search purposes
    await this.redis.sAdd(indexKey, chunk.id);
  }

  /**
   * Remove vector from search index
   */
  private async removeFromSearchIndex(id: string): Promise<void> {
    const indexKey = `${this.redisConfig.keyPrefix || 'vector:'}index:chunks`;
    await this.redis.sRem(indexKey, id);
  }

  /**
   * Clear search index
   */
  private async clearSearchIndex(): Promise<void> {
    const indexKey = `${this.redisConfig.keyPrefix || 'vector:'}index:chunks`;
    await this.redis.del(indexKey);
  }
}
