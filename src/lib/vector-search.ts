/**
 * Vector Search Library for VibeCode Platform
 * Integrates pgvector with AI project generation workflow
 */

import { Pool } from 'pg';

interface EmbeddingRecord {
  id: number;
  content_type: string;
  content_hash: string;
  embedding: number[];
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

interface SearchResult {
  id: number;
  content_type: string;
  content_hash: string;
  metadata: Record<string, any>;
  similarity: number;
}

interface SearchOptions {
  content_type?: string;
  language?: string;
  framework?: string;
  limit?: number;
  similarity_threshold?: number;
}

/**
 * Query rate tracker for monitoring similarity search performance
 * Uses a sliding window approach to track queries per minute
 */
class QueryRateTracker {
  private queryTimestamps: number[] = [];
  private readonly windowMs: number = 60 * 1000; // 1 minute window
  private readonly maxStoredQueries: number = 10000; // Prevent unbounded memory growth

  /**
   * Record a new query timestamp
   */
  recordQuery(): void {
    const now = Date.now();
    this.queryTimestamps.push(now);

    // Cleanup old entries and prevent memory growth
    this.cleanup(now);
  }

  /**
   * Remove timestamps outside the tracking window
   */
  private cleanup(now: number): void {
    const cutoff = now - this.windowMs;

    // Remove old timestamps
    while (this.queryTimestamps.length > 0 && this.queryTimestamps[0] < cutoff) {
      this.queryTimestamps.shift();
    }

    // Safety: if we have too many entries, keep only the most recent ones
    if (this.queryTimestamps.length > this.maxStoredQueries) {
      this.queryTimestamps = this.queryTimestamps.slice(-this.maxStoredQueries);
    }
  }

  /**
   * Get the average queries per minute over the tracking window
   */
  getQueriesPerMinute(): number {
    const now = Date.now();
    this.cleanup(now);

    // Count queries in the last minute
    const cutoff = now - this.windowMs;
    const queriesInWindow = this.queryTimestamps.filter(ts => ts >= cutoff).length;

    // Calculate rate (queries per minute)
    // If window is less than a minute old, extrapolate
    const windowStart = this.queryTimestamps.length > 0
      ? Math.max(this.queryTimestamps[0], cutoff)
      : now;
    const actualWindowMs = now - windowStart;

    if (actualWindowMs < 1000) {
      // Less than 1 second of data, return 0 to avoid misleading extrapolation
      return 0;
    }

    // Scale to per-minute rate
    return (queriesInWindow / actualWindowMs) * this.windowMs;
  }

  /**
   * Reset the tracker
   */
  reset(): void {
    this.queryTimestamps = [];
  }
}

// Global query rate tracker instance
const queryRateTracker = new QueryRateTracker();

export class VectorSearchService {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      host: process.env.PGVECTOR_HOST || 'pgvector-vibecode-pgvector.vibecode-webgui.svc.cluster.local',
      port: parseInt(process.env.PGVECTOR_PORT || '5432'),
      database: process.env.PGVECTOR_DATABASE || 'vibecode',
      user: process.env.PGVECTOR_USER || 'vibecode',
      password: process.env.PGVECTOR_PASSWORD,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }

  /**
   * Store an embedding in the vector database
   */
  async storeEmbedding(
    content_type: string,
    content_hash: string,
    embedding: number[],
    metadata: Record<string, any> = {}
  ): Promise<number> {
    const client = await this.pool.connect();
    try {
      const query = `
        INSERT INTO embeddings (content_type, content_hash, embedding, metadata)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (content_hash) 
        DO UPDATE SET 
          embedding = EXCLUDED.embedding,
          metadata = EXCLUDED.metadata,
          updated_at = NOW()
        RETURNING id
      `;
      
      const result = await client.query(query, [
        content_type,
        content_hash,
        `[${embedding.join(',')}]`,
        JSON.stringify(metadata)
      ]);
      
      return result.rows[0].id;
    } finally {
      client.release();
    }
  }

  /**
   * Perform semantic similarity search
   */
  async similaritySearch(
    queryEmbedding: number[],
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    // Record query for rate tracking
    queryRateTracker.recordQuery();

    const client = await this.pool.connect();
    try {
      const {
        content_type,
        language,
        framework,
        limit = 10,
        similarity_threshold = 1.0
      } = options;

      let whereClause = '';
      const params: any[] = [`[${queryEmbedding.join(',')}]`];
      let paramIndex = 2;

      const conditions: string[] = [];
      
      if (content_type) {
        conditions.push(`content_type = $${paramIndex++}`);
        params.push(content_type);
      }
      
      if (language) {
        conditions.push(`metadata->>'language' = $${paramIndex++}`);
        params.push(language);
      }
      
      if (framework) {
        conditions.push(`metadata->>'framework' = $${paramIndex++}`);
        params.push(framework);
      }
      
      if (similarity_threshold < 1.0) {
        conditions.push(`embedding <-> $1 < $${paramIndex++}`);
        params.push(similarity_threshold);
      }
      
      if (conditions.length > 0) {
        whereClause = `WHERE ${conditions.join(' AND ')}`;
      }

      const query = `
        SELECT 
          id,
          content_type,
          content_hash,
          metadata,
          embedding <-> $1 as similarity
        FROM embeddings
        ${whereClause}
        ORDER BY embedding <-> $1
        LIMIT $${paramIndex}
      `;
      
      params.push(limit);

      const result = await client.query(query, params);
      
      return result.rows.map(row => ({
        id: row.id,
        content_type: row.content_type,
        content_hash: row.content_hash,
        metadata: row.metadata,
        similarity: parseFloat(row.similarity)
      }));
    } finally {
      client.release();
    }
  }

