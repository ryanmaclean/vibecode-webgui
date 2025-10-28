/**
 * PGVector Client
 * PostgreSQL-based vector database client for semantic search and storage
 */

import { Pool, PoolClient } from 'pg';
import { VectorChunk, SearchResult, SearchOptions } from '../../vector-db/vector-types';

export interface PGVectorConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
  connectionTimeoutMillis?: number;
  idleTimeoutMillis?: number;
  max?: number;
}

export interface CollectionSchema {
  name: string;
  dimension: number;
  metric: 'cosine' | 'euclidean' | 'manhattan';
  metadata?: Record<string, any>;
}

/**
 * PostgreSQL Vector Database Client
 */
export class PGVectorClient {
  private pool: Pool;
  private config: PGVectorConfig;

  constructor(config: PGVectorConfig) {
    this.config = config;
    this.pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      ssl: config.ssl,
      connectionTimeoutMillis: config.connectionTimeoutMillis || 2000,
      idleTimeoutMillis: config.idleTimeoutMillis || 30000,
      max: config.max || 20,
    });
  }

  /**
   * Initialize the vector database
   */
  async initialize(): Promise<void> {
    try {
      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();

      // Create vector extension if it doesn't exist
      await this.ensureVectorExtension();

      console.log('PGVector client initialized successfully');
    } catch (error) {
      console.error('Failed to initialize PGVector client:', error);
      throw error;
    }
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    await this.pool.end();
  }

  /**
   * Check if connected to database
   */
  async ping(): Promise<boolean> {
    try {
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      return true;
    } catch (error) {
      console.error('PGVector ping failed:', error);
      return false;
    }
  }

  /**
   * Ensure pgvector extension is available
   */
  private async ensureVectorExtension(): Promise<void> {
    const client = await this.pool.connect();

    try {
      // Check if vector extension exists
      const result = await client.query(`
        SELECT * FROM pg_extension WHERE extname = 'vector';
      `);

      if (result.rows.length === 0) {
        console.log('Creating vector extension...');
        await client.query('CREATE EXTENSION IF NOT EXISTS vector;');
      }
    } catch (error) {
      console.error('Failed to ensure vector extension:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Create a collection (table) for vectors
   */
  async createCollection(schema: CollectionSchema): Promise<void> {
    const client = await this.pool.connect();

    try {
      const query = `
        CREATE TABLE IF NOT EXISTS ${schema.name} (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          content TEXT NOT NULL,
          embedding vector(${schema.dimension}) NOT NULL,
          metadata JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `;

      await client.query(query);

      // Create index for vector similarity search
      const indexQuery = `
        CREATE INDEX IF NOT EXISTS ${schema.name}_embedding_idx
        ON ${schema.name} USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100);
      `;

      await client.query(indexQuery);

      console.log(`Created collection: ${schema.name}`);
    } catch (error) {
      console.error(`Failed to create collection ${schema.name}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Store vector chunks in a collection
   */
  async store(collectionName: string, chunks: VectorChunk[]): Promise<number> {
    if (chunks.length === 0) return 0;

    const client = await this.pool.connect();

    try {
      const values: any[] = [];
      const placeholders: string[] = [];

      chunks.forEach((chunk, index) => {
        const baseIndex = index * 5;
        values.push(
          chunk.id,
          chunk.content,
          `[${chunk.embedding.join(',')}]`,
          JSON.stringify(chunk.metadata),
          new Date().toISOString()
        );
        placeholders.push(`($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5})`);
      });

      const query = `
        INSERT INTO ${collectionName} (id, content, embedding, metadata, created_at)
        VALUES ${placeholders.join(', ')}
        ON CONFLICT (id) DO UPDATE SET
          content = EXCLUDED.content,
          embedding = EXCLUDED.embedding,
          metadata = EXCLUDED.metadata,
          updated_at = NOW();
      `;

      const result = await client.query(query, values);
      return result.rowCount || 0;
    } catch (error) {
      console.error(`Failed to store chunks in ${collectionName}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Search for similar vectors
   */
  async search(
    collectionName: string,
    queryEmbedding: number[],
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    const client = await this.pool.connect();

    try {
      const limit = options.limit || 10;
      const threshold = options.threshold || 0.1;

      const query = `
        SELECT
          id,
          content,
          embedding,
          metadata,
          1 - (embedding <=> $1::vector) as similarity
        FROM ${collectionName}
        WHERE 1 - (embedding <=> $1::vector) > $2
        ORDER BY embedding <=> $1::vector
        LIMIT $3;
      `;

      const values = [
        `[${queryEmbedding.join(',')}]`,
        threshold,
        limit
      ];

      const result = await client.query(query, values);

      return result.rows.map(row => ({
        chunk: {
          id: row.id,
          content: row.content,
          embedding: row.embedding,
          metadata: row.metadata || {}
        },
        similarity: parseFloat(row.similarity)
      }));
    } catch (error) {
      console.error(`Failed to search in ${collectionName}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Delete vectors by IDs
   */
  async delete(collectionName: string, ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;

    const client = await this.pool.connect();

    try {
      const placeholders = ids.map((_, index) => `$${index + 1}`).join(', ');
      const query = `
        DELETE FROM ${collectionName}
        WHERE id IN (${placeholders});
      `;

      const result = await client.query(query, ids);
      return result.rowCount || 0;
    } catch (error) {
      console.error(`Failed to delete from ${collectionName}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get collection statistics
   */
  async getStats(collectionName: string): Promise<{
    totalVectors: number;
    indexSize: number;
    lastUpdated: Date;
  }> {
    const client = await this.pool.connect();

    try {
      const query = `
        SELECT
          COUNT(*) as total_vectors,
          pg_total_relation_size('${collectionName}') as index_size,
          MAX(updated_at) as last_updated
        FROM ${collectionName};
      `;

      const result = await client.query(query);

      return {
        totalVectors: parseInt(result.rows[0].total_vectors),
        indexSize: parseInt(result.rows[0].index_size),
        lastUpdated: new Date(result.rows[0].last_updated)
      };
    } catch (error) {
      console.error(`Failed to get stats for ${collectionName}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * List all collections
   */
  async listCollections(): Promise<string[]> {
    const client = await this.pool.connect();

    try {
      const query = `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE';
      `;

      const result = await client.query(query);
      return result.rows.map(row => row.table_name);
    } catch (error) {
      console.error('Failed to list collections:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Delete a collection
   */
  async deleteCollection(collectionName: string): Promise<boolean> {
    const client = await this.pool.connect();

    try {
      const query = `DROP TABLE IF EXISTS ${collectionName};`;
      await client.query(query);
      return true;
    } catch (error) {
      console.error(`Failed to delete collection ${collectionName}:`, error);
      return false;
    } finally {
      client.release();
    }
  }

  /**
   * Get vector by ID
   */
  async getById(collectionName: string, id: string): Promise<VectorChunk | null> {
    const client = await this.pool.connect();

    try {
      const query = `
        SELECT id, content, embedding, metadata
        FROM ${collectionName}
        WHERE id = $1;
      `;

      const result = await client.query(query, [id]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        content: row.content,
        embedding: row.embedding,
        metadata: row.metadata || {}
      };
    } catch (error) {
      console.error(`Failed to get vector by ID ${id}:`, error);
      return null;
    } finally {
      client.release();
    }
  }

  /**
   * Update vector by ID
   */
  async update(
    collectionName: string,
    id: string,
    updates: Partial<VectorChunk>
  ): Promise<boolean> {
    const client = await this.pool.connect();

    try {
      const updateFields: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (updates.content !== undefined) {
        updateFields.push(`content = $${paramCount}`);
        values.push(updates.content);
        paramCount++;
      }

      if (updates.embedding !== undefined) {
        updateFields.push(`embedding = $${paramCount}::vector`);
        values.push(`[${updates.embedding.join(',')}]`);
        paramCount++;
      }

      if (updates.metadata !== undefined) {
        updateFields.push(`metadata = $${paramCount}`);
        values.push(JSON.stringify(updates.metadata));
        paramCount++;
      }

      if (updateFields.length === 0) {
        return false;
      }

      updateFields.push(`updated_at = NOW()`);

      const query = `
        UPDATE ${collectionName}
        SET ${updateFields.join(', ')}
        WHERE id = $${paramCount};
      `;

      values.push(id);

      const result = await client.query(query, values);
      return (result.rowCount || 0) > 0;
    } catch (error) {
      console.error(`Failed to update vector ${id}:`, error);
      return false;
    } finally {
      client.release();
    }
  }

  /**
   * Get vectors by file IDs
   */
  async getByFileIds(collectionName: string, fileIds: number[]): Promise<VectorChunk[]> {
    if (fileIds.length === 0) return [];

    const client = await this.pool.connect();

    try {
      const placeholders = fileIds.map((_, index) => `$${index + 1}`).join(', ');
      const query = `
        SELECT id, content, embedding, metadata
        FROM ${collectionName}
        WHERE metadata->>'fileId' IN (${placeholders});
      `;

      const result = await client.query(query, fileIds.map(id => id.toString()));

      return result.rows.map(row => ({
        id: row.id,
        content: row.content,
        embedding: row.embedding,
        metadata: row.metadata || {}
      }));
    } catch (error) {
      console.error('Failed to get vectors by file IDs:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Clear all vectors from a collection
   */
  async clearCollection(collectionName: string): Promise<boolean> {
    const client = await this.pool.connect();

    try {
      const query = `DELETE FROM ${collectionName};`;
      await client.query(query);
      return true;
    } catch (error) {
      console.error(`Failed to clear collection ${collectionName}:`, error);
      return false;
    } finally {
      client.release();
    }
  }

  /**
   * Search with text query (generates embedding internally)
   * Note: This would need an embedding service integration
   */
  async searchWithText(
    collectionName: string,
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    // For now, return empty results - would need embedding service
    console.warn('Text search requires embedding service integration');
    return [];
  }

  /**
   * Get collection schema
   */
  async getCollectionSchema(collectionName: string): Promise<CollectionSchema | null> {
    const client = await this.pool.connect();

    try {
      const query = `
        SELECT
          column_name,
          data_type,
          character_maximum_length,
          is_nullable
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position;
      `;

      const result = await client.query(query, [collectionName]);

      // Extract vector dimension from embedding column
      const embeddingColumn = result.rows.find(row => row.column_name === 'embedding');
      if (!embeddingColumn) {
        return null;
      }

      // Parse vector dimension from data_type (e.g., "vector(1536)")
      const dimensionMatch = embeddingColumn.data_type.match(/vector\((\d+)\)/);
      const dimension = dimensionMatch ? parseInt(dimensionMatch[1]) : 1536;

      return {
        name: collectionName,
        dimension,
        metric: 'cosine' // Default metric
      };
    } catch (error) {
      console.error(`Failed to get schema for ${collectionName}:`, error);
      return null;
    } finally {
      client.release();
    }
  }
}

// Export collection schemas for common use cases
export const COLLECTION_SCHEMAS = {
  CODE_CHUNKS: {
    name: 'code_chunks',
    dimension: 1536, // OpenAI text-embedding-ada-002 dimensions
    metric: 'cosine' as const
  },
  DOCUMENT_CHUNKS: {
    name: 'document_chunks',
    dimension: 1536,
    metric: 'cosine' as const
  },
  WORKSPACE_VECTORS: {
    name: 'workspace_vectors',
    dimension: 1536,
    metric: 'cosine' as const
  }
};
