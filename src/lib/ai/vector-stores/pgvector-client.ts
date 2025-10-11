/**
 * PGVector Client for Vector Database Operations
 * Integrates with existing PostgreSQL infrastructure using pgvector extension
 */

import { Pool } from 'pg';
<<<<<<< HEAD

=======
>>>>>>> fix/consolidated-dependency-updates
export interface PGVectorConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

export interface PGVectorDocument {
  id: string;
  content: string;
  metadata: Record<string, any>;
  embedding: number[];
  collection: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PGVectorSearchResult {
  id: string;
  content: string;
  metadata: Record<string, any>;
  similarity: number;
  collection: string;
}

export interface PGVectorCollectionSchema {
  name: string;
  dimensions: number;
  distanceMetric: 'cosine' | 'euclidean' | 'dotproduct';
  properties: Record<string, string>;
}

export class PGVectorClient {
  private pool: Pool;

<<<<<<< HEAD
  constructor(config: PGVectorConfig) {
    this.pool = new Pool(config);
=======
  constructor(config: PGVectorConfig) {    this.pool = new Pool(config);
>>>>>>> fix/consolidated-dependency-updates
  }

  /**
   * Initialize the database with pgvector extension
   */
  async initialize(): Promise<void> {
    const client = await this.pool.connect();
    try {
      // Enable pgvector extension
      await client.query('CREATE EXTENSION IF NOT EXISTS vector;');
      
      // Create collections table
      await client.query(`
        CREATE TABLE IF NOT EXISTS vector_collections (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) UNIQUE NOT NULL,
          dimensions INTEGER NOT NULL,
          distance_metric VARCHAR(50) DEFAULT 'cosine',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Create documents table with vector support
      await client.query(`
        CREATE TABLE IF NOT EXISTS vector_documents (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          collection_name VARCHAR(255) NOT NULL,
          content TEXT NOT NULL,
          metadata JSONB DEFAULT '{}',
          embedding vector(1536), -- OpenAI embedding dimensions
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (collection_name) REFERENCES vector_collections(name) ON DELETE CASCADE
        );
      `);

      // Create indexes for better performance
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_vector_documents_collection 
        ON vector_documents(collection_name);
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_vector_documents_embedding 
        ON vector_documents USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100);
      `);

      console.log('✅ PGVector database initialized successfully');
    } finally {
      client.release();
    }
  }

  /**
   * Create a new collection
   */
  async createCollection(schema: PGVectorCollectionSchema): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await client.query(`
        INSERT INTO vector_collections (name, dimensions, distance_metric)
        VALUES ($1, $2, $3)
        ON CONFLICT (name) DO UPDATE SET
          dimensions = EXCLUDED.dimensions,
          distance_metric = EXCLUDED.distance_metric,
          updated_at = CURRENT_TIMESTAMP
      `, [schema.name, schema.dimensions, schema.distanceMetric]);

      return true;
    } catch (error) {
      console.error('Failed to create collection:', error);
      return false;
    } finally {
      client.release();
    }
  }

  /**
   * Add documents to a collection
   */
  async addDocuments(
    collectionName: string,
    documents: Omit<PGVectorDocument, 'id' | 'createdAt' | 'updatedAt'>[]
  ): Promise<string[]> {
    const client = await this.pool.connect();
    try {
      const ids: string[] = [];
      
      for (const doc of documents) {
        const result = await client.query(`
          INSERT INTO vector_documents (collection_name, content, metadata, embedding)
          VALUES ($1, $2, $3, $4)
          RETURNING id
        `, [collectionName, doc.content, doc.metadata, doc.embedding]);
        
        ids.push(result.rows[0].id);
      }

      return ids;
    } finally {
      client.release();
    }
  }

