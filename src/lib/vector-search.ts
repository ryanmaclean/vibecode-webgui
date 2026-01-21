/**
 * Vector Search Library for VibeCode Platform
 *
 * Integrates pgvector with AI project generation workflow to enable semantic
 * similarity search across code snippets, documentation, and other embedded content.
 *
 * @module vector-search
 *
 * @example
 * ```typescript
 * import { VectorSearchService } from '@/lib/vector-search';
 *
 * const searchService = new VectorSearchService();
 *
 * // Store an embedding
 * const id = await searchService.storeEmbedding(
 *   'code',
 *   'hash123',
 *   [0.1, 0.2, ...],
 *   { language: 'typescript', framework: 'react' }
 * );
 *
 * // Search for similar code
 * const results = await searchService.findSimilarCode(queryEmbedding, 'typescript', 'react');
 *
 * // Don't forget to close when done
 * await searchService.close();
 * ```
 */

import { Pool } from 'pg';

/**
 * Represents a stored embedding record in the database.
 *
 * @interface EmbeddingRecord
 * @property id - Unique identifier for the embedding
 * @property content_type - Type of content (e.g., 'code', 'documentation')
 * @property content_hash - Hash of the original content for deduplication
 * @property embedding - The vector embedding as an array of numbers
 * @property metadata - Additional metadata about the content
 * @property created_at - Timestamp when the record was created
 * @property updated_at - Timestamp when the record was last updated
 */
interface EmbeddingRecord {
  id: number;
  content_type: string;
  content_hash: string;
  embedding: number[];
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

/**
 * Represents a search result with similarity score.
 *
 * @interface SearchResult
 * @property id - Unique identifier of the matching embedding
 * @property content_type - Type of the matched content
 * @property content_hash - Hash of the matched content
 * @property metadata - Metadata associated with the matched content
 * @property similarity - Similarity score (lower is more similar, using L2 distance)
 */
interface SearchResult {
  id: number;
  content_type: string;
  content_hash: string;
  metadata: Record<string, any>;
  similarity: number;
}

/**
 * Options for configuring similarity search queries.
 *
 * @interface SearchOptions
 * @property content_type - Filter by content type (e.g., 'code', 'documentation')
 * @property language - Filter by programming language
 * @property framework - Filter by framework (e.g., 'react', 'nextjs')
 * @property limit - Maximum number of results to return (default: 10)
 * @property similarity_threshold - Maximum distance threshold for results (default: 1.0)
 */
interface SearchOptions {
  content_type?: string;
  language?: string;
  framework?: string;
  limit?: number;
  similarity_threshold?: number;
}

/**
 * Tracks query rates for monitoring similarity search performance.
 * Uses a sliding window approach to calculate queries per minute.
 *
 * @class QueryRateTracker
 *
 * @example
 * ```typescript
 * const tracker = new QueryRateTracker();
 *
 * // Record queries as they happen
 * tracker.recordQuery();
 *
 * // Get current rate
 * const qpm = tracker.getQueriesPerMinute();
 * console.log(`Current query rate: ${qpm} queries/minute`);
 * ```
 */
class QueryRateTracker {
  /** Array of timestamps for recorded queries */
  private queryTimestamps: number[] = [];
  /** Tracking window duration in milliseconds (1 minute) */
  private readonly windowMs: number = 60 * 1000;
  /** Maximum stored queries to prevent unbounded memory growth */
  private readonly maxStoredQueries: number = 10000;

  /**
   * Records a new query timestamp for rate tracking.
   * Automatically cleans up old entries outside the tracking window.
   *
   * @returns void
   */
  recordQuery(): void {
    const now = Date.now();
    this.queryTimestamps.push(now);

    // Cleanup old entries and prevent memory growth
    this.cleanup(now);
  }

  /**
   * Removes timestamps outside the tracking window and enforces memory limits.
   *
   * @param now - Current timestamp in milliseconds
   * @returns void
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
   * Calculates the average queries per minute over the tracking window.
   * Returns 0 if less than 1 second of data is available to avoid misleading extrapolation.
   *
   * @returns The calculated queries per minute rate
   *
   * @example
   * ```typescript
   * const rate = tracker.getQueriesPerMinute();
   * if (rate > 1000) {
   *   console.warn('High query rate detected');
   * }
   * ```
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
   * Resets the tracker by clearing all recorded timestamps.
   *
   * @returns void
   */
  reset(): void {
    this.queryTimestamps = [];
  }
}

/** Global query rate tracker instance for monitoring search performance */
const queryRateTracker = new QueryRateTracker();

/**
 * Service for performing vector similarity searches using pgvector.
 * Provides methods for storing embeddings, performing similarity searches,
 * and retrieving statistics.
 *
 * @class VectorSearchService
 *
 * @example
 * ```typescript
 * const service = new VectorSearchService();
 *
 * // Store embeddings
 * await service.storeEmbedding('code', 'abc123', embedding, { language: 'typescript' });
 *
 * // Search for similar content
 * const results = await service.similaritySearch(queryEmbedding, {
 *   content_type: 'code',
 *   limit: 5,
 *   similarity_threshold: 0.8
 * });
 *
 * // Clean up
 * await service.close();
 * ```
 */
export class VectorSearchService {
  /** PostgreSQL connection pool for pgvector queries */
  private pool: Pool;

