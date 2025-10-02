/**
 * Vector Database Interface
 * Defines the core interface that all vector database providers must implement
 */

import { VectorChunk, SearchResult, SearchOptions } from './vector-types';

/**
 * Interface for vector database operations
 * All vector database providers must implement this interface
 */
export interface VectorDatabaseInterface {
  /**
   * Store vector chunks in the database
   * @param fileId The ID of the file these chunks belong to
   * @param chunks Array of content chunks to store with their metadata
   */
  storeChunks(fileId: number, chunks: Array<{
    content: string
    startLine?: number
    endLine?: number
    tokens: number
  }>): Promise<void>;

  /**
   * Search for similar content using vector similarity
   * @param embedding The query embedding vector to search with
   * @param options Search options including filters, limits, and thresholds
   */
  search(embedding: number[], options?: SearchOptions): Promise<SearchResult[]>;

  /**
   * Search for similar content using raw query text (generates embedding internally)
   * @param query The text query to search with
   * @param options Search options including filters, limits, and thresholds
   */
  searchWithText(query: string, options?: SearchOptions): Promise<SearchResult[]>;

  /**
   * Delete all chunks for a specific file
   * @param fileId The ID of the file to delete chunks for
   */
  deleteFileChunks(fileId: number): Promise<void>;

  /**
   * Get statistics about the vector database
   * @returns Statistics about the database including counts and sizes
   */
  getStats(): Promise<{
    totalChunks: number
    totalFiles: number
    averageChunkSize: number
  }>;

  /**
   * Invalidate cache entries for a specific table or content type
   * @param table The database table to invalidate cache for
   * @param contentType Optional content type to restrict invalidation
   */
  invalidateCache(table: string, contentType?: string): Promise<number>;

  /**
   * Generate text embedding for a query
   * @param text The text to generate an embedding for
   */
  generateEmbedding(text: string): Promise<number[]>;

  /**
   * Get connection status of the database
   * @returns True if connected, false otherwise
   */
  isConnected(): Promise<boolean>;

  /**
   * Initialize the database connection
   */
  initialize(): Promise<void>;

  /**
   * Ping the database to check connectivity
   * @param timeoutMs Timeout in milliseconds
   */
  ping(timeoutMs?: number): Promise<boolean>;

  /**
   * Close the database connection
   */
  close(): Promise<void>;
}