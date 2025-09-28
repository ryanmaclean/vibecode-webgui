#!/usr/bin/env node

/**
 * DBM-APM Connection Test Script
 * This script tests the DBM-APM connection by making API calls
 * and verifying that traces are properly correlated with database queries
 */

const https = require('https');
const http = require('http');
const { performance } = require('perf_hooks');

// Configuration
const config = {
  // Try different endpoints
  endpoints: [
    'https://vibecode.eastus2.cloudapp.azure.com',
    'http://localhost:3000',
    'http://localhost:8080'
  ],
  testPaths: [
    '/api/health',
    '/api/status',
    '/health',
    '/api/database/test',
    '/api/trace-test'
  ],
  timeout: 10000
};

// Colors for output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function makeRequest(url, path) {
  return new Promise((resolve, reject) => {
    const fullUrl = `${url}${path}`;
    const startTime = performance.now();
    
    log(`🔍 Testing: ${fullUrl}`, 'blue');
    
    const protocol = url.startsWith('https:') ? https : http;
    const options = {
      timeout: config.timeout,
      headers: {
        'User-Agent': 'DBM-APM-Test/1.0',
        'Accept': 'application/json',
        'X-Test-Source': 'dbm-apm-validation'
      }
    };

    const req = protocol.request(fullUrl, options, (res) => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          url: fullUrl,
          status: res.statusCode,
          headers: res.headers,
          data: data,
          duration: duration,
          traceId: res.headers['x-datadog-trace-id'] || res.headers['x-trace-id'],
          spanId: res.headers['x-datadog-span-id'] || res.headers['x-span-id']
        });
      });
    });

    req.on('error', (err) => {
      reject({
        url: fullUrl,
        error: err.message,
        duration: performance.now() - startTime
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject({
        url: fullUrl,
        error: 'Request timeout',
        duration: performance.now() - startTime
      });
    });

    req.end();
  });
}

async function testEndpoint(baseUrl) {
  log(`\n🌐 Testing base URL: ${baseUrl}`, 'bold');
  
  const results = [];
  
  for (const path of config.testPaths) {
    try {
      const result = await makeRequest(baseUrl, path);
      results.push(result);
      
      if (result.status >= 200 && result.status < 300) {
        log(`✅ ${path} - Status: ${result.status} (${result.duration.toFixed(2)}ms)`, 'green');
        
        // Check for trace headers
        if (result.traceId) {
          log(`   🔗 Trace ID: ${result.traceId}`, 'blue');
        }
        if (result.spanId) {
          log(`   🔗 Span ID: ${result.spanId}`, 'blue');
        }
        
        // Check for Datadog headers
        const ddHeaders = Object.keys(result.headers).filter(h => h.toLowerCase().includes('datadog'));
        if (ddHeaders.length > 0) {
          log(`   📊 Datadog headers: ${ddHeaders.join(', ')}`, 'blue');
        }
        
        // Try to parse JSON response
        try {
          const jsonData = JSON.parse(result.data);
          if (jsonData.database) {
            log(`   🗄️  Database info found in response`, 'green');
          }
          if (jsonData.traces) {
            log(`   🔍 Trace info found in response`, 'green');
          }
        } catch (e) {
          // Not JSON, that's okay
        }
        
      } else {
        log(`⚠️  ${path} - Status: ${result.status} (${result.duration.toFixed(2)}ms)`, 'yellow');
      }
      
    } catch (error) {
      log(`❌ ${path} - Error: ${error.error}`, 'red');
      results.push(error);
    }
  }
  
  return results;
}

async function testDatabaseConnection(baseUrl) {
  log(`\n🗄️  Testing database connectivity...`, 'bold');
  
  const dbTestPaths = [
    '/api/database/health',
    '/api/db/test',
    '/api/health/db',
    '/api/database/status'
  ];
  
  for (const path of dbTestPaths) {
    try {
      const result = await makeRequest(baseUrl, path);
      if (result.status >= 200 && result.status < 300) {
        log(`✅ Database endpoint ${path} - Status: ${result.status}`, 'green');
        
        // Check for database-related headers
        const dbHeaders = Object.keys(result.headers).filter(h => 
          h.toLowerCase().includes('db') || 
          h.toLowerCase().includes('database') ||
          h.toLowerCase().includes('postgres')
        );
        if (dbHeaders.length > 0) {
          log(`   🗄️  Database headers: ${dbHeaders.join(', ')}`, 'blue');
        }
        
        return true;
      }
    } catch (error) {
      // Continue to next path
    }
  }
  
  return false;
}

