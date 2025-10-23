/**
 * Vector Store for RAG (Retrieval-Augmented Generation)
 * Uses the adapter pattern to support multiple vector databases
 */

import { IVectorDatabaseAdapter } from './interfaces/vector-database-adapter';
import { VectorAdapterFactory } from './adapters/vector-adapter-factory';
import { VectorDatabaseConfig, SearchResult, VectorStoreStats } from './interfaces/vector-types';
// import { logger } from '@/lib/logger';
export class VectorStore {
  private adapter: IVectorDatabaseAdapter;
  private initialized: boolean = false;

  constructor(config?: VectorDatabaseConfig) {
    // Use default PostgreSQL configuration if none provided
    const defaultConfig: VectorDatabaseConfig = {
      provider: 'pgvector',
      embedding: {
        provider: 'openai',
        dimension: 1536
      },
      cache: {
        enabled: true,
        provider: 'redis',
        ttl: {
          default: 3600,
          min: 60,
          max: 86400
        }
      }
    };

    // Create adapter using factory
    this.adapter = VectorAdapterFactory.createVectorDatabase(config || defaultConfig);
  }

  /**
   * Initialize the vector store
   */
  async initialize(): Promise<boolean> {
    try {
      if (!this.initialized) {
        const connected = await this.adapter.connect();
        this.initialized = connected;
        return connected;
      }
      return true;
    } catch (error) {
      console.error('Failed to initialize vector store:', error);
      return false;
    }
  }

  /**
   * Generate embeddings for text content
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    return this.adapter.generateEmbedding(text);
  }

  /**
   * Store vector chunks in the database
   */
  async storeChunks(fileId: number, chunks: Array<{
    content: string;
    startLine?: number;
    endLine?: number;
    tokens: number;
  }>): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
    return this.adapter.storeVectors(fileId, chunks);
  }

  /**
   * Search for similar content
   */
  async search(
    query: string, 
    options: {
      workspaceId?: number;
      fileIds?: number[];
      limit?: number;
      threshold?: number;
      useCache?: boolean;
    } = {}
  ): Promise<SearchResult[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Generate embedding for the query
    const embedding = await this.generateEmbedding(query);
    
    // Search using the adapter
    return this.adapter.findSimilar(embedding, options);
  }

  /**
   * Get relevant context for AI prompts
   */
  async getContext(
    query: string,
    workspaceId?: number,
    maxTokens: number = 4000,
    threshold?: number,
    useCache: boolean = true
  ): Promise<string> {
    if (!this.initialized) {
      await this.initialize();
    }
    return this.adapter.getContext(query, workspaceId, maxTokens, threshold, useCache);
  }

  /**
   * Delete all chunks for a file
   */
  async deleteFileChunks(fileId: number): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
    return this.adapter.deleteVectors(fileId);
  }

  /**
   * Get statistics about the vector store
   */
  async getStats(): Promise<VectorStoreStats> {
    if (!this.initialized) {
      await this.initialize();
    }
    return this.adapter.getStats();
  }

  /**
   * Disconnect from the vector store
   */
  async disconnect(): Promise<void> {
    if (this.initialized) {
      await this.adapter.disconnect();
      this.initialized = false;
    }
  }
}

// Export singleton instance
export const vectorStore = new VectorStore();
export default vectorStore;