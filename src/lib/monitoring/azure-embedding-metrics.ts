import { datadogMetrics } from './datadog-metrics';
import { MetricData } from './metrics-types';

// Types for embedding metrics
export interface EmbeddingMetricsData {
  // Core metrics
  generationTimeMs: number;
  embeddingDimensions: number;
  textLength: number;
  modelName: string;
  
  // Optional context
  documentId?: string;
  collectionName?: string;
  batchSize?: number;
  
  // API metrics
  tokenCount?: number;
  apiLatencyMs?: number;
  apiStatus?: number;
  apiRegion?: string;
  errorType?: string;
  
  // Database metrics
  dbOperationMs?: number;
  dbOperationType?: string;
  
  // Connection pool metrics
  poolUtilization?: number;
  poolActiveConnections?: number;
  poolSize?: number;
  acquireTimeMs?: number;
}

// Azure Embedding Service Metrics
export class AzureEmbeddingMetrics {
  private static instance: AzureEmbeddingMetrics;
  private isEnabled: boolean;
  private standardTags: Record<string, string>;
  private rateLimitRemaining: number = 1000; // Default value
  private rateLimitMax: number = 1000; // Default value
  private quotaReset: Date = new Date();
  
  // Private singleton constructor
  private constructor() {
    this.isEnabled = process.env.NODE_ENV === 'production' || 
                     process.env.ENABLE_DEV_METRICS === 'true';
                    
    this.standardTags = {
      component: 'azure_embedding',
      service: 'vector_search',
      team: 'ai'
    };
  }
  
  // Get singleton instance
  public static getInstance(): AzureEmbeddingMetrics {
    if (!AzureEmbeddingMetrics.instance) {
      AzureEmbeddingMetrics.instance = new AzureEmbeddingMetrics();
    }
    return AzureEmbeddingMetrics.instance;
  }
  
  /**
   * Record embedding generation metrics
   */
  public recordEmbeddingGeneration(metrics: EmbeddingMetricsData): void {
    if (!this.isEnabled) return;
    
    const tags: Record<string, string> = {
      ...this.standardTags,
      operation: 'generate_embedding',
      model: metrics.modelName,
      text_length_tier: this.categorizeTextLength(metrics.textLength),
      dimensions: metrics.embeddingDimensions.toString()
    };
    
    // Add optional tags
    if (metrics.documentId) tags.document_id = metrics.documentId;
    if (metrics.collectionName) tags.collection = metrics.collectionName;
    if (metrics.batchSize) tags.batch_size = this.categorizeBatchSize(metrics.batchSize);
    if (metrics.apiRegion) tags.region = metrics.apiRegion;
    if (metrics.errorType) tags.error_type = metrics.errorType;
    if (metrics.apiStatus) tags.status_code = metrics.apiStatus.toString();
    
    // Send core metrics
    datadogMetrics.sendBatchMetrics([
      {
        name: 'azure.openai.embedding.generation_time',
        value: metrics.generationTimeMs,
        tags
      },
      {
        name: 'azure.openai.embedding.text_length',
        value: metrics.textLength,
        tags
      },
      {
        name: 'azure.openai.embedding.request_count',
        value: 1,
        tags
      }
    ]);
    
       // Send API metrics if available
       if (metrics.tokenCount || metrics.apiLatencyMs) {
         const apiMetrics: MetricData[] = [];
         
         if (metrics.tokenCount) {
           apiMetrics.push({
             name: 'azure.openai.embedding.token_count',
             value: metrics.tokenCount,
             tags
           });
         }
         
         if (metrics.apiLatencyMs) {
           apiMetrics.push({
             name: 'azure.openai.embedding.api_latency',
             value: metrics.apiLatencyMs,
             tags
           });
         }
         
         if (apiMetrics.length > 0) {
           datadogMetrics.sendBatchMetrics(apiMetrics);
         }
       }
    
       // Send DB metrics if available
       if (metrics.dbOperationMs) {
         const dbTags = { ...tags };
         if (metrics.dbOperationType) {
           dbTags.operation_type = metrics.dbOperationType;
         }
         
         datadogMetrics.sendBatchMetrics([{
           name: 'azure.openai.embedding.db_operation_time',
           value: metrics.dbOperationMs,
           tags: dbTags
         }] as MetricData[]);
    }
    
       // Send connection pool metrics if available
       if (metrics.poolUtilization !== undefined || 
           metrics.poolActiveConnections !== undefined || 
           metrics.acquireTimeMs !== undefined) {
         
         const poolMetrics: MetricData[] = [];
         
         if (metrics.poolUtilization !== undefined) {
           poolMetrics.push({
             name: 'azure.openai.embedding.pool_utilization',
             value: metrics.poolUtilization,
             tags
           });
         }
         
         if (metrics.poolActiveConnections !== undefined && metrics.poolSize !== undefined) {
           const poolTags = { ...tags, pool_size: metrics.poolSize.toString() };
           poolMetrics.push({
             name: 'azure.openai.embedding.pool_active_connections',
             value: metrics.poolActiveConnections,
             tags: poolTags
           });
         }
         
         if (metrics.acquireTimeMs !== undefined) {
           poolMetrics.push({
             name: 'azure.openai.embedding.connection_acquire_time',
             value: metrics.acquireTimeMs,
             tags
           });
         }
         
         if (poolMetrics.length > 0) {
           datadogMetrics.sendBatchMetrics(poolMetrics);
         }
       }
  }
  
  /**
   * Record similarity search metrics
   */
  public recordSimilaritySearch(
    queryText: string,
    resultCount: number,
    latencyMs: number,
    similarityThreshold: number,
    collectionName?: string
  ): void {
    if (!this.isEnabled) return;
    
    const tags: Record<string, string> = {
      ...this.standardTags,
      operation: 'similarity_search',
      text_length_tier: this.categorizeTextLength(queryText.length),
      result_tier: this.categorizeResultCount(resultCount),
      similarity_threshold: similarityThreshold.toFixed(2)
    };
    
    if (collectionName) {
      tags.collection = collectionName;
    }
    
    datadogMetrics.sendBatchMetrics([
      {
        name: 'azure.openai.embedding.search_latency',
        value: latencyMs,
        tags
      },
      {
        name: 'azure.openai.embedding.search_result_count',
        value: resultCount,
        tags
      },
      {
        name: 'azure.openai.embedding.search_count',
        value: 1,
        tags
      }
    ] as MetricData[]);
  }
  
  /**
   * Record document storage metrics
   */
  public recordDocumentStorage(
    documentId: string,
    contentLength: number,
    latencyMs: number,
    embeddingDimensions: number,
    collectionName?: string
  ): void {
    if (!this.isEnabled) return;
    
    const tags: Record<string, string> = {
      ...this.standardTags,
      operation: 'store_document',
      document_id: documentId,
      content_length_tier: this.categorizeTextLength(contentLength),
      dimensions: embeddingDimensions.toString()
    };
    
    if (collectionName) {
      tags.collection = collectionName;
    }
    
    datadogMetrics.sendBatchMetrics([
      {
        name: 'azure.openai.embedding.storage_latency',
        value: latencyMs,
        tags
      },
      {
        name: 'azure.openai.embedding.document_content_length',
        value: contentLength,
        tags
      },
      {
        name: 'azure.openai.embedding.store_count',
        value: 1,
        tags
      }
    ] as MetricData[]);
  }
  
  /**
   * Record rate limit information from Azure API response headers
   */
  public recordRateLimitInfo(
    remainingRequests: number,
    maxRequests: number,
    resetDate: Date
  ): void {
    if (!this.isEnabled) return;
    
    // Update internal state
    this.rateLimitRemaining = remainingRequests;
    this.rateLimitMax = maxRequests;
    this.quotaReset = resetDate;
    
    const utilizationPercentage = 100 - ((remainingRequests / maxRequests) * 100);
    const secondsToReset = Math.max(0, Math.floor((resetDate.getTime() - Date.now()) / 1000));
    
    const tags: Record<string, string> = {
      ...this.standardTags,
      operation: 'rate_limit'
    };
    
    datadogMetrics.sendBatchMetrics([
      {
        name: 'azure.openai.embedding.rate_limit_remaining',
        value: remainingRequests,
        tags
      },
      {
        name: 'azure.openai.embedding.rate_limit_max',
        value: maxRequests,
        tags
      },
      {
        name: 'azure.openai.embedding.rate_limit_utilization',
        value: utilizationPercentage,
        tags
      },
      {
        name: 'azure.openai.embedding.rate_limit_reset_seconds',
        value: secondsToReset,
        tags
      }
    ] as MetricData[]);
  }
  
  /**
   * Record errors during embedding operations
   */
  public recordError(
    errorType: string,
    operation: string,
    statusCode?: number,
    errorMessage?: string
  ): void {
    if (!this.isEnabled) return;
    
    const tags: Record<string, string> = {
      ...this.standardTags,
      error_type: errorType,
      operation
    };
    
    if (statusCode) {
      tags.status_code = statusCode.toString();
    }
    
    if (errorMessage) {
      tags.error_message = this.sanitizeErrorMessage(errorMessage);
    }
    
    datadogMetrics.sendBatchMetrics([{
      name: 'azure.openai.embedding.errors',
      value: 1,
      tags
    }] as MetricData[]);
  }
  
  /**
   * Record connection pool health metrics
   */
  public recordPoolMetrics(
    totalConnections: number,
    activeConnections: number,
    idleConnections: number,
    waitingRequests: number
  ): void {
    if (!this.isEnabled) return;
    
    const tags: Record<string, string> = {
      ...this.standardTags,
      component: 'connection_pool'
    };
    
    const utilizationPercentage = activeConnections > 0 ? 
      (activeConnections / totalConnections) * 100 : 0;
    
    datadogMetrics.sendBatchMetrics([
      {
        name: 'azure.openai.embedding.pool_total_connections',
        value: totalConnections,
        tags
      },
      {
        name: 'azure.openai.embedding.pool_active_connections',
        value: activeConnections,
        tags
      },
      {
        name: 'azure.openai.embedding.pool_idle_connections',
        value: idleConnections,
        tags
      },
      {
        name: 'azure.openai.embedding.pool_waiting_requests',
        value: waitingRequests,
        tags
      },
      {
        name: 'azure.openai.embedding.pool_utilization',
        value: utilizationPercentage,
        tags
      }
    ] as MetricData[]);
  }
  
  /**
   * Get current rate limit information
   */
  public getRateLimitInfo(): { remaining: number; max: number; resetDate: Date; utilizationPercentage: number } {
    const utilizationPercentage = 100 - ((this.rateLimitRemaining / this.rateLimitMax) * 100);
    return {
      remaining: this.rateLimitRemaining,
      max: this.rateLimitMax,
      resetDate: new Date(this.quotaReset),
      utilizationPercentage
    };
  }
  
  /**
   * Check if rate limit is approaching critical level
   */
  public isRateLimitCritical(thresholdPercentage: number = 80): boolean {
    const utilizationPercentage = 100 - ((this.rateLimitRemaining / this.rateLimitMax) * 100);
    return utilizationPercentage >= thresholdPercentage;
  }
  
  // Helper methods for categorization
  private categorizeTextLength(length: number): string {
    if (length < 100) return 'small';
    if (length < 500) return 'medium';
    if (length < 2000) return 'large';
    return 'xlarge';
  }
  
  private categorizeBatchSize(size: number): string {
    if (size === 1) return 'single';
    if (size < 5) return 'small';
    if (size < 20) return 'medium';
    if (size < 50) return 'large';
    return 'xlarge';
  }
  
  private categorizeResultCount(count: number): string {
    if (count === 0) return 'none';
    if (count < 3) return 'few';
    if (count < 10) return 'medium';
    return 'many';
  }
  
  private sanitizeErrorMessage(message: string): string {
    // Remove any sensitive information like API keys or tokens
    const sanitized = message
      .replace(/key=([a-zA-Z0-9_\-]+)/g, 'key=[REDACTED]')
      .replace(/token=([a-zA-Z0-9_\-]+)/g, 'token=[REDACTED]')
      .replace(/api_key=([a-zA-Z0-9_\-]+)/g, 'api_key=[REDACTED]')
      .replace(/authorization:\s*bearer\s+([a-zA-Z0-9_\-\.]+)/i, 'authorization: Bearer [REDACTED]');
      
    // Limit length to avoid overloading metrics
    return sanitized.length > 100 ? sanitized.substring(0, 97) + '...' : sanitized;
  }
}

// Export singleton instance
export const azureEmbeddingMetrics = AzureEmbeddingMetrics.getInstance();