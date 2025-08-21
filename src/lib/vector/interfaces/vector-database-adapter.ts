/**
 * Vector Database Adapter Interface
 * Defines the contract that all vector database adapters must implement
 */

import { SearchResult, VectorSearchOptions, VectorStoreStats } from './vector-types';

export interface IVectorDatabaseAdapter {
  /**
   * Generate an embedding vector for the given text
   * This uses the adapter's embedding provider
   * @param text The text to generate an embedding for
   * @returns Promise resolving to a numeric array representing the embedding
   */
  generateEmbedding(text: string): Promise<number[]>;
  
  /**
   * Connect to the vector database
   * @returns Promise resolving to true if connection is successful
   */
  connect(): Promise<boolean>;
  
  /**
   * Disconnect from the vector database
   */
  disconnect(): Promise<void>;
  
  /**
   * Check if the adapter is currently connected
   */
  isConnected(): boolean;
  
  /**
   * Store vector chunks in the database
   * @param fileId The ID of the file the chunks belong to
   * @param chunks Array of vector chunks to store
   */
  storeVectors(fileId: number, chunks: Array<{
    content: string;
    startLine?: number;
    endLine?: number;
    tokens: number;
  }>): Promise<void>;
  
  /**
   * Find similar vectors based on embedding
   * @param embedding The query embedding vector
   * @param options Search options including filters, limits, etc.
   * @returns Promise resolving to array of search results
   */
  findSimilar(embedding: number[], options: VectorSearchOptions): Promise<SearchResult[]>;
  
  /**
   * Get relevant context for AI prompts based on query
   * @param query The text query to find context for
   * @param workspaceId Optional workspace ID to limit search
   * @param maxTokens Maximum number of tokens to return
   * @param threshold Minimum similarity threshold
   * @param useCache Whether to use cache for the search
   * @returns Promise resolving to a string of context
   */
  getContext(
    query: string,
    workspaceId?: number,
    maxTokens?: number,
    threshold?: number,
    useCache?: boolean
  ): Promise<string>;
  
  /**
   * Delete all vectors associated with a file
   * @param fileId The ID of the file
   */
  deleteVectors(fileId: number): Promise<void>;
  
  /**
   * Update a vector embedding
   * @param id The vector ID
   * @param embedding The new embedding vector
   */
  updateVector(id: string | number, embedding: number[]): Promise<boolean>;
  
  /**
   * Get statistics about the vector store
   * @returns Promise resolving to vector store statistics
   */
  getStats(): Promise<VectorStoreStats>;
}