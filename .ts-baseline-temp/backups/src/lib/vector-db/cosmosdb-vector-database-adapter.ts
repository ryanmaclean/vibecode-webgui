/**
 * Azure Cosmos DB Vector Database Adapter
 * Implementation of the vector database adapter for Azure Cosmos DB with vector search
 */

import { BaseVectorDatabaseAdapter } from './base-vector-database-adapter';
import { SearchOptions, SearchResult, VectorDatabaseConfig, VectorDatabaseProvider } from './vector-types';
import { metrics } from '../server-monitoring';
import { handleVectorDBError } from './vector-db-error-handler';

/**
 * Azure Cosmos DB specific configuration options
 */
export interface CosmosDbVectorDatabaseConfig extends VectorDatabaseConfig {
  provider: VectorDatabaseProvider.COSMOSDB;
  cosmosEndpoint?: string;
  cosmosKey?: string;
  cosmosDatabase?: string;
  cosmosContainer?: string;
  cosmosPartitionKey?: string;
  cosmosVectorIndexType?: 'HNSW' | 'IVF_FLAT';
  cosmosSearchMethod?: 'cosine' | 'inner_product' | 'euclidean';
  cosmosMaxRU?: number;
}

/**
 * Azure Cosmos DB Vector Database Adapter
 * Implements vector database operations using Azure Cosmos DB with vector search
 */
// Type aliases for Cosmos DB client (dynamically imported)
interface CosmosClient {
  database: (id: string) => CosmosDatabase;
}

interface CosmosDatabase {
  container: (id: string) => CosmosContainer;
  containers: {
    createIfNotExists: (config: {
      id: string;
      partitionKey: string;
      indexingPolicy: unknown;
    }) => Promise<{ container: CosmosContainer }>;
  };
  read: () => Promise<unknown>;
}

interface CosmosContainer {
  items: {
    create: (document: unknown) => Promise<unknown>;
    query: (querySpec: { query: string; parameters?: Array<{ name: string; value: unknown }> }) => {
      fetchAll: () => Promise<{ resources: unknown[] }>;
    };
  };
  item: (id: string, partitionKeyValue: unknown) => {
    delete: () => Promise<unknown>;
  };
}

export class CosmosDbVectorDatabaseAdapter extends BaseVectorDatabaseAdapter {
  private client: CosmosClient | null = null;
  private database: CosmosDatabase | null = null;
  private container: CosmosContainer | null = null;
  // Using standalone handleVectorDBError function instead of class
  protected cosmosConfig: CosmosDbVectorDatabaseConfig;

  /**
   * Constructor for Cosmos DB adapter
   * @param config Cosmos DB-specific configuration
   */
  constructor(config: CosmosDbVectorDatabaseConfig) {
    super(config);
    // Error handling is done via standalone handleVectorDBError function
    this.cosmosConfig = {
      cosmosEndpoint: process.env.COSMOS_ENDPOINT,
      cosmosKey: process.env.COSMOS_KEY,
      cosmosDatabase: process.env.COSMOS_DATABASE || 'vibecode',
      cosmosContainer: process.env.COSMOS_CONTAINER || 'vectorstore',
      cosmosPartitionKey: '/fileId',
      cosmosVectorIndexType: 'HNSW',
      cosmosSearchMethod: 'cosine',
      cosmosMaxRU: 400,
      ...config
    };
  }

  /**
   * Initialize the Cosmos DB connection
   */
  protected async initializeProvider(): Promise<void> {
    try {
      // Dynamic import of Azure Cosmos DB SDK to avoid build issues
      const { CosmosClient } = await import('@azure/cosmos');
      
      if (!this.cosmosConfig.cosmosEndpoint || !this.cosmosConfig.cosmosKey) {
        throw new Error('Cosmos DB endpoint and key are required');
      }

      // Initialize Cosmos DB client
      this.client = new CosmosClient({ 
        endpoint: this.cosmosConfig.cosmosEndpoint, 
        key: this.cosmosConfig.cosmosKey 
      });
      
      this.database = this.client.database(this.cosmosConfig.cosmosDatabase);
      this.container = this.database.container(this.cosmosConfig.cosmosContainer);
      
      // Check if container exists, if not create it with vector index
      await this.ensureContainerExists();
      
      if (this.config.enableLogging) {
        console.info(`Connected to Cosmos DB at ${this.cosmosConfig.cosmosEndpoint}`);
      }
    } catch (error) {
      if (this.config.enableLogging) {
        console.error('Failed to initialize Cosmos DB vector database adapter:', error);
      }
      throw handleVectorDBError(error as Error, 'initialization', 'cosmosdb');
    }
  }

  /**
   * Ensure the container exists with proper vector index configuration
   */
  private async ensureContainerExists(): Promise<void> {
    try {
      const { container } = await this.database.containers.createIfNotExists({
        id: this.cosmosConfig.cosmosContainer,
        partitionKey: this.cosmosConfig.cosmosPartitionKey,
        indexingPolicy: {
          includedPaths: [
            { path: '/*' }
          ],
          excludedPaths: [
            { path: '/embedding/*' }
          ],
          vectorIndexes: [
            {
              path: '/embedding',
              type: this.cosmosConfig.cosmosVectorIndexType,
              dimensions: 1536 // OpenAI embedding dimensions
            }
          ]
        }
      });
      this.container = container;
    } catch (error) {
      throw handleVectorDBError(error as Error, 'initialization', 'cosmosdb');
    }
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
    try {
      if (!this.container) {
        throw new Error('Cosmos DB container not initialized');
      }

      // Store each chunk as a separate document
      for (const chunk of chunks) {
        const document = {
          id: `${fileId}-${chunk.startLine || 0}-${chunk.endLine || 0}`,
          fileId,
          content: chunk.content,
          startLine: chunk.startLine,
          endLine: chunk.endLine,
          tokens: chunk.tokens,
          embedding: [], // Will be populated by embedding service
          metadata: {
            createdAt: new Date().toISOString(),
            chunkSize: chunk.content.length
          }
        };

        await this.container.items.create(document);
      }

      if (this.config.enableLogging) {
        console.info(`Stored ${chunks.length} chunks for file ${fileId}`);
      }
    } catch (error) {
      throw handleVectorDBError(error as Error, 'write', 'cosmosdb');
    }
  }

  /**
   * Search for similar content using vector similarity
   */
  public async search(embedding: number[], options: SearchOptions = {}): Promise<SearchResult[]> {
    try {
      if (!this.container) {
        throw new Error('Cosmos DB container not initialized');
      }

      const limit = options.limit || 10;
      const threshold = options.threshold || 0.7;

      // Perform vector similarity search using Cosmos DB's vector search
      const querySpec = {
        query: 'SELECT * FROM c WHERE c.embedding != null',
        parameters: []
      };

      const { resources } = await this.container.items.query(querySpec).fetchAll();
      
      // Calculate cosine similarity for each result
      interface CosmosDocument {
        id: string;
        content: string;
        fileId: number;
        startLine?: number;
        endLine?: number;
        embedding?: number[];
        metadata?: Record<string, unknown>;
      }

      const results = (resources as CosmosDocument[])
        .map((doc) => {
          if (!doc.embedding || doc.embedding.length === 0) return null;

          const similarity = this.calculateCosineSimilarity(embedding, doc.embedding);
          return {
            id: doc.id,
            content: doc.content,
            fileId: doc.fileId,
            startLine: doc.startLine,
            endLine: doc.endLine,
            similarity,
            metadata: doc.metadata
          };
        })
        .filter((result): result is SearchResult => result !== null && result.similarity >= threshold)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);

      if (this.config.enableLogging) {
        console.info(`Found ${results.length} similar documents`);
      }

      return results;
    } catch (error) {
      throw handleVectorDBError(error as Error, 'read', 'cosmosdb');
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Delete chunks for a specific file
   */
  public async deleteChunks(fileId: number): Promise<void> {
    try {
      if (!this.container) {
        throw new Error('Cosmos DB container not initialized');
      }

      const querySpec = {
        query: 'SELECT * FROM c WHERE c.fileId = @fileId',
        parameters: [{ name: '@fileId', value: fileId }]
      };

      const { resources } = await this.container.items.query(querySpec).fetchAll();
      
      for (const doc of resources) {
        await this.container.item(doc.id, doc.fileId).delete();
      }

      if (this.config.enableLogging) {
        console.info(`Deleted ${resources.length} chunks for file ${fileId}`);
      }
    } catch (error) {
      throw handleVectorDBError(error as Error, 'delete', 'cosmosdb');
    }
  }

  /**
   * Get statistics about the vector database
   */
  public async getStats(): Promise<VectorDbStats> {
    try {
      if (!this.container) {
        throw new Error('Cosmos DB container not initialized');
      }

      const querySpec = {
        query: 'SELECT COUNT(1) as totalChunks FROM c'
      };

      const { resources } = await this.container.items.query(querySpec).fetchAll();
      const totalChunks = resources[0]?.totalChunks || 0;

      return {
        totalChunks,
        totalFiles: 0, // Would need additional query to get unique file count
        averageChunkSize: 0, // Would need additional aggregation
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      throw handleVectorDBError(error as Error, 'read', 'cosmosdb');
    }
  }

  /**
   * Invalidate cache entries for a specific table or content type
   */
  public async invalidateCache(_table: string, _contentType?: string): Promise<number> {
    // Cosmos DB doesn't have a direct cache integration
    // Could implement a separate cache layer for Cosmos DB results
    return 0;
  }

  /**
   * Ping the Cosmos DB database to check connectivity
   */
  protected async pingProvider(): Promise<boolean> {
    if (!this.database) {
      return false;
    }
    
    try {
      // Simple operation to check connectivity
      await this.database.read();
      return true;
    } catch (error) {
      if (this.config.enableLogging) {
        console.error('Cosmos DB ping failed:', error);
      }
      return false;
    }
  }

  /**
   * Close the Cosmos DB connection
   */
  protected async closeProvider(): Promise<void> {
    if (this.client) {
      // Cosmos DB client doesn't have a specific close method
      // But we can set it to null to indicate it's closed
      this.container = null;
      this.database = null;
      this.client = null;
    }
  }

  /**
   * Fallback text search when vector search is not available
   */
  protected async fallbackTextSearch(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    if (!this.container) {
      throw handleVectorDBError(new Error('Cosmos DB adapter not initialized'), 'unknown', 'cosmosdb');
    }

    try {
      // Use SQL query with CONTAINS for text search
      const querySpec = {
        query: 'SELECT * FROM c WHERE CONTAINS(c.content, @query)',
        parameters: [{ name: '@query', value: query }]
      };
      
      const { resources } = await this.container.items.query(querySpec).fetchAll();

      interface CosmosDocument {
        id: string;
        content: string;
        fileId: number;
        startLine?: number;
        endLine?: number;
        metadata?: Record<string, unknown>;
      }

      const results = (resources as CosmosDocument[]).map((doc) => ({
        id: doc.id,
        content: doc.content,
        fileId: doc.fileId,
        startLine: doc.startLine,
        endLine: doc.endLine,
        similarity: 1.0, // Text search doesn't have similarity score
        metadata: doc.metadata
      }));

      return results.slice(0, options.limit || 10);
    } catch (error) {
      if (this.config.enableLogging) {
        console.error('Error in Cosmos DB fallback text search:', error);
      }
      return [];
    }
  }
}
