#!/usr/bin/env node

/**
 * Final Embedding Integration Test
 * Test both approaches: factory service and manual OpenRouter setup
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import OpenAI from 'openai';

console.log('🎯 Final Embedding Integration Test');
console.log('==================================');

async function finalEmbeddingTest() {
  try {
    console.log(`✓ OPENROUTER_API_KEY: ${process.env.OPENROUTER_API_KEY ? '[LOADED]' : '[MISSING]'}`);
    
    if (!process.env.OPENROUTER_API_KEY) {
      throw new Error('OPENROUTER_API_KEY not found');
    }
    
    // Test 1: Factory pattern (will fail without OPENAI_API_KEY)
    console.log('\n📋 Test 1: Embedding Service Factory Pattern');
    console.log('--------------------------------------------');
    
    // Temporarily set OPENAI_API_KEY to test factory pattern
    const originalOpenAIKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = process.env.OPENROUTER_API_KEY;
    
    try {
      const { EmbeddingServiceFactory } = await import('./src/lib/ai/embeddingServiceFactory.ts');
      const { PrismaClient } = await import('@prisma/client');
      
      const prisma = new PrismaClient();
      const factory = new EmbeddingServiceFactory(prisma);
      
      const service = factory.createEmbeddingServiceFromEnv();
      console.log(`✅ Factory service created: ${service.constructor.name}`);
      
      await prisma.$disconnect();
      
    } catch (factoryError) {
      console.log(`❌ Factory pattern failed: ${factoryError.message}`);
    } finally {
      // Restore original key
      process.env.OPENAI_API_KEY = originalOpenAIKey;
    }
    
    // Test 2: Direct OpenRouter Integration
    console.log('\n🚀 Test 2: Direct OpenRouter Integration');
    console.log('---------------------------------------');
    
    // Try different OpenRouter embedding models
    const modelsToTest = [
      'openai/text-embedding-ada-002',
      'text-embedding-ada-002',
      'openai/text-embedding-3-small'
    ];
    
    for (const model of modelsToTest) {
      console.log(`\n🧪 Testing model: ${model}`);
      
      try {
        const client = new OpenAI({
          baseURL: 'https://openrouter.ai/api/v1',
          apiKey: process.env.OPENROUTER_API_KEY,
          defaultHeaders: {
            'HTTP-Referer': 'http://localhost:3000',
            'X-Title': 'VibeCode WebGUI'
          }
        });
        
        const response = await client.embeddings.create({
          model: model,
          input: 'Test embedding generation'
        });
        
        // Check if response is JSON (success) or HTML (error)
        if (typeof response === 'string' && response.includes('<!DOCTYPE html>')) {
          console.log(`❌ Model ${model}: HTML error page returned`);
          continue;
        }
        
        if (response && response.data && response.data[0] && response.data[0].embedding) {
          console.log(`✅ Model ${model}: SUCCESS!`);
          console.log(`   📊 Dimensions: ${response.data[0].embedding.length}`);
          console.log(`   📊 Usage: ${response.usage?.total_tokens || 'unknown'} tokens`);
          
          // Test database integration
          console.log('   💾 Testing database storage...');
          
          const { VectorService } = await import('./src/lib/db/vector.ts');
          const { createRobustConnection } = await import('./src/lib/db/robust-db-connection.ts');
          
          const connection = await createRobustConnection({
            poolKey: 'embedding-test',
            enableLogging: true
          });
          
          if (connection.success && connection.prisma) {
            const vectorService = new VectorService(connection.prisma);
            
            const testDoc = await vectorService.upsertEmbedding({
              documentId: `test-${Date.now()}`,
              content: 'Test embedding generation',
              embedding: response.data[0].embedding,
              metadata: {
                provider: 'openrouter',
                model: model,
                test: true
              }
            });
            
            console.log(`   ✅ Document stored: ${testDoc.id}`);
            
            // Test similarity search
            const similar = await vectorService.findSimilar(
              response.data[0].embedding,
              1,
              0.5
            );
            
            console.log(`   🔍 Found ${similar.length} similar documents`);
            
            // Clean up
            await connection.prisma.documentEmbedding.delete({
              where: { id: testDoc.id }
            });
            
            connection.release();
            console.log('   🧹 Test data cleaned up');
          }
          
          return {
            success: true,
            model: model,
            dimensions: response.data[0].embedding.length,
            provider: 'openrouter'
          };
          
        } else {
          console.log(`❌ Model ${model}: Unexpected response structure`);
        }
        
      } catch (modelError) {
        console.log(`❌ Model ${model}: ${modelError.message}`);
      }
    }
    
    // Test 3: Check if OpenRouter supports embeddings at all
    console.log('\n🔍 Test 3: OpenRouter API Capabilities Check');
    console.log('-------------------------------------------');
    
    try {
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'http://localhost:3000'
        }
      });
      
      const models = await response.json();
      
      if (models && models.data) {
        const embeddingModels = models.data.filter(m => 
          m.id && (m.id.includes('embedding') || m.id.includes('ada-002'))
        );
        
        console.log(`✅ Found ${embeddingModels.length} embedding models:`);
        embeddingModels.forEach(m => {
          console.log(`   - ${m.id}`);
        });
        
        if (embeddingModels.length === 0) {
          console.log('⚠️ No embedding models found - OpenRouter may not support embeddings');
        }
      }
      
    } catch (modelsError) {
      console.log(`❌ Could not fetch models: ${modelsError.message}`);
    }
    
    return { success: false, note: 'No working embedding models found' };
    
  } catch (error) {
    console.error('❌ Final test failed:', error.message);
    return { success: false, error: error.message };
  }
}

finalEmbeddingTest()
  .then(result => {
    if (result.success) {
      console.log('\n🎉 EMBEDDING INTEGRATION SUCCESS!');
      console.log('================================');
      console.log(`✅ Provider: ${result.provider}`);
      console.log(`✅ Model: ${result.model}`);
      console.log(`✅ Dimensions: ${result.dimensions}`);
      console.log('\n✨ The embedding service is ready for production use!');
      process.exit(0);
    } else {
      console.log('\n💥 All embedding integration tests failed');
      console.log(result.note || 'No working configuration found');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });