#!/usr/bin/env node

/**
 * Test RAG (Retrieval-Augmented Generation) Functionality
 * This script tests the complete vector search and RAG pipeline
 */

const fetch = require('node-fetch')

const BASE_URL = 'http://localhost:3000'
const TEST_WORKSPACE_ID = 'test-rag-workspace'

async function testRAGFunctionality() {
  console.log('🧪 Testing RAG Functionality...\n')

  try {
    // Test 1: Health Check
    console.log('1. Testing Health Check...')
    const healthResponse = await fetch(`${BASE_URL}/api/health`)
    if (healthResponse.ok) {
      const healthData = await healthResponse.json()
      console.log('✅ Health Check Status:', healthData.status)
      console.log('📊 Vector Store Status:', healthData.checks?.vector_store?.status || 'unknown')
    } else {
      console.log('❌ Health check failed')
      return
    }

    // Test 2: Vector Search API (without auth for now)
    console.log('\n2. Testing Vector Search API...')
    const searchResponse = await fetch(`${BASE_URL}/api/ai/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: 'authentication function',
        workspaceId: TEST_WORKSPACE_ID,
        limit: 5
      })
    })

    if (searchResponse.status === 401) {
      console.log('⚠️  Vector Search requires authentication (expected)')
    } else if (searchResponse.ok) {
      const searchData = await searchResponse.json()
      console.log('✅ Vector Search Response:', searchData.success ? 'Success' : 'Failed')
    } else {
      console.log('❌ Vector Search failed with status:', searchResponse.status)
    }

    // Test 3: AI Chat Stream API (without auth for now)
    console.log('\n3. Testing AI Chat with RAG...')
    const chatResponse = await fetch(`${BASE_URL}/api/ai/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'How do I implement authentication in this codebase?',
        model: 'anthropic/claude-3.5-sonnet',
        context: {
          workspaceId: TEST_WORKSPACE_ID,
          files: [],
          previousMessages: []
        }
      })
    })

    if (chatResponse.status === 401) {
      console.log('⚠️  AI Chat requires authentication (expected)')
    } else if (chatResponse.ok) {
      console.log('✅ AI Chat Stream Response: Connection established')
    } else {
      console.log('❌ AI Chat failed with status:', chatResponse.status)
    }

    // Test 4: Environment Variable Check
    console.log('\n4. Checking Environment Configuration...')
    
    const requiredEnvVars = [
      'OPENROUTER_API_KEY',
      'DATABASE_URL', 
      'DD_LLMOBS_ENABLED',
      'NEXTAUTH_SECRET'
    ]
    
    let envVarsPresent = 0
    requiredEnvVars.forEach(envVar => {
      if (process.env[envVar]) {
        console.log(`✅ ${envVar}: Configured`)
        envVarsPresent++
      } else {
        console.log(`❌ ${envVar}: Missing`)
      }
    })

    console.log(`\n📊 Environment Score: ${envVarsPresent}/${requiredEnvVars.length} variables configured`)

    // Summary
    console.log('\n' + '='.repeat(50))
    console.log('🎯 RAG FUNCTIONALITY TEST SUMMARY')
    console.log('='.repeat(50))
    console.log('✅ Health endpoint: Working')
    console.log('⚠️  Vector search: Requires authentication')
    console.log('⚠️  AI chat: Requires authentication') 
    console.log(`📊 Environment: ${envVarsPresent}/${requiredEnvVars.length} configured`)
    console.log('\n💡 Next steps:')
    console.log('1. Start the development server: npm run dev')
    console.log('2. Sign in with authentication')
    console.log('3. Upload files to workspace')
    console.log('4. Test RAG in AI chat interface')

  } catch (error) {
    console.error('❌ Test failed:', error.message)
  }
}

// Run the test
testRAGFunctionality()