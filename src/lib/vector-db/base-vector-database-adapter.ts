/**
 * Abstract Base Vector Database Adapter
 * Provides common functionality for all vector database providers
 */

import OpenAI from 'openai';
import { VectorDatabaseInterface } from './vector-database-interface';
import { VectorChunk, SearchResult, SearchOptions, VectorDatabaseConfig } from './vector-types';
import { metrics } from '../server-monitoring';
<<<<<<< HEAD
=======
import { logger } from '../logger';
import { ConnectionPool, ConnectionPoolConfig } from './connection-pool';
import { VectorDbError, VectorDbErrorType, VectorDbErrorHandler } from './vector-db-error-handler';
>>>>>>> fix/consolidated-dependency-updates

export abstract class BaseVectorDatabaseAdapter implements VectorDatabaseInterface {
  protected config: VectorDatabaseConfig;
  protected isInitialized = false;
<<<<<<< HEAD
  protected connectionStatus = false;
  protected retryCount = 0;
  protected lastError: Error | null = null;
=======
  protected openai: OpenAI | null = null;
  protected connectionPool: ConnectionPool | null = null;
  protected errorHandler: VectorDbErrorHandler;
>>>>>>> fix/consolidated-dependency-updates

  /**
   * Constructor for the base adapter
   * @param config Configuration for the vector database
   */
  constructor(config: VectorDatabaseConfig) {
    this.config = {
      cacheEnabled: true,
      retryAttempts: 3,
      retryDelay: 1000,
      enableMetrics: true,
      enableLogging: true,
      ...config
    };

    // Initialize OpenAI client for embeddings
    if (process.env.OPENROUTER_API_KEY) {
      this.openai = new OpenAI({
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: process.env.OPENROUTER_API_KEY,
      });
    }
  }

  /**
   * Initialize the database connection
   * This must be called before using the adapter
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      const startTime = Date.now();
      
      // Call provider-specific initialization
      await this.initializeProvider();
      
<<<<<<< HEAD
=======
      // Initialize connection pool if enabled
      if (this.config.connectionPooling) {
        await this.initializeConnectionPool();
      }
      
>>>>>>> fix/consolidated-dependency-updates
      this.isInitialized = true;
      
      if (this.config.enableLogging) {
<<<<<<< HEAD
        console.info(`Vector database adapter (${this.config.provider}) initialized successfully`);
=======
        console.info(`Vector database adapter initialized in ${Date.now() - startTime}ms`);
>>>>>>> fix/consolidated-dependency-updates
      }
    } catch (error) {
      if (this.config.enableLogging) {
<<<<<<< HEAD
        console.error(`Failed to initialize vector database adapter (${this.config.provider}):`, error);
=======
        console.error('Failed to initialize vector database adapter:', error);
>>>>>>> fix/consolidated-dependency-updates
      }
      throw error;
    }
  }

  /**
   * Provider-specific initialization
   * Must be implemented by each provider
   */
  protected abstract initializeProvider(): Promise<void>;

  /**
   * Generate embeddings for text content
   */
  public async generateEmbedding(text: string): Promise<number[]> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized. Check OPENROUTER_API_KEY');
    }

    try {
      const startTime = Date.now();
      
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small', // Using OpenAI embedding model via OpenRouter
        input: text,
      });
      
      if (this.config.enableMetrics) {
        metrics.histogram('vector_db.embedding.duration', Date.now() - startTime);
        metrics.increment('vector_db.embedding.success');
      }

      return response.data[0].embedding;
    } catch (error) {
      if (this.config.enableMetrics) {
        metrics.increment('vector_db.embedding.error');
      }
      
      if (this.config.enableLogging) {
        console.error('Error generating embedding:', error);
      }
      
      // Fallback: return zero vector
      return new Array(1536).fill(0); // text-embedding-3-small returns 1536-dimensional vectors
    }
  }

  /**
   * Search with raw text query (generates embedding internally)
   */
  public async searchWithText(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    try {
      const startTime = Date.now();
      
      // Generate embedding for the query
      const embedding = await this.generateEmbedding(query);
      
      // Perform vector search with the embedding
      const results = await this.search(embedding, options);
      
      if (this.config.enableMetrics) {
        metrics.histogram('vector_db.text_search.duration', Date.now() - startTime);
        metrics.increment('vector_db.text_search.success');
      }
      
      return results;
    } catch (error) {
      if (this.config.enableMetrics) {
        metrics.increment('vector_db.text_search.error');
      }
      
      if (this.config.enableLogging) {
        console.error('Error in text search:', error);
      }
      
      // Fallback to simpler text search if available
      return this.fallbackTextSearch(query, options);
    }
  }

  /**
   * Fallback text search when vector search is not available
   * Can be overridden by providers for custom implementation
   */
  protected async fallbackTextSearch(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    // Default implementation returns empty array
    // Providers should override this with their own implementation
    if (this.config.enableLogging) {
      console.warn('Fallback text search not implemented for this provider');
    }
    return [];
  }

  /**
   * Check if the database is connected
   */
  public async isConnected(): Promise<boolean> {
    if (!this.isInitialized) {
      return false;
    }
    
    try {
      // Use ping to check connection
      return await this.ping();
    } catch (error) {
      this.connectionStatus = false;
      return false;
    }
  }

  /**
   * Ping the database to check connectivity
   */
  public async ping(timeoutMs: number = 5000): Promise<boolean> {
    if (!this.isInitialized) {
      return false;
    }
    
    try {
      const startTime = Date.now();
      
      // Use provider-specific ping implementation
      const result = await Promise.race([
        this.pingProvider(),
        new Promise<boolean>((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout')), timeoutMs)
        )
      ]);
      
      this.connectionStatus = result;
      
      if (this.config.enableMetrics) {
        metrics.histogram('vector_db.ping.duration', Date.now() - startTime);
        metrics.increment(result ? 'vector_db.ping.success' : 'vector_db.ping.failure');
      }
      
      return result;
    } catch (error) {
      this.connectionStatus = false;
      this.lastError = error instanceof Error ? error : new Error(String(error));
      
      if (this.config.enableMetrics) {
        metrics.increment('vector_db.ping.error');
      }
      
      if (this.config.enableLogging) {
        console.error('Error pinging vector database:', error);
      }
      
      return false;
    }
  }

  /**
   * Provider-specific ping implementation
   * Must be implemented by each provider
   */
  protected abstract pingProvider(): Promise<boolean>;

  /**
   * Close the database connection
   */
  public async close(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }
    
    try {
      const startTime = Date.now();
      
<<<<<<< HEAD
=======
      // Close connection pool if it exists
      if (this.connectionPool) {
        await this.connectionPool.close();
        this.connectionPool = null;
      }
      
>>>>>>> fix/consolidated-dependency-updates
      // Call provider-specific close method
      await this.closeProvider();
      
      this.isInitialized = false;
      this.connectionStatus = false;
      
      if (this.config.enableMetrics) {
        metrics.histogram('vector_db.close.duration', Date.now() - startTime);
        metrics.increment('vector_db.close.success');
      }
      
      if (this.config.enableLogging) {
<<<<<<< HEAD
        console.info(`Vector database adapter (${this.config.provider}) closed successfully`);
      }
=======
        logger.info(`Vector database adapter (${this.config.provider}) closed successfully`);      }
>>>>>>> fix/consolidated-dependency-updates
    } catch (error) {
      if (this.config.enableMetrics) {
        metrics.increment('vector_db.close.error');
      }
      
      if (this.config.enableLogging) {
<<<<<<< HEAD
        console.error(`Error closing vector database adapter (${this.config.provider}):`, error);
      }
=======
        logger.error(`Error closing vector database adapter (${this.config.provider}):`, error);      }
>>>>>>> fix/consolidated-dependency-updates
      
      throw error;
    }
  }

  /**
   * Provider-specific close implementation
   * Must be implemented by each provider
   */
  protected abstract closeProvider(): Promise<void>;

  // Abstract methods that must be implemented by providers
  public abstract storeChunks(fileId: number, chunks: Array<{
    content: string;
    startLine?: number;
    endLine?: number;
    tokens: number;
  }>): Promise<void>;
  
  public abstract search(embedding: number[], options?: SearchOptions): Promise<SearchResult[]>;
  
  public abstract deleteFileChunks(fileId: number): Promise<void>;
  
  public abstract getStats(): Promise<{
    totalChunks: number;
    totalFiles: number;
    averageChunkSize: number;
  }>;
  
  public abstract invalidateCache(table: string, contentType?: string): Promise<number>;
}