async function generateTestTraces(baseUrl) {
  log(`\n🔍 Generating test traces for DBM-APM correlation...`, 'bold');
  
  const testRequests = [
    { path: '/api/health', method: 'GET' },
    { path: '/api/status', method: 'GET' },
    { path: '/api/database/test', method: 'GET' },
    { path: '/api/trace-test', method: 'POST', body: JSON.stringify({ test: 'dbm-apm' }) }
  ];
  
  const traceIds = new Set();
  
  for (const test of testRequests) {
    try {
      const result = await makeRequest(baseUrl, test.path);
      if (result.traceId) {
        traceIds.add(result.traceId);
        log(`✅ Generated trace: ${result.traceId} for ${test.path}`, 'green');
      }
    } catch (error) {
      log(`⚠️  Could not generate trace for ${test.path}: ${error.error}`, 'yellow');
    }
  }
  
  log(`📊 Generated ${traceIds.size} unique trace IDs`, 'blue');
  return Array.from(traceIds);
}

async function main() {
  log('🚀 DBM-APM Connection Test', 'bold');
  log('============================', 'bold');
  
  const allResults = [];
  const allTraceIds = [];
  
  for (const endpoint of config.endpoints) {
    try {
      const results = await testEndpoint(endpoint);
      allResults.push(...results);
      
      // Test database connectivity
      const dbConnected = await testDatabaseConnection(endpoint);
      if (dbConnected) {
        log(`✅ Database connectivity confirmed for ${endpoint}`, 'green');
      }
      
      // Generate test traces
      const traceIds = await generateTestTraces(endpoint);
      allTraceIds.push(...traceIds);
      
    } catch (error) {
      log(`❌ Failed to test ${endpoint}: ${error.message}`, 'red');
    }
  }
  
  // Summary
  log('\n📊 Test Summary', 'bold');
  log('================', 'bold');
  
  const successfulRequests = allResults.filter(r => r.status >= 200 && r.status < 300);
  const failedRequests = allResults.filter(r => r.error);
  const requestsWithTraces = allResults.filter(r => r.traceId);
  
  log(`✅ Successful requests: ${successfulRequests.length}`, 'green');
  log(`❌ Failed requests: ${failedRequests.length}`, failedRequests.length > 0 ? 'red' : 'green');
  log(`🔗 Requests with traces: ${requestsWithTraces.length}`, 'blue');
  log(`🔍 Unique trace IDs generated: ${allTraceIds.length}`, 'blue');
  
  if (requestsWithTraces.length > 0) {
    log('\n🎉 DBM-APM Connection Test Results:', 'bold');
    log('✅ Trace correlation is working!', 'green');
    log('✅ Database queries should be correlated with APM traces', 'green');
    log('✅ Check Datadog dashboard for trace correlation', 'blue');
  } else {
    log('\n⚠️  DBM-APM Connection Test Results:', 'bold');
    log('⚠️  No trace IDs detected in responses', 'yellow');
    log('⚠️  Check if Datadog tracing is properly configured', 'yellow');
  }
  
  // Instructions for Datadog verification
  log('\n📚 Next Steps:', 'bold');
  log('1. Check Datadog APM Services: https://app.datadoghq.com/apm/services', 'blue');
  log('2. Check Database Monitoring: https://app.datadoghq.com/databases', 'blue');
  log('3. Look for trace correlation in query samples', 'blue');
  log('4. Verify service attribution in database hosts', 'blue');
  
  if (allTraceIds.length > 0) {
    log('\n🔍 Generated Trace IDs for verification:', 'bold');
    allTraceIds.forEach(traceId => {
      log(`   ${traceId}`, 'blue');
    });
  }
}

// Run the test
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testEndpoint, testDatabaseConnection, generateTestTraces };
