#!/usr/bin/env node
/**
 * Simple Health Check Test
 * Tests just the database health endpoint to verify core functionality
 */

const http = require('http');

console.log('🏗️  Simple Health Check Test');
console.log('==============================\n');

async function testHealthEndpoint() {
  const url = 'http://localhost:3001/api/health/db';
  
  console.log(`🔍 Testing Database Health: ${url}`);
  
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: 10000 }, (res) => {
      console.log(`✅ Response: HTTP ${res.statusCode} (${res.statusMessage})`);
      
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          console.log('📊 Response data:');
          console.log(JSON.stringify(parsed, null, 2));
        } catch (e) {
          console.log('📄 Raw response:', data);
        }
        resolve();
      });
    });
    
    req.on('error', (err) => {
      console.log(`❌ Request failed: ${err.code} - ${err.message}`);
      resolve();
    });
    
    req.on('timeout', () => {
      console.log('⏰ Request timed out');
      req.destroy();
      resolve();
    });
  });
}

testHealthEndpoint().then(() => {
  console.log('\n✅ Health test completed');
});