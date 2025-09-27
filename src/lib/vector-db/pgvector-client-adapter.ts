/**
 * PGVector Client Adapter
 * Wraps the PGVector client to conform to the VectorDatabaseInterface
 * Moved from src/lib/ai/vector-stores/pgvector-client.ts for consolidation
 */

import { Pool, PoolClient } from 'pg';
import { VectorDatabaseInterface } from './vector-database-interface';
import { VectorChunk, SearchResult, SearchOptions } from './vector-types';
import { BaseVectorDatabaseAdapter } from './base-vector-database-adapter';

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

/**
 * PGVector Client that provides direct vector database operations
 * This class provides lower-level operations for advanced use cases
 */
export class PGVectorClient {
  private pool: Pool;

  constructor(config: PGVectorConfig) {
    this.pool = new Pool(config);
  }

  /**
   * Initialize the database and create required tables
   */
  async initialize(): Promise<void> {
    const client = await this.pool.connect();
    try {
      // Create the pgvector extension if it doesn't exist
      await client.query('CREATE EXTENSION IF NOT EXISTS vector');

      // Create collections table
      await client.query(`
        CREATE TABLE IF NOT EXISTS vector_collections (
          name VARCHAR(255) PRIMARY KEY,
          dimensions INTEGER NOT NULL,
          distance_metric VARCHAR(50) DEFAULT 'cosine',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create documents table
      await client.query(`
        CREATE TABLE IF NOT EXISTS vector_documents (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          collection_name VARCHAR(255) REFERENCES vector_collections(name) ON DELETE CASCADE,
          content TEXT NOT NULL,
          metadata JSONB DEFAULT '{}',
          embedding vector,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create indexes for performance
      await client.query(`
        CREATE INDEX IF NOT EXISTS vector_documents_embedding_idx 
        ON vector_documents USING ivfflat (embedding vector_cosine_ops)
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS vector_documents_collection_idx 
        ON vector_documents(collection_name)
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS vector_documents_metadata_idx 
        ON vector_documents USING GIN(metadata)
      `);

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
   * Close the connection pool
   */
  async close(): Promise<void> {
    await this.pool.end();
  }
}

/**
 * Collection schemas for common use cases
 */
export const COLLECTION_SCHEMAS: Record<string, PGVectorCollectionSchema> = {
  documents: {
    name: 'documents',
    dimensions: 1536,
    distanceMetric: 'cosine',
    properties: {
      fileName: 'string',
      filePath: 'string',
      fileId: 'integer',
      workspaceId: 'integer',
    },
  },
  code: {
    name: 'code',
    dimensions: 1536,
    distanceMetric: 'cosine',
    properties: {
      fileName: 'string',
      language: 'string',
      fileId: 'integer',
      startLine: 'integer',
      endLine: 'integer',
    },
  },
};

/**
 * PGVector Adapter - Wrapper to conform to VectorDatabaseInterface
 * This provides compatibility with the main vector database interface
 */
export class PGVectorAdapter extends BaseVectorDatabaseAdapter {
  private client: PGVectorClient;
  private collectionName: string = 'vibecode_documents';

  constructor(config: PGVectorConfig) {
    super();
    this.client = new PGVectorClient(config);
  }

  async initialize(): Promise<void> {
    await this.client.initialize();
    await this.client.createCollection({
      name: this.collectionName,
      dimensions: 1536,
      distanceMetric: 'cosine',
      properties: {}
    });
  }

  async storeChunks(fileId: number, chunks: Array<{
    content: string;
    startLine?: number;
    endLine?: number;
    tokens: number;
  }>): Promise<void> {
    const documents = chunks.map(chunk => ({
      content: chunk.content,
      collection: this.collectionName,
      metadata: {
        fileId,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        tokens: chunk.tokens,
      },
      embedding: [], // Will be generated by the base class
    }));

    for (const doc of documents) {
      doc.embedding = await this.generateEmbedding(doc.content);
    }

    await this.client.addDocuments(this.collectionName, documents);
  }

  async search(embedding: number[], options: SearchOptions = {}): Promise<SearchResult[]> {
    const results = await this.client.search(
      this.collectionName,
      embedding,
      options.limit || 10,
      options.threshold || 0.7
    );

    return results.map(result => ({
      chunk: {
        id: result.id,
        content: result.content,
        embedding: embedding, // Return the query embedding for consistency
        metadata: {
          fileId: result.metadata.fileId,
          fileName: result.metadata.fileName || 'unknown',
          startLine: result.metadata.startLine,
          endLine: result.metadata.endLine,
          language: result.metadata.language,
          tokens: result.metadata.tokens || 0,
        },
      },
      similarity: result.similarity,
    }));
  }

  async deleteFileChunks(fileId: number): Promise<void> {
    // This would require a direct database query - implementation depends on table schema
    console.log(`Delete chunks for file ${fileId} - implementation needed`);
  }

  async getStats(): Promise<{ totalChunks: number; totalFiles: number; averageChunkSize: number }> {
    // Implementation would query the vector_documents table
    return {
      totalChunks: 0,
      totalFiles: 0,
      averageChunkSize: 0,
    };
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}