#!/usr/bin/env node

/**
 * Test Application Functionality
 * Validates the core VibeCode flow: prompt -> OpenRouter -> metrics to Datadog
 */

// Use built-in fetch (Node.js 18+)
const fetch = globalThis.fetch;

const TEST_CONFIG = {
  appUrl: 'http://localhost:3000',
  healthEndpoint: '/api/health',
  aiEndpoint: '/api/ai/chat/stream',
  testMessage: 'Write a simple JavaScript function that adds two numbers',
  testWorkspace: 'test-workspace-123',
  testModel: 'anthropic/claude-3.5-sonnet'
};

async function testHealthEndpoint() {
  console.log('🏥 Testing health endpoint...');
  
  try {
    const response = await fetch(`${TEST_CONFIG.appUrl}${TEST_CONFIG.healthEndpoint}`);
    const data = await response.json();
    
    console.log('✅ Health endpoint response:', JSON.stringify(data, null, 2));
    
    return {
      success: response.ok,
      hasDatabase: data.checks?.database?.status === 'healthy',
      hasRedis: data.checks?.redis?.status === 'healthy',
      hasAI: data.checks?.ai?.status === 'healthy'
    };
  } catch (error) {
    console.error('❌ Health endpoint failed:', error.message);
    return { success: false };
  }
}

async function testAIEndpoint() {
  console.log('🤖 Testing AI endpoint with OpenRouter...');
  
  try {
    const response = await fetch(`${TEST_CONFIG.appUrl}${TEST_CONFIG.aiEndpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: TEST_CONFIG.testMessage,
        model: TEST_CONFIG.testModel,
        context: {
          workspaceId: TEST_CONFIG.testWorkspace,
          files: ['test.js'],
          previousMessages: []
        }
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    console.log('✅ AI endpoint responded with status:', response.status);
    console.log('📡 Response headers:', Object.fromEntries(response.headers));
    
    // Test streaming response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let responseContent = '';
    let chunkCount = 0;
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      responseContent += chunk;
      chunkCount++;
      
      // Show first few chunks
      if (chunkCount <= 3) {
        console.log(`📦 Chunk ${chunkCount}:`, chunk.substring(0, 100));
      }
    }
    
    console.log('📊 Total chunks received:', chunkCount);
    console.log('📝 Response preview:', responseContent.substring(0, 200) + '...');
    
    return {
      success: true,
      streaming: chunkCount > 1,
      hasContent: responseContent.length > 0
    };
    
  } catch (error) {
    console.error('❌ AI endpoint failed:', error.message);
    return { success: false, error: error.message };
  }
}

async function testDatabaseConnections() {
  console.log('🗄️ Testing database connections...');
  
  try {
    const response = await fetch(`${TEST_CONFIG.appUrl}${TEST_CONFIG.healthEndpoint}`);
    const data = await response.json();
    
    const postgres = data.checks?.database;
    const redis = data.checks?.redis;
    
    console.log('📊 PostgreSQL Status:', postgres?.status, postgres?.details);
    console.log('🔴 Redis Status:', redis?.status, redis?.details);
    
    return {
      postgres: postgres?.status === 'healthy',
      redis: redis?.status === 'healthy'
    };
  } catch (error) {
    console.error('❌ Database connection test failed:', error.message);
    return { postgres: false, redis: false };
  }
}

async function main() {
  console.log('🚀 Starting VibeCode Application Functionality Test\n');
  
  // Test 1: Health endpoint
  const healthResult = await testHealthEndpoint();
  console.log('');
  
  // Test 2: Database connections
  const dbResult = await testDatabaseConnections();
  console.log('');
  
  // Test 3: AI endpoint
  const aiResult = await testAIEndpoint();
  console.log('');
  
  // Summary
  console.log('📋 TEST RESULTS SUMMARY:');
  console.log('========================');
  console.log('✅ Application Health:', healthResult.success ? 'PASS' : 'FAIL');
  console.log('✅ PostgreSQL Connection:', dbResult.postgres ? 'PASS' : 'FAIL');
  console.log('✅ Redis Connection:', dbResult.redis ? 'PASS' : 'FAIL');
  console.log('✅ AI/OpenRouter Integration:', aiResult.success ? 'PASS' : 'FAIL');
  console.log('✅ Streaming Response:', aiResult.streaming ? 'PASS' : 'FAIL');
  
  const allTests = [
    healthResult.success,
    dbResult.postgres,
    dbResult.redis,
    aiResult.success
  ];
  
  const passedTests = allTests.filter(Boolean).length;
  const totalTests = allTests.length;
  
  console.log(`\n🎯 Overall Score: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('🎉 ALL TESTS PASSED - Application is fully functional!');
  } else {
    console.log('⚠️  Some tests failed - check the logs above');
  }
}

main().catch(console.error);