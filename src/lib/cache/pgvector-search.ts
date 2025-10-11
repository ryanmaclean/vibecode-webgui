/**
 * PgVector Search with Valkey/Redis Caching
 * Provides optimized vector similarity searches with caching for performance
 */

import { PrismaClient } from '@prisma/client';
import { cache } from './redis-client';
import { VectorCacheManager, VectorSimilarityQuery, VectorSimilarityResults } from './vector-cache-strategy';
import { valkeyLogger } from './valkey-logger';
import { metrics } from '../server-monitoring';

// Initialize Prisma client
const prisma = new PrismaClient();

// Default search parameters
const DEFAULT_LIMIT = 10;
const DEFAULT_MIN_SIMILARITY = 0.7;

/**
 * PgVector search client with Valkey caching
 * Provides efficient vector similarity searches with caching
 */
export class PgVectorSearch {
  /**
   * Find similar code chunks using vector similarity
   * Uses efficient caching to improve performance
   */
  static async findSimilarCode(
    embedding: number[],
    options: {
      limit?: number;
      minSimilarity?: number;
      language?: string;
      workspace?: string;
      useCache?: boolean;
    } = {}
  ): Promise<VectorSimilarityResults> {
    const startTime = Date.now();
    
    // Set defaults and prepare query
    const limit = options.limit || DEFAULT_LIMIT;
    const minSimilarity = options.minSimilarity || DEFAULT_MIN_SIMILARITY;
    const language = options.language;
    const workspace = options.workspace;
    const useCache = options.useCache !== false;
    
    // Build filters
    const filters: Record<string, any> = {};
    if (language) {
      filters.language = language;
    }
    
    // Prepare query for cache
    const query: VectorSimilarityQuery = {
      embedding,
      table: 'rag_chunks',
      limit,
      minSimilarity,
      filter: filters,
      contentTypes: ['code']
    };
    
    try {
      // Try to get from cache first
      if (useCache) {
        const cachedResults = await VectorCacheManager.getCachedResults(query, workspace);
        if (cachedResults) {
          metrics.histogram('pgvector.search.cached.duration', Date.now() - startTime);
          return cachedResults;
        }
      }
      
      // Cache miss or cache disabled - perform actual database query
      const queryStartTime = Date.now();
      
      // Build base query with raw SQL for optimal pgvector performance
      let rawQuery = `
        SELECT 
          r.id, 
          r.chunk_id,
          r.content,
          r.start_line,
          r.end_line,
          f.language,
          f.path,
          1 - (r.embedding <-> $1) as similarity
        FROM 
          rag_chunks r
        JOIN 
          files f ON r.file_id = f.id
        WHERE 
          1 - (r.embedding <-> $1) > $2
      `;
      
      // Add language filter if specified
      const queryParams: any[] = [embedding, minSimilarity];
      
      if (language) {
        rawQuery += ` AND f.language = $3`;
        queryParams.push(language);
      }
      
      // Add workspace filter if specified
      if (workspace) {
        const paramIndex = queryParams.length + 1;
        rawQuery += ` AND f.workspace_id = $${paramIndex}`;
        queryParams.push(workspace);
      }
      
      // Add ordering and limit
      rawQuery += `
        ORDER BY 
          similarity DESC
        LIMIT $${queryParams.length + 1}
      `;
      queryParams.push(limit);
      
      // Execute the query
      const results = await prisma.$queryRawUnsafe(rawQuery, ...queryParams);
      
      // Process results to standard format
      const formattedResults: VectorSimilarityResults = (results as any[]).map(row => ({
        id: row.id,
        similarity: parseFloat(row.similarity),
        content: row.content,
        metadata: {
          chunk_id: row.chunk_id,
          start_line: row.start_line,
          end_line: row.end_line,
          language: row.language,
          path: row.path
        },
        contentType: 'code'
      }));
      
      // Cache results if enabled
      if (useCache && formattedResults.length > 0) {
        await VectorCacheManager.cacheResults(query, formattedResults, workspace);
      }
      
      // Report metrics
      const dbQueryDuration = Date.now() - queryStartTime;
      const totalDuration = Date.now() - startTime;
      
      metrics.histogram('pgvector.search.db.duration', dbQueryDuration);
      metrics.histogram('pgvector.search.total.duration', totalDuration);
      metrics.increment('pgvector.search.performed');
      
      valkeyLogger.debug('PgVector search completed', {
        command: 'pgvector_search',
        duration: totalDuration,
        metadata: {
          db_duration: dbQueryDuration,
          result_count: formattedResults.length,
          workspace,
          language,
          cached: false
        }
      });
      
      return formattedResults;
    } catch (error) {
      metrics.increment('pgvector.search.error');
      valkeyLogger.error('PgVector search error', {
        command: 'pgvector_search',
        error: error instanceof Error ? error.message : String(error),
        metadata: {
          workspace,
          language
        }
      });
      
      throw error;
    }
  }
  
