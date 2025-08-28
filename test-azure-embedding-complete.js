#!/usr/bin/env node

/**
 * Test script for Azure OpenAI Embedding Service
 * This script tests the complete workflow of Azure embedding service,
 * including embedding generation, storage, and similarity search.
 */

import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { AzureEmbeddingService } from './src/lib/ai/azureEmbeddingService.js';
import { EmbeddingProvider, EmbeddingServiceFactory } from './src/lib/ai/embeddingServiceFactory.js';
import fs from 'fs';

// Load environment variables
const envFile = process.argv[2] || '.env';
if (fs.existsSync(envFile)) {
  console.log(`📄 Loading environment from ${envFile}`);
  dotenv.config({ path: envFile });
} else {
  console.log('📄 Using default environment variables');
  dotenv.config();
}

// Database connection configuration
const dbUrl = process.env.DATABASE_URL || 'postgresql://vibecode:password@localhost:5432/vibecode';

// Check Azure OpenAI configuration
const azureConfig = {
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  endpoint: process.env.AZURE_OPENAI_ENDPOINT,
  deploymentName: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
  apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2023-05-15'
};

// Sample documents for testing
const sampleDocuments = [
  {
    id: 'azure-doc-1',
    content: 'Azure OpenAI Service provides REST API access to OpenAI models with Azure security and compliance.',
    metadata: { category: 'service', source: 'documentation' }
  },
  {
    id: 'azure-doc-2',
    content: 'Vector embeddings help represent text data in a high-dimensional space to capture semantic meaning.',
    metadata: { category: 'concept', source: 'documentation' }
  },
  {
    id: 'azure-doc-3',
    content: 'PostgreSQL with pgvector extension allows efficient similarity search across vector embeddings.',
    metadata: { category: 'database', source: 'documentation' }
  },
  {
    id: 'azure-doc-4',
    content: 'Datadog monitoring provides insights into database performance and helps detect anomalies.',
    metadata: { category: 'monitoring', source: 'documentation' }
  },
  {
    id: 'azure-doc-5',
    content: 'The Azure Managed Identity provides secure authentication without storing credentials in code.',
    metadata: { category: 'security', source: 'documentation' }
  }
];

// Function to validate Azure configuration
function validateAzureConfig() {
  const missingVars = [];
  
  if (!azureConfig.apiKey) missingVars.push('AZURE_OPENAI_API_KEY');
  if (!azureConfig.endpoint) missingVars.push('AZURE_OPENAI_ENDPOINT');
  if (!azureConfig.deploymentName) missingVars.push('AZURE_OPENAI_DEPLOYMENT_NAME');
  
  if (missingVars.length > 0) {
    console.error('❌ Missing Azure OpenAI configuration:');
    missingVars.forEach(v => console.error(`   - ${v}`));
    return false;
  }
  
  return true;
}

// Helper function to mask sensitive information in connection strings
function maskConnectionString(connectionString) {
  if (!connectionString) return 'Not provided';
  
  try {
    // Create a URL object if it's a valid URL
    const url = new URL(connectionString);
    
    // Mask password if present
    if (url.password) {
      url.password = '****';
    }
    
    return url.toString();
  } catch (error) {
    // If it's not a valid URL, try to mask password in standard connection string format
    return connectionString.replace(/(:[\w-]+)@/, ':****@');
  }
}

