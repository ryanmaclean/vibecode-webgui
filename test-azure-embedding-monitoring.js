/**
 * Test script for Azure Embedding Service Monitoring
 * 
 * This script tests the monitoring metrics for Azure embedding service by:
 * 1. Generating embeddings to produce metrics
 * 2. Checking the metrics endpoint to validate metrics are recorded
 * 3. Testing connection pool metrics
 * 
 * Run with: node test-azure-embedding-monitoring.js
 */

require('dotenv').config();
const axios = require('axios');
const { AzureOpenAIClient } = require('@/lib/azure-ai-client');
const { azureEmbeddingMetrics } = require('@/lib/monitoring/azure-embedding-metrics');
const { connectionPoolMonitor } = require('@/lib/monitoring/connection-pool-monitor');

// Test data
const TEST_TEXTS = [
  "This is a short test sentence for embedding generation.",
  "The quick brown fox jumps over the lazy dog near the riverbank on a sunny afternoon.",
  "Machine learning models can process natural language to create numerical representations called embeddings, which capture semantic meaning in vector space."
];

// Configuration
const API_KEY = process.env.AZURE_OPENAI_API_KEY;
const API_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT;
const API_DEPLOYMENT = process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT || 'embedding';
const API_VERSION = process.env.AZURE_OPENAI_API_VERSION || '2023-05-15';

// Create Azure OpenAI client
const azureClient = new AzureOpenAIClient({
  apiKey: API_KEY,
  endpoint: API_ENDPOINT,
  apiVersion: API_VERSION
});

/**
 * Generate embeddings and test metrics
 */
async function testEmbeddingGeneration() {
  console.log('🧪 Testing Azure Embedding Generation Metrics');
  console.log('---------------------------------------------');
  
  // Enable development metrics 
  process.env.ENABLE_POOL_METRICS = 'true';
  process.env.ENABLE_DEV_METRICS = 'true';
  
  try {
    // 1. Generate single embedding
    console.log('Generating single embedding...');
    const startTime = Date.now();
    const singleResult = await azureClient.createEmbedding({
      input: TEST_TEXTS[0],
      model: API_DEPLOYMENT
    });
    const duration = Date.now() - startTime;
    
    console.log(`✅ Single embedding generated in ${duration}ms`);
    console.log(`   Vector dimensions: ${singleResult.data[0].embedding.length}`);
    
    // 2. Generate batch embeddings
    console.log('\nGenerating batch embeddings...');
    const batchStartTime = Date.now();
    const batchResult = await azureClient.createEmbedding({
      input: TEST_TEXTS,
      model: API_DEPLOYMENT
    });
    const batchDuration = Date.now() - batchStartTime;
    
    console.log(`✅ Batch embeddings (${TEST_TEXTS.length}) generated in ${batchDuration}ms`);
    
    // 3. Record metrics manually
    console.log('\nRecording additional test metrics...');
    
    // Record single embedding metrics
    azureEmbeddingMetrics.recordEmbeddingGeneration({
      generationTimeMs: duration,
      embeddingDimensions: singleResult.data[0].embedding.length,
      textLength: TEST_TEXTS[0].length,
      modelName: API_DEPLOYMENT,
      documentId: 'test-doc-1',
      collectionName: 'test-collection',
      tokenCount: TEST_TEXTS[0].split(' ').length * 1.3, // Rough estimate of tokens
      apiLatencyMs: duration,
      apiStatus: 200,
      apiRegion: 'eastus',
      dbOperationMs: 25, // Simulated database operation time
      dbOperationType: 'insert',
      poolUtilization: 45.5,
      poolActiveConnections: 5,
      poolSize: 11,
      acquireTimeMs: 3
    });
    
    // Record batch embedding metrics
    azureEmbeddingMetrics.recordEmbeddingGeneration({
      generationTimeMs: batchDuration,
      embeddingDimensions: batchResult.data[0].embedding.length,
      textLength: TEST_TEXTS.reduce((sum, text) => sum + text.length, 0),
      modelName: API_DEPLOYMENT,
      batchSize: TEST_TEXTS.length,
      documentId: 'test-batch-1',
      collectionName: 'test-collection',
      tokenCount: TEST_TEXTS.reduce((sum, text) => sum + text.split(' ').length, 0) * 1.3, // Rough estimate
      apiLatencyMs: batchDuration,
      apiStatus: 200,
      apiRegion: 'eastus',
      dbOperationMs: 120, // Simulated database operation time
      dbOperationType: 'batch_insert',
      poolUtilization: 72.7,
      poolActiveConnections: 8,
      poolSize: 11,
      acquireTimeMs: 5
    });
    
    // Record rate limit information
    azureEmbeddingMetrics.recordRateLimitInfo(
      240,  // Remaining requests
      300,  // Max requests
      new Date(Date.now() + 60 * 1000) // Reset in 1 minute
    );
    
    // Record an error
    azureEmbeddingMetrics.recordError(
      'ThrottlingError',
      'embedding_generation',
      429,
      'The API is currently overloaded with requests. Please retry your request.'
    );
    
    // Record similarity search metrics
    azureEmbeddingMetrics.recordSimilaritySearch(
      "What is machine learning?",
      5,
      45.6,
      0.75,
      'test-collection'
    );
    
    // Record document storage metrics
    azureEmbeddingMetrics.recordDocumentStorage(
      'test-doc-2',
      1024,
      78.5,
      1536,
      'test-collection'
    );
    
    // Update connection pool metrics
    connectionPoolMonitor.updatePoolMetrics(
      'azure-embeddings-pool',
      'api',
      {
        size: 10,
        activeConnections: 7,
        idleConnections: 3,
        waitingRequests: 2,
        acquireTime: 8,
        maxSize: 20,
        minSize: 5
      }
    );
    
    // Record a pool error
    connectionPoolMonitor.recordPoolError(
      'azure-embeddings-pool',
      'Connection timed out after 30000ms',
      'timeout_error'
    );
    
    console.log('✅ Test metrics recorded successfully');
    
    // Wait a moment for metrics to be processed
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 4. Check metrics endpoint
    console.log('\nChecking monitoring API endpoint...');
    
    try {
      const response = await axios.get('http://localhost:3000/api/monitoring/azure-embedding', {
        headers: {
          'Authorization': `Bearer ${process.env.TEST_AUTH_TOKEN || 'test-token'}`
        }
      });
      
      console.log(`✅ API Response (status ${response.status}):`);
      console.log(JSON.stringify(response.data, null, 2));
    } catch (apiError) {
      console.error('❌ Failed to call monitoring API:', apiError.message);
      
      if (apiError.response) {
        console.error('Response status:', apiError.response.status);
        console.error('Response data:', apiError.response.data);
      }
    }
    
    console.log('\n✅ Testing completed successfully');
    
  } catch (error) {
    console.error('❌ Error during testing:', error);
    
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    
    process.exit(1);
  }
}

// Run tests
testEmbeddingGeneration().catch(console.error);