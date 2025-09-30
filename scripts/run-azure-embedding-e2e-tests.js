#!/usr/bin/env node

// Script to run the Azure Embedding E2E test with proper environment setup
import { execSync } from 'child_process';
import fs from 'fs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();
if (fs.existsSync('.env.azure')) {
  dotenv.config({ path: '.env.azure' });
}

console.log('🧪 Running Azure Embedding E2E Tests');

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
  execSync('npx jest tests/azure-embedding-e2e.test.ts --forceExit', { 
    stdio: 'inherit',
    env: {
      ...process.env,
      // Ensure we have plenty of timeout for API calls
      JEST_TIMEOUT: '30000'
    }
  });
  console.log('\n✅ Azure Embedding E2E tests completed successfully!');
} catch (error) {
  console.error('\n❌ Tests failed:', error.message);
  process.exit(1);
}