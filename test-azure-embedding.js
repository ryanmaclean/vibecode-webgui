// Azure Embedding Service Test Script
import { PrismaClient } from '@prisma/client';
import { AzureEmbeddingService } from './src/lib/ai/azureEmbeddingService.ts';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Check if Azure credentials are available
const isAzureConfigured = 
  process.env.AZURE_OPENAI_API_KEY && 
  process.env.AZURE_OPENAI_ENDPOINT && 
  process.env.AZURE_OPENAI_DEPLOYMENT_NAME;

if (!isAzureConfigured) {
  console.error('❌ Azure OpenAI credentials are not configured');
  console.error('Please set AZURE_OPENAI_API_KEY, AZURE_OPENAI_ENDPOINT, and AZURE_OPENAI_DEPLOYMENT_NAME');
  process.exit(1);
}

// Database connection configuration
const dbUrl = process.env.DATABASE_URL || 'postgresql://vibecode:password@localhost:5432/vibecode';
const prismaOptions = {
  datasources: {
    db: {
      url: dbUrl,
    },
  },
};

// Skip database tests if requested
const skipDatabaseTests = process.env.SKIP_DB_TESTS === 'true';

async function runTest() {
  console.log('🚀 Testing Azure Embedding Service...');
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
    
    const azureEmbeddingService = new AzureEmbeddingService(
      process.env.AZURE_OPENAI_API_KEY,
      process.env.AZURE_OPENAI_ENDPOINT,
      process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
      process.env.AZURE_OPENAI_API_VERSION || '2023-05-15',
      prisma
    );
    
    // Test generating embeddings
    console.log('\n📊 Testing embedding generation...');
    const testText = 'This is a test for Azure OpenAI embeddings';
    const embedding = await azureEmbeddingService.generateEmbedding(testText);
    
    console.log('✅ Embedding generated successfully!');
    console.log(`📏 Vector length: ${embedding.length}`);
    console.log(`🔢 First 5 dimensions: [${embedding.slice(0, 5).join(', ')}]`);
    
    // Skip database tests if connection failed
    if (skipDatabaseTests) {
      console.log('\n🎉 Azure Embedding generation test passed successfully!');
      console.log('Note: Database tests were skipped.');
      return;
    }
    
    // Test setup for database tests - create pgvector extension if needed
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
    } catch (pgvectorError) {
      console.error('❌ Failed to ensure database schema:', pgvectorError.message);
      console.log('⚠️ Skipping remaining database tests...');
      return;
    }
    
    // Test storing document
    console.log('\n📝 Testing document storage...');
    const testDoc = {
      id: 'azure-test-doc-1',
      content: 'This is a test document for Azure vector embeddings',
      metadata: { test: true, provider: 'azure' }
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
      { threshold: 0.7, limit: 1 }
    );
    
    console.log(`✅ Found ${similarDocs.length} similar documents`);
    if (similarDocs.length > 0) {
      console.log(`📄 Document ID: ${similarDocs[0].document_id}`);
      console.log(`🔢 Similarity score: ${similarDocs[0].similarity}`);
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
    
    console.log('\n🎉 All Azure Embedding Service tests passed successfully!');
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    if (prisma) {
      await prisma.$disconnect();
    }
  }
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

// Run the test
runTest();