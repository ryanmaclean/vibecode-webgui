/**
 * Test Connection Pooling with Azure Embedding Service
 * 
 * This script tests the connection pooling functionality with Azure Embedding Service
 * to verify performance and resource optimization under various load conditions.
 */

import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { AzureEmbeddingService } from './src/lib/ai/azureEmbeddingService.js';
import { EmbeddingServiceFactory, EmbeddingProvider } from './src/lib/ai/embeddingServiceFactory.js';
import { getVectorConnectionPool } from './src/lib/db/vector-connection-pool.js';

// Load environment variables
config({ path: '.env.azure' });

// Sample data for testing
const testDocuments = [
  {
    id: 'pool-test-001',
    content: 'Connection pooling improves database performance by reusing connections',
    metadata: { category: 'performance', type: 'infrastructure' }
  },
  {
    id: 'pool-test-002',
    content: 'Azure managed identity provides secure authentication without API keys',
    metadata: { category: 'security', type: 'authentication' }
  },
  {
    id: 'pool-test-003',
    content: 'Vector embeddings enable semantic search across document collections',
    metadata: { category: 'machine-learning', type: 'search' }
  },
  {
    id: 'pool-test-004',
    content: 'pgvector extension for PostgreSQL stores and indexes vector embeddings',
    metadata: { category: 'database', type: 'extension' }
  },
  {
    id: 'pool-test-005',
    content: 'Resource utilization is optimized when using connection pooling',
    metadata: { category: 'performance', type: 'optimization' }
  }
];

// Query samples
const queries = [
  'database connection pooling',
  'vector search performance',
  'authentication security',
  'optimizing resources for database operations',
  'semantic search implementations'
];

/**
 * Test connection pooling with direct instantiation
 */
