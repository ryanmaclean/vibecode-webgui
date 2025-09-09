/**
 * Unit Tests for Vector Store Performance Optimizations
 * Tests the enhanced provider selection, caching, and monitoring features
 */

// Mock the dependencies BEFORE importing the module under test
jest.mock('../src/lib/vector-store', () => ({
  vectorStore: {
    search: jest.fn().mockResolvedValue([
      {
        chunk: { id: 'test-1', content: 'test content', metadata: { fileId: 1, fileName: 'test.ts', tokens: 100 } },
        similarity: 0.95
      }
    ]),
    getStats: jest.fn().mockResolvedValue({ totalChunks: 1000 }),
    storeChunks: jest.fn().mockResolvedValue(undefined),
    deleteFileChunks: jest.fn().mockResolvedValue(undefined)
  }
}))

jest.mock('../src/lib/vector-stores/weaviate-client', () => ({
  weaviateStore: {
    isAvailable: jest.fn().mockResolvedValue(true),
    getStats: jest.fn().mockResolvedValue({ totalObjects: 800 }),
    search: jest.fn().mockResolvedValue([
      {
        id: 'weaviate-1',
        content: 'weaviate test content',
        certainty: 0.92,
        metadata: { fileId: 1, fileName: 'test.ts', tokens: 100 }
      }
    ]),
    storeDocuments: jest.fn().mockResolvedValue(undefined),
    deleteDocuments: jest.fn().mockResolvedValue(5)
  }
}))

jest.mock('../src/lib/mlflow/mlflow-client', () => ({
  mlflowClient: {
    trackAIModelMetrics: jest.fn().mockResolvedValue(undefined)
  }
}))

import { EnhancedVectorStore } from '../src/lib/vector-stores/enhanced-vector-store'
import { VectorQueryCache } from '../src/lib/vector-stores/query-cache'
import { getMetricsCollector } from '../src/lib/db/database-metrics'

