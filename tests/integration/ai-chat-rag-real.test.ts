/**
 * REAL AI Chat with RAG Integration Tests
 * 
 * Tests the complete RAG-enhanced AI chat functionality
 * NO MOCKING - Real AI API calls with vector search context
 * 
 * Tests the integration between:
 * 1. Vector search context retrieval
 * 2. AI chat stream with enhanced prompts
 * 3. Authentication and session management
 * 4. Real-time streaming responses
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals'
import { NextRequest } from 'next/server'
import { POST } from '../../src/app/api/ai/chat/stream/route'
import { vectorStore } from '../../src/lib/vector-store'
import { prisma } from '../../src/lib/prisma'

// Mock session for testing (only mock auth, not AI functionality)
jest.mock('next-auth', () => ({
  getServerSession: jest.fn()
}))

jest.mock('../../src/lib/auth', () => ({
  authOptions: {}
}))

import { getServerSession } from 'next-auth'

const shouldRunRealTests = 
  process.env.ENABLE_REAL_AI_TESTS === 'true' && 
  process.env.OPENROUTER_API_KEY && 
  process.env.DATABASE_URL

const conditionalDescribe = shouldRunRealTests ? describe : describe.skip

conditionalDescribe('Real AI Chat with RAG Integration (NO AI MOCKING)', () => {
  let testWorkspace: any
  let testFile: any
  const testUserId = 1

  const mockSession = {
    user: {
      id: '1',
      email: 'test@vibecode.dev',
      name: 'Test User'
    }
  }

  beforeAll(async () => {
    if (!process.env.OPENROUTER_API_KEY) {
      throw new Error('OPENROUTER_API_KEY must be set for real AI chat tests')
    }

    // Set up mock session
    ;(getServerSession as jest.Mock).mockResolvedValue(mockSession)

    // Create test workspace and files with realistic code content
    try {
      testWorkspace = await prisma.workspace.create({
        data: {
          workspace_id: `test-chat-rag-workspace-${Date.now()}`,
          name: 'AI Chat RAG Test Workspace',
          user_id: testUserId,
          status: 'active'
        }
      })

      // Create a realistic React component file
      testFile = await prisma.file.create({
        data: {
          name: 'UserDashboard.tsx',
          path: '/src/components/UserDashboard.tsx',
          content: `
import React, { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardHeader, CardContent } from './ui/card'
import { Button } from './ui/button'

interface User {
  id: string
  name: string
  email: string
  avatar?: string
  lastLogin: Date
}

interface Project {
  id: string
  name: string
  description: string
  status: 'active' | 'paused' | 'completed'
  createdAt: Date
  updatedAt: Date
}

/**
 * User Dashboard Component
 * Displays user profile information and recent projects
 * Includes project management functionality
 */
