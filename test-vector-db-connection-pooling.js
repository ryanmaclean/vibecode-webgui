/**
 * Test Vector Database Connection Pooling
 * 
 * This script tests the vector database connection pooling implementation for
 * the Azure OpenAI embedding service, ensuring it properly handles concurrent requests
 * and connection management.
 * 
 * Usage:
 * - Set up environment variables (see below)
 * - Run with Node.js: `node test-vector-db-connection-pooling.js`
 */

import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { AzureEmbeddingService } from './src/lib/ai/azureEmbeddingService.js';
import { EmbeddingServiceFactory, EmbeddingProvider } from './src/lib/ai/embeddingServiceFactory.js';
import { getVectorConnectionPool } from './src/lib/db/vector-connection-pool.js';

// Load environment variables
config({ path: '.env.azure' });

// Configuration
const CONCURRENT_OPERATIONS = 10;
const BATCH_SIZE = 5;
const TEST_ITERATIONS = 3;
const STRESS_TEST_DURATION_MS = 10000; // 10 seconds

// Sample test documents
const testDocuments = [
  {
    id: 'pool-test-001',
    content: 'Connection pooling improves database resource utilization and performance',
    metadata: { category: 'performance', type: 'technical' }
  },
  {
    id: 'pool-test-002',
    content: 'Managed identity with connection pooling provides both security and performance benefits',
    metadata: { category: 'security', type: 'architecture' }
  },
  {
    id: 'pool-test-003',
    content: 'Vector database operations benefit from connection pooling when handling many concurrent requests',
    metadata: { category: 'database', type: 'optimization' }
  },
  {
    id: 'pool-test-004',
    content: 'Embedding services can process documents in parallel with proper connection management',
    metadata: { category: 'ai', type: 'processing' }
  },
  {
    id: 'pool-test-005',
    content: 'Monitoring connection pool metrics helps identify performance bottlenecks',
    metadata: { category: 'monitoring', type: 'operations' }
  }
];

// Sample search queries
const testQueries = [
  'benefits of connection pooling',
  'security with managed identity',
  'vector database optimization',
  'parallel document processing',
  'performance monitoring metrics',
  'resource utilization improvement',
  'concurrent database operations',
  'connection management strategies'
];

/**
 * Create a test embedding service with connection pooling
 */
async function createPooledEmbeddingService() {
  console.log('\n=== Creating Embedding Service with Connection Pooling ===');
  
  // Set environment variable for connection pooling
  process.env.USE_CONNECTION_POOL = 'true';
  
  try {
    // Create embedding service with robust connection and connection pooling
    const { service, releaseConnection } = await EmbeddingServiceFactory.createEmbeddingServiceWithRobustConnection(true);
    console.log('✅ Created embedding service with connection pooling');
    
    return { service, releaseConnection };
  } catch (error) {
    console.error('❌ Error creating embedding service:', error.message);
    throw error;
  }
}

/**
 * Test storing documents with connection pooling
 */
