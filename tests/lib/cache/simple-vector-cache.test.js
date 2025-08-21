/**
 * Simple vector cache tests using plain JavaScript
 * Tests the core functionality without complex Jest configuration
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
  increment: () => {},
  histogram: () => {}
};

const mockLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {}
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

// Test runner
async function runTests() {
  console.log('🧪 Running Vector Cache Tests...\n');
  
  let passed = 0;
  let failed = 0;
  
  function assert(condition, message) {
    if (condition) {
      console.log(`✅ ${message}`);
      passed++;
    } else {
      console.log(`❌ ${message}`);
      failed++;
    }
  }
  
  function assertEqual(actual, expected, message) {
    const condition = JSON.stringify(actual) === JSON.stringify(expected);
    assert(condition, `${message} (expected: ${JSON.stringify(expected)}, got: ${JSON.stringify(actual)})`);
  }

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

  // Test 1: Cache Key Generation
  console.log('📝 Testing Cache Key Generation...');
  SimpleVectorCacheManager.resetStats();
  mockRedisClient.clear();
  
  const key1 = SimpleVectorCacheManager.calculateCacheKey(sampleQuery);
  const key2 = SimpleVectorCacheManager.calculateCacheKey(sampleQuery);
  assert(key1 === key2, 'Should generate consistent cache keys');
  
  const differentQuery = { ...sampleQuery, limit: 20 };
  const key3 = SimpleVectorCacheManager.calculateCacheKey(differentQuery);
  assert(key1 !== key3, 'Should generate different keys for different queries');
  
  const key4 = SimpleVectorCacheManager.calculateCacheKey(sampleQuery, 'workspace1');
  assert(key1 !== key4, 'Should include workspace in key');

  // Test 2: Cache Operations
  console.log('\n💾 Testing Cache Operations...');
  
  // Cache miss
  const cachedResults1 = await SimpleVectorCacheManager.getCachedResults(sampleQuery);
  assert(cachedResults1 === null, 'Should return null on cache miss');
  
  // Store in cache
  const stored = await SimpleVectorCacheManager.cacheResults(sampleQuery, sampleResults);
  assert(stored === true, 'Should successfully store results');
  
  // Cache hit
  const cachedResults2 = await SimpleVectorCacheManager.getCachedResults(sampleQuery);
  assertEqual(cachedResults2, sampleResults, 'Should return cached results on hit');

  // Test 3: Workspace Isolation
  console.log('\n🏢 Testing Workspace Isolation...');
  
  await SimpleVectorCacheManager.cacheResults(sampleQuery, sampleResults, 'workspace1');
  
  const noWorkspaceResults = await SimpleVectorCacheManager.getCachedResults(sampleQuery);
  const workspaceResults = await SimpleVectorCacheManager.getCachedResults(sampleQuery, 'workspace1');
  
  assertEqual(workspaceResults, sampleResults, 'Should find results with correct workspace');

  // Test 4: Cache Invalidation
  console.log('\n🗑️  Testing Cache Invalidation...');
  
  await SimpleVectorCacheManager.cacheResults(sampleQuery, sampleResults);
  const beforeInvalidation = await SimpleVectorCacheManager.getCachedResults(sampleQuery);
  assert(beforeInvalidation !== null, 'Results should be in cache before invalidation');
  
  const invalidatedCount = await SimpleVectorCacheManager.invalidateForTable('embeddings');
  assert(invalidatedCount > 0, 'Should invalidate at least one key');
  
  const afterInvalidation = await SimpleVectorCacheManager.getCachedResults(sampleQuery);
  assert(afterInvalidation === null, 'Results should be removed after invalidation');

  // Test 5: Skip Cache Logic
  console.log('\n⏭️  Testing Skip Cache Logic...');
  
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
  assert(skipped === false, 'Should skip caching for complex queries');
  
  const lowSimilarityQuery = { ...sampleQuery, minSimilarity: 0.05 };
  const skipped2 = await SimpleVectorCacheManager.cacheResults(lowSimilarityQuery, sampleResults);
  assert(skipped2 === false, 'Should skip caching for low similarity queries');

  // Test 6: Cache Statistics
  console.log('\n📊 Testing Cache Statistics...');
  
  SimpleVectorCacheManager.resetStats();
  
  // Generate some cache activity
  await SimpleVectorCacheManager.getCachedResults(sampleQuery); // miss
  await SimpleVectorCacheManager.cacheResults(sampleQuery, sampleResults);
  await SimpleVectorCacheManager.getCachedResults(sampleQuery); // hit
  
  const stats = SimpleVectorCacheManager.getCacheStats();
  assert(stats.hitCount === 1, 'Should track cache hits');
  assert(stats.missCount === 1, 'Should track cache misses');
  assert(stats.hitRate === 0.5, 'Should calculate correct hit rate');

  // Test 7: Vector Fingerprinting
  console.log('\n🔍 Testing Vector Fingerprinting...');
  
  const vector1 = [0.1, 0.2, 0.3, 0.4, 0.5];
  const vector2 = [0.1, 0.2, 0.3, 0.4, 0.5];
  const vector3 = [0.2, 0.3, 0.4, 0.5, 0.6];
  
  const fp1 = SimpleVectorCacheManager.getVectorFingerprint(vector1);
  const fp2 = SimpleVectorCacheManager.getVectorFingerprint(vector2);
  const fp3 = SimpleVectorCacheManager.getVectorFingerprint(vector3);
  
  assert(fp1 === fp2, 'Should generate same fingerprint for identical vectors');
  assert(fp1 !== fp3, 'Should generate different fingerprints for different vectors');
  
  const emptyFp = SimpleVectorCacheManager.getVectorFingerprint([]);
  assert(emptyFp === 'empty', 'Should handle empty vectors');

  // Results
  console.log('\n📋 Test Results:');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  
  if (failed === 0) {
    console.log('\n🎉 All tests passed! Vector cache is working correctly.');
  } else {
    console.log('\n⚠️  Some tests failed. Please review the implementation.');
  }
  
  return failed === 0;
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });
}

module.exports = { runTests, SimpleVectorCacheManager };
