import * as fs from 'fs';
import * as dotenv from 'dotenv';

// Load environment variables from .env.local if it exists
if (fs.existsSync('.env.local')) {
  dotenv.config({ path: '.env.local' });
  console.log('✅ Found .env.local file');
} else {
  console.log('❌ .env.local file not found');
  console.log('Please run: npx tsx scripts/setup-env-local.ts');
  process.exit(1);
}

// Check for required environment variables
const requiredVars = [
  'AZURE_OPENAI_API_KEY',
  'AZURE_OPENAI_ENDPOINT',
  'AZURE_OPENAI_DEPLOYMENT_NAME'
];

let allVarsPresent = true;

console.log('\n🔍 Checking environment variables:');
for (const varName of requiredVars) {
  const value = process.env[varName];
  if (value) {
    console.log(`   ✅ ${varName}: ${'*'.repeat(5)}${value.slice(-4)}`);
  } else {
    console.log(`   ❌ ${varName}: MISSING`);
    allVarsPresent = false;
  }
}

if (!allVarsPresent) {
  console.log('\n❌ Missing required environment variables');
  console.log('Please run: npx tsx scripts/setup-env-local.ts');
  process.exit(1);
}

console.log('\n✅ Environment is properly configured!');
console.log('You can now run the test script with:');
console.log('  npx tsx scripts/test-genai-embeddings.ts');
