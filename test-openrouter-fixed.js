#!/usr/bin/env node

/**
 * Test OpenRouter with Fixed Configuration
 * Test the corrected OpenRouter embedding model name
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import OpenAI from 'openai';

console.log('🔧 Testing OpenRouter with Corrected Configuration');
console.log('===============================================');

async function testOpenRouterFixed() {
  try {
    console.log(`✓ OPENROUTER_API_KEY: ${process.env.OPENROUTER_API_KEY ? '[LOADED]' : '[MISSING]'}`);
    
    if (!process.env.OPENROUTER_API_KEY) {
      console.error('❌ OPENROUTER_API_KEY not found in environment');
      return;
    }
    
    console.log('\n📡 Creating OpenRouter client...');
    
    const client = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY,
      defaultHeaders: {
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'VibeCode WebGUI'
      }
    });
    
    console.log('✅ Client created');
    
    console.log('\n🧪 Testing with correct OpenRouter model name...');
    console.log('Input: "Hello world"');
    console.log('Model: openai/text-embedding-ada-002');
    
    const startTime = Date.now();
    
    try {
      const response = await client.embeddings.create({
        model: 'openai/text-embedding-ada-002', // Correct OpenRouter model name
        input: 'Hello world'
      });
      
      const duration = Date.now() - startTime;
      
      console.log(`\n✅ SUCCESS! Embedding generated in ${duration}ms`);
      console.log(`📊 Model: ${response.model}`);
      console.log(`📊 Embedding dimensions: ${response.data[0].embedding.length}`);
      console.log(`📊 Usage: ${response.usage.total_tokens} tokens`);
      
      // Test with Enhanced AI Client
      console.log('\n🤖 Testing Enhanced AI Client with fix...');
      
      const { EnhancedAIClient } = await import('./src/lib/ai/enhanced-model-client.ts');
      
      const enhancedClient = new EnhancedAIClient({
        provider: 'openrouter',
        model: 'openai/text-embedding-ada-002'
      });
      
      const enhancedResult = await enhancedClient.createEmbedding('Testing enhanced client');
      
      console.log(`✅ Enhanced client SUCCESS!`);
      console.log(`📊 Enhanced model: ${enhancedResult.model}`);
      console.log(`📊 Enhanced dimensions: ${enhancedResult.embeddings[0].length}`);
      console.log(`📊 Enhanced usage: ${enhancedResult.usage.totalTokens} tokens`);
      console.log(`📊 Provider: ${enhancedResult.provider}`);
      
      return { success: true, dimensions: response.data[0].embedding.length };
      
    } catch (apiError) {
      console.error('❌ API Error:', apiError.message);
      
      if (apiError.response) {
        console.log('\n📋 Error Response Details:');
        console.log(`Status: ${apiError.response.status}`);
        
        // Try to parse the response
        try {
          const errorData = typeof apiError.response.data === 'string' 
            ? apiError.response.data 
            : JSON.stringify(apiError.response.data, null, 2);
          
          if (errorData.includes('<!DOCTYPE html>')) {
            console.log('HTML error page returned (likely model not found)');
          } else {
            console.log(`Data: ${errorData}`);
          }
        } catch (parseError) {
          console.log('Could not parse error response');
        }
      }
      
      return { success: false, error: apiError.message };
    }
    
  } catch (error) {
    console.error('❌ Setup Error:', error.message);
    return { success: false, error: error.message };
  }
}

testOpenRouterFixed()
  .then(result => {
    if (result.success) {
      console.log('\n🎉 OpenRouter embedding integration WORKING!');
      process.exit(0);
    } else {
      console.log('\n💥 Test failed');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });