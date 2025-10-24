/**
 * Base Vector Database Adapter
 * Provides connection pooling, lifecycle management, and common helpers
 * for concrete vector database adapters. Concrete adapters supply the
 * provider-specific connection creation and query logic by extending this class.
 */

import { VectorDatabaseInterface } from './vector-database-interface';
import { VectorDatabaseConfig } from './vector-types';
// import { logger } from '@/lib/logger';

type Connection = Record<string, unknown> & {
  release?: () => Promise<void> | void;
  end?: () => Promise<void> | void;
  destroy?: () => Promise<void> | void;
  query?: (sql: string, params?: unknown) => Promise<unknown>;
};

export interface ConnectionPoolConfig {
  min?: number;
  max?: number;
  acquireTimeoutMillis?: number;
  idleTimeoutMillis?: number;
}

export interface ExtendedVectorDatabaseConfig extends VectorDatabaseConfig {
  connectionPooling?: boolean;
  connectionAcquireTimeoutMs?: number;
  connectionAcquireRetryDelayMs?: number;
  connectionIdleTimeoutMs?: number;
  connectionPool?: ConnectionPoolConfig;
  vectorQueryTimeoutMs?: number;
  batchSize?: number;
  enableQueryCache?: boolean;
  queryCacheTtlMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  enableMetrics?: boolean;
  compressionEnabled?: boolean;
  parallelQueries?: boolean;
  maxParallelQueries?: number;
}

// Enhanced defaults for vector operations
const DEFAULT_MAX_POOL_SIZE = 15; // Increased for vector operations
const DEFAULT_MIN_POOL_SIZE = 2;  // Maintain minimum connections
const DEFAULT_ACQUIRE_TIMEOUT_MS = 10_000; // Longer timeout for vector operations
const DEFAULT_ACQUIRE_RETRY_DELAY_MS = 50;  // Slightly longer retry delay
const DEFAULT_IDLE_TIMEOUT_MS = 300_000;    // 5 minutes for vector connections
const DEFAULT_VECTOR_QUERY_TIMEOUT_MS = 30_000; // 30 seconds for vector searches
const DEFAULT_BATCH_SIZE = 100; // Default batch size for vector operations

