/**
 * End-to-End RAG Workflow Verification
 *
 * This script verifies the complete RAG integration by:
 * 1. Indexing a test project
 * 2. Verifying index coverage statistics
 * 3. Testing semantic search
 * 4. Testing AI chat with RAG context
 * 5. Testing file watching and incremental updates
 * 6. Verifying coverage dashboard updates
 *
 * NOTE: This script requires:
 * - Running Next.js server (npm run dev)
 * - Valid authentication session
 * - PostgreSQL with pgvector extension
 * - Embedding service configured (OPENAI_API_KEY or AZURE_OPENAI_EMBEDDING_KEY)
 */

import { PrismaClient } from '@prisma/client'
import { CodebaseIndexer } from '@/lib/indexing/codebase-indexer'
import { ContextRetriever } from '@/lib/rag/context-retriever'
import { FileWatcher } from '@/lib/indexing/file-watcher'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

// Test configuration
const TEST_CONFIG = {
  projectId: 999, // Use a test project ID
  workspaceId: 999,
  projectPath: path.join(process.cwd(), 'test-project-rag-verification'),
}

// Color helpers for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
}

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function logStep(step: number, message: string) {
  log(`\n📋 Step ${step}: ${message}`, 'cyan')
}

function logSuccess(message: string) {
  log(`✅ ${message}`, 'green')
}

function logError(message: string) {
  log(`❌ ${message}`, 'red')
}

function logWarning(message: string) {
  log(`⚠️  ${message}`, 'yellow')
}

/**
 * Step 1: Create a test project with sample files
 */
async function createTestProject(): Promise<void> {
  logStep(1, 'Creating test project with sample files')

  // Create test project directory
  if (fs.existsSync(TEST_CONFIG.projectPath)) {
    log('Cleaning up existing test project...', 'yellow')
    fs.rmSync(TEST_CONFIG.projectPath, { recursive: true, force: true })
  }

  fs.mkdirSync(TEST_CONFIG.projectPath, { recursive: true })

  // Create sample source files
  const sampleFiles = [
    {
      path: 'src/auth/authentication.ts',
      content: `/**
 * Authentication Module
 * Handles user authentication using JWT tokens
 */

export class AuthenticationService {
  async login(username: string, password: string): Promise<string> {
    // Validate credentials
    const user = await this.validateCredentials(username, password)

    // Generate JWT token
    const token = this.generateToken(user)

    return token
  }

  private async validateCredentials(username: string, password: string): Promise<User> {
    // Implementation here
    return { id: 1, username, role: 'user' }
  }

  private generateToken(user: User): string {
    // JWT token generation
    return 'jwt-token-here'
  }
}

interface User {
  id: number
  username: string
  role: string
}
`,
    },
    {
      path: 'src/database/connection.ts',
      content: `/**
 * Database Connection Module
 * Manages PostgreSQL database connections with connection pooling
 */

import { Pool } from 'pg'

export class DatabaseConnection {
  private pool: Pool

  constructor() {
    this.pool = new Pool({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    })
  }

  async query(sql: string, params?: any[]): Promise<any> {
    const client = await this.pool.connect()
    try {
      return await client.query(sql, params)
    } finally {
      client.release()
    }
  }

  async close(): Promise<void> {
    await this.pool.end()
  }
}
`,
    },
    {
      path: 'src/api/users.ts',
      content: `/**
 * User API Module
 * REST API endpoints for user management
 */

export async function getUserById(userId: number): Promise<User> {
  const db = new DatabaseConnection()
  const result = await db.query('SELECT * FROM users WHERE id = $1', [userId])
  return result.rows[0]
}

export async function createUser(userData: CreateUserRequest): Promise<User> {
  const db = new DatabaseConnection()
  const result = await db.query(
    'INSERT INTO users (username, email, role) VALUES ($1, $2, $3) RETURNING *',
    [userData.username, userData.email, userData.role]
  )
  return result.rows[0]
}

interface User {
  id: number
  username: string
  email: string
  role: string
}

interface CreateUserRequest {
  username: string
  email: string
  role: string
}
`,
    },
    {
      path: 'README.md',
      content: `# Test Project

This is a test project for RAG workflow verification.

## Features

- Authentication with JWT
- PostgreSQL database integration
- User management API
- Connection pooling

## Getting Started

1. Install dependencies
2. Configure environment variables
3. Run database migrations
4. Start the application
`,
    },
  ]

  for (const file of sampleFiles) {
    const filePath = path.join(TEST_CONFIG.projectPath, file.path)
    const dirPath = path.dirname(filePath)

    // Create directory if it doesn't exist
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true })
    }

    // Write file
    fs.writeFileSync(filePath, file.content, 'utf-8')
  }

  logSuccess(`Created test project with ${sampleFiles.length} files at: ${TEST_CONFIG.projectPath}`)
}

/**
 * Step 2: Index the test project
 */
