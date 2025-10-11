/**
 * PostgreSQL Vector Database Adapter
 * Implementation of the vector database adapter for PostgreSQL with pgVector
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { BaseVectorDatabaseAdapter } from './base-vector-database-adapter';
import { SearchOptions, SearchResult, VectorDatabaseConfig, VectorDatabaseProvider } from './vector-types';
import { VectorCacheManager } from '../cache/vector-cache-strategy';
import { metrics } from '../server-monitoring';
import { VectorCacheInvalidator } from '../cache/vector-cache-invalidator';
import { PgVectorSearch } from '../cache/pgvector-search';
<<<<<<< HEAD
=======
<<<<<<< HEAD
import { VectorDbErrorHandler, VectorDbErrorType } from './vector-db-error-handler';
>>>>>>> fix/consolidated-dependency-updates
=======
>>>>>>> main
>>>>>>> merge-conflict-cleanup

/**
 * PostgreSQL-specific configuration options
 */
export interface PostgresVectorDatabaseConfig extends VectorDatabaseConfig {
  provider: VectorDatabaseProvider.POSTGRES;
  pgPoolSize?: number;
  pgSchemaName?: string;
  pgVectorExtensionName?: string;
  pgSearchMethod?: 'cosine' | 'inner_product' | 'euclidean';
}

/**
 * PostgreSQL Vector Database Adapter
 * Implements vector database operations using PostgreSQL with pgVector extension
 */
export class PostgresVectorDatabaseAdapter extends BaseVectorDatabaseAdapter {
  private prisma: PrismaClient | null = null;
<<<<<<< HEAD
  protected postgresConfig: PostgresVectorDatabaseConfig;
  private cacheInvalidator: VectorCacheInvalidator | null = null;
=======
<<<<<<< HEAD
  private postgresConfig: PostgresVectorDatabaseConfig;
  private errorHandler: VectorDbErrorHandler;
  private cacheInvalidator: VectorCacheInvalidator | null = null;
  private pgVectorSearch: PgVectorSearch | null = null;
>>>>>>> fix/consolidated-dependency-updates
=======
>>>>>>> main
>>>>>>> merge-conflict-cleanup

  /**
   * Constructor for PostgreSQL adapter
   * @param config PostgreSQL-specific configuration
   */
  constructor(config: PostgresVectorDatabaseConfig) {
    super(config);
<<<<<<< HEAD
=======
<<<<<<< HEAD
    this.errorHandler = new VectorDbErrorHandler('postgres', config.enableLogging || false, config.enableMetrics || false);
>>>>>>> fix/consolidated-dependency-updates
=======
>>>>>>> main
>>>>>>> merge-conflict-cleanup
    this.postgresConfig = {
      pgPoolSize: 10,
      pgSchemaName: 'public',
      pgVectorExtensionName: 'vector',
      pgSearchMethod: 'cosine',
      ...config
    };
  }

  /**
   * Initialize the PostgreSQL connection
   */
  protected async initializeProvider(): Promise<void> {
    try {
      // Create Prisma client
      this.prisma = new PrismaClient({
        datasources: {
          db: {
            url: this.postgresConfig.connectionString || process.env.DATABASE_URL
          }
        },
        log: this.config.enableLogging ? ['error', 'warn'] : [],
        errorFormat: 'pretty'
      });

      // Connect to the database
      await this.prisma.$connect();

      // Verify pgVector extension is installed
      await this.verifyPgVectorExtension();

      // Initialize cache invalidator if caching is enabled
      if (this.config.cacheEnabled) {
        this.cacheInvalidator = VectorCacheInvalidator.getInstance();
        await this.cacheInvalidator.initialize();
      }

      if (this.config.enableLogging) {
        console.info('PostgreSQL vector database adapter initialized successfully');
      }
    } catch (error) {
      if (this.config.enableLogging) {
        console.error('Failed to initialize PostgreSQL vector database adapter:', error);
      }
      throw error;
    }
  }

  /**
   * Verify that the pgVector extension is installed and properly configured
   */
  private async verifyPgVectorExtension(): Promise<void> {
    if (!this.prisma) {
<<<<<<< HEAD
<<<<<<< HEAD
=======
      throw this.errorHandler.handleError(new Error('Prisma client not initialized'), 'unknown', VectorDbErrorType.INITIALIZATION, true);
=======
>>>>>>> main
>>>>>>> merge-conflict-cleanup
      throw new Error('Prisma client not initialized');
    }
=======
      throw this.errorHandler.handleError(new Error('Prisma client not initialized'), 'unknown', VectorDbErrorType.INITIALIZATION, true);    }
>>>>>>> fix/consolidated-dependency-updates

