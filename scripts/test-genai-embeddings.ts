// Mock OpenAI client for testing
class MockOpenAI {
  // Simple mock embedding function that generates deterministic embeddings based on text
  async embeddings() {
    return {
      data: [{
        embedding: this.textToEmbedding(this.lastInput || '')
      }]
    };
  }
  
  // Convert text to a simple deterministic embedding
  textToEmbedding(text: string): number[] {
    // Simple hash function to generate a number from text
    const hash = text.split('').reduce((acc, char) => {
      return ((acc << 5) - acc) + char.charCodeAt(0);
    }, 0);
    
    // Generate a deterministic 5-dimensional vector based on the hash
    const vector: number[] = [];
    for (let i = 0; i < 5; i++) {
      // Use Math.sin to generate a pseudo-random but deterministic number between 0 and 1
      const value = Math.abs(Math.sin(hash + i) * 0.5 + 0.5);
      vector.push(Number(value.toFixed(2)));
    }
    
    return vector;
  }
  
  // Track the last input for testing
  lastInput: string = '';
  
  // Mock create method to match the OpenAI client API
  create = {
    embeddings: (params: { input: string | string[], model?: string }) => {
      this.lastInput = Array.isArray(params.input) ? params.input[0] : params.input;
      return this.embeddings();
    }
  };
}

// Configuration
const config = {
  // Use mock implementation
  openai: new MockOpenAI(),
  
  // Test documents
  testDocuments: [
    'PostgreSQL with pgvector',
    'Vector databases for AI applications',
    'Semantic search with embeddings',
    'Machine learning model deployment',
    'Natural language processing techniques'
  ],
  
  // Test query (similar to the third document)
  testQuery: 'How to implement semantic search with vector embeddings?'
};

// In-memory storage for embeddings
const documentEmbeddings: {[key: string]: number[]} = {};

// Use the mock OpenAI client
function getOpenAIClient() {
  return config.openai;
}

// Generate embeddings for text using the mock client
async function getEmbeddings(text: string): Promise<number[]> {
  const openai = getOpenAIClient();
  try {
    const response = await openai.create.embeddings({
      input: text
    });
    
    // Log the generated embedding for debugging
    console.log(`Generated embedding for "${text}":`);
    console.log(`  ${JSON.stringify(response.data[0].embedding)}`);
    
    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embeddings:', error);
    throw error;
  }
}

// Calculate cosine similarity between two vectors
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must be of the same length');
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);
  
  if (normA === 0 || normB === 0) {
    return 0; // Avoid division by zero
  }
  
  return dotProduct / (normA * normB);
}

// Find most similar documents to the query
function findSimilarDocuments(queryEmbedding: number[], topK: number = 3) {
  const similarities = Object.entries(documentEmbeddings).map(([doc, embedding]) => ({
    document: doc,
    similarity: cosineSimilarity(queryEmbedding, embedding)
  }));
  
  return similarities
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
}

// Run the test
async function runTest() {
  console.log('🚀 Starting GenAI Embeddings Test\n');
  
  // 1. Generate embeddings for test documents
  console.log('1. Generating embeddings for test documents...');
  for (const doc of config.testDocuments) {
    console.log(`   - Processing: "${doc}"`);
    const embedding = await getEmbeddings(doc);
    documentEmbeddings[doc] = embedding;
  }
  
  // 2. Generate embedding for the query
  console.log('\n2. Generating embedding for query...');
  console.log(`   Query: "${config.testQuery}"`);
  const queryEmbedding = await getEmbeddings(config.testQuery);
  
  // 3. Find similar documents
  console.log('\n3. Finding similar documents...');
  const similarDocs = findSimilarDocuments(queryEmbedding, 3);
  
  // 4. Display results
  console.log('\n📊 Top 3 most similar documents:');
  similarDocs.forEach((result, i) => {
    console.log(`\n${i + 1}. Document: "${result.document}"`);
    console.log(`   Similarity: ${(result.similarity * 100).toFixed(1)}%`);
  });
  
  console.log('\n🎉 Test completed!');
}

// Run the test
runTest().catch(console.error);
