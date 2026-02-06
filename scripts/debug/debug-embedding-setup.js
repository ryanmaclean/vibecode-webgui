#!/usr/bin/env node

// Datadog Log Aggregation
const LogAggregation = require("./lib/log-aggregation-node.js");


/**
 * Debug Embedding Setup
 * Check environment configuration and client initialization
 */

console.log('🔧 Debugging Embedding Setup');
console.log('============================');

console.log('\n📋 Environment Variables:');
console.log(`OPENROUTER_API_KEY: ${process.env.OPENROUTER_API_KEY ? '[SET]' : '[NOT SET]'}`);
console.log(`OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? '[SET]' : '[NOT SET]'}`);
console.log(`AZURE_OPENAI_API_KEY: ${process.env.AZURE_OPENAI_API_KEY ? '[SET]' : '[NOT SET]'}`);

// Test enhanced AI client
console.log('\n🤖 Testing Enhanced AI Client:');

try {
  const { EnhancedAIClient } = await import('./src/lib/ai/enhanced-model-client.ts');
  
  const client = new EnhancedAIClient({
    provider: 'openrouter',
    model: 'text-embedding-ada-002'
  });
  
  console.log('✅ Enhanced AI Client created successfully');
  
  // Check if OpenRouter client is initialized
  const hasOpenRouterClient = client.clients && client.clients.has('openrouter');
  console.log(`OpenRouter client initialized: ${hasOpenRouterClient ? '✅ YES' : '❌ NO'}`);
  
  // Try a small test
  console.log('\n🧪 Testing embedding generation...');
  
  try {
    const result = await client.createEmbedding('Hello world test');
    console.log('✅ Embedding generation successful!');
    console.log(`📊 Dimensions: ${result.embeddings[0].length}`);
    console.log(`📊 Model: ${result.model}`);
    console.log(`📊 Provider: ${result.provider}`);
  } catch (embeddingError) {
    console.error('❌ Embedding generation failed:', embeddingError.message);
  }
  
} catch (error) {
  console.error('❌ Failed to create Enhanced AI Client:', error.message);
}

// Test basic embedding service factory
console.log('\n🏭 Testing Embedding Service Factory:');

try {
  const { EmbeddingServiceFactory, EmbeddingProvider } = await import('./src/lib/ai/embeddingServiceFactory.ts');
  const { PrismaClient } = await import('@prisma/client');
  
  const prisma = new PrismaClient();
  const factory = new EmbeddingServiceFactory(prisma);
  
  console.log('✅ Factory created successfully');
  
  try {
    const service = factory.createEmbeddingServiceFromEnv();
    console.log('✅ Service created from environment');
    console.log(`📊 Service type: ${service.constructor.name}`);
  } catch (serviceError) {
    console.error('❌ Service creation failed:', serviceError.message);
    
    // Try creating with specific config
    console.log('\n🔄 Trying with specific OpenRouter config...');
    
    if (process.env.OPENROUTER_API_KEY) {
      // Create a manual OpenAI service using OpenRouter endpoint
      const { EmbeddingService } = await import('./src/lib/ai/embeddingService.ts');
      
      try {
        const openrouterService = new EmbeddingService(
          process.env.OPENROUTER_API_KEY,
          'text-embedding-ada-002',
          prisma
        );
        
        console.log('✅ Manual OpenRouter service created');
        
        // Test it
        const testEmbedding = await openrouterService.generateEmbedding('test');
        console.log(`✅ Test embedding generated: ${testEmbedding.length} dimensions`);
        
      } catch (manualError) {
        console.error('❌ Manual service failed:', manualError.message);
      }
    }
  }
  
  await prisma.$disconnect();
  
} catch (factoryError) {
  console.error('❌ Failed to test factory:', factoryError.message);
}

console.log('\n🏁 Debug complete');