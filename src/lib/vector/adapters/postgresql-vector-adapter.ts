/**
 * PostgreSQL Vector Database Adapter - Canonical Implementation
 *
 * This is the consolidated implementation combining best features from:
 * - postgres-vector-database-adapter.ts
 * - postgres-vector-database-adapter-new.ts  
 * - postgresql-vector-adapter.ts (original)
 *
 * Features:
 * - Enhanced error handling with VectorDbErrorHandler
 * - Comprehensive metrics collection
 * - Multiple search methods (cosine, inner product, euclidean)
 * - pgVector extension verification
 * - Fallback text search
 * - Cache integration via IVectorCacheAdapter
 * - Interface-based architecture for better testability
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { BaseVectorDatabaseAdapter } from './base-vector-database-adapter';
import { IVectorEmbeddingProvider } from '../interfaces/vector-embedding-provider';
import { IVectorCacheAdapter } from '../interfaces/vector-cache-adapter';
import {
  SearchResult,
  VectorDatabaseConfig,
  VectorSearchOptions,
  VectorStoreStats
} from '../interfaces/vector-types';
import { VectorDbError, VectorDbErrorType, VectorDbErrorHandler } from '@/lib/vector-db/vector-db-error-handler';
import { metrics } from '@/lib/server-monitoring';
import { logger } from '@/lib/logger';

/**
 * PostgreSQL-specific configuration options
 */
export interface PostgreSQLVectorConfig extends VectorDatabaseConfig {
  pgPoolSize?: number;
  pgSchemaName?: string;
  pgVectorExtensionName?: string;
  pgSearchMethod?: 'cosine' | 'inner_product' | 'euclidean';
}

/**
 * PostgreSQL Vector Database Adapter
 * Provides pgvector-based vector storage and search with enhanced features
 */
export class PostgreSQLVectorAdapter extends BaseVectorDatabaseAdapter {
  private prisma: PrismaClient | null = null;
  private errorHandler: VectorDbErrorHandler;
  private postgresConfig: PostgreSQLVectorConfig;

  constructor(
    config: VectorDatabaseConfig,
    embeddingProvider: IVectorEmbeddingProvider,
    cacheAdapter?: IVectorCacheAdapter
  ) {
    super(config, embeddingProvider, cacheAdapter);

    // Initialize PostgreSQL-specific configuration
    this.postgresConfig = {
      pgPoolSize: 10,
      pgSchemaName: 'public',
      pgVectorExtensionName: 'vector',
      pgSearchMethod: 'cosine',
      ...config
    } as PostgreSQLVectorConfig;

    // Initialize error handler
    this.errorHandler = new VectorDbErrorHandler(
      'postgres',
      this.config.enableLogging || false,
      this.config.enableMetrics || false
    );
  }

  /**
   * Connect to the PostgreSQL database
   */
  async connect(): Promise<boolean> {
    try {
      // Create Prisma client with configuration
      this.prisma = new PrismaClient({
        datasources: {
          db: {
            url: this.config.connectionString || process.env.VECTOR_DB_CONNECTION_STRING || process.env.DATABASE_URL
          }
        },
        log: this.config.enableLogging ? ['error', 'warn'] : [],
        errorFormat: 'pretty'
      });

      // Connect to the database
      await this.prisma.$connect();

      // Verify pgVector extension is installed
      await this.verifyPgVectorExtension();

      this.isConnectionActive = true;

      if (this.config.enableLogging) {
        logger.info('PostgreSQL vector database adapter connected successfully');
      }

      return true;
    } catch (error) {
      logger.error('Failed to connect to PostgreSQL:', error);
      this.isConnectionActive = false;

      throw this.errorHandler.handleError(
        error,
        'connect',
        VectorDbErrorType.CONNECTION_FAILED,
        this.errorHandler.isNetworkError(error),
        {
          connectionString: this.config.connectionString ? '[REDACTED]' : undefined
        }
      );
    }
  }

