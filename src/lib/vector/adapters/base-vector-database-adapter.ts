/**
 * Base Vector Database Adapter
 * Provides common functionality for all vector database adapters
 */

import { IVectorDatabaseAdapter } from '../interfaces/vector-database-adapter';
import { IVectorEmbeddingProvider } from '../interfaces/vector-embedding-provider';
import { IVectorCacheAdapter } from '../interfaces/vector-cache-adapter';
import { 
  SearchResult, 
  VectorChunk, 
  VectorDatabaseConfig, 
  VectorSearchOptions, 
  VectorStoreStats 
} from '../interfaces/vector-types';

export abstract class BaseVectorDatabaseAdapter implements IVectorDatabaseAdapter {
  protected config: VectorDatabaseConfig;
  protected embeddingProvider: IVectorEmbeddingProvider;
  protected cacheAdapter?: IVectorCacheAdapter;
  protected isConnectionActive: boolean = false;
  protected connectionRetries: number = 0;
  protected maxRetries: number;
  protected initialDelay: number;
  protected maxDelay: number;

  constructor(
    config: VectorDatabaseConfig,
    embeddingProvider: IVectorEmbeddingProvider,
    cacheAdapter?: IVectorCacheAdapter
  ) {
    this.config = config;
    this.embeddingProvider = embeddingProvider;
    this.cacheAdapter = cacheAdapter;
    
    // Initialize retry options
    this.maxRetries = config.retryOptions?.maxRetries || 3;
    this.initialDelay = config.retryOptions?.initialDelay || 500;
    this.maxDelay = config.retryOptions?.maxDelay || 10000;
  }

  /**
   * Connect to the vector database
   * This method should be implemented by subclasses
   */
  abstract connect(): Promise<boolean>;

  /**
   * Disconnect from the vector database
   * This method should be implemented by subclasses
   */
  abstract disconnect(): Promise<void>;

  /**
   * Check if the adapter is currently connected
   */
  isConnected(): boolean {
    return this.isConnectionActive;
  }

  /**
   * Generate embedding for text using the configured provider
   * @param text Text to generate embedding for
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      return await this.embeddingProvider.generateEmbedding(text);
    } catch (error) {
      console.error('Error generating embedding:', error);
      // Return zero vector of appropriate dimension as fallback
      const dimension = this.embeddingProvider.getDimension();
      return new Array(dimension).fill(0);
    }
  }

  /**
   * Store vector chunks in the database
   * This method should be implemented by subclasses
   */
  abstract storeVectors(fileId: number, chunks: Array<{
    content: string;
    startLine?: number;
    endLine?: number;
    tokens: number;
  }>): Promise<void>;

  /**
   * Find similar vectors based on embedding
   * This method should be implemented by subclasses
   */
  abstract findSimilar(embedding: number[], options: VectorSearchOptions): Promise<SearchResult[]>;

  /**
   * Get relevant context for AI prompts
   * Default implementation that can be overridden by subclasses for optimization
   */
  async getContext(
    query: string,
    workspaceId?: number,
    maxTokens: number = 4000,
    threshold?: number,
    useCache: boolean = true
  ): Promise<string> {
    try {
      // Generate embedding for query
      const embedding = await this.generateEmbedding(query);
      
      // Search for relevant chunks
      const results = await this.findSimilar(embedding, { 
        workspaceId, 
        limit: 20, 
        threshold,
        useCache 
      });
      
      if (results.length === 0) {
        return '';
      }

      // Build context string with file information
      let context = '';
      let tokenCount = 0;

      for (const result of results) {
        const chunkText = `\n--- ${result.chunk.metadata.fileName} (lines ${result.chunk.metadata.startLine}-${result.chunk.metadata.endLine}) ---\n${result.chunk.content}\n`;
        
        if (tokenCount + result.chunk.metadata.tokens > maxTokens) {
          break;
        }

        context += chunkText;
        tokenCount += result.chunk.metadata.tokens;
      }

      return context;
    } catch (error) {
      console.error('Error getting context:', error);
      return '';
    }
  }

  /**
   * Delete all vectors associated with a file
   * This method should be implemented by subclasses
   */
  abstract deleteVectors(fileId: number): Promise<void>;

  /**
   * Update a vector embedding
   * This method should be implemented by subclasses
   */
  abstract updateVector(id: string | number, embedding: number[]): Promise<boolean>;

  /**
   * Get statistics about the vector store
   * This method should be implemented by subclasses
   */
  abstract getStats(): Promise<VectorStoreStats>;

  /**
   * Helper method to implement exponential backoff for retries
   * @param operation Function to retry
   * @returns Result of the operation
   */
  protected async withRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;
    let delay = this.initialDelay;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        console.warn(`Operation failed (attempt ${attempt + 1}/${this.maxRetries + 1}):`, error);
        
        if (attempt === this.maxRetries) {
          break;
        }
        
        // Exponential backoff with jitter
        await new Promise(resolve => setTimeout(resolve, delay + Math.random() * 200));
        delay = Math.min(delay * 2, this.maxDelay);
      }
    }

    throw lastError || new Error('Operation failed after retries');
  }
}