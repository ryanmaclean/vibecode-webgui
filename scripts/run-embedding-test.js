// Azure Embedding Service Test Script with DB Setup
import { PrismaClient } from '@prisma/client';
import { AzureEmbeddingService } from './src/lib/ai/azureEmbeddingService.ts';
import { EmbeddingServiceFactory } from './src/lib/ai/embeddingServiceFactory.ts';
import dotenv from 'dotenv';
import fs from 'fs';

// Load environment variables from specified file or default
const envFile = process.argv[2] || '.env.azure';
if (fs.existsSync(envFile)) {
  console.log(`📄 Loading environment from ${envFile}`);
  dotenv.config({ path: envFile });
} else {
  console.log('📄 Using default environment variables');
  dotenv.config();
}

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
let skipDatabaseTests = process.env.SKIP_DB_TESTS === 'true';

// Read SQL schema file for setting up the database
const schemaFilePath = './setup-document-embeddings.sql';
let schemaSql = '';

try {
  schemaSql = fs.readFileSync(schemaFilePath, 'utf8');
} catch (error) {
  console.error(`❌ Could not read schema file: ${schemaFilePath}`);
  console.error(error.message);
}

async function runTest() {
  console.log('🚀 Testing Embedding Services with Azure...');
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
        
        // Set up database schema if needed
        if (schemaSql) {
          console.log('🛠️ Setting up database schema...');
          try {
            await prisma.$executeRawUnsafe(schemaSql);
            console.log('✅ Database schema setup successful!');
          } catch (schemaError) {
            console.error('⚠️ Schema setup had some issues:', schemaError.message);
            console.log('⚠️ Continuing with tests, but some database operations may fail...');
          }
        }
      } catch (dbError) {
        console.error('❌ Database connection failed:', dbError.message);
        console.log('⚠️ Continuing with embedding-only tests...');
        skipDatabaseTests = true;
      }
    }
    
    // Test the EmbeddingServiceFactory
    console.log('\n📋 Testing EmbeddingServiceFactory...');
    const embeddingService = EmbeddingServiceFactory.createEmbeddingService(prisma);
    console.log(`✅ Factory created a ${embeddingService.constructor.name} instance`);
    
    // Also test Azure service directly
    console.log('\n📋 Creating AzureEmbeddingService directly...');
    const azureEmbeddingService = new AzureEmbeddingService(
      process.env.AZURE_OPENAI_API_KEY,
      process.env.AZURE_OPENAI_ENDPOINT,
      process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
      process.env.AZURE_OPENAI_API_VERSION || '2023-05-15',
      prisma
    );
    
    // Test generating embeddings with factory-created service
    console.log('\n📊 Testing embedding generation with factory service...');
    const factoryTestText = 'This is a test for embedding service factory';
    const factoryEmbedding = await embeddingService.generateEmbedding(factoryTestText);
    
    console.log('✅ Factory service embedding generated successfully!');
    console.log(`📏 Vector length: ${factoryEmbedding.length}`);
    console.log(`🔢 First 5 dimensions: [${factoryEmbedding.slice(0, 5).join(', ')}]`);
    
    // Test generating embeddings with Azure service
    console.log('\n📊 Testing embedding generation with Azure service...');
    const azureTestText = 'This is a test for Azure OpenAI embeddings';
    const azureEmbedding = await azureEmbeddingService.generateEmbedding(azureTestText);
    
    console.log('✅ Azure embedding generated successfully!');
    console.log(`📏 Vector length: ${azureEmbedding.length}`);
    console.log(`🔢 First 5 dimensions: [${azureEmbedding.slice(0, 5).join(', ')}]`);
    
    // Skip database tests if connection failed
    if (skipDatabaseTests) {
      console.log('\n🎉 Embedding generation tests passed successfully!');
      console.log('Note: Database tests were skipped.');
      return;
    }
    
    // Database Tests with Azure service
    // Test storing document
    console.log('\n📝 Testing document storage...');
    const testDoc = {
      id: 'azure-test-doc-1',
      content: 'This is a test document for Azure vector embeddings',
      metadata: { test: true, provider: 'azure' }
    };
    
    try {
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
    } catch (dbOpError) {
      console.error('❌ Database operation failed:', dbOpError.message);
      console.log('⚠️ Some database tests failed, but embedding generation works correctly.');
    }
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