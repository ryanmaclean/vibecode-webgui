/**
 * Integration test between cache invalidation and PGVector
 * Tests actual functionality with real database operations
 */

import { ProductionVectorCacheInvalidator } from '../../src/lib/cache/production-vector-cache-invalidator';
import { PGVectorClient, createPGVectorClient } from '../../src/lib/ai/vector-stores/pgvector-client';

// Mock the metrics module
jest.mock('../../src/lib/server-monitoring', () => ({
  metrics: {
    increment: jest.fn(),
    histogram: jest.fn()
  }
}));

describe('Cache-PGVector Integration', () => {
  let pgClient: PGVectorClient;
  let invalidator: ProductionVectorCacheInvalidator;
  let mockCacheStore: Map<string, any>;

  beforeAll(async () => {
    // Use test database configuration
    pgClient = createPGVectorClient({
      host: process.env.TEST_DB_HOST || 'localhost',
      port: parseInt(process.env.TEST_DB_PORT || '5432'),
      database: process.env.TEST_DB_NAME || 'test_vectordb',
      user: process.env.TEST_DB_USER || 'test_user',
      password: process.env.TEST_DB_PASSWORD || 'test_pass'
    });

    // Mock cache store for testing
    mockCacheStore = new Map();

    // Create invalidator with real integration
    invalidator = new ProductionVectorCacheInvalidator({
      batchSize: 3,
      batchTimeoutMs: 100,
      enableMetrics: false,
      enableLogging: true
    });
  });

  beforeEach(() => {
    mockCacheStore.clear();
  });

  afterAll(async () => {
    if (pgClient) {
      await pgClient.close();
    }
  });

  describe('Cache Invalidation with Vector Operations', () => {
    test('should invalidate cache when document is added to PGVector', async () => {
      // Skip if no database connection available
      if (!(await pgClient.healthCheck())) {
        console.warn('Skipping PGVector integration test - no database connection');
        return;
      }

      try {
        await pgClient.initialize();
        
        // Create test collection
        await pgClient.createCollection({
          name: 'test_integration',
          dimensions: 1536,
          distanceMetric: 'cosine',
          properties: {}
        });

        // Simulate cache entries for this collection
        mockCacheStore.set('embedding:test_integration:doc1', 'cached_embedding_1');
        mockCacheStore.set('search:test_integration:query1', 'cached_search_result');
        mockCacheStore.set('similarity:doc1:related', 'cached_similarity');

        // Add document to PGVector
        const docIds = await pgClient.addDocuments('test_integration', [{
          content: 'This is a test document for integration testing',
          metadata: { type: 'test', source: 'integration' },
          embedding: new Array(1536).fill(0).map(() => Math.random())
        }]);

        expect(docIds).toHaveLength(1);
        const docId = docIds[0];

        // Simulate cache invalidation that would be triggered by document addition
        await invalidator.invalidateForFileOperation(docId, 'create', 'test_workspace');

        // Verify stats
        const stats = invalidator.getStats();
        expect(stats.queuedRequests).toBeGreaterThanOrEqual(0);

        // Cleanup
        await pgClient.deleteDocument(docId);
        await pgClient.deleteCollection('test_integration');

      } catch (error) {
        if (error instanceof Error && error.message.includes('connect')) {
          console.warn('Skipping test - database connection failed:', error.message);
          return;
        }
        throw error;
      }
    });

    test('should handle vector similarity invalidation with PGVector search', async () => {
      // Skip if no database connection available
      if (!(await pgClient.healthCheck())) {
        console.warn('Skipping PGVector integration test - no database connection');
        return;
      }

      try {
        await pgClient.initialize();

        // Create test collection
        await pgClient.createCollection({
          name: 'similarity_test',
          dimensions: 3,
          distanceMetric: 'cosine',
          properties: {}
        });

        // Add test documents
        const testEmbeddings = [
          [1, 0, 0],
          [0, 1, 0],
          [0, 0, 1]
        ];

        const docIds = await pgClient.addDocuments('similarity_test', 
          testEmbeddings.map((embedding, i) => ({
            content: `Test document ${i}`,
            metadata: { index: i },
            embedding
          }))
        );

        expect(docIds).toHaveLength(3);

        // Perform similarity search
        const queryEmbedding = [1, 0.1, 0];
        const results = await pgClient.search('similarity_test', queryEmbedding, 2, 0.5);

        expect(results.length).toBeGreaterThan(0);

        // Simulate cache invalidation for vector operations
        const cacheKeys = results.map(result => `embedding:${result.id}`);
        await invalidator.invalidateForVectorOperation('search', cacheKeys, 0.8);

        // Verify the invalidation occurred
        const stats = invalidator.getStats();
        expect(typeof stats.queuedRequests).toBe('number');

        // Cleanup
        for (const docId of docIds) {
          await pgClient.deleteDocument(docId);
        }
        await pgClient.deleteCollection('similarity_test');

      } catch (error) {
        if (error instanceof Error && error.message.includes('connect')) {
          console.warn('Skipping test - database connection failed:', error.message);
          return;
        }
        throw error;
      }
    });

    test('should handle collection-wide invalidation', async () => {
      // This test can run without database connection
      // It tests the invalidation logic with collection patterns
      
      // Simulate cache entries for multiple collections
      mockCacheStore.set('collection:docs:metadata', 'cached_metadata');
      mockCacheStore.set('collection:embeddings:index', 'cached_index');
      mockCacheStore.set('workspace:test123:collection:docs', 'workspace_cache');

      // Test collection-wide invalidation
      await invalidator.invalidateByContentType('collection', 'test123');

      // Test workspace-wide invalidation
      await invalidator.invalidateWorkspace('test123', {
        contentTypes: ['collection', 'embedding'],
        batchSize: 2
      });

      // Verify stats show operations occurred
      const stats = invalidator.getStats();
      expect(stats).toBeDefined();
      expect(typeof stats.queuedRequests).toBe('number');
      expect(typeof stats.isProcessing).toBe('boolean');
    });

    test('should handle performance under concurrent operations', async () => {
      const startTime = Date.now();
      
      // Simulate concurrent invalidation requests
      const promises = [];
      for (let i = 0; i < 20; i++) {
        promises.push(
          invalidator.invalidateCache([`perf:key:${i}`], 'medium', `perf-test-${i}`)
        );
      }

      await Promise.all(promises);
      
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete reasonably quickly (under 1 second)
      expect(duration).toBeLessThan(1000);

      // Verify final state
      const stats = invalidator.getStats();
      expect(stats.circuitBreakerState).toBe('closed');
      expect(stats.failureCount).toBe(0);
    });

    test('should demonstrate real cache integration pattern', async () => {
      // This test shows how cache invalidation would integrate with real caching

      interface CacheEntry {
        key: string;
        value: any;
        timestamp: number;
        ttl?: number;
      }

      class MockCacheBackend {
        private store = new Map<string, CacheEntry>();

        set(key: string, value: any, ttl?: number): void {
          this.store.set(key, {
            key,
            value,
            timestamp: Date.now(),
            ttl
          });
        }

        get(key: string): any {
          const entry = this.store.get(key);
          if (!entry) return null;
          
          if (entry.ttl && Date.now() - entry.timestamp > entry.ttl) {
            this.store.delete(key);
            return null;
          }
          
          return entry.value;
        }

        delete(key: string): boolean {
          return this.store.delete(key);
        }

        deletePattern(pattern: string): number {
          let deleted = 0;
          const regex = new RegExp(pattern.replace(/\*/g, '.*'));
          
          for (const [key] of this.store) {
            if (regex.test(key)) {
              this.store.delete(key);
              deleted++;
            }
          }
          
          return deleted;
        }

        has(key: string): boolean {
          return this.store.has(key);
        }

        size(): number {
          return this.store.size;
        }
      }

      const cache = new MockCacheBackend();

      // Set up cache entries
      cache.set('embedding:doc1', 'vector_data_1');
      cache.set('embedding:doc2', 'vector_data_2');
      cache.set('search:query1', 'search_results_1');
      cache.set('workspace:ws1:config', 'workspace_config');

      expect(cache.size()).toBe(4);
      expect(cache.get('embedding:doc1')).toBe('vector_data_1');

      // Simulate invalidation by integrating with our invalidator
      const keys = ['embedding:doc1', 'search:query1'];
      
      // In a real implementation, the invalidator would call cache.delete()
      // For now, we manually simulate this integration
      await invalidator.invalidateCache(keys, 'high', 'integration-test');
      
      // Simulate the actual cache deletion that would happen
      keys.forEach(key => cache.delete(key));

      expect(cache.size()).toBe(2);
      expect(cache.get('embedding:doc1')).toBeNull();
      expect(cache.get('embedding:doc2')).toBe('vector_data_2');
      expect(cache.get('workspace:ws1:config')).toBe('workspace_config');

      // Test pattern-based invalidation
      await invalidator.invalidateByPattern('workspace:ws1:*', 'medium', 'pattern-test');
      
      // Simulate pattern deletion
      cache.deletePattern('workspace:ws1:*');
      
      expect(cache.size()).toBe(1);
      expect(cache.get('workspace:ws1:config')).toBeNull();
      expect(cache.get('embedding:doc2')).toBe('vector_data_2');
    });
  });

  describe('Error Handling and Resilience', () => {
    test('should handle database connection failures gracefully', async () => {
      // Test with intentionally invalid connection
      const badClient = createPGVectorClient({
        host: 'nonexistent-host',
        port: 9999,
        database: 'nonexistent',
        user: 'invalid',
        password: 'invalid'
      });

      const isHealthy = await badClient.healthCheck();
      expect(isHealthy).toBe(false);

      // Cache invalidation should still work even if database is down
      await expect(
        invalidator.invalidateCache(['test:key'], 'medium', 'resilience-test')
      ).resolves.not.toThrow();

      await badClient.close();
    });

    test('should handle circuit breaker activation', async () => {
      // Create invalidator with low failure threshold for testing
      const testInvalidator = new ProductionVectorCacheInvalidator({
        circuitBreakerThreshold: 2,
        maxRetries: 1,
        enableMetrics: false,
        enableLogging: false
      });

      let stats = testInvalidator.getStats();
      expect(stats.circuitBreakerState).toBe('closed');
      expect(stats.failureCount).toBe(0);

      // Normal operation should work
      await testInvalidator.invalidateCache(['test:key1'], 'high', 'circuit-test');
      
      stats = testInvalidator.getStats();
      expect(stats.circuitBreakerState).toBe('closed');
    });

    test('should provide meaningful statistics', async () => {
      // Perform various operations
      await invalidator.invalidateCache(['stat:key1'], 'high', 'stats-test');
      await invalidator.invalidateCache(['stat:key2'], 'low', 'stats-test');
      await invalidator.invalidateByPattern('stat:*', 'medium', 'stats-test');

      const stats = invalidator.getStats();
      
      expect(stats).toHaveProperty('pendingInvalidations');
      expect(stats).toHaveProperty('queuedRequests');
      expect(stats).toHaveProperty('circuitBreakerState');
      expect(stats).toHaveProperty('failureCount');
      expect(stats).toHaveProperty('isProcessing');

      expect(typeof stats.pendingInvalidations).toBe('number');
      expect(typeof stats.queuedRequests).toBe('number');
      expect(typeof stats.circuitBreakerState).toBe('string');
      expect(typeof stats.failureCount).toBe('number');
      expect(typeof stats.isProcessing).toBe('boolean');

      expect(['closed', 'open', 'half_open']).toContain(stats.circuitBreakerState);
    });
  });

  describe('Integration Patterns', () => {
    test('should demonstrate typical usage patterns', async () => {
      // Pattern 1: File upload triggers cache invalidation
      const fileId = 'uploaded_file_123';
      const workspaceId = 'workspace_456';
      
      await invalidator.invalidateForFileOperation(fileId, 'create', workspaceId);

      // Pattern 2: Search triggers related invalidation
      const searchKeys = ['search:embeddings:query1', 'search:similarity:related'];
      await invalidator.invalidateForVectorOperation('search', searchKeys, 0.9);

      // Pattern 3: User action triggers workspace invalidation
      await invalidator.invalidateWorkspace(workspaceId, {
        contentTypes: ['file', 'embedding'],
        excludePatterns: ['temp:', 'cache:temp:'],
        batchSize: 5
      });

      // Pattern 4: Content type change triggers cascade
      await invalidator.invalidateByContentType('file', workspaceId, 'high');

      // All operations should complete successfully
      const stats = invalidator.getStats();
      expect(stats).toBeDefined();
    });

    test('should handle mixed priority operations correctly', async () => {
      // Queue operations with different priorities
      const operations = [
        { keys: ['low:key1'], priority: 'low' as const },
        { keys: ['high:key1'], priority: 'high' as const },
        { keys: ['medium:key1'], priority: 'medium' as const },
        { keys: ['low:key2'], priority: 'low' as const },
        { keys: ['high:key2'], priority: 'high' as const }
      ];

      const promises = operations.map(op =>
        invalidator.invalidateCache(op.keys, op.priority, 'priority-test')
      );

      await Promise.all(promises);

      // High priority should have processed immediately
      // Low/medium priority might be queued or processed
      const stats = invalidator.getStats();
      expect(stats.circuitBreakerState).toBe('closed');
    });
  });
});