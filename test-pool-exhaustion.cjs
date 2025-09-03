#!/usr/bin/env node
/**
 * Pool Exhaustion Simulation Test
 * Creates concurrent database connections to trigger pool alerts
 */

const { PrismaClient } = require('@prisma/client');

async function simulatePoolExhaustion() {
  console.log('🔥 Pool Exhaustion Simulation Test');
  console.log('=====================================\n');

  const connections = [];
  
  try {
    // Create multiple concurrent connections to exhaust the pool
    console.log('Creating 10 concurrent database connections...');
    
    for (let i = 0; i < 10; i++) {
      const prisma = new PrismaClient();
      await prisma.$connect();
      connections.push(prisma);
      console.log(`Connection ${i + 1} established`);
      
      // Simulate a long-running query to hold connections
      prisma.$queryRaw`SELECT pg_sleep(30)`.catch(() => {});
    }

    console.log('\n💥 Pool should now be under stress!');
    console.log('Testing health and alerts endpoints...\n');

    // Test health endpoint during stress
    const healthResponse = await fetch('http://localhost:3001/api/health/db', {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const healthData = await healthResponse.json();
    
    console.log('🏥 Health Check Result:');
    console.log('Status:', healthData.status);
    console.log('Pool Status:', JSON.stringify(healthData.poolStatus, null, 2));

    // Try to test pool alerts (will need auth)
    const alertResponse = await fetch('http://localhost:3001/api/monitoring/pool-alerts', {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    
    console.log('\n🚨 Pool Alerts Result:');
    console.log('Status:', alertResponse.status);
    console.log('Response:', await alertResponse.text());

  } catch (error) {
    console.error('Error during pool exhaustion test:', error);
  } finally {
    // Clean up connections
    console.log('\n🧹 Cleaning up connections...');
    for (const prisma of connections) {
      await prisma.$disconnect().catch(() => {});
    }
  }
}

simulatePoolExhaustion();