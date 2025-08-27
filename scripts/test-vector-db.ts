import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Configuration
const config = {
  // PostgreSQL configuration
  pgConfig: {
    user: process.env.USER || 'ryan.maclean',
    host: 'localhost',
    database: 'vibecode',
    password: '',
    port: 5432,
  },
};

// Test data
const testVectors = [
  { id: 'doc1', content: 'PostgreSQL with pgvector', vector: [0.1, 0.2, 0.3, 0.4, 0.5] },
  { id: 'doc2', content: 'Vector databases for AI', vector: [0.2, 0.3, 0.4, 0.5, 0.6] },
  { id: 'doc3', content: 'Semantic search with embeddings', vector: [0.3, 0.4, 0.5, 0.6, 0.7] },
];

// Initialize database
async function initializeDatabase() {
  const pool = new Pool(config.pgConfig);
  const client = await pool.connect();
  
  try {
    // Enable pgvector extension if not exists
    await client.query('CREATE EXTENSION IF NOT EXISTS vector');
    
    // Create documents table with vector column
    await client.query(`
      CREATE TABLE IF NOT EXISTS test_vectors (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        embedding VECTOR(5),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    
    // Clear existing test data
    await client.query('TRUNCATE TABLE test_vectors');
    
    console.log('✅ Database initialized');
    return true;
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Store test vectors
async function storeVectors() {
  const pool = new Pool(config.pgConfig);
  const client = await pool.connect();
  
  try {
    for (const item of testVectors) {
      await client.query(
        'INSERT INTO test_vectors (id, content, embedding) VALUES ($1, $2, $3)',
        [item.id, item.content, `[${item.vector.join(',')}]`]
      );
    }
    console.log(`✅ Stored ${testVectors.length} test vectors`);
    return true;
  } catch (error) {
    console.error('❌ Error storing vectors:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Perform similarity search
async function testSimilaritySearch() {
  const pool = new Pool(config.pgConfig);
  const client = await pool.connect();
  
  try {
    // Test query vector (similar to doc3)
    const queryVector = [0.35, 0.45, 0.55, 0.65, 0.75];
    
    const result = await client.query(
      `SELECT id, content, 
             1 - (embedding <=> $1) as similarity
       FROM test_vectors
       ORDER BY embedding <=> $1
       LIMIT 2`,
      [`[${queryVector.join(',')}]`]
    );
    
    console.log('\n🔍 Similarity search results:');
    result.rows.forEach((row, index) => {
      console.log(`\n${index + 1}. ID: ${row.id}`);
      console.log(`   Content: ${row.content}`);
      console.log(`   Similarity: ${(row.similarity * 100).toFixed(1)}%`);
    });
    
    return result.rows;
  } catch (error) {
    console.error('❌ Error performing similarity search:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run tests
async function runTests() {
  console.log('🚀 Starting Vector Database Tests');
  
  try {
    // 1. Initialize database
    console.log('\n1. Initializing database...');
    await initializeDatabase();
    
    // 2. Store test vectors
    console.log('\n2. Storing test vectors...');
    await storeVectors();
    
    // 3. Test similarity search
    console.log('\n3. Testing similarity search...');
    await testSimilaritySearch();
    
    console.log('\n🎉 All tests completed successfully!');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the tests
runTests().catch(console.error);
