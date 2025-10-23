/**
 * PostgreSQL Vector Database Adapter
 * Implementation of vector database operations using PostgreSQL with pgvector extension
 */

import { PrismaClient } from '@prisma/client';
import { BaseVectorDatabaseAdapter } from './base-vector-database-adapter';
import { VectorDatabaseConfig, VectorDatabaseProvider } from './vector-types';
import { VectorChunk, SearchResult, SearchOptions } from './vector-types';
import { VectorDbErrorHandler, VectorDbErrorType } from './vector-db-error-handler';
import { VectorCacheInvalidator } from '../cache/vector-cache-invalidator';
import { PgVectorSearch } from '../cache/pgvector-search';
// import { logger } from '@/lib/logger';
/**
 * PostgreSQL-specific configuration options
 */
export interface PostgresVectorDatabaseConfig extends VectorDatabaseConfig {
  provider: VectorDatabaseProvider.POSTGRES;
  schema?: string;
  connectionLimit?: number;
  ssl?: boolean | object;
  enableLogging?: boolean;
  enableMetrics?: boolean;
}

/**
 * PostgreSQL Vector Database Adapter
 */
export class PostgresVectorDatabaseAdapter extends BaseVectorDatabaseAdapter {
  private prisma: PrismaClient | null = null;
  private postgresConfig: PostgresVectorDatabaseConfig;
  private errorHandler: VectorDbErrorHandler;
  private cacheInvalidator: VectorCacheInvalidator | null = null;
  private pgVectorSearch: PgVectorSearch | null = null;

  /**
   * Constructor for PostgreSQL Vector Database Adapter
   */
  constructor(config: PostgresVectorDatabaseConfig) {
    super(config);
    this.postgresConfig = config;
    this.errorHandler = new VectorDbErrorHandler();
  }

  /**
   * Initialize the PostgreSQL vector database connection
   */
  async initialize(): Promise<void> {
    try {
      // Initialize Prisma client
      this.prisma = new PrismaClient({
        log: this.postgresConfig.enableLogging ? ['query', 'error', 'warn'] : ['error'],
        datasources: {
          db: {
            url: this.postgresConfig.connectionString
          }
        }
      });

      // Test connection
      await this.prisma.$connect();

      // Initialize cache invalidator if caching is enabled
      if (this.postgresConfig.cacheEnabled) {
        this.cacheInvalidator = new VectorCacheInvalidator();
        this.pgVectorSearch = new PgVectorSearch(this.prisma);
      }

      this.isInitialized = true;
      console.info('PostgreSQL vector database adapter initialized successfully');

    } catch (error) {
      const vectorDbError = this.errorHandler.handleError(error, 'initialize');
      throw vectorDbError;
    }
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    if (this.prisma) {
      await this.prisma.$disconnect();
      this.prisma = null;
    }
    this.isInitialized = false;
  }

  /**
   * Check if the database connection is healthy
   */
  async ping(): Promise<boolean> {
    try {
      if (!this.prisma) return false;

      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      console.error('PostgreSQL ping failed:', error);
      return false;
    }
  }

  /**
   * Check if connected to database
   */
  isConnected(): boolean {
    return this.prisma !== null && this.isInitialized;
  }

