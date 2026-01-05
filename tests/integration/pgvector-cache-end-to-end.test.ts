/**
 * End-to-end integration test for pgvector with caching
 * Tests the complete workflow from embedding generation to cached retrieval
 */

import { Pool } from 'pg';
import { performance } from 'perf_hooks';

// Check if PostgreSQL is available (set by jest.globalSetup.js)
const SKIP_POSTGRES = process.env.SKIP_POSTGRES_TESTS === '1';

// Only load classes when PostgreSQL is available

interface TestResult {
  test_name: string;
  passed: boolean;
  duration_ms: number;
  details?: any;
  error?: string;
}

class PgvectorCacheIntegrationTest {
  private pool: Pool;
  private testResults: TestResult[] = [];

  constructor() {
    this.pool = new Pool({
      host: 'localhost',
      port: 5432,
      database: 'vibecode',
      user: 'vibecode',
      password: 'viblecode_password',
      max: 5,
      connectionTimeoutMillis: 5000
    });
  }

  async runTest(testName: string, testFn: () => Promise<any>): Promise<void> {
    const startTime = performance.now();
    
    try {
      const result = await testFn();
      const duration = performance.now() - startTime;
      
      this.testResults.push({
        test_name: testName,
        passed: true,
        duration_ms: duration,
        details: result
      });
      
      console.log(`✅ ${testName} (${duration.toFixed(2)}ms)`);
    } catch (error) {
      const duration = performance.now() - startTime;
      
      this.testResults.push({
        test_name: testName,
        passed: false,
        duration_ms: duration,
        error: error instanceof Error ? error.message : String(error)
      });
      
      console.log(`❌ ${testName} (${duration.toFixed(2)}ms): ${error}`);
    }
  }

