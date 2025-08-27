#!/usr/bin/env node
// Test script for the database health check endpoint
import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Get the base URL from environment or use default
const baseUrl = process.env.APP_URL || 'http://localhost:3000';
const endpoint = '/api/health/db';

// Command line arguments for format and verbosity
const args = process.argv.slice(2);
const format = args.includes('--text') ? 'text' : 'json';
const verbose = args.includes('--verbose') ? 'true' : 'false';

async function testDbHealthEndpoint() {
  console.log('🔍 Testing database health check endpoint...');
  console.log(`📌 URL: ${baseUrl}${endpoint}?format=${format}&verbose=${verbose}`);
  
  try {
    const response = await fetch(`${baseUrl}${endpoint}?format=${format}&verbose=${verbose}`, {
      method: 'GET',
      headers: {
        'Accept': format === 'text' ? 'text/plain' : 'application/json',
      },
    });
    
    console.log(`📊 Status: ${response.status} ${response.statusText}`);
    
    if (format === 'text') {
      const text = await response.text();
      console.log('\n📋 Response:');
      console.log(text);
    } else {
      const json = await response.json();
      console.log('\n📋 Response:');
      console.log(JSON.stringify(json, null, 2));
      
      // Summary
      if (json.status === 'ok') {
        console.log('\n✅ Database health check passed!');
        console.log(`⏱️  Latency: ${json.latency}`);
        console.log(`🗄️  Database: ${json.database.name} (${json.database.version?.split(',')[0]})`);
        console.log(`🧩 pgvector: ${json.pgvector.installed ? `Installed (${json.pgvector.version})` : 'Not installed'}`);
        
        if (json.embeddings) {
          console.log(`📈 Embeddings: ${json.embeddings.total_embeddings} total`);
        }
        
        console.log(`🔌 Connection pool: ${json.poolStatus.inUse}/${json.poolStatus.size} (max: ${json.poolStatus.maxSize})`);
      } else {
        console.log('\n❌ Database health check failed!');
        console.log(`⚠️  Error: ${json.error}`);
      }
    }
    
  } catch (error) {
    console.error('\n❌ Failed to connect to health check endpoint:');
    console.error(`   Error: ${error.message}`);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 This usually means the server is not running.');
      console.error('   Try starting the server with "npm run dev" first.');
    }
    
    process.exit(1);
  }
}

// Run the test
testDbHealthEndpoint();