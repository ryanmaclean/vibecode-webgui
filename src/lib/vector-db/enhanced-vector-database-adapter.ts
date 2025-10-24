/**
 * Enhanced Vector Database Adapter
 * Adds retry capabilities and improved error handling to vector database operations
 */

import { VectorDatabaseInterface } from './vector-database-interface';
import { VectorDatabaseConfig, SearchOptions, SearchResult } from './vector-types';
import { RetryHandler, RetryConfig } from './vector-retry-handler';
import { VectorDbError, VectorDbErrorType, VectorDbErrorHandler } from './vector-db-error-handler';
import { logger } from '../logger';

/**
 * Enhanced vector database adapter with retry mechanism
 * Decorates existing adapter implementations with retry capabilities
 */
export class EnhancedVectorDatabaseAdapter implements VectorDatabaseInterface {
  private adapter: VectorDatabaseInterface;
  private retryHandler: RetryHandler;
  private adapterName: string;
  private errorHandler: VectorDbErrorHandler;

  /**
   * Create a new enhanced vector database adapter
   * @param adapter The base adapter to enhance
   * @param config Vector database configuration
   * @param retryConfig Retry configuration
   */
  constructor(
    adapter: VectorDatabaseInterface,
    config: VectorDatabaseConfig,
    retryConfig?: Partial<RetryConfig>
  ) {
    this.adapter = adapter;
    this.retryHandler = new RetryHandler(retryConfig);
    this.adapterName = `${config.provider}-adapter`;
    this.errorHandler = new VectorDbErrorHandler(this.adapterName);
  }

  /**
   * Initialize the database connection with retry
   */
  public async initialize(): Promise<void> {
    return this.retryHandler.executeWithRetry(
      async () => this.adapter.initialize(),
      'initialize'
    );
  }

  /**
   * Search with retry mechanism
   */
  public async search(embedding: number[], options?: SearchOptions): Promise<SearchResult[]> {
    try {
      return await this.retryHandler.executeWithRetry(
        async () => this.adapter.search(embedding, options),
        'search',
        (error) => {
          // Connection errors and query timeouts are retryable
          if (error instanceof VectorDbError) {
            return error.type === VectorDbErrorType.CONNECTION_FAILED ||
                  (error.type === VectorDbErrorType.QUERY_FAILED && 
                   error.message.toLowerCase().includes('timeout'));
          }
          return false;
        }
      );
    } catch (error) {
      const enhancedError = this.errorHandler.handleError(
        error, 
        'search'
      );
      
      // Log detailed search context
      logger.error('Vector search failed after retries', {
        provider: this.adapterName,
        embeddingSize: embedding.length,
        options: {
          workspaceId: options?.workspaceId,
          limit: options?.limit,
          threshold: options?.threshold,
          fileCount: options?.fileIds?.length,
          useCache: options?.useCache
        },
        error: enhancedError
      });
      
      throw enhancedError;
    }
  }

  /**
   * Search with text and retry mechanism
   */
  public async searchWithText(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    try {
      return await this.retryHandler.executeWithRetry(
        async () => this.adapter.searchWithText(query, options),
        'searchWithText'
      );
    } catch (error) {
      const enhancedError = this.errorHandler.handleError(
        error, 
        'searchWithText'
      );
      
      logger.error('Vector text search failed after retries', {
        provider: this.adapterName,
        query: query.substring(0, 100), // Truncate long queries
        options: {
          workspaceId: options?.workspaceId,
          limit: options?.limit,
          threshold: options?.threshold,
          fileCount: options?.fileIds?.length,
          useCache: options?.useCache
        },
        error: enhancedError
      });
      
      throw enhancedError;
    }
  }

  /**
   * Store chunks with retry mechanism
   */
  public async storeChunks(
    fileId: number, 
    chunks: Array<{
      content: string;
      startLine?: number;
      endLine?: number;
      tokens: number;
    }>
  ): Promise<void> {
    try {
      return await this.retryHandler.executeWithRetry(
        async () => this.adapter.storeChunks(fileId, chunks),
        'storeChunks',
        (error) => {
          // Only retry connection issues and certain query failures
          if (error instanceof VectorDbError) {
            return error.type === VectorDbErrorType.CONNECTION_FAILED ||
                  (error.type === VectorDbErrorType.VECTOR_CREATION_FAILED && 
                   !error.message.toLowerCase().includes('duplicate'));
          }
          return false;
        }
      );
    } catch (error) {
      const enhancedError = this.errorHandler.handleError(
        error, 
        'storeChunks'
      );
      
      // Log detailed context
      logger.error('Failed to store vector chunks after retries', {
        provider: this.adapterName,
        fileId,
        chunkCount: chunks.length,
        totalTokens: chunks.reduce((sum, chunk) => sum + chunk.tokens, 0),
        error: enhancedError
      });
      
      throw enhancedError;
    }
  }

