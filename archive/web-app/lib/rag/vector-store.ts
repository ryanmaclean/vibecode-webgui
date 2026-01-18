/**
 * Vector Store Implementation
 * PostgreSQL + pgvector for semantic search
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '@/lib/logger';

const prisma = new PrismaClient();

export interface VectorDocument {
  id?: string;
  content: string;
  embedding: number[];
  metadata?: Record<string, any>;
  createdAt?: Date;
}

export interface SearchResult {
  id: string;
  content: string;
  similarity: number;
  metadata?: Record<string, any>;
}

export class VectorStore {
  private readonly tableName = 'document_embeddings';
  
  /**
   * Initialize pgvector extension and create table
   */
  async initialize(): Promise<void> {
    try {
      // Enable pgvector extension
      await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS vector');
      
      // Create embeddings table if not exists
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS ${this.tableName} (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          content TEXT NOT NULL,
          embedding vector(1536) NOT NULL,
          metadata JSONB,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);
      
      // Create HNSW index for fast similarity search
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS ${this.tableName}_embedding_idx 
        ON ${this.tableName} 
        USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64)
      `);
      
      logger.info('Vector store initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize vector store', { error });
      throw error;
    }
  }
  
  /**
   * Insert a document with its embedding
   */
  async insert(doc: VectorDocument): Promise<string> {
    try {
      const result = await prisma.$queryRawUnsafe<{ id: string }[]>(`
        INSERT INTO ${this.tableName} (content, embedding, metadata)
        VALUES ($1, $2::vector, $3)
        RETURNING id
      `, doc.content, JSON.stringify(doc.embedding), JSON.stringify(doc.metadata || {}));
      
      const id = result[0].id;
      logger.debug('Document inserted', { id });
      return id;
    } catch (error) {
      logger.error('Failed to insert document', { error });
      throw error;
    }
  }
  
  /**
   * Batch insert documents
   */
  async insertBatch(docs: VectorDocument[]): Promise<string[]> {
    const ids: string[] = [];
    
    for (const doc of docs) {
      const id = await this.insert(doc);
      ids.push(id);
    }
    
    logger.info('Batch insert completed', { count: ids.length });
    return ids;
  }
  
  /**
   * Semantic search using cosine similarity
   */
  async search(
    queryEmbedding: number[],
    options: {
      limit?: number;
      threshold?: number;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<SearchResult[]> {
    const { limit = 10, threshold = 0.7, metadata } = options;
    
    try {
      let query = `
        SELECT 
          id,
          content,
          metadata,
          1 - (embedding <=> $1::vector) as similarity
        FROM ${this.tableName}
        WHERE 1 - (embedding <=> $1::vector) > $2
      `;
      
      const params: any[] = [JSON.stringify(queryEmbedding), threshold];
      
      // Add metadata filtering if provided
      if (metadata) {
        query += ` AND metadata @> $3::jsonb`;
        params.push(JSON.stringify(metadata));
      }
      
      query += ` ORDER BY embedding <=> $1::vector LIMIT $${params.length + 1}`;
      params.push(limit);
      
      const results = await prisma.$queryRawUnsafe<any[]>(query, ...params);
      
      logger.debug('Search completed', { 
        resultCount: results.length,
        threshold,
        limit 
      });
      
      return results.map(row => ({
        id: row.id,
        content: row.content,
        similarity: parseFloat(row.similarity),
        metadata: row.metadata
      }));
    } catch (error) {
      logger.error('Search failed', { error });
      throw error;
    }
  }
  
  /**
   * Delete a document by ID
   */
  async delete(id: string): Promise<void> {
    try {
      await prisma.$executeRawUnsafe(`
        DELETE FROM ${this.tableName} WHERE id = $1
      `, id);
      
      logger.debug('Document deleted', { id });
    } catch (error) {
      logger.error('Failed to delete document', { error, id });
      throw error;
    }
  }
  
  /**
   * Get document count
   */
  async count(): Promise<number> {
    try {
      const result = await prisma.$queryRawUnsafe<{ count: bigint }[]>(`
        SELECT COUNT(*) as count FROM ${this.tableName}
      `);
      
      return Number(result[0].count);
    } catch (error) {
      logger.error('Failed to get count', { error });
      throw error;
    }
  }
  
  /**
   * Rebuild HNSW index
   */
  async rebuildIndex(): Promise<void> {
    try {
      logger.info('Rebuilding HNSW index...');
      
      // Drop existing index
      await prisma.$executeRawUnsafe(`
        DROP INDEX IF EXISTS ${this.tableName}_embedding_idx
      `);
      
      // Recreate with optimized parameters
      await prisma.$executeRawUnsafe(`
        CREATE INDEX ${this.tableName}_embedding_idx 
        ON ${this.tableName} 
        USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64)
      `);
      
      logger.info('HNSW index rebuilt successfully');
    } catch (error) {
      logger.error('Failed to rebuild index', { error });
      throw error;
    }
  }
  
  /**
   * Vacuum and analyze table for performance
   */
  async optimize(): Promise<void> {
    try {
      logger.info('Optimizing vector store...');
      
      await prisma.$executeRawUnsafe(`VACUUM ANALYZE ${this.tableName}`);
      
      logger.info('Vector store optimized');
    } catch (error) {
      logger.error('Failed to optimize', { error });
      throw error;
    }
  }
  
  /**
   * Get table statistics
   */
  async getStats(): Promise<{
    documentCount: number;
    tableSize: string;
    indexSize: string;
  }> {
    try {
      const count = await this.count();
      
      const sizeResult = await prisma.$queryRawUnsafe<any[]>(`
        SELECT 
          pg_size_pretty(pg_total_relation_size($1)) as table_size,
          pg_size_pretty(pg_indexes_size($1)) as index_size
      `, this.tableName);
      
      return {
        documentCount: count,
        tableSize: sizeResult[0].table_size,
        indexSize: sizeResult[0].index_size
      };
    } catch (error) {
      logger.error('Failed to get stats', { error });
      throw error;
    }
  }
}

// Singleton instance
export const vectorStore = new VectorStore();
