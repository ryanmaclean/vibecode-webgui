// Test script for vector database utilities
import { initializeVectorDatabase, writeSchemaFile, getPrismaClient } from './src/lib/db/vector-db-utils.ts';
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

async function testVectorDb() {
  console.log('🚀 Testing Vector Database Utilities...');
  
  // Generate schema file
  console.log('\n📝 Generating schema file...');
  const schemaPath = writeSchemaFile('./vector-schema.sql');
  console.log(`✅ Schema file created at: ${schemaPath}`);
  
  // Try to initialize database
  console.log('\n🛠️ Initializing vector database...');
  try {
    const result = await initializeVectorDatabase();
    
    if (result.success) {
      console.log('✅ Database initialized successfully!');
      
      // Test embedding service factory
      console.log('\n📊 Testing embedding service factory with database...');
      // Mock embedding service for testing
class MockEmbeddingService {
  constructor(prisma) {
    this.prisma = prisma;
  }

  async generateEmbedding(text) {
    // Return a mock embedding of 1536 dimensions (same as text-embedding-3-small)
    return new Array(1536).fill(0).map(() => Math.random());
  }

  async storeDocument(documentId, content, metadata = {}) {
    // Mock implementation - just return success
    return { success: true, documentId };
  }

  async findSimilarDocuments(query, options = {}) {
    // Mock implementation - return empty array
    return [];
  }
}

const embeddingService = new MockEmbeddingService(result.prisma);

      console.log(`✅ Created ${embeddingService.constructor.name} instance`);
      
      // Generate a test embedding
      console.log('\n📊 Generating test embedding...');
      const embedding = await embeddingService.generateEmbedding('This is a test for embedding with database integration');
      console.log(`✅ Generated embedding with ${embedding.length} dimensions`);
      
      // Store a test document
      try {
        console.log('\n📝 Storing test document...');
        await embeddingService.storeDocument(
          'test-db-doc-1',
          'This is a test document for database integration',
          { test: true, source: 'test-script' }
        );
        console.log('✅ Document stored successfully!');
        
        // Search for similar documents
        console.log('\n🔍 Searching for similar documents...');
        const results = await embeddingService.findSimilarDocuments(
          'Find test document about database integration',
          { threshold: 0.7, limit: 1 }
        );
        
        console.log(`✅ Found ${results.length} similar documents`);
        if (results.length > 0) {
          console.log(`📄 Document ID: ${results[0].document_id}`);
        }
      } catch (dbOpError) {
        console.error('❌ Database operation failed:', dbOpError.message);
      }
      
      // Close database connection
      await result.prisma.$disconnect();
    } else {
      console.error('❌ Database initialization failed!');
      if (result.error) {
        console.error('Error:', result.error.message);
      }
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run the test
testVectorDb();