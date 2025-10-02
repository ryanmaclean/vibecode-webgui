/**
 * Azure OpenAI Embedding Service
 * Provides functionality for generating and storing text embeddings using Azure OpenAI
 * with support for connection pooling, managed identity, and comprehensive API monitoring
 */

import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import { DefaultAzureCredential } from '@azure/identity';
// Removed nonexistent withVectorConnection; use VectorConnectionPoolFactory directly
import { azureEmbeddingMetrics } from '../monitoring/azure-embedding-metrics';
import { VectorConnectionPool, VectorConnectionPoolFactory } from '../db/vector-connection-pool';
import { DatadogIntegration } from '../monitoring/datadog-integration';

// Monitoring and metrics interfaces
interface ApiMetrics {
  requestCount: number;
  totalTokens: number;
  totalCost: number;
  avgLatency: number;
  errorCount: number;
  lastReset: Date;
  requestsPerMinute: number[];
  errorRates: number[];
}

interface ApiCall {
  timestamp: Date;
  duration: number;
  tokens: number;
  cost: number;
  success: boolean;
  errorType?: string;
  inputLength: number;
  model: string;
}

interface ApiUsageAlert {
  type: 'token_limit' | 'cost_limit' | 'error_rate' | 'latency_high';
  threshold: number;
  current: number;
  timestamp: Date;
  message: string;
}

// Interface for embedding generation options
interface EmbeddingOptions {
  dimensions?: number;
  user?: string;
}

// Interface for vector search options
interface VectorSearchOptions {
  threshold?: number;
  limit?: number;
  filter?: Record<string, unknown>;
}

// Interface for document metadata
interface DocumentMetadata {
  [key: string]: unknown;
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

// Interface for vector service operations
interface VectorService {
  upsertEmbedding: (params: {
    documentId: string;
    content: string;
    embedding: number[];
    metadata?: DocumentMetadata;
  }) => Promise<unknown>;
  findSimilarDocuments: (params: {
    embedding: number[];
    threshold?: number;
    limit?: number;
    filter?: Record<string, unknown>;
  }) => Promise<unknown[]>;
  getEmbeddingStats: () => Promise<unknown>;
  cleanupOldEmbeddings: (params: { olderThan?: Date }) => Promise<{ deletedCount: number }>;
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
  private vectorService: VectorService;
  private useManagedIdentity: boolean;
  private useConnectionPool: boolean;
  
  // Monitoring and alerting properties
  private apiMetrics: ApiMetrics;
  private recentCalls: ApiCall[];
  private maxRecentCalls: number = 1000;
  private alertThresholds: {
    tokenLimit: number;
    costLimit: number;
    errorRate: number;
    highLatency: number;
  };
  private alertCallbacks: ((alert: ApiUsageAlert) => void)[] = [];
  private datadogIntegration: DatadogIntegration;
  
  // Pricing constants (Azure OpenAI pricing as of 2024)
  private readonly TOKEN_COST_PER_1K = {
    'text-embedding-ada-002': 0.0001,
    'text-embedding-3-small': 0.00002,
    'text-embedding-3-large': 0.00013
  };

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
    useConnectionPool: boolean = false,
    alertThresholds?: {
      tokenLimit?: number;
      costLimit?: number; 
      errorRate?: number;
      highLatency?: number;
    }
  ) {
    this.apiKey = apiKey;
    this.endpoint = endpoint;
    this.deploymentName = deploymentName;
    this.apiVersion = apiVersion;
    this.prisma = prisma;
    this.useManagedIdentity = useManagedIdentity;
    this.useConnectionPool = useConnectionPool;
    
    // Initialize vector service for database operations
    // Initialize monitoring
    this.initializeMonitoring(alertThresholds);
    
    // Initialize Datadog integration
    this.datadogIntegration = new DatadogIntegration();
    
    // Create vector service for database operations
    this.vectorService = this.createVectorService();
  }
  
