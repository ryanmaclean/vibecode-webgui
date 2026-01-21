/**
 * Resilient Azure Embedding Service
 * Integrates circuit breaker pattern with Azure OpenAI embedding service
 */

import { AzureEmbeddingService } from './azureEmbeddingService'
import { circuitBreakerManager, CircuitBreakerError } from '../resilience/circuit-breaker'

interface ResilientEmbeddingOptions {
  dimensions?: number
  user?: string
  fallbackToLocal?: boolean
  skipCircuitBreaker?: boolean
}

/**
 * Azure Embedding Service with circuit breaker protection
 */
export class ResilientAzureEmbeddingService extends AzureEmbeddingService {
  private serviceName: string
  private _fallbackEmbedding?: () => Promise<number[]>

  constructor(
    config: {
      apiKey: string
      endpoint: string
      deploymentName?: string
      apiVersion?: string
    }
  ) {
    super({
      apiKey: config.apiKey,
      endpoint: config.endpoint,
      deploymentName: config.deploymentName,
      apiVersion: config.apiVersion || '2023-05-15'
    })

    this.serviceName = `azure-openai-${config.deploymentName || 'text-embedding-ada-002'}`

    // Initialize circuit breaker with production-ready config
    circuitBreakerManager.getCircuitBreaker(this.serviceName, {
      failureThreshold: 3,          // Open after 3 failures
      recoveryTimeout: 60000,       // Wait 1 minute before retry
      requestTimeout: 15000,        // 15 second timeout for embedding calls
      monitoringWindow: 300000,     // 5 minute monitoring window
      minimumRequestThreshold: 2,   // Need at least 2 requests
      successThreshold: 2,          // Need 2 successes to close circuit
      maxRetries: 2                 // Retry twice with backoff
    })

    console.info(`Resilient Azure Embedding Service initialized with circuit breaker`)
  }

  /**
   * Generate embedding with circuit breaker protection
   */
  async generateEmbedding(text: string, options: ResilientEmbeddingOptions = {}): Promise<number[]> {
    // Skip circuit breaker if explicitly requested
    if (options.skipCircuitBreaker) {
      return super.generateEmbedding(text)
    }

    try {
      return await circuitBreakerManager.execute(
        this.serviceName,
        () => super.generateEmbedding(text),
        options.fallbackToLocal ? () => this.generateFallbackEmbedding(text) : undefined
      )
    } catch (error) {
      if (error instanceof CircuitBreakerError) {
        console.error(`Circuit breaker preventing Azure OpenAI call for "${text.substring(0, 30)}..."`)

        // If fallback is enabled, try local embedding
        if (options.fallbackToLocal) {
          return this.generateFallbackEmbedding(text)
        }
      }

      throw error
    }
  }

  /**
   * Generate embeddings for multiple texts with circuit breaker
   */
  async generateEmbeddingsBatch(
    texts: string[],
    options: ResilientEmbeddingOptions = {}
  ): Promise<Array<{ text: string; embedding: number[]; source: 'azure' | 'fallback' }>> {
    const results: Array<{ text: string; embedding: number[]; source: 'azure' | 'fallback' }> = []

    // Process in smaller batches to avoid overwhelming the service
    const batchSize = 10
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize)

      const batchPromises = batch.map(async (text) => {
        try {
          const embedding = await this.generateEmbedding(text, options)
          return { text, embedding, source: 'azure' as const }
        } catch (error) {
          console.warn(`Failed to generate embedding for "${text.substring(0, 30)}...":`, error instanceof Error ? error.message : String(error))

          if (options.fallbackToLocal) {
            const fallbackEmbedding = await this.generateFallbackEmbedding(text)
            return { text, embedding: fallbackEmbedding, source: 'fallback' as const }
          }

          throw error
        }
      })

      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)

      // Small delay between batches to be respectful of rate limits
      if (i + batchSize < texts.length) {
        await this.delay(100)
      }
    }

    const azureCount = results.filter(r => r.source === 'azure').length
    const fallbackCount = results.filter(r => r.source === 'fallback').length

    console.info(`Batch embedding results: ${azureCount} from Azure, ${fallbackCount} from fallback`)

    return results
  }

  /**
   * Check if service is healthy (extended version with circuit breaker metrics)
   */
  async healthCheckExtended(): Promise<{
    isHealthy: boolean
    circuitState: string
    lastError?: string
    responseTime?: number
    metrics: any
  }> {
    const circuitBreaker = circuitBreakerManager.getCircuitBreaker(this.serviceName)
    const healthStatus = circuitBreaker.getHealthStatus()
    const metrics = circuitBreaker.getMetrics()

    try {
      // Try a small test embedding to verify service
      const startTime = Date.now()
      await this.generateEmbedding('health check', { skipCircuitBreaker: true })
      const responseTime = Date.now() - startTime

      return {
        isHealthy: true,
        circuitState: healthStatus.state,
        responseTime,
        metrics: {
          ...healthStatus,
          recentRequests: metrics.recentRequests.length
        }
      }
    } catch (error) {
      return {
        isHealthy: false,
        circuitState: healthStatus.state,
        lastError: error instanceof Error ? error.message : 'Unknown error',
        metrics: {
          ...healthStatus,
          recentRequests: metrics.recentRequests.length
        }
      }
    }
  }

  /**
   * Get service metrics for monitoring
   */
  getServiceMetrics() {
    const circuitBreaker = circuitBreakerManager.getCircuitBreaker(this.serviceName)
    return circuitBreaker.getHealthStatus()
  }

  /**
   * Reset circuit breaker (for manual recovery)
   */
  resetCircuitBreaker(): void {
    const circuitBreaker = circuitBreakerManager.getCircuitBreaker(this.serviceName)
    circuitBreaker.reset()
    console.info(`Circuit breaker reset for ${this.serviceName}`)
  }

  /**
   * Fallback embedding generation using simple text hashing
   * In production, this could be replaced with a local embedding model
   */
  private async generateFallbackEmbedding(text: string): Promise<number[]> {
    console.info(`Generating fallback embedding for: "${text.substring(0, 30)}..."`)

    // Simple deterministic embedding based on text hash
    // In production, use a local model like sentence-transformers
    const hash = this.simpleHash(text)
    const dimensions = 1536 // Standard Azure OpenAI dimension

    const embedding = new Array(dimensions).fill(0)

    // Generate pseudo-embedding from text hash
    for (let i = 0; i < dimensions; i++) {
      const seed = hash + i
      embedding[i] = (Math.sin(seed) * 10000) % 2 - 1 // Values between -1 and 1
    }

    // Normalize the vector
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0))
    return embedding.map(val => val / magnitude)
  }

  /**
   * Simple hash function for consistent embeddings
   */
  private simpleHash(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32bit integer
    }
    return Math.abs(hash)
  }

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Set custom fallback embedding function
   */
  setFallbackEmbedding(fallbackFn: () => Promise<number[]>): void {
    this._fallbackEmbedding = fallbackFn
  }

  /**
   * Enable/disable circuit breaker for testing
   */
  setCircuitBreakerEnabled(enabled: boolean): void {
    if (enabled) {
      console.info(`Circuit breaker enabled for ${this.serviceName}`)
    } else {
      console.info(`Circuit breaker disabled for ${this.serviceName}`)
      // Force circuit closed when disabled
      const circuitBreaker = circuitBreakerManager.getCircuitBreaker(this.serviceName)
      circuitBreaker.forceState('CLOSED' as any)
    }
  }
}

/**
 * Factory function to create resilient embedding service
 */
export function createResilientAzureEmbeddingService(config?: {
  apiKey?: string
  endpoint?: string
  deploymentName?: string
  apiVersion?: string
}): ResilientAzureEmbeddingService {
  const {
    apiKey = process.env.AZURE_OPENAI_API_KEY || '',
    endpoint = process.env.AZURE_OPENAI_ENDPOINT || '',
    deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME || '',
    apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2023-05-15'
  } = config || {}

  return new ResilientAzureEmbeddingService({
    apiKey,
    endpoint,
    deploymentName,
    apiVersion
  })
}