  /**
   * Creates a new VectorSearchService instance with a configured connection pool.
   * Connection settings are loaded from environment variables with sensible defaults.
   *
   * Environment variables:
   * - PGVECTOR_HOST: Database host (default: pgvector service in k8s)
   * - PGVECTOR_PORT: Database port (default: 5432)
   * - PGVECTOR_DATABASE: Database name (default: 'vibecode')
   * - PGVECTOR_USER: Database user (default: 'vibecode')
   * - PGVECTOR_PASSWORD: Database password (required)
   * - NODE_ENV: Environment mode (production enables SSL)
   */
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
   * Stores an embedding in the vector database.
   * Uses upsert semantics - if content_hash already exists, updates the embedding and metadata.
   *
   * @param content_type - Type of content (e.g., 'code', 'documentation')
   * @param content_hash - Unique hash of the content for deduplication
   * @param embedding - Vector embedding as an array of numbers
   * @param metadata - Optional metadata to associate with the embedding
   * @returns The ID of the inserted or updated embedding record
   * @throws Error if database operation fails
   *
   * @example
   * ```typescript
   * const id = await service.storeEmbedding(
   *   'code',
   *   sha256(codeSnippet),
   *   await generateEmbedding(codeSnippet),
   *   { language: 'typescript', framework: 'react', file: 'App.tsx' }
   * );
   * ```
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
   * Performs semantic similarity search using vector distance.
   * Uses L2 (Euclidean) distance for similarity ranking.
   *
   * @param queryEmbedding - The query vector to search against
   * @param options - Search configuration options
   * @param options.content_type - Filter by content type
   * @param options.language - Filter by programming language (from metadata)
   * @param options.framework - Filter by framework (from metadata)
   * @param options.limit - Maximum results to return (default: 10)
   * @param options.similarity_threshold - Maximum distance threshold (default: 1.0)
   * @returns Array of search results sorted by similarity (most similar first)
   * @throws Error if database query fails
   *
   * @example
   * ```typescript
   * const results = await service.similaritySearch(queryEmbedding, {
   *   content_type: 'code',
   *   language: 'typescript',
   *   limit: 10,
   *   similarity_threshold: 0.5
   * });
   *
   * results.forEach(r => console.log(`${r.content_hash}: ${r.similarity}`));
   * ```
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
   * Finds similar code snippets for AI project generation.
   * Convenience method that wraps similaritySearch with code-specific defaults.
   *
   * @param queryEmbedding - The query vector to search against
   * @param language - Optional programming language filter
   * @param framework - Optional framework filter
   * @param limit - Maximum results to return (default: 5)
   * @returns Array of similar code search results
   * @throws Error if database query fails
   *
   * @example
   * ```typescript
   * const similarCode = await service.findSimilarCode(
   *   embedding,
   *   'typescript',
   *   'nextjs',
   *   10
   * );
   * ```
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
   * Finds relevant documentation for context in AI project generation.
   * Convenience method that wraps similaritySearch with documentation-specific defaults.
   *
   * @param queryEmbedding - The query vector to search against
   * @param limit - Maximum results to return (default: 3)
   * @returns Array of relevant documentation search results
   * @throws Error if database query fails
   *
   * @example
   * ```typescript
   * const docs = await service.findRelevantDocs(embedding, 5);
   * docs.forEach(doc => console.log(doc.metadata.title));
   * ```
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
   * Performs hybrid search combining vector similarity with advanced metadata filters.
   * Supports multiple filter arrays and date range filtering.
   *
   * @param queryEmbedding - The query vector to search against
   * @param filters - Filter configuration object
   * @param filters.content_types - Array of content types to include
   * @param filters.languages - Array of programming languages to include
   * @param filters.frameworks - Array of frameworks to include
   * @param filters.date_range - Optional date range filter with start and end dates
   * @param limit - Maximum results to return (default: 10)
   * @returns Array of search results matching the filters, sorted by similarity
   * @throws Error if database query fails
   *
   * @example
   * ```typescript
   * const results = await service.hybridSearch(
   *   queryEmbedding,
   *   {
   *     content_types: ['code', 'documentation'],
   *     languages: ['typescript', 'javascript'],
   *     frameworks: ['react', 'nextjs'],
   *     date_range: {
   *       start: new Date('2024-01-01'),
   *       end: new Date()
   *     }
   *   },
   *   20
   * );
   * ```
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
   * Gets embedding statistics for monitoring and analytics.
   * Returns aggregate counts and the current query rate.
   *
   * @returns Statistics object containing:
   *   - total_embeddings: Total count of stored embeddings
   *   - by_content_type: Counts grouped by content type
   *   - by_language: Counts grouped by programming language
   *   - avg_similarity_queries_per_minute: Current query rate
   * @throws Error if database query fails
   *
   * @example
   * ```typescript
   * const stats = await service.getStats();
   * console.log(`Total embeddings: ${stats.total_embeddings}`);
   * console.log(`By type:`, stats.by_content_type);
   * console.log(`Query rate: ${stats.avg_similarity_queries_per_minute} qpm`);
   * ```
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
   * Closes the connection pool and releases all database connections.
   * Should be called when the service is no longer needed.
   *
   * @returns Promise that resolves when all connections are closed
   *
   * @example
   * ```typescript
   * // Clean shutdown
   * await service.close();
   * ```
   */
  async close(): Promise<void> {
    await this.pool.end();
  }
}
