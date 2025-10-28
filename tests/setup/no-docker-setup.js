/**
 * Jest Setup for Tests Without Docker Dependencies
 * Configures environment for real API testing without containers
 */

// Set test environment variables
process.env.NODE_ENV = 'test'
process.env.NEXTAUTH_URL = 'http://localhost:3000'

// Enable real API tests if API keys are available
if (process.env.OPENROUTER_API_KEY && process.env.DATABASE_URL) {
  process.env.ENABLE_REAL_AI_TESTS = 'true'
  console.log('✅ Real API tests enabled - API keys configured')
} else {
  console.log('⚠️  Real API tests disabled - missing API keys')
  console.log('   Set OPENROUTER_API_KEY and DATABASE_URL to enable full testing')
}

// Disable container-dependent features
process.env.SKIP_DOCKER_TESTS = 'true'
process.env.SKIP_K8S_TESTS = 'true'

// Configure timeouts for real API calls
jest.setTimeout(60000)

// Global test helpers
global.testHelpers = {
  skipIfNoApiKeys: () => {
    if (process.env.ENABLE_REAL_AI_TESTS !== 'true') {
      console.log('Skipping test - API keys not configured')
      return true
    }
    return false
  },
  
  waitForAsyncOperation: async (operation, timeoutMs = 30000) => {
    const startTime = Date.now()
    while (Date.now() - startTime < timeoutMs) {
      try {
        const result = await operation()
        if (result) return result
      } catch (error) {
        // Continue trying
      }
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    throw new Error(`Operation timed out after ${timeoutMs}ms`)
  },
  
  createTestData: {
    user: () => ({
      id: '1',
      email: 'test@vibecode.dev',
      name: 'Test User'
    }),
    
    workspace: (userId = 1) => ({
      workspace_id: `test-workspace-${Date.now()}`,
      name: 'Test Workspace',
      user_id: userId,
      status: 'active'
    }),
    
    file: (workspaceId, userId = 1) => ({
      name: 'test-file.tsx',
      path: '/src/components/TestComponent.tsx',
      content: 'export function TestComponent() { return <div>Test</div> }',
      language: 'typescript',
      size: 100,
      user_id: userId,
      workspace_id: workspaceId
    })
  }
}

// Console override to reduce noise in tests
const originalConsoleLog = console.log
const originalConsoleWarn = console.warn

console.log = (...args) => {
  // Only show important messages during tests
  const message = args.join(' ')
  if (
    message.includes('✅') ||
    message.includes('⚠️') ||
    message.includes('❌') ||
    message.includes('Real API') ||
    message.includes('Vector search') ||
    message.includes('RAG')
  ) {
    originalConsoleLog(...args)
  }
}

console.warn = (...args) => {
  const message = args.join(' ')
  // Show warnings that aren't routine test noise
  if (!message.includes('Warning: ReactDOM.render is deprecated')) {
    originalConsoleWarn(...args)
  }
}

// Restore console methods after tests
afterAll(() => {
  console.log = originalConsoleLog
  console.warn = originalConsoleWarn
})