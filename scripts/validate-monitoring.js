#!/usr/bin/env node

// Simple script to validate Datadog monitoring integration
const https = require('https');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Prefer .env at repo root, fallback to .env.local
const root = path.join(__dirname, '..');
const envPrimary = path.join(root, '.env');
const envLocal = path.join(root, '.env.local');
if (fs.existsSync(envPrimary)) {
  dotenv.config({ path: envPrimary });
} else if (fs.existsSync(envLocal)) {
  dotenv.config({ path: envLocal });
} else {
  dotenv.config();
}

const API_KEY = process.env.DD_API_KEY || process.env.DATADOG_API_KEY;
const SITE = process.env.DD_SITE || process.env.DATADOG_SITE || 'datadoghq.com';

console.log('🔍 Validating Datadog Monitoring Integration');
console.log('============================================');

if (!API_KEY) {
  console.error('❌ No Datadog API key found');
  console.error('   Set DD_API_KEY or DATADOG_API_KEY in .env or .env.local');
  process.exit(1);
}

console.log('✅ API Key found:', API_KEY.substring(0, 8) + '...');
console.log('✅ Site configured:', SITE);

// Test API connectivity
const options = {
  hostname: `api.${SITE}`,
  port: 443,
  path: '/api/v1/validate',
  method: 'GET',
  headers: {
    'DD-API-KEY': API_KEY,
    'Content-Type': 'application/json'
  }
};

console.log('\n📡 Testing API connectivity...');

const req = https.request(options, (res) => {
  console.log('Status:', res.statusCode);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    if (res.statusCode === 200) {
      console.log('✅ API connectivity successful');
      console.log('✅ Datadog monitoring is properly configured');
      
      // Test metrics submission
      submitTestMetrics();
    } else {
      console.log('❌ API validation failed:', res.statusCode);
      console.log('Response:', data);
      process.exit(1);
    }
  });
});

req.on('error', (e) => {
  console.error('❌ API connection error:', e.message);
  console.log('💡 This may be normal if running locally without internet access');
});

req.end();

// Submit test metrics
function submitTestMetrics() {
  console.log('\n📊 Submitting test metrics...');
  
  const metrics = {
    series: [{
      metric: 'vibecode.monitoring.test',
      points: [[Math.floor(Date.now() / 1000), 1]],
      tags: ['env:development', 'test:monitoring-validation', 'service:vibecode-webgui'],
      host: 'local-development'
    }]
  };
  
  const postData = JSON.stringify(metrics);
  
  const metricsOptions = {
    hostname: `api.${SITE}`,
    port: 443,
    path: '/api/v1/series',
    method: 'POST',
    headers: {
      'DD-API-KEY': API_KEY,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };
  
  const metricsReq = https.request(metricsOptions, (res) => {
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      if (res.statusCode === 202) {
        console.log('✅ Test metrics submitted successfully');
        console.log('📈 Check your Datadog dashboards for the test metric: vibecode.monitoring.test');
      } else {
        console.log('⚠️  Metrics submission status:', res.statusCode);
        console.log('Response:', data);
      }
    });
  });
  
  metricsReq.on('error', (e) => {
    console.error('⚠️  Metrics submission error:', e.message);
  });
  
  metricsReq.write(postData);
  metricsReq.end();
}

// Test LLM Observability configuration
console.log('\n🤖 LLM Observability Configuration:');
console.log('DD_LLMOBS_ENABLED:', process.env.DD_LLMOBS_ENABLED || 'not set');
console.log('DD_LLMOBS_AGENTLESS_ENABLED:', process.env.DD_LLMOBS_AGENTLESS_ENABLED || 'not set');
console.log('DD_LLMOBS_ML_APP:', process.env.DD_LLMOBS_ML_APP || 'not set');

// Test RUM configuration
console.log('\n🌐 RUM Configuration:');
console.log('NEXT_PUBLIC_DATADOG_APPLICATION_ID:', process.env.NEXT_PUBLIC_DATADOG_APPLICATION_ID || 'not set');
console.log('NEXT_PUBLIC_DATADOG_CLIENT_TOKEN:', process.env.NEXT_PUBLIC_DATADOG_CLIENT_TOKEN ? 
  process.env.NEXT_PUBLIC_DATADOG_CLIENT_TOKEN.substring(0, 8) + '...' : 'not set');

console.log('\n📋 Next Steps:');
console.log('1. Start your application: npm run dev');
console.log('2. Visit http://localhost:3000 to generate RUM data');
console.log('3. Check your Datadog dashboards in 5-10 minutes');
console.log('4. Look for traces in APM and metrics in Infrastructure');

setTimeout(() => {
  console.log('\n🎯 Monitoring validation completed!');
  process.exit(0);
}, 2000);