  /**
   * Store vector embeddings for the given chunks
   */
  async store(chunks: VectorChunk[]): Promise<number> {
    if (!this.prisma) {
      throw new Error('Database not initialized');
    }

    try {
      let storedCount = 0;

      for (const chunk of chunks) {
        await this.prisma.vectorChunk.upsert({
          where: { id: chunk.id },
          update: {
            content: chunk.content,
            embedding: chunk.embedding,
            metadata: chunk.metadata,
            updatedAt: new Date()
          },
          create: {
            id: chunk.id,
            content: chunk.content,
            embedding: chunk.embedding,
            metadata: chunk.metadata,
            workspaceId: chunk.metadata.fileId || 0,
            fileId: chunk.metadata.fileId || 0,
            fileName: chunk.metadata.fileName || '',
            language: chunk.metadata.language || '',
            tokens: chunk.metadata.tokens || 0
          }
        });

        storedCount++;

        // Invalidate cache for this workspace
        if (this.cacheInvalidator && chunk.metadata.fileId) {
          await this.cacheInvalidator.invalidateWorkspaceCache(chunk.metadata.fileId);
        }
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
    if (!this.prisma) {
      throw new Error('Database not initialized');
    }

    try {
      const limit = options.limit || 10;
      const threshold = options.threshold || 0.1;

      // Use Prisma to query with cosine similarity
      const results = await this.prisma.$queryRaw`
        SELECT
          id,
          content,
          embedding,
          metadata,
          1 - (embedding <=> ${JSON.stringify(queryEmbedding)}::vector) as similarity
        FROM "VectorChunk"
        WHERE 1 - (embedding <=> ${JSON.stringify(queryEmbedding)}::vector) > ${threshold}
        ORDER BY embedding <=> ${JSON.stringify(queryEmbedding)}::vector
        LIMIT ${limit}
      `;

      return (results as any[]).map((row: any) => ({
        chunk: {
          id: row.id,
          content: row.content,
          embedding: row.embedding,
          metadata: row.metadata || {}
        },
        similarity: parseFloat(row.similarity)
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
    // For PostgreSQL, we'd need an embedding service to convert text to vectors
    // For now, fall back to content-based search
    if (!this.prisma) {
      throw new Error('Database not initialized');
    }

    try {
      const limit = options.limit || 10;

      const results = await this.prisma.vectorChunk.findMany({
        where: {
          content: {
            contains: query,
            mode: 'insensitive'
          }
        },
        take: limit,
        orderBy: {
          updatedAt: 'desc'
        }
      });

      return results.map(chunk => ({
        chunk: {
          id: chunk.id,
          content: chunk.content,
          embedding: chunk.embedding as number[],
          metadata: chunk.metadata as any
        },
        similarity: 0.5 // Default similarity for text-based search
      }));
    } catch (error) {
      const vectorDbError = this.errorHandler.handleError(error, 'searchWithText');
      throw vectorDbError;
    }
  }

  /**
   * Delete vectors by their IDs
   */
  async delete(ids: string[]): Promise<number> {
    if (!this.prisma) {
      throw new Error('Database not initialized');
    }

    try {
      const result = await this.prisma.vectorChunk.deleteMany({
        where: {
          id: {
            in: ids
          }
        }
      });

      return result.count;
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
    if (!this.prisma) {
      throw new Error('Database not initialized');
    }

    try {
      const stats = await this.prisma.vectorChunk.aggregate({
        _count: {
          id: true
        },
        _max: {
          updatedAt: true
        }
      });

      // Get approximate index size (this is a simplified calculation)
      const indexSize = stats._count.id * 1000; // Rough estimate

      return {
        totalVectors: stats._count.id,
        indexSize,
        lastUpdated: stats._max.updatedAt || new Date()
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
    if (!this.prisma) {
      throw new Error('Database not initialized');
    }

    try {
      await this.prisma.vectorChunk.deleteMany({});
    } catch (error) {
      const vectorDbError = this.errorHandler.handleError(error, 'clear');
      throw vectorDbError;
    }
  }

  /**
   * Create an index for the given field if it doesn't exist
   */
  async createIndex(field: string, options?: any): Promise<void> {
    if (!this.prisma) {
      throw new Error('Database not initialized');
    }

    try {
      // For pgvector, indexes are created using SQL
      // This is a simplified implementation
      await this.prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS ${field}_idx ON "VectorChunk" USING ivfflat (embedding vector_cosine_ops)
      `;
    } catch (error) {
      const vectorDbError = this.errorHandler.handleError(error, 'createIndex');
      throw vectorDbError;
    }
  }

  /**
   * Delete an index for the given field
   */
  async deleteIndex(field: string): Promise<void> {
    if (!this.prisma) {
      throw new Error('Database not initialized');
    }

    try {
      await this.prisma.$executeRaw`DROP INDEX IF EXISTS ${field}_idx`;
    } catch (error) {
      const vectorDbError = this.errorHandler.handleError(error, 'deleteIndex');
      throw vectorDbError;
    }
  }

  /**
   * Get all available indexes
   */
  async getIndexes(): Promise<string[]> {
    if (!this.prisma) {
      throw new Error('Database not initialized');
    }

    try {
      const indexes = await this.prisma.$queryRaw`
        SELECT indexname FROM pg_indexes WHERE tablename = 'VectorChunk'
      `;

      return (indexes as any[]).map((idx: any) => idx.indexname);
    } catch (error) {
      const vectorDbError = this.errorHandler.handleError(error, 'getIndexes');
      throw vectorDbError;
    }
  }

  /**
   * Invalidate cache for specific table and content type
   */
  async invalidateCache(table: string, contentType?: string): Promise<number> {
    if (!this.cacheInvalidator) {
      return 0;
    }

    try {
      return await this.cacheInvalidator.invalidateByContentType(contentType || table);
    } catch (error) {
      console.warn('Cache invalidation failed:', error);
      return 0;
    }
  }

  /**
   * Get vector by ID
   */
  async getById(id: string): Promise<VectorChunk | null> {
    if (!this.prisma) {
      throw new Error('Database not initialized');
    }

    try {
      const chunk = await this.prisma.vectorChunk.findUnique({
        where: { id }
      });

      if (!chunk) return null;

      return {
        id: chunk.id,
        content: chunk.content,
        embedding: chunk.embedding as number[],
        metadata: chunk.metadata as any
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
    if (!this.prisma) {
      throw new Error('Database not initialized');
    }

    try {
      const result = await this.prisma.vectorChunk.update({
        where: { id },
        data: {
          ...(chunk.content && { content: chunk.content }),
          ...(chunk.embedding && { embedding: chunk.embedding }),
          ...(chunk.metadata && { metadata: chunk.metadata }),
          updatedAt: new Date()
        }
      });

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
    if (!this.prisma) {
      throw new Error('Database not initialized');
    }

    let processedCount = 0;

    try {
      for (const operation of operations) {
        switch (operation.type) {
          case 'insert':
            if (operation.data) {
              await this.prisma.vectorChunk.create({
                data: {
                  id: operation.data.id,
                  content: operation.data.content,
                  embedding: operation.data.embedding,
                  metadata: operation.data.metadata,
                  workspaceId: operation.data.metadata.fileId || 0,
                  fileId: operation.data.metadata.fileId || 0,
                  fileName: operation.data.metadata.fileName || '',
                  language: operation.data.metadata.language || '',
                  tokens: operation.data.metadata.tokens || 0
                }
              });
              processedCount++;
            }
            break;

          case 'update':
            if (operation.id && operation.data) {
              await this.prisma.vectorChunk.update({
                where: { id: operation.id },
                data: {
                  ...(operation.data.content && { content: operation.data.content }),
                  ...(operation.data.embedding && { embedding: operation.data.embedding }),
                  ...(operation.data.metadata && { metadata: operation.data.metadata }),
                  updatedAt: new Date()
                }
              });
              processedCount++;
            }
            break;

          case 'delete':
            if (operation.id) {
              await this.prisma.vectorChunk.delete({
                where: { id: operation.id }
              });
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
    if (!this.prisma) {
      throw new Error('Database not initialized');
    }

    try {
      const limit = options.limit || 10;
      const threshold = options.threshold || 0.1;

      const results = await this.prisma.$queryRaw`
        SELECT
          id,
          content,
          embedding,
          metadata,
          1 - (embedding <=> ${JSON.stringify(queryEmbedding)}::vector) as similarity
        FROM "VectorChunk"
        WHERE workspaceId = ${workspaceId}
        AND 1 - (embedding <=> ${JSON.stringify(queryEmbedding)}::vector) > ${threshold}
        ORDER BY embedding <=> ${JSON.stringify(queryEmbedding)}::vector
        LIMIT ${limit}
      `;

      return (results as any[]).map((row: any) => ({
        chunk: {
          id: row.id,
          content: row.content,
          embedding: row.embedding,
          metadata: row.metadata || {}
        },
        similarity: parseFloat(row.similarity)
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
    if (!this.prisma) {
      throw new Error('Database not initialized');
    }

    try {
      const chunks = await this.prisma.vectorChunk.findMany({
        where: {
          fileId: {
            in: fileIds
          }
        }
      });

      return chunks.map(chunk => ({
        id: chunk.id,
        content: chunk.content,
        embedding: chunk.embedding as number[],
        metadata: chunk.metadata as any
      }));
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
    if (!this.prisma) {
      throw new Error('Database not initialized');
    }

    try {
      const limit = options.limit || 10;
      const keywordWeight = options.keywordWeight || 0.3;
      const semanticWeight = options.semanticWeight || 0.7;

      const results = await this.prisma.$queryRaw`
        SELECT
          id,
          content,
          embedding,
          metadata,
          (${semanticWeight} * (1 - (embedding <=> ${JSON.stringify(queryEmbedding)}::vector)) +
           ${keywordWeight} * similarity(content, ${query})) as combined_score
        FROM "VectorChunk"
        WHERE content % ${query}
        ORDER BY combined_score DESC
        LIMIT ${limit}
      `;

      return (results as any[]).map((row: any) => ({
        chunk: {
          id: row.id,
          content: row.content,
          embedding: row.embedding,
          metadata: row.metadata || {}
        },
        similarity: parseFloat(row.combined_score)
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
    if (!this.prisma) {
      throw new Error('Database not initialized');
    }

    try {
      const limit = options.limit || 5;
      const whereClause = options.excludeCurrentFile
        ? 'AND fileId != $2'
        : '';

      const results = await this.prisma.$queryRaw`
        SELECT id, content, embedding, metadata
        FROM "VectorChunk"
        WHERE userId = $1 ${whereClause}
        ORDER BY updatedAt DESC
        LIMIT $3
      ` as any[];

      return results.map((row: any) => ({
        id: row.id,
        content: row.content,
        embedding: row.embedding,
        metadata: row.metadata || {}
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
    if (!this.prisma) {
      throw new Error('Database not initialized');
    }

    try {
      const limit = options.limit || 10;
      const timeWindow = options.timeWindow || 24; // hours

      const cutoffDate = new Date();
      cutoffDate.setHours(cutoffDate.getHours() - timeWindow);

      const chunks = await this.prisma.vectorChunk.findMany({
        where: {
          workspaceId,
          updatedAt: {
            gte: cutoffDate
          }
        },
        orderBy: {
          updatedAt: 'desc'
        },
        take: limit
      });

      return chunks.map(chunk => ({
        id: chunk.id,
        content: chunk.content,
        embedding: chunk.embedding as number[],
        metadata: chunk.metadata as any
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
    if (!this.prisma) {
      throw new Error('Database not initialized');
    }

    try {
      const limit = options.limit || 10;
      const threshold = options.threshold || 0.1;

      let whereClause = '1 - (embedding <=> $1::vector) > $2';
      const values = [JSON.stringify(queryEmbedding), threshold];

      if (filters.language) {
        whereClause += ` AND language = $${values.length + 1}`;
        values.push(filters.language);
      }

      if (filters.minTokens) {
        whereClause += ` AND tokens >= $${values.length + 1}`;
        values.push(filters.minTokens.toString());
      }

      if (filters.maxTokens) {
        whereClause += ` AND tokens <= $${values.length + 1}`;
        values.push(filters.maxTokens.toString());
      }

      if (filters.dateRange) {
        whereClause += ` AND updatedAt >= $${values.length + 1} AND updatedAt <= $${values.length + 2}`;
        values.push(filters.dateRange.start.toISOString(), filters.dateRange.end.toISOString());
      }

      const query = `
        SELECT
          id,
          content,
          embedding,
          metadata,
          1 - (embedding <=> $${JSON.stringify(queryEmbedding)}::vector) as similarity
        FROM "VectorChunk"
        WHERE ${whereClause}
        ORDER BY embedding <=> $${JSON.stringify(queryEmbedding)}::vector
        LIMIT ${limit}
      `;

      const results = await this.prisma.$queryRawUnsafe(query, ...values);

      return (results as any[]).map((row: any) => ({
        chunk: {
          id: row.id,
          content: row.content,
          embedding: row.embedding,
          metadata: row.metadata || {}
        },
        similarity: parseFloat(row.similarity)
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
    if (!this.prisma) {
      throw new Error('Database not initialized');
    }

    try {
      // Get total counts
      const totalChunks = await this.prisma.vectorChunk.count({
        where: { workspaceId }
      });

      const uniqueFiles = await this.prisma.vectorChunk.findMany({
        where: { workspaceId },
        select: { fileId: true },
        distinct: ['fileId']
      });

      // Get language breakdown
      const languageStats = await this.prisma.vectorChunk.groupBy({
        by: ['language'],
        where: { workspaceId },
        _count: {
          id: true
        }
      });

      const languageBreakdown: Record<string, number> = {};
      languageStats.forEach(stat => {
        if (stat.language) {
          languageBreakdown[stat.language] = stat._count.id;
        }
      });

      // Get recent activity (simplified)
      const recentActivity = [
        {
          date: new Date(),
          filesAdded: uniqueFiles.length,
          searchesPerformed: 0 // Would need search tracking
        }
      ];

      return {
        totalFiles: uniqueFiles.length,
        totalChunks,
        languageBreakdown,
        recentActivity
      };
    } catch (error) {
      const vectorDbError = this.errorHandler.handleError(error, 'getAnalytics');
      throw vectorDbError;
    }
  }
}
