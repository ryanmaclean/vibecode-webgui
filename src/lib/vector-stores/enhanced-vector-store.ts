/**
 * Enhanced Vector Store
 * Unified interface supporting both PostgreSQL pgvector and Weaviate
 * Provides intelligent fallback, performance optimization, and hybrid search capabilities
 */

import { vectorStore as pgVectorStore } from '../vector-store'
import { weaviateStore } from './weaviate-client'
import { mlflowClient } from '../mlflow/mlflow-client'
import { VectorMetricsCollector } from '../vector-db/VectorMetricsCollector'

export interface VectorStoreProvider {
  id: 'pgvector' | 'weaviate'
  name: string
  available: boolean
  features: {
    semanticSearch: boolean
    hybridSearch: boolean
    generativeSearch: boolean
    clustering: boolean
    multiTenancy: boolean
  }
  performance: {
    avgQueryTime: number
    indexSize: number
    throughput: number
  }
}

export interface UnifiedSearchOptions {
  query: string
  workspaceId?: number
  fileIds?: number[]
  limit?: number
  threshold?: number
  provider?: 'pgvector' | 'weaviate' | 'auto'
  searchType?: 'semantic' | 'hybrid' | 'generative'
  generativePrompt?: string
}

export interface UnifiedSearchResult {
  id: string
  content: string
  similarity: number
  metadata: {
    fileId: number
    fileName: string
    startLine?: number
    endLine?: number
    language?: string
    tokens: number
    provider: 'pgvector' | 'weaviate'
  }
  generatedText?: string
}

export interface VectorStoreStats {
  providers: VectorStoreProvider[]
  totalDocuments: number
  totalWorkspaces: number
  storageUsed: string
  performance: {
    avgQueryTime: number
    queriesPerSecond: number
    errorRate: number
  }
}

export class EnhancedVectorStore {
  private providers: Map<'pgvector' | 'weaviate', boolean> = new Map()
  private performanceMetrics: Map<string, number[]> = new Map()
  private lastHealthCheck: number = 0
  private healthCheckInterval: number = 300000 // 5 minutes
  private metricsCollector: VectorMetricsCollector

  constructor() {
    this.metricsCollector = new VectorMetricsCollector()
    this.initializeProviders()
  }

  /**
   * Initialize and check availability of all providers
   */
  private async initializeProviders(): Promise<void> {
    try {
      // Check PostgreSQL pgvector
      const pgStats = await pgVectorStore.getStats()
      this.providers.set('pgvector', pgStats.totalChunks >= 0)
    } catch (error) {
      console.warn('PostgreSQL pgvector not available:', error)
      this.providers.set('pgvector', false)
    }

    try {
      // Check Weaviate
      const weaviateAvailable = await weaviateStore.isAvailable()
      this.providers.set('weaviate', weaviateAvailable)
    } catch (error) {
      console.warn('Weaviate not available:', error)
      this.providers.set('weaviate', false)
    }
  }

  /**
   * Health check for all providers
   */
  async healthCheck(): Promise<VectorStoreStats> {
    const now = Date.now()
    if (now - this.lastHealthCheck < this.healthCheckInterval) {
      // Use cached results if recent
    } else {
      await this.initializeProviders()
      this.lastHealthCheck = now
    }

    const providers: VectorStoreProvider[] = []
    let totalDocuments = 0

    // PostgreSQL pgvector stats
    if (this.providers.get('pgvector')) {
      try {
        const pgStats = await pgVectorStore.getStats()
        providers.push({
          id: 'pgvector',
          name: 'PostgreSQL pgvector',
          available: true,
          features: {
            semanticSearch: true,
            hybridSearch: false,
            generativeSearch: false,
            clustering: false,
            multiTenancy: true
          },
          performance: {
            avgQueryTime: this.getAvgMetric('pgvector_query_time', 150),
            indexSize: pgStats.totalChunks,
            throughput: this.getAvgMetric('pgvector_throughput', 50)
          }
        })
        totalDocuments += pgStats.totalChunks
      } catch (error) {
        providers.push({
          id: 'pgvector',
          name: 'PostgreSQL pgvector',
          available: false,
          features: {
            semanticSearch: false,
            hybridSearch: false,
            generativeSearch: false,
            clustering: false,
            multiTenancy: false
          },
          performance: {
            avgQueryTime: 0,
            indexSize: 0,
            throughput: 0
          }
        })
      }
    }

    // Weaviate stats
    if (this.providers.get('weaviate')) {
      try {
        const weaviateStats = await weaviateStore.getStats()
        providers.push({
          id: 'weaviate',
          name: 'Weaviate',
          available: true,
          features: {
            semanticSearch: true,
            hybridSearch: true,
            generativeSearch: true,
            clustering: true,
            multiTenancy: true
          },
          performance: {
            avgQueryTime: this.getAvgMetric('weaviate_query_time', 100),
            indexSize: weaviateStats.totalObjects,
            throughput: this.getAvgMetric('weaviate_throughput', 75)
          }
        })
        totalDocuments += weaviateStats.totalObjects
      } catch (error) {
        providers.push({
          id: 'weaviate',
          name: 'Weaviate',
          available: false,
          features: {
            semanticSearch: false,
            hybridSearch: false,
            generativeSearch: false,
            clustering: false,
            multiTenancy: false
          },
          performance: {
            avgQueryTime: 0,
            indexSize: 0,
            throughput: 0
          }
        })
      }
    }

    return {
      providers,
      totalDocuments,
      totalWorkspaces: 0, // Would need cross-provider query
      storageUsed: this.formatSize(totalDocuments * 2000), // Rough estimate
      performance: {
        avgQueryTime: this.getAvgMetric('overall_query_time', 125),
        queriesPerSecond: this.getAvgMetric('queries_per_second', 10),
        errorRate: this.getAvgMetric('error_rate', 0.01)
      }
    }
  }

  /**
   * Intelligent provider selection
   */
  private selectProvider(options: UnifiedSearchOptions): 'pgvector' | 'weaviate' {
    if (options.provider && options.provider !== 'auto') {
      return options.provider
    }

    // Auto-select based on capabilities and availability
    const weaviateAvailable = this.providers.get('weaviate')
    const pgvectorAvailable = this.providers.get('pgvector')

    // Prefer Weaviate for advanced features
    if (weaviateAvailable && (
      options.searchType === 'hybrid' || 
      options.searchType === 'generative' ||
      options.generativePrompt
    )) {
      return 'weaviate'
    }

    // Prefer pgvector for simple semantic search (faster, more reliable)
    if (pgvectorAvailable && options.searchType !== 'hybrid' && !options.generativePrompt) {
      return 'pgvector'
    }

    // Fallback to any available provider
    if (weaviateAvailable) return 'weaviate'
    if (pgvectorAvailable) return 'pgvector'

    throw new Error('No vector store providers available')
  }

  /**
   * Unified search across providers with intelligent routing
   */
  async search(options: UnifiedSearchOptions): Promise<UnifiedSearchResult[]> {
    const startTime = Date.now()
    let provider: 'pgvector' | 'weaviate' | undefined
    let results: UnifiedSearchResult[] = []

    try {
      provider = this.selectProvider(options)

      if (provider === 'weaviate') {
        results = await this.searchWeaviate(options)
      } else {
        results = await this.searchPgVector(options)
      }

      // Track performance metrics
      const queryTime = Date.now() - startTime
      this.recordMetric(`${provider}_query_time`, queryTime)
      this.recordMetric('overall_query_time', queryTime)
      
      // Collect metrics for monitoring - simplified
      try {
        this.metricsCollector.updateStorageMetrics(results.length, 0)
      } catch (e) {
        // Metrics collection is optional
      }

      // Track with MLflow if available
      try {
        await mlflowClient.trackAIModelMetrics({
          modelName: 'vector-search',
          provider: provider,
          endpoint: 'unified-search',
          requestCount: 1,
          avgResponseTime: queryTime,
          errorRate: 0,
          tokenUsage: {
            promptTokens: options.query.length / 4,
            completionTokens: 0,
            totalTokens: options.query.length / 4
          },
          costEstimate: 0.001,
          timestamp: Date.now()
        })
      } catch (mlflowError) {
        // MLflow tracking is optional
      }

      return results
    } catch (error) {
      this.recordMetric('error_rate', 1)
      
      // Try fallback provider
      const fallbackProvider = provider === 'weaviate' ? 'pgvector' : 'weaviate'
      if (this.providers.get(fallbackProvider)) {
        console.warn(`${provider} search failed, trying fallback to ${fallbackProvider}`)
        
        try {
          if (fallbackProvider === 'weaviate') {
            results = await this.searchWeaviate(options)
          } else {
            results = await this.searchPgVector(options)
          }

          const queryTime = Date.now() - startTime
          this.recordMetric(`${fallbackProvider}_query_time`, queryTime)
          return results
        } catch (fallbackError) {
          console.error('Fallback search also failed:', fallbackError)
        }
      }

      throw error
    }
  }

  /**
   * Search using PostgreSQL pgvector
   */
  private async searchPgVector(options: UnifiedSearchOptions): Promise<UnifiedSearchResult[]> {
    const searchResults = await pgVectorStore.search(options.query, {
      workspaceId: options.workspaceId,
      fileIds: options.fileIds,
      limit: options.limit,
      threshold: options.threshold
    })

    return searchResults.map(result => ({
      id: result.chunk.id,
      content: result.chunk.content,
      similarity: result.similarity,
      metadata: {
        ...result.chunk.metadata,
        provider: 'pgvector' as const
      }
    }))
  }

  /**
   * Search using Weaviate
   */
  private async searchWeaviate(options: UnifiedSearchOptions): Promise<UnifiedSearchResult[]> {
    const searchOptions: any = {
      query: options.query,
      limit: options.limit,
      certainty: options.threshold,
      workspaceId: options.workspaceId,
      fileIds: options.fileIds,
      hybrid: options.searchType === 'hybrid'
    }

    if (options.searchType === 'generative' && options.generativePrompt) {
      searchOptions.generative = {
        singlePrompt: options.generativePrompt
      }
    }

    const searchResults = await weaviateStore.search(searchOptions)

    return searchResults.map(result => ({
      id: result.id,
      content: result.content,
      similarity: result.certainty,
      metadata: {
        ...result.metadata,
        provider: 'weaviate' as const
      },
      generatedText: result.generatedText
    }))
  }

  /**
   * Store documents with intelligent distribution
   */
  async storeDocuments(
    workspaceId: number, 
    documents: Array<{
      content: string
      fileName: string
      filePath: string
      language?: string
      fileId: number
      startLine?: number
      endLine?: number
      tokens: number
    }>
  ): Promise<{
    pgvector: boolean
    weaviate: boolean
    totalStored: number
  }> {
    const results = {
      pgvector: false,
      weaviate: false,
      totalStored: 0
    }

    // Store in PostgreSQL pgvector (primary store)
    if (this.providers.get('pgvector')) {
      try {
        await pgVectorStore.storeChunks(documents[0].fileId, documents.map(doc => ({
          content: doc.content,
          startLine: doc.startLine,
          endLine: doc.endLine,
          tokens: doc.tokens
        })))
        results.pgvector = true
        results.totalStored += documents.length
      } catch (error) {
        console.error('Failed to store in pgvector:', error)
      }
    }

    // Store in Weaviate (for advanced search capabilities)
    if (this.providers.get('weaviate')) {
      try {
        const weaviateDocuments = documents.map((doc, index) => ({
          id: `${workspaceId}-${doc.fileId}-${index}`,
          content: doc.content,
          metadata: {
            fileName: doc.fileName,
            filePath: doc.filePath,
            language: doc.language,
            fileId: doc.fileId,
            workspaceId: workspaceId,
            startLine: doc.startLine,
            endLine: doc.endLine,
            tokens: doc.tokens,
            chunkIndex: index,
            createdAt: new Date().toISOString()
          }
        }))

        await weaviateStore.storeDocuments(weaviateDocuments)
        results.weaviate = true
        if (!results.pgvector) {
          results.totalStored += documents.length
        }
      } catch (error) {
        console.error('Failed to store in Weaviate:', error)
      }
    }

    return results
  }

  /**
   * Delete documents from all providers
   */
  async deleteDocuments(options: {
    workspaceId?: number
    fileIds?: number[]
  }): Promise<{
    pgvector: number
    weaviate: number
    totalDeleted: number
  }> {
    const results = {
      pgvector: 0,
      weaviate: 0,
      totalDeleted: 0
    }

    // Delete from PostgreSQL pgvector
    if (this.providers.get('pgvector') && options.fileIds) {
      try {
        for (const fileId of options.fileIds) {
          await pgVectorStore.deleteFileChunks(fileId)
          results.pgvector++
        }
      } catch (error) {
        console.error('Failed to delete from pgvector:', error)
      }
    }

    // Delete from Weaviate
    if (this.providers.get('weaviate')) {
      try {
        const deletedCount = await weaviateStore.deleteDocuments(options)
        results.weaviate = deletedCount
      } catch (error) {
        console.error('Failed to delete from Weaviate:', error)
      }
    }

    results.totalDeleted = Math.max(results.pgvector, results.weaviate)
    return results
  }

  /**
   * Record performance metric
   */
  private recordMetric(key: string, value: number): void {
    if (!this.performanceMetrics.has(key)) {
      this.performanceMetrics.set(key, [])
    }

    const metrics = this.performanceMetrics.get(key)!
    metrics.push(value)

    // Keep only last 100 measurements
    if (metrics.length > 100) {
      metrics.shift()
    }
  }

  /**
   * Get average metric value
   */
  private getAvgMetric(key: string, defaultValue: number): number {
    const metrics = this.performanceMetrics.get(key)
    if (!metrics || metrics.length === 0) {
      return defaultValue
    }

    return metrics.reduce((sum, val) => sum + val, 0) / metrics.length
  }

  /**
   * Format file size
   */
  private formatSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    let size = bytes
    let unitIndex = 0

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`
  }
}

// Export singleton instance
export const enhancedVectorStore = new EnhancedVectorStore()
export default enhancedVectorStore