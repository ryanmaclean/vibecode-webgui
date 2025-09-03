/**
 * Azure OpenAI Embedding Service
 * Provides functionality for generating and storing text embeddings using Azure OpenAI
 * with support for connection pooling and managed identity
 */

import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import { DefaultAzureCredential } from '@azure/identity';
import { withVectorConnection } from '../db/vector-connection-pool';
import { azureEmbeddingMetrics } from '../monitoring/azure-embedding-metrics';

// Interface for embedding generation options
interface EmbeddingOptions {
  dimensions?: number;
  user?: string;
}

// Interface for vector search options
interface VectorSearchOptions {
  threshold?: number;
  limit?: number;
  filter?: Record<string, any>;
}

// Interface for document metadata
interface DocumentMetadata {
  [key: string]: any;
}

// Interface for similar document result
interface SimilarDocument {
  id: number;
  document_id: string;
  content: string;
  metadata?: DocumentMetadata;
  similarity: number;
}

// Interface for RAG query result
interface RagQueryResult {
  provider: string;
  query: string;
  documents: SimilarDocument[];
  timestamp: string;
}

// Interface for embedding statistics
interface EmbeddingStats {
  provider: string;
  stats: Array<{
    hour_bucket: string;
    total_embeddings: number;
    avg_content_length: number;
    avg_generation_time_ms: number;
    total_searches: number;
  }>;
}

/**
 * Azure OpenAI Embedding Service class
 * Handles generating embeddings using Azure OpenAI and storing them in a database
 */
export class AzureEmbeddingService {
  private apiKey: string;
  private endpoint: string;
  private deploymentName: string;
  private apiVersion: string;
  private prisma: PrismaClient | null;
  private vectorService: any; // Will hold database vector operations
  private useManagedIdentity: boolean;
  private useConnectionPool: boolean;

  /**
   * Constructor for AzureEmbeddingService
   * 
   * @param apiKey - Azure OpenAI API key (can be empty if using managed identity)
   * @param endpoint - Azure OpenAI endpoint URL
   * @param deploymentName - Azure OpenAI deployment name
   * @param apiVersion - Azure OpenAI API version
   * @param prisma - PrismaClient instance for database operations (can be null if using connection pool)
   * @param useManagedIdentity - Whether to use Azure managed identity for authentication
   * @param useConnectionPool - Whether to use connection pooling for database operations
   */
  constructor(
    apiKey: string,
    endpoint: string,
    deploymentName: string,
    apiVersion: string = '2023-05-15',
    prisma: PrismaClient | null = null,
    useManagedIdentity: boolean = false,
    useConnectionPool: boolean = false
  ) {
    this.apiKey = apiKey;
    this.endpoint = endpoint;
    this.deploymentName = deploymentName;
    this.apiVersion = apiVersion;
    this.prisma = prisma;
    this.useManagedIdentity = useManagedIdentity;
    this.useConnectionPool = useConnectionPool;
    
    // Initialize vector service for database operations
    this.vectorService = this.createVectorService();
  }
  
  /**
   * Create vector service for database operations
   * @returns The appropriate vector service based on configuration
   */
  private createVectorService() {
    // Check if we should use connection pooling
    if (this.useConnectionPool) {
      // Create services that use connection pooling
      return this.createPooledVectorService();
    } else {
      // Use direct Prisma client
      return this.createDirectVectorService();
    }
  }

  /**
   * Create vector service using connection pooling
   */
  private createPooledVectorService() {
    return {
      upsertEmbedding: async (params: {
        documentId: string;
        content: string;
        embedding: number[];
        metadata?: DocumentMetadata;
      }) => {
        const { documentId, content, embedding, metadata } = params;
        const startTime = Date.now();
        
        // Use the connection pool to execute the query
        return withVectorConnection(async (client) => {
          // Use Prisma's executeRaw to handle the pgvector type
          return client.$executeRawUnsafe(
            `INSERT INTO document_embeddings (
              document_id, 
              content, 
              embedding, 
              metadata,
              embedding_generation_time_ms
            )
            VALUES ($1, $2, $3::vector, $4, $5)
            ON CONFLICT (document_id) 
            DO UPDATE SET 
              content = EXCLUDED.content,
              embedding = EXCLUDED.embedding,
              metadata = EXCLUDED.metadata,
              embedding_generation_time_ms = $5,
              updated_at = NOW()`,
            documentId,
            content,
            JSON.stringify(embedding),
            JSON.stringify(metadata || {}),
            Date.now() - startTime
          );
        });
      },
      
      findSimilarDocuments: async (params: {
        embedding: number[];
        threshold?: number;
        limit?: number;
        filter?: Record<string, any>;
      }) => {
        const { embedding, threshold = 0.7, limit = 5, filter } = params;
        
        // Use raw SQL query for pgvector compatibility and filtering
        let query = `
          SELECT 
            id, 
            document_id, 
            content,
            metadata,
            1 - (embedding <=> $1::vector) as similarity
          FROM 
            document_embeddings
          WHERE 
            1 - (embedding <=> $1::vector) > $2
        `;
        
        const queryParams: any[] = [JSON.stringify(embedding), threshold];
        let paramIndex = 3;
        
        // Add filter conditions if provided
        if (filter && Object.keys(filter).length > 0) {
          for (const [key, value] of Object.entries(filter)) {
            query += ` AND metadata->>'${key}' = $${paramIndex}`;
            queryParams.push(String(value));
            paramIndex++;
          }
        }
        
        // Add order by and limit
        query += ` ORDER BY similarity DESC LIMIT $${paramIndex}`;
        queryParams.push(limit);
        
        // Execute the query using connection pool
        return withVectorConnection(async (client) => {
          return client.$queryRawUnsafe(query, ...queryParams);
        });
      },
      
      getEmbeddingStats: async () => {
        // Return embedding statistics from the database using connection pool
        return withVectorConnection(async (client) => {
          return client.$queryRawUnsafe(`
            SELECT 
              DATE_TRUNC('hour', created_at) AS hour_bucket,
              COUNT(*) AS total_embeddings,
              AVG(LENGTH(content)) AS avg_content_length,
              AVG(embedding_generation_time_ms) AS avg_generation_time_ms,
              SUM(search_count) AS total_searches
            FROM 
              document_embeddings
            GROUP BY 
              hour_bucket
            ORDER BY 
              hour_bucket DESC
            LIMIT 24
          `);
        });
      },
      
      cleanupOldEmbeddings: async (params: { olderThan?: Date }) => {
        const { olderThan = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } = params;
        
        // Delete embeddings older than the specified date using connection pool
        return withVectorConnection(async (client) => {
          const query = `
            DELETE FROM document_embeddings 
            WHERE created_at < $1
            RETURNING COUNT(*) as deleted_count
          `;
          
          const result = await client.$queryRawUnsafe(query, olderThan);
          const deletedCount = Array.isArray(result) && result.length > 0 ? 
            (result[0] as any).deleted_count || 0 : 0;
          
          return { deletedCount };
        });
      }
    };
  }

  /**
   * Gets the deployment name for this service
   * @returns The Azure OpenAI deployment name
   */
  public getDeploymentName(): string {
    return this.deploymentName;
  }
  