async function testDirectInstantiation() {
  console.log('\n--- Testing Connection Pooling with Direct Instantiation ---');
  
  try {
    console.log('Creating AzureEmbeddingService with connection pooling...');
    const embeddingService = new AzureEmbeddingService(
      process.env.AZURE_OPENAI_API_KEY || '', // API key
      process.env.AZURE_OPENAI_ENDPOINT || '',
      process.env.AZURE_OPENAI_DEPLOYMENT_NAME || '',
      process.env.AZURE_OPENAI_API_VERSION || '2023-05-15',
      null, // No Prisma client when using connection pool
      false, // Don't use managed identity
      true  // Use connection pool
    );
    
    // Get initial pool metrics
    const initialMetrics = getVectorConnectionPool().getMetrics();
    console.log('Initial pool metrics:', JSON.stringify(initialMetrics, null, 2));
    
    // Store test documents
    console.log('\nStoring test documents...');
    for (const doc of testDocuments) {
      await embeddingService.storeDocument(doc.id, doc.content, doc.metadata);
      console.log(`  - Stored: ${doc.id}`);
    }
    
    // Get updated pool metrics
    const afterStorageMetrics = getVectorConnectionPool().getMetrics();
    console.log('\nPool metrics after storage:', JSON.stringify(afterStorageMetrics, null, 2));
    
    // Perform similarity searches
    console.log('\nPerforming similarity searches...');
    for (const query of queries) {
      const results = await embeddingService.findSimilarDocuments(query, { limit: 3 });
      console.log(`  - Query: "${query}" returned ${results.length} results`);
      for (const result of results) {
        console.log(`    * ${result.document_id} (${result.similarity.toFixed(4)}): ${result.content}`);
      }
    }
    
    // Get final pool metrics
    const finalMetrics = getVectorConnectionPool().getMetrics();
    console.log('\nFinal pool metrics:', JSON.stringify(finalMetrics, null, 2));
    
    return { 
      success: true,
      initialActiveConnections: initialMetrics.activeConnections,
      finalActiveConnections: finalMetrics.activeConnections,
      acquireCount: finalMetrics.acquireCount,
      releaseCount: finalMetrics.releaseCount
    };
  } catch (error) {
    console.error('Error in direct instantiation test:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Test connection pooling with factory pattern
 */
async function testFactoryPattern() {
  console.log('\n--- Testing Connection Pooling with Factory Pattern ---');
  
  try {
    // Create factory (need a temporary Prisma client for factory initialization)
    const tempPrisma = new PrismaClient();
    const factory = new EmbeddingServiceFactory(tempPrisma);
    
    console.log('Creating embedding service with factory...');
    const embeddingService = factory.createEmbeddingService({
      provider: EmbeddingProvider.AZURE,
      apiKey: process.env.AZURE_OPENAI_API_KEY,
      endpoint: process.env.AZURE_OPENAI_ENDPOINT,
      deploymentName: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
      apiVersion: process.env.AZURE_OPENAI_API_VERSION,
      useConnectionPool: true
    });
    
    // Get initial pool metrics
    const initialMetrics = getVectorConnectionPool().getMetrics();
    console.log('Initial pool metrics:', JSON.stringify(initialMetrics, null, 2));
    
    // Perform concurrent searches to test pool performance
    console.log('\nPerforming concurrent searches...');
    const concurrentSearches = queries.map(query => 
      embeddingService.findSimilarDocuments(query, { limit: 2 })
    );
    
    const results = await Promise.all(concurrentSearches);
    console.log(`Completed ${results.length} concurrent searches`);
    
    // Get final pool metrics
    const finalMetrics = getVectorConnectionPool().getMetrics();
    console.log('\nFinal pool metrics after concurrent searches:', JSON.stringify(finalMetrics, null, 2));
    
    // Clean up temporary Prisma client
    await tempPrisma.$disconnect();
    
    return { 
      success: true,
      concurrentSearches: results.length,
      maxConnections: finalMetrics.maxUsedConnections,
      avgAcquireTime: finalMetrics.avgAcquireTime
    };
  } catch (error) {
    console.error('Error in factory pattern test:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Test connection pooling with robust connection handling
 */
async function testRobustConnection() {
  console.log('\n--- Testing Connection Pooling with Robust Connection Handling ---');
  
  try {
    console.log('Creating embedding service with robust connection handling...');
    const { service, releaseConnection } = await EmbeddingServiceFactory
      .createEmbeddingServiceWithRobustConnection(true);
    
    // Get initial pool metrics
    const initialMetrics = getVectorConnectionPool().getMetrics();
    console.log('Initial pool metrics:', JSON.stringify(initialMetrics, null, 2));
    
    // Generate embeddings and perform a similarity search
    console.log('\nGenerating embeddings and searching...');
    const embedding = await service.generateEmbedding('Testing robust connection handling with connection pooling');
    console.log(`Generated embedding with ${embedding.length} dimensions`);
    
    const results = await service.findSimilarDocuments('connection pooling', { limit: 3 });
    console.log(`Found ${results.length} similar documents`);
    
    // Release connection (this is a no-op with connection pooling)
    await releaseConnection();
    
    // Get final pool metrics
    const finalMetrics = getVectorConnectionPool().getMetrics();
    console.log('\nFinal pool metrics:', JSON.stringify(finalMetrics, null, 2));
    
    return { success: true, embeddingSize: embedding.length, resultCount: results.length };
  } catch (error) {
    console.error('Error in robust connection test:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Test connection pooling with environment-based configuration
 */
async function testEnvironmentConfiguration() {
  console.log('\n--- Testing Connection Pooling with Environment Configuration ---');
  
  // Save original env vars
  const originalConnectionPool = process.env.USE_CONNECTION_POOL;
  
  // Set environment for connection pooling
  process.env.USE_CONNECTION_POOL = 'true';
  
  try {
    // Create a temporary Prisma client for factory initialization
    const tempPrisma = new PrismaClient();
    const factory = new EmbeddingServiceFactory(tempPrisma);
    
    console.log('Creating embedding service from environment variables...');
    const service = factory.createEmbeddingServiceFromEnv();
    
    // Get initial pool metrics
    const initialMetrics = getVectorConnectionPool().getMetrics();
    console.log('Initial pool metrics:', JSON.stringify(initialMetrics, null, 2));
    
    // Run a simple test
    console.log('\nTesting embedding generation...');
    const embedding = await service.generateEmbedding('Testing environment-based configuration with connection pooling');
    console.log(`Generated embedding with ${embedding.length} dimensions`);
    
    // Get final pool metrics
    const finalMetrics = getVectorConnectionPool().getMetrics();
    console.log('\nFinal pool metrics:', JSON.stringify(finalMetrics, null, 2));
    
    // Clean up
    await tempPrisma.$disconnect();
    
    return { success: true, embeddingSize: embedding.length };
  } catch (error) {
    console.error('Error in environment configuration test:', error);
    return { success: false, error: error.message };
  } finally {
    // Restore original env vars
    process.env.USE_CONNECTION_POOL = originalConnectionPool;
  }
}

/**
 * Test connection pool performance under load
 */
async function testPoolPerformance() {
  console.log('\n--- Testing Connection Pool Performance Under Load ---');
  
  try {
    // Create service with connection pooling
    const embeddingService = new AzureEmbeddingService(
      process.env.AZURE_OPENAI_API_KEY || '', // API key
      process.env.AZURE_OPENAI_ENDPOINT || '',
      process.env.AZURE_OPENAI_DEPLOYMENT_NAME || '',
      process.env.AZURE_OPENAI_API_VERSION || '2023-05-15',
      null, // No Prisma client when using connection pool
      false, // Don't use managed identity
      true  // Use connection pool
    );
    
    // Get initial pool metrics
    const initialMetrics = getVectorConnectionPool().getMetrics();
    console.log('Initial pool metrics:', JSON.stringify(initialMetrics, null, 2));
    
    // Generate sample queries
    const performanceQueries = Array(20).fill(0).map((_, i) => 
      `Performance test query ${i + 1} for connection pooling`
    );
    
    // Perform sequential operations
    console.log('\nRunning sequential operations...');
    const sequentialStart = Date.now();
    
    for (const query of performanceQueries.slice(0, 5)) {
      await embeddingService.generateEmbedding(query);
    }
    
    const sequentialDuration = Date.now() - sequentialStart;
    console.log(`Sequential operations completed in ${sequentialDuration}ms`);
    
    // Perform concurrent operations
    console.log('\nRunning concurrent operations...');
    const concurrentStart = Date.now();
    
    const concurrentOperations = performanceQueries.map(query => 
      embeddingService.generateEmbedding(query)
    );
    
    await Promise.all(concurrentOperations);
    
    const concurrentDuration = Date.now() - concurrentStart;
    console.log(`Concurrent operations completed in ${concurrentDuration}ms`);
    
    // Calculate performance metrics
    const operationsPerSecondSequential = (5 / (sequentialDuration / 1000)).toFixed(2);
    const operationsPerSecondConcurrent = (performanceQueries.length / (concurrentDuration / 1000)).toFixed(2);
    const speedupFactor = (sequentialDuration / 5) / (concurrentDuration / performanceQueries.length);
    
    console.log(`Sequential operations per second: ${operationsPerSecondSequential}`);
    console.log(`Concurrent operations per second: ${operationsPerSecondConcurrent}`);
    console.log(`Speedup factor: ${speedupFactor.toFixed(2)}x`);
    
    // Get final pool metrics
    const finalMetrics = getVectorConnectionPool().getMetrics();
    console.log('\nFinal pool metrics:', JSON.stringify(finalMetrics, null, 2));
    
    return { 
      success: true,
      sequentialDuration,
      concurrentDuration,
      operationsPerSecondSequential: parseFloat(operationsPerSecondSequential),
      operationsPerSecondConcurrent: parseFloat(operationsPerSecondConcurrent),
      speedupFactor: parseFloat(speedupFactor.toFixed(2)),
      maxUsedConnections: finalMetrics.maxUsedConnections,
      totalConnections: finalMetrics.totalConnections
    };
  } catch (error) {
    console.error('Error in pool performance test:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('=== TESTING AZURE EMBEDDING SERVICE WITH CONNECTION POOLING ===');
  console.log('Endpoint:', process.env.AZURE_OPENAI_ENDPOINT);
  console.log('Deployment:', process.env.AZURE_OPENAI_DEPLOYMENT_NAME);
  
  const results = {
    directInstantiation: await testDirectInstantiation(),
    factoryPattern: await testFactoryPattern(),
    robustConnection: await testRobustConnection(),
    environmentConfiguration: await testEnvironmentConfiguration(),
    poolPerformance: await testPoolPerformance()
  };
  
  console.log('\n=== TEST RESULTS ===');
  Object.entries(results).forEach(([test, result]) => {
    console.log(`${test}: ${result.success ? '✅ PASSED' : '❌ FAILED'}`);
    if (!result.success) {
      console.log(`  Error: ${result.error}`);
    }
  });
  
  const allPassed = Object.values(results).every(result => result.success === true);
  console.log(`\nOverall: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
  
  // Performance summary
  if (results.poolPerformance.success) {
    console.log('\n=== PERFORMANCE SUMMARY ===');
    console.log(`Sequential operations: ${results.poolPerformance.operationsPerSecondSequential} ops/sec`);
    console.log(`Concurrent operations: ${results.poolPerformance.operationsPerSecondConcurrent} ops/sec`);
    console.log(`Speedup from connection pooling: ${results.poolPerformance.speedupFactor}x`);
    console.log(`Maximum connections used: ${results.poolPerformance.maxUsedConnections}`);
  }
  
  return allPassed;
}

// Run the tests
runTests()
  .then(success => {
    // Clean up the connection pool before exiting
    getVectorConnectionPool().shutdown()
      .then(() => {
        process.exit(success ? 0 : 1);
      })
      .catch(error => {
        console.error('Error shutting down connection pool:', error);
        process.exit(1);
      });
  })
  .catch(error => {
    console.error('Error running tests:', error);
    process.exit(1);
  });