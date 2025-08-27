// Test script for Azure Embedding Service with mocked database
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

// Create a mock PrismaClient for testing
const mockPrisma = {
  $queryRaw: async () => [{ result: 'mocked' }],
  $executeRaw: async () => 1,
  $executeRawUnsafe: async () => 1,
  $disconnect: async () => console.log('Disconnected from mock database'),
};

// Create a mock VectorService that doesn't rely on a real database
class MockVectorService {
  storage = new Map();
  
  async upsertEmbedding(params) {
    const { documentId, content, embedding, metadata } = params;
    
    this.storage.set(documentId, {
      id: Math.floor(Math.random() * 1000),
      document_id: documentId,
      content,
      embedding,
      metadata,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    
    return 1; // Simulate 1 row affected
  }
  
  async findSimilarDocuments(params) {
    // Simplified implementation that returns all stored documents
    // In a real implementation, this would calculate cosine similarity
    const results = [];
    
    for (const [_, doc] of this.storage.entries()) {
      results.push({
        id: doc.id,
        document_id: doc.document_id,
        content: doc.content,
        similarity: 0.95, // Mock similarity score
      });
    }
    
    return results.slice(0, params.limit || 5);
  }
  
  async getEmbeddingStats() {
    return [{
      hour_bucket: new Date().toISOString(),
      total_embeddings: this.storage.size,
      avg_content_length: 100,
      avg_generation_time_ms: 250,
      total_searches: 5
    }];
  }
  
  async cleanupOldEmbeddings() {
    return { deletedCount: 0 };
  }
}

// Create a customized Azure Embedding Service that uses the mock VectorService
class MockableAzureEmbeddingService extends AzureEmbeddingService {
  constructor(apiKey, endpoint, deploymentName, apiVersion, mockVectorService) {
    // Pass the mock prisma to parent constructor but ignore it
    super(apiKey, endpoint, deploymentName, apiVersion, mockPrisma);
    
    // Override the vectorService with our mock
    this.vectorService = mockVectorService;
  }
}

async function testMockedEmbeddingService() {
  console.log('🚀 Testing Azure Embedding Service with mocked database...');
  
  // Create the mock vector service
  const mockVectorService = new MockVectorService();
  
  // Create the mockable Azure embedding service
  const azureEmbeddingService = new MockableAzureEmbeddingService(
    process.env.AZURE_OPENAI_API_KEY,
    process.env.AZURE_OPENAI_ENDPOINT,
    process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
    process.env.AZURE_OPENAI_API_VERSION || '2023-05-15',
    mockVectorService
  );
  
  try {
    // Test generating embeddings (this uses the real Azure API)
    console.log('\n📊 Testing embedding generation...');
    const testText = 'This is a test for Azure OpenAI embeddings';
    const embedding = await azureEmbeddingService.generateEmbedding(testText);
    
    console.log('✅ Embedding generated successfully!');
    console.log(`📏 Vector length: ${embedding.length}`);
    console.log(`🔢 First 5 dimensions: [${embedding.slice(0, 5).join(', ')}]`);
    
    // Test storing document (this uses the mock vector service)
    console.log('\n📝 Testing document storage with mock database...');
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
    
    console.log('✅ Document stored successfully in mock database!');
    
    // Test similarity search (this uses the mock vector service)
    console.log('\n🔍 Testing similar documents search with mock database...');
    const similarDocs = await azureEmbeddingService.findSimilarDocuments(
      'Find test document about Azure vector embeddings',
      { threshold: 0.7, limit: 1 }
    );
    
    console.log(`✅ Found ${similarDocs.length} similar documents`);
    if (similarDocs.length > 0) {
      console.log(`📄 Document ID: ${similarDocs[0].document_id}`);
      console.log(`🔢 Similarity score: ${similarDocs[0].similarity}`);
    }
    
    // Test RAG query (this uses both real Azure API and mock vector service)
    console.log('\n🤖 Testing RAG query with mock database...');
    const testQuery = 'What are Azure vector embeddings?';
    const result = await azureEmbeddingService.ragQuery(testQuery, {
      threshold: 0.5,
      limit: 2
    });
    
    console.log('✅ RAG query successful!');
    console.log(`📊 Provider: ${result.provider}`);
    console.log(`📚 Number of documents: ${result.documents.length}`);
    
    // Test statistics (this uses the mock vector service)
    console.log('\n📈 Testing embedding statistics with mock database...');
    const stats = await azureEmbeddingService.getStats();
    
    console.log('✅ Statistics retrieved successfully!');
    console.log(`🔄 Provider: ${stats.provider}`);
    console.log(`📊 Stats: ${JSON.stringify(stats.stats)}`);
    
    console.log('\n🎉 All Azure Embedding Service tests passed successfully with mocked database!');
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testMockedEmbeddingService();