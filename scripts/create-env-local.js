const fs = require('fs');
const path = require('path');

// Content for .env.local
const envContent = `# Azure OpenAI Configuration - DO NOT COMMIT THIS FILE
# Replace the placeholders with your actual Azure OpenAI credentials
AZURE_OPENAI_API_KEY=your_api_key_here
AZURE_OPENAI_ENDPOINT=https://your-resource-name.openai.azure.com
AZURE_OPENAI_DEPLOYMENT_NAME=text-embedding-ada-002
AZURE_OPENAI_API_VERSION=2023-05-15
`;

// Path to .env.local
const envPath = path.join(__dirname, '..', '.env.local');

// Write the file
fs.writeFileSync(envPath, envContent);

// Set file permissions to user read/write only
fs.chmodSync(envPath, '600');

console.log('✅ Created .env.local file with placeholder values');
console.log('Please edit this file with your actual Azure OpenAI credentials:');
console.log(envPath);
console.log('\nAfter updating the file, you can run the test with:');
console.log('  npx tsx scripts/test-genai-embeddings.ts');
