#!/usr/bin/env node

/**
 * Simple Database Connection Pooling Test
 * Tests basic PostgreSQL connection pooling functionality
 */

const { Pool } = require('pg');

console.log('🔗 Database Connection Pooling Test');
console.log('===================================');

async function testConnectionPooling() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/testdb',
    max: 10, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
    connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
  });

  try {
    console.log('📡 Testing connection pool...');
    
    // Test basic connection
    const client = await pool.connect();
    console.log('✅ Pool connection successful');
    
    // Test query
    const result = await client.query('SELECT NOW() as current_time');
    console.log(`📊 Current time: ${result.rows[0].current_time}`);
    
    client.release();
    console.log('✅ Connection released back to pool');
    
    // Test multiple concurrent connections
    console.log('🔄 Testing concurrent connections...');
    const promises = [];
    
    for (let i = 0; i < 5; i++) {
      promises.push(
        pool.query(`SELECT $1 as connection_id, NOW() as timestamp`, [i])
      );
    }
    
    const results = await Promise.all(promises);
    console.log(`✅ ${results.length} concurrent queries completed`);
    
    // Test pool statistics
    console.log('📈 Pool Statistics:');
    console.log(`   Total connections: ${pool.totalCount}`);
    console.log(`   Idle connections: ${pool.idleCount}`);
    console.log(`   Waiting clients: ${pool.waitingCount}`);
    
    console.log('✅ Connection pooling test completed successfully');
    return { success: true };
    
  } catch (error) {
    console.log(`❌ Connection pooling test failed: ${error.message}`);
    return { success: false, error: error.message };
  } finally {
    await pool.end();
    console.log('🧹 Pool closed');
  }
}

const startTime = Date.now();
testConnectionPooling()
  .then(result => {
    const duration = Date.now() - startTime;
    console.log(`\n📊 Test Summary:`);
    console.log(`   Status: ${result.success ? 'PASS' : 'FAIL'}`);
    console.log(`   Duration: ${duration}ms`);
    
    if (!result.success) {
      console.log(`   Error: ${result.error}`);
      process.exit(1);
    }
  })
  .catch(error => {
    console.log(`❌ Test execution failed: ${error.message}`);
    process.exit(1);
  });
