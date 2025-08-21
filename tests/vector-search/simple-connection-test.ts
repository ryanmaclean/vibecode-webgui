/**
 * Simple connection test for pgvector
 */

import { Pool } from 'pg';

async function testConnection() {
  console.log('Testing pgvector connection...');
  
  const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'vibecode',
    user: 'vibecode',
    password: 'vibecode123',
    connectionTimeoutMillis: 5000,
    max: 5
  });

  try {
    const client = await pool.connect();
    console.log('✓ Connected to PostgreSQL');
    
    // Test pgvector extension
    const extensionResult = await client.query("SELECT extname FROM pg_extension WHERE extname = 'vector'");
    if (extensionResult.rows.length > 0) {
      console.log('✓ pgvector extension is installed');
    } else {
      console.log('✗ pgvector extension not found');
    }
    
    // Test embeddings table
    const tableResult = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'embeddings'
    `);
    
    if (tableResult.rows.length > 0) {
      console.log('✓ embeddings table exists');
      
      // Count existing embeddings
      const countResult = await client.query('SELECT COUNT(*) as count FROM embeddings');
      console.log(`✓ Found ${countResult.rows[0].count} existing embeddings`);
    } else {
      console.log('✗ embeddings table not found');
    }
    
    // Test vector operations
    const vectorTest = await client.query(`
      SELECT embedding <-> array_fill(0.1, ARRAY[1536])::vector as distance 
      FROM embeddings 
      LIMIT 1
    `);
    
    if (vectorTest.rows.length > 0) {
      console.log(`✓ Vector operations working, sample distance: ${vectorTest.rows[0].distance}`);
    }
    
    client.release();
    console.log('✓ Connection test completed successfully');
    
  } catch (error) {
    console.error('✗ Connection test failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  testConnection().catch(console.error);
}
