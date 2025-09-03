/**
 * Azure Embedding Service Interface
 * 
 * This interface defines the contract for Azure OpenAI embedding services
 * and is used for type safety when implementing monitoring.
 */

/**
 * Options for generating embeddings
 */
export interface EmbeddingOptions {
  dimensions?: number;
  user?: string;
}

/**
 * Options for vector search
 */
export interface VectorSearchOptions {
  threshold?: number;
  limit?: number;
  filter?: Record<string, any>;
}

/**
 * Document with similarity score
 */
export interface SimilarDocument {
  id: string;
  document_id: string;
  content: string;
  metadata?: Record<string, any>;
  similarity: number;
}

/**
 * RAG query result
 */
export interface RagQueryResult {
  provider: string;
  query: string;
  documents: SimilarDocument[];
  timestamp: string;
}

/**
 * Document metadata
 */
export interface DocumentMetadata {
  [key: string]: any;
}

/**
 * Embedding statistics
 */
export interface EmbeddingStats {
  provider: string;
  stats: any;
}

/**
 * Azure Embedding Service Interface
 */
export interface IAzureEmbeddingService {
  /**
   * Generate an embedding for the given text
   * @param text The text to generate an embedding for
   * @param options Optional parameters for the embedding generation
   * @returns A vector of numbers representing the embedding
   */
  generateEmbedding(text: string, options?: EmbeddingOptions): Promise<number[]>;
  
  /**
   * Store a document with its embedding in the database
   * @param documentId The unique identifier for the document
   * @param content The document content
   * @param metadata Optional metadata for the document
   */
  storeDocument(documentId: string, content: string, metadata?: DocumentMetadata): Promise<void>;
  
  /**
   * Find documents similar to the provided query text
   * @param queryText The query text to find similar documents for
   * @param options Optional search parameters
   * @returns Array of similar documents with similarity scores
   */
  findSimilarDocuments(queryText: string, options?: VectorSearchOptions): Promise<SimilarDocument[]>;
  
  /**
   * Perform a RAG (Retrieval Augmented Generation) query
   * @param queryText The query text
   * @param options Optional search parameters
   * @returns RAG query result with matched documents
   */
  ragQuery(queryText: string, options?: VectorSearchOptions): Promise<RagQueryResult>;
  
  /**
   * Get embedding service statistics
   * @returns Statistics about the embedding service
   */
  getStats(): Promise<EmbeddingStats>;
  
  /**
   * Get deployment name used by this service
   * @returns The Azure OpenAI deployment name
   */
  getDeploymentName(): string;
  
  /**
   * Clean up old embeddings
   * @param olderThan Optional date cutoff for deletion
   * @returns Number of embeddings deleted
   */
  cleanupOldEmbeddings(olderThan?: Date): Promise<{ deletedCount: number }>;
}