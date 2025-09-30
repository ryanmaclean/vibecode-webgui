#!/usr/bin/env node

// Script to run the Azure Embedding E2E test with proper environment setup
import { execSync } from 'child_process';
import fs from 'fs';
import dotenv from 'dotenv';

// Datadog metric reporting function
function sendDatadogMetric(metricName, value, tags = []) {
  if (!process.env.DD_API_KEY) {
    console.log('⚠️ DD_API_KEY not set, skipping Datadog metrics');
    return;
  }
  
  const url = `https://api.${process.env.DD_SITE || 'datadoghq.com'}/api/v1/series`;
  const data = {
    series: [{
      metric: `regression_test.azure_embedding.${metricName}`,
      points: [[Math.floor(Date.now() / 1000), value]],
      tags: [`environment:${process.env.DD_ENV || 'test'}`, ...tags]
    }]
  };
  
  try {
    execSync(`curl -X POST "${url}" \
      -H "Content-Type: application/json" \
      -H "DD-API-KEY: ${process.env.DD_API_KEY}" \
      -d '${JSON.stringify(data)}'`, { stdio: 'ignore' });
  } catch (err) {
    console.log('⚠️ Failed to send Datadog metrics');
  }
}

// Load environment variables
dotenv.config();
if (fs.existsSync('.env.azure')) {
  dotenv.config({ path: '.env.azure' });
}

console.log('🧪 Running Azure Embedding E2E Tests');

// Record test start time
const startTime = Date.now();
sendDatadogMetric('test_started', 1, ['test_suite:azure_embedding']);

// Check if we have the Azure credentials
const hasAzureCredentials = 
  !!process.env.AZURE_OPENAI_API_KEY && 
  !!process.env.AZURE_OPENAI_ENDPOINT && 
  !!process.env.AZURE_OPENAI_DEPLOYMENT_NAME;

if (!hasAzureCredentials) {
  console.log('⚠️ Missing Azure OpenAI credentials. Tests will be skipped.');
  console.log('Please ensure the following environment variables are set:');
  console.log('- AZURE_OPENAI_API_KEY');
  console.log('- AZURE_OPENAI_ENDPOINT');
  console.log('- AZURE_OPENAI_DEPLOYMENT_NAME');
  
  sendDatadogMetric('test_skipped', 1, ['test_suite:azure_embedding', 'reason:missing_credentials']);
  process.exit(0);
}

// Show configuration
console.log('📝 Azure OpenAI Configuration:');
console.log(`   - Endpoint: ${process.env.AZURE_OPENAI_ENDPOINT}`);
console.log(`   - Deployment: ${process.env.AZURE_OPENAI_DEPLOYMENT_NAME}`);
console.log(`   - API Version: ${process.env.AZURE_OPENAI_API_VERSION || '2023-05-15'}`);
console.log(`📊 Database URL: ${process.env.DATABASE_URL ? process.env.DATABASE_URL.replace(/:[^:]*@/, ':****@') : 'Not set'}`);

try {
  // Run the test
  console.log('\n🚀 Running tests...');
  execSync('npx tsx scripts/run-root-tests.js azure-embedding', { 
    stdio: 'inherit',
    env: {
      ...process.env,
      // Ensure we have proper environment
      NODE_ENV: 'test'
    }
  });
  
  const duration = Date.now() - startTime;
  console.log('\n✅ Azure Embedding E2E tests completed successfully!');
  sendDatadogMetric('test_completed', 1, ['test_suite:azure_embedding', 'status:success']);
  sendDatadogMetric('test_duration_ms', duration, ['test_suite:azure_embedding']);
  
} catch (error) {
  const duration = Date.now() - startTime;
  console.error('\n❌ Tests failed:', error.message);
  sendDatadogMetric('test_completed', 1, ['test_suite:azure_embedding', 'status:failure']);
  sendDatadogMetric('test_duration_ms', duration, ['test_suite:azure_embedding']);
  process.exit(1);
}