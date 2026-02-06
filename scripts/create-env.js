const fs = require('fs');
const path = require('path');

// Get configuration from environment variables with sensible defaults for placeholders
const azureApiKey = process.env.AZURE_OPENAI_API_KEY || '';
const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT || 'https://eastus.api.cognitive.microsoft.com/';
const azureDeploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'text-embedding-3-small';
const azureApiVersion = process.env.AZURE_OPENAI_API_VERSION || '2023-05-15';

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = `# Azure OpenAI Configuration - DO NOT COMMIT THIS FILE
AZURE_OPENAI_API_KEY=${azureApiKey}
AZURE_OPENAI_ENDPOINT=${azureEndpoint}
AZURE_OPENAI_DEPLOYMENT_NAME=${azureDeploymentName}
AZURE_OPENAI_API_VERSION=${azureApiVersion}`;

// Warn if API key is not set
if (!azureApiKey) {
  console.warn('⚠️  Warning: AZURE_OPENAI_API_KEY environment variable is not set.');
  console.warn('   Set it before running this script, or edit .env.local manually.');
}

try {
  fs.writeFileSync(envPath, envContent, { mode: 0o600 });
  console.log('✅ .env.local file created successfully with secure permissions');
  if (!azureApiKey) {
    console.log('   Remember to add your AZURE_OPENAI_API_KEY to .env.local');
  }
} catch (error) {
  console.error('❌ Error creating .env.local file:', error.message);
  console.error('Please create the file manually with the following content:');
  console.log('\n' + envContent + '\n');
}
