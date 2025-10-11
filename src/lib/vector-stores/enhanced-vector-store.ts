/**
 * Enhanced Vector Store
 * Unified interface supporting both PostgreSQL pgvector and Weaviate
 * Provides intelligent fallback, performance optimization, and hybrid search capabilities
 */

import { vectorStore as pgVectorStore } from '../vector-store'
import { weaviateStore } from './weaviate-client'
import type { WeaviateSearchOptions } from './weaviate-client'
import { mlflowClient } from '../mlflow/mlflow-client'
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> merge-conflict-cleanup
import { vectorQueryCache } from './query-cache'
import { getMetricsCollector } from '../db/database-metrics'

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
=======
import { VectorMetricsCollector } from '../vector-db/VectorMetricsCollector'
import { vectorQueryCache } from './query-cache'
import { getMetricsCollector } from '../db/database-metrics'
>>>>>>> fix/consolidated-dependency-updates

/**
 * Enhanced Vector Store
 * Provides unified interface for multiple vector database providers
 */
export class EnhancedVectorStore {
  private providers: Map<string, boolean> = new Map()
  private lastHealthCheck: number = 0
<<<<<<< HEAD
  private healthCheckInterval: number = 300000 // 5 minutes
  private dbMetricsCollector = getMetricsCollector()

  constructor() {
<<<<<<< HEAD
    this.initializeProviders()
=======
  private healthCheckInterval: number = 30000 // 30 seconds

  constructor() {
>>>>>>> fix/consolidated-dependency-updates
=======
<<<<<<< HEAD
    this.metricsCollector = new VectorMetricsCollector()

  constructor() {
=======
>>>>>>> main
    this.initializeProviders()
>>>>>>> merge-conflict-cleanup
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
      } catch {
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
      } catch {
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
<<<<<<< HEAD
<<<<<<< HEAD
   * Enhanced intelligent provider selection with advanced performance analysis
=======
   * Enhanced intelligent provider selection with advanced performance analysis
<<<<<<< HEAD
   * Intelligent provider selection
=======
>>>>>>> main
>>>>>>> merge-conflict-cleanup
   */
=======
   * Enhanced intelligent provider selection with advanced performance analysis   */
>>>>>>> fix/consolidated-dependency-updates
  private selectProvider(options: UnifiedSearchOptions): 'pgvector' | 'weaviate' {
    if (options.provider && options.provider !== 'auto') {
      return options.provider
    }

    // Auto-select based on capabilities and availability
    const weaviateAvailable = this.providers.get('weaviate')
    const pgvectorAvailable = this.providers.get('pgvector')

    // If only one provider is available, use it
    if (!weaviateAvailable && pgvectorAvailable) return 'pgvector'
    if (!pgvectorAvailable && weaviateAvailable) return 'weaviate'
    if (!weaviateAvailable && !pgvectorAvailable) {
      // Default to pgvector to maintain basic functionality when availability is unknown
      return 'pgvector'
    }

    // Performance-based selection with recent metrics weighted more heavily
    const pgvectorPerf = this.getWeightedAvgMetric('pgvector_query_time', 150)
    const weaviatePerf = this.getWeightedAvgMetric('weaviate_query_time', 100)
    
    // Error rate consideration
    const pgvectorErrors = this.getAvgMetric('pgvector_errors', 0)
    const weaviateErrors = this.getAvgMetric('weaviate_errors', 0)

    // Prefer Weaviate for advanced features (mandatory)
<<<<<<< HEAD
=======
<<<<<<< HEAD
    // Prefer Weaviate for advanced features
=======
>>>>>>> main
>>>>>>> merge-conflict-cleanup
    if (weaviateAvailable && (
      options.searchType === 'hybrid' || 
      options.searchType === 'generative' ||
      options.generativePrompt
    )) {
      return 'weaviate'
    }

    // For workspace-specific queries, prefer pgvector (better tenant isolation)
    if (options.workspaceId && pgvectorAvailable) {
      // But only if pgvector performance is reasonable
      if (pgvectorPerf < weaviatePerf * 1.5 && pgvectorErrors < weaviateErrors * 2) {
        return 'pgvector'
      }
    }

    // For file-specific queries, prefer pgvector (better filtering)
    if (options.fileIds && options.fileIds.length > 0 && pgvectorAvailable) {
      // But consider performance trade-offs
      if (pgvectorPerf < weaviatePerf * 1.8 && pgvectorErrors < weaviateErrors * 2) {
        return 'pgvector'
      }
    }

    // For large result sets, prefer the provider with better throughput
    if (options.limit && options.limit > 50) {
      // Consider both speed and error rates for large queries
      const pgvectorScore = this.calculateProviderScore(pgvectorPerf, pgvectorErrors, 'large_query')
      const weaviateScore = this.calculateProviderScore(weaviatePerf, weaviateErrors, 'large_query')
      
      return pgvectorScore > weaviateScore ? 'pgvector' : 'weaviate'
    }

    // For small, frequent queries, prefer the provider with lower latency
    if (!options.limit || options.limit <= 10) {
      const pgvectorScore = this.calculateProviderScore(pgvectorPerf, pgvectorErrors, 'small_query')
      const weaviateScore = this.calculateProviderScore(weaviatePerf, weaviateErrors, 'small_query')
      
      return pgvectorScore > weaviateScore ? 'pgvector' : 'weaviate'
    }

    // Default: comprehensive provider scoring
    const pgvectorScore = this.calculateProviderScore(pgvectorPerf, pgvectorErrors, 'default')
    const weaviateScore = this.calculateProviderScore(weaviatePerf, weaviateErrors, 'default')
    
    return pgvectorScore > weaviateScore ? 'pgvector' : 'weaviate'
  }

  /**
   * Calculate comprehensive provider performance score
   */
  private calculateProviderScore(avgTime: number, errorRate: number, queryType: 'large_query' | 'small_query' | 'default'): number {
    // Base score from speed (lower time = higher score)
    const speedScore = Math.max(0, 1000 - avgTime) / 1000

    // Error penalty (fewer errors = higher score)
    const errorScore = Math.max(0, 1 - errorRate)

    // Query type specific weights
    let speedWeight = 0.7
    let errorWeight = 0.3

    if (queryType === 'large_query') {
      // For large queries, prioritize reliability over speed
      speedWeight = 0.5
      errorWeight = 0.5
    } else if (queryType === 'small_query') {
      // For small queries, prioritize speed
      speedWeight = 0.8
      errorWeight = 0.2
    }

    return (speedScore * speedWeight) + (errorScore * errorWeight)
  }

  /**
   * Get weighted average metric (recent values weighted more heavily)
   */
  private getWeightedAvgMetric(key: string, defaultValue: number): number {
    const metrics = this.performanceMetrics.get(key)
    if (!metrics || metrics.length === 0) {
      return defaultValue
    }

    // Apply exponential decay weighting (recent values have higher weight)
    let weightedSum = 0
    let totalWeight = 0
    
    for (let i = 0; i < metrics.length; i++) {
      const weight = Math.pow(1.1, i) // Recent measurements weighted more heavily
      weightedSum += metrics[i] * weight
      totalWeight += weight
    }

    return weightedSum / totalWeight
  }

  /**
   * Unified search across providers with intelligent routing and caching
<<<<<<< HEAD
=======
<<<<<<< HEAD
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
=======
>>>>>>> main
>>>>>>> merge-conflict-cleanup
   */
  async search(options: UnifiedSearchOptions): Promise<UnifiedSearchResult[]> {
    const startTime = Date.now()
    let provider: 'pgvector' | 'weaviate' | undefined
    let results: UnifiedSearchResult[] = []

    try {
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> merge-conflict-cleanup
      // Ensure providers are initialized at first use
      if (!this.providers.has('pgvector') && !this.providers.has('weaviate')) {
        await this.initializeProviders()
        this.lastHealthCheck = Date.now()
      }

<<<<<<< HEAD
=======
>>>>>>> fix/consolidated-dependency-updates
=======
>>>>>>> merge-conflict-cleanup
      // Check cache first
      const cachedResults = vectorQueryCache.getCachedResults(options.query, options)
      if (cachedResults) {
        // Record cache hit for monitoring
        this.dbMetricsCollector.recordVectorSearch('pgvector', Date.now() - startTime, cachedResults.length, true)
        return cachedResults
      }

<<<<<<< HEAD
<<<<<<< HEAD
=======
      // Select provider based on options and performance
>>>>>>> fix/consolidated-dependency-updates
=======
>>>>>>> merge-conflict-cleanup
      provider = this.selectProvider(options)

      // Execute search with selected provider
      if (provider === 'pgvector') {
        results = await this.searchPgVector(options)
      } else if (provider === 'weaviate') {
        results = await this.searchWeaviate(options)
      } else {
        throw new Error(`Unknown provider: ${provider}`)
      }

      // Cache results for future queries
      vectorQueryCache.cacheResults(options.query, options, results)

      // Track performance metrics
      const queryTime = Date.now() - startTime
      this.recordMetric(`${provider}_query_time`, queryTime)
      this.recordMetric('overall_query_time', queryTime)
      
      // Record vector search metrics for database monitoring
      this.dbMetricsCollector.recordVectorSearch(provider, queryTime, results.length, false)
      
<<<<<<< HEAD
<<<<<<< HEAD
      // Optional external metrics collector removed to simplify dependencies
=======
      // Collect metrics for monitoring
      try {
        this.metricsCollector.updateStorageMetrics(results.length, 0)
      } catch (e) {
        // Metrics collection is optional
      }
=======
      // Optional external metrics collector removed to simplify dependencies
>>>>>>> main
>>>>>>> merge-conflict-cleanup

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
      } catch {
        // MLflow tracking is optional
=======
      // Collect metrics for monitoring
      try {
        this.metricsCollector.updateStorageMetrics(results.length, 0)
      } catch (e) {
        // Metrics collection is optional
>>>>>>> fix/consolidated-dependency-updates
      }

      return results
    } catch (error) {
<<<<<<< HEAD
      this.recordMetric('error_rate', 1)
      this.recordMetric(`${provider}_errors`, 1)
      this.dbMetricsCollector.recordVectorError('search')
      
=======
>>>>>>> fix/consolidated-dependency-updates
      // Try fallback provider
      const fallbackProvider = provider === 'weaviate' ? 'pgvector' : 'weaviate'
      if (this.providers.get(fallbackProvider)) {
        console.warn(`${provider} search failed, trying fallback to ${fallbackProvider}`)
        
        // Record provider switch for monitoring
        this.dbMetricsCollector.recordProviderSwitch(provider || 'pgvector', fallbackProvider)
        
        try {
          if (fallbackProvider === 'pgvector') {
            return await this.searchPgVector(options)
          } else if (fallbackProvider === 'weaviate') {
            return await this.searchWeaviate(options)
          }
<<<<<<< HEAD

          const queryTime = Date.now() - startTime
          this.recordMetric(`${fallbackProvider}_query_time`, queryTime)
          this.dbMetricsCollector.recordVectorSearch(fallbackProvider, queryTime, results.length, false)
          return results
        } catch (fallbackError) {
          console.error('Fallback search also failed:', fallbackError)
          this.recordMetric(`${fallbackProvider}_errors`, 1)
          this.dbMetricsCollector.recordVectorError('search')
<<<<<<< HEAD
=======
        } catch (fallbackError) {
          console.error('Fallback provider also failed:', fallbackError)
>>>>>>> fix/consolidated-dependency-updates
=======
<<<<<<< HEAD
          return results
        } catch (fallbackError) {
          console.error('Fallback search also failed:', fallbackError)
=======
>>>>>>> main
>>>>>>> merge-conflict-cleanup
        }
      }

      throw error
    }
  }

  /**
   * Search using PostgreSQL pgvector
   */
  private async searchPgVector(options: UnifiedSearchOptions): Promise<UnifiedSearchResult[]> {
    const searchResults = (await pgVectorStore.search(options.query, {
      workspaceId: options.workspaceId,
      fileIds: options.fileIds,
      limit: options.limit,
      threshold: options.threshold
    })) || []

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
    const searchOptions: WeaviateSearchOptions = {
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

    const searchResults = (await weaviateStore.search(searchOptions)) || []

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
<<<<<<< HEAD
<<<<<<< HEAD
   * Store documents with intelligent distribution and connection pool optimization
=======
   * Store documents with intelligent distribution and connection pool optimization
<<<<<<< HEAD
   * Store documents with intelligent distribution
=======
>>>>>>> main
>>>>>>> merge-conflict-cleanup
   */
=======
   * Store documents with intelligent distribution and connection pool optimization   */
>>>>>>> fix/consolidated-dependency-updates
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
<<<<<<< HEAD
<<<<<<< HEAD
    poolMetrics?: Record<string, unknown> | null
=======
    poolMetrics?: any
>>>>>>> fix/consolidated-dependency-updates
=======
<<<<<<< Updated upstream
    poolMetrics?: any
=======
    poolMetrics?: Record<string, unknown> | null
>>>>>>> main
>>>>>>> merge-conflict-cleanup
  }> {
    const results = {
      pgvector: false,
      weaviate: false,
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> merge-conflict-cleanup
      totalStored: 0,
      poolMetrics: null as Record<string, unknown> | null
    }

    // Store in PostgreSQL pgvector (primary store) with connection pool monitoring
    if (this.providers.get('pgvector')) {
      try {
        const startTime = Date.now()
        
        // Process in batches to optimize connection usage
        const batchSize = 5
        for (let i = 0; i < documents.length; i += batchSize) {
          const batch = documents.slice(i, i + batchSize)
          await pgVectorStore.storeChunks(batch[0].fileId, batch.map(doc => ({
            content: doc.content,
            startLine: doc.startLine,
            endLine: doc.endLine,
            tokens: doc.tokens
          })))
        }
        
        const duration = Date.now() - startTime
        results.pgvector = true
        results.totalStored += documents.length
        
        // Record vector store metrics for database monitoring
        this.dbMetricsCollector.recordVectorStore(documents.length, 'pgvector', duration)
        
        // Collect connection pool metrics
        results.poolMetrics = {
          operation: 'store',
          duration,
          batchSize: Math.ceil(documents.length / batchSize),
          documentsProcessed: documents.length
        }
        
        console.log(`Stored ${documents.length} documents in ${duration}ms using ${Math.ceil(documents.length / batchSize)} batches`)
      } catch (error) {
        console.error('Failed to store in pgvector:', error)
        this.dbMetricsCollector.recordVectorError('store')
<<<<<<< HEAD
        results.poolMetrics = { error: (error as Error).message, operation: 'store' }
=======
=======
<<<<<<< HEAD
        results.poolMetrics = { error: error.message, operation: 'store' } as any
>>>>>>> merge-conflict-cleanup
      totalStored: 0
    }

    // Store in PostgreSQL pgvector (for basic vector search)
    if (this.providers.get('pgvector')) {
      try {
        const pgvectorStartTime = Date.now()
        await pgVectorStore.storeChunks(workspaceId, documents)
        const pgvectorDuration = Date.now() - pgvectorStartTime
        
        results.pgvector = true
        results.totalStored += documents.length
        
        // Record pgvector store metrics
        this.dbMetricsCollector.recordVectorStore(documents.length, 'pgvector', pgvectorDuration)
      } catch (error) {
        console.error('Failed to store in pgvector:', error)
<<<<<<< HEAD
        this.dbMetricsCollector.recordVectorError('store')
>>>>>>> fix/consolidated-dependency-updates
=======
=======
        results.poolMetrics = { error: (error as Error).message, operation: 'store' }
>>>>>>> main
>>>>>>> merge-conflict-cleanup
      }
    }

    // Store in Weaviate (for advanced search capabilities)

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

        const weaviateStartTime = Date.now()
        await weaviateStore.storeDocuments(weaviateDocuments)
        const weaviateDuration = Date.now() - weaviateStartTime
<<<<<<< HEAD
        
<<<<<<< HEAD
=======
<<<<<<< HEAD
        await weaviateStore.storeDocuments(weaviateDocuments)
=======
>>>>>>> main
>>>>>>> merge-conflict-cleanup
        results.weaviate = true
=======
                results.weaviate = true
>>>>>>> fix/consolidated-dependency-updates
        if (!results.pgvector) {
          results.totalStored += documents.length
        }
        
        // Record Weaviate store metrics
        this.dbMetricsCollector.recordVectorStore(documents.length, 'weaviate', weaviateDuration)
      } catch (error) {
        console.error('Failed to store in Weaviate:', error)
        this.dbMetricsCollector.recordVectorError('store')
<<<<<<< HEAD
=======
<<<<<<< HEAD
      } catch (error) {
        console.error('Failed to store in Weaviate:', error)
=======
>>>>>>> main
>>>>>>> merge-conflict-cleanup
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
   * Get provider selection insights for monitoring
   */
  getProviderSelectionInsights(): {
    pgvector: { score: number, avgTime: number, errorRate: number }
    weaviate: { score: number, avgTime: number, errorRate: number }
    recommendation: 'pgvector' | 'weaviate' | 'balanced'
  } {
    const pgvectorPerf = this.getWeightedAvgMetric('pgvector_query_time', 150)
    const weaviatePerf = this.getWeightedAvgMetric('weaviate_query_time', 100)
    const pgvectorErrors = this.getAvgMetric('pgvector_errors', 0)
    const weaviateErrors = this.getAvgMetric('weaviate_errors', 0)

    const pgvectorScore = this.calculateProviderScore(pgvectorPerf, pgvectorErrors, 'default')
    const weaviateScore = this.calculateProviderScore(weaviatePerf, weaviateErrors, 'default')

    let recommendation: 'pgvector' | 'weaviate' | 'balanced' = 'balanced'
    const scoreDiff = Math.abs(pgvectorScore - weaviateScore)
    
    if (scoreDiff > 0.2) {
      recommendation = pgvectorScore > weaviateScore ? 'pgvector' : 'weaviate'
    }

    return {
      pgvector: {
        score: Math.round(pgvectorScore * 100) / 100,
        avgTime: Math.round(pgvectorPerf),
        errorRate: Math.round(pgvectorErrors * 100) / 100
      },
      weaviate: {
        score: Math.round(weaviateScore * 100) / 100,
        avgTime: Math.round(weaviatePerf),
        errorRate: Math.round(weaviateErrors * 100) / 100
      },
      recommendation
    }
  }
<<<<<<< HEAD

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
=======
>>>>>>> fix/consolidated-dependency-updates
}

// Export singleton instance
export const enhancedVectorStore = new EnhancedVectorStore()
export default enhancedVectorStore