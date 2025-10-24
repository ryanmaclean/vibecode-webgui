/**
 * Vector Database Type Definitions
 * Common types used across different vector database adapters
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

export interface SearchResult {
  chunk: VectorChunk;
  similarity: number;
}

export interface VectorDatabaseConfig {
  provider: 'pgvector' | 'sqlserver' | 'cosmosdb' | 'redis';
  connectionString?: string;
  options?: Record<string, any>;
  embedding: {
    provider: 'openai' | 'azure' | 'cohere' | 'local';
    apiKey?: string;
    model?: string;
    dimension?: number;
    options?: Record<string, any>;
  };
  cache?: VectorCacheConfig;
  poolSize?: number;
  timeout?: number;
  retryOptions?: {
    maxRetries: number;
    initialDelay: number;
    maxDelay: number;
  };
}

export interface VectorCacheConfig {
  enabled: boolean;
  provider: 'redis' | 'valkey' | 'memory' | 'azurecache';
  connectionString?: string;
  ttl?: {
    default: number;
    min: number;
    max: number;
  };
  options?: Record<string, any>;
}

export interface VectorSearchOptions {
  workspaceId?: number;
  fileIds?: number[];
  limit?: number;
  threshold?: number;
  useCache?: boolean;
  language?: string;
  contentTypes?: string[];
}

export interface VectorStoreStats {
  totalChunks: number;
  totalFiles: number;
  averageChunkSize: number;
  cacheStats?: {
    hitRate: number;
    hitCount: number;
    missCount: number;
  };
}

// Vector similarity query interface for caching
export interface VectorSimilarityQuery {
  embedding: number[];
  dimension?: number;
  limit?: number;
  minSimilarity?: number;
  filter?: Record<string, any>;
  table?: string;
  contentTypes?: string[];
}

// Vector similarity result interface
export interface VectorSimilarityResult {
  id: string | number;
  similarity: number;
  metadata?: Record<string, any>;
  content?: string;
  table?: string;
  contentType?: string;
}

// Type for result arrays
export type VectorSimilarityResults = VectorSimilarityResult[];

export interface CacheStats {
  hitCount: number;
  missCount: number;
  skipCount: number;
  hitRate: number;
}