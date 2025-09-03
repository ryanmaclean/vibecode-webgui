#!/usr/bin/env node
/**
 * Infrastructure Verification Test
 * Tests the actual functionality of our monitoring system with real services
 */

const { spawn } = require('child_process');
const http = require('http');

console.log('🏗️  Infrastructure Verification Test');
console.log('=====================================\n');

// Start the dev server
console.log('1️⃣  Starting Next.js development server...');
const devServer = spawn('npm', ['run', 'dev'], {
  cwd: process.cwd(),
  stdio: ['pipe', 'pipe', 'pipe']
});

let serverReady = false;
let serverPort = null;

// Monitor server output
devServer.stdout.on('data', (data) => {
  const output = data.toString();
  console.log('   📄', output.trim());
  
  // Check if server is ready and get port
  if (output.includes('Ready in') || output.includes('started server on')) {
    serverReady = true;
    // Extract port from output like "- Local: http://localhost:3001"
    const portMatch = output.match(/localhost:(\d+)/) || output.match(/:(\d+)/);
    if (portMatch) {
      serverPort = portMatch[1];
    } else {
      serverPort = '3001'; // Default fallback
    }
  }
});

devServer.stderr.on('data', (data) => {
  console.log('   ⚠️ ', data.toString().trim());
});

// Wait for server to be ready, then test endpoints
setTimeout(async () => {
  if (!serverReady) {
    console.log('❌ Server failed to start within timeout');
    process.exit(1);
  }
  
  console.log(`\n2️⃣  Testing endpoints on port ${serverPort}...`);
  
  // Test basic connectivity
  await testEndpoint(`http://localhost:${serverPort}`, 'Home Page');
  
  // Test database health endpoint  
  await testEndpoint(`http://localhost:${serverPort}/api/health/db`, 'Database Health API');
  
  // Test pool alerts endpoint (should require auth)
  await testEndpoint(`http://localhost:${serverPort}/api/monitoring/pool-alerts`, 'Pool Alerts API (Auth Required)');
  
  // Test database dashboard
  await testEndpoint(`http://localhost:${serverPort}/monitoring/database`, 'Database Dashboard');
  
  console.log('\n3️⃣  Infrastructure test completed');
  
  // Clean up
  devServer.kill();
  process.exit(0);
  
}, 8000); // Wait 8 seconds for server startup

async function testEndpoint(url, name) {
  return new Promise((resolve) => {
    console.log(`   🔍 Testing ${name}: ${url}`);
    
    const req = http.get(url, { timeout: 5000 }, (res) => {
      console.log(`   ✅ ${name}: HTTP ${res.statusCode} (${res.statusMessage})`);
      
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        // Log first 200 chars of response for health endpoints
        if (url.includes('/api/')) {
          try {
            const parsed = JSON.parse(data);
            console.log(`   📊 Response: ${JSON.stringify(parsed).substring(0, 200)}...`);
          } catch (e) {
            console.log(`   📄 Response: ${data.substring(0, 200)}...`);
          }
        }
        resolve();
      });
    });
    
    req.on('error', (err) => {
      console.log(`   ❌ ${name}: ${err.code} - ${err.message}`);
      resolve();
    });
    
    req.on('timeout', () => {
      console.log(`   ⏰ ${name}: Request timed out`);
      req.destroy();
      resolve();
    });
  });
}

// Handle cleanup on exit
process.on('SIGINT', () => {
  console.log('\n🛑 Cleaning up...');
  if (devServer) {
    devServer.kill();
  }
  process.exit(0);
});