export function UserDashboard() {
  const { data: session, status } = useSession()
  const [user, setUser] = useState<User | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchUserData()
    fetchProjects()
  }, [session])

  const fetchUserData = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/user/profile')
      if (!response.ok) throw new Error('Failed to fetch user data')
      
      const userData = await response.json()
      setUser(userData)
    } catch (err) {
      setError('Failed to load user profile')
      console.error('User data fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects')
      if (!response.ok) throw new Error('Failed to fetch projects')
      
      const projectsData = await response.json()
      setProjects(projectsData)
    } catch (err) {
      setError('Failed to load projects')
      console.error('Projects fetch error:', err)
    }
  }

  const handleCreateProject = async () => {
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'New Project',
          description: 'A new project created from dashboard'
        })
      })
      
      if (!response.ok) throw new Error('Failed to create project')
      
      await fetchProjects() // Refresh project list
    } catch (err) {
      setError('Failed to create project')
      console.error('Project creation error:', err)
    }
  }

  const handleProjectStatusChange = async (projectId: string, newStatus: Project['status']) => {
    try {
      const response = await fetch(\`/api/projects/\${projectId}\`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })
      
      if (!response.ok) throw new Error('Failed to update project status')
      
      await fetchProjects() // Refresh project list
    } catch (err) {
      setError('Failed to update project status')
      console.error('Project update error:', err)
    }
  }

  if (status === 'loading' || loading) {
    return <div className="dashboard-loading">Loading dashboard...</div>
  }

  if (!session) {
    return <div className="dashboard-error">Please sign in to view dashboard</div>
  }

  return (
    <div className="user-dashboard">
      <div className="dashboard-header">
        <h1>Welcome back, {user?.name || session.user?.name}</h1>
        <p className="text-muted">Manage your projects and account settings</p>
      </div>

      {error && (
        <div className="alert alert-error">
          {error}
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      <div className="dashboard-grid">
        <Card className="profile-card">
          <CardHeader>
            <h2>Profile Information</h2>
          </CardHeader>
          <CardContent>
            <div className="profile-details">
              <p><strong>Name:</strong> {user?.name}</p>
              <p><strong>Email:</strong> {user?.email}</p>
              <p><strong>Last Login:</strong> {user?.lastLogin?.toLocaleDateString()}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="projects-card">
          <CardHeader>
            <h2>Recent Projects</h2>
            <Button onClick={handleCreateProject}>Create New Project</Button>
          </CardHeader>
          <CardContent>
            <div className="projects-list">
              {projects.length === 0 ? (
                <p>No projects yet. Create your first project!</p>
              ) : (
                projects.map(project => (
                  <div key={project.id} className="project-item">
                    <h3>{project.name}</h3>
                    <p>{project.description}</p>
                    <div className="project-meta">
                      <span className={\`status status-\${project.status}\`}>
                        {project.status}
                      </span>
                      <span>Updated: {project.updatedAt.toLocaleDateString()}</span>
                    </div>
                    <div className="project-actions">
                      <Button 
                        size="sm" 
                        onClick={() => handleProjectStatusChange(project.id, 'active')}
                        disabled={project.status === 'active'}
                      >
                        Activate
                      </Button>
                      <Button 
                        size="sm" 
                        variant="secondary"
                        onClick={() => handleProjectStatusChange(project.id, 'paused')}
                        disabled={project.status === 'paused'}
                      >
                        Pause
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleProjectStatusChange(project.id, 'completed')}
                        disabled={project.status === 'completed'}
                      >
                        Complete
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default UserDashboard
          `,
          language: 'typescript',
          size: 5000,
          user_id: testUserId,
          workspace_id: testWorkspace.id
        }
      })

      // Store vector chunks for the test file
      const chunks = [
        {
          content: 'User Dashboard Component displays user profile information and recent projects. Includes project management functionality with create, update, and status change features.',
          startLine: 20,
          endLine: 25,
          tokens: 25
        },
        {
          content: 'fetchUserData function makes API call to /api/user/profile endpoint to retrieve user profile information including name, email, and last login date.',
          startLine: 40,
          endLine: 55,
          tokens: 28
        },
        {
          content: 'fetchProjects function calls /api/projects endpoint to retrieve user projects with status, creation date, and description information.',
          startLine: 60,
          endLine: 75,
          tokens: 22
        },
        {
          content: 'handleCreateProject function creates new project by POST request to /api/projects with name and description, then refreshes project list.',
          startLine: 80,
          endLine: 95,
          tokens: 24
        },
        {
          content: 'handleProjectStatusChange function updates project status (active, paused, completed) via PATCH request to /api/projects/[id] endpoint.',
          startLine: 100,
          endLine: 115,
          tokens: 22
        }
      ]

      await vectorStore.storeChunks(testFile.id, chunks)
    } catch (error) {
      console.error('Failed to create test data:', error)
      throw error
    }
  }, 30000)

  afterAll(async () => {
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

  test('should retrieve RAG context for user queries about existing code', async () => {
    const context = await vectorStore.getContext(
      'How do I create a new project in the dashboard?',
      testWorkspace.id,
      2000
    )

    expect(context).toBeTruthy()
    expect(context).toContain('handleCreateProject')
    expect(context).toContain('/api/projects')
    expect(context).toContain('POST request')
    expect(context).toContain('UserDashboard.tsx')
  }, 15000)

  test('should make real AI chat request with RAG context integration', async () => {
    const requestBody = {
      message: 'How do I create a new project in this codebase? Show me the specific implementation.',
      model: 'anthropic/claude-3.5-sonnet',
      context: {
        workspaceId: testWorkspace.workspace_id,
        files: [],
        previousMessages: []
      }
    }

    const request = new NextRequest('http://localhost:3000/api/ai/chat/stream', {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: {
        'Content-Type': 'application/json'
      }
    })

    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/event-stream')

    // Read the streaming response
    const reader = response.body?.getReader()
    const chunks: string[] = []

    if (reader) {
      let chunk = await reader.read()
      let attempts = 0

      while (!chunk.done && attempts < 20) {
        const text = new TextDecoder().decode(chunk.value)
        chunks.push(text)
        chunk = await reader.read()
        attempts++
      }

      reader.releaseLock()

      const fullResponse = chunks.join('')
      
      // Should contain streamed data
      expect(chunks.length).toBeGreaterThan(1)
      expect(fullResponse).toContain('data:')
      
      // AI should reference the actual code from RAG context
      const hasRelevantContent = 
        fullResponse.includes('handleCreateProject') ||
        fullResponse.includes('/api/projects') ||
        fullResponse.includes('UserDashboard') ||
        fullResponse.includes('POST request')
      
      expect(hasRelevantContent).toBe(true)
    }
  }, 45000)

  test('should handle queries about specific functions with RAG context', async () => {
    const requestBody = {
      message: 'How does the project status update functionality work? What are the different statuses?',
      model: 'anthropic/claude-3.5-sonnet',
      context: {
        workspaceId: testWorkspace.workspace_id,
        files: [],
        previousMessages: []
      }
    }

    const request = new NextRequest('http://localhost:3000/api/ai/chat/stream', {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: {
        'Content-Type': 'application/json'
      }
    })

    const response = await POST(request)
    expect(response.status).toBe(200)

    const reader = response.body?.getReader()
    const chunks: string[] = []

    if (reader) {
      let chunk = await reader.read()
      let attempts = 0

      while (!chunk.done && attempts < 15) {
        const text = new TextDecoder().decode(chunk.value)
        chunks.push(text)
        chunk = await reader.read()
        attempts++
      }

      reader.releaseLock()

      const fullResponse = chunks.join('')
      
      // Should reference specific status values and function from code
      const hasStatusInfo = 
        fullResponse.includes('active') ||
        fullResponse.includes('paused') ||
        fullResponse.includes('completed') ||
        fullResponse.includes('handleProjectStatusChange')
      
      expect(hasStatusInfo).toBe(true)
    }
  }, 30000)

  test('should provide contextual responses when no relevant code is found', async () => {
    const requestBody = {
      message: 'How do I implement quantum computing algorithms in this project?',
      model: 'anthropic/claude-3.5-sonnet',
      context: {
        workspaceId: testWorkspace.workspace_id,
        files: [],
        previousMessages: []
      }
    }

    const request = new NextRequest('http://localhost:3000/api/ai/chat/stream', {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: {
        'Content-Type': 'application/json'
      }
    })

    const response = await POST(request)
    expect(response.status).toBe(200)

    const reader = response.body?.getReader()
    const chunks: string[] = []

    if (reader) {
      let chunk = await reader.read()
      let attempts = 0

      while (!chunk.done && attempts < 10) {
        const text = new TextDecoder().decode(chunk.value)
        chunks.push(text)
        chunk = await reader.read()
        attempts++
      }

      reader.releaseLock()

      // Should still provide a valid response even without specific context
      expect(chunks.length).toBeGreaterThan(0)
      const fullResponse = chunks.join('')
      expect(fullResponse).toContain('data:')
    }
  }, 30000)

  test('should handle multiple previous messages in conversation context', async () => {
    const requestBody = {
      message: 'Can you also show me how to handle errors in these API calls?',
      model: 'anthropic/claude-3.5-sonnet',
      context: {
        workspaceId: testWorkspace.workspace_id,
        files: [],
        previousMessages: [
          {
            type: 'user' as const,
            content: 'How do I create a new project?'
          },
          {
            type: 'assistant' as const,
            content: 'You can create a new project using the handleCreateProject function which makes a POST request to /api/projects.'
          }
        ]
      }
    }

    const request = new NextRequest('http://localhost:3000/api/ai/chat/stream', {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: {
        'Content-Type': 'application/json'
      }
    })

    const response = await POST(request)
    expect(response.status).toBe(200)

    const reader = response.body?.getReader()
    const chunks: string[] = []

    if (reader) {
      let chunk = await reader.read()
      let attempts = 0

      while (!chunk.done && attempts < 15) {
        const text = new TextDecoder().decode(chunk.value)
        chunks.push(text)
        chunk = await reader.read()
        attempts++
      }

      reader.releaseLock()

      const fullResponse = chunks.join('')
      
      // Should reference error handling from the code context
      const hasErrorHandling = 
        fullResponse.includes('setError') ||
        fullResponse.includes('catch') ||
        fullResponse.includes('try') ||
        fullResponse.includes('error handling')
      
      expect(hasErrorHandling).toBe(true)
    }
  }, 30000)

  test('should work with different AI models', async () => {
    const models = ['anthropic/claude-3.5-sonnet', 'openai/gpt-4']

    for (const model of models) {
      const requestBody = {
        message: 'What does the fetchUserData function do?',
        model,
        context: {
          workspaceId: testWorkspace.workspace_id,
          files: [],
          previousMessages: []
        }
      }

      const request = new NextRequest('http://localhost:3000/api/ai/chat/stream', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const response = await POST(request)
      expect(response.status).toBe(200)

      const reader = response.body?.getReader()
      const chunks: string[] = []

      if (reader) {
        let chunk = await reader.read()
        let attempts = 0

        while (!chunk.done && attempts < 10) {
          const text = new TextDecoder().decode(chunk.value)
          chunks.push(text)
          chunk = await reader.read()
          attempts++
        }

        reader.releaseLock()

        expect(chunks.length).toBeGreaterThan(0)
        const fullResponse = chunks.join('')
        
        // Should reference the actual function from context
        const hasRelevantContent = 
          fullResponse.includes('fetchUserData') ||
          fullResponse.includes('/api/user/profile') ||
          fullResponse.includes('user profile')
        
        expect(hasRelevantContent).toBe(true)
      }

      // Small delay between model tests
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }, 60000)

  test('should handle authentication errors appropriately', async () => {
    // Temporarily remove mock session
    ;(getServerSession as jest.Mock).mockResolvedValue(null)

    const requestBody = {
      message: 'Test message',
      model: 'anthropic/claude-3.5-sonnet',
      context: {
        workspaceId: testWorkspace.workspace_id,
        files: [],
        previousMessages: []
      }
    }

    const request = new NextRequest('http://localhost:3000/api/ai/chat/stream', {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: {
        'Content-Type': 'application/json'
      }
    })

    const response = await POST(request)
    expect(response.status).toBe(401)

    const errorData = await response.json()
    expect(errorData).toHaveProperty('error')
    expect(errorData.error).toBe('Unauthorized')

    // Restore mock session
    ;(getServerSession as jest.Mock).mockResolvedValue(mockSession)
  }, 10000)
})

// Test to validate we're using real AI APIs, not mocks
describe('AI Chat RAG Test Quality Validation', () => {
  test('should not mock AI or embedding APIs in chat tests', () => {
    const fs = require('fs')
    const testFileContent = fs.readFileSync(__filename, 'utf8')

    // Should not mock AI APIs
    expect(testFileContent).not.toContain("jest.mock('openai')")
    expect(testFileContent).not.toContain("jest.mock('@anthropic")
    expect(testFileContent).not.toContain("jest.mock('../../src/lib/vector-store')")
    expect(testFileContent).not.toContain('mockOpenAI')
    expect(testFileContent).not.toContain('mockEmbedding')
  })

  test('should verify real API keys are configured for AI chat tests', () => {
    if (!shouldRunRealTests) return

    expect(process.env.OPENROUTER_API_KEY).toBeTruthy()
    expect(process.env.OPENROUTER_API_KEY).not.toContain('test')
    expect(process.env.OPENROUTER_API_KEY).not.toContain('mock')
  })
})