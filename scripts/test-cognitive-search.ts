import { CognitiveSearchVectorDatabaseAdapter } from '../src/lib/vector-db/cognitive-search-vector-database-adapter';
import { VectorChunk, SearchOptions } from '../src/lib/vector-db/vector-types';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configuration for Azure Cognitive Search
const config = {
  endpoint: process.env.AZURE_SEARCH_ENDPOINT || '',
  apiKey: process.env.AZURE_SEARCH_KEY || '',
  indexName: 'test-vector-index',
  enableLogging: true,
  enableMetrics: true,
};

// Test data
const testChunks: VectorChunk[] = [
  {
    id: 'doc1-chunk1',
    content: 'This is a test document about artificial intelligence',
    embedding: Array(1536).fill(0.1), // Sample embedding
    metadata: {
      documentId: 'doc1',
      chunkIndex: 0,
      title: 'AI Basics'
    }
  },
  {
    id: 'doc1-chunk2',
    content: 'Machine learning is a subset of AI',
    embedding: Array(1536).fill(0.2), // Sample embedding
    metadata: {
      documentId: 'doc1',
      chunkIndex: 1,
      title: 'AI Basics'
    }
  }
];

async function runTests() {
  console.log('🚀 Starting Azure Cognitive Search Vector Database Tests');
  
  // Initialize the adapter
  const adapter = new CognitiveSearchVectorDatabaseAdapter(config);
  
  try {
    // Test connection
    console.log('\n🔌 Testing connection...');
    const isConnected = await adapter.ping();
    console.log(`✅ Connection test: ${isConnected ? 'SUCCESS' : 'FAILED'}`);
    
    if (!isConnected) {
      throw new Error('Failed to connect to Azure Cognitive Search');
    }
    
    // Test storing chunks
    console.log('\n📝 Testing chunk storage...');
    await adapter.storeChunks(testChunks);
    console.log('✅ Successfully stored test chunks');
    
    // Test similarity search
    console.log('\n🔍 Testing similarity search...');
    const searchOptions: SearchOptions = {
      limit: 1,
      minScore: 0.7,
      filter: { documentId: 'doc1' }
    };
    
    const searchResults = await adapter.similaritySearch(
      'artificial intelligence',
      searchOptions
    );
    
    console.log(`✅ Found ${searchResults.length} results`);
    console.log('Top result:', {
      content: searchResults[0]?.content?.substring(0, 50) + '...',
      score: searchResults[0]?.score
    });
    
    // Test getting chunks by document ID
    console.log('\n📄 Testing get chunks by document ID...');
    const chunks = await adapter.getDocumentChunks('doc1');
    console.log(`✅ Found ${chunks.length} chunks for document`);
    
    // Test deleting chunks
    console.log('\n🗑️  Testing chunk deletion...');
    const deletedCount = await adapter.deleteFileChunks('doc1');
    console.log(`✅ Deleted ${deletedCount} chunks`);
    
    // Verify deletion
    const remainingChunks = await adapter.getDocumentChunks('doc1');
    console.log(`✅ Remaining chunks after deletion: ${remainingChunks.length}`);
    
    console.log('\n🎉 All tests completed successfully!');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    // Clean up
    try {
      await adapter.close();
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }
}

// Run the tests
runTests().catch(console.error);
