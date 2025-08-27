import * as sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import dotenv from 'dotenv';

dotenv.config();

// Configuration
const config = {
  // SQLite configuration
  dbPath: './test-vectors.db',
  
  // Test data
  testVectors: [
    { id: 'doc1', content: 'PostgreSQL with pgvector', vector: [0.1, 0.2, 0.3, 0.4, 0.5] },
    { id: 'doc2', content: 'Vector databases for AI', vector: [0.2, 0.3, 0.4, 0.5, 0.6] },
    { id: 'doc3', content: 'Semantic search with embeddings', vector: [0.3, 0.4, 0.5, 0.6, 0.7] },
  ],
  
  // Test query vector (similar to doc3)
  queryVector: [0.35, 0.45, 0.55, 0.65, 0.75],
};

// Initialize database
async function initializeDatabase() {
  try {
    // Open a database connection
    const db = await open({
      filename: config.dbPath,
      driver: sqlite3.Database,
    });
    
    // Enable SQLite VSS extension
    await db.get("SELECT 1"); // Test connection
    
    // Create tables
    await db.exec(`
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE VIRTUAL TABLE IF NOT EXISTS vss_documents USING vss0(
        vector(5)
      );
    `);
    
    // Clear existing test data
    await db.run('DELETE FROM documents');
    await db.run('DELETE FROM vss_documents');
    
    await db.close();
    console.log('✅ Database initialized');
    return true;
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    throw error;
  }
}

// Store test vectors
async function storeVectors() {
  const db = await open({
    filename: config.dbPath,
    driver: sqlite3.Database,
  });
  
  try {
    for (const item of config.testVectors) {
      // Insert into documents table
      await db.run(
        'INSERT INTO documents (id, content) VALUES (?, ?)',
        [item.id, item.content]
      );
      
      // Insert into vector index
      await db.run(
        'INSERT INTO vss_documents (rowid, vector) VALUES (?, ?)',
        [item.id, JSON.stringify(item.vector)]
      );
    }
    
    console.log(`✅ Stored ${config.testVectors.length} test vectors`);
    return true;
  } catch (error) {
    console.error('❌ Error storing vectors:', error);
    throw error;
  } finally {
    await db.close();
  }
}

// Perform similarity search
async function testSimilaritySearch() {
  const db = await open({
    filename: config.dbPath,
    driver: sqlite3.Database,
  });
  
  try {
    // Query for similar vectors
    const results = await db.all(
      `SELECT d.id, d.content, 
             1 - vss_distance(vss_documents.vector, ?) as similarity
       FROM vss_documents
       JOIN documents d ON d.id = vss_documents.rowid
       WHERE vss_search(vss_documents.vector, ?)
       ORDER BY similarity DESC
       LIMIT 2`,
      [JSON.stringify(config.queryVector), JSON.stringify(config.queryVector)]
    );
    
    console.log('\n🔍 Similarity search results:');
    results.forEach((row, index) => {
      console.log(`\n${index + 1}. ID: ${row.id}`);
      console.log(`   Content: ${row.content}`);
      console.log(`   Similarity: ${(row.similarity * 100).toFixed(1)}%`);
    });
    
    return results;
  } catch (error) {
    console.error('❌ Error performing similarity search:', error);
    throw error;
  } finally {
    await db.close();
  }
}

// Run tests
async function runTests() {
  console.log('🚀 Starting Vector Database Tests with SQLite VSS');
  
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
