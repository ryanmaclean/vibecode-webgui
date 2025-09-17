// Embedding Service Factory Test Script
const { PrismaClient } = require('@prisma/client');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

async function runTest() {
  console.log('🚀 Testing Embedding Service Factory...');
  
  const prisma = new PrismaClient();
  
  try {
    // Test environment info
    console.log('📊 Environment Info:');
    console.log(`OpenAI API Key: ${process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Not Set'}`);
    console.log(`Azure OpenAI API Key: ${process.env.AZURE_OPENAI_API_KEY ? '✅ Set' : '❌ Not Set'}`);
    console.log(`Azure OpenAI Endpoint: ${process.env.AZURE_OPENAI_ENDPOINT ? '✅ Set' : '❌ Not Set'}`);
    console.log(`Azure OpenAI Deployment: ${process.env.AZURE_OPENAI_DEPLOYMENT_NAME ? '✅ Set' : '❌ Not Set'}`);
    
    // Create service using factory
    console.log('\n📋 Creating embedding service using factory...');
    const embeddingService = EmbeddingServiceFactory.createEmbeddingService(prisma);
    
    // Check service type
    if (embeddingService instanceof AzureEmbeddingService) {
      console.log('✅ Factory created an AzureEmbeddingService instance');
    } else if (embeddingService instanceof EmbeddingService) {
      console.log('✅ Factory created an EmbeddingService instance');
    } else {
      console.log('❌ Unknown service type created');
    }
    
    // Test embedding generation
    console.log('\n📊 Testing embedding generation with the created service...');
    const testText = 'This is a test for embedding service factory';
    const embedding = await embeddingService.generateEmbedding(testText);
    
    console.log('✅ Embedding generated successfully!');
    console.log(`📏 Vector length: ${embedding.length}`);
    console.log(`🔢 First 5 dimensions: [${embedding.slice(0, 5).join(', ')}]`);
    
    console.log('\n🎉 Embedding Service Factory test passed successfully!');
    console.log('Note: Database tests were skipped due to connection issues.');
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
runTest();