  /**
   * Create vector service using direct Prisma client
   */
  private createDirectVectorService() {
    if (!this.prisma) {
      throw new Error('Prisma client is required when not using connection pooling');
    }

    return {
      upsertEmbedding: async (params: {
        documentId: string;
        content: string;
        embedding: number[];
        metadata?: DocumentMetadata;
      }) => {
        const { documentId, content, embedding, metadata } = params;
        const startTime = Date.now();
        
        // Use direct Prisma client
        return this.prisma!.$executeRawUnsafe(
          `INSERT INTO document_embeddings (
            document_id, 
            content, 
            embedding, 
            metadata,
            embedding_generation_time_ms
          )
          VALUES ($1, $2, $3::vector, $4, $5)
          ON CONFLICT (document_id) 
          DO UPDATE SET 
            content = EXCLUDED.content,
            embedding = EXCLUDED.embedding,
            metadata = EXCLUDED.metadata,
            embedding_generation_time_ms = $5,
            updated_at = NOW()`,
          documentId,
          content,
          JSON.stringify(embedding),
          JSON.stringify(metadata || {}),
          Date.now() - startTime
        );
      },
      
      findSimilarDocuments: async (params: {
        embedding: number[];
        threshold?: number;
        limit?: number;
        filter?: Record<string, any>;
      }) => {
        const { embedding, threshold = 0.7, limit = 5, filter } = params;
        
        // Use raw SQL query for pgvector compatibility and filtering
        let query = `
          SELECT 
            id, 
            document_id, 
            content,
            metadata,
            1 - (embedding <=> $1::vector) as similarity
          FROM 
            document_embeddings
          WHERE 
            1 - (embedding <=> $1::vector) > $2
        `;
        
        const queryParams: any[] = [JSON.stringify(embedding), threshold];
        let paramIndex = 3;
        
        // Add filter conditions if provided
        if (filter && Object.keys(filter).length > 0) {
          for (const [key, value] of Object.entries(filter)) {
            query += ` AND metadata->>'${key}' = $${paramIndex}`;
            queryParams.push(String(value));
            paramIndex++;
          }
        }
        
        // Add order by and limit
        query += ` ORDER BY similarity DESC LIMIT $${paramIndex}`;
        queryParams.push(limit);
        
        // Execute the query using direct Prisma client
        return this.prisma!.$queryRawUnsafe(query, ...queryParams);
      },
      
      getEmbeddingStats: async () => {
        // Return embedding statistics from the database using direct Prisma client
        return this.prisma!.$queryRawUnsafe(`
          SELECT 
            DATE_TRUNC('hour', created_at) AS hour_bucket,
            COUNT(*) AS total_embeddings,
            AVG(LENGTH(content)) AS avg_content_length,
            AVG(embedding_generation_time_ms) AS avg_generation_time_ms,
            SUM(search_count) AS total_searches
          FROM 
            document_embeddings
          GROUP BY 
            hour_bucket
          ORDER BY 
            hour_bucket DESC
          LIMIT 24
        `);
      },
      
      cleanupOldEmbeddings: async (params: { olderThan?: Date }) => {
        const { olderThan = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } = params;
        
        // Delete embeddings older than the specified date using direct Prisma client
        const query = `
          DELETE FROM document_embeddings 
          WHERE created_at < $1
          RETURNING COUNT(*) as deleted_count
        `;
        
        const result = await this.prisma!.$queryRawUnsafe(query, olderThan);
        const deletedCount = Array.isArray(result) && result.length > 0 ? 
          (result[0] as any).deleted_count || 0 : 0;
        
        return { deletedCount };
      }
    };
  }

  /**
   * Generate embedding for a text using Azure OpenAI
   * 
   * @param text - Text to generate embedding for
   * @param options - Optional parameters for embedding generation
   * @returns Promise<number[]> - Vector embedding
   */
  public async generateEmbedding(text: string, options: EmbeddingOptions = {}): Promise<number[]> {
    const startTime = Date.now();
    try {
      // Construct the Azure OpenAI API URL
      const url = `${this.endpoint}/openai/deployments/${this.deploymentName}/embeddings?api-version=${this.apiVersion}`;
      
      // Set up the request payload
      const payload = {
        input: text,
        dimensions: options.dimensions,
        user: options.user
      };
      
      // Set up headers based on authentication method
      let headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      
      // Use managed identity or API key
      if (this.useManagedIdentity) {
        const credential = new DefaultAzureCredential();
        const token = await credential.getToken('https://cognitiveservices.azure.com/.default');
        headers['Authorization'] = `Bearer ${token.token}`;
      } else {
        headers['api-key'] = this.apiKey;
      }
      
      // Make the API request
      const apiStartTime = Date.now();
      const response = await axios.post(url, payload, { headers });
      const apiLatency = Date.now() - apiStartTime;
      
      // Process rate limit headers if available
      // Convert headers to a standard record type for compatibility
      const standardHeaders: Record<string, string | string[] | undefined> = {};
      Object.entries(response.headers).forEach(([key, value]) => {
        if (typeof value === 'string' || Array.isArray(value)) {
          standardHeaders[key] = value;
        } else if (value !== null) {
          standardHeaders[key] = String(value);
        }
      });
      
      this.processRateLimitHeaders(standardHeaders);
      
      // Extract and return the embedding data
      if (response.data && response.data.data && response.data.data.length > 0) {
        const embedding = response.data.data[0].embedding;
        
        // Record metrics for the embedding generation
        try {
          azureEmbeddingMetrics.recordEmbeddingGeneration({
            generationTimeMs: Date.now() - startTime,
            embeddingDimensions: embedding.length,
            textLength: text.length,
            modelName: this.deploymentName,
            apiLatencyMs: apiLatency,
            apiStatus: response.status
          });
        } catch (metricError) {
          console.warn('Error recording embedding metrics:', metricError);
        }
        
        return embedding;
      } else {
        throw new Error('No embedding data returned from Azure OpenAI API');
      }
    } catch (error: any) {
      // Record error metrics
      try {
        azureEmbeddingMetrics.recordError(
          error.response?.status ? 'api_error' : 'client_error',
          'generate_embedding',
          error.response?.status,
          error.message
        );
      } catch (metricError) {
        console.warn('Error recording error metrics:', metricError);
      }
      
      console.error('Error generating embedding:', error.message);
      if (error.response) {
        console.error('Azure API response:', error.response.data);
      }
      throw new Error(`Failed to generate embedding: ${error.message}`);
    }
  }

