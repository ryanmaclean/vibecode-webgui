import OpenAI from 'openai';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Validate required environment variables
const requiredVars = ['AZURE_OPENAI_ENDPOINT', 'AZURE_OPENAI_API_KEY'];
const missingVars = requiredVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error(`❌ Missing required environment variables: ${missingVars.join(', ')}`);
  console.error('Please run setup-azure-resources.sh first');
  process.exit(1);
}

// Initialize Azure OpenAI client
const client = new OpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  baseURL: `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'text-embedding-3-small'}`,
  defaultQuery: { 'api-version': process.env.AZURE_OPENAI_API_VERSION || '2023-05-15' },
  defaultHeaders: { 'api-key': process.env.AZURE_OPENAI_API_KEY },
});

async function testEmbedding() {
  try {
    console.log('🚀 Testing Azure OpenAI Embedding...');
    
    const response = await client.embeddings.create({
      model: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'text-embedding-3-small',
      input: 'Test embedding from VibeCode',
    });

    const embedding = response.data[0].embedding;
    
    console.log('✅ Embedding generated successfully!');
    console.log(`📏 Vector length: ${embedding.length}`);
    console.log(`🔢 First 5 dimensions: [${embedding.slice(0, 5).join(', ')}]`);
    
    return true;
  } catch (error) {
    console.error('❌ Error testing Azure OpenAI:', error);
    return false;
  }
}

// Run the test
(async () => {
  console.log('🔍 Running Azure OpenAI integration test...');
  
  const success = await testEmbedding();
  
  if (success) {
    console.log('🎉 Azure OpenAI integration test completed successfully!');
  } else {
    console.error('❌ Azure OpenAI integration test failed');
    process.exit(1);
  }
})();
