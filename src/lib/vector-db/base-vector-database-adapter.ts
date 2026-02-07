import OpenAI from 'openai';

import { VectorDatabaseInterface } from './vector-database-interface';
import { SearchOptions, SearchResult, VectorDatabaseConfig } from './vector-types';
import { metrics } from '../server-monitoring';
// import { logger } from '../logger';
import { ConnectionPool, ConnectionPoolConfig } from './connection-pool';
import { VectorDbErrorHandler } from './vector-db-error-handler';

type ExtendedConfig = VectorDatabaseConfig & {
  cacheEnabled: boolean;
  retryAttempts: number;
  retryDelay: number;
  enableMetrics: boolean;
  enableLogging: boolean;
};

export abstract class BaseVectorDatabaseAdapter implements VectorDatabaseInterface {
  protected readonly config: ExtendedConfig;
  protected isInitialized = false;
  protected connectionStatus = false;
  protected lastError: Error | null = null;
  protected openai: OpenAI | null = null;
  protected connectionPool: ConnectionPool<unknown> | null = null;
  protected readonly errorHandler: VectorDbErrorHandler;

  constructor(config: VectorDatabaseConfig) {
    this.config = {
      cacheEnabled: config.cacheEnabled ?? true,
      retryAttempts: config.retryAttempts ?? 3,
      retryDelay: config.retryDelay ?? 1_000,
      enableMetrics: config.enableMetrics ?? true,
      enableLogging: config.enableLogging ?? true,
      ...config,
    } as ExtendedConfig;

    this.errorHandler = new VectorDbErrorHandler(
      config.provider,
      this.config.enableLogging,
      this.config.enableMetrics,
    );

    const apiKey = process.env.OPENROUTER_API_KEY ?? process.env.OPENAI_API_KEY;
    if (apiKey) {
      this.openai = new OpenAI({
        apiKey,
        baseURL: process.env.OPENROUTER_API_KEY ? 'https://openrouter.ai/api/v1' : undefined,
      });
    }
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      const startTime = Date.now();
      await this.initializeProvider();

      if (this.shouldUseConnectionPool()) {
        await this.initializeConnectionPool();
      }

      this.isInitialized = true;
      this.connectionStatus = true;

      if (this.config.enableMetrics) {
        metrics.histogram(`vector_db.${this.config.provider}.initialize.duration`, Date.now() - startTime);
        metrics.increment(`vector_db.${this.config.provider}.initialize.success`);
      }

      if (this.config.enableLogging) {
        console.log(`Vector database adapter (${this.config.provider}) initialized successfully`);
      }
    } catch (error) {
      this.lastError = error instanceof Error ? error : new Error(String(error));

      if (this.config.enableMetrics) {
        metrics.increment(`vector_db.${this.config.provider}.initialize.error`);
      }

      if (this.config.enableLogging) {
        console.error(`Failed to initialize vector database adapter (${this.config.provider})`, {
          error: this.lastError,
        });
      }

      throw this.errorHandler.handleError(this.lastError, 'initialize', undefined, undefined, {
        provider: this.config.provider,
      });
    }
  }

  public async generateEmbedding(text: string): Promise<number[]> {
    if (!this.openai) {
      return new Array(1_536).fill(0);
    }

    try {
      const startTime = Date.now();
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
      });

      if (this.config.enableMetrics) {
        metrics.histogram('vector_db.embedding.duration', Date.now() - startTime);
        metrics.increment('vector_db.embedding.success');
      }

      return response.data[0]?.embedding ?? new Array(1_536).fill(0);
    } catch (error) {
      if (this.config.enableMetrics) {
        metrics.increment('vector_db.embedding.error');
      }

      if (this.config.enableLogging) {
        console.error('Error generating embedding', { error });
      }

      return new Array(1_536).fill(0);
    }
  }

  public async searchWithText(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    try {
      const embedding = await this.generateEmbedding(query);
      return await this.search(embedding, options);
    } catch (error) {
      if (this.config.enableMetrics) {
        metrics.increment('vector_db.text_search.error');
      }

      if (this.config.enableLogging) {
        console.error('Error performing text-based vector search', { error });
      }

      return this.fallbackTextSearch(query, options);
    }
  }

  public async isConnected(): Promise<boolean> {
    if (!this.isInitialized) {
      return false;
    }

    try {
      const result = await this.ping();
      this.connectionStatus = result;
      return result;
    } catch (error) {
      this.lastError = error instanceof Error ? error : new Error(String(error));
      this.connectionStatus = false;
      return false;
    }
  }

  public async initializeConnectionPool(): Promise<void> {
    if (!this.shouldUseConnectionPool()) {
      return;
    }

    const poolConfig: ConnectionPoolConfig<unknown> = {
      minConnections: this.config.minPoolSize ?? 2,
      maxConnections: this.config.maxPoolSize ?? 10,
      createConnection: () => this.createPoolConnection(),
      validateConnectionFn: (connection: unknown) => this.validatePoolConnection(connection),
      closeConnection: (connection: unknown) => this.closePoolConnection(connection),
    };

    this.connectionPool = new ConnectionPool(poolConfig);

    if (this.config.enableLogging) {
      console.log(`Connection pool initialized for ${this.config.provider} adapter`, {
        minConnections: poolConfig.minConnections,
        maxConnections: poolConfig.maxConnections,
      });
    }
  }

  public async acquireConnection(): Promise<unknown> {
    if (!this.connectionPool) {
      throw new Error('Connection pool is not enabled for this adapter');
    }

    return this.connectionPool.acquire();
  }

  public async releaseConnection(connection: unknown): Promise<void> {
    if (!this.connectionPool) {
      return;
    }

    await this.connectionPool.release(connection);
  }

  public async ping(timeoutMs: number = 5_000): Promise<boolean> {
    if (!this.isInitialized) {
      return false;
    }

    try {
      const startTime = Date.now();
      const result = await Promise.race([
        this.pingProvider(),
        new Promise<boolean>((_, reject) =>
          setTimeout(() => reject(new Error('Connection timeout')), timeoutMs)
        ),
      ]);

      if (this.config.enableMetrics) {
        metrics.histogram(`vector_db.${this.config.provider}.ping.duration`, Date.now() - startTime);
        metrics.increment(`vector_db.${this.config.provider}.ping.${result ? 'success' : 'failure'}`);
      }

      return result;
    } catch (error) {
      this.lastError = error instanceof Error ? error : new Error(String(error));

      if (this.config.enableMetrics) {
        metrics.increment(`vector_db.${this.config.provider}.ping.error`);
      }

      if (this.config.enableLogging) {
        console.error('Error pinging vector database', { error: this.lastError });
      }

      return false;
    }
  }

  public async close(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    try {
      const startTime = Date.now();

      if (this.connectionPool) {
        await this.connectionPool.close();
        this.connectionPool = null;
      }

      await this.closeProvider();

      this.isInitialized = false;
      this.connectionStatus = false;

      if (this.config.enableMetrics) {
        metrics.histogram(`vector_db.${this.config.provider}.close.duration`, Date.now() - startTime);
        metrics.increment(`vector_db.${this.config.provider}.close.success`);
      }

      if (this.config.enableLogging) {
        console.log(`Vector database adapter (${this.config.provider}) closed successfully`);
      }
    } catch (error) {
      this.lastError = error instanceof Error ? error : new Error(String(error));

      if (this.config.enableMetrics) {
        metrics.increment(`vector_db.${this.config.provider}.close.error`);
      }

      if (this.config.enableLogging) {
        console.error(`Error closing vector database adapter (${this.config.provider})`, {
          error: this.lastError,
        });
      }

      throw this.errorHandler.handleError(this.lastError, 'close', undefined, undefined, {
        provider: this.config.provider,
      });
    }
  }

  protected async fallbackTextSearch(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    if (this.config.enableLogging) {
      console.warn('Fallback text search not implemented for this adapter', {
        provider: this.config.provider,
        query: query.slice(0, 100),
        options,
      });
    }
    return [];
  }

  protected shouldUseConnectionPool(): boolean {
    return Boolean(this.config.maxPoolSize && this.config.maxPoolSize > 0);
  }

  protected async createPoolConnection(): Promise<unknown> {
    throw new Error('Connection pooling not implemented for this adapter');
  }

  protected async validatePoolConnection(_connection: unknown): Promise<boolean> {
    return true;
  }

  protected async closePoolConnection(_connection: unknown): Promise<void> {
    // Default implementation does nothing
  }

  protected abstract initializeProvider(): Promise<void>;
  protected abstract closeProvider(): Promise<void>;
  protected abstract pingProvider(): Promise<boolean>;

  public abstract storeChunks(
    fileId: number,
    chunks: Array<{
      content: string;
      startLine?: number;
      endLine?: number;
      tokens: number;
    }>
  ): Promise<void>;

  public abstract search(embedding: number[], options?: SearchOptions): Promise<SearchResult[]>;
  public abstract deleteFileChunks(fileId: number): Promise<void>;
  public abstract getStats(): Promise<{
    totalChunks: number;
    totalFiles: number;
    averageChunkSize: number;
  }>;
  public abstract invalidateCache(table: string, contentType?: string): Promise<number>;
}

export default BaseVectorDatabaseAdapter;
