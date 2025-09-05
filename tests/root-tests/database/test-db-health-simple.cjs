#!/usr/bin/env node

/**
 * Simple Database Health Test
 * Tests database connectivity without requiring a running server
 */

const { PrismaClient } = require('@prisma/client');

console.log('🏥 Database Health Check Test');
console.log('==============================');

async function testDatabaseHealth() {
  const prisma = new PrismaClient();
  
  try {
    console.log('📡 Testing database connectivity...');
    
    // Test basic connection
    await prisma.$connect();
    console.log('✅ Database connection successful');
    
    // Test query performance
    const startTime = Date.now();
    const result = await prisma.$queryRaw`SELECT NOW() as current_time, version() as version`;
    const queryTime = Date.now() - startTime;
    
    console.log(`📊 Query executed in ${queryTime}ms`);
    console.log(`📅 Current time: ${result[0].current_time}`);
    console.log(`🗄️  PostgreSQL version: ${result[0].version.split(' ')[0]}`);
    
    // Test database size
    const dbSize = await prisma.$queryRaw`SELECT pg_size_pretty(pg_database_size(current_database())) as size`;
    console.log(`💾 Database size: ${dbSize[0].size}`);
    
    // Test connection pool
    const poolInfo = await prisma.$queryRaw`
      SELECT 
        setting as max_connections,
        (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active_connections
      FROM pg_settings 
      WHERE name = 'max_connections'
    `;
    
    console.log(`🔗 Connection pool: ${poolInfo[0].active_connections}/${poolInfo[0].max_connections} active`);
    
    console.log('✅ Database health check completed successfully');
    return { success: true, queryTime };
    
  } catch (error) {
    console.log(`❌ Database health check failed: ${error.message}`);
    return { success: false, error: error.message };
  } finally {
    await prisma.$disconnect();
    console.log('🔌 Database connection closed');
  }
}

const startTime = Date.now();
testDatabaseHealth()
  .then(result => {
    const duration = Date.now() - startTime;
    console.log(`\n📊 Test Summary:`);
    console.log(`   Status: ${result.success ? 'PASS' : 'FAIL'}`);
    console.log(`   Duration: ${duration}ms`);
    
    if (result.success) {
      console.log(`   Query time: ${result.queryTime}ms`);
    } else {
      console.log(`   Error: ${result.error}`);
      process.exit(1);
    }
  })
  .catch(error => {
    console.log(`❌ Test execution failed: ${error.message}`);
    process.exit(1);
  });
