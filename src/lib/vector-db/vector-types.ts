/**
 * Vector Database Types
 * Common types used across the vector database adapters
 */

/**
 * Vector Chunk representing a piece of content with its embedding
 */
export interface VectorChunk {
  id: string;
  content: string;
  embedding: number[];
  metadata: {
    fileId: number;
    fileName: string;
    startLine?: number;
    endLine?: number;
    language?: string;
    tokens: number;
  };
}

/**
 * Search Result containing a chunk and its similarity score
 */
export interface SearchResult {
  chunk: VectorChunk;
  similarity: number;
}

/**
 * Search Options for vector similarity queries
 */
export interface SearchOptions {
  workspaceId?: number;
  fileIds?: number[];
  limit?: number;
  threshold?: number;
  useCache?: boolean;
  language?: string;
  contentTypes?: string[];
  queryText?: string; // Original query text for fallback text search
}

/**
 * Vector Database Provider Types
 */
export enum VectorDatabaseProvider {
  POSTGRES = "postgres",
  SQLSERVER = "sqlserver",
  COSMOSDB = "cosmosdb",
  REDIS = "redis",
  COGNITIVE_SEARCH = "cognitive_search",
  FABRIC = "fabric",
  KUSTO = "kusto",
  MONGODB = "mongodb",
}

/**
 * Vector Database Configuration
 */
export interface VectorDatabaseConfig {
  provider: VectorDatabaseProvider;
  connectionString?: string;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  database?: string;
  schema?: string;
  cacheEnabled?: boolean;
  cacheTtl?: number;
  retryAttempts?: number;
  retryDelay?: number;
  enableMetrics?: boolean;
  enableLogging?: boolean;
  maxPoolSize?: number;
  minPoolSize?: number;

  /**
   * Enable connection pooling
   * Default: false
   */
  connectionPooling?: boolean;

  /**
   * Acquire timeout in milliseconds for connection pool
   * Default: 30000 (30 seconds)
   */
  connectionAcquireTimeoutMs?: number;

  /**
   * Maximum lifetime of a connection in milliseconds
   * Default: 3600000 (1 hour)
   */
  connectionMaxLifetimeMs?: number;

  /**
   * Idle timeout for connections in milliseconds
   * Default: 300000 (5 minutes)
   */
  connectionIdleTimeoutMs?: number;

  /**
   * Embedding model identifier (e.g. text-embedding-3-large)
   */
  embeddingModel?: string;

  /**
   * Expected embedding dimensions for the configured model
   */
  embeddingDimensions?: number;
}
