#!/usr/bin/env node
// Test script for database metrics
import { PrismaClient } from '@prisma/client';
import { createQueryTrackingMiddleware, getDatabaseMetricsCollector } from './src/lib/db/db-metrics';
import dotenv from 'dotenv';
import fs from 'fs';

// Load environment variables
const envFile = process.argv[2] || '.env';
if (fs.existsSync(envFile)) {
  console.log('Loading environment from ' + envFile);
  dotenv.config({ path: envFile });
} else {
  console.log('Using default environment variables');
  dotenv.config();
}

async function testDatabaseMetrics() {
  console.log('Testing database metrics collection...');
  
  try {
    // Create Prisma client with metrics middleware
    console.log('Creating Prisma client with metrics...');
    const prisma = new PrismaClient();
    
    // Apply query tracking middleware
    const queryTrackingMiddleware = createQueryTrackingMiddleware();
    prisma.$use(queryTrackingMiddleware);
    
    // Get metrics collector
    const metricsCollector = getDatabaseMetricsCollector();
    
    // Execute some test queries
    console.log('Executing test queries...');
    
    // Simple query
    console.log('  Running simple query...');
    await prisma.$queryRaw`SELECT 1 as test`;
    
    // Query with a delay using pg_sleep
    console.log('  Running query with delay...');
    await prisma.$queryRaw`SELECT current_timestamp as timestamp, (SELECT pg_sleep(0.1)::text) as slow_operation`;
    
    // Query with an error (this should be tracked in metrics)
    console.log('  Running query with error (expect an error below)...');
    try {
      await prisma.$queryRaw`SELECT * FROM nonexistent_table`;
    } catch (error) {
      console.log('  Expected error: ' + error.message);
    }
    
    // Run a few more queries to build up metrics
    console.log('  Running batch of queries...');
    for (let i = 0; i < 5; i++) {
      await prisma.$queryRaw`SELECT ${i} as iteration, current_timestamp as timestamp`;
    }
    
    // Get current metrics
    console.log('Database metrics report:');
    const metrics = metricsCollector.getMetrics();
    
    console.log('  Total queries: ' + metrics.totalQueries);
    console.log('  Average query time: ' + metrics.avgQueryTime.toFixed(2) + 'ms');
    console.log('  Slow queries: ' + metrics.slowQueries);
    console.log('  Error rate: ' + (metrics.errorRate * 100).toFixed(2) + '%');
    console.log('  P95 query time: ' + metrics.p95QueryTime.toFixed(2) + 'ms');
    
    // Show query types
    console.log('Query types:');
    Object.entries(metrics.queriesByType).forEach(([type, count]) => {
      console.log('  ' + type + ': ' + count + ' queries');
    });
    
    // Show recent queries
    console.log('Recent queries:');
    const recentQueries = metricsCollector.getRecentQueries(5);
    recentQueries.forEach((query, index) => {
      console.log('  ' + (index + 1) + '. ' + query.query + ' (' + query.duration + 'ms, ' + (query.success ? 'success' : 'error') + ')');
    });
    
    // Close Prisma client
    console.log('Disconnecting from database...');
    await prisma.$disconnect();
    
    console.log('Database metrics test completed successfully!');
  } catch (error) {
    console.log('Test failed: ' + error);
    process.exit(1);
  }
}

// Run the test
testDatabaseMetrics();
