/**
 * RAG System Main Entry Point
 * Combines vector store, cache, and embeddings
 */

import { vectorStore, SearchResult } from './vector-store';
import { valkeyCache } from './cache';
import { embeddingService } from './embeddings';
import { logger } from '@/lib/logger';

export interface RAGDocument {
  content: string;
  metadata?: Record<string, any>;
}

export interface RAGSearchOptions {
  limit?: number;
  threshold?: number;
  useCache?: boolean;
}

export class RAGSystem {
  private initialized = false;
  
  /**
   * Initialize the RAG system
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.warn('RAG system already initialized');
      return;
    }
    
    try {
      logger.info('Initializing RAG system...');
      
      // Initialize vector store
      await vectorStore.initialize();
      
      // Connect to cache
      await valkeyCache.connect();
      
      this.initialized = true;
      logger.info('RAG system initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize RAG system', { error });
      throw error;
    }
  }
  
  /**
   * Ingest a document into the system
   */
  async ingest(doc: RAGDocument): Promise<string> {
    this.ensureInitialized();
    
    try {
      // Generate embedding
      const embedding = await embeddingService.generate(doc.content);
      
      // Store in vector database
      const id = await vectorStore.insert({
        content: doc.content,
        embedding,
        metadata: doc.metadata
      });
      
      logger.info('Document ingested', { id, contentLength: doc.content.length });
      return id;
    } catch (error) {
      logger.error('Failed to ingest document', { error });
      throw error;
    }
  }
  
  /**
   * Ingest multiple documents in batch
   */
  async ingestBatch(docs: RAGDocument[]): Promise<string[]> {
    this.ensureInitialized();
    
    try {
      logger.info('Starting batch ingestion', { count: docs.length });
      
      // Generate embeddings in batch
      const texts = docs.map(d => d.content);
      const embeddings = await embeddingService.generateBatch(texts);
      
      // Store in vector database
      const vectorDocs = docs.map((doc, i) => ({
        content: doc.content,
        embedding: embeddings[i],
        metadata: doc.metadata
      }));
      
      const ids = await vectorStore.insertBatch(vectorDocs);
      
      logger.info('Batch ingestion completed', { count: ids.length });
      return ids;
    } catch (error) {
      logger.error('Failed to ingest batch', { error });
      throw error;
    }
  }
  
  /**
   * Search for relevant documents
   */
  async search(
    query: string,
    options: RAGSearchOptions = {}
  ): Promise<SearchResult[]> {
    this.ensureInitialized();
    
    const { limit = 10, threshold = 0.7, useCache = true } = options;
    
    try {
      // Check cache first
      if (useCache) {
        const cached = await valkeyCache.get(query);
        if (cached) {
          logger.info('Cache hit for query', { query: query.substring(0, 50) });
          return cached.results;
        }
      }
      
      // Generate query embedding
      const queryEmbedding = await embeddingService.generate(query);
      
      // Search vector store
      const results = await vectorStore.search(queryEmbedding, {
        limit,
        threshold
      });
      
      // Cache results
      if (useCache && results.length > 0) {
        await valkeyCache.set(query, queryEmbedding, results);
      }
      
      logger.info('Search completed', {
        query: query.substring(0, 50),
        resultCount: results.length
      });
      
      return results;
    } catch (error) {
      logger.error('Search failed', { error, query });
      throw error;
    }
  }
  
  /**
   * Generate answer using LLM with retrieved context
   */
  async generateAnswer(
    query: string,
    searchResults: SearchResult[]
  ): Promise<string> {
    // This would integrate with your LLM service
    // For now, just return a placeholder
    const context = searchResults
      .map((result, i) => `[${i + 1}] ${result.content}`)
      .join('\n\n');
    
    logger.info('Generating answer', {
      query: query.substring(0, 50),
      contextLength: context.length
    });
    
    // TODO: Integrate with LLM service
    return `Answer based on ${searchResults.length} relevant documents`;
  }
  
  /**
   * Complete RAG query (search + generate)
   */
  async query(
    query: string,
    options: RAGSearchOptions = {}
  ): Promise<{
    answer: string;
    sources: SearchResult[];
  }> {
    const sources = await this.search(query, options);
    const answer = await this.generateAnswer(query, sources);
    
    return { answer, sources };
  }
  
  /**
   * Get system statistics
   */
  async getStats(): Promise<{
    vectorStore: Awaited<ReturnType<typeof vectorStore.getStats>>;
    cache: Awaited<ReturnType<typeof valkeyCache.getStats>>;
  }> {
    this.ensureInitialized();
    
    const [vectorStats, cacheStats] = await Promise.all([
      vectorStore.getStats(),
      valkeyCache.getStats()
    ]);
    
    return {
      vectorStore: vectorStats,
      cache: cacheStats
    };
  }
  
  /**
   * Rebuild vector index
   */
  async rebuildIndex(): Promise<void> {
    this.ensureInitialized();
    await vectorStore.rebuildIndex();
  }
  
  /**
   * Clear cache
   */
  async clearCache(): Promise<void> {
    this.ensureInitialized();
    await valkeyCache.clear();
  }
  
  /**
   * Shutdown the system
   */
  async shutdown(): Promise<void> {
    if (!this.initialized) {
      return;
    }
    
    await valkeyCache.disconnect();
    this.initialized = false;
    logger.info('RAG system shutdown');
  }
  
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('RAG system not initialized. Call initialize() first.');
    }
  }
}

// Singleton instance
export const ragSystem = new RAGSystem();

// Re-export for convenience
export { vectorStore, valkeyCache, embeddingService };
export type { SearchResult };
