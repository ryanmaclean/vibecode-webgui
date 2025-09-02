#!/usr/bin/env node

/**
 * Test Embedding Pipeline with Environment Loading
 * Explicitly loads .env.local and tests OpenRouter integration
 */

// Load environment variables from .env.local
import { config } from 'dotenv';
config({ path: '.env.local' });

console.log('🔧 Environment loaded, testing embedding pipeline...');
console.log('================================================');

console.log(`✓ OPENROUTER_API_KEY: ${process.env.OPENROUTER_API_KEY ? '[LOADED]' : '[MISSING]'}`);

async function testEmbeddingWithOpenRouter() {
  try {
    // Import after environment is loaded
    const { EnhancedAIClient } = await import('./src/lib/ai/enhanced-model-client.ts');
    
    console.log('\n🤖 Creating Enhanced AI Client with OpenRouter...');
    
    const client = new EnhancedAIClient({
      provider: 'openrouter',
      model: 'text-embedding-ada-002'
    });
    
    // Check if client is properly configured
    console.log(`OpenRouter client configured: ${client.clients.has('openrouter') ? '✅ YES' : '❌ NO'}`);
    
    if (!client.clients.has('openrouter')) {
      console.error('❌ OpenRouter client not initialized. Checking environment...');
      console.log(`OPENROUTER_API_KEY in process.env: ${!!process.env.OPENROUTER_API_KEY}`);
      return;
    }
    
    console.log('\n🧪 Testing embedding generation...');
    
    const testText = 'This is a test for OpenRouter embedding generation';
    console.log(`Input text: "${testText}"`);
    
    const startTime = Date.now();
    const result = await client.createEmbedding(testText);
    const duration = Date.now() - startTime;
    
    console.log(`✅ Embedding generated successfully in ${duration}ms`);
    console.log(`📊 Dimensions: ${result.embeddings[0].length}`);
    console.log(`📊 Model: ${result.model}`);
    console.log(`📊 Provider: ${result.provider}`);
    console.log(`📊 Token usage: ${result.usage.totalTokens}`);
    
    // Test with the existing embedding service to compare
    console.log('\n🔄 Testing with basic EmbeddingService...');
    
    const { EmbeddingService } = await import('./src/lib/ai/embeddingService.ts');
    const { PrismaClient } = await import('@prisma/client');
    
    const prisma = new PrismaClient();
    
    // Create service with OpenRouter API key but standard OpenAI endpoint
    const basicService = new EmbeddingService(
      process.env.OPENROUTER_API_KEY,
      'text-embedding-ada-002',
      prisma
    );
    
    try {
      const basicResult = await basicService.generateEmbedding('Test with basic service');
      console.log(`✅ Basic service also works: ${basicResult.length} dimensions`);
    } catch (basicError) {
      console.log(`❌ Basic service failed: ${basicError.message}`);
      console.log('   Note: This is expected since basic service uses OpenAI endpoint, not OpenRouter');
    }
    
    await prisma.$disconnect();
    
    console.log('\n🎉 OpenRouter embedding integration WORKING!');
    return { success: true };
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    return { success: false, error: error.message };
  }
}

// Run the test
testEmbeddingWithOpenRouter()
  .then(result => {
    process.exit(result.success ? 0 : 1);
  })
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });