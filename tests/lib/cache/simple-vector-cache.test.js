/**
 * Simple vector cache tests using plain JavaScript
 * Tests the core functionality without complex Jest configuration
 *
 * @jest-environment node
 */

const { performance } = require('perf_hooks');

// Mock implementations
const mockRedisClient = {
  data: new Map(),
  async get(key) {
    return this.data.get(key) || null;
  },
  async set(key, value, ttl) {
    this.data.set(key, value);
    return 'OK';
  },
  async del(keys) {
    if (Array.isArray(keys)) {
      keys.forEach(key => this.data.delete(key));
      return keys.length;
    }
    this.data.delete(keys);
    return 1;
  },
  async keys(pattern) {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return Array.from(this.data.keys()).filter(key => regex.test(key));
  },
  clear() {
    this.data.clear();
  }
};

const mockMetrics = {
  increment: jest.fn(),
  histogram: jest.fn()
};

const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Simple vector cache implementation for testing
class SimpleVectorCacheManager {
  static hitCount = 0;
  static missCount = 0;
  static skipCount = 0;

  static calculateCacheKey(query, workspace) {
    const vectorFingerprint = this.getVectorFingerprint(query.embedding);
    const filterKey = query.filter ? JSON.stringify(query.filter) : '';
    const contentTypeKey = query.contentTypes ? query.contentTypes.sort().join('_') : 'all';
    
    const components = [
      query.table || 'default',
      vectorFingerprint,
      query.limit || 10,
      query.minSimilarity ? query.minSimilarity.toFixed(3) : '0.000',
      contentTypeKey,
      filterKey
    ];
    
    if (workspace) {
      components.push(workspace);
    }
    
    return `vector:search:${Buffer.from(components.join(':')).toString('base64')}`;
  }

  static getVectorFingerprint(vector) {
    if (!vector || vector.length === 0) return 'empty';
    
    let sum = 0;
    let max = -Infinity;
    let min = Infinity;
    
    for (let i = 0; i < vector.length; i++) {
      const val = vector[i];
      sum += val;
      if (val > max) max = val;
      if (val < min) min = val;
    }
    
    const mean = sum / vector.length;
    const features = [
      Math.round(mean * 100) / 100,
      Math.round(max * 100) / 100,
      Math.round(min * 100) / 100
    ];
    
    return features.join('|');
  }

  static async getCachedResults(query, workspace) {
    const cacheKey = this.calculateCacheKey(query, workspace);
    
    if (this.shouldSkipCache(query)) {
      this.skipCount++;
      return null;
    }
    
    const cachedResults = await mockRedisClient.get(cacheKey);
    
    if (cachedResults) {
      this.hitCount++;
      return cachedResults;
    } else {
      this.missCount++;
      return null;
    }
  }

  static async cacheResults(query, results, workspace, customTtl) {
    if (results.length === 0 || this.shouldSkipCache(query)) {
      return false;
    }
    
    const cacheKey = this.calculateCacheKey(query, workspace);
    const ttl = customTtl || 300; // 5 minutes default
    
    await mockRedisClient.set(cacheKey, results, ttl);
    return true;
  }

  static async invalidateForTable(table, contentType) {
    let pattern;
    if (contentType) {
      pattern = `vector:search:*${table}*${contentType}*`;
    } else {
      pattern = `vector:search:*${table}*`;
    }
    
    const keys = await mockRedisClient.keys(pattern);
    if (keys.length > 0) {
      await mockRedisClient.del(keys);
    }
    
    return keys.length;
  }

  static shouldSkipCache(query) {
    if (query.filter && Object.keys(query.filter).length > 5) return true;
    if (query.minSimilarity !== undefined && query.minSimilarity < 0.1) return true;
    if (query.limit !== undefined && query.limit > 100) return true;
    return false;
  }

  static getCacheStats() {
    const total = this.hitCount + this.missCount;
    const hitRate = total > 0 ? this.hitCount / total : 0;
    
    return {
      hitCount: this.hitCount,
      missCount: this.missCount,
      skipCount: this.skipCount,
      hitRate
    };
  }

  static resetStats() {
    this.hitCount = 0;
    this.missCount = 0;
    this.skipCount = 0;
  }
}

// Jest test suite
describe('Simple Vector Cache', () => {
  // Setup
  const sampleEmbedding = Array(1536).fill(0.1);
  const sampleResults = [
    {
      id: 1,
      similarity: 0.95,
      content: 'Sample content 1',
      metadata: { language: 'typescript' },
      contentType: 'code'
    }
  ];

  const sampleQuery = {
    embedding: sampleEmbedding,
    table: 'embeddings',
    limit: 10,
    minSimilarity: 0.7,
    filter: { language: 'typescript' },
    contentTypes: ['code']
  };

  beforeEach(() => {
    SimpleVectorCacheManager.resetStats();
    mockRedisClient.clear();
  });

  describe('Cache Key Generation', () => {
    test('should generate consistent cache keys', () => {
      const key1 = SimpleVectorCacheManager.calculateCacheKey(sampleQuery);
      const key2 = SimpleVectorCacheManager.calculateCacheKey(sampleQuery);
      expect(key1).toBe(key2);
    });

    test('should generate different keys for different queries', () => {
      const key1 = SimpleVectorCacheManager.calculateCacheKey(sampleQuery);
      const differentQuery = { ...sampleQuery, limit: 20 };
      const key3 = SimpleVectorCacheManager.calculateCacheKey(differentQuery);
      expect(key1).not.toBe(key3);
    });

    test('should include workspace in key', () => {
      const key1 = SimpleVectorCacheManager.calculateCacheKey(sampleQuery);
      const key4 = SimpleVectorCacheManager.calculateCacheKey(sampleQuery, 'workspace1');
      expect(key1).not.toBe(key4);
    });
  });

  describe('Cache Operations', () => {
    test('should return null on cache miss', async () => {
      const cachedResults1 = await SimpleVectorCacheManager.getCachedResults(sampleQuery);
      expect(cachedResults1).toBeNull();
    });

    test('should successfully store results', async () => {
      const stored = await SimpleVectorCacheManager.cacheResults(sampleQuery, sampleResults);
      expect(stored).toBe(true);
    });

    test('should return cached results on hit', async () => {
      await SimpleVectorCacheManager.cacheResults(sampleQuery, sampleResults);
      const cachedResults2 = await SimpleVectorCacheManager.getCachedResults(sampleQuery);
      expect(cachedResults2).toEqual(sampleResults);
    });
  });

  describe('Workspace Isolation', () => {
    test('should find results with correct workspace', async () => {
      await SimpleVectorCacheManager.cacheResults(sampleQuery, sampleResults, 'workspace1');

      const noWorkspaceResults = await SimpleVectorCacheManager.getCachedResults(sampleQuery);
      const workspaceResults = await SimpleVectorCacheManager.getCachedResults(sampleQuery, 'workspace1');

      expect(workspaceResults).toEqual(sampleResults);
      expect(noWorkspaceResults).toBeNull();
    });
  });

  describe('Cache Invalidation', () => {
    test('should invalidate cache entries', async () => {
      await SimpleVectorCacheManager.cacheResults(sampleQuery, sampleResults);
      const beforeInvalidation = await SimpleVectorCacheManager.getCachedResults(sampleQuery);
      expect(beforeInvalidation).not.toBeNull();

      const invalidatedCount = await SimpleVectorCacheManager.invalidateForTable('embeddings');
      expect(invalidatedCount).toBeGreaterThan(0);

      const afterInvalidation = await SimpleVectorCacheManager.getCachedResults(sampleQuery);
      expect(afterInvalidation).toBeNull();
    });
  });

  describe('Skip Cache Logic', () => {
    test('should skip caching for complex queries', async () => {
      const complexQuery = {
        ...sampleQuery,
        filter: {
          language: 'typescript',
          framework: 'react',
          complexity: 'high',
          fileSize: 'large',
          modified: 'recent',
          author: 'someone'
        }
      };

      const skipped = await SimpleVectorCacheManager.cacheResults(complexQuery, sampleResults);
      expect(skipped).toBe(false);
    });

    test('should skip caching for low similarity queries', async () => {
      const lowSimilarityQuery = { ...sampleQuery, minSimilarity: 0.05 };
      const skipped2 = await SimpleVectorCacheManager.cacheResults(lowSimilarityQuery, sampleResults);
      expect(skipped2).toBe(false);
    });
  });

  describe('Cache Statistics', () => {
    test('should track cache hits and misses', async () => {
      SimpleVectorCacheManager.resetStats();

      await SimpleVectorCacheManager.getCachedResults(sampleQuery); // miss
      await SimpleVectorCacheManager.cacheResults(sampleQuery, sampleResults);
      await SimpleVectorCacheManager.getCachedResults(sampleQuery); // hit

      const stats = SimpleVectorCacheManager.getCacheStats();
      expect(stats.hitCount).toBe(1);
      expect(stats.missCount).toBe(1);
      expect(stats.hitRate).toBe(0.5);
    });
  });

  describe('Vector Fingerprinting', () => {
    test('should generate same fingerprint for identical vectors', () => {
      const vector1 = [0.1, 0.2, 0.3, 0.4, 0.5];
      const vector2 = [0.1, 0.2, 0.3, 0.4, 0.5];

      const fp1 = SimpleVectorCacheManager.getVectorFingerprint(vector1);
      const fp2 = SimpleVectorCacheManager.getVectorFingerprint(vector2);

      expect(fp1).toBe(fp2);
    });

    test('should generate different fingerprints for different vectors', () => {
      const vector1 = [0.1, 0.2, 0.3, 0.4, 0.5];
      const vector3 = [0.2, 0.3, 0.4, 0.5, 0.6];

      const fp1 = SimpleVectorCacheManager.getVectorFingerprint(vector1);
      const fp3 = SimpleVectorCacheManager.getVectorFingerprint(vector3);

      expect(fp1).not.toBe(fp3);
    });

    test('should handle empty vectors', () => {
      const emptyFp = SimpleVectorCacheManager.getVectorFingerprint([]);
      expect(emptyFp).toBe('empty');
    });
  });
});

module.exports = { SimpleVectorCacheManager };
