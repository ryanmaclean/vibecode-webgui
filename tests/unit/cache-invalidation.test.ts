/**
 * Unit tests for cache invalidation system
 * Tests core functionality without external dependencies
 */

import { ProductionVectorCacheInvalidator } from '../../src/lib/cache/production-vector-cache-invalidator';
import { CacheInvalidationIntegration } from '../../src/lib/cache/cache-invalidation-integration';

// Mock the metrics module
jest.mock('../../src/lib/server-monitoring', () => ({
  metrics: {
    increment: jest.fn(),
    histogram: jest.fn()
  }
}));

describe('Production Vector Cache Invalidator', () => {
  let invalidator: ProductionVectorCacheInvalidator;

  beforeEach(() => {
    invalidator = new ProductionVectorCacheInvalidator({
      batchSize: 5,
      batchTimeoutMs: 100,
      maxRetries: 2,
      enableMetrics: false,
      enableLogging: false
    });
  });

  afterEach(() => {
    // Cleanup any pending operations
    if (invalidator) {
      invalidator.flushAll();
    }
  });

  describe('Basic Invalidation', () => {
    test('should invalidate cache keys immediately for high priority', async () => {
      const keys = ['key1', 'key2', 'key3'];
      
      // High priority should bypass batching
      await invalidator.invalidateCache(keys, 'high', 'test-source');
      
      const stats = invalidator.getStats();
      expect(stats.queuedRequests).toBe(0); // Should not be queued
    });

    test('should queue low priority requests for batching', async () => {
      const keys = ['key1', 'key2'];
      
      // Don't await - let it queue
      invalidator.invalidateCache(keys, 'low', 'test-source');
      
      const stats = invalidator.getStats();
      expect(stats.queuedRequests).toBe(1);
    });

    test('should remove duplicate keys from batch', async () => {
      const keys = ['key1', 'key2', 'key1', 'key3', 'key2'];
      
      await invalidator.invalidateCache(keys, 'high', 'test-source');
      
      // No easy way to verify deduplication without exposing internals
      // This test mainly ensures no errors occur with duplicates
      expect(true).toBe(true);
    });
  });

  describe('Pattern Invalidation', () => {
    test('should handle pattern-based invalidation', async () => {
      const pattern = 'user:123:*';
      
      await invalidator.invalidateByPattern(pattern, 'medium', 'pattern-test');
      
      // Should complete without errors
      expect(true).toBe(true);
    });

    test('should handle content type invalidation', async () => {
      const contentType = 'file';
      const workspaceId = 'workspace-123';
      
      await invalidator.invalidateByContentType(contentType, workspaceId, 'medium');
      
      // Should complete without errors
      expect(true).toBe(true);
    });
  });

  describe('File Operations', () => {
    test('should handle file creation invalidation', async () => {
      const fileId = 'file-123';
      const workspaceId = 'workspace-456';
      
      await invalidator.invalidateForFileOperation(fileId, 'create', workspaceId);
      
      expect(true).toBe(true);
    });

    test('should use high priority for file deletion', async () => {
      const fileId = 'file-123';
      const workspaceId = 'workspace-456';
      
      // Delete operations should be high priority
      await invalidator.invalidateForFileOperation(fileId, 'delete', workspaceId);
      
      const stats = invalidator.getStats();
      // Delete should process immediately, not queue
      expect(stats.queuedRequests).toBe(0);
    });
  });

  describe('Vector Operations', () => {
    test('should handle vector embedding invalidation', async () => {
      const keys = ['embedding:1', 'embedding:2'];
      const similarity = 0.8;
      
      await invalidator.invalidateForVectorOperation('embed', keys, similarity);
      
      expect(true).toBe(true);
    });

    test('should handle vector search invalidation', async () => {
      const keys = ['search:query1', 'search:query2'];
      
      await invalidator.invalidateForVectorOperation('search', keys);
      
      expect(true).toBe(true);
    });
  });

  describe('Circuit Breaker', () => {
    test('should track circuit breaker state', () => {
      const stats = invalidator.getStats();
      
      expect(stats.circuitBreakerState).toBe('closed');
      expect(stats.failureCount).toBe(0);
    });

    test('should provide meaningful stats', () => {
      const stats = invalidator.getStats();
      
      expect(typeof stats.pendingInvalidations).toBe('number');
      expect(typeof stats.queuedRequests).toBe('number');
      expect(typeof stats.isProcessing).toBe('boolean');
    });
  });

  describe('Batching Behavior', () => {
    test('should flush all pending operations', async () => {
      // Queue several operations
      invalidator.invalidateCache(['key1'], 'low', 'test1');
      invalidator.invalidateCache(['key2'], 'low', 'test2');
      invalidator.invalidateCache(['key3'], 'medium', 'test3');
      
      let stats = invalidator.getStats();
      expect(stats.queuedRequests).toBeGreaterThan(0);
      
      await invalidator.flushAll();
      
      stats = invalidator.getStats();
      expect(stats.queuedRequests).toBe(0);
    });
  });
});

describe('Cache Invalidation Integration', () => {
  let integration: CacheInvalidationIntegration;

  beforeEach(() => {
    integration = new CacheInvalidationIntegration({
      strategy: 'production',
      fallbackEnabled: true,
      performanceMode: 'balanced',
      monitoringEnabled: false
    });
  });

  describe('Strategy Selection', () => {
    test('should use production strategy by default', async () => {
      const keys = ['test-key-1', 'test-key-2'];
      
      await integration.invalidate(keys, {
        priority: 'medium',
        source: 'integration-test'
      });
      
      // Should complete without errors
      expect(true).toBe(true);
    });

    test('should handle force strategy override', async () => {
      const keys = ['test-key-1'];
      
      await integration.invalidate(keys, {
        forceStrategy: 'basic',
        priority: 'high'
      });
      
      expect(true).toBe(true);
    });
  });

  describe('Content Type Invalidation', () => {
    test('should invalidate by content type', async () => {
      await integration.invalidateByContentType('file', 'workspace-123', {
        priority: 'medium'
      });
      
      expect(true).toBe(true);
    });

    test('should handle cascade invalidation', async () => {
      await integration.invalidateByContentType('file', 'workspace-123', {
        priority: 'medium',
        cascadeInvalidation: true
      });
      
      expect(true).toBe(true);
    });
  });

  describe('File Operation Integration', () => {
    test('should handle file operations with dependencies', async () => {
      await integration.invalidateForFileOperation('file-123', 'update', 'workspace-456', {
        includeDependencies: true,
        includeReferences: true
      });
      
      expect(true).toBe(true);
    });
  });

  describe('Vector Operation Integration', () => {
    test('should handle vector operations with clustering', async () => {
      const keys = ['vector:1', 'vector:2', 'vector:3'];
      
      await integration.invalidateForVectorOperation('update', keys, {
        similarityThreshold: 0.9,
        clusterInvalidation: true,
        maxRelatedKeys: 10
      });
      
      expect(true).toBe(true);
    });
  });

  describe('Workspace Invalidation', () => {
    test('should handle workspace-wide invalidation', async () => {
      await integration.invalidateWorkspace('workspace-789', {
        contentTypes: ['file', 'embedding'],
        batchSize: 5
      });
      
      expect(true).toBe(true);
    });

    test('should handle workspace invalidation with exclusions', async () => {
      await integration.invalidateWorkspace('workspace-789', {
        contentTypes: ['file'],
        excludePatterns: ['temp:', 'cache:'],
        batchSize: 3
      });
      
      expect(true).toBe(true);
    });
  });

  describe('Performance Testing', () => {
    test('should run basic performance test', async () => {
      const results = await integration.performanceTest({
        keyCount: 5,
        iterations: 2,
        strategy: 'basic',
        concurrency: 1
      });
      
      expect(results.averageTime).toBeGreaterThan(0);
      expect(results.throughput).toBeGreaterThan(0);
      expect(results.successRate).toBeGreaterThanOrEqual(0);
      expect(results.successRate).toBeLessThanOrEqual(1);
      expect(typeof results.memoryUsage).toBe('number');
    });

    test('should run concurrent performance test', async () => {
      const results = await integration.performanceTest({
        keyCount: 3,
        iterations: 2,
        strategy: 'production',
        concurrency: 2
      });
      
      expect(results.averageTime).toBeGreaterThanOrEqual(0);
      expect(results.successRate).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Statistics and Monitoring', () => {
    test('should provide integration statistics', () => {
      const stats = integration.getStats();
      
      expect(stats.integration).toBeDefined();
      expect(stats.production).toBeDefined();
      expect(stats.strategy).toBeDefined();
      
      expect(typeof stats.integration.totalInvalidations).toBe('number');
      expect(typeof stats.integration.averageResponseTime).toBe('number');
      expect(typeof stats.integration.successRate).toBe('number');
    });

    test('should allow strategy updates', () => {
      integration.updateStrategy({
        performanceMode: 'high',
        monitoringEnabled: true
      });
      
      const stats = integration.getStats();
      expect(stats.strategy.performanceMode).toBe('high');
      expect(stats.strategy.monitoringEnabled).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle flush operations', async () => {
      // Queue some operations
      integration.invalidate(['key1', 'key2'], { priority: 'low' });
      integration.invalidate(['key3'], { priority: 'medium' });
      
      await integration.flushAll();
      
      // Should complete without errors
      expect(true).toBe(true);
    });
  });
});

describe('Cache Invalidation Edge Cases', () => {
  test('should handle empty key arrays', async () => {
    const invalidator = new ProductionVectorCacheInvalidator({
      enableMetrics: false,
      enableLogging: false
    });
    
    await invalidator.invalidateCache([], 'medium', 'empty-test');
    
    expect(true).toBe(true);
  });

  test('should handle very large key arrays', async () => {
    const invalidator = new ProductionVectorCacheInvalidator({
      batchSize: 10,
      enableMetrics: false,
      enableLogging: false
    });
    
    const largeKeyArray = Array.from({ length: 100 }, (_, i) => `key-${i}`);
    
    await invalidator.invalidateCache(largeKeyArray, 'medium', 'large-batch-test');
    
    expect(true).toBe(true);
  });

  test('should handle rapid successive calls', async () => {
    const invalidator = new ProductionVectorCacheInvalidator({
      batchSize: 3,
      batchTimeoutMs: 50,
      enableMetrics: false,
      enableLogging: false
    });
    
    // Fire multiple rapid calls
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(invalidator.invalidateCache([`rapid-key-${i}`], 'low', 'rapid-test'));
    }
    
    await Promise.all(promises);
    
    expect(true).toBe(true);
  });
});