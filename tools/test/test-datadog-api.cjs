#!/usr/bin/env node

// Test Datadog API to verify our CI Visibility data is being received
const https = require('https');

// You'll need to replace this with your actual Datadog API key
const DD_API_KEY = process.env.DD_API_KEY || 'your-datadog-api-key-here';
const DD_SITE = process.env.DD_SITE || 'datadoghq.com';

if (DD_API_KEY === 'your-datadog-api-key-here') {
  console.log('❌ Please set DD_API_KEY environment variable with your actual Datadog API key');
  console.log('   Example: DD_API_KEY=your-key-here node test-datadog-api.js');
  process.exit(1);
}

console.log('🔍 Testing Datadog API connectivity...');
console.log(`   API Key: ${DD_API_KEY.substring(0, 8)}...`);
console.log(`   Site: ${DD_SITE}`);

// Test 1: Check if we can authenticate
const authOptions = {
  hostname: `api.${DD_SITE}`,
  port: 443,
  path: '/api/v1/validate',
  method: 'GET',
  headers: {
    'DD-API-KEY': DD_API_KEY,
    'Content-Type': 'application/json'
  }
};

console.log('\n1️⃣ Testing API authentication...');
const authReq = https.request(authOptions, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    try {
      const result = JSON.parse(data);
      if (result.valid) {
        console.log('✅ API authentication successful');
        console.log(`   User: ${result.user?.email || 'Unknown'}`);
        console.log(`   Org: ${result.org?.name || 'Unknown'}`);
      } else {
        console.log('❌ API authentication failed');
        console.log('   Response:', data);
      }
    } catch (e) {
      console.log('❌ Failed to parse auth response:', data);
    }
  });
});

authReq.on('error', (e) => {
  console.log('❌ Auth request failed:', e.message);
});

authReq.end();

// Test 2: Query for test data (if we have a real API key)
if (DD_API_KEY !== 'your-datadog-api-key-here') {
  setTimeout(() => {
    console.log('\n2️⃣ Querying for test data...');
    
    const queryOptions = {
      hostname: `api.${DD_SITE}`,
      port: 443,
      path: '/api/v2/ci/test_runs?filter[query]=service:vibecode-webgui&page[size]=5',
      method: 'GET',
      headers: {
        'DD-API-KEY': DD_API_KEY,
        'Content-Type': 'application/json'
      }
    };

    const queryReq = https.request(queryOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          console.log('📊 Test runs found:', result.data?.length || 0);
          if (result.data && result.data.length > 0) {
            console.log('✅ Test data is being received by Datadog!');
            result.data.forEach((run, i) => {
              console.log(`   ${i + 1}. ${run.attributes?.test_name || 'Unknown'} - ${run.attributes?.status || 'Unknown'}`);
            });
          } else {
            console.log('⚠️  No test data found yet. This could mean:');
            console.log('   - Tests haven\'t run in CI yet');
            console.log('   - Data is still being processed');
            console.log('   - API key doesn\'t have CI Visibility permissions');
          }
        } catch (e) {
          console.log('❌ Failed to parse query response:', data);
        }
      });
    });

    queryReq.on('error', (e) => {
      console.log('❌ Query request failed:', e.message);
    });

    queryReq.end();
  }, 2000);
}

console.log('\n💡 To test with your real API key:');
console.log('   DD_API_KEY=your-actual-key node test-datadog-api.js');
