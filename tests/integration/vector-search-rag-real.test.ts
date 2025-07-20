/**
 * REAL Vector Search and RAG Integration Tests
 * 
 * Tests actual vector search functionality and RAG integration
 * NO MOCKING - Real database operations and embeddings API calls
 * 
 * Tests the complete RAG pipeline:
 * 1. Document chunking and embedding generation
 * 2. pgvector storage and retrieval
 * 3. Semantic search with OpenAI embeddings
 * 4. RAG context integration in AI chat
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals'
import { vectorStore } from '../../src/lib/vector-store'
import { prisma } from '../../src/lib/prisma'

// Skip these tests if not in environment with real API keys
const shouldRunRealTests = 
  process.env.ENABLE_REAL_AI_TESTS === 'true' && 
  process.env.OPENROUTER_API_KEY && 
  process.env.DATABASE_URL

const conditionalDescribe = shouldRunRealTests ? describe : describe.skip

conditionalDescribe('Real Vector Search and RAG Integration (NO MOCKING)', () => {
  let testWorkspace: any
  let testFile: any
  let testUserId = 1

  beforeAll(async () => {
    if (!process.env.OPENROUTER_API_KEY) {
      throw new Error('OPENROUTER_API_KEY must be set for real RAG tests')
    }
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL must be set for real RAG tests')
    }

    // Create test workspace and file for RAG testing
    try {
      testWorkspace = await prisma.workspace.create({
        data: {
          workspace_id: `test-rag-workspace-${Date.now()}`,
          name: 'RAG Test Workspace',
          user_id: testUserId,
          status: 'active'
        }
      })

      testFile = await prisma.file.create({
        data: {
          name: 'test-auth-component.tsx',
          path: '/components/auth/LoginComponent.tsx',
          content: `
import React, { useState } from 'react'
import { signIn, signOut, useSession } from 'next-auth/react'

/**
 * Authentication component for user login/logout
 * Handles OAuth providers and session management
 */
