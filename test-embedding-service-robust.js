#!/usr/bin/env node
// Test script for embedding service factory with robust database connections
import { EmbeddingServiceFactory } from './src/lib/ai/embeddingServiceFactory.ts';
import { getConnectionPoolStatus, closeAllConnections } from './src/lib/db/robust-db-connection.ts';
import dotenv from 'dotenv';
import fs from 'fs';

// Load environment variables from specified file or default
const envFile = process.argv[2] || '.env';
if (fs.existsSync(envFile)) {
  console.log(`📄 Loading environment from ${envFile}`);
  dotenv.config({ path: envFile });
} else {
  console.log('📄 Using default environment variables');
  dotenv.config();
}

async function testEmbeddingServiceWithRobustConnection() {
  console.log('🔍 Testing embedding service with robust database connection...');
  
  // Check if DATABASE_URL is set
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not set');
    console.error('Please set DATABASE_URL in your environment or .env file');
    process.exit(1);
  }
  
  // Check if API keys are configured
  const hasAzureConfig = process.env.AZURE_OPENAI_API_KEY && 
                        process.env.AZURE_OPENAI_ENDPOINT && 
                        process.env.AZURE_OPENAI_DEPLOYMENT_NAME;
  const hasOpenAIConfig = process.env.OPENAI_API_KEY;
  
  if (!hasAzureConfig && !hasOpenAIConfig) {
    console.error('❌ No embedding service API keys configured');
    console.error('Please set either OPENAI_API_KEY or AZURE_OPENAI_API_KEY in your environment');
    process.exit(1);
  }
  
  try {
    // Create the embedding service with robust connection
    console.log('\n🔌 Creating embedding service with robust connection...');
    const { service, releaseConnection } = await EmbeddingServiceFactory.createEmbeddingServiceWithRobustConnection();
    
    console.log(`✅ Created ${service.constructor.name} successfully!`);
    
    // Check connection pool status
    const poolStatus = getConnectionPoolStatus();
    console.log('\n📊 Connection pool status:');
    console.log(`   Size: ${poolStatus.size}`);
    console.log(`   In use: ${poolStatus.inUse}`);
    
    // Generate a test embedding
    console.log('\n📊 Generating test embedding...');
    const testText = 'This is a test for robust database connection with embedding service';
    const embedding = await service.generateEmbedding(testText);
    
    console.log('✅ Generated embedding successfully!');
    console.log(`📏 Vector length: ${embedding.length}`);
    console.log(`🔢 First 5 dimensions: [${embedding.slice(0, 5).join(', ')}]`);
    
    // Store a test document
    console.log('\n📝 Storing test document...');
    const documentId = `robust-test-doc-${Date.now()}`;
    const content = 'This is a test document for robust database connection with embedding service';
    const metadata = { test: true, source: 'robust-connection-test' };
    
    await service.storeDocument(documentId, content, metadata);
    console.log('✅ Document stored successfully!');
    
    // Search for the document
    console.log('\n🔍 Searching for similar documents...');
    const searchQuery = 'test document for robust connection';
    const results = await service.findSimilarDocuments(searchQuery, { threshold: 0.7, limit: 1 });
    
    console.log(`✅ Found ${results.length} similar documents`);
    if (results.length > 0) {
      console.log(`📄 Document ID: ${results[0].document_id}`);
      console.log(`🔢 Similarity score: ${results[0].similarity.toFixed(4)}`);
    }
    
    // Get embedding stats
    console.log('\n📈 Getting embedding stats...');
    const stats = await service.getStats();
    console.log('✅ Retrieved stats successfully!');
    console.log(`📊 Stats: ${JSON.stringify(stats.stats)}`);
    
    // Create multiple instances to test connection pooling
    console.log('\n🔄 Testing connection pooling with multiple instances...');
    const instances = [];
    
    for (let i = 0; i < 3; i++) {
      console.log(`   Creating instance ${i + 1}...`);
      instances.push(await EmbeddingServiceFactory.createEmbeddingServiceWithRobustConnection());
    }
    
    // Check pool status after creating multiple instances
    const updatedPoolStatus = getConnectionPoolStatus();
    console.log('\n📊 Updated connection pool status:');
    console.log(`   Size: ${updatedPoolStatus.size}`);
    console.log(`   In use: ${updatedPoolStatus.inUse}`);
    
    // Release all connections
    console.log('\n🔌 Releasing connections...');
    releaseConnection();
    instances.forEach((instance, i) => {
      instance.releaseConnection();
      console.log(`   Released connection for instance ${i + 1}`);
    });
    
    // Check pool status after releasing
    const finalPoolStatus = getConnectionPoolStatus();
    console.log('\n📊 Final connection pool status:');
    console.log(`   Size: ${finalPoolStatus.size}`);
    console.log(`   In use: ${finalPoolStatus.inUse}`);
    
    // Close all connections
    console.log('\n🔌 Closing all connections...');
    const closeResult = await closeAllConnections();
    console.log(`✅ Closed ${closeResult.closed} connections`);
    
    console.log('\n🎉 All embedding service tests with robust connections completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Test failed:');
    console.error(`   Error: ${error.message}`);
    
    // Try to clean up
    try {
      await closeAllConnections();
    } catch (closeError) {
      console.error(`   Error closing connections: ${closeError.message}`);
    }
    
    process.exit(1);
  }
}

// Run the test
testEmbeddingServiceWithRobustConnection();