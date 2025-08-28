// Azure Embedding Service Direct Test
// Tests the Azure embedding service directly with actual Azure credentials

import { PrismaClient } from '@prisma/client';
import { AzureEmbeddingService } from './src/lib/ai/azureEmbeddingService.ts';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Azure OpenAI credentials
// Using environment variables or hardcoded for testing
const AZURE_OPENAI_API_KEY = process.env.AZURE_OPENAI_API_KEY || 'b2afc587eafc4ca0a777d0e56faadf0e';
const AZURE_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT || 'https://eastus.api.cognitive.microsoft.com/';
const AZURE_OPENAI_DEPLOYMENT_NAME = process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'text-embedding-3-small';
const AZURE_OPENAI_API_VERSION = process.env.AZURE_OPENAI_API_VERSION || '2023-05-15';

// Database connection configuration
const dbUrl = process.env.DATABASE_URL || 'postgresql://vibecode:password@localhost:5432/vibecode';
const prismaOptions = {
  datasources: {
    db: {
      url: dbUrl,
    },
  },
};

// Option to skip database tests
let skipDatabaseTests = process.env.SKIP_DB_TESTS === 'true';

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

async function runTest() {
  console.log('🚀 Testing Azure Embedding Service directly...');
  console.log('📝 Azure OpenAI Configuration:');
  console.log(`   - Endpoint: ${AZURE_OPENAI_ENDPOINT}`);
  console.log(`   - Deployment: ${AZURE_OPENAI_DEPLOYMENT_NAME}`);
  console.log(`   - API Version: ${AZURE_OPENAI_API_VERSION}`);
  console.log(`📊 Database URL: ${maskConnectionString(dbUrl)}`);
  console.log(`📊 Skip DB Tests: ${skipDatabaseTests ? 'Yes' : 'No'}`);
  
  let prisma;
  
  try {
    // Create PrismaClient with connection URL
    prisma = new PrismaClient(prismaOptions);
    
    // Test database connection
    if (!skipDatabaseTests) {
      try {
        console.log('🔌 Testing database connection...');
        await prisma.$queryRaw`SELECT 1`;
        console.log('✅ Database connection successful!');
      } catch (dbError) {
        console.error('❌ Database connection failed:', dbError.message);
        console.log('⚠️ Continuing with embedding-only tests...');
        skipDatabaseTests = true;
      }
    }
    
    // Create the Azure Embedding Service
    console.log('🔨 Creating Azure Embedding Service...');
    const azureEmbeddingService = new AzureEmbeddingService(
      AZURE_OPENAI_API_KEY,
      AZURE_OPENAI_ENDPOINT,
      AZURE_OPENAI_DEPLOYMENT_NAME,
      AZURE_OPENAI_API_VERSION,
      prisma
    );
    
    // Test generating embeddings
    console.log('\n📊 Testing embedding generation...');
    const testText = 'This is a test for Azure OpenAI embeddings';
    const embedding = await azureEmbeddingService.generateEmbedding(testText);
    
    console.log('✅ Embedding generated successfully!');
    console.log(`📏 Vector length: ${embedding.length}`);
    console.log(`🔢 First 5 dimensions: [${embedding.slice(0, 5).join(', ')}]`);
    
    // Skip database tests if connection failed or requested
    if (skipDatabaseTests) {
      console.log('\n🎉 Azure Embedding generation test passed successfully!');
      console.log('Note: Database tests were skipped.');
      return;
    }
    
    // Test setup for database tests - create pgvector extension and table if needed
    try {
      console.log('\n🛠️ Setting up pgvector extension if needed...');
      await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS vector`);
      
      // Create document_embeddings table if it doesn't exist
      console.log('🛠️ Setting up document_embeddings table if needed...');
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS document_embeddings (
          id SERIAL PRIMARY KEY,
          document_id VARCHAR(255) UNIQUE NOT NULL,
          content TEXT NOT NULL,
          embedding vector(1536),
          metadata JSONB DEFAULT '{}',
          embedding_generation_time_ms INTEGER DEFAULT 0,
          search_count INTEGER DEFAULT 0,
          last_accessed_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      
      console.log('✅ Database schema ready');
    } catch (schemaError) {
      console.error('❌ Failed to ensure database schema:', schemaError.message);
      console.log('⚠️ Skipping remaining database tests...');
      return;
    }
    
    // Test storing document
    console.log('\n📝 Testing document storage...');
    const testDoc = {
      id: 'azure-test-doc-direct-1',
      content: 'This is a test document for Azure vector embeddings direct test',
      metadata: { test: true, provider: 'azure', direct: true }
    };
    
    await azureEmbeddingService.storeDocument(
      testDoc.id,
      testDoc.content,
      testDoc.metadata
    );
    
    console.log('✅ Document stored successfully!');
    
    // Test similarity search
    console.log('\n🔍 Testing similar documents search...');
    const similarDocs = await azureEmbeddingService.findSimilarDocuments(
      'Find test document about Azure vector embeddings',
      { threshold: 0.5, limit: 3 }
    );
    
    console.log(`✅ Found ${similarDocs.length} similar documents`);
    if (similarDocs.length > 0) {
      console.log('📄 Documents found:');
      similarDocs.forEach((doc, index) => {
        console.log(`  ${index + 1}. ID: ${doc.document_id}, Score: ${doc.similarity.toFixed(4)}`);
        console.log(`     Content: ${doc.content.substring(0, 50)}...`);
      });
    }
    
    // Test RAG query
    console.log('\n🤖 Testing RAG query...');
    const testQuery = 'What are Azure vector embeddings?';
    const result = await azureEmbeddingService.ragQuery(testQuery, {
      threshold: 0.5,
      limit: 2
    });
    
    console.log('✅ RAG query successful!');
    console.log(`📊 Provider: ${result.provider}`);
    console.log(`📚 Number of documents: ${result.documents.length}`);
    
    // Test statistics
    console.log('\n📈 Testing embedding statistics...');
    const stats = await azureEmbeddingService.getStats();
    
    console.log('✅ Statistics retrieved successfully!');
    console.log(`🔄 Provider: ${stats.provider}`);
    console.log(`📊 Stats hours: ${stats.stats.length}`);
    
    console.log('\n🎉 All Azure Embedding Service tests passed successfully!');
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    if (prisma) {
      await prisma.$disconnect();
    }
  }
}

// Run the test
runTest();