/**
 * Azure Embedding Service Monitoring Integration
 * 
 * This module integrates the Azure Embedding Service with monitoring
 * and metrics collection to track performance, usage, and errors.
 */

import { VectorConnectionPoolFactory } from '../db/vector-connection-pool';
import { azureEmbeddingMetrics } from '../monitoring/azure-embedding-metrics';
import { type AzureEmbeddingService } from './azureEmbeddingService';
// import { logger } from '@/lib/logger';
/**
 * Registers monitoring hooks on the Azure Embedding Service
 * @param service The Azure Embedding Service instance to monitor
 */
export function monitorAzureEmbeddingService(service: AzureEmbeddingService): void {
  // Store original methods
  const originalGenerateEmbedding = service.generateEmbedding.bind(service);
  const originalStoreDocument = service.storeDocument.bind(service);
  const originalFindSimilarDocuments = service.findSimilarDocuments.bind(service);
  
  // Start monitoring connection pool
  startConnectionPoolMonitoring();
  
  // Override generateEmbedding method to add metrics
  service.generateEmbedding = async function(text: string): Promise<number[]> {
    const startTime = Date.now();
    
    try {
      // Execute original method
      const result = await originalGenerateEmbedding(text);
      
      // Record metrics
      azureEmbeddingMetrics.recordEmbeddingGeneration({
        generationTimeMs: Date.now() - startTime,
        embeddingDimensions: result.length,
        textLength: text.length,
        modelName: service.getDeploymentName(),
        tokenCount: estimateTokenCount(text),
        apiLatencyMs: Date.now() - startTime
      });
      
      return result;
    } catch (error) {
      // Record error
      azureEmbeddingMetrics.recordError(
        getErrorType(error),
        'generate_embedding',
        getStatusCode(error),
        getErrorMessage(error)
      );
      
      // Re-throw the error
      throw error;
    }
  };
  
  // Override storeDocument method to add metrics
  service.storeDocument = async function(
    documentId: string, 
    content: string, 
    metadata?: Record<string, any>
  ): Promise<void> {
    const startTime = Date.now();
    const embedding: number[] = []; // Will not be used but needed for type safety
    
    try {
      // Execute original method which calls generateEmbedding internally
      await originalStoreDocument(documentId, content, metadata);
      
      // Set fixed dimensions based on model
      const dimensions = 1536; // Most models use 1536 dims
      
      // Record metrics
      azureEmbeddingMetrics.recordDocumentStorage(
        documentId,
        content.length,
        Date.now() - startTime,
        dimensions,
        metadata?.collection as string
      );
    } catch (error) {
      // Record error
      azureEmbeddingMetrics.recordError(
        getErrorType(error),
        'store_document',
        getStatusCode(error),
        getErrorMessage(error)
      );
      
      // Re-throw the error
      throw error;
    }
  };
  
  // Override findSimilarDocuments method to add metrics
  service.findSimilarDocuments = async function(
    queryText: string,
    options?: {
      threshold?: number;
      limit?: number;
      filter?: Record<string, any>;
    }
  ): Promise<any[]> {
    const startTime = Date.now();
    const threshold = options?.threshold || 0.7;
    
    try {
      // Execute original method
      const results = await originalFindSimilarDocuments(queryText, options);
      
      // Record metrics
      azureEmbeddingMetrics.recordSimilaritySearch(
        queryText,
        results.length,
        Date.now() - startTime,
        threshold,
        options?.filter?.collection as string
      );
      
      return results;
    } catch (error) {
      // Record error
      azureEmbeddingMetrics.recordError(
        getErrorType(error),
        'similarity_search',
        getStatusCode(error),
        getErrorMessage(error)
      );
      
      // Re-throw the error
      throw error;
    }
  };
}

/**
 * Start monitoring the connection pool metrics periodically
 */
function startConnectionPoolMonitoring(): void {
  // Sample connection pool metrics every 30 seconds
  setInterval(() => {
    try {
      // Try to get an existing default pool; if none, lazily create one from env
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
      
      // Record pool metrics
      azureEmbeddingMetrics.recordPoolMetrics(
        metrics.poolSize,
        metrics.activeConnections,
        metrics.availableConnections,
        metrics.waitingClients
      );
    } catch (error) {
      console.error('Error recording connection pool metrics:', error);
    }
  }, 30000);
}

/**
 * Extract status code from error
 */
function getStatusCode(error: any): number | undefined {
  if (error?.response?.status) {
    return error.response.status;
  }
  if (error?.status) {
    return error.status;
  }
  return undefined;
}

/**
 * Extract error type from error
 */
function getErrorType(error: any): string {
  if (error?.code) {
    return error.code;
  }
  if (error?.name) {
    return error.name;
  }
  if (error?.response?.statusText) {
    return error.response.statusText;
  }
  return 'Unknown';
}

/**
 * Extract error message from error
 */
function getErrorMessage(error: any): string {
  if (error?.message) {
    return error.message;
  }
  if (error?.response?.data?.error?.message) {
    return error.response.data.error.message;
  }
  return String(error);
}

/**
 * Estimate token count from text length
 * This is a rough approximation; actual token count depends on the tokenizer
 */
function estimateTokenCount(text: string): number {
  // GPT models use roughly 4 characters per token on average for English text
  return Math.ceil(text.length / 4);
}

/**
 * Parse rate limit headers from Azure API response
 */
export function parseRateLimitHeaders(headers: Record<string, string>): void {
  try {
    // Example headers from Azure OpenAI:
    // x-ratelimit-remaining-requests: 8999
    // x-ratelimit-remaining-tokens: 239941
    // x-ratelimit-reset-requests: 2022-03-01T12:00:00Z
    // x-ratelimit-reset-tokens: 2022-03-01T12:00:00Z
    
    const remaining = parseInt(headers['x-ratelimit-remaining-requests'] || '0', 10);
    const max = parseInt(headers['x-ratelimit-limit-requests'] || '1000', 10);
    
    // Parse reset time or default to 1 hour from now
    let resetDate = new Date();
    if (headers['x-ratelimit-reset-requests']) {
      resetDate = new Date(headers['x-ratelimit-reset-requests']);
    } else {
      resetDate.setHours(resetDate.getHours() + 1);
    }
    
    // Record rate limit info
    azureEmbeddingMetrics.recordRateLimitInfo(remaining, max, resetDate);
  } catch (error) {
    console.error('Error parsing rate limit headers:', error);
  }
}