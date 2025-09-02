#!/usr/bin/env node

/**
 * End-to-End Embedding Pipeline Test
 * Tests the complete embedding workflow with OpenRouter integration
 */

import { EnhancedAIClient } from './src/lib/ai/enhanced-model-client.ts';
import { VectorService } from './src/lib/db/vector.ts';
import { createRobustConnection } from './src/lib/db/robust-db-connection.ts';
import { performance } from 'perf_hooks';

console.log('🧪 Starting End-to-End Embedding Pipeline Test');
console.log('================================================');

async function testEmbeddingPipeline() {
  let connection = null;
  
  try {
    // Step 1: Test OpenRouter connectivity and embedding generation
    console.log('\n📡 Step 1: Testing OpenRouter embedding generation...');
    
    const client = new EnhancedAIClient({
      provider: 'openrouter',
      model: 'text-embedding-ada-002' // OpenAI model via OpenRouter
    });
    
    const testText = 'This is a test document about machine learning and artificial intelligence.';
    
    console.log(`Testing text: "${testText}"`);
    
    const startTime = performance.now();
    const embeddingResponse = await client.createEmbedding(testText);
    const embeddingTime = performance.now() - startTime;
    
    console.log(`✅ Embedding generated successfully in ${embeddingTime.toFixed(1)}ms`);
    console.log(`📊 Model: ${embeddingResponse.model}`);
    console.log(`📊 Provider: ${embeddingResponse.provider}`);
    console.log(`📊 Dimensions: ${embeddingResponse.embeddings[0].length}`);
    console.log(`📊 Usage: ${embeddingResponse.usage.totalTokens} tokens`);
    
    // Step 2: Test database connection
    console.log('\n🗄️ Step 2: Testing database connection...');
    
    connection = await createRobustConnection({
      poolKey: 'embedding-e2e-test',
      enableLogging: true
    });
    
    if (!connection.success || !connection.prisma) {
      throw new Error('Failed to establish database connection');
    }
    
    console.log('✅ Database connection established');
    
    // Step 3: Test vector service integration
    console.log('\n📋 Step 3: Testing vector service integration...');
    
    const vectorService = new VectorService(connection.prisma);
    
    const testDocumentId = `test-doc-${Date.now()}`;
    const embedding = embeddingResponse.embeddings[0];
    
    console.log(`Storing document with ID: ${testDocumentId}`);
    
    const storeStartTime = performance.now();
    const result = await vectorService.upsertEmbedding({
      documentId: testDocumentId,
      content: testText,
      embedding: embedding,
      metadata: {
        testRun: true,
        timestamp: new Date().toISOString(),
        provider: 'openrouter',
        model: embeddingResponse.model
      }
    });
    const storeTime = performance.now() - storeStartTime;
    
    console.log(`✅ Document stored successfully in ${storeTime.toFixed(1)}ms`);
    console.log(`📊 Document ID: ${result.id}`);
    
    // Step 4: Test similarity search
    console.log('\n🔍 Step 4: Testing similarity search...');
    
    const searchText = 'artificial intelligence and machine learning concepts';
    console.log(`Searching for: "${searchText}"`);
    
    const searchEmbedding = await client.createEmbedding(searchText);
    
    const searchStartTime = performance.now();
    const similarDocuments = await vectorService.findSimilar(
      searchEmbedding.embeddings[0],
      5, // limit
      0.5 // threshold
    );
    const searchTime = performance.now() - searchStartTime;
    
    console.log(`✅ Similarity search completed in ${searchTime.toFixed(1)}ms`);
    console.log(`📊 Found ${similarDocuments.length} similar documents`);
    
    if (similarDocuments.length > 0) {
      console.log(`📊 Best match similarity: ${similarDocuments[0].similarity.toFixed(4)}`);
      console.log(`📊 Best match content: "${similarDocuments[0].content.substring(0, 50)}..."`);
    }
    
    // Step 5: Performance and health metrics
    console.log('\n⚡ Step 5: Performance and health metrics...');
    
    const totalTime = embeddingTime + storeTime + searchTime;
    console.log(`📈 Total pipeline time: ${totalTime.toFixed(1)}ms`);
    console.log(`📈 Embedding generation: ${embeddingTime.toFixed(1)}ms (${(embeddingTime/totalTime*100).toFixed(1)}%)`);
    console.log(`📈 Database storage: ${storeTime.toFixed(1)}ms (${(storeTime/totalTime*100).toFixed(1)}%)`);
    console.log(`📈 Similarity search: ${searchTime.toFixed(1)}ms (${(searchTime/totalTime*100).toFixed(1)}%)`);
    
    // Performance thresholds
    const performanceIssues = [];
    if (embeddingTime > 2000) performanceIssues.push('Embedding generation is slow (>2s)');
    if (storeTime > 1000) performanceIssues.push('Database storage is slow (>1s)');
    if (searchTime > 500) performanceIssues.push('Similarity search is slow (>500ms)');
    
    if (performanceIssues.length > 0) {
      console.log('\n⚠️ Performance Warnings:');
      performanceIssues.forEach(issue => console.log(`   - ${issue}`));
    }
    
    // Step 6: Cleanup test data
    console.log('\n🧹 Step 6: Cleaning up test data...');
    
    await connection.prisma.documentEmbedding.deleteMany({
      where: {
        metadata: {
          path: ['testRun'],
          equals: true
        }
      }
    });
    
    console.log('✅ Test data cleaned up successfully');
    
    console.log('\n🎉 End-to-End Embedding Pipeline Test PASSED!');
    console.log('================================================');
    console.log('✅ OpenRouter embedding generation: WORKING');
    console.log('✅ Database connection: WORKING');
    console.log('✅ Vector storage: WORKING');  
    console.log('✅ Similarity search: WORKING');
    console.log(`✅ Total pipeline performance: ${totalTime.toFixed(1)}ms`);
    
    return { success: true, metrics: { totalTime, embeddingTime, storeTime, searchTime } };
    
  } catch (error) {
    console.error('\n❌ End-to-End Embedding Pipeline Test FAILED!');
    console.error('================================================');
    console.error(`💥 Error: ${error.message}`);
    
    if (error.stack) {
      console.error('\n📍 Stack trace:');
      console.error(error.stack);
    }
    
    return { success: false, error: error.message };
    
  } finally {
    // Always clean up database connection
    if (connection && connection.release) {
      try {
        connection.release();
        console.log('\n🔌 Database connection released');
      } catch (cleanupError) {
        console.error('⚠️ Error releasing database connection:', cleanupError.message);
      }
    }
  }
}

// Run the test
testEmbeddingPipeline()
  .then(result => {
    if (result.success) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('Unexpected error running embedding pipeline test:', error);
    process.exit(1);
  });