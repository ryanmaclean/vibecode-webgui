/**
 * Azure Cognitive Search Vector Database Adapter
 * Implements vector search capabilities using Azure Cognitive Search
 */

import { 
  SearchClient, 
  SearchIndexClient, 
  AzureKeyCredential,
  SearchOptions as AzureSearchOptions,
  SearchDocument
} from "../../types/azure-search-documents";
import { BaseVectorDatabaseAdapter } from './base-vector-database-adapter';
import { VectorChunk, SearchResult, SearchOptions, VectorDatabaseConfig } from './vector-types';
import { metrics } from '../server-monitoring';
import { VectorDbErrorHandler, VectorDbErrorType } from './vector-db-error-handler';

/**
 * Azure Cognitive Search Vector Database Configuration
 */
export interface CognitiveSearchVectorDatabaseConfig extends VectorDatabaseConfig {
  endpoint: string;
  apiKey: string;
  indexName: string;
}

/**
 * Azure Cognitive Search Vector Database Adapter
 * Implements vector search capabilities using Azure Cognitive Search
 */
export class CognitiveSearchVectorDatabaseAdapter extends BaseVectorDatabaseAdapter {
  private searchClient: SearchClient | null = null;
  private searchIndexClient: SearchIndexClient | null = null;
  private searchConfig: CognitiveSearchVectorDatabaseConfig;
  private errorHandler: VectorDbErrorHandler;

  /**
   * Constructor for the Azure Cognitive Search adapter
   * @param config Configuration for Azure Cognitive Search
   */
  constructor(config: CognitiveSearchVectorDatabaseConfig) {
    super(config);
    this.searchConfig = config;
    this.errorHandler = new VectorDbErrorHandler('azure-cognitive-search', config.enableLogging, config.enableMetrics);
  }

  /**
   * Initialize the Azure Cognitive Search client
   */
  protected async initializeProvider(): Promise<void> {
    try {
      if (!this.searchConfig.endpoint) {
        throw new Error('Azure Cognitive Search endpoint is required');
      }

      if (!this.searchConfig.apiKey) {
        throw new Error('Azure Cognitive Search API key is required');
      }

      if (!this.searchConfig.indexName) {
        throw new Error('Azure Cognitive Search index name is required');
      }

      // Create credential
      const credential = new AzureKeyCredential(this.searchConfig.apiKey);

      // Create search index client
      this.searchIndexClient = new SearchIndexClient(
        this.searchConfig.endpoint,
        credential
      );

      // Create search client for the specific index
      this.searchClient = new SearchClient(
        this.searchConfig.endpoint,
        this.searchConfig.indexName,
        credential
      );

      // Verify connection by checking if index exists
      const indexExists = await this.checkIndexExists(this.searchConfig.indexName);
      if (!indexExists) {
        throw new Error(`Index ${this.searchConfig.indexName} does not exist`);
      }

      if (this.config.enableLogging) {
        console.info(`Connected to Azure Cognitive Search at ${this.searchConfig.endpoint}`);
      }
    } catch (error) {
      // Determine error type based on error characteristics
      let errorType = VectorDbErrorType.INITIALIZATION;
      let retryable = false;
      
      if (this.errorHandler.isAuthError(error)) {
        errorType = VectorDbErrorType.AUTHENTICATION;
        retryable = false;
      } else if (this.errorHandler.isNetworkError(error)) {
        errorType = VectorDbErrorType.CONNECTION;
        retryable = true;
      } else if (this.errorHandler.isTimeoutError(error)) {
        errorType = VectorDbErrorType.TIMEOUT;
        retryable = true;
      }
      
      // Include additional context in error data
      const errorData = {
        endpoint: this.searchConfig.endpoint,
        indexName: this.searchConfig.indexName
      };
      
      // Handle the error with consistent formatting and logging
      throw this.errorHandler.handleError(
        error,
        'initialize',
        errorType,
        retryable,
        errorData
      );
    }
  }

  /**
   * Check if an index exists in Azure Cognitive Search
   */
  private async checkIndexExists(indexName: string): Promise<boolean> {
    if (!this.searchIndexClient) {
      throw new Error('Search index client not initialized');
    }

    try {
      const indexes = await this.searchIndexClient.listIndexes();
      for await (const index of indexes) {
        if (index.name === indexName) {
          return true;
        }
      }
      return false;
    } catch (error) {
      if (this.config.enableLogging) {
        console.error('Error checking if index exists:', error);
      }
      return false;
    }
  }

  /**
   * Check if Azure Cognitive Search is responsive
   */
  protected async pingProvider(): Promise<boolean> {
    if (!this.searchClient) {
      return false;
    }

    try {
      // Simple way to check if the service is responsive - just get doc count
      await this.searchClient.getDocumentCount();
      return true;
    } catch (error) {
      if (this.config.enableLogging) {
        console.error('Error pinging Azure Cognitive Search:', error);
      }
      return false;
    }
  }

  /**
   * Close the Azure Cognitive Search connection
   */
  protected async closeProvider(): Promise<void> {
    // Nothing to close for HTTP-based clients
    this.searchClient = null;
    this.searchIndexClient = null;
  }

  /**
   * Store content chunks in Azure Cognitive Search
   */
  public async storeChunks(fileId: number, chunks: Array<{
    content: string;
    startLine?: number;
    endLine?: number;
    tokens: number;
  }>): Promise<void> {
    if (!this.searchClient) {
      throw new Error('Search client not initialized');
    }

    try {
      const startTime = Date.now();
      const documents: SearchDocument[] = [];

      // Process chunks and generate embeddings
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = await this.generateEmbedding(chunk.content);
        
        // Create document with Azure Cognitive Search expected format
        documents.push({
          id: `${fileId}_${i}`,
          content: chunk.content,
          embedding: embedding,
          fileId: fileId,
          startLine: chunk.startLine || 0,
          endLine: chunk.endLine || 0,
          tokens: chunk.tokens
        });
      }

      // Upload documents in batches of 100 (Azure Cognitive Search limit)
      const batchSize = 100;
      for (let i = 0; i < documents.length; i += batchSize) {
        const batch = documents.slice(i, i + batchSize);
        await this.searchClient.uploadDocuments(batch);
      }

      if (this.config.enableMetrics) {
        metrics.histogram('vector_db.store_chunks.duration', Date.now() - startTime);
        metrics.increment('vector_db.store_chunks.success');
      }

      if (this.config.enableLogging) {
        console.info(`Stored ${documents.length} chunks for file ${fileId} in Azure Cognitive Search`);
      }
    } catch (error) {
      if (this.config.enableMetrics) {
        metrics.increment('vector_db.store_chunks.error');
      }
      
      if (this.config.enableLogging) {
        console.error(`Error storing chunks for file ${fileId}:`, error);
      }
      
      throw error;
    }
  }

  /**
   * Search for similar content using vector search
   */
  public async search(embedding: number[], options: SearchOptions = {}): Promise<SearchResult[]> {
    if (!this.searchClient) {
      throw this.errorHandler.handleError(
        new Error('Azure Cognitive Search adapter not initialized'),
        'search',
        VectorDbErrorType.INITIALIZATION,
        false
      );
    }

    try {
      const startTime = Date.now();
      const { fileIds, workspaceId, limit = 5, threshold = 0.7 } = options;

      // Build search options for Azure Search
      const searchOptions: AzureSearchOptions = {
        vectorQueries: [{
          vector: embedding,
          fields: ['embedding'],
          kind: 'vector',
          k: limit
        }],
        select: ['id', 'content', 'fileId', 'fileName', 'language', 'startLine', 'endLine', 'tokens'],
        top: limit,
        includeTotalCount: true
      };

      // Add filter if fileIds or workspaceId is provided
      const filters: string[] = [];
      
      if (fileIds && fileIds.length > 0) {
        if (fileIds.length === 1) {
          filters.push(`fileId eq ${fileIds[0]}`);
        } else {
          const fileIdsFilter = fileIds.map(id => `fileId eq ${id}`).join(' or ');
          filters.push(`(${fileIdsFilter})`);
        }
      }

      if (workspaceId !== undefined) {
        filters.push(`workspaceId eq ${workspaceId}`);
      }

      if (filters.length > 0) {
        searchOptions.filter = filters.join(' and ');
      }

      // Execute search
      const searchResponse = await this.searchClient.search(null, searchOptions);

      // Process results
      const results: SearchResult[] = [];
      
      for await (const result of searchResponse.results) {
        const similarity = result.score || 0;
        
        // Skip results below threshold
        if (similarity < threshold) {
          continue;
        }
        
        const document = result.document as SearchDocument;
        
        results.push({
          chunk: {
            id: document.id as string,
            content: document.content as string,
            embedding: [], // Don't include full embedding in results for performance
            metadata: {
              fileId: document.fileId as number,
              fileName: document.fileName as string || '',
              startLine: document.startLine as number | undefined,
              endLine: document.endLine as number | undefined,
              language: document.language as string | undefined,
              tokens: document.tokens as number
            }
          },
          similarity
        });
      }

      if (this.config.enableMetrics) {
        metrics.histogram('azure_cognitive_search.search.duration', Date.now() - startTime);
        metrics.increment('azure_cognitive_search.search.success');
      }

      return results;
    } catch (error) {
      // Determine if this is a network/timeout error (retryable) or other error
      const isRetryable = this.errorHandler.isNetworkError(error) || 
                          this.errorHandler.isTimeoutError(error);
      
      // Include search context in error data
      const errorData = {
        vectorDimensions: embedding.length,
        options: {
          fileIds: options.fileIds,
          workspaceId: options.workspaceId,
          limit: options.limit,
          threshold: options.threshold
        }
      };
      
      // For vector search errors, try fallback to text search if query text is available
      if (options.queryText) {
        try {
          return this.fallbackTextSearch(options.queryText, options);
        } catch (fallbackError) {
          // If fallback also fails, throw the original error with enhanced context
          throw this.errorHandler.handleError(
            error,
            'search',
            VectorDbErrorType.SEARCH,
            isRetryable,
            {
              ...errorData,
              fallbackError: fallbackError instanceof Error ? fallbackError.message : fallbackError
            }
          );
        }
      }
      
      // No fallback available, throw enhanced error
      throw this.errorHandler.handleError(
        error,
        'search',
        VectorDbErrorType.SEARCH,
        isRetryable,
        errorData
      );
    }
  }

  /**
   * Delete chunks associated with a file
   */
  public async deleteFileChunks(fileId: number): Promise<void> {
    if (!this.searchClient) {
      throw new Error('Search client not initialized');
    }

    try {
      const startTime = Date.now();
      
      // Search for all documents with matching fileId
      const searchQuery: AzureSearchOptions = {
        filter: `fileId eq ${fileId}`,
        select: ["id"]
      };
      
      const searchResults = await this.searchClient.search(null, searchQuery);
      
      // Collect document IDs
      const docIds: string[] = [];
      for await (const result of searchResults.results) {
        const document = result.document as SearchDocument;
        docIds.push(document.id as string);
      }
      
      // Delete documents in batches (if any found)
      if (docIds.length > 0) {
        const batchSize = 100;
        for (let i = 0; i < docIds.length; i += batchSize) {
          const batch = docIds.slice(i, i + batchSize);
          const docsToDelete = batch.map(id => ({ id }));
          await this.searchClient.deleteDocuments(docsToDelete);
        }
      }
      
      if (this.config.enableMetrics) {
        metrics.histogram('vector_db.delete_file_chunks.duration', Date.now() - startTime);
        metrics.increment('vector_db.delete_file_chunks.success');
      }
      
      if (this.config.enableLogging) {
        console.info(`Deleted ${docIds.length} chunks for file ${fileId}`);
      }
    } catch (error) {
      if (this.config.enableMetrics) {
        metrics.increment('vector_db.delete_file_chunks.error');
      }
      
      if (this.config.enableLogging) {
        console.error(`Error deleting chunks for file ${fileId}:`, error);
      }
      
      throw error;
    }
  }

  /**
   * Get statistics about the vector database
   */
  public async getStats(): Promise<{
    totalChunks: number;
    totalFiles: number;
    averageChunkSize: number;
  }> {
    if (!this.searchClient) {
      throw new Error('Search client not initialized');
    }

    try {
      const startTime = Date.now();
      
      // Get document count (total chunks)
      const totalChunks = await this.searchClient.getDocumentCount();
      
      // Get unique file IDs by faceting
      const facetResult = await this.searchClient.search(null, {
        facets: ["fileId"],
        top: 0
      });
      
      let totalFiles = 0;
      
      // Count unique fileId values from facets
      if (facetResult.facets?.fileId) {
        totalFiles = Object.keys(facetResult.facets.fileId).length;
      }
      
      // Azure doesn't provide easy way to get average size, so we estimate
      const averageChunkSize = 500; // Rough estimate
      
      if (this.config.enableMetrics) {
        metrics.histogram('vector_db.get_stats.duration', Date.now() - startTime);
        metrics.increment('vector_db.get_stats.success');
      }
      
      return {
        totalChunks,
        totalFiles,
        averageChunkSize
      };
    } catch (error) {
      if (this.config.enableMetrics) {
        metrics.increment('vector_db.get_stats.error');
      }
      
      if (this.config.enableLogging) {
        console.error('Error getting Azure Cognitive Search stats:', error);
      }
      
      return {
        totalChunks: 0,
        totalFiles: 0,
        averageChunkSize: 0
      };
    }
  }

  /**
   * Invalidate cache for the specified table
   * Azure Cognitive Search doesn't have built-in cache invalidation,
   * so we implement a no-op method here
   */
  public async invalidateCache(table: string, contentType?: string): Promise<number> {
    // Azure Cognitive Search doesn't have built-in cache invalidation
    if (this.config.enableLogging) {
      console.info(`Cache invalidation request received for table: ${table}, contentType: ${contentType || 'all'}`);
      console.info('Cache invalidation not applicable for Azure Cognitive Search');
    }
    
    return 0;
  }

  /**
   * Fallback text search using standard text search capabilities
   */
  protected async fallbackTextSearch(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    if (!this.searchClient) {
      throw new Error('Search client not initialized');
    }

    try {
      const startTime = Date.now();
      
      // Set default options
      const limit = options.limit || 10;
      
      // Build filter if fileIds specified
      let filter: string | undefined;
      if (options.fileIds?.length) {
        if (options.fileIds.length === 1) {
          filter = `fileId eq ${options.fileIds[0]}`;
        } else {
          const fileIdsFilter = options.fileIds.map(id => `fileId eq ${id}`).join(' or ');
          filter = `(${fileIdsFilter})`;
        }
      }
      
      // Execute standard text search
      const searchResults = await this.searchClient.search(query, {
        filter,
        top: limit,
        select: ["id", "content", "fileId", "startLine", "endLine", "tokens"]
      });
      
      // Process results
      const results: SearchResult[] = [];
      
      for await (const result of searchResults.results) {
        // Extract score (Azure returns a score between 0-1)
        const similarity = result.score || 0;
        const document = result.document as SearchDocument;
        
        // Create the chunk object
        const chunk: VectorChunk = {
          id: document.id as string,
          content: document.content as string,
          embedding: [], // We don't get the embedding back
          metadata: {
            fileId: document.fileId as number,
            fileName: '',
            startLine: document.startLine as number | undefined,
            endLine: document.endLine as number | undefined,
            language: document.language as string | undefined,
            tokens: document.tokens as number
          }
        };
        
        results.push({
          chunk,
          similarity
        });
      }
      
      if (this.config.enableMetrics) {
        metrics.histogram('vector_db.fallback_search.duration', Date.now() - startTime);
        metrics.increment('vector_db.fallback_search.success');
      }
      
      return results;
    } catch (error) {
      if (this.config.enableMetrics) {
        metrics.increment('vector_db.fallback_search.error');
      }
      
      if (this.config.enableLogging) {
        console.error('Error in fallback text search:', error);
      }
      
      return [];
    }
  }
}