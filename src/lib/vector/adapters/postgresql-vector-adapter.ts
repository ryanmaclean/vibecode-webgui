/**
 * PostgreSQL Vector Database Adapter
 * Provides pgvector-based vector storage and search
 */

import { PrismaClient } from '@prisma/client';
import { BaseVectorDatabaseAdapter } from './base-vector-database-adapter';
import { IVectorEmbeddingProvider } from '../interfaces/vector-embedding-provider';
import { IVectorCacheAdapter } from '../interfaces/vector-cache-adapter';
import { 
SearchResult, 
  VectorDatabaseConfig,
  VectorSearchOptions, 
  VectorStoreStats 
} from '../interfaces/vector-types';
// import { logger } from '@/lib/logger';
export class PostgreSQLVectorAdapter extends BaseVectorDatabaseAdapter {
  private prisma: PrismaClient;
  
  constructor(
    config: VectorDatabaseConfig,
    embeddingProvider: IVectorEmbeddingProvider,
    cacheAdapter?: IVectorCacheAdapter
  ) {
    super(config, embeddingProvider, cacheAdapter);
    this.prisma = new PrismaClient();
  }

  /**
   * Connect to the PostgreSQL database
   */
  async connect(): Promise<boolean> {
    try {
      // Test connection by querying the database
      await this.prisma.$queryRaw`SELECT 1`;
      this.isConnectionActive = true;
      return true;
    } catch (error) {
      console.error('Failed to connect to PostgreSQL:', error);
      this.isConnectionActive = false;
      return false;
    }
  }

  /**
   * Disconnect from the PostgreSQL database
   */
  async disconnect(): Promise<void> {
    try {
      await this.prisma.$disconnect();
      this.isConnectionActive = false;
    } catch (error) {
      console.error('Error disconnecting from PostgreSQL:', error);
    }
  }

  /**
   * Store vector chunks in the database
   */
  async storeVectors(fileId: number, chunks: Array<{
    content: string;
    startLine?: number;
    endLine?: number;
    tokens: number;
  }>): Promise<void> {
    if (!this.isConnectionActive) {
      await this.connect();
    }

    try {
      // Delete existing chunks for this file
      await this.prisma.rAGChunk.deleteMany({
        where: { file_id: fileId }
      });

      // Process chunks in batches to avoid rate limits
      const batchSize = 5;
      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        
        // Process each chunk individually
        for (let j = 0; j < batch.length; j++) {
          const chunk = batch[j];
          const chunkId = `${fileId}-chunk-${i + j}`;
          const embedding = await this.embeddingProvider.generateEmbedding(chunk.content);
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
    } catch (error) {
      console.error('Error storing vector chunks:', error);
      throw error;
    }
  }

  /**
   * Find similar vectors based on embedding
   */
  async findSimilar(embedding: number[], options: VectorSearchOptions): Promise<SearchResult[]> {
    if (!this.isConnectionActive) {
      await this.connect();
    }

    try {
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
            // Transform cache results to match our expected format
            return cacheResult.map(item => ({
              chunk: {
                id: item.id.toString(),
                content: item.content || '',
                embedding: [],
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
        } catch (cacheError) {
          console.warn('Cache retrieval failed, falling back to direct query:', cacheError);
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

      // Use pgvector for fast similarity search with cosine distance
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
          (1 - (rc.embedding <=> $${embeddingParamIndex}::vector)) as similarity
        FROM rag_chunks rc
        JOIN files f ON rc.file_id = f.id
        ${whereClause}
        ORDER BY rc.embedding <=> $${embeddingParamIndex}::vector
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
      const results: SearchResult[] = rawResults
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

      // Cache the results for future queries if caching is enabled
      if (useCache && this.cacheAdapter && results.length > 0) {
        try {
          // Format results for caching
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
          ).catch(err => console.warn('Background cache storage failed:', err));
        } catch (cacheError) {
          console.warn('Failed to cache results:', cacheError);
        }
      }
      
      return results;
    } catch (error) {
      console.error('Error in vector search:', error);
      return [];
    }
  }

  /**
   * Delete all vectors associated with a file
   */
  async deleteVectors(fileId: number): Promise<void> {
    if (!this.isConnectionActive) {
      await this.connect();
    }

    try {
      await this.prisma.rAGChunk.deleteMany({
        where: { file_id: fileId }
      });
    } catch (error) {
      console.error('Error deleting file chunks:', error);
      throw error;
    }
  }

  /**
   * Update a vector embedding
   */
  async updateVector(id: string | number, embedding: number[]): Promise<boolean> {
    if (!this.isConnectionActive) {
      await this.connect();
    }

    try {
      const embeddingString = `[${embedding.join(',')}]`;
      
      // Update embedding in database
      await this.prisma.$executeRawUnsafe(`
        UPDATE rag_chunks
        SET embedding = $1::vector, updated_at = NOW()
        WHERE chunk_id = $2
      `, embeddingString, id.toString());
      
      return true;
    } catch (error) {
      console.error('Error updating vector embedding:', error);
      return false;
    }
  }

  /**
   * Get statistics about the vector store
   */
  async getStats(): Promise<VectorStoreStats> {
    if (!this.isConnectionActive) {
      await this.connect();
    }

    try {
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

      return {
        totalChunks,
        totalFiles: totalFiles.length,
        averageChunkSize: avgTokens._avg.tokens || 0,
        cacheStats
      };
    } catch (error) {
      console.error('Error getting vector store stats:', error);
      return {
        totalChunks: 0,
        totalFiles: 0,
        averageChunkSize: 0
      };
    }
  }
}