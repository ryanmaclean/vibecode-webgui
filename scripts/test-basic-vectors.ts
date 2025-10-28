// Simple vector similarity test without external dependencies

// Test data
const testVectors = [
  { id: 'doc1', content: 'PostgreSQL with pgvector', vector: [0.1, 0.2, 0.3, 0.4, 0.5] },
  { id: 'doc2', content: 'Vector databases for AI', vector: [0.2, 0.3, 0.4, 0.5, 0.6] },
  { id: 'doc3', content: 'Semantic search with embeddings', vector: [0.3, 0.4, 0.5, 0.6, 0.7] },
];

// Query vector (similar to doc3)
const queryVector = [0.35, 0.45, 0.55, 0.65, 0.75];

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

// Find most similar vectors
function findSimilarVectors(queryVec: number[], vectors: {id: string, content: string, vector: number[]}[], topK: number = 2) {
  return vectors
    .map(doc => ({
      id: doc.id,
      content: doc.content,
      similarity: cosineSimilarity(queryVec, doc.vector)
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
}

// Run the test
console.log('🚀 Starting Vector Similarity Test\n');

console.log('Test Vectors:');
testVectors.forEach((vec, i) => {
  console.log(`\n${i + 1}. ID: ${vec.id}`);
  console.log(`   Content: ${vec.content}`);
  console.log(`   Vector: [${vec.vector.join(', ')}]`);
});

console.log('\n🔍 Query Vector:');
console.log(`   [${queryVector.join(', ')}]`);

console.log('\n🔍 Finding most similar vectors...');
const results = findSimilarVectors(queryVector, testVectors);

console.log('\n📊 Results (most similar first):');
results.forEach((result, i) => {
  console.log(`\n${i + 1}. ID: ${result.id}`);
  console.log(`   Content: ${result.content}`);
  console.log(`   Similarity: ${(result.similarity * 100).toFixed(1)}%`);
});

console.log('\n🎉 Test completed!');
