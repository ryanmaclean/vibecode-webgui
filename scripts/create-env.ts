#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = `# Azure OpenAI Configuration - DO NOT COMMIT THIS FILE
AZURE_OPENAI_API_KEY=b2afc587eafc4ca0a777d0e56faadf0e
AZURE_OPENAI_ENDPOINT=https://eastus.api.cognitive.microsoft.com/
AZURE_OPENAI_DEPLOYMENT_NAME=text-embedding-3-small-high
AZURE_OPENAI_API_VERSION=2023-05-15`;

try {
  writeFileSync(envPath, envContent, { mode: 0o600 });
  console.log('✅ .env.local file created successfully with secure permissions');
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error('❌ Error creating .env.local file:', message);
  console.error('Please create the file manually with the following content:');
  console.log('\n' + envContent + '\n');
}