  /**
   * Delete file chunks with retry mechanism
   */
  public async deleteFileChunks(fileId: number): Promise<void> {
    try {
      return await this.retryHandler.executeWithRetry(
        async () => this.adapter.deleteFileChunks(fileId),
        'deleteFileChunks',
        (error) => {
          // Only retry connection issues
          if (error instanceof VectorDbError) {
            return error.type === VectorDbErrorType.CONNECTION_FAILED ||
                  error.type === VectorDbErrorType.VECTOR_CREATION_FAILED;
          }
          return false;
        }
      );
    } catch (error) {
      const enhancedError = this.errorHandler.handleError(
        error, 
        'deleteFileChunks'
      );
      
      logger.error('Failed to delete vector chunks after retries', {
        provider: this.adapterName,
        fileId,
        error: enhancedError
      });
      
      throw enhancedError;
    }
  }

  /**
   * Get database statistics with retry mechanism
   */
  public async getStats(): Promise<{
    totalChunks: number;
    totalFiles: number;
    averageChunkSize: number;
  }> {
    try {
      return await this.retryHandler.executeWithRetry(
        async () => this.adapter.getStats(),
        'getStats'
      );
    } catch (error) {
      logger.error('Failed to get vector database stats after retries', {
        provider: this.adapterName,
        error
      });
      
      // Return empty stats as fallback
      return {
        totalChunks: 0,
        totalFiles: 0,
        averageChunkSize: 0
      };
    }
  }

  /**
   * Invalidate cache with retry mechanism
   */
  public async invalidateCache(table: string, contentType?: string): Promise<number> {
    try {
      return await this.retryHandler.executeWithRetry(
        async () => this.adapter.invalidateCache(table, contentType),
        'invalidateCache'
      );
    } catch (error) {
      logger.error('Failed to invalidate cache after retries', {
        provider: this.adapterName,
        table,
        contentType,
        error
      });
      
      // Return 0 as fallback
      return 0;
    }
  }

  /**
   * Generate embedding with retry mechanism
   */
  public async generateEmbedding(text: string): Promise<number[]> {
    try {
      return await this.retryHandler.executeWithRetry(
        async () => this.adapter.generateEmbedding(text),
        'generateEmbedding'
      );
    } catch (error) {
      const enhancedError = this.errorHandler.handleError(
        error,
        'generateEmbedding'
      );
      
      logger.error('Failed to generate embedding after retries', {
        provider: this.adapterName,
        textLength: text.length,
        error: enhancedError
      });
      
      throw enhancedError;
    }
  }

  /**
   * Check connection status
   */
  public async isConnected(): Promise<boolean> {
    try {
      return await this.adapter.isConnected();
    } catch (error) {
      logger.warn('Error checking connection status', {
        provider: this.adapterName,
        error
      });
      return false;
    }
  }

  /**
   * Ping the database
   */
  public async ping(timeoutMs?: number): Promise<boolean> {
    try {
      return await this.retryHandler.executeWithRetry(
        async () => this.adapter.ping(timeoutMs),
        'ping'
      );
    } catch (error) {
      logger.warn('Ping failed after retries', {
        provider: this.adapterName,
        error
      });
      return false;
    }
  }

  /**
   * Close the database connection
   */
  public async close(): Promise<void> {
    try {
      await this.adapter.close();
    } catch (error) {
      logger.warn('Error closing database connection', {
        provider: this.adapterName,
        error
      });
    }
  }

  /**
   * Get retry handler status
   */
  public getRetryStatus(): {
    circuitBroken: boolean;
    recentFailures: number;
    remainingResetTimeMs: number;
  } {
    return this.retryHandler.getStatus();
  }

  /**
   * Reset the circuit breaker
   */
  public resetCircuitBreaker(): void {
    this.retryHandler.resetCircuit();
    logger.info(`Circuit breaker reset for ${this.adapterName}`);
  }
}
