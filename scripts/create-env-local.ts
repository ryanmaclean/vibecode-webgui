#!/usr/bin/env node
import { chmodSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envContent = `# Azure OpenAI Configuration - DO NOT COMMIT THIS FILE
# Replace the placeholders with your actual Azure OpenAI credentials
AZURE_OPENAI_API_KEY=your_api_key_here
AZURE_OPENAI_ENDPOINT=https://your-resource-name.openai.azure.com
AZURE_OPENAI_DEPLOYMENT_NAME=text-embedding-ada-002
AZURE_OPENAI_API_VERSION=2023-05-15
`;

const envPath = path.join(__dirname, '..', '.env.local');

writeFileSync(envPath, envContent, { mode: 0o600 });
chmodSync(envPath, 0o600);

console.log('✅ Created .env.local file with placeholder values');
console.log('Please edit this file with your actual Azure OpenAI credentials:');
console.log(envPath);
console.log('\nAfter updating the file, you can run the test with:');
console.log('  npx tsx scripts/test-genai-embeddings.ts');