  /**
   * Find similar content using vector similarity across multiple content types
   * Uses efficient caching to improve performance
   */
  static async findSimilarContent(
    embedding: number[],
    options: {
      limit?: number;
      minSimilarity?: number;
      contentTypes?: string[];
      workspace?: string;
      useCache?: boolean;
    } = {}
  ): Promise<VectorSimilarityResults> {
    const startTime = Date.now();
    
    // Set defaults and prepare query
    const limit = options.limit || DEFAULT_LIMIT;
    const minSimilarity = options.minSimilarity || DEFAULT_MIN_SIMILARITY;
    const contentTypes = options.contentTypes || ['code', 'documentation', 'chat'];
    const workspace = options.workspace;
    const useCache = options.useCache !== false;
    
    // Prepare query for cache
    const query: VectorSimilarityQuery = {
      embedding,
      table: 'ai_embeddings',
      limit,
      minSimilarity,
      contentTypes
    };
    
    try {
      // Try to get from cache first
      if (useCache) {
        const cachedResults = await VectorCacheManager.getCachedResults(query, workspace);
        if (cachedResults) {
          metrics.histogram('pgvector.content_search.cached.duration', Date.now() - startTime);
          return cachedResults;
        }
      }
      
      // Cache miss or cache disabled - perform actual database query
      const queryStartTime = Date.now();
      
      // Build query parameters
      const queryParams: any[] = [embedding, minSimilarity];
      
      // Build content type filter
      let contentTypeFilter = '';
      if (contentTypes && contentTypes.length > 0) {
        contentTypeFilter = `AND content_type IN (${contentTypes.map((_, idx) => `$${idx + 3}`).join(', ')})`;
        contentTypes.forEach(type => queryParams.push(type));
      }
      
      // Add workspace filter if specified
      let workspaceFilter = '';
      if (workspace) {
        workspaceFilter = `AND metadata->>'workspace_id' = $${queryParams.length + 1}`;
        queryParams.push(workspace);
      }
      
      // Build base query with raw SQL for optimal pgvector performance
      const rawQuery = `
        SELECT 
          id, 
          content_type,
          content_hash,
          metadata,
          1 - (embedding <-> $1) as similarity
        FROM 
          ai_embeddings
        WHERE 
          1 - (embedding <-> $1) > $2
          ${contentTypeFilter}
          ${workspaceFilter}
        ORDER BY 
          similarity DESC
        LIMIT $${queryParams.length + 1}
      `;
      queryParams.push(limit);
      
      // Execute the query
      const results = await prisma.$queryRawUnsafe(rawQuery, ...queryParams);
      
      // Process results to standard format
      const formattedResults: VectorSimilarityResults = (results as any[]).map(row => ({
        id: row.id,
        similarity: parseFloat(row.similarity),
        metadata: row.metadata || {},
        contentType: row.content_type
      }));
      
      // Cache results if enabled
      if (useCache && formattedResults.length > 0) {
        await VectorCacheManager.cacheResults(query, formattedResults, workspace);
      }
      
      // Report metrics
      const dbQueryDuration = Date.now() - queryStartTime;
      const totalDuration = Date.now() - startTime;
      
      metrics.histogram('pgvector.content_search.db.duration', dbQueryDuration);
      metrics.histogram('pgvector.content_search.total.duration', totalDuration);
      metrics.increment('pgvector.content_search.performed');
      
      valkeyLogger.debug('PgVector content search completed', {
        command: 'pgvector_content_search',
        duration: totalDuration,
        metadata: {
          db_duration: dbQueryDuration,
          result_count: formattedResults.length,
          workspace,
          content_types: contentTypes.join(','),
          cached: false
        }
      });
      
      return formattedResults;
    } catch (error) {
      metrics.increment('pgvector.content_search.error');
      valkeyLogger.error('PgVector content search error', {
        command: 'pgvector_content_search',
        error: error instanceof Error ? error.message : String(error),
        metadata: {
          workspace,
          content_types: contentTypes.join(',')
        }
      });
      
      throw error;
    }
  }
  
  /**
   * Update vector embedding and invalidate related caches
   */
  static async updateEmbedding(
    table: 'rag_chunks' | 'ai_embeddings',
    id: number | string,
    embedding: number[],
    contentType?: string
  ): Promise<boolean> {
    try {
      // Update embedding in database
      if (table === 'rag_chunks') {
        await prisma.rAGChunk.update({
          where: { id: Number(id) },
          data: {
            // @ts-ignore - pgvector type not properly recognized
            embedding
          }
        });
      } else {
        // Assuming ai_embeddings has its own model (simplified here)
        await prisma.$executeRawUnsafe(
          `UPDATE ai_embeddings SET embedding = $1 WHERE id = $2`,
          embedding,
          id
        );
      }
      
      // Invalidate related caches
      await VectorCacheManager.invalidateForTable(table, contentType);
      
      metrics.increment('pgvector.embedding.updated');
      return true;
    } catch (error) {
      metrics.increment('pgvector.embedding.update_error');
      valkeyLogger.error('PgVector embedding update error', {
        command: 'pgvector_update',
        error: error instanceof Error ? error.message : String(error),
        metadata: {
          table,
          id,
          contentType
        }
      });
      
      throw error;
    }
  }
  
  /**
   * Get cache effectiveness metrics
   */
  static getCacheStats(): {
    hitRate: number;
    hitCount: number;
    missCount: number;
  } {
    const stats = VectorCacheManager.getCacheStats();
    return {
      hitRate: stats.hitRate,
      hitCount: stats.hitCount,
      missCount: stats.missCount
    };
  }
}

export default PgVectorSearch;