  /**
   * Store a document with its embedding in the database
   * 
   * @param documentId - Unique identifier for the document
   * @param content - Text content of the document
   * @param metadata - Optional metadata associated with the document
   * @returns Promise<void>
   */
  public async storeDocument(
    documentId: string, 
    content: string, 
    metadata: DocumentMetadata = {}
  ): Promise<void> {
    const startTime = Date.now();
    try {
      // Generate embedding for the document content
      const embedding = await this.generateEmbedding(content);
      
      // Record the start time for DB operation
      const dbStartTime = Date.now();
      
      // Store the document and its embedding in the database
      await this.vectorService.upsertEmbedding({
        documentId,
        content,
        embedding,
        metadata
      });
      
      // Record document storage metrics
      try {
        azureEmbeddingMetrics.recordDocumentStorage(
          documentId,
          content.length,
          Date.now() - startTime,
          embedding.length,
          metadata.collection as string
        );
      } catch (metricError) {
        console.warn('Error recording document storage metrics:', metricError);
      }
      
      // Record DB operation metrics
      if (this.useConnectionPool) {
        try {
          const poolMetrics = await this.getConnectionPoolMetrics();
          if (poolMetrics) {
            const { utilizationPercentage = 0, activeConnections = 0, totalConnections = 0 } = poolMetrics;
            azureEmbeddingMetrics.recordEmbeddingGeneration({
              generationTimeMs: Date.now() - startTime,
              embeddingDimensions: embedding.length,
              textLength: content.length,
              modelName: this.deploymentName,
              dbOperationMs: Date.now() - dbStartTime,
              dbOperationType: 'upsert',
              poolUtilization: utilizationPercentage,
              poolActiveConnections: activeConnections,
              poolSize: totalConnections
            });
          }
        } catch (metricError) {
          console.warn('Error recording pool metrics:', metricError);
        }
      }
    } catch (error: any) {
      // Record error
      try {
        azureEmbeddingMetrics.recordError(
          'database_error',
          'store_document',
          undefined,
          error.message
        );
      } catch (metricError) {
        console.warn('Error recording error metrics:', metricError);
      }
      
      console.error('Error storing document:', error.message);
      throw new Error(`Failed to store document: ${error.message}`);
    }
  }

  /**
   * Find documents similar to a query text
   * 
   * @param queryText - Text to find similar documents for
   * @param options - Search options including threshold and limit
   * @returns Promise<SimilarDocument[]> - Array of similar documents
   */
  public async findSimilarDocuments(
    queryText: string,
    options: VectorSearchOptions = {}
  ): Promise<SimilarDocument[]> {
    const startTime = Date.now();
    try {
      // Generate embedding for the query text
      const queryEmbedding = await this.generateEmbedding(queryText);
      
      // Find documents with similar embeddings
      const similarDocuments = await this.vectorService.findSimilarDocuments({
        embedding: queryEmbedding,
        threshold: options.threshold || 0.7,
        limit: options.limit || 5,
        filter: options.filter
      });
      
      // Record similarity search metrics
      try {
        azureEmbeddingMetrics.recordSimilaritySearch(
          queryText,
          similarDocuments.length,
          Date.now() - startTime,
          options.threshold || 0.7,
          options.filter?.collection as string
        );
      } catch (metricError) {
        console.warn('Error recording similarity search metrics:', metricError);
      }
      
      return similarDocuments as SimilarDocument[];
    } catch (error: any) {
      // Record error
      try {
        azureEmbeddingMetrics.recordError(
          'search_error',
          'find_similar_documents',
          undefined,
          error.message
        );
      } catch (metricError) {
        console.warn('Error recording error metrics:', metricError);
      }
      
      console.error('Error finding similar documents:', error.message);
      throw new Error(`Failed to find similar documents: ${error.message}`);
    }
  }