// Main test function
async function runTest() {
  console.log('🚀 Azure Embedding Service Test');
  console.log('==============================\n');
  
  // Validate Azure configuration
  if (!validateAzureConfig()) {
    console.error('\n❌ Test aborted due to missing configuration.');
    process.exit(1);
  }
  
  console.log('✅ Azure OpenAI configuration validated');
  console.log(`📊 Azure Endpoint: ${azureConfig.endpoint}`);
  console.log(`📊 Azure Deployment: ${azureConfig.deploymentName}`);
  console.log(`📊 Azure API Version: ${azureConfig.apiVersion}`);
  console.log(`📊 Database URL: ${maskConnectionString(dbUrl)}`);
  
  // Create PrismaClient
  const prisma = new PrismaClient({
    datasources: { db: { url: dbUrl } }
  });
  
  try {
    // Test database connection
    console.log('\n🔌 Testing database connection...');
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Database connection successful!');
    
    // Test creating the pgvector extension
    try {
      console.log('\n🛠️ Ensuring pgvector extension is available...');
      await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS vector');
      console.log('✅ pgvector extension is ready');
    } catch (pgvectorError) {
      console.error('❌ Failed to ensure pgvector extension:', pgvectorError.message);
      console.error('   Make sure pgvector is installed in your PostgreSQL instance');
      process.exit(1);
    }
    
    // Initialize embedding service directly
    console.log('\n🔧 Initializing Azure Embedding Service...');
    const azureEmbeddingService = new AzureEmbeddingService(
      azureConfig.apiKey,
      azureConfig.endpoint,
      azureConfig.deploymentName,
      azureConfig.apiVersion,
      prisma
    );
    console.log('✅ Azure Embedding Service initialized');
    
    // Alternative: Initialize using the factory
    console.log('\n🏭 Testing EmbeddingServiceFactory...');
    const embeddingFactory = new EmbeddingServiceFactory(prisma);
    const serviceFromFactory = embeddingFactory.createEmbeddingService({
      provider: EmbeddingProvider.AZURE,
      apiKey: azureConfig.apiKey,
      endpoint: azureConfig.endpoint,
      deploymentName: azureConfig.deploymentName,
      apiVersion: azureConfig.apiVersion
    });
    console.log('✅ Factory-created embedding service initialized');
    
    // Verify that both services are working
    const factoryTestText = "Testing the factory-created service";
    await serviceFromFactory.generateEmbedding(factoryTestText);
    console.log('✅ Factory-created service can generate embeddings');
    
    // Test generating embeddings
    console.log('\n📊 Testing embedding generation...');
    const testText = 'This is a test for Azure OpenAI embeddings generation';
    const embedding = await azureEmbeddingService.generateEmbedding(testText);
    
    console.log('✅ Embedding generated successfully!');
    console.log(`📏 Vector dimensions: ${embedding.length}`);
    console.log(`🔢 First 5 dimensions: [${embedding.slice(0, 5).join(', ')}]`);
    
    // Store sample documents
    console.log('\n📝 Storing sample documents...');
    for (const doc of sampleDocuments) {
      console.log(`   - Storing document: ${doc.id}`);
      await azureEmbeddingService.storeDocument(
        doc.id,
        doc.content,
        doc.metadata
      );
    }
    console.log('✅ All sample documents stored successfully!');
    
    // Test similarity search
    console.log('\n🔍 Testing similarity search...');
    const searchQuery = 'How does Azure OpenAI Service work with security?';
    console.log(`   - Query: "${searchQuery}"`);
    
    const similarDocs = await azureEmbeddingService.findSimilarDocuments(
      searchQuery,
      { threshold: 0.5, limit: 3 }
    );
    
    console.log(`✅ Found ${similarDocs.length} similar documents`);
    if (similarDocs.length > 0) {
      console.log('\n   Similar documents:');
      similarDocs.forEach((doc, i) => {
        console.log(`   ${i+1}. Document ID: ${doc.document_id}`);
        console.log(`      Content: ${doc.content}`);
        console.log(`      Similarity: ${doc.similarity.toFixed(4)}`);
        console.log();
      });
    }
    
    // Test RAG query
    console.log('\n🤖 Testing RAG query...');
    const ragQuery = 'What are the benefits of using vector embeddings with PostgreSQL?';
    console.log(`   - Query: "${ragQuery}"`);
    
    const ragResult = await azureEmbeddingService.ragQuery(ragQuery, {
      threshold: 0.5,
      limit: 2
    });
    
    console.log('✅ RAG query successful!');
    console.log(`📊 Provider: ${ragResult.provider}`);
    console.log(`📚 Number of documents: ${ragResult.documents.length}`);
    console.log('\n   Retrieved documents:');
    ragResult.documents.forEach((doc, i) => {
      console.log(`   ${i+1}. Document ID: ${doc.document_id}`);
      console.log(`      Content: ${doc.content}`);
      console.log(`      Similarity: ${doc.similarity.toFixed(4)}`);
      console.log();
    });
    
    // Test getting statistics
    console.log('\n📈 Testing embedding statistics...');
    const stats = await azureEmbeddingService.getStats();
    
    console.log('✅ Statistics retrieved successfully!');
    console.log(`🔄 Provider: ${stats.provider}`);
    console.log(`📊 Stats available: ${stats.stats.length}`);
    if (stats.stats.length > 0) {
      console.log('\n   Latest statistics:');
      const latestStat = stats.stats[0];
      console.log(`   - Time bucket: ${latestStat.hour_bucket}`);
      console.log(`   - Total embeddings: ${latestStat.total_embeddings}`);
      console.log(`   - Avg content length: ${latestStat.avg_content_length}`);
      console.log(`   - Total searches: ${latestStat.total_searches}`);
    }
    
    console.log('\n🎉 All Azure Embedding Service tests passed successfully!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
  } finally {
    // Clean up test data (optional)
    try {
      console.log('\n🧹 Cleaning up test data...');
      await prisma.$executeRawUnsafe(
        `DELETE FROM embeddings WHERE document_id LIKE 'azure-doc-%'`
      );
      console.log('✅ Test data cleaned up');
    } catch (cleanupError) {
      console.error('⚠️ Cleanup error:', cleanupError.message);
    }
    
    // Disconnect from the database
    await prisma.$disconnect();
    console.log('🔌 Disconnected from database');
  }
}

// Run the test
runTest();