  /**
   * Search for similar documents
   */
  async search(
    collectionName: string,
    queryEmbedding: number[],
    limit: number = 10,
    similarityThreshold: number = 0.7
  ): Promise<PGVectorSearchResult[]> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT 
          id,
          content,
          metadata,
          collection_name,
          1 - (embedding <=> $1) as similarity
        FROM vector_documents
        WHERE collection_name = $2
          AND 1 - (embedding <=> $1) > $3
        ORDER BY embedding <=> $1
        LIMIT $4
      `, [queryEmbedding, collectionName, similarityThreshold, limit]);

      return result.rows.map(row => ({
        id: row.id,
        content: row.content,
        metadata: row.metadata,
        similarity: row.similarity,
        collection: row.collection_name,
      }));
    } finally {
      client.release();
    }
  }

  /**
   * Hybrid search combining vector similarity and text search
   */
  async hybridSearch(
    collectionName: string,
    queryEmbedding: number[],
    queryText: string,
    limit: number = 10,
    similarityWeight: number = 0.7,
    textWeight: number = 0.3
  ): Promise<PGVectorSearchResult[]> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT 
          id,
          content,
          metadata,
          collection_name,
          (
            $3 * (1 - (embedding <=> $1)) + 
            $4 * similarity(content, $2)
          ) as combined_score
        FROM vector_documents
        WHERE collection_name = $5
        ORDER BY combined_score DESC
        LIMIT $6
      `, [queryEmbedding, queryText, similarityWeight, textWeight, collectionName, limit]);

      return result.rows.map(row => ({
        id: row.id,
        content: row.content,
        metadata: row.metadata,
        similarity: row.combined_score,
        collection: row.collection_name,
      }));
    } finally {
      client.release();
    }
  }

  /**
   * Get a specific document by ID
   */
  async getDocument(id: string): Promise<PGVectorDocument | null> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT 
          id,
          content,
          metadata,
          embedding,
          collection_name,
          created_at,
          updated_at
        FROM vector_documents
        WHERE id = $1
      `, [id]);

      if (result.rows.length === 0) return null;

      const row = result.rows[0];
      return {
        id: row.id,
        content: row.content,
        metadata: row.metadata,
        embedding: row.embedding,
        collection: row.collection_name,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Update a document
   */
  async updateDocument(
    id: string,
    updates: Partial<Pick<PGVectorDocument, 'content' | 'metadata' | 'embedding'>>
  ): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      const fields: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (updates.content !== undefined) {
        fields.push(`content = $${paramCount++}`);
        values.push(updates.content);
      }

      if (updates.metadata !== undefined) {
        fields.push(`metadata = $${paramCount++}`);
        values.push(updates.metadata);
      }

      if (updates.embedding !== undefined) {
        fields.push(`embedding = $${paramCount++}`);
        values.push(updates.embedding);
      }

      if (fields.length === 0) return false;

      fields.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(id);

      const query = `
        UPDATE vector_documents
        SET ${fields.join(', ')}
        WHERE id = $${paramCount}
      `;

      const result = await client.query(query, values);
<<<<<<< HEAD
      return result.rowCount !== null && result.rowCount !== undefined && result.rowCount > 0;
    } finally {
=======
      return result.rowCount !== null && result.rowCount !== undefined && result.rowCount > 0;    } finally {
>>>>>>> fix/consolidated-dependency-updates
      client.release();
    }
  }

  /**
   * Delete a document
   */
  async deleteDocument(id: string): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        DELETE FROM vector_documents
        WHERE id = $1
      `, [id]);

<<<<<<< HEAD
      return result.rowCount !== null && result.rowCount !== undefined && result.rowCount > 0;
    } finally {
=======
      return result.rowCount !== null && result.rowCount !== undefined && result.rowCount > 0;    } finally {
>>>>>>> fix/consolidated-dependency-updates
      client.release();
    }
  }

  /**
   * Delete an entire collection
   */
  async deleteCollection(name: string): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        DELETE FROM vector_collections
        WHERE name = $1
      `, [name]);

<<<<<<< HEAD
      return result.rowCount !== null && result.rowCount !== undefined && result.rowCount > 0;
    } finally {
=======
      return result.rowCount !== null && result.rowCount !== undefined && result.rowCount > 0;    } finally {
>>>>>>> fix/consolidated-dependency-updates
      client.release();
    }
  }

  /**
   * List all collections
   */
  async listCollections(): Promise<string[]> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT name FROM vector_collections
        ORDER BY created_at
      `);

      return result.rows.map(row => row.name);
    } finally {
      client.release();
    }
  }

  /**
   * Get collection statistics
   */
  async getCollectionStats(collectionName: string): Promise<{
    documentCount: number;
    totalSize: number;
    averageEmbeddingLength: number;
  }> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT 
          COUNT(*) as document_count,
          COALESCE(SUM(LENGTH(content)), 0) as total_size,
          COALESCE(AVG(ARRAY_LENGTH(embedding, 1)), 0) as avg_embedding_length
        FROM vector_documents
        WHERE collection_name = $1
      `, [collectionName]);

      const row = result.rows[0];
      return {
        documentCount: parseInt(row.document_count),
        totalSize: parseInt(row.total_size),
        averageEmbeddingLength: parseFloat(row.avg_embedding_length),
      };
    } finally {
      client.release();
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      return true;
    } catch (error) {
      console.error('PGVector health check failed:', error);
      return false;
    }
  }

  /**
   * Close the connection pool
   */
  async close(): Promise<void> {
    await this.pool.end();
  }
}

/**
 * Predefined collection schemas for common use cases
 */
export const COLLECTION_SCHEMAS: Record<string, PGVectorCollectionSchema> = {
  DOCUMENTS: {
    name: 'documents',
    dimensions: 1536, // OpenAI embedding dimensions
    distanceMetric: 'cosine',
    properties: {
      title: 'text',
      content: 'text',
      type: 'text',
      tags: 'array',
      author: 'text',
      created_at: 'timestamp',
    },
  },
  CODE_SNIPPETS: {
    name: 'code_snippets',
    dimensions: 1536,
    distanceMetric: 'cosine',
    properties: {
      language: 'text',
      framework: 'text',
      function_name: 'text',
      description: 'text',
      tags: 'array',
      complexity: 'text',
      created_at: 'timestamp',
    },
  },
  USER_QUERIES: {
    name: 'user_queries',
    dimensions: 1536,
    distanceMetric: 'cosine',
    properties: {
      query: 'text',
      intent: 'text',
      context: 'text',
      user_id: 'text',
      session_id: 'text',
      created_at: 'timestamp',
    },
  },
};

/**
 * Factory function to create PGVector client
 */
export function createPGVectorClient(config: PGVectorConfig): PGVectorClient {
  return new PGVectorClient(config);
}