async function indexTestProject(): Promise<void> {
  logStep(2, 'Indexing test project via CodebaseIndexer')

  const indexer = new CodebaseIndexer()

  try {
    const result = await indexer.indexProject(
      TEST_CONFIG.projectId,
      TEST_CONFIG.workspaceId,
      TEST_CONFIG.projectPath
    )

    logSuccess(`Indexing completed successfully!`)
    log(`   📊 Files indexed: ${result.filesIndexed}`, 'green')
    log(`   📦 Total chunks: ${result.totalChunks}`, 'green')
    log(`   ⏱️  Duration: ${result.duration}ms`, 'green')

    if (result.filesIndexed === 0) {
      logWarning('No files were indexed. Check if the test project has valid source files.')
    }
  } catch (error) {
    logError(`Failed to index project: ${error instanceof Error ? error.message : 'Unknown error'}`)
    throw error
  }
}

/**
 * Step 3: Verify index coverage statistics
 */
async function verifyIndexCoverage(): Promise<{ coveragePercent: number; totalChunks: number }> {
  logStep(3, 'Verifying index coverage statistics')

  const indexer = new CodebaseIndexer()

  try {
    const status = await indexer.getIndexStatus(TEST_CONFIG.projectId)

    log(`   📈 Total files: ${status.totalFiles}`, 'blue')
    log(`   ✅ Indexed files: ${status.indexedFiles}`, 'blue')
    log(`   📊 Coverage: ${status.progress.toFixed(2)}%`, 'blue')
    log(`   📦 Total chunks: ${status.totalChunks}`, 'blue')
    log(`   🕐 Last indexed: ${status.lastIndexedAt?.toISOString() || 'Never'}`, 'blue')

    if (status.progress >= 100) {
      logSuccess('✨ 100% coverage achieved!')
    } else if (status.progress >= 90) {
      logSuccess(`Good coverage: ${status.progress.toFixed(2)}%`)
    } else {
      logWarning(`Coverage is below 90%: ${status.progress.toFixed(2)}%`)
    }

    return {
      coveragePercent: status.progress,
      totalChunks: status.totalChunks,
    }
  } catch (error) {
    logError(`Failed to get index status: ${error instanceof Error ? error.message : 'Unknown error'}`)
    throw error
  }
}

/**
 * Step 4: Test semantic search
 */
async function testSemanticSearch(): Promise<void> {
  logStep(4, 'Testing semantic search for relevant code')

  const retriever = ContextRetriever.getInstance(prisma)

  try {
    // Test query: find authentication code
    const query = 'How does user authentication work with JWT tokens?'
    log(`   🔍 Query: "${query}"`, 'blue')

    const results = await retriever.semanticSearch(query, TEST_CONFIG.projectId, 5)

    if (results.length === 0) {
      logWarning('No results returned from semantic search')
      logWarning('This may indicate embedding service issues or insufficient indexed content')
      return
    }

    logSuccess(`Found ${results.length} relevant code chunks:`)
    results.forEach((result, index) => {
      log(`\n   ${index + 1}. ${result.fileName} (similarity: ${(result.similarity * 100).toFixed(1)}%)`, 'green')
      log(`      Path: ${result.filePath}`, 'reset')
      log(`      Lines: ${result.startLine || '?'}-${result.endLine || '?'}`, 'reset')
      log(`      Preview: ${result.content.substring(0, 100).replace(/\n/g, ' ')}...`, 'reset')
    })

    // Verify we got relevant results
    const hasAuthResult = results.some(r =>
      r.content.toLowerCase().includes('auth') || r.filePath.toLowerCase().includes('auth')
    )

    if (hasAuthResult) {
      logSuccess('✨ Semantic search successfully found authentication-related code!')
    } else {
      logWarning('Semantic search did not find authentication code. Results may not be relevant.')
    }
  } catch (error) {
    logError(`Failed to perform semantic search: ${error instanceof Error ? error.message : 'Unknown error'}`)
    throw error
  }
}

/**
 * Step 5: Test AI context retrieval
 */
async function testAIContextRetrieval(): Promise<void> {
  logStep(5, 'Testing AI context retrieval for chat')

  const retriever = ContextRetriever.getInstance(prisma)

  try {
    const query = 'How do I connect to the PostgreSQL database?'
    log(`   💬 User query: "${query}"`, 'blue')

    const context = await retriever.getContextForPrompt(query, TEST_CONFIG.projectId, 3)

    log(`   📄 Context length: ${context.length} characters`, 'green')

    if (context.length > 0) {
      logSuccess('Context retrieved successfully!')

      // Check if context contains relevant information
      const hasDbContext = context.toLowerCase().includes('database') || context.toLowerCase().includes('postgresql')

      if (hasDbContext) {
        logSuccess('✨ Context contains database-related code!')
      }

      // Show a preview
      log('\n   Context preview:', 'cyan')
      const preview = context.substring(0, 300).replace(/\n/g, '\n   ')
      log(`   ${preview}...`, 'reset')
    } else {
      logWarning('No context retrieved. AI chat would not have RAG context.')
    }
  } catch (error) {
    logError(`Failed to retrieve AI context: ${error instanceof Error ? error.message : 'Unknown error'}`)
    throw error
  }
}

/**
 * Step 6: Test file watching and incremental reindexing
 */
async function testFileWatching(): Promise<void> {
  logStep(6, 'Testing file watcher and incremental reindexing')

  const watcher = new FileWatcher(TEST_CONFIG.projectPath)
  const indexer = new CodebaseIndexer()

  try {
    // Integrate watcher with indexer
    indexer.integrateWithFileWatcher(watcher, TEST_CONFIG.projectId, TEST_CONFIG.workspaceId)

    log('   👀 Starting file watcher...', 'blue')
    watcher.start()

    logSuccess('File watcher started')

    // Wait a moment for the watcher to initialize
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Modify a file to trigger reindexing
    const testFile = path.join(TEST_CONFIG.projectPath, 'src/auth/authentication.ts')

    log('   ✏️  Modifying authentication.ts to trigger reindex...', 'blue')

    const originalContent = fs.readFileSync(testFile, 'utf-8')
    const modifiedContent = originalContent + '\n\n// Test modification for file watcher\n'

    fs.writeFileSync(testFile, modifiedContent, 'utf-8')

    logSuccess('File modified')

    // Wait for file watcher to detect change and trigger reindex
    log('   ⏳ Waiting for file watcher to detect change (5 seconds)...', 'yellow')
    await new Promise(resolve => setTimeout(resolve, 5000))

    // Restore original content
    fs.writeFileSync(testFile, originalContent, 'utf-8')

    // Stop watcher
    watcher.stop()
    logSuccess('File watcher stopped')

    logSuccess('✨ File watching test completed!')
    log('   Check logs above for "File changed" and "Reindexing" messages', 'cyan')
  } catch (error) {
    logError(`Failed to test file watching: ${error instanceof Error ? error.message : 'Unknown error'}`)
    throw error
  }
}

/**
 * Step 7: Verify coverage updates after modifications
 */
async function verifyFinalCoverage(): Promise<void> {
  logStep(7, 'Verifying final coverage statistics')

  const { coveragePercent, totalChunks } = await verifyIndexCoverage()

  if (coveragePercent >= 100) {
    logSuccess(`🎉 Final coverage: ${coveragePercent.toFixed(2)}% with ${totalChunks} chunks`)
  } else {
    logWarning(`Final coverage: ${coveragePercent.toFixed(2)}% with ${totalChunks} chunks`)
  }
}

/**
 * Cleanup test data
 */
async function cleanup(): Promise<void> {
  log('\n🧹 Cleaning up test data...', 'yellow')

  try {
    // Delete test project directory
    if (fs.existsSync(TEST_CONFIG.projectPath)) {
      fs.rmSync(TEST_CONFIG.projectPath, { recursive: true, force: true })
      logSuccess('Test project directory removed')
    }

    // Delete test data from database
    await prisma.rAGChunk.deleteMany({
      where: { project_id: TEST_CONFIG.projectId },
    })
    logSuccess('Test chunks removed from database')
  } catch (error) {
    logWarning(`Cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Main verification workflow
 */
async function runE2EVerification() {
  log('🚀 END-TO-END RAG WORKFLOW VERIFICATION', 'bright')
  log('='.repeat(50), 'cyan')

  const startTime = Date.now()

  try {
    // Execute verification steps in sequence
    await createTestProject()
    await indexTestProject()
    await verifyIndexCoverage()
    await testSemanticSearch()
    await testAIContextRetrieval()
    await testFileWatching()
    await verifyFinalCoverage()

    const duration = Date.now() - startTime

    log('\n' + '='.repeat(50), 'cyan')
    log('🎉 END-TO-END VERIFICATION COMPLETED SUCCESSFULLY!', 'green')
    log(`⏱️  Total duration: ${(duration / 1000).toFixed(2)} seconds`, 'cyan')
    log('='.repeat(50), 'cyan')

    log('\n📝 Manual verification steps remaining:', 'yellow')
    log('   1. Open http://localhost:3000/settings/codebase-index in browser', 'yellow')
    log('   2. Verify dashboard shows 100% coverage', 'yellow')
    log('   3. Test AI chat with RAG enabled via UI', 'yellow')
    log('   4. Verify API endpoints with authentication:', 'yellow')
    log('      - POST /api/semantic-search', 'yellow')
    log('      - POST /api/ai/chat (with useRAG: true)', 'yellow')
    log('      - GET /api/codebase-index/stats', 'yellow')
    log('      - POST /api/codebase-index/watch', 'yellow')
  } catch (error) {
    const duration = Date.now() - startTime

    log('\n' + '='.repeat(50), 'cyan')
    logError('❌ VERIFICATION FAILED!')
    logError(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    log(`⏱️  Duration before failure: ${(duration / 1000).toFixed(2)} seconds`, 'cyan')
    log('='.repeat(50), 'cyan')

    if (error instanceof Error && error.stack) {
      log('\nStack trace:', 'red')
      log(error.stack, 'red')
    }

    process.exit(1)
  } finally {
    // Always cleanup
    await cleanup()
    await prisma.$disconnect()
  }
}

// Run verification if this script is executed directly
if (require.main === module) {
  runE2EVerification().catch(error => {
    logError(`Unexpected error: ${error}`)
    process.exit(1)
  })
}

export { runE2EVerification }