export function LoginComponent() {
  const { data: session, status } = useSession()
  const [isLoading, setIsLoading] = useState(false)

  const handleSignIn = async (provider: string) => {
    setIsLoading(true)
    try {
      await signIn(provider, { callbackUrl: '/dashboard' })
    } catch (error) {
      console.error('Sign-in error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignOut = async () => {
    setIsLoading(true)
    try {
      await signOut({ callbackUrl: '/' })
    } catch (error) {
      console.error('Sign-out error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (status === 'loading') {
    return <div>Loading authentication...</div>
  }

  if (session) {
    return (
      <div className="auth-container">
        <p>Signed in as {session.user?.email}</p>
        <button 
          onClick={handleSignOut}
          disabled={isLoading}
          className="sign-out-btn"
        >
          {isLoading ? 'Signing out...' : 'Sign Out'}
        </button>
      </div>
    )
  }

  return (
    <div className="auth-container">
      <h2>Sign in to VibeCode</h2>
      <button 
        onClick={() => handleSignIn('github')}
        disabled={isLoading}
        className="github-signin-btn"
      >
        {isLoading ? 'Signing in...' : 'Sign in with GitHub'}
      </button>
      <button 
        onClick={() => handleSignIn('google')}
        disabled={isLoading}
        className="google-signin-btn"
      >
        {isLoading ? 'Signing in...' : 'Sign in with Google'}
      </button>
    </div>
  )
}
          `,
          language: 'typescript',
          size: 2500,
          user_id: testUserId,
          workspace_id: testWorkspace.id
        }
      })
    } catch (error) {
      console.error('Failed to create test data:', error)
      throw error
    }
  }, 30000)

  afterAll(async () => {
    // Clean up test data
    try {
      if (testFile) {
        await vectorStore.deleteFileChunks(testFile.id)
        await prisma.file.delete({ where: { id: testFile.id } })
      }
      if (testWorkspace) {
        await prisma.workspace.delete({ where: { id: testWorkspace.id } })
      }
    } catch (error) {
      console.error('Cleanup error:', error)
    }
  }, 15000)

  test('should generate real embeddings using OpenAI API', async () => {
    const testText = 'This is a test authentication function that handles user login.'
    
    const embedding = await vectorStore.generateEmbedding(testText)
    
    // OpenAI text-embedding-3-small returns 1536-dimensional vectors
    expect(embedding).toHaveLength(1536)
    expect(embedding[0]).toBeTypeOf('number')
    expect(embedding.every(val => typeof val === 'number')).toBe(true)
    
    // Embeddings should be normalized (roughly between -1 and 1)
    const maxValue = Math.max(...embedding.map(Math.abs))
    expect(maxValue).toBeLessThan(2)
  }, 15000)

  test('should store document chunks with real embeddings in pgvector', async () => {
    const chunks = [
      {
        content: 'Authentication component for user login/logout. Handles OAuth providers and session management.',
        startLine: 1,
        endLine: 5,
        tokens: 15
      },
      {
        content: 'Function handleSignIn manages OAuth sign-in process with provider selection and error handling.',
        startLine: 10,
        endLine: 20,
        tokens: 18
      },
      {
        content: 'Function handleSignOut manages user logout with callback URL and error handling.',
        startLine: 25,
        endLine: 35,
        tokens: 16
      }
    ]

    await vectorStore.storeChunks(testFile.id, chunks)

    // Verify chunks were stored in database
    const storedChunks = await prisma.rAGChunk.findMany({
      where: { file_id: testFile.id }
    })

    expect(storedChunks).toHaveLength(3)
    expect(storedChunks[0].content).toContain('Authentication component')
    expect(storedChunks[0].embedding).toBeTruthy()
    expect(storedChunks[0].tokens).toBe(15)
  }, 30000)

  test('should perform semantic search with real pgvector cosine similarity', async () => {
    // Search for authentication-related content
    const results = await vectorStore.search('user login authentication OAuth', {
      workspaceId: testWorkspace.id,
      limit: 5,
      threshold: 0.5
    })

    expect(results).toHaveLength(3) // Should find all our test chunks
    expect(results[0].similarity).toBeGreaterThan(0.5)
    expect(results[0].chunk.content).toContain('Authentication')
    
    // Results should be ordered by similarity (highest first)
    for (let i = 1; i < results.length; i++) {
      expect(results[i-1].similarity).toBeGreaterThanOrEqual(results[i].similarity)
    }

    // Verify metadata is properly structured
    expect(results[0].chunk.metadata).toHaveProperty('fileId')
    expect(results[0].chunk.metadata).toHaveProperty('fileName')
    expect(results[0].chunk.metadata.fileId).toBe(testFile.id)
  }, 20000)

  test('should generate relevant context for RAG prompts', async () => {
    const context = await vectorStore.getContext(
      'How do I implement user authentication?',
      testWorkspace.id,
      2000
    )

    expect(context).toBeTruthy()
    expect(context).toContain('test-auth-component.tsx')
    expect(context).toContain('Authentication component')
    expect(context).toContain('handleSignIn')
    expect(context).toContain('OAuth')
    
    // Context should be properly formatted for AI consumption
    expect(context).toContain('---')
    expect(context).toContain('lines')
  }, 15000)

  test('should handle different similarity thresholds correctly', async () => {
    // High threshold - should return fewer, more relevant results
    const highThresholdResults = await vectorStore.search('authentication login', {
      workspaceId: testWorkspace.id,
      threshold: 0.8,
      limit: 10
    })

    // Low threshold - should return more results
    const lowThresholdResults = await vectorStore.search('authentication login', {
      workspaceId: testWorkspace.id,
      threshold: 0.3,
      limit: 10
    })

    expect(lowThresholdResults.length).toBeGreaterThanOrEqual(highThresholdResults.length)
    
    // All high threshold results should have high similarity
    highThresholdResults.forEach(result => {
      expect(result.similarity).toBeGreaterThan(0.8)
    })
  }, 15000)

  test('should support filtering by specific files', async () => {
    const results = await vectorStore.search('authentication', {
      fileIds: [testFile.id],
      limit: 5,
      threshold: 0.4
    })

    expect(results).toHaveLength(3)
    results.forEach(result => {
      expect(result.chunk.metadata.fileId).toBe(testFile.id)
    })
  }, 15000)

  test('should handle search queries with no matches gracefully', async () => {
    const results = await vectorStore.search('quantum physics machine learning algorithms', {
      workspaceId: testWorkspace.id,
      threshold: 0.8,
      limit: 5
    })

    // Should return empty array or low similarity results
    expect(Array.isArray(results)).toBe(true)
    results.forEach(result => {
      expect(result.similarity).toBeTypeOf('number')
      expect(result.similarity).toBeGreaterThanOrEqual(0)
      expect(result.similarity).toBeLessThanOrEqual(1)
    })
  }, 10000)

  test('should provide vector store statistics', async () => {
    const stats = await vectorStore.getStats()

    expect(stats).toHaveProperty('totalChunks')
    expect(stats).toHaveProperty('totalFiles')
    expect(stats).toHaveProperty('averageChunkSize')
    
    expect(stats.totalChunks).toBeGreaterThan(0)
    expect(stats.totalFiles).toBeGreaterThan(0)
    expect(typeof stats.averageChunkSize).toBe('number')
  }, 10000)

  test('should handle concurrent search requests efficiently', async () => {
    const queries = [
      'user authentication login',
      'OAuth provider GitHub Google',
      'session management signOut',
      'error handling loading state',
      'React component useState'
    ]

    const startTime = Date.now()
    
    const searchPromises = queries.map(query =>
      vectorStore.search(query, {
        workspaceId: testWorkspace.id,
        limit: 3,
        threshold: 0.4
      })
    )

    const results = await Promise.all(searchPromises)
    const duration = Date.now() - startTime

    // All searches should complete
    expect(results).toHaveLength(5)
    results.forEach(resultSet => {
      expect(Array.isArray(resultSet)).toBe(true)
    })

    // Should complete in reasonable time (concurrent requests)
    expect(duration).toBeLessThan(10000) // 10 seconds for 5 concurrent searches
  }, 15000)

  test('should validate embedding consistency across multiple generations', async () => {
    const testText = 'Authentication component with OAuth providers'
    
    // Generate the same embedding multiple times
    const embedding1 = await vectorStore.generateEmbedding(testText)
    await new Promise(resolve => setTimeout(resolve, 100)) // Small delay
    const embedding2 = await vectorStore.generateEmbedding(testText)

    expect(embedding1).toHaveLength(embedding2.length)
    
    // Calculate cosine similarity between the two embeddings
    let dotProduct = 0
    let norm1 = 0
    let norm2 = 0
    
    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i]
      norm1 += embedding1[i] * embedding1[i]
      norm2 += embedding2[i] * embedding2[i]
    }
    
    const similarity = dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2))
    
    // Embeddings for identical text should be very similar (> 0.99)
    expect(similarity).toBeGreaterThan(0.99)
  }, 10000)

  test('should properly clean up deleted file chunks', async () => {
    // Create a temporary file for deletion testing
    const tempFile = await prisma.file.create({
      data: {
        name: 'temp-delete-test.ts',
        path: '/temp/delete-test.ts',
        content: 'const temp = "This is a temporary file for deletion testing"',
        language: 'typescript',
        size: 100,
        user_id: testUserId,
        workspace_id: testWorkspace.id
      }
    })

    // Store chunks for the temporary file
    await vectorStore.storeChunks(tempFile.id, [{
      content: 'Temporary file content for deletion testing',
      startLine: 1,
      endLine: 1,
      tokens: 8
    }])

    // Verify chunks exist
    let chunks = await prisma.rAGChunk.findMany({
      where: { file_id: tempFile.id }
    })
    expect(chunks).toHaveLength(1)

    // Delete chunks
    await vectorStore.deleteFileChunks(tempFile.id)

    // Verify chunks are deleted
    chunks = await prisma.rAGChunk.findMany({
      where: { file_id: tempFile.id }
    })
    expect(chunks).toHaveLength(0)

    // Clean up temp file
    await prisma.file.delete({ where: { id: tempFile.id } })
  }, 15000)
})

// Test to validate our vector search tests use real functionality
describe('Vector Search Test Quality Validation', () => {
  test('should not mock database operations in vector search tests', () => {
    const fs = require('fs')
    const testFileContent = fs.readFileSync(__filename, 'utf8')

    // Integration tests should have NO database mocking
    expect(testFileContent).not.toContain("jest.mock('../../src/lib/prisma')")
    expect(testFileContent).not.toContain("jest.mock('../../src/lib/vector-store')")
    expect(testFileContent).not.toContain('mockPrisma')
    expect(testFileContent).not.toContain('mockVectorStore')
  })

  test('should verify real embedding API is used', () => {
    if (!shouldRunRealTests) {
      console.log('Skipping real API validation - tests not enabled')
      return
    }

    expect(process.env.OPENROUTER_API_KEY).toBeTruthy()
    expect(process.env.OPENROUTER_API_KEY).not.toContain('test')
    expect(process.env.OPENROUTER_API_KEY).not.toContain('mock')
    expect(process.env.OPENROUTER_API_KEY).not.toContain('fake')
  })

  test('should verify real database connection is used', () => {
    if (!shouldRunRealTests) {
      console.log('Skipping database validation - tests not enabled')
      return
    }

    expect(process.env.DATABASE_URL).toBeTruthy()
    expect(process.env.DATABASE_URL).toContain('postgresql://')
  })
})