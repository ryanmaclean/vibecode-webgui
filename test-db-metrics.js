#!/usr/bin/env node
// Test script for database metrics
import { createPrismaWithMetrics, getDatabaseMetricsCollector } from './src/lib/db/db-metrics';
import dotenv from 'dotenv';
import fs from 'fs';

// Load environment variables
const envFile = process.argv[2] || '.env';
if (fs.existsSync(envFile)) {
  console.log(`📄 Loading environment from ${envFile}`);
  dotenv.config({ path: envFile });
} else {
  console.log('📄 Using default environment variables');
  dotenv.config();
}

async function testDatabaseMetrics() {
  console.log('🔍 Testing database metrics collection...');
  
  try {
    // Create Prisma client with metrics collection
    console.log('\n🔌 Creating Prisma client with metrics...');
    const prisma = createPrismaWithMetrics(undefined, {
      enabled: true,
      logToConsole: true,
      slowQueryThreshold: 100, // Lower threshold for testing purposes
      sampleRate: 1.0
    });
    
    // Get metrics collector
    const metricsCollector = getDatabaseMetricsCollector();
    
    // Execute some test queries
    console.log('\n🧪 Executing test queries...');
    
    // Simple query
    console.log('   Running simple query...');
    await prisma.$queryRaw`SELECT 1 as test`;
    
    // Slow query with a deliberate delay
    console.log('   Running slow query with deliberate delay...');
    await prisma.$queryRaw`
      SELECT pg_sleep(0.2), 
             current_timestamp as timestamp
    `;
    
    // Query with an error (this should be tracked in metrics)
    console.log('   Running query with error (expect an error below)...');
    try {
      await prisma.$queryRaw`SELECT * FROM nonexistent_table`;
    } catch (error) {
      console.log(`   Expected error: ${error.message}`);
    }
    
    // Run a few more queries to build up metrics
    console.log('   Running batch of queries...');
    for (let i = 0; i < 5; i++) {
      await prisma.$queryRaw`
        SELECT 
          ${i} as iteration,
          pg_sleep(${Math.random() * 0.1}) as delay
      `;
    }
    
    // Get current metrics
    console.log('\n📊 Database metrics report:');
    const metrics = metricsCollector.getMetrics();
    
    console.log(`   Total queries: ${metrics.totalQueries}`);
    console.log(`   Average query time: ${metrics.avgQueryTime.toFixed(2)}ms`);
    console.log(`   Slow queries: ${metrics.slowQueries}`);
    console.log(`   Error rate: ${(metrics.errorRate * 100).toFixed(2)}%`);
    console.log(`   P95 query time: ${metrics.p95QueryTime.toFixed(2)}ms`);
    
    // Show query types
    console.log('\n📊 Query types:');
    Object.entries(metrics.queriesByType).forEach(([type, stats]) => {
      console.log(`   ${type}: ${stats.count} queries, ${stats.avgTime.toFixed(2)}ms avg`);
    });
    
    // Full report
    console.log('\n📋 Running full metrics report:');
    metricsCollector.reportMetrics();
    
    // Close Prisma client
    console.log('\n🔌 Disconnecting from database...');
    await prisma.$disconnect();
    
    console.log('\n✅ Database metrics test completed successfully!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testDatabaseMetrics();