import * as fs from 'fs';
import * as readline from 'readline';

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log('🔑 Azure OpenAI Setup');
  console.log('-------------------');
  
  const apiKey = await new Promise<string>(resolve => {
    rl.question('Enter your Azure OpenAI API key: ', resolve);
  });
  
  const endpoint = await new Promise<string>(resolve => {
    rl.question('Enter your Azure OpenAI endpoint (e.g., https://your-resource-name.openai.azure.com): ', resolve);
  });
  
  const deploymentName = await new Promise<string>(resolve => {
    rl.question('Enter your deployment name (press Enter for default "text-embedding-ada-002"): ', 
      input => resolve(input || 'text-embedding-ada-002'));
  });
  
  // Create or update .env file
  const envContent = `# Azure OpenAI Configuration
AZURE_OPENAI_API_KEY=${apiKey}
AZURE_OPENAI_ENDPOINT=${endpoint}
AZURE_OPENAI_DEPLOYMENT_NAME=${deploymentName}
AZURE_OPENAI_API_VERSION=2023-05-15
`;
  
  fs.writeFileSync('.env', envContent, { flag: 'w' });
  
  console.log('\n✅ .env file has been created/updated with your Azure OpenAI credentials.');
  console.log('You can now run the test script with: npx tsx scripts/test-genai-embeddings.ts');
  
  rl.close();
}

main().catch(console.error);
