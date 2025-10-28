import * as fs from 'fs';
import * as readline from 'readline';

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log('🔑 Environment Setup');
  console.log('-------------------');
  console.log('This will create a .env.local file with your Azure OpenAI credentials.');
  console.log('The file will be added to .gitignore to prevent accidental commits.\n');
  
  // Ensure .gitignore contains .env.local
  try {
    const gitignore = fs.readFileSync('.gitignore', 'utf8');
    if (!gitignore.includes('.env.local')) {
      fs.appendFileSync('.gitignore', '\n# Local environment variables\n.env.local\n');
      console.log('✅ Added .env.local to .gitignore');
    }
  } catch (err) {
    console.log('⚠️  Could not update .gitignore. Please ensure .env.local is in your .gitignore file.');
  }
  
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
  
  // Create or update .env.local file
  const envContent = `# Azure OpenAI Configuration - DO NOT COMMIT THIS FILE
AZURE_OPENAI_API_KEY=${apiKey}
AZURE_OPENAI_ENDPOINT=${endpoint}
AZURE_OPENAI_DEPLOYMENT_NAME=${deploymentName}
AZURE_OPENAI_API_VERSION=2023-05-15
`;
  
  fs.writeFileSync('.env.local', envContent);
  
  console.log('\n✅ .env.local file has been created/updated with your Azure OpenAI credentials.');
  console.log('The file has been added to .gitignore to prevent accidental commits.');
  console.log('\nYou can now run the test script with:');
  console.log('  npx tsx scripts/test-genai-embeddings.ts');
  
  rl.close();
}

main().catch(console.error);
