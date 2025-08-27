import OpenAI from 'openai';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function testEmbedding() {
  try {
    console.log('🚀 Testing OpenAI Embedding...');
    
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: 'Test embedding from VibeCode',
    });

    const embedding = response.data[0].embedding;
    
    console.log('✅ Embedding generated successfully!');
    console.log(`📏 Vector length: ${embedding.length}`);
    console.log(`🔢 First 5 dimensions: [${embedding.slice(0, 5).join(', ')}]`);
    
    return true;
  } catch (error) {
    console.error('❌ Error testing OpenAI:', error);
    return false;
  }
}

// Run the test
(async () => {
  console.log('🔍 Running OpenAI integration test...');
  
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY environment variable is not set');
    console.log('💡 Please set the OPENAI_API_KEY environment variable and try again');
    process.exit(1);
  }
  
  const success = await testEmbedding();
  
  if (success) {
    console.log('🎉 OpenAI integration test completed successfully!');
  } else {
    console.error('❌ OpenAI integration test failed');
    process.exit(1);
  }
})();
