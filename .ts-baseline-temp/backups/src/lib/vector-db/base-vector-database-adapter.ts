/**
 * Abstract Base Vector Database Adapter
 * Provides common functionality for all vector database providers
 */

import OpenAI from 'openai';
import type { Span } from 'dd-trace';
import { VectorDatabaseInterface } from './vector-database-interface';
import { SearchResult, SearchOptions, VectorDatabaseConfig } from './vector-types';
import { metrics } from '../server-monitoring';
import { llmObservability } from '../datadog-llm';

/**
 * Abstract base class for vector database adapters
 * Implements common functionality that can be shared across providers
 */
export abstract class BaseVectorDatabaseAdapter implements VectorDatabaseInterface {
  protected config: VectorDatabaseConfig;
  protected openai: OpenAI | null = null;
  protected isInitialized = false;
  protected connectionStatus = false;
  protected retryCount = 0;
  protected lastError: Error | null = null;
  protected embeddingModelIdentifier: string;
  protected embeddingModelTag: string;
  protected embeddingDimensions: number;

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

    const configuredModel = this.config.embeddingModel || process.env.OPENROUTER_EMBEDDING_MODEL || process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
    this.embeddingModelTag = this.normalizeModelTag(configuredModel);
    this.embeddingModelIdentifier = this.determineModelIdentifier(configuredModel);
    this.embeddingDimensions = this.config.embeddingDimensions || this.resolveModelDimensions(this.embeddingModelTag);

    // Initialize OpenAI client for embeddings
    if (process.env.OPENROUTER_API_KEY) {
      this.openai = new OpenAI({
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: process.env.OPENROUTER_API_KEY,
      });
    } else if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
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
      
      this.isInitialized = true;
      this.connectionStatus = true;
      this.retryCount = 0;
      
      if (this.config.enableMetrics) {
        metrics.histogram('vector_db.initialize.duration', Date.now() - startTime);
        metrics.increment('vector_db.initialize.success');
      }
      
      if (this.config.enableLogging) {
        console.info(`Vector database adapter (${this.config.provider}) initialized successfully`);
      }
    } catch (error) {
      this.connectionStatus = false;
      this.lastError = error instanceof Error ? error : new Error(String(error));
      
      if (this.config.enableMetrics) {
        metrics.increment('vector_db.initialize.error');
      }
      
      if (this.config.enableLogging) {
        console.error(`Failed to initialize vector database adapter (${this.config.provider}):`, error);
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

    return llmObservability.createTaskSpan(
      'vector-db.embedding',
      async (span?: Span) => {
        const startTime = Date.now();

        try {
          const response = await this.openai!.embeddings.create({
            model: this.embeddingModelIdentifier,
            input: text,
          });

          const embedding = response.data[0].embedding;
          const duration = Date.now() - startTime;

          if (this.config.enableMetrics) {
            metrics.histogram('vector_db.embedding.duration', duration, {
              provider: this.config.provider,
              model: this.embeddingModelTag,
            });
            metrics.increment('vector_db.embedding.success', {
              provider: this.config.provider,
              model: this.embeddingModelTag,
            });
          }

          span?.setTag('embedding.model', this.embeddingModelTag);
          span?.setTag('embedding.provider', this.config.provider);
          span?.setTag('embedding.dimensions', embedding.length);
          span?.setTag('embedding.duration_ms', duration);
          span?.setTag('embedding.input_length', text.length);

          if (embedding.length !== this.embeddingDimensions) {
            span?.setTag('embedding.dimension_mismatch', true);
            span?.setTag('embedding.expected_dimensions', this.embeddingDimensions);
            if (this.config.enableMetrics) {
              metrics.increment('vector_db.embedding.dimension_mismatch', {
                provider: this.config.provider,
                model: this.embeddingModelTag,
                expected: String(this.embeddingDimensions),
                actual: String(embedding.length),
              });
            }
          }

          return embedding;
        } catch (error) {
          if (this.config.enableMetrics) {
            metrics.increment('vector_db.embedding.error', {
              provider: this.config.provider,
              model: this.embeddingModelTag,
            });
          }

          if (this.config.enableLogging) {
            console.error('Error generating embedding:', error);
          }

          if (span) {
            span.setTag('error', true);
            span.setTag('error.message', error instanceof Error ? error.message : String(error));
          }

          // Fallback: return zero vector
          return new Array(this.embeddingDimensions).fill(0);
        }
      },
      {
        tags: ['vector-db', 'embedding'],
        context: {
          provider: this.config.provider,
          model: this.embeddingModelTag,
        },
        input: {
          textLength: text.length,
        },
      }
    );
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

  protected normalizeModelTag(model: string): string {
    if (!model) {
      return 'text-embedding-3-small';
    }

    const trimmed = model.trim();
    if (trimmed.startsWith('openai/')) {
      return trimmed.replace(/^openai\//, '');
    }

    return trimmed;
  }

  protected determineModelIdentifier(model: string): string {
    if (!model) {
      return 'openai/text-embedding-3-small';
    }

    const trimmed = model.trim();
    const isOpenRouter = Boolean(process.env.OPENROUTER_API_KEY);

    if (trimmed.startsWith('openai/')) {
      return isOpenRouter ? trimmed : trimmed.replace(/^openai\//, '');
    }

    return isOpenRouter ? `openai/${trimmed}` : trimmed;
  }

  protected resolveModelDimensions(modelTag: string): number {
    switch (modelTag) {
      case 'text-embedding-3-large':
        return 3072;
      case 'text-embedding-ada-002':
      case 'text-embedding-3-small':
      default:
        return 1536;
    }
  }

  /**
   * Fallback text search when vector search is not available
   * Can be overridden by providers for custom implementation
   */
  protected async fallbackTextSearch(_query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
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
      
      // Call provider-specific close method
      await this.closeProvider();
      
      this.isInitialized = false;
      this.connectionStatus = false;
      
      if (this.config.enableMetrics) {
        metrics.histogram('vector_db.close.duration', Date.now() - startTime);
        metrics.increment('vector_db.close.success');
      }
      
      if (this.config.enableLogging) {
        console.info(`Vector database adapter (${this.config.provider}) closed successfully`);
      }
    } catch (error) {
      if (this.config.enableMetrics) {
        metrics.increment('vector_db.close.error');
      }
      
      if (this.config.enableLogging) {
        console.error(`Error closing vector database adapter (${this.config.provider}):`, error);
      }
      
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