async function testStoreDocuments(service) {
  console.log('\n=== Testing Document Storage with Connection Pooling ===');
  
  try {
    // Store test documents in parallel
    console.log(`Storing ${testDocuments.length} documents concurrently...`);
    const startTime = Date.now();
    
    const results = await Promise.all(
      testDocuments.map(doc => 
        service.storeDocument(doc.id, doc.content, doc.metadata)
          .then(() => ({ success: true, id: doc.id }))
          .catch(error => ({ success: false, id: doc.id, error: error.message }))
      )
    );
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Report results
    const successCount = results.filter(r => r.success).length;
    console.log(`✅ Stored ${successCount}/${testDocuments.length} documents in ${duration}ms`);
    
    // Log any failures
    const failures = results.filter(r => !r.success);
    if (failures.length > 0) {
      console.warn(`⚠️ ${failures.length} document storage operations failed:`);
      failures.forEach(f => console.warn(`  - ${f.id}: ${f.error}`));
    }
    
    return { success: successCount === testDocuments.length, duration };
  } catch (error) {
    console.error('❌ Error testing document storage:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Test querying similar documents with connection pooling
 */
async function testQueryDocuments(service) {
  console.log('\n=== Testing Document Queries with Connection Pooling ===');
  
  try {
    // Run search queries in parallel
    console.log(`Running ${testQueries.length} search queries concurrently...`);
    const startTime = Date.now();
    
    const results = await Promise.all(
      testQueries.map(async query => {
        try {
          const similarDocs = await service.findSimilarDocuments(query, { 
            threshold: 0.5,
            limit: 3
          });
          
          return { 
            success: true, 
            query, 
            count: similarDocs.length,
            documents: similarDocs.map(doc => ({
              id: doc.document_id,
              similarity: doc.similarity
            }))
          };
        } catch (error) {
          return { success: false, query, error: error.message };
        }
      })
    );
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Report results
    const successCount = results.filter(r => r.success).length;
    console.log(`✅ Processed ${successCount}/${testQueries.length} search queries in ${duration}ms`);
    
    // Show matches for each query
    results.filter(r => r.success).forEach(r => {
      console.log(`  - Query: "${r.query}" found ${r.count} matches`);
      r.documents.forEach(doc => {
        console.log(`    * ${doc.id} (similarity: ${doc.similarity.toFixed(4)})`);
      });
    });
    
    // Log any failures
    const failures = results.filter(r => !r.success);
    if (failures.length > 0) {
      console.warn(`⚠️ ${failures.length} search queries failed:`);
      failures.forEach(f => console.warn(`  - "${f.query}": ${f.error}`));
    }
    
    return { success: successCount === testQueries.length, duration };
  } catch (error) {
    console.error('❌ Error testing document queries:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Test concurrent batched operations
 */
async function testConcurrentBatches(service) {
  console.log('\n=== Testing Concurrent Batched Operations ===');
  
  const results = {
    batches: 0,
    operations: 0,
    successful: 0,
    failed: 0,
    duration: 0
  };
  
  try {
    // Create multiple batches of operations
    const batches = [];
    
    for (let i = 0; i < TEST_ITERATIONS; i++) {
      const batch = [];
      
      // Add document storage operations
      for (let j = 0; j < BATCH_SIZE; j++) {
        const docId = `batch-${i}-doc-${j}`;
        const content = `Test document for batch ${i}, document ${j}. This tests concurrent operations with connection pooling.`;
        batch.push(() => service.storeDocument(docId, content, { batch: i, index: j }));
      }
      
      // Add search operations
      for (let j = 0; j < BATCH_SIZE; j++) {
        const query = `batch ${i} test ${j} document`;
        batch.push(() => service.findSimilarDocuments(query, { threshold: 0.5, limit: 3 }));
      }
      
      batches.push(batch);
    }
    
    // Execute all batches concurrently
    console.log(`Running ${batches.length} batches with ${batches[0].length} operations each...`);
    const startTime = Date.now();
    
    const batchResults = await Promise.all(
      batches.map(async (batch, batchIndex) => {
        try {
          // Execute all operations in this batch concurrently
          const operationResults = await Promise.all(
            batch.map(operation => 
              operation()
                .then(() => ({ success: true }))
                .catch(error => ({ success: false, error: error.message }))
            )
          );
          
          // Count successes and failures
          const successful = operationResults.filter(r => r.success).length;
          const failed = operationResults.length - successful;
          
          return {
            batchIndex,
            operations: operationResults.length,
            successful,
            failed
          };
        } catch (error) {
          console.error(`❌ Error in batch ${batchIndex}:`, error.message);
          return {
            batchIndex,
            operations: batch.length,
            successful: 0,
            failed: batch.length,
            error: error.message
          };
        }
      })
    );
    
    const endTime = Date.now();
    results.duration = endTime - startTime;
    
    // Summarize results
    results.batches = batchResults.length;
    results.operations = batchResults.reduce((sum, batch) => sum + batch.operations, 0);
    results.successful = batchResults.reduce((sum, batch) => sum + batch.successful, 0);
    results.failed = batchResults.reduce((sum, batch) => sum + batch.failed, 0);
    
    console.log(`✅ Completed ${results.batches} batches with ${results.operations} total operations in ${results.duration}ms`);
    console.log(`  - ${results.successful} successful operations (${(results.successful / results.operations * 100).toFixed(1)}%)`);
    console.log(`  - ${results.failed} failed operations (${(results.failed / results.operations * 100).toFixed(1)}%)`);
    console.log(`  - Average time per operation: ${(results.duration / results.operations).toFixed(2)}ms`);
    
    return results;
  } catch (error) {
    console.error('❌ Error testing concurrent batches:', error.message);
    return { ...results, error: error.message };
  }
}

/**
 * Test connection pool metrics
 */
async function testConnectionPoolMetrics() {
  console.log('\n=== Checking Connection Pool Metrics ===');
  
  try {
    // Get connection pool instance
    const pool = getVectorConnectionPool();
    
    // Get current metrics
    const metrics = pool.getMetrics();
    
    // Log metrics
    console.log('Connection Pool Metrics:');
    console.log(`  - Total Connections: ${metrics.totalConnections}`);
    console.log(`  - Active Connections: ${metrics.activeConnections}`);
    console.log(`  - Idle Connections: ${metrics.idleConnections}`);
    console.log(`  - Waiting Requests: ${metrics.waitingRequests}`);
    console.log(`  - Max Used Connections: ${metrics.maxUsedConnections}`);
    console.log(`  - Total Acquire Count: ${metrics.acquireCount}`);
    console.log(`  - Total Release Count: ${metrics.releaseCount}`);
    console.log(`  - Failed Acquire Count: ${metrics.failedAcquireCount}`);
    console.log(`  - Average Acquire Time: ${metrics.avgAcquireTime.toFixed(2)}ms`);
    console.log(`  - Average Query Time: ${metrics.avgQueryTime.toFixed(2)}ms`);
    
    return metrics;
  } catch (error) {
    console.error('❌ Error checking connection pool metrics:', error.message);
    return null;
  }
}

/**
 * Run stress test
 */
async function runStressTest(service) {
  console.log('\n=== Running Connection Pool Stress Test ===');
  console.log(`Running for ${STRESS_TEST_DURATION_MS / 1000} seconds with ${CONCURRENT_OPERATIONS} concurrent operations...`);
  
  // Track metrics
  const results = {
    totalOperations: 0,
    successfulOperations: 0,
    failedOperations: 0,
    startPoolSize: 0,
    peakPoolSize: 0,
    endPoolSize: 0,
    duration: 0
  };
  
  try {
    // Get initial connection pool metrics
    const pool = getVectorConnectionPool();
    const initialMetrics = pool.getMetrics();
    results.startPoolSize = initialMetrics.totalConnections;
    results.peakPoolSize = initialMetrics.totalConnections;
    
    // Set up stress test
    const startTime = Date.now();
    const endTime = startTime + STRESS_TEST_DURATION_MS;
    let running = true;
    
    // Create a mix of operations
    const operations = [];
    
    // Document storage operations
    for (let i = 0; i < Math.floor(CONCURRENT_OPERATIONS / 2); i++) {
      operations.push(async () => {
        const docId = `stress-doc-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
        const content = `Stress test document generated at ${new Date().toISOString()}. This tests how the connection pool handles high load.`;
        await service.storeDocument(docId, content, { type: 'stress-test' });
        return 'store';
      });
    }
    
    // Search operations
    for (let i = 0; i < Math.floor(CONCURRENT_OPERATIONS / 2); i++) {
      operations.push(async () => {
        const query = `stress test ${Date.now()} ${Math.random().toString(36).substring(2, 10)}`;
        await service.findSimilarDocuments(query, { threshold: 0.5, limit: 3 });
        return 'search';
      });
    }
    
    // Start workers
    const workers = [];
    for (let i = 0; i < CONCURRENT_OPERATIONS; i++) {
      workers.push((async () => {
        // Keep executing operations until the test is done
        while (running) {
          // Pick a random operation
          const operation = operations[Math.floor(Math.random() * operations.length)];
          
          try {
            // Execute operation
            await operation();
            results.successfulOperations++;
          } catch (error) {
            results.failedOperations++;
          }
          
          results.totalOperations++;
          
          // Check pool size
          const currentMetrics = pool.getMetrics();
          if (currentMetrics.totalConnections > results.peakPoolSize) {
            results.peakPoolSize = currentMetrics.totalConnections;
          }
          
          // Add small delay to avoid completely overwhelming the system
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      })());
    }
    
    // Wait until the test duration is complete
    await new Promise(resolve => {
      const interval = setInterval(() => {
        const now = Date.now();
        if (now >= endTime) {
          clearInterval(interval);
          running = false;
          resolve();
        } else {
          // Log progress
          const elapsed = now - startTime;
          const totalOps = results.totalOperations;
          console.log(`Progress: ${Math.floor(elapsed / STRESS_TEST_DURATION_MS * 100)}% - ${totalOps} operations (${Math.floor(totalOps / (elapsed / 1000))} ops/sec)`);
        }
      }, 1000);
    });
    
    // Wait for all workers to finish
    await Promise.all(workers);
    
    // Record final metrics
    const finalMetrics = pool.getMetrics();
    results.endPoolSize = finalMetrics.totalConnections;
    results.duration = Date.now() - startTime;
    
    // Log results
    console.log('\n=== Stress Test Results ===');
    console.log(`Total Operations: ${results.totalOperations}`);
    console.log(`Successful Operations: ${results.successfulOperations}`);
    console.log(`Failed Operations: ${results.failedOperations}`);
    console.log(`Operations per Second: ${Math.floor(results.totalOperations / (results.duration / 1000))}`);
    console.log(`Connection Pool Size: ${results.startPoolSize} → ${results.endPoolSize} (peak: ${results.peakPoolSize})`);
    
    return results;
  } catch (error) {
    console.error('❌ Error running stress test:', error.message);
    results.duration = Date.now() - results.startTime;
    return { ...results, error: error.message };
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('=== VECTOR DATABASE CONNECTION POOLING TEST ===');
  console.log('Testing connection pooling for Azure OpenAI embedding service');
  
  try {
    // Create embedding service with connection pooling
    const { service, releaseConnection } = await createPooledEmbeddingService();
    
    // Track test results
    const results = {
      storeDocuments: null,
      queryDocuments: null,
      concurrentBatches: null,
      stressTest: null,
      initialMetrics: null,
      finalMetrics: null
    };
    
    // Check initial metrics
    results.initialMetrics = await testConnectionPoolMetrics();
    
    // Run tests
    results.storeDocuments = await testStoreDocuments(service);
    results.queryDocuments = await testQueryDocuments(service);
    results.concurrentBatches = await testConcurrentBatches(service);
    results.stressTest = await runStressTest(service);
    
    // Check final metrics
    results.finalMetrics = await testConnectionPoolMetrics();
    
    // Release connection
    console.log('\n=== Releasing Connection ===');
    await releaseConnection();
    console.log('✅ Connection released');
    
    // Print summary
    console.log('\n=== TEST SUMMARY ===');
    console.log(`Store Documents: ${results.storeDocuments.success ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Query Documents: ${results.queryDocuments.success ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Concurrent Batches: ${results.concurrentBatches.successful === results.concurrentBatches.operations ? '✅ PASSED' : '⚠️ PARTIAL'}`);
    console.log(`Stress Test: ${results.stressTest.failedOperations === 0 ? '✅ PASSED' : '⚠️ PARTIAL'}`);
    
    // Pool utilization
    const maxUtilization = results.finalMetrics.maxUsedConnections / results.finalMetrics.totalConnections;
    console.log(`Max Pool Utilization: ${(maxUtilization * 100).toFixed(1)}%`);
    
    // Operations throughput
    const totalOps = results.stressTest.totalOperations;
    const throughput = Math.floor(totalOps / (results.stressTest.duration / 1000));
    console.log(`Peak Throughput: ${throughput} operations/second`);
    
    const allPassed = 
      results.storeDocuments.success && 
      results.queryDocuments.success && 
      results.concurrentBatches.successful === results.concurrentBatches.operations && 
      results.stressTest.failedOperations === 0;
    
    console.log(`\nOverall: ${allPassed ? '✅ ALL TESTS PASSED' : '⚠️ SOME TESTS HAD ISSUES'}`);
    
    return allPassed;
  } catch (error) {
    console.error('\n❌ Test suite failed:', error.message);
    return false;
  }
}

// Run all tests
runTests()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Fatal error running tests:', error);
    process.exit(1);
  });