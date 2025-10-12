import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { BaseEmbeddingService, EmbeddingServiceConfig } from './embedding-service';
import { VectorConnectionPool, VectorConnectionPoolFactory } from '../db/vector-connection-pool';
import { PoolClient } from 'pg';
import { logger } from '@/lib/logger';
/**
 * Configuration specific to Azure OpenAI embedding service
 */
export interface AzureEmbeddingServiceConfig extends EmbeddingServiceConfig {
  apiVersion?: string;
  resourceName?: string;
  deploymentName?: string;
  apiKey: string;
  endpoint: string;
  database?: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
    tableName: string;
    useConnectionPool: boolean;
  };
}

/**
 * Response format from Azure OpenAI embedding API
 */
interface AzureEmbeddingResponse {
  data: {
    embedding: number[];
    index: number;
    object: string;
  }[];
  model: string;
  object: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

/**
 * Azure OpenAI Service implementation for generating embeddings
 */
export class AzureEmbeddingService extends BaseEmbeddingService {
  private readonly apiKey: string;
  private readonly endpoint: string;
  private readonly apiVersion: string;
  private readonly deploymentName: string;
  private readonly vectorPool: VectorConnectionPool | null = null;
  
  /**
   * Creates a new Azure Embedding Service
   * @param config Configuration for the Azure OpenAI service
   */
  constructor(config: AzureEmbeddingServiceConfig) {
    super({
      model: config.deploymentName || 'text-embedding-ada-002',
      dimensions: config.dimensions || 1536,
      ...config
    });
    
    this.apiKey = config.apiKey;
    this.endpoint = config.endpoint.endsWith('/') 
      ? config.endpoint.slice(0, -1) 
      : config.endpoint;
    this.apiVersion = config.apiVersion || '2023-05-15';
    this.deploymentName = config.deploymentName || 'text-embedding-ada-002';
    
    // Initialize vector database connection pool if database config is provided
    if (config.database && config.database.useConnectionPool) {
      this.vectorPool = VectorConnectionPoolFactory.createPool({
        host: config.database.host,
        port: config.database.port,
        user: config.database.user,
        password: config.database.password,
        database: config.database.database
      }, {
        min: 2,
        max: 10
      }, 'azure-embedding-vector-pool');
      
      logger.info(`Initialized vector connection pool for Azure embedding service`);
    }
  }
  
  /**
   * Generates an embedding for a single text input
   * @param text The text to generate an embedding for
   * @returns The embedding vector
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const url = `${this.endpoint}/openai/deployments/${this.deploymentName}/embeddings?api-version=${this.apiVersion}`;
      
      const requestData = {
        input: text,
        model: this.modelName
      };
      
      const requestConfig: AxiosRequestConfig = {
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.apiKey
        },
        timeout: this.config.timeout
      };
      
      const response: AxiosResponse<AzureEmbeddingResponse> = await axios.post(
        url,
        requestData,
        requestConfig
      );
      
      // Check if we got a valid response
      if (!response.data || !response.data.data || !response.data.data[0]) {
        throw new Error('Invalid response from Azure OpenAI embedding API');
      }
      
      const embedding = response.data.data[0].embedding;
      
      // Store the embedding in the database if we have a connection pool
      if (this.vectorPool) {
        await this.storeEmbedding(text, embedding);
      }
      
      return embedding;
    } catch (error) {
      logger.error('Error generating embedding:', error);
      
      // Try to retrieve from database as fallback
      if (this.vectorPool) {
        const cachedEmbedding = await this.retrieveEmbedding(text);
        if (cachedEmbedding) {
          logger.info('Retrieved embedding from cache');
          return cachedEmbedding;
        }
      }
      
      throw error;
    }
  }
  
  /**
   * Generates embeddings for multiple text inputs in a batch
   * @param texts Array of texts to generate embeddings for
   * @returns Array of embedding vectors
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      // Split into batches if needed
      const batchSize = this.config.maxBatchSize || 20;
      if (texts.length <= batchSize) {
        return this.generateEmbeddingBatch(texts);
      }
      
      // Process in batches
      const results: number[][] = [];
      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        const batchResults = await this.generateEmbeddingBatch(batch);
        results.push(...batchResults);
      }
      
      return results;
    } catch (error) {
      logger.error('Error generating embeddings in batch:', error);
      throw error;
    }
  }
  
  /**
   * Generates embeddings for a batch of texts
   * @param texts Batch of texts to generate embeddings for
   * @returns Array of embedding vectors
   */
  private async generateEmbeddingBatch(texts: string[]): Promise<number[][]> {
    const url = `${this.endpoint}/openai/deployments/${this.deploymentName}/embeddings?api-version=${this.apiVersion}`;
    
    const requestData = {
      input: texts,
      model: this.modelName
    };
    
    const requestConfig: AxiosRequestConfig = {
      headers: {
        'Content-Type': 'application/json',
        'api-key': this.apiKey
      },
      timeout: this.config.timeout
    };
    
    const response: AxiosResponse<AzureEmbeddingResponse> = await axios.post(
      url,
      requestData,
      requestConfig
    );
    
    // Check if we got a valid response
    if (!response.data || !response.data.data) {
      throw new Error('Invalid response from Azure OpenAI embedding API');
    }
    
    // Sort the embeddings by index to ensure they match the input order
    const sortedEmbeddings = response.data.data
      .sort((a, b) => a.index - b.index)
      .map(item => item.embedding);
    
    // Store embeddings in database if we have a connection pool
    if (this.vectorPool) {
      await Promise.all(
        texts.map((text, index) => 
          this.storeEmbedding(text, sortedEmbeddings[index])
        )
      );
    }
    
    return sortedEmbeddings;
  }
  
  /**
   * Stores an embedding in the vector database
   * @param text The original text
   * @param embedding The embedding vector
   */
  private async storeEmbedding(text: string, embedding: number[]): Promise<void> {
    if (!this.vectorPool || !this.config.database?.tableName) {
      return;
    }
    
    try {
      const client = await this.vectorPool.acquire();
      
      try {
        // Check if the embedding already exists
        const checkQuery = `
          SELECT id FROM ${this.config.database.tableName}
          WHERE text_hash = MD5($1)
        `;
        
        const checkResult = await client.query(checkQuery, [text]);
        
        if (checkResult.rows.length > 0) {
          // Update existing embedding
          const updateQuery = `
            UPDATE ${this.config.database.tableName}
            SET embedding = $1, updated_at = NOW()
            WHERE text_hash = MD5($2)
          `;
          
          await client.query(updateQuery, [embedding, text]);
        } else {
          // Insert new embedding
          const insertQuery = `
            INSERT INTO ${this.config.database.tableName}
            (text, text_hash, embedding, model, created_at, updated_at)
            VALUES ($1, MD5($1), $2, $3, NOW(), NOW())
          `;
          
          await client.query(insertQuery, [text, embedding, this.modelName]);
        }
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Error storing embedding in database:', error);
      // Don't throw - this is a background operation
    }
  }
  
  /**
   * Retrieves an embedding from the vector database
   * @param text The text to look up
   * @returns The embedding vector or null if not found
   */
  private async retrieveEmbedding(text: string): Promise<number[] | null> {
    if (!this.vectorPool || !this.config.database?.tableName) {
      return null;
    }
    
    try {
      const client = await this.vectorPool.acquire();
      
      try {
        const query = `
          SELECT embedding
          FROM ${this.config.database.tableName}
          WHERE text_hash = MD5($1) AND model = $2
        `;
        
        const result = await client.query(query, [text, this.modelName]);
        
        if (result.rows.length > 0) {
          return result.rows[0].embedding;
        }
        
        return null;
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Error retrieving embedding from database:', error);
      return null;
    }
  }
  
  /**
   * Performs a health check on the Azure embedding service
   * @returns True if the service is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Check API connectivity with a simple embedding
      const embedding = await this.generateEmbedding("health check");
      const apiHealthy = Array.isArray(embedding) && embedding.length === this.dimensions;
      
      // Check database connectivity if applicable
      let dbHealthy = true;
      if (this.vectorPool) {
        dbHealthy = await this.vectorPool.healthCheck();
      }
      
      return apiHealthy && dbHealthy;
    } catch (error) {
      logger.error("Azure embedding service health check failed:", error);
      return false;
    }
  }
  
  /**
   * Creates the embedding table in the database if it doesn't exist
   */
  async createEmbeddingTableIfNotExists(): Promise<boolean> {
    if (!this.vectorPool || !this.config.database?.tableName) {
      return false;
    }
    
    try {
      const client = await this.vectorPool.acquire();
      
      try {
        // Check if pgvector extension is installed
        await client.query("CREATE EXTENSION IF NOT EXISTS vector");
        
        // Create the embeddings table if it doesn't exist
        const createTableQuery = `
          CREATE TABLE IF NOT EXISTS ${this.config.database.tableName} (
            id SERIAL PRIMARY KEY,
            text TEXT NOT NULL,
            text_hash VARCHAR(32) NOT NULL,
            embedding vector(${this.dimensions}) NOT NULL,
            model VARCHAR(255) NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL
          )
        `;
        
        await client.query(createTableQuery);
        
        // Create index on text_hash for faster lookups
        const createIndexQuery = `
          CREATE INDEX IF NOT EXISTS idx_${this.config.database.tableName}_text_hash 
          ON ${this.config.database.tableName} (text_hash)
        `;
        
        await client.query(createIndexQuery);
        
        // Create vector index for similarity search
        const createVectorIndexQuery = `
          CREATE INDEX IF NOT EXISTS idx_${this.config.database.tableName}_embedding 
          ON ${this.config.database.tableName} 
          USING ivfflat (embedding vector_cosine_ops)
          WITH (lists = 100)
        `;
        
        await client.query(createVectorIndexQuery);
        
        return true;
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Error creating embedding table:', error);
      return false;
    }
  }
}