#!/usr/bin/env node

/**
 * Simple Database Connection Test
 * Tests basic PostgreSQL connectivity and reports to Datadog
 */

console.log('🔍 Database Connection Test');
console.log('============================');

const { Client } = require('pg');

async function testDatabaseConnection() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/testdb'
  });

  try {
    console.log('📡 Connecting to database...');
    await client.connect();
    
    console.log('✅ Database connection successful');
    
    // Test basic query
    const result = await client.query('SELECT NOW() as current_time, version() as pg_version');
    console.log('📊 Database info:');
    console.log(`   Current time: ${result.rows[0].current_time}`);
    console.log(`   PostgreSQL version: ${result.rows[0].pg_version.split(' ')[0]}`);
    
    // Test table creation (if not exists)
    await client.query(`
      CREATE TABLE IF NOT EXISTS test_table (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ Test table ready');
    
    // Test insert/select
    await client.query('INSERT INTO test_table (name) VALUES ($1)', ['test_record']);
    const selectResult = await client.query('SELECT COUNT(*) as count FROM test_table');
    console.log(`📈 Test records in table: ${selectResult.rows[0].count}`);
    
    console.log('✅ Database test completed successfully');
    return { success: true, duration: Date.now() - startTime };
    
  } catch (error) {
    console.log(`❌ Database test failed: ${error.message}`);
    return { success: false, error: error.message };
  } finally {
    await client.end();
  }
}

const startTime = Date.now();
testDatabaseConnection()
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