  /**
   * Initialize monitoring and alerting system
   */
  private initializeMonitoring(alertThresholds?: {
    tokenLimit?: number;
    costLimit?: number; 
    errorRate?: number;
    highLatency?: number;
  }) {
    // Initialize metrics
    this.apiMetrics = {
      requestCount: 0,
      totalTokens: 0,
      totalCost: 0,
      avgLatency: 0,
      errorCount: 0,
      lastReset: new Date(),
      requestsPerMinute: [],
      errorRates: []
    };

    // Initialize recent calls tracking
    this.recentCalls = [];

    // Set alert thresholds with defaults
    this.alertThresholds = {
      tokenLimit: alertThresholds?.tokenLimit ?? 100000, // 100k tokens per hour
      costLimit: alertThresholds?.costLimit ?? 10, // $10 per hour
      errorRate: alertThresholds?.errorRate ?? 0.1, // 10% error rate
      highLatency: alertThresholds?.highLatency ?? 5000 // 5 seconds
    };

    // Start periodic cleanup of old calls
    setInterval(() => this.cleanupOldCalls(), 60000); // Every minute
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
        const pool = VectorConnectionPoolFactory.createPool({
            host: process.env.DATABASE_HOST || 'localhost',
            port: parseInt(process.env.DATABASE_PORT || '5432'),
            database: process.env.DATABASE_NAME || 'vibecode',
            user: process.env.DATABASE_USER || 'postgres',
            password: process.env.DATABASE_PASSWORD || 'password'
        });
        return pool.withTransaction(async (client: PrismaClient) => {
          // Use Prisma's executeRaw to handle the pgvector type
          return client.$executeRawUnsafe(
            `INSERT INTO document_embeddings (
              document_id, 
              content, 
              embedding, 
              metadata,
              embedding_generation_time_ms
            )
            VALUES ($1, $2, $3::vector, $4::jsonb, $5)
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
        filter?: Record<string, unknown>;
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
        
        const queryParams: unknown[] = [JSON.stringify(embedding), threshold];
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
        const pool = VectorConnectionPoolFactory.createPool({
            host: process.env.DATABASE_HOST || 'localhost',
            port: parseInt(process.env.DATABASE_PORT || '5432'),
            database: process.env.DATABASE_NAME || 'vibecode',
            user: process.env.DATABASE_USER || 'postgres',
            password: process.env.DATABASE_PASSWORD || 'password'
        });
        return pool.withTransaction(async (client: PrismaClient) => {
          return client.$queryRawUnsafe(query, ...queryParams);
        });
      },
      
      getEmbeddingStats: async () => {
        // Return embedding statistics from the database using connection pool
        const pool = VectorConnectionPoolFactory.createPool({
            host: process.env.DATABASE_HOST || 'localhost',
            port: parseInt(process.env.DATABASE_PORT || '5432'),
            database: process.env.DATABASE_NAME || 'vibecode',
            user: process.env.DATABASE_USER || 'postgres',
            password: process.env.DATABASE_PASSWORD || 'password'
        });
        return pool.withTransaction(async (client: PrismaClient) => {
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
        const pool = VectorConnectionPoolFactory.createPool({
            host: process.env.DATABASE_HOST || 'localhost',
            port: parseInt(process.env.DATABASE_PORT || '5432'),
            database: process.env.DATABASE_NAME || 'vibecode',
            user: process.env.DATABASE_USER || 'postgres',
            password: process.env.DATABASE_PASSWORD || 'password'
        });
        return pool.withTransaction(async (client: any) => {
          const query = `
            DELETE FROM document_embeddings 
            WHERE created_at < $1
            RETURNING COUNT(*) as deleted_count
          `;
          
          const result = await client.$queryRawUnsafe(query, olderThan);
          const deletedCount = Array.isArray(result) && result.length > 0 ?
            (result[0] as { deleted_count?: number }).deleted_count || 0 : 0;
          
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
          VALUES ($1, $2, $3::vector, $4::jsonb, $5)
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
        filter?: Record<string, unknown>;
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
        
        const queryParams: unknown[] = [JSON.stringify(embedding), threshold];
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
          (result[0] as { deleted_count?: number }).deleted_count || 0 : 0;
        
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
    let success = false;
    let errorType: string | undefined;
    let tokens = 0;
    
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
      // eslint-disable-next-line prefer-const
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
      
      // Extract embedding data and usage info
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
        success = true;
        tokens = response.data.usage?.total_tokens || this.estimateTokens(text);
        
        // Record successful API call
        this.recordApiCall({
          timestamp: new Date(startTime),
          duration: Date.now() - startTime,
          tokens,
          cost: this.calculateCost(tokens),
          success: true,
          inputLength: text.length,
          model: this.deploymentName
        });

        // Send metrics to Datadog
        this.datadogIntegration.recordEmbeddingMetrics({
          operation: 'generate',
          duration: Date.now() - startTime,
          tokens,
          cost: this.calculateCost(tokens),
          success: true,
          model: this.deploymentName,
          inputLength: text.length
        });

        return response.data.data[0].embedding;
      } else {
        throw new Error('No embedding data returned from Azure OpenAI API');
      }
    } catch (error: unknown) {
      const err = error as { response?: { status?: number; data?: unknown }; message?: string };
      // Record error metrics
      try {
        azureEmbeddingMetrics.recordError(
          err.response?.status ? 'api_error' : 'client_error',
          'generate_embedding',
          err.response?.status,
          err.message || 'Unknown error'
        );
      } catch (metricError) {
        console.warn('Error recording error metrics:', metricError);
      }

      errorType = this.categorizeError(error);

      // Record failed API call
      this.recordApiCall({
        timestamp: new Date(startTime),
        duration: Date.now() - startTime,
        tokens: 0,
        cost: 0,
        success: false,
        errorType,
        inputLength: text.length,
        model: this.deploymentName
      });

      // Send error metrics to Datadog
      this.datadogIntegration.recordEmbeddingMetrics({
        operation: 'generate',
        duration: Date.now() - startTime,
        tokens: 0,
        cost: 0,
        success: false,
        errorType,
        model: this.deploymentName,
        inputLength: text.length
      });

      console.error('Error generating embedding:', err.message || 'Unknown error');
      if (err.response) {
        console.error('Azure API response:', err.response.data);
      }
      throw new Error(`Failed to generate embedding: ${err.message || 'Unknown error'}`);
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
    } catch (error: unknown) {
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
      
      const err = error as { message?: string };
      console.error('Error storing document:', err.message || 'Unknown error');
      throw new Error(`Failed to store document: ${err.message || 'Unknown error'}`);
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
    } catch (error: unknown) {
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
      
      const err = error as { message?: string };
      console.error('Error finding similar documents:', err.message || 'Unknown error');
      throw new Error(`Failed to find similar documents: ${err.message || 'Unknown error'}`);
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
    } catch (error: unknown) {
      const err = error as { message?: string };
      console.error('Error performing RAG query:', err.message || 'Unknown error');
      throw new Error(`Failed to perform RAG query: ${err.message || 'Unknown error'}`);
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
    } catch (error: unknown) {
      const err = error as { message?: string };
      console.error('Error getting embedding statistics:', err.message || 'Unknown error');
      throw new Error(`Failed to get embedding statistics: ${err.message || 'Unknown error'}`);
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
      // Use the pool factory; lazily create a default pool if needed
      let pool = VectorConnectionPoolFactory.getPool('default');
      if (!pool) {
        pool = VectorConnectionPoolFactory.createPool({
          host: process.env.DATABASE_HOST || 'localhost',
          port: parseInt(process.env.DATABASE_PORT || '5432', 10),
          database: process.env.DATABASE_NAME || 'vibecode',
          user: process.env.DATABASE_USER || 'postgres',
          password: process.env.DATABASE_PASSWORD || 'password'
        }, {}, 'default');
      }
      const metrics = pool.getMetrics();

      // Calculate utilization percentage
      const utilizationPercentage = metrics.poolSize > 0 
        ? (metrics.activeConnections / metrics.poolSize) * 100 
        : 0;

      return {
        totalConnections: metrics.poolSize,
        activeConnections: metrics.activeConnections,
        idleConnections: metrics.availableConnections,
        utilizationPercentage,
        waitingRequests: metrics.waitingClients
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
  private processRateLimitHeaders(headers: Record<string, string | string[] | undefined>): void {
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

  // MONITORING AND ALERTING METHODS

  /**
   * Record an API call for monitoring and metrics
   */
  private recordApiCall(call: ApiCall): void {
    // Add to recent calls
    this.recentCalls.push(call);

    // Trim old calls if we exceed the limit
    if (this.recentCalls.length > this.maxRecentCalls) {
      this.recentCalls = this.recentCalls.slice(-this.maxRecentCalls);
    }

    // Update metrics
    this.updateMetrics(call);

    // Check for alerts
    this.checkAlerts();
  }

  /**
   * Update API metrics with new call data
   */
  private updateMetrics(call: ApiCall): void {
    this.apiMetrics.requestCount++;
    this.apiMetrics.totalTokens += call.tokens;
    this.apiMetrics.totalCost += call.cost;
    
    if (!call.success) {
      this.apiMetrics.errorCount++;
    }

    // Update average latency
    const totalLatency = this.apiMetrics.avgLatency * (this.apiMetrics.requestCount - 1) + call.duration;
    this.apiMetrics.avgLatency = totalLatency / this.apiMetrics.requestCount;

    // Update requests per minute (rolling window)
    const currentMinute = Math.floor(Date.now() / 60000);
    const minuteIndex = currentMinute % 60;
    
    if (!this.apiMetrics.requestsPerMinute[minuteIndex]) {
      this.apiMetrics.requestsPerMinute[minuteIndex] = 0;
    }
    this.apiMetrics.requestsPerMinute[minuteIndex]++;

    // Update error rates (rolling window)
    const errorRate = this.apiMetrics.errorCount / this.apiMetrics.requestCount;
    this.apiMetrics.errorRates.push(errorRate);
    if (this.apiMetrics.errorRates.length > 60) {
      this.apiMetrics.errorRates.shift();
    }
  }

  /**
   * Check for alerts based on current metrics
   */
  private checkAlerts(): void {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    // Get recent calls from last hour
    const recentHourCalls = this.recentCalls.filter(call => call.timestamp >= oneHourAgo);
    
    // Check token limit alert
    const hourlyTokens = recentHourCalls.reduce((sum, call) => sum + call.tokens, 0);
    if (hourlyTokens > this.alertThresholds.tokenLimit) {
      this.triggerAlert({
        type: 'token_limit',
        threshold: this.alertThresholds.tokenLimit,
        current: hourlyTokens,
        timestamp: now,
        message: `Token usage exceeded threshold: ${hourlyTokens} tokens in the last hour`
      });
    }

    // Check cost limit alert
    const hourlyCost = recentHourCalls.reduce((sum, call) => sum + call.cost, 0);
    if (hourlyCost > this.alertThresholds.costLimit) {
      this.triggerAlert({
        type: 'cost_limit',
        threshold: this.alertThresholds.costLimit,
        current: hourlyCost,
        timestamp: now,
        message: `Cost exceeded threshold: $${hourlyCost.toFixed(4)} in the last hour`
      });
    }

    // Check error rate alert
    const hourlyErrorRate = recentHourCalls.length > 0 ? 
      recentHourCalls.filter(call => !call.success).length / recentHourCalls.length : 0;
    if (hourlyErrorRate > this.alertThresholds.errorRate) {
      this.triggerAlert({
        type: 'error_rate',
        threshold: this.alertThresholds.errorRate,
        current: hourlyErrorRate,
        timestamp: now,
        message: `Error rate exceeded threshold: ${(hourlyErrorRate * 100).toFixed(1)}% in the last hour`
      });
    }

    // Check high latency alert
    const recentLatency = this.recentCalls.length > 0 ? 
      this.recentCalls[this.recentCalls.length - 1].duration : 0;
    if (recentLatency > this.alertThresholds.highLatency) {
      this.triggerAlert({
        type: 'latency_high',
        threshold: this.alertThresholds.highLatency,
        current: recentLatency,
        timestamp: now,
        message: `High latency detected: ${recentLatency}ms for last request`
      });
    }
  }

  /**
   * Trigger an alert
   */
  private triggerAlert(alert: ApiUsageAlert): void {
    console.warn('Azure API Alert:', alert);
    
    // Send alert to Datadog
    this.datadogIntegration.sendUsageAlert({
      type: alert.type,
      threshold: alert.threshold,
      current: alert.current,
      message: alert.message
    });
    
    this.alertCallbacks.forEach(callback => {
      try {
        callback(alert);
      } catch (error) {
        console.error('Error in alert callback:', error);
      }
    });
  }

  /**
   * Estimate tokens for text (rough approximation)
   */
  private estimateTokens(text: string): number {
    // Rough estimate: ~4 characters per token for English text
    return Math.ceil(text.length / 4);
  }

  /**
   * Calculate cost based on tokens and model
   */
  private calculateCost(tokens: number): number {
    const costPer1K = this.TOKEN_COST_PER_1K[this.deploymentName as keyof typeof this.TOKEN_COST_PER_1K] || 
                      this.TOKEN_COST_PER_1K['text-embedding-ada-002'];
    return (tokens / 1000) * costPer1K;
  }

  /**
   * Categorize error for monitoring
   */
  private categorizeError(error: unknown): string {
    const err = error as { response?: { status?: number }; code?: string };
    if (err.response?.status) {
      const status = err.response.status;
      if (status === 401) return 'authentication';
      if (status === 403) return 'authorization';
      if (status === 429) return 'rate_limit';
      if (status >= 500) return 'server_error';
      if (status >= 400) return 'client_error';
    }
    if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
      return 'network_error';
    }
    return 'unknown';
  }

  /**
   * Clean up old API calls from memory
   */
  private cleanupOldCalls(): void {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    this.recentCalls = this.recentCalls.filter(call => call.timestamp >= oneHourAgo);
  }

  // PUBLIC MONITORING API

  /**
   * Get current API usage metrics
   */
  public getApiMetrics(): ApiMetrics {
    return { ...this.apiMetrics };
  }

  /**
   * Get recent API calls
   */
  public getRecentCalls(limit: number = 100): ApiCall[] {
    return this.recentCalls.slice(-limit);
  }

  /**
   * Reset API metrics
   */
  public resetMetrics(): void {
    this.apiMetrics = {
      requestCount: 0,
      totalTokens: 0,
      totalCost: 0,
      avgLatency: 0,
      errorCount: 0,
      lastReset: new Date(),
      requestsPerMinute: [],
      errorRates: []
    };
    this.recentCalls = [];
  }

  /**
   * Add alert callback for monitoring
   */
  public onAlert(callback: (alert: ApiUsageAlert) => void): void {
    this.alertCallbacks.push(callback);
  }

  /**
   * Remove alert callback
   */
  public removeAlert(callback: (alert: ApiUsageAlert) => void): void {
    const index = this.alertCallbacks.indexOf(callback);
    if (index > -1) {
      this.alertCallbacks.splice(index, 1);
    }
  }

  /**
   * Update alert thresholds
   */
  public updateAlertThresholds(thresholds: {
    tokenLimit?: number;
    costLimit?: number;
    errorRate?: number;
    highLatency?: number;
  }): void {
    this.alertThresholds = {
      ...this.alertThresholds,
      ...thresholds
    };
  }

  /**
   * Get detailed usage report
   */
  public getUsageReport(): {
    summary: ApiMetrics;
    hourlyBreakdown: Array<{
      hour: string;
      requests: number;
      tokens: number;
      cost: number;
      errors: number;
      avgLatency: number;
    }>;
    errorBreakdown: Record<string, number>;
    recommendations: string[];
  } {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const recent24HCalls = this.recentCalls.filter(call => call.timestamp >= last24Hours);

    // Group by hour
    const hourlyData = new Map<string, ApiCall[]>();
    recent24HCalls.forEach(call => {
      const hour = call.timestamp.toISOString().slice(0, 13) + ':00:00';
      if (!hourlyData.has(hour)) {
        hourlyData.set(hour, []);
      }
      hourlyData.get(hour)!.push(call);
    });

    const hourlyBreakdown = Array.from(hourlyData.entries()).map(([hour, calls]) => ({
      hour,
      requests: calls.length,
      tokens: calls.reduce((sum, c) => sum + c.tokens, 0),
      cost: calls.reduce((sum, c) => sum + c.cost, 0),
      errors: calls.filter(c => !c.success).length,
      avgLatency: calls.reduce((sum, c) => sum + c.duration, 0) / calls.length
    }));

    // Error breakdown
    const errorBreakdown: Record<string, number> = {};
    recent24HCalls.filter(call => !call.success).forEach(call => {
      const errorType = call.errorType || 'unknown';
      errorBreakdown[errorType] = (errorBreakdown[errorType] || 0) + 1;
    });

    // Generate recommendations
    const recommendations: string[] = [];
    const totalCost24h = recent24HCalls.reduce((sum, call) => sum + call.cost, 0);
    const errorRate24h = recent24HCalls.length > 0 ? 
      recent24HCalls.filter(call => !call.success).length / recent24HCalls.length : 0;

    if (totalCost24h > 50) {
      recommendations.push('High daily cost detected. Consider implementing caching for frequent queries.');
    }
    if (errorRate24h > 0.05) {
      recommendations.push('Error rate above 5%. Check authentication and network connectivity.');
    }
    if (this.apiMetrics.avgLatency > 2000) {
      recommendations.push('Average latency above 2s. Consider using smaller batch sizes or connection pooling.');
    }

    return {
      summary: this.getApiMetrics(),
      hourlyBreakdown: hourlyBreakdown.sort((a, b) => a.hour.localeCompare(b.hour)),
      errorBreakdown,
      recommendations
    };
  }
}