  /**
   * Find similar code snippets for AI project generation
   */
  async findSimilarCode(
    queryEmbedding: number[],
    language?: string,
    framework?: string,
    limit: number = 5
  ): Promise<SearchResult[]> {
    return this.similaritySearch(queryEmbedding, {
      content_type: 'code',
      language,
      framework,
      limit,
      similarity_threshold: 0.8
    });
  }

  /**
   * Find relevant documentation for context
   */
  async findRelevantDocs(
    queryEmbedding: number[],
    limit: number = 3
  ): Promise<SearchResult[]> {
    return this.similaritySearch(queryEmbedding, {
      content_type: 'documentation',
      limit,
      similarity_threshold: 0.7
    });
  }

  /**
   * Hybrid search combining vector similarity with metadata filters
   */
  async hybridSearch(
    queryEmbedding: number[],
    filters: {
      content_types?: string[];
      languages?: string[];
      frameworks?: string[];
      date_range?: { start: Date; end: Date };
    },
    limit: number = 10
  ): Promise<SearchResult[]> {
    // Record query for rate tracking
    queryRateTracker.recordQuery();

    const client = await this.pool.connect();
    try {
      const conditions: string[] = [];
      const params: any[] = [`[${queryEmbedding.join(',')}]`];
      let paramIndex = 2;

      if (filters.content_types && filters.content_types.length > 0) {
        conditions.push(`content_type = ANY($${paramIndex++})`);
        params.push(filters.content_types);
      }

      if (filters.languages && filters.languages.length > 0) {
        conditions.push(`metadata->>'language' = ANY($${paramIndex++})`);
        params.push(filters.languages);
      }

      if (filters.frameworks && filters.frameworks.length > 0) {
        conditions.push(`metadata->>'framework' = ANY($${paramIndex++})`);
        params.push(filters.frameworks);
      }

      if (filters.date_range) {
        conditions.push(`created_at BETWEEN $${paramIndex++} AND $${paramIndex++}`);
        params.push(filters.date_range.start, filters.date_range.end);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const query = `
        SELECT 
          id,
          content_type,
          content_hash,
          metadata,
          embedding <-> $1 as similarity
        FROM embeddings
        ${whereClause}
        ORDER BY embedding <-> $1
        LIMIT $${paramIndex}
      `;
      
      params.push(limit);

      const result = await client.query(query, params);
      
      return result.rows.map(row => ({
        id: row.id,
        content_type: row.content_type,
        content_hash: row.content_hash,
        metadata: row.metadata,
        similarity: parseFloat(row.similarity)
      }));
    } finally {
      client.release();
    }
  }

  /**
   * Get embedding statistics for monitoring
   */
  async getStats(): Promise<{
    total_embeddings: number;
    by_content_type: Record<string, number>;
    by_language: Record<string, number>;
    avg_similarity_queries_per_minute: number;
  }> {
    const client = await this.pool.connect();
    try {
      const totalQuery = 'SELECT COUNT(*) as total FROM embeddings';
      const totalResult = await client.query(totalQuery);
      
      const typeQuery = `
        SELECT content_type, COUNT(*) as count 
        FROM embeddings 
        GROUP BY content_type
      `;
      const typeResult = await client.query(typeQuery);
      
      const langQuery = `
        SELECT metadata->>'language' as language, COUNT(*) as count 
        FROM embeddings 
        WHERE metadata->>'language' IS NOT NULL
        GROUP BY metadata->>'language'
      `;
      const langResult = await client.query(langQuery);
      
      return {
        total_embeddings: parseInt(totalResult.rows[0].total),
        by_content_type: typeResult.rows.reduce((acc, row) => {
          acc[row.content_type] = parseInt(row.count);
          return acc;
        }, {}),
        by_language: langResult.rows.reduce((acc, row) => {
          acc[row.language] = parseInt(row.count);
          return acc;
        }, {}),
        avg_similarity_queries_per_minute: Math.round(queryRateTracker.getQueriesPerMinute() * 100) / 100
      };
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
