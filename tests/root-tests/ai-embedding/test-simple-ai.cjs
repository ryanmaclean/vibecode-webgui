#!/usr/bin/env node

/**
 * Simple AI Test - Tests OpenAI API connectivity
 * Uses the actual API key from .env.local
 */

const { PrismaClient } = require('@prisma/client');

console.log('🤖 Simple AI Test');
console.log('=================');

async function testOpenAIConnectivity() {
  try {
    console.log('🔑 Checking API key availability...');
    
    if (!process.env.OPENAI_API_KEY) {
      console.log('❌ OPENAI_API_KEY not found in environment');
      return { success: false, error: 'Missing API key' };
    }
    
    console.log('✅ OPENAI_API_KEY found');
    
    // Test basic OpenAI client creation
    console.log('📡 Testing OpenAI client creation...');
    
    try {
      const { OpenAI } = require('openai');
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
      
      console.log('✅ OpenAI client created successfully');
      
      // Test a simple API call
      console.log('🧪 Testing simple API call...');
      
      const response = await openai.models.list();
      console.log(`✅ API call successful - found ${response.data.length} models`);
      
      // Test database connectivity too
      console.log('🗄️  Testing database connectivity...');
      const prisma = new PrismaClient();
      
      try {
        const result = await prisma.$queryRaw`SELECT 1 as test`;
        console.log('✅ Database connection successful');
        await prisma.$disconnect();
      } catch (dbError) {
        console.log('⚠️  Database connection failed:', dbError.message);
      }
      
      return { success: true, models: response.data.length };
      
    } catch (openaiError) {
      console.log('❌ OpenAI API call failed:', openaiError.message);
      
      if (openaiError.message.includes('401') || openaiError.message.includes('Incorrect API key')) {
        console.log('💡 This suggests the API key format is correct but may be invalid');
        return { success: false, error: 'Invalid API key' };
      }
      
      return { success: false, error: openaiError.message };
    }
    
  } catch (error) {
    console.log('❌ Test failed:', error.message);
    return { success: false, error: error.message };
  }
}

const startTime = Date.now();
testOpenAIConnectivity()
  .then(result => {
    const duration = Date.now() - startTime;
    console.log(`\n📊 Test Summary:`);
    console.log(`   Status: ${result.success ? 'PASS' : 'FAIL'}`);
    console.log(`   Duration: ${duration}ms`);
    
    if (result.success) {
      console.log(`   Models available: ${result.models}`);
    } else {
      console.log(`   Error: ${result.error}`);
      process.exit(1);
    }
  })
  .catch(error => {
    console.log(`❌ Test execution failed: ${error.message}`);
    process.exit(1);
  });