    try {
      // Check if vector extension is installed
      const extensionResult = await this.prisma.$queryRaw`
        SELECT extname FROM pg_extension WHERE extname = 'vector'
      `;

      if (!Array.isArray(extensionResult) || extensionResult.length === 0) {
<<<<<<< HEAD
<<<<<<< HEAD
=======
        throw this.errorHandler.handleError(new Error('pgVector extension is not installed in the database'), 'unknown', VectorDbErrorType.UNKNOWN_ERROR, false);
=======
>>>>>>> main
>>>>>>> merge-conflict-cleanup
        throw new Error('pgVector extension is not installed in the database');
      }
=======
        throw this.errorHandler.handleError(new Error('pgVector extension is not installed in the database'), 'unknown', VectorDbErrorType.UNKNOWN_ERROR, false);      }
>>>>>>> fix/consolidated-dependency-updates

      // Verify vector type exists by querying pg_type
      const typeResult = await this.prisma.$queryRaw`
        SELECT typname FROM pg_type WHERE typname = 'vector'
      `;

      if (!Array.isArray(typeResult) || typeResult.length === 0) {
<<<<<<< HEAD
<<<<<<< HEAD
=======
        throw this.errorHandler.handleError(new Error('Vector data type not found, pgVector extension may be incorrectly installed'), 'unknown', VectorDbErrorType.UNKNOWN_ERROR, false);
=======
>>>>>>> main
>>>>>>> merge-conflict-cleanup
        throw new Error('Vector data type not found, pgVector extension may be incorrectly installed');
      }
=======
        throw this.errorHandler.handleError(new Error('Vector data type not found, pgVector extension may be incorrectly installed'), 'unknown', VectorDbErrorType.UNKNOWN_ERROR, false);      }
>>>>>>> fix/consolidated-dependency-updates

      if (this.config.enableLogging) {
        console.info('pgVector extension verified successfully');
      }
    } catch (error) {
      if (this.config.enableLogging) {
        console.error('pgVector extension verification failed:', error);
      }
<<<<<<< HEAD
<<<<<<< HEAD
=======
      throw this.errorHandler.handleError(new Error(`pgVector extension verification failed: ${error instanceof Error ? error.message : String(error)}`), 'unknown', VectorDbErrorType.UNKNOWN_ERROR, false);
=======
>>>>>>> main
>>>>>>> merge-conflict-cleanup
      throw new Error(`pgVector extension verification failed: ${error instanceof Error ? error.message : String(error)}`);
    }
=======
      throw this.errorHandler.handleError(new Error(`pgVector extension verification failed: ${error instanceof Error ? error.message : String(error)}`), 'unknown', VectorDbErrorType.UNKNOWN_ERROR, false);    }
>>>>>>> fix/consolidated-dependency-updates
  }

  /**
   * Store vector chunks in the database
   */
  public async storeChunks(fileId: number, chunks: Array<{
    content: string;
    startLine?: number;
    endLine?: number;
    tokens: number;
  }>): Promise<void> {
    if (!this.prisma) {
<<<<<<< HEAD
<<<<<<< HEAD
=======
      throw this.errorHandler.handleError(new Error('PostgreSQL adapter not initialized'), 'unknown', VectorDbErrorType.INITIALIZATION, true);
=======
>>>>>>> main
>>>>>>> merge-conflict-cleanup
      throw new Error('PostgreSQL adapter not initialized');
    }
=======
      throw this.errorHandler.handleError(new Error('PostgreSQL adapter not initialized'), 'unknown', VectorDbErrorType.INITIALIZATION, true);    }
>>>>>>> fix/consolidated-dependency-updates

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
          const chunkId = `${fileId}-chunk-${i + j}`;
          
          // Generate embedding
          const embedding = await this.generateEmbedding(chunk.content);
          const embeddingString = `[${embedding.join(',')}]`;
          
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
        }

        // Small delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Invalidate cache
      if (this.config.cacheEnabled && this.cacheInvalidator) {
        await this.cacheInvalidator.manuallyInvalidateCache('rag_chunks');
      }

      if (this.config.enableMetrics) {
        metrics.histogram('postgres_vector_db.store_chunks.duration', Date.now() - startTime);
        metrics.increment('postgres_vector_db.store_chunks.success');
      }
    } catch (error) {
      if (this.config.enableMetrics) {
        metrics.increment('postgres_vector_db.store_chunks.error');
      }
      
      if (this.config.enableLogging) {
        console.error('Error storing vector chunks:', error);
      }
      
      throw error;
    }
  }

  /**
   * Search for similar content using vector similarity
   */
  public async search(embedding: number[], options: SearchOptions = {}): Promise<SearchResult[]> {
    if (!this.prisma) {
<<<<<<< HEAD
<<<<<<< HEAD
=======
      throw this.errorHandler.handleError(new Error('PostgreSQL adapter not initialized'), 'unknown', VectorDbErrorType.INITIALIZATION, true);
=======
>>>>>>> main
>>>>>>> merge-conflict-cleanup
      throw new Error('PostgreSQL adapter not initialized');
    }
=======
      throw this.errorHandler.handleError(new Error('PostgreSQL adapter not initialized'), 'unknown', VectorDbErrorType.INITIALIZATION, true);    }
>>>>>>> fix/consolidated-dependency-updates

    try {
      const startTime = Date.now();
      
      const { workspaceId, fileIds, limit = 10, threshold = 0.7, useCache = true } = options;
      
      // First try to get results from cache if enabled
      if (useCache && this.config.cacheEnabled) {
        try {
          const workspace = workspaceId ? workspaceId.toString() : undefined;
          
          // Use PgVectorSearch with caching
          const cachedResults = await this.getCachedResults(embedding, {
            limit,
            minSimilarity: threshold,
            workspace,
            useCache: true
          });
          
          if (cachedResults && cachedResults.length > 0) {
            if (this.config.enableMetrics) {
              metrics.increment('postgres_vector_db.search.cache_hit');
            }
            
            return this.formatSearchResults(cachedResults);
          }
        } catch (cacheError) {
          if (this.config.enableLogging) {
            console.warn('Cache retrieval failed, falling back to direct query:', cacheError);
          }
          // Continue with direct query if cache fails
        }
      }

      // If cache miss or caching disabled, perform direct query
      const embeddingString = `[${embedding.join(',')}]`;

      // Build WHERE clause for filtering
      const whereConditions: string[] = [];
      const params: (string | number | number[])[] = [];
      let paramIndex = 1;

      if (workspaceId) {
        whereConditions.push(`f.workspace_id = $${paramIndex}`);
        params.push(workspaceId);
        paramIndex++;
      }

      if (fileIds && fileIds.length > 0) {
        whereConditions.push(`rc.file_id = ANY($${paramIndex}::int[])`);
        params.push(`{${fileIds.join(',')}}`);
        paramIndex++;
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      // Add embedding parameter
      const embeddingParamIndex = paramIndex++;
      const limitParamIndex = paramIndex++;

      // Use pgvector for similarity search with the configured search method
      let distanceOperator = '<=>'; // Cosine distance by default
      if (this.postgresConfig.pgSearchMethod === 'inner_product') {
        distanceOperator = '<#>'; // Inner product
      } else if (this.postgresConfig.pgSearchMethod === 'euclidean') {
        distanceOperator = '<->'; // Euclidean distance
      }
      
      // For inner product, we need to invert the similarity score calculation
      const similarityExpression = this.postgresConfig.pgSearchMethod === 'inner_product'
        ? `(rc.embedding <#> $${embeddingParamIndex}::vector) as similarity`
        : `(1 - (rc.embedding ${distanceOperator} $${embeddingParamIndex}::vector)) as similarity`;
      
      // For inner product, we need to sort differently
      const orderByExpression = this.postgresConfig.pgSearchMethod === 'inner_product'
        ? `ORDER BY rc.embedding <#> $${embeddingParamIndex}::vector DESC`
        : `ORDER BY rc.embedding ${distanceOperator} $${embeddingParamIndex}::vector`;

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
          ${similarityExpression}
        FROM rag_chunks rc
        JOIN files f ON rc.file_id = f.id
        ${whereClause}
        ${orderByExpression}
        LIMIT $${limitParamIndex}
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
      
      // For inner product, we handle similarity scores differently
      if (this.postgresConfig.pgSearchMethod === 'inner_product') {
        // Normalize scores to 0-1 range for inner product
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
            // Normalize to 0-1 range
            similarity: range > 0 ? (row.similarity - minScore) / range : 0.5
          }))
          .filter((result) => result.similarity >= threshold);
      } else {
        // For cosine and euclidean, we can use the similarity directly
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
      if (useCache && this.config.cacheEnabled && results.length > 0) {
        try {
          // Store the formatted results in our cache system
          const workspace = workspaceId ? workspaceId.toString() : undefined;
          
          // Use PgVectorSearch to store in cache without waiting for completion
          this.cacheResults(embedding, {
            limit,
            minSimilarity: threshold,
            workspace,
            useCache: true
          }, results).catch(err => {
            if (this.config.enableLogging) {
              console.warn('Background cache storage failed:', err);
            }
          });
        } catch (cacheError) {
          if (this.config.enableLogging) {
            console.warn('Failed to cache results:', cacheError);
          }
          // Continue without caching if it fails
        }
      }

      if (this.config.enableMetrics) {
        metrics.histogram('postgres_vector_db.search.duration', Date.now() - startTime);
        metrics.increment('postgres_vector_db.search.success');
      }
      
      return results;
    } catch (error) {
      if (this.config.enableMetrics) {
        metrics.increment('postgres_vector_db.search.error');
      }
      
      if (this.config.enableLogging) {
        console.error('Error in vector search:', error);
      }
      
      // Fallback to simple text search if vector search fails
      return this.fallbackTextSearch(
        '', // We don't have the original query text here
        options
      );
    }
  }

  /**
   * Get cached results from PgVectorSearch
   */
  private async getCachedResults(
    embedding: number[],
    options: {
      limit?: number;
      minSimilarity?: number;
      workspace?: string;
      useCache?: boolean;
    }
  ): Promise<any[]> {
    return await PgVectorSearch.findSimilarCode(embedding, options);
  }

  /**
   * Cache results in PgVectorSearch
   */
  private async cacheResults(
    embedding: number[],
    options: {
      limit?: number;
      minSimilarity?: number;
      workspace?: string;
      useCache?: boolean;
    },
    results: SearchResult[]
  ): Promise<void> {
    // Convert results to the format expected by PgVectorSearch
    const pgVectorResults = results.map(result => ({
      id: result.chunk.id,
      similarity: result.similarity,
      content: result.chunk.content,
      metadata: {
        chunk_id: result.chunk.id,
        file_id: result.chunk.metadata.fileId,
        path: result.chunk.metadata.fileName,
        start_line: result.chunk.metadata.startLine,
        end_line: result.chunk.metadata.endLine,
        language: result.chunk.metadata.language,
        tokens: result.chunk.metadata.tokens
      },
      contentType: 'code'
    }));
    
    // Cache the results
    await VectorCacheManager.cacheResults({
      embedding,
      table: 'rag_chunks',
      limit: options.limit,
      minSimilarity: options.minSimilarity,
      contentTypes: ['code']
    }, pgVectorResults, options.workspace);
  }

  /**
   * Format PgVectorSearch results to standard SearchResult format
   */
  private formatSearchResults(results: any[]): SearchResult[] {
    return results.map(item => ({
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
   * Fallback text search when vector search is not available
   */
  protected async fallbackTextSearch(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    if (!this.prisma) {
<<<<<<< HEAD
<<<<<<< HEAD
=======
      throw this.errorHandler.handleError(new Error('PostgreSQL adapter not initialized'), 'unknown', VectorDbErrorType.INITIALIZATION, true);
=======
>>>>>>> main
>>>>>>> merge-conflict-cleanup
      throw new Error('PostgreSQL adapter not initialized');
    }
=======
      throw this.errorHandler.handleError(new Error('PostgreSQL adapter not initialized'), 'unknown', VectorDbErrorType.INITIALIZATION, true);    }
>>>>>>> fix/consolidated-dependency-updates

    try {
      const { workspaceId, fileIds, limit = 10 } = options;

      const whereClause: Prisma.RAGChunkWhereInput = {
        content: query ? {
          contains: query,
          mode: Prisma.QueryMode.insensitive
        } : undefined
      };
      
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
      if (this.config.enableLogging) {
        console.error('Error in fallback text search:', error);
      }
      return [];
    }
  }

  /**
   * Delete all chunks for a file
   */
  public async deleteFileChunks(fileId: number): Promise<void> {
    if (!this.prisma) {
<<<<<<< HEAD
<<<<<<< HEAD
=======
      throw this.errorHandler.handleError(new Error('PostgreSQL adapter not initialized'), 'unknown', VectorDbErrorType.INITIALIZATION, true);
=======
>>>>>>> main
>>>>>>> merge-conflict-cleanup
      throw new Error('PostgreSQL adapter not initialized');
    }
=======
      throw this.errorHandler.handleError(new Error('PostgreSQL adapter not initialized'), 'unknown', VectorDbErrorType.INITIALIZATION, true);    }
>>>>>>> fix/consolidated-dependency-updates

    try {
      const startTime = Date.now();
      
      await this.prisma.rAGChunk.deleteMany({
        where: { file_id: fileId }
      });

      // Invalidate cache
      if (this.config.cacheEnabled && this.cacheInvalidator) {
        await this.cacheInvalidator.manuallyInvalidateCache('rag_chunks');
      }

      if (this.config.enableMetrics) {
        metrics.histogram('postgres_vector_db.delete_chunks.duration', Date.now() - startTime);
        metrics.increment('postgres_vector_db.delete_chunks.success');
      }
    } catch (error) {
      if (this.config.enableMetrics) {
        metrics.increment('postgres_vector_db.delete_chunks.error');
      }
      
      if (this.config.enableLogging) {
        console.error('Error deleting file chunks:', error);
      }
      
      throw error;
    }
  }

  /**
   * Get statistics about the vector store
   */
  public async getStats(): Promise<{
    totalChunks: number;
    totalFiles: number;
    averageChunkSize: number;
  }> {
    if (!this.prisma) {
<<<<<<< HEAD
<<<<<<< HEAD
=======
      throw this.errorHandler.handleError(new Error('PostgreSQL adapter not initialized'), 'unknown', VectorDbErrorType.INITIALIZATION, true);
=======
>>>>>>> main
>>>>>>> merge-conflict-cleanup
      throw new Error('PostgreSQL adapter not initialized');
    }
=======
      throw this.errorHandler.handleError(new Error('PostgreSQL adapter not initialized'), 'unknown', VectorDbErrorType.INITIALIZATION, true);    }
>>>>>>> fix/consolidated-dependency-updates

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

      const stats = {
        totalChunks,
        totalFiles: totalFiles.length,
        averageChunkSize: avgTokens._avg.tokens || 0
      };

      if (this.config.enableMetrics) {
        metrics.histogram('postgres_vector_db.get_stats.duration', Date.now() - startTime);
        metrics.increment('postgres_vector_db.get_stats.success');
      }

      return stats;
    } catch (error) {
      if (this.config.enableMetrics) {
        metrics.increment('postgres_vector_db.get_stats.error');
      }
      
      if (this.config.enableLogging) {
        console.error('Error getting vector store stats:', error);
      }
      
      return {
        totalChunks: 0,
        totalFiles: 0,
        averageChunkSize: 0
      };
    }
  }

  /**
   * Invalidate cache entries for a specific table or content type
   */
  public async invalidateCache(table: string, contentType?: string): Promise<number> {
    if (!this.config.cacheEnabled || !this.cacheInvalidator) {
      return 0;
    }

    try {
      const startTime = Date.now();
      
      // Use the cache invalidator to invalidate cache entries
      const invalidatedCount = await this.cacheInvalidator.manuallyInvalidateCache(
        table as 'rag_chunks' | 'ai_embeddings',
        contentType
      );

      if (this.config.enableMetrics) {
        metrics.histogram('postgres_vector_db.invalidate_cache.duration', Date.now() - startTime);
        metrics.increment('postgres_vector_db.invalidate_cache.success');
      }

      return invalidatedCount;
    } catch (error) {
      if (this.config.enableMetrics) {
        metrics.increment('postgres_vector_db.invalidate_cache.error');
      }
      
      if (this.config.enableLogging) {
        console.error('Error invalidating cache:', error);
      }
      
      return 0;
    }
  }

  /**
   * Ping the PostgreSQL database to check connectivity
   */
  protected async pingProvider(): Promise<boolean> {
    if (!this.prisma) {
      return false;
    }
    
    try {
      // Simple query to check database connectivity
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      if (this.config.enableLogging) {
        console.error('PostgreSQL ping failed:', error);
      }
      return false;
    }
  }

  /**
   * Close the PostgreSQL connection
   */
  protected async closeProvider(): Promise<void> {
    if (this.prisma) {
      await this.prisma.$disconnect();
      this.prisma = null;
    }
  }
}
