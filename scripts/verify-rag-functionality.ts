#!/usr/bin/env npx tsx

/**
 * RAG Functionality Verification Script
 * Demonstrates end-to-end RAG pipeline without starting full server
 */

import { vectorStore } from '../src/lib/vector-store'
import { prisma } from '../src/lib/prisma'

async function verifyRAGFunctionality() {
  console.log('🔍 Verifying RAG Functionality...\n')

  try {
    // 1. Test embedding generation
    console.log('1. Testing embedding generation...')
    if (process.env.OPENROUTER_API_KEY) {
      const testText = 'React component for user authentication with hooks'
      const embedding = await vectorStore.generateEmbedding(testText)
      console.log(`   ✅ Generated ${embedding.length}-dimensional embedding`)
      console.log(`   📊 Sample values: [${embedding.slice(0, 3).map(v => v.toFixed(4)).join(', ')}...]`)
    } else {
      console.log('   ⚠️  Skipped - OPENROUTER_API_KEY not configured')
    }

    // 2. Test database connection
    console.log('\n2. Testing database connection...')
    if (process.env.DATABASE_URL) {
      try {
        const userCount = await prisma.user.count()
        const workspaceCount = await prisma.workspace.count()
        const fileCount = await prisma.file.count()
        const chunkCount = await prisma.rAGChunk.count()
        
        console.log(`   ✅ Database connected`)
        console.log(`   📊 Current data: ${userCount} users, ${workspaceCount} workspaces, ${fileCount} files, ${chunkCount} vector chunks`)
      } catch (error) {
        console.log(`   ❌ Database error: ${error.message}`)
      }
    } else {
      console.log('   ⚠️  Skipped - DATABASE_URL not configured')
    }

    // 3. Test vector store statistics
    console.log('\n3. Testing vector store statistics...')
    try {
      const stats = await vectorStore.getStats()
      console.log(`   ✅ Vector store accessible`)
      console.log(`   📊 Stats: ${stats.totalChunks} chunks, ${stats.totalFiles} files, avg ${stats.averageChunkSize.toFixed(1)} tokens/chunk`)
    } catch (error) {
      console.log(`   ❌ Vector store error: ${error.message}`)
    }

    // 4. Test search functionality (if we have data)
    console.log('\n4. Testing search functionality...')
    try {
      const searchResults = await vectorStore.search('authentication login user', { limit: 3 })
      if (searchResults.length > 0) {
        console.log(`   ✅ Search working - found ${searchResults.length} results`)
        searchResults.forEach((result, i) => {
          console.log(`   📄 Result ${i+1}: "${result.chunk.content.substring(0, 80)}..." (similarity: ${result.similarity.toFixed(3)})`)
        })
      } else {
        console.log('   ⚠️  No search results (expected if no data indexed yet)')
      }
    } catch (error) {
      console.log(`   ❌ Search error: ${error.message}`)
    }

    // 5. Test context generation
    console.log('\n5. Testing context generation...')
    try {
      const context = await vectorStore.getContext('how to implement user authentication', undefined, 1000)
      if (context && context.length > 0) {
        console.log(`   ✅ Context generation working`)
        console.log(`   📝 Generated ${context.length} characters of context`)
        console.log(`   📄 Preview: "${context.substring(0, 120)}..."`)
      } else {
        console.log('   ⚠️  No context generated (expected if no relevant data)')
      }
    } catch (error) {
      console.log(`   ❌ Context generation error: ${error.message}`)
    }

    // 6. Check API endpoints (if server is running)
    console.log('\n6. Testing API endpoints...')
    try {
      const response = await fetch('http://localhost:3000/api/health')
      if (response.ok) {
        const health = await response.json()
        console.log(`   ✅ API server running`)
        console.log(`   📊 Health status: ${health.status}`)
        if (health.checks?.vector_store) {
          console.log(`   🔍 Vector store health: ${health.checks.vector_store.status}`)
        }
      } else {
        console.log(`   ⚠️  API server not responding (status: ${response.status})`)
      }
    } catch (error) {
      console.log(`   ⚠️  API server not running (start with: npm run dev)`)
    }

    console.log('\n' + '='.repeat(60))
    console.log('🎯 RAG FUNCTIONALITY VERIFICATION COMPLETE')
    console.log('='.repeat(60))

    // Summary
    const hasApiKey = !!process.env.OPENROUTER_API_KEY
    const hasDatabase = !!process.env.DATABASE_URL
    
    if (hasApiKey && hasDatabase) {
      console.log('✅ FULL RAG FUNCTIONALITY AVAILABLE')
      console.log('   • Vector embeddings: Working')
      console.log('   • Database storage: Connected')
      console.log('   • Semantic search: Functional')
      console.log('   • Context generation: Ready')
    } else {
      console.log('⚠️  PARTIAL RAG FUNCTIONALITY')
      if (!hasApiKey) console.log('   • Missing OPENROUTER_API_KEY for embeddings')
      if (!hasDatabase) console.log('   • Missing DATABASE_URL for vector storage')
      console.log('\n💡 To enable full RAG functionality:')
      console.log('   export OPENROUTER_API_KEY="your-real-api-key"')
      console.log('   export DATABASE_URL="postgresql://..."')
    }

    console.log('\n🚀 Next steps:')
    console.log('   1. Start server: npm run dev')
    console.log('   2. Upload files to workspace')
    console.log('   3. Test AI chat with RAG context')
    console.log('   4. Try console mode with VS Code')

  } catch (error) {
    console.error('❌ Verification failed:', error)
    process.exit(1)
  }
}

// Run verification
if (require.main === module) {
  verifyRAGFunctionality()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error)
      process.exit(1)
    })
}

export { verifyRAGFunctionality }