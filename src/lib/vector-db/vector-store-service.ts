/**
 * Vector Store Service
 * Main interface for vector embeddings and semantic search using adapters
 */

import OpenAI from 'openai';
import { VectorDatabaseFactory } from './vector-database-factory';
import { VectorDatabaseInterface } from './vector-database-interface';
import { SearchOptions, SearchResult } from './vector-types';

/**
 * Vector Store Service
 * Provides a high-level interface for RAG operations using the adapter pattern
 */
export class VectorStoreService {
  private openai: OpenAI | null = null;
  private vectorDb: VectorDatabaseInterface | null = null;
  private isInitialized = false;

  /**
   * Constructor for the vector store service
   */
  constructor() {
    // Initialize OpenAI client for embeddings
    if (process.env.OPENROUTER_API_KEY) {
      this.openai = new OpenAI({
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: process.env.OPENROUTER_API_KEY,
      });
    }
  }

  /**
   * Initialize the vector store service
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Get vector database adapter from factory
      this.vectorDb = await VectorDatabaseFactory.getInstance();
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize vector store service:', error);
      throw error;
    }
  }

  /**
   * Generate embeddings for text content
   */
  public async generateEmbedding(text: string): Promise<number[]> {
    await this.ensureInitialized();
    return this.vectorDb!.generateEmbedding(text);
  }

  /**
   * Store vector chunks in the database
   */
  public async storeChunks(fileId: number, chunks: Array<{
    content: string;
    startLine?: number;
    endLine?: number;
    tokens: number;
  }>): Promise<void> {
    await this.ensureInitialized();
    return this.vectorDb!.storeChunks(fileId, chunks);
  }

  /**
   * Search for similar content using vector similarity
   */
  public async search(
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    await this.ensureInitialized();
    return this.vectorDb!.searchWithText(query, options);
  }

  /**
   * Get relevant context for AI prompts
   */
  public async getContext(
    query: string,
    workspaceId?: number,
    maxTokens: number = 4000,
    threshold?: number,
    useCache: boolean = true
  ): Promise<string> {
    try {
      const results = await this.search(query, { 
        workspaceId, 
        limit: 20, 
        threshold,
        useCache 
      });
      
      if (results.length === 0) {
        return '';
      }

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
   * Delete all chunks for a file
   */
  public async deleteFileChunks(fileId: number): Promise<void> {
    await this.ensureInitialized();
    return this.vectorDb!.deleteFileChunks(fileId);
  }

  /**
   * Get statistics about the vector store
   */
  public async getStats(): Promise<{
    totalChunks: number;
    totalFiles: number;
    averageChunkSize: number;
  }> {
    await this.ensureInitialized();
    return this.vectorDb!.getStats();
  }

  /**
   * Check that the service is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  /**
   * Close the vector store service
   */
  public async close(): Promise<void> {
    if (this.vectorDb) {
      await this.vectorDb.close();
      this.vectorDb = null;
      this.isInitialized = false;
    }
  }
}

// Export singleton instance
export const vectorStore = new VectorStoreService();
export default vectorStore;