export abstract class BaseVectorDatabaseAdapter
  implements VectorDatabaseInterface
{
  public isInitialized = false;

  protected readonly config: ExtendedVectorDatabaseConfig;
  protected readonly maxPoolSize: number;
  protected readonly minPoolSize: number;
  protected readonly connectionAcquireTimeoutMs: number;
  protected readonly connectionAcquireRetryDelayMs: number;
  protected readonly connectionIdleTimeoutMs: number;
  protected readonly vectorQueryTimeoutMs: number;
  protected readonly batchSize: number;
  protected readonly enableQueryCache: boolean;
  protected readonly queryCacheTtlMs: number;
  protected readonly maxRetries: number;
  protected readonly retryDelayMs: number;
  protected readonly enableMetrics: boolean;
  protected readonly parallelQueries: boolean;
  protected readonly maxParallelQueries: number;

  private readonly activeConnections = new Set<Connection>();
  private readonly queryCache = new Map<string, { result: any; timestamp: number }>();
  private readonly connectionMetrics = {
    totalConnections: 0,
    activeConnections: 0,
    failedConnections: 0,
    queryCount: 0,
    avgQueryTime: 0,
    lastQueryTime: 0,
  };

  protected constructor(config: ExtendedVectorDatabaseConfig) {
    this.config = config;

    const poolConfig = config.connectionPool ?? {};

    this.maxPoolSize = Math.max(
      1,
      poolConfig.max ?? config.maxPoolSize ?? DEFAULT_MAX_POOL_SIZE,
    );

    this.minPoolSize = Math.max(
      DEFAULT_MIN_POOL_SIZE,
      poolConfig.min ?? config.minPoolSize ?? DEFAULT_MIN_POOL_SIZE,
    );

    this.connectionAcquireTimeoutMs =
      poolConfig.acquireTimeoutMillis ??
      config.connectionAcquireTimeoutMs ??
      DEFAULT_ACQUIRE_TIMEOUT_MS;

    this.connectionAcquireRetryDelayMs =
      config.connectionAcquireRetryDelayMs ?? DEFAULT_ACQUIRE_RETRY_DELAY_MS;

    this.connectionIdleTimeoutMs =
      poolConfig.idleTimeoutMillis ??
      config.connectionIdleTimeoutMs ??
      DEFAULT_IDLE_TIMEOUT_MS;

    // Vector-specific configurations
    this.vectorQueryTimeoutMs = config.vectorQueryTimeoutMs ?? DEFAULT_VECTOR_QUERY_TIMEOUT_MS;
    this.batchSize = config.batchSize ?? DEFAULT_BATCH_SIZE;
    this.enableQueryCache = config.enableQueryCache ?? true;
    this.queryCacheTtlMs = config.queryCacheTtlMs ?? 300_000; // 5 minutes
    this.maxRetries = config.maxRetries ?? 3;
    this.retryDelayMs = config.retryDelayMs ?? 1000;
    this.enableMetrics = config.enableMetrics ?? true;
    this.parallelQueries = config.parallelQueries ?? true;
    this.maxParallelQueries = config.maxParallelQueries ?? 5;
  }

  /**
   * Initialize provider resources once.
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      await this.initializeProvider();
      this.isInitialized = true;
    } catch (error) {
      this.isInitialized = false;
      console.error('Failed to initialize vector database provider', { error });
      throw error;
    }
  }

  /**
   * Close provider resources and release active connections.
   */
  public async close(): Promise<void> {
    const releaseTasks = Array.from(this.activeConnections).map((connection) =>
      this.releaseConnection(connection).catch((error) => {
        console.warn('Failed to release vector database connection cleanly', {
          error,
        });
      }),
    );

    await Promise.all(releaseTasks);

    try {
      await this.closeProvider();
    } finally {
      this.activeConnections.clear();
      this.isInitialized = false;
    }
  }

  /**
   * Acquire a connection from the pool with timeout handling.
   */
  public async getConnection<T = Connection>(): Promise<T> {
    await this.ensureInitialized();

    const start = Date.now();
    const timeout = this.connectionAcquireTimeoutMs;

    while (true) {
      if (this.activeConnections.size < this.maxPoolSize) {
        let connection: Connection | null = null;

        try {
          connection = await this.createPoolConnection();
          const isValid = await this.validatePoolConnection(connection);

          if (!isValid) {
            throw new Error('Connection validation failed');
          }

          this.activeConnections.add(connection);
          return connection as T;
        } catch (error) {
          if (connection) {
            await this.safeCloseConnection(connection).catch(() => undefined);
          }
          throw error;
        }
      }

      const elapsed = Date.now() - start;
      if (elapsed >= timeout) {
        throw new Error('Connection pool reached maximum size');
      }

      const delay = Math.min(
        this.connectionAcquireRetryDelayMs,
        timeout - elapsed,
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  /**
   * Release a connection back to the pool.
   */
  public async releaseConnection(connection: Connection | null | undefined): Promise<void> {
    if (!connection) {
      return;
    }

    if (!this.activeConnections.has(connection)) {
      return;
    }

    this.activeConnections.delete(connection);
    await this.safeCloseConnection(connection).catch((error) => {
      console.warn('Failed to close vector database connection', { error });
    });
  }

  /**
   * Reset adapter state for testing or reinitialization without closing provider.
   */
  public reset(): void {
    this.isInitialized = false;
    this.activeConnections.clear();
    this.queryCache.clear();
    this.resetMetrics();
  }

  /**
   * Get connection pool metrics
   */
  public getConnectionMetrics() {
    return {
      ...this.connectionMetrics,
      activeConnections: this.activeConnections.size,
      poolUtilization: this.activeConnections.size / this.maxPoolSize,
    };
  }

  /**
   * Clear query cache
   */
  public clearCache(): void {
    this.queryCache.clear();
  }

  /**
   * Execute query with caching and retry logic
   */
  protected async executeWithCache<T>(
    cacheKey: string,
    queryFn: () => Promise<T>,
    useCache: boolean = this.enableQueryCache
  ): Promise<T> {
    // Check cache first
    if (useCache && this.queryCache.has(cacheKey)) {
      const cached = this.queryCache.get(cacheKey)!;
      if (Date.now() - cached.timestamp < this.queryCacheTtlMs) {
        return cached.result;
      } else {
        this.queryCache.delete(cacheKey);
      }
    }

    // Execute with retry logic
    let lastError: Error | null = null;
    const startTime = Date.now();

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await queryFn();
        
        // Update metrics
        if (this.enableMetrics) {
          this.updateQueryMetrics(Date.now() - startTime);
        }

        // Cache result
        if (useCache) {
          this.queryCache.set(cacheKey, {
            result,
            timestamp: Date.now(),
          });
        }

        return result;
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < this.maxRetries) {
          await new Promise(resolve => 
            setTimeout(resolve, this.retryDelayMs * Math.pow(2, attempt))
          );
        }
      }
    }

    throw lastError;
  }

  /**
   * Execute multiple queries in parallel with concurrency control
   */
  protected async executeParallel<T>(
    queries: Array<() => Promise<T>>,
    maxConcurrency: number = this.maxParallelQueries
  ): Promise<T[]> {
    if (!this.parallelQueries || queries.length <= 1) {
      return Promise.all(queries.map(q => q()));
    }

    const results: T[] = [];
    const executing: Promise<void>[] = [];
    let index = 0;

    const executeNext = async (): Promise<void> => {
      const currentIndex = index++;
      if (currentIndex >= queries.length) return;

      try {
        const result = await queries[currentIndex]();
        results[currentIndex] = result;
      } catch (error) {
        throw error;
      }

      return executeNext();
    };

    // Start initial batch
    for (let i = 0; i < Math.min(maxConcurrency, queries.length); i++) {
      executing.push(executeNext());
    }

    await Promise.all(executing);
    return results;
  }

  /**
   * Batch process items with optimal chunk size
   */
  protected async processBatch<T, R>(
    items: T[],
    processor: (batch: T[]) => Promise<R>,
    batchSize: number = this.batchSize
  ): Promise<R[]> {
    const results: R[] = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const result = await processor(batch);
      results.push(result);
    }

    return results;
  }

  /**
   * Update query performance metrics
   */
  private updateQueryMetrics(queryTime: number): void {
    this.connectionMetrics.queryCount++;
    this.connectionMetrics.lastQueryTime = queryTime;
    
    // Calculate rolling average
    const totalTime = this.connectionMetrics.avgQueryTime * (this.connectionMetrics.queryCount - 1) + queryTime;
    this.connectionMetrics.avgQueryTime = totalTime / this.connectionMetrics.queryCount;
  }

  /**
   * Reset performance metrics
   */
  private resetMetrics(): void {
    this.connectionMetrics.totalConnections = 0;
    this.connectionMetrics.activeConnections = 0;
    this.connectionMetrics.failedConnections = 0;
    this.connectionMetrics.queryCount = 0;
    this.connectionMetrics.avgQueryTime = 0;
    this.connectionMetrics.lastQueryTime = 0;
  }

  /**
   * Determine if the adapter can reach the provider.
   */
  public async isConnected(): Promise<boolean> {
    try {
      return await this.ping();
    } catch (error) {
      console.debug('Vector database connectivity check failed', { error });
      return false;
    }
  }

  /**
   * Ping the provider.
   */
  public async ping(timeoutMs?: number): Promise<boolean> {
    await this.ensureInitialized();
    return this.pingProvider(timeoutMs);
  }

  /**
   * Simple end-to-end connection test.
   */
  public async testConnection(): Promise<boolean> {
    let connection: Connection | null = null;

    try {
      connection = await this.getConnection();

      if (connection?.query) {
        await connection.query('SELECT 1');
      }

      await this.releaseConnection(connection);
      connection = null;
      return true;
    } catch (error) {
      console.warn('Vector database connection test failed', { error });

      if (connection) {
        await this.releaseConnection(connection).catch(() => undefined);
      }

      return false;
    }
  }

  // Abstract operations to be implemented by concrete adapters
  public abstract storeChunks(
    fileId: number,
    chunks: Array<{
      content: string;
      startLine?: number;
      endLine?: number;
      tokens: number;
    }>,
  ): Promise<void>;

  public abstract search(
    embedding: number[],
    options?: Parameters<VectorDatabaseInterface['search']>[1],
  ): ReturnType<VectorDatabaseInterface['search']>;

  public abstract searchWithText(
    query: string,
    options?: Parameters<VectorDatabaseInterface['searchWithText']>[1],
  ): ReturnType<VectorDatabaseInterface['searchWithText']>;

  public abstract deleteFileChunks(fileId: number): Promise<void>;

  public abstract getStats(): Promise<{
    totalChunks: number;
    totalFiles: number;
    averageChunkSize: number;
  }>;

  public abstract invalidateCache(table: string, contentType?: string): Promise<number>;

  public abstract generateEmbedding(text: string): Promise<number[]>;

  // Provider-specific hooks
  protected abstract initializeProvider(): Promise<void>;
  protected abstract pingProvider(timeoutMs?: number): Promise<boolean>;
  protected abstract closeProvider(): Promise<void>;
  protected abstract createPoolConnection(): Promise<Connection>;

  protected async validatePoolConnection(_connection: Connection): Promise<boolean> {
    return true;
  }

  protected async closePoolConnection(connection: Connection): Promise<void> {
    if (typeof connection.release === 'function') {
      await connection.release();
      return;
    }

    if (typeof connection.end === 'function') {
      await connection.end();
      return;
    }

    if (typeof connection.destroy === 'function') {
      await connection.destroy();
    }
  }

  private async safeCloseConnection(connection: Connection): Promise<void> {
    await this.closePoolConnection(connection);
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }
}

export default BaseVectorDatabaseAdapter;