  /**
   * Verify that the pgVector extension is installed and properly configured
   */
  private async verifyPgVectorExtension(): Promise<void> {
    if (!this.prisma) {
      throw this.errorHandler.handleError(
        new Error('Prisma client not initialized'),
        'verifyPgVectorExtension',
        VectorDbErrorType.INITIALIZATION
      );
    }

    try {
      // Check if vector extension is installed
      const extensionResult = await this.prisma.$queryRaw`
        SELECT extname FROM pg_extension WHERE extname = 'vector'
      `;

      if (!Array.isArray(extensionResult) || extensionResult.length === 0) {
        throw this.errorHandler.handleError(
          new Error('pgVector extension is not installed in the database'),
          'verifyPgVectorExtension',
          VectorDbErrorType.CONFIGURATION_ERROR,
          false,
          { extensionName: 'vector' }
        );
      }

      // Verify vector type exists
      const typeResult = await this.prisma.$queryRaw`
        SELECT typname FROM pg_type WHERE typname = 'vector'
      `;

      if (!Array.isArray(typeResult) || typeResult.length === 0) {
        throw this.errorHandler.handleError(
          new Error('Vector data type not found, pgVector extension may be incorrectly installed'),
          'verifyPgVectorExtension',
          VectorDbErrorType.CONFIGURATION_ERROR,
          false,
          { typeName: 'vector' }
        );
      }

      if (this.config.enableLogging) {
        logger.info('pgVector extension verified successfully');
      }
    } catch (error) {
      // Only wrap in our error handler if it's not already a VectorDbError
      if (!(error instanceof VectorDbError)) {
        throw this.errorHandler.handleError(
          error,
          'verifyPgVectorExtension',
          VectorDbErrorType.CONFIGURATION_ERROR,
          false,
          { extensionName: 'vector' }
        );
      }
      throw error;
    }
  }

  /**
   * Disconnect from the PostgreSQL database
   */
  async disconnect(): Promise<void> {
    if (this.prisma) {
      try {
        await this.prisma.$disconnect();
        this.prisma = null;
        this.isConnectionActive = false;

        if (this.config.enableLogging) {
          logger.info('Disconnected from PostgreSQL vector database');
        }
      } catch (error) {
        logger.error('Error disconnecting from PostgreSQL:', error);

        throw this.errorHandler.handleError(
          error,
          'disconnect',
          VectorDbErrorType.CONNECTION_FAILED,
          false
        );
      }
    }
  }

  /**
   * Store vector chunks in the database
   *
   * @param fileId - The file ID to associate chunks with
   * @param chunks - Array of text chunks with metadata
   */
  async storeVectors(fileId: number, chunks: Array<{
    content: string;
    startLine?: number;
    endLine?: number;
    tokens: number;
  }>): Promise<void> {
    if (!this.isConnectionActive || !this.prisma) {
      await this.connect();
    }

    if (!this.prisma) {
      throw this.errorHandler.handleError(
        new Error('PostgreSQL adapter not initialized'),
        'storeVectors',
        VectorDbErrorType.INITIALIZATION,
        true
      );
    }

    try {
      const startTime = Date.now();

      // Delete existing chunks for this file
      await this.prisma.rAGChunk.deleteMany({
        where: { file_id: fileId }
      });

      // Process chunks in batches to avoid rate limits
      const batchSize = 5;
      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);

        // Process each chunk individually to handle pgvector embedding insertion
        for (let j = 0; j < batch.length; j++) {
          const chunk = batch[j];
          const chunkId = `\${fileId}-chunk-\${i + j}`;

          // Generate embedding using the provider
          const embedding = await this.generateEmbedding(chunk.content);
          const embeddingString = `[\${embedding.join(',')}]`;

          try {
            // Use raw SQL to insert with pgvector embedding
            await this.prisma.$executeRawUnsafe(`
              INSERT INTO rag_chunks (file_id, chunk_id, content, start_line, end_line, tokens, embedding, metadata, created_at)
              VALUES ($1, $2, $3, $4, $5, $6, $7::vector, $8, NOW())
            `,
              fileId,
              chunkId,
              chunk.content,
              chunk.startLine || null,
              chunk.endLine || null,
              chunk.tokens,
              embeddingString,
              JSON.stringify({ generatedAt: new Date().toISOString() })
            );
          } catch (chunkError) {
            // Handle chunk insertion errors
            throw this.errorHandler.handleError(
              chunkError,
              'storeVectors.insertChunk',
              VectorDbErrorType.VECTOR_CREATION_FAILED,
              this.errorHandler.isNetworkError(chunkError),
              {
                fileId,
                chunkId,
                chunkIndex: i + j,
                contentLength: chunk.content.length,
                embeddingSize: embedding.length
              }
            );
          }
        }

        // Small delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Invalidate cache if cache adapter is available
      if (this.cacheAdapter) {
        try {
          await this.cacheAdapter.invalidateCache({ fileId });
        } catch (cacheError) {
          logger.warn('Failed to invalidate cache after storing vectors:', cacheError);
        }
      }

      if (this.config.enableMetrics) {
        metrics.histogram('postgres_vector_adapter.store_vectors.duration', Date.now() - startTime);
        metrics.increment('postgres_vector_adapter.store_vectors.success');
        metrics.gauge('postgres_vector_adapter.store_vectors.chunk_count', chunks.length);
      }

      if (this.config.enableLogging) {
        logger.info(`Stored \${chunks.length} chunks for file \${fileId}`);
      }
    } catch (error) {
      if (this.config.enableMetrics) {
        metrics.increment('postgres_vector_adapter.store_vectors.error');
      }

      // Only wrap if not already a VectorDbError
      if (!(error instanceof VectorDbError)) {
        throw this.errorHandler.handleError(
          error,
          'storeVectors',
          VectorDbErrorType.VECTOR_CREATION_FAILED,
          this.errorHandler.isNetworkError(error) || this.errorHandler.isTimeoutError(error),
          {
            fileId,
            chunkCount: chunks.length,
            totalTokens: chunks.reduce((sum, chunk) => sum + chunk.tokens, 0)
          }
        );
      }

      throw error;
    }
  }

  /**
   * Find similar vectors based on embedding
   *
   * @param embedding - The query embedding vector
   * @param options - Search options including filters and limits
   * @returns Array of search results with similarity scores
   */
  async findSimilar(embedding: number[], options: VectorSearchOptions): Promise<SearchResult[]> {
    if (!this.isConnectionActive || !this.prisma) {
      await this.connect();
    }

    if (!this.prisma) {
      throw this.errorHandler.handleError(
        new Error('PostgreSQL adapter not initialized'),
        'findSimilar',
        VectorDbErrorType.INITIALIZATION,
        true
      );
    }

    try {
      const startTime = Date.now();
      const { workspaceId, fileIds, limit = 10, threshold = 0.7, useCache = true } = options;

      // Check cache first if enabled
      if (useCache && this.cacheAdapter) {
        try {
          const cacheResult = await this.cacheAdapter.getCachedResults({
            embedding,
            limit,
            minSimilarity: threshold,
            filter: { workspaceId, fileIds }
          }, workspaceId?.toString());

          if (cacheResult && cacheResult.length > 0) {
            if (this.config.enableMetrics) {
              metrics.increment('postgres_vector_adapter.find_similar.cache_hit');
            }

            // Transform cache results to match our expected format
            return this.formatCacheResults(cacheResult);
          }
        } catch (cacheError) {
          logger.warn('Cache retrieval failed, falling back to direct query:', cacheError);

          if (this.config.enableMetrics) {
            metrics.increment('postgres_vector_adapter.find_similar.cache_miss');
          }
        }
      }

      // If cache miss or caching disabled, perform direct query
      const embeddingString = `[\${embedding.join(',')}]`;

      // Build WHERE clause for filtering
      const whereConditions: string[] = [];
      const params: (string | number | number[])[] = [];
      let paramIndex = 1;

      if (workspaceId) {
        whereConditions.push(`f.workspace_id = $\${paramIndex}`);
        params.push(workspaceId);
        paramIndex++;
      }

      if (fileIds && fileIds.length > 0) {
        whereConditions.push(`rc.file_id = ANY($\${paramIndex}::int[])`);
        params.push(`{\${fileIds.join(',')}}`);
        paramIndex++;
      }

      const whereClause = whereConditions.length > 0 ? `WHERE \${whereConditions.join(' AND ')}` : '';

      // Add embedding parameter
      const embeddingParamIndex = paramIndex++;
      const limitParamIndex = paramIndex++;

      // Determine distance operator based on search method
      let distanceOperator = '<=>'; // Cosine distance by default
      if (this.postgresConfig.pgSearchMethod === 'inner_product') {
        distanceOperator = '<#>'; // Inner product
      } else if (this.postgresConfig.pgSearchMethod === 'euclidean') {
        distanceOperator = '<->'; // Euclidean distance
      }

      // Calculate similarity expression based on search method
      const similarityExpression = this.postgresConfig.pgSearchMethod === 'inner_product'
        ? `(rc.embedding <#> $\${embeddingParamIndex}::vector) as similarity`
        : `(1 - (rc.embedding \${distanceOperator} $\${embeddingParamIndex}::vector)) as similarity`;

      // Order by expression differs for inner product
      const orderByExpression = this.postgresConfig.pgSearchMethod === 'inner_product'
        ? `ORDER BY rc.embedding <#> $\${embeddingParamIndex}::vector DESC`
        : `ORDER BY rc.embedding \${distanceOperator} $\${embeddingParamIndex}::vector`;

      const sql = `
        SELECT
          rc.chunk_id,
          rc.content,
          rc.start_line,
          rc.end_line,
          rc.tokens,
          rc.file_id,
          f.name as file_name,
          f.language,
          \${similarityExpression}
        FROM rag_chunks rc
        JOIN files f ON rc.file_id = f.id
        \${whereClause}
        \${orderByExpression}
        LIMIT $\${limitParamIndex}
      `;

      // Add parameters in the correct order
      params.push(embeddingString, limit);

      // Define interface for raw SQL result
      interface RawResult {
        chunk_id: string;
        content: string;
        start_line: number | null;
        end_line: number | null;
        tokens: number;
        file_id: number;
        file_name: string;
        language: string | null;
        similarity: number;
      }

      // Execute raw SQL query using Prisma
      const rawResults = await this.prisma.$queryRawUnsafe<RawResult[]>(sql, ...params);

      // Filter by threshold and format results
      let results: SearchResult[] = [];

      // For inner product, normalize scores to 0-1 range
      if (this.postgresConfig.pgSearchMethod === 'inner_product') {
        const scores = rawResults.map(row => row.similarity);
        const maxScore = Math.max(...scores);
        const minScore = Math.min(...scores);
        const range = maxScore - minScore;

        results = rawResults
          .map((row) => ({
            chunk: {
              id: row.chunk_id,
              content: row.content,
              embedding: [], // Don't return embedding in response for performance
              metadata: {
                fileId: row.file_id,
                fileName: row.file_name,
                startLine: row.start_line || undefined,
                endLine: row.end_line || undefined,
                language: row.language || undefined,
                tokens: row.tokens || 0
              }
            },
            similarity: range > 0 ? (row.similarity - minScore) / range : 0.5
          }))
          .filter((result) => result.similarity >= threshold);
      } else {
        // For cosine and euclidean, use similarity directly
        results = rawResults
          .filter((row) => row.similarity >= threshold)
          .map((row) => ({
            chunk: {
              id: row.chunk_id,
              content: row.content,
              embedding: [], // Don't return embedding in response for performance
              metadata: {
                fileId: row.file_id,
                fileName: row.file_name,
                startLine: row.start_line || undefined,
                endLine: row.end_line || undefined,
                language: row.language || undefined,
                tokens: row.tokens || 0
              }
            },
            similarity: row.similarity
          }));
      }

      // Cache the results for future queries if caching is enabled
      if (useCache && this.cacheAdapter && results.length > 0) {
        try {
          const cacheResults = results.map(r => ({
            id: r.chunk.id,
            similarity: r.similarity,
            content: r.chunk.content,
            metadata: {
              file_id: r.chunk.metadata.fileId,
              path: r.chunk.metadata.fileName,
              start_line: r.chunk.metadata.startLine,
              end_line: r.chunk.metadata.endLine,
              language: r.chunk.metadata.language,
              tokens: r.chunk.metadata.tokens
            }
          }));

          // Store in cache without waiting for completion
          this.cacheAdapter.cacheResults(
            {
              embedding,
              limit,
              minSimilarity: threshold,
              filter: { workspaceId, fileIds }
            },
            cacheResults,
            workspaceId?.toString()
          ).catch(err => logger.warn('Background cache storage failed:', err));
        } catch (cacheError) {
          logger.warn('Failed to cache results:', cacheError);
        }
      }

      if (this.config.enableMetrics) {
        metrics.histogram('postgres_vector_adapter.find_similar.duration', Date.now() - startTime);
        metrics.increment('postgres_vector_adapter.find_similar.success');
        metrics.gauge('postgres_vector_adapter.find_similar.result_count', results.length);
      }

      return results;
    } catch (error) {
      if (this.config.enableMetrics) {
        metrics.increment('postgres_vector_adapter.find_similar.error');
      }

      // Only wrap if not already a VectorDbError
      if (!(error instanceof VectorDbError)) {
        throw this.errorHandler.handleError(
          error,
          'findSimilar',
          VectorDbErrorType.SEARCH,
          this.errorHandler.isNetworkError(error) || this.errorHandler.isTimeoutError(error),
          {
            embeddingSize: embedding.length,
            workspaceId: options.workspaceId,
            limit: options.limit,
            threshold: options.threshold,
            fileCount: options.fileIds?.length,
            useCache: options.useCache
          }
        );
      }

      // Fallback to text search on error
      logger.warn('Vector search failed, falling back to text search', { error });
      return this.fallbackTextSearch('', options);
    }
  }

  /**
   * Fallback text search when vector search is not available
   *
   * @param query - Text query (currently unused but kept for interface compatibility)
   * @param options - Search options
   * @returns Array of search results with default similarity scores
   */
  private async fallbackTextSearch(query: string, options: VectorSearchOptions = {}): Promise<SearchResult[]> {
    if (!this.prisma) {
      logger.error('Cannot perform fallback search: Prisma not initialized');
      return [];
    }

    try {
      const { workspaceId, fileIds, limit = 10 } = options;

      const whereClause: Prisma.RAGChunkWhereInput = {};

      if (workspaceId) {
        whereClause.file = { is: { workspace_id: workspaceId } };
      }

      if (fileIds && fileIds.length > 0) {
        whereClause.file_id = { in: fileIds };
      }

      const chunks = await this.prisma.rAGChunk.findMany({
        where: whereClause,
        include: {
          file: {
            select: {
              id: true,
              name: true,
              language: true
            }
          }
        },
        take: limit,
        orderBy: {
          created_at: 'desc'
        }
      });

      return chunks.map(chunk => ({
        chunk: {
          id: chunk.chunk_id,
          content: chunk.content,
          embedding: [],
          metadata: {
            fileId: chunk.file_id,
            fileName: chunk.file.name,
            startLine: chunk.start_line || undefined,
            endLine: chunk.end_line || undefined,
            language: chunk.file.language || undefined,
            tokens: chunk.tokens || 0
          }
        },
        similarity: 0.5 // Default similarity for text search
      }));
    } catch (error) {
      logger.error('Error in fallback text search:', error);
      return [];
    }
  }

  /**
   * Format cache results to match SearchResult interface
   *
   * @param cacheResults - Raw cache results
   * @returns Formatted search results
   */
  private formatCacheResults(cacheResults: any[]): SearchResult[] {
    return cacheResults.map(item => ({
      chunk: {
        id: item.metadata?.chunk_id?.toString() || item.id.toString(),
        content: item.content || '',
        embedding: [], // Don't return embedding in response for performance
        metadata: {
          fileId: item.metadata?.file_id || 0,
          fileName: item.metadata?.path || '',
          startLine: item.metadata?.start_line,
          endLine: item.metadata?.end_line,
          language: item.metadata?.language,
          tokens: item.metadata?.tokens || 0
        }
      },
      similarity: item.similarity
    }));
  }

  /**
   * Delete all vectors associated with a file
   *
   * @param fileId - The file ID whose chunks should be deleted
   */
  async deleteVectors(fileId: number): Promise<void> {
    if (!this.isConnectionActive || !this.prisma) {
      await this.connect();
    }

    if (!this.prisma) {
      throw this.errorHandler.handleError(
        new Error('PostgreSQL adapter not initialized'),
        'deleteVectors',
        VectorDbErrorType.INITIALIZATION,
        true
      );
    }

    try {
      const startTime = Date.now();

      await this.prisma.rAGChunk.deleteMany({
        where: { file_id: fileId }
      });

      // Invalidate cache if cache adapter is available
      if (this.cacheAdapter) {
        try {
          await this.cacheAdapter.invalidateCache({ fileId });
        } catch (cacheError) {
          logger.warn('Failed to invalidate cache after deleting vectors:', cacheError);
        }
      }

      if (this.config.enableMetrics) {
        metrics.histogram('postgres_vector_adapter.delete_vectors.duration', Date.now() - startTime);
        metrics.increment('postgres_vector_adapter.delete_vectors.success');
      }

      if (this.config.enableLogging) {
        logger.info(`Deleted all chunks for file \${fileId}`);
      }
    } catch (error) {
      if (this.config.enableMetrics) {
        metrics.increment('postgres_vector_adapter.delete_vectors.error');
      }

      throw this.errorHandler.handleError(
        error,
        'deleteVectors',
        VectorDbErrorType.VECTOR_CREATION_FAILED,
        this.errorHandler.isNetworkError(error) || this.errorHandler.isTimeoutError(error),
        { fileId }
      );
    }
  }

  /**
   * Update a vector embedding
   *
   * @param id - The chunk ID to update
   * @param embedding - The new embedding vector
   * @returns True if update was successful
   */
  async updateVector(id: string | number, embedding: number[]): Promise<boolean> {
    if (!this.isConnectionActive || !this.prisma) {
      await this.connect();
    }

    if (!this.prisma) {
      throw this.errorHandler.handleError(
        new Error('PostgreSQL adapter not initialized'),
        'updateVector',
        VectorDbErrorType.INITIALIZATION,
        true
      );
    }

    try {
      const embeddingString = `[\${embedding.join(',')}]`;

      // Update embedding in database
      await this.prisma.$executeRawUnsafe(`
        UPDATE rag_chunks
        SET embedding = $1::vector, updated_at = NOW()
        WHERE chunk_id = $2
      `, embeddingString, id.toString());

      if (this.config.enableMetrics) {
        metrics.increment('postgres_vector_adapter.update_vector.success');
      }

      return true;
    } catch (error) {
      if (this.config.enableMetrics) {
        metrics.increment('postgres_vector_adapter.update_vector.error');
      }

      logger.error('Error updating vector embedding:', error);
      return false;
    }
  }

  /**
   * Get statistics about the vector store
   *
   * @returns Statistics including total chunks, files, and average chunk size
   */
  async getStats(): Promise<VectorStoreStats> {
    if (!this.isConnectionActive || !this.prisma) {
      await this.connect();
    }

    if (!this.prisma) {
      logger.error('Cannot get stats: Prisma not initialized');
      return {
        totalChunks: 0,
        totalFiles: 0,
        averageChunkSize: 0
      };
    }

    try {
      const startTime = Date.now();

      const totalChunks = await this.prisma.rAGChunk.count();
      const totalFiles = await this.prisma.rAGChunk.groupBy({
        by: ['file_id'],
        _count: true
      });

      const avgTokens = await this.prisma.rAGChunk.aggregate({
        _avg: {
          tokens: true
        }
      });

      const cacheStats = this.cacheAdapter?.getCacheStats();

      const stats = {
        totalChunks,
        totalFiles: totalFiles.length,
        averageChunkSize: avgTokens._avg.tokens || 0,
        cacheStats
      };

      if (this.config.enableMetrics) {
        metrics.histogram('postgres_vector_adapter.get_stats.duration', Date.now() - startTime);
        metrics.increment('postgres_vector_adapter.get_stats.success');
      }

      return stats;
    } catch (error) {
      if (this.config.enableMetrics) {
        metrics.increment('postgres_vector_adapter.get_stats.error');
      }

      logger.error('Error getting vector store stats:', error);
      return {
        totalChunks: 0,
        totalFiles: 0,
        averageChunkSize: 0
      };
    }
  }
}