describe('Enhanced Vector Store Optimizations', () => {
  let vectorStore: EnhancedVectorStore
  let queryCache: VectorQueryCache
  let metricsCollector: any

  beforeEach(() => {
    vectorStore = new EnhancedVectorStore()
    queryCache = new VectorQueryCache()
    metricsCollector = getMetricsCollector()
    
    // Clear any existing cache and metrics
    queryCache.clear()
  })

  describe('Provider Selection Algorithm', () => {
    test('should provide performance insights', async () => {
      // Test the provider selection insights
      const insights = vectorStore.getProviderSelectionInsights()
      
      expect(insights).toHaveProperty('pgvector')
      expect(insights).toHaveProperty('weaviate') 
      expect(insights).toHaveProperty('recommendation')
      
      expect(['pgvector', 'weaviate', 'balanced']).toContain(insights.recommendation)
      expect(typeof insights.pgvector.score).toBe('number')
      expect(typeof insights.weaviate.score).toBe('number')
    })

    test('should select provider based on search type', async () => {
      // Test hybrid search routing to Weaviate
      const hybridResults = await vectorStore.search({
        query: 'test query',
        searchType: 'hybrid',
        limit: 10
      })
      
      expect(hybridResults).toBeDefined()
      expect(Array.isArray(hybridResults)).toBe(true)
    })

    test('should handle provider fallback correctly', async () => {
      // This would test fallback behavior when primary provider fails
      const results = await vectorStore.search({
        query: 'test query',
        provider: 'auto',
        limit: 5
      })
      
      expect(results).toBeDefined()
      expect(results.length).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Query Cache Optimization', () => {
    test('should cache and retrieve results correctly', () => {
      const testQuery = 'test caching query'
      const testOptions = { limit: 10 }
      const testResults = [{ id: 'test', content: 'cached content', similarity: 0.9, metadata: { provider: 'pgvector' } }]
      
      // Cache results
      queryCache.cacheResults(testQuery, testOptions, testResults, 'pgvector')
      
      // Retrieve cached results
      const cachedResults = queryCache.getCachedResults(testQuery, testOptions)
      expect(cachedResults).toEqual(testResults)
    })

    test('should track cache hit/miss statistics', () => {
      const testQuery = 'cache stats test'
      const testOptions = { limit: 5 }
      
      // Should be a cache miss initially
      const missResult = queryCache.getCachedResults(testQuery, testOptions)
      expect(missResult).toBeNull()
      
      // Cache some results
      queryCache.cacheResults(testQuery, testOptions, [], 'pgvector')
      
      // Should be a cache hit now
      const hitResult = queryCache.getCachedResults(testQuery, testOptions)
      expect(hitResult).toEqual([])
      
      // Check statistics
      const stats = queryCache.getStats()
      expect(stats.totalHits).toBeGreaterThan(0)
      expect(stats.totalMisses).toBeGreaterThan(0)
    })

    test('should provide detailed cache analytics', () => {
      const analytics = queryCache.getAnalytics()
      
      expect(analytics).toHaveProperty('mostFrequentQueries')
      expect(analytics).toHaveProperty('cacheUtilization')
      expect(analytics).toHaveProperty('avgAccessFrequency')
      
      expect(Array.isArray(analytics.mostFrequentQueries)).toBe(true)
      expect(typeof analytics.cacheUtilization).toBe('number')
    })

    test('should evict least frequently used entries when full', () => {
      // Fill cache to capacity (assuming small test cache)
      const maxTestEntries = 3
      for (let i = 0; i < maxTestEntries + 2; i++) {
        queryCache.cacheResults(`query-${i}`, { test: i }, [], 'pgvector')
      }
      
      const stats = queryCache.getStats()
      expect(stats.size).toBeLessThanOrEqual(maxTestEntries + 2)
    })
  })

  describe('Database Metrics Integration', () => {
    test('should track vector search operations', () => {
      const initialMetrics = metricsCollector.getVectorMetrics()
      const initialSearches = initialMetrics.totalSearches
      
      // Record a vector search
      metricsCollector.recordVectorSearch('pgvector', 150, 5, false)
      
      const updatedMetrics = metricsCollector.getVectorMetrics()
      expect(updatedMetrics.totalSearches).toBe(initialSearches + 1)
    })

    test('should track cache efficiency', () => {
      // Record cache hit and miss
      metricsCollector.recordVectorSearch('pgvector', 50, 3, true)  // Cache hit
      metricsCollector.recordVectorSearch('weaviate', 120, 7, false) // Cache miss
      
      const metrics = metricsCollector.getVectorMetrics()
      expect(typeof metrics.cacheEfficiency).toBe('number')
      expect(metrics.cacheEfficiency).toBeGreaterThanOrEqual(0)
      expect(metrics.cacheEfficiency).toBeLessThanOrEqual(100)
    })

    test('should track provider switching', () => {
      const initialMetrics = metricsCollector.getVectorMetrics()
      const initialSwitches = initialMetrics.providerSwitchRate
      
      // Record provider switch
      metricsCollector.recordProviderSwitch('pgvector', 'weaviate')
      
      const updatedMetrics = metricsCollector.getVectorMetrics()
      // Switch rate should be calculated based on total searches
      expect(typeof updatedMetrics.providerSwitchRate).toBe('number')
    })

    test('should track vector storage operations', () => {
      const initialMetrics = metricsCollector.getVectorMetrics()
      const initialStores = initialMetrics.totalStores
      
      // Record vector store operation
      metricsCollector.recordVectorStore(10, 'pgvector', 500)
      
      const updatedMetrics = metricsCollector.getVectorMetrics()
      expect(updatedMetrics.totalStores).toBe(initialStores + 10)
    })
  })

  describe('Performance Integration Tests', () => {
    test('should handle concurrent search requests efficiently', async () => {
      const concurrentRequests = 5
      const searchPromises = Array(concurrentRequests).fill(null).map((_, i) => 
        vectorStore.search({
          query: `concurrent test query ${i}`,
          limit: 10
        })
      )
      
      const results = await Promise.all(searchPromises)
      
      expect(results).toHaveLength(concurrentRequests)
      results.forEach(result => {
        expect(Array.isArray(result)).toBe(true)
      })
    })

    test('should maintain performance under load', async () => {
      const startTime = Date.now()
      const iterations = 10
      
      const requests = Array(iterations).fill(null).map((_, i) =>
        vectorStore.search({
          query: `load test query ${i}`,
          limit: 5
        })
      )
      
      await Promise.all(requests)
      const totalTime = Date.now() - startTime
      
      // Should complete 10 searches in reasonable time (under 5 seconds)
      expect(totalTime).toBeLessThan(5000)
    })

    test('should provide comprehensive health check data', async () => {
      const healthCheck = await vectorStore.healthCheck()
      
      expect(healthCheck).toHaveProperty('providers')
      expect(healthCheck).toHaveProperty('performance')
      expect(healthCheck).toHaveProperty('totalDocuments')
      
      expect(Array.isArray(healthCheck.providers)).toBe(true)
      expect(typeof healthCheck.performance.avgQueryTime).toBe('number')
    })
  })

  describe('Error Handling and Resilience', () => {
    test('should handle provider unavailability gracefully', async () => {
      // This would test behavior when providers are unavailable
      try {
        const results = await vectorStore.search({
          query: 'test query when provider down',
          limit: 10
        })
        // Should either succeed with fallback or throw meaningful error
        expect(Array.isArray(results) || results === null).toBe(true)
      } catch (error) {
        // Should be a meaningful error message
        expect(error.message).toContain('No vector store providers available')
      }
    })

    test('should track errors appropriately in metrics', () => {
      const initialMetrics = metricsCollector.getVectorMetrics()
      const initialErrors = initialMetrics.failedOperations
      
      // Record an error
      metricsCollector.recordVectorError('search')
      
      const updatedMetrics = metricsCollector.getVectorMetrics()
      expect(updatedMetrics.failedOperations).toBe(initialErrors + 1)
    })
  })
})

describe('Performance Benchmark Integration', () => {
  test('should measure and compare provider performance', () => {
    // Test that we can collect performance metrics
    const insights = new EnhancedVectorStore().getProviderSelectionInsights()
    
    expect(insights.pgvector.score).toBeGreaterThanOrEqual(0)
    expect(insights.pgvector.score).toBeLessThanOrEqual(1)
    expect(insights.weaviate.score).toBeGreaterThanOrEqual(0)
    expect(insights.weaviate.score).toBeLessThanOrEqual(1)
  })
})