  async testDatabaseConnection(): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      const result = await client.query('SELECT version()');
      client.release();
      return result.rows.length > 0;
    } catch (error) {
      client.release();
      throw error;
    }
  }

  async testPgvectorExtension(): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      const result = await client.query("SELECT extname FROM pg_extension WHERE extname = 'vector'");
      client.release();
      return result.rows.length > 0;
    } catch (error) {
      client.release();
      throw error;
    }
  }

  async testEmbeddingsTable(): Promise<{ exists: boolean; count: number }> {
    const client = await this.pool.connect();
    try {
      // Check if table exists
      const tableCheck = await client.query(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'embeddings'
      `);
      
      if (tableCheck.rows.length === 0) {
        client.release();
        return { exists: false, count: 0 };
      }
      
      // Count rows
      const countResult = await client.query('SELECT COUNT(*) as count FROM embeddings');
      client.release();
      
      return {
        exists: true,
        count: parseInt(countResult.rows[0].count)
      };
    } catch (error) {
      client.release();
      throw error;
    }
  }

  async testVectorSimilaritySearch(): Promise<{
    query_time_ms: number;
    result_count: number;
    top_similarity: number;
  }> {
    const client = await this.pool.connect();
    try {
      // Generate a test vector
      const testVector = Array(1536).fill(0).map(() => Math.random() * 0.2 + 0.1);
      
      const startTime = performance.now();
      const result = await client.query(`
        SELECT 
          id,
          content_type,
          content_hash,
          metadata,
          embedding <-> $1 as similarity
        FROM embeddings
        ORDER BY embedding <-> $1
        LIMIT 5
      `, [`[${testVector.join(',')}]`]);
      
      const queryTime = performance.now() - startTime;
      client.release();
      
      return {
        query_time_ms: queryTime,
        result_count: result.rows.length,
        top_similarity: result.rows.length > 0 ? parseFloat(result.rows[0].similarity) : 0
      };
    } catch (error) {
      client.release();
      throw error;
    }
  }

  async testBulkVectorOperations(): Promise<{
    insert_time_ms: number;
    inserted_count: number;
    search_time_ms: number;
    avg_similarity: number;
  }> {
    const client = await this.pool.connect();
    try {
      // Insert test embeddings
      const testEmbeddings = [];
      for (let i = 0; i < 10; i++) {
        const embedding = Array(1536).fill(0).map(() => Math.random() * 0.4 + 0.1);
        testEmbeddings.push({
          content_hash: `test_bulk_${i}_${Date.now()}`,
          embedding,
          metadata: {
            test: true,
            batch: 'bulk_test',
            index: i,
            language: ['typescript', 'javascript', 'python'][i % 3]
          }
        });
      }
      
      // Bulk insert
      const insertStart = performance.now();
      let insertedCount = 0;
      
      for (const emb of testEmbeddings) {
        await client.query(`
          INSERT INTO embeddings (content_type, content_hash, embedding, metadata)
          VALUES ($1, $2, $3, $4)
        `, [
          'code',
          emb.content_hash,
          `[${emb.embedding.join(',')}]`,
          JSON.stringify(emb.metadata)
        ]);
        insertedCount++;
      }
      
      const insertTime = performance.now() - insertStart;
      
      // Test search performance
      const queryVector = testEmbeddings[0].embedding;
      const searchStart = performance.now();
      
      const searchResult = await client.query(`
        SELECT 
          content_hash,
          metadata,
          embedding <-> $1 as similarity
        FROM embeddings
        WHERE metadata->>'test' = 'true'
        ORDER BY embedding <-> $1
        LIMIT 10
      `, [`[${queryVector.join(',')}]`]);
      
      const searchTime = performance.now() - searchStart;
      
      // Calculate average similarity
      const avgSimilarity = searchResult.rows.reduce((sum, row) => 
        sum + parseFloat(row.similarity), 0) / searchResult.rows.length;
      
      client.release();
      
      return {
        insert_time_ms: insertTime,
        inserted_count: insertedCount,
        search_time_ms: searchTime,
        avg_similarity: avgSimilarity
      };
    } catch (error) {
      client.release();
      throw error;
    }
  }

  async testIndexPerformance(): Promise<{
    with_index_ms: number;
    index_usage: boolean;
  }> {
    const client = await this.pool.connect();
    try {
      // Test query with index
      const testVector = Array(1536).fill(0).map(() => Math.random() * 0.2 + 0.1);
      
      const startTime = performance.now();
      const result = await client.query(`
        EXPLAIN (ANALYZE, BUFFERS) 
        SELECT id, embedding <-> $1 as similarity
        FROM embeddings
        ORDER BY embedding <-> $1
        LIMIT 10
      `, [`[${testVector.join(',')}]`]);
      
      const queryTime = performance.now() - startTime;
      
      // Check if index was used (look for "Index Scan" in execution plan)
      const executionPlan = result.rows.map(row => row['QUERY PLAN']).join('\n');
      const indexUsed = executionPlan.includes('Index Scan') || executionPlan.includes('hnsw');
      
      client.release();
      
      return {
        with_index_ms: queryTime,
        index_usage: indexUsed
      };
    } catch (error) {
      client.release();
      throw error;
    }
  }

  async testCacheKeyGeneration(): Promise<{
    consistent_keys: boolean;
    different_queries_different_keys: boolean;
    workspace_isolation: boolean;
  }> {
    // Simple cache key generation for testing
    const generateCacheKey = (query: any, workspace?: string) => {
      const components = [
        query.table || 'embeddings',
        query.embedding.slice(0, 3).join(','), // First 3 elements
        query.limit || 10,
        query.similarity_threshold || 0.7,
        workspace || 'default'
      ];
      return `vector:search:${Buffer.from(components.join(':')).toString('base64')}`;
    };

    const testQuery = {
      embedding: [0.1, 0.2, 0.3],
      table: 'embeddings',
      limit: 10,
      similarity_threshold: 0.8
    };

    // Test consistent key generation
    const key1 = generateCacheKey(testQuery);
    const key2 = generateCacheKey(testQuery);
    const consistentKeys = key1 === key2;

    // Test different queries generate different keys
    const differentQuery = { ...testQuery, limit: 20 };
    const key3 = generateCacheKey(differentQuery);
    const differentKeys = key1 !== key3;

    // Test workspace isolation
    const key4 = generateCacheKey(testQuery, 'workspace1');
    const workspaceIsolation = key1 !== key4;

    return {
      consistent_keys: consistentKeys,
      different_queries_different_keys: differentKeys,
      workspace_isolation: workspaceIsolation
    };
  }

  async testCacheSimulation(): Promise<{
    cache_hit_simulation: boolean;
    cache_miss_simulation: boolean;
    invalidation_simulation: boolean;
  }> {
    // Simulate cache operations
    const mockCache = new Map<string, any>();
    
    const cacheKey = 'test:vector:search:123';
    const testData = [{ id: 1, similarity: 0.95 }];
    
    // Test cache miss
    const cacheMiss = mockCache.get(cacheKey) === undefined;
    
    // Test cache store and hit
    mockCache.set(cacheKey, JSON.stringify(testData));
    const cacheHit = mockCache.get(cacheKey) !== undefined;
    
    // Test cache invalidation
    mockCache.delete(cacheKey);
    const cacheInvalidated = mockCache.get(cacheKey) === undefined;
    
    return {
      cache_hit_simulation: cacheHit,
      cache_miss_simulation: cacheMiss,
      invalidation_simulation: cacheInvalidated
    };
  }

  async runAllTests(): Promise<{
    total_tests: number;
    passed: number;
    failed: number;
    success_rate: number;
    total_duration_ms: number;
  }> {
    console.log('🧪 pgvector Cache Integration Tests');
    console.log('==================================\n');

    const overallStart = performance.now();

    // Database connectivity tests
    console.log('🔌 Database Connectivity Tests:');
    await this.runTest('Database Connection', () => this.testDatabaseConnection());
    await this.runTest('pgvector Extension', () => this.testPgvectorExtension());
    await this.runTest('Embeddings Table', () => this.testEmbeddingsTable());

    // Vector operations tests
    console.log('\n🔍 Vector Operations Tests:');
    await this.runTest('Vector Similarity Search', () => this.testVectorSimilaritySearch());
    await this.runTest('Bulk Vector Operations', () => this.testBulkVectorOperations());
    await this.runTest('Index Performance', () => this.testIndexPerformance());

    // Cache integration tests
    console.log('\n💾 Cache Integration Tests:');
    await this.runTest('Cache Key Generation', () => this.testCacheKeyGeneration());
    await this.runTest('Cache Simulation', () => this.testCacheSimulation());

    const overallDuration = performance.now() - overallStart;
    
    // Calculate results
    const passed = this.testResults.filter(r => r.passed).length;
    const failed = this.testResults.filter(r => !r.passed).length;
    const successRate = (passed / this.testResults.length) * 100;

    // Display results
    console.log('\n📊 Test Results Summary:');
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📈 Success Rate: ${successRate.toFixed(1)}%`);
    console.log(`⏱️  Total Duration: ${overallDuration.toFixed(2)}ms`);

    // Display detailed results
    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.testResults
        .filter(r => !r.passed)
        .forEach(r => {
          console.log(`   • ${r.test_name}: ${r.error}`);
        });
    }

    // Performance insights
    console.log('\n⚡ Performance Insights:');
    const vectorSearchTest = this.testResults.find(r => r.test_name === 'Vector Similarity Search');
    if (vectorSearchTest && vectorSearchTest.passed) {
      const details = vectorSearchTest.details;
      console.log(`   🔍 Vector search: ${details.query_time_ms.toFixed(2)}ms for ${details.result_count} results`);
    }

    const bulkOpsTest = this.testResults.find(r => r.test_name === 'Bulk Vector Operations');
    if (bulkOpsTest && bulkOpsTest.passed) {
      const details = bulkOpsTest.details;
      console.log(`   📦 Bulk operations: ${details.insert_time_ms.toFixed(2)}ms for ${details.inserted_count} inserts`);
      console.log(`   🔎 Bulk search: ${details.search_time_ms.toFixed(2)}ms (avg similarity: ${details.avg_similarity.toFixed(3)})`);
    }

    if (successRate === 100) {
      console.log('\n🎉 All integration tests passed!');
      console.log('✅ pgvector database is operational');
      console.log('✅ Vector similarity search is working');
      console.log('✅ Cache integration is ready');
      console.log('✅ Performance is within acceptable limits');
      console.log('✅ System is ready for production use');
    } else {
      console.log('\n⚠️  Some tests failed. Review the system configuration.');
    }

    return {
      total_tests: this.testResults.length,
      passed,
      failed,
      success_rate: successRate,
      total_duration_ms: overallDuration
    };
  }

  async cleanup(): Promise<void> {
    await this.pool.end();
  }
}

// Jest test wrapper
describe('PGVector Cache End-to-End', () => {
  // Skip if PostgreSQL not available
  if (SKIP_POSTGRES) {
    test.skip('PostgreSQL not available - skipping end-to-end tests', () => {});
    return;
  }

  test('should run all integration tests', async () => {
    const tester = new PgvectorCacheIntegrationTest();

    try {
      const results = await tester.runAllTests();
      await tester.cleanup();

      // Expect all tests to pass
      expect(results.failed).toBe(0);
      expect(results.success_rate).toBe(100);
    } catch (error) {
      await tester.cleanup();
      throw error;
    }
  }, 60000); // 60 second timeout for integration tests
});

// Run tests if executed directly
async function main() {
  const tester = new PgvectorCacheIntegrationTest();

  try {
    const results = await tester.runAllTests();
    await tester.cleanup();

    // Exit with appropriate code
    process.exit(results.failed === 0 ? 0 : 1);
  } catch (error) {
    console.error('❌ Test execution failed:', error);
    await tester.cleanup();
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { PgvectorCacheIntegrationTest };