  /**
   * Perform a RAG (Retrieval Augmented Generation) query
   * 
   * @param queryText - Query text
   * @param options - Search options
   * @returns Promise<RagQueryResult> - RAG query result
   */
  public async ragQuery(
    queryText: string,
    options: VectorSearchOptions = {}
  ): Promise<RagQueryResult> {
    try {
      // Find similar documents
      const documents = await this.findSimilarDocuments(queryText, options);
      
      // Return the RAG query result
      return {
        provider: 'azure',
        query: queryText,
        documents,
        timestamp: new Date().toISOString()
      };
    } catch (error: any) {
      console.error('Error performing RAG query:', error.message);
      throw new Error(`Failed to perform RAG query: ${error.message}`);
    }
  }

  /**
   * Get embedding statistics
   * 
   * @returns Promise<EmbeddingStats> - Embedding statistics
   */
  public async getStats(): Promise<EmbeddingStats> {
    try {
      // Get embedding statistics from the database
      const stats = await this.vectorService.getEmbeddingStats();
      
      return {
        provider: 'azure',
        stats
      };
    } catch (error: any) {
      console.error('Error getting embedding statistics:', error.message);
      throw new Error(`Failed to get embedding statistics: ${error.message}`);
    }
  }

  /**
   * Get metrics from the connection pool if using one
   * @returns Promise with pool metrics or null if not using pool
   */
  private async getConnectionPoolMetrics(): Promise<{
    totalConnections: number;
    activeConnections: number;
    idleConnections: number;
    utilizationPercentage: number;
    waitingRequests: number;
  } | null> {
    if (!this.useConnectionPool) {
      return null;
    }

    try {
      // Import the connection pool dynamically to avoid circular dependencies
      const { getVectorConnectionPool } = await import('../db/vector-connection-pool');
      const pool = getVectorConnectionPool();
      const metrics = pool.getMetrics();

      // Calculate utilization percentage
      const utilizationPercentage = metrics.totalConnections > 0 
        ? (metrics.activeConnections / metrics.totalConnections) * 100 
        : 0;

      return {
        totalConnections: metrics.totalConnections,
        activeConnections: metrics.activeConnections,
        idleConnections: metrics.idleConnections,
        utilizationPercentage,
        waitingRequests: metrics.waitingRequests
      };
    } catch (error) {
      console.error('Error getting connection pool metrics:', error);
      return null;
    }
  }
  
  /**
   * Process rate limit headers from Azure API response
   * @param headers Response headers from Azure API
   */
  private processRateLimitHeaders(headers: any): void {
    try {
      // Extract rate limit headers if they exist
      const remainingRequests = headers['x-ratelimit-remaining-requests'] || 
                               headers['x-ratelimit-remaining'];
      const totalRequests = headers['x-ratelimit-limit-requests'] ||
                           headers['x-ratelimit-limit'];
      const resetStr = headers['x-ratelimit-reset-requests'] ||
                       headers['x-ratelimit-reset'];
      
      if (remainingRequests && totalRequests) {
        const remaining = parseInt(Array.isArray(remainingRequests) ? remainingRequests[0] : remainingRequests, 10);
        const limit = parseInt(Array.isArray(totalRequests) ? totalRequests[0] : totalRequests, 10);
        
        // Parse reset date
        let resetDate = new Date();
        if (resetStr) {
          const resetValue = Array.isArray(resetStr) ? resetStr[0] : resetStr;
          
          // Check if it's a timestamp or a duration
          if (resetValue.includes(':') || resetValue.includes('T')) {
            // ISO date format
            resetDate = new Date(resetValue);
          } else {
            // Seconds from now
            const seconds = parseInt(resetValue, 10);
            resetDate = new Date(Date.now() + seconds * 1000);
          }
        } else {
          // Default to 1 hour from now if not provided
          resetDate = new Date(Date.now() + 60 * 60 * 1000);
        }
        
        // Record rate limit information in metrics
        if (!isNaN(remaining) && !isNaN(limit)) {
          azureEmbeddingMetrics.recordRateLimitInfo(remaining, limit, resetDate);
        }
      }
    } catch (error) {
      console.error('Error processing rate limit headers:', error);
    }
  }
}