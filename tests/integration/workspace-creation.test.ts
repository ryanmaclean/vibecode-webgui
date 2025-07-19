/**
 * Integration tests for workspace creation and code-server integration
 * Tests the bridge between project generation and live workspace
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { NextRequest } from 'next/server'
import { POST, GET } from '../../src/app/api/code-server/session/route'
import { POST as FileSyncPOST } from '../../src/app/api/files/sync/route'
import { getServerSession } from 'next-auth'

// Mock dependencies
jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}))

jest.mock('../../src/lib/auth', () => ({
  authOptions: {},
}))

describe('Workspace Creation Integration', () => {
  const mockSession = {
    user: {
      id: 'test-user-123',
      email: 'test@example.com',
      name: 'Test User',
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as any).mockResolvedValue(mockSession)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('Code-Server Session Management', () => {
    it('should create a new code-server session', async () => {
      const request = new NextRequest('http://localhost:3000/api/code-server/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workspaceId: 'ai-project-123',
          userId: 'test-user-123',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.id).toBeDefined()
      expect(data.workspaceId).toBe('ai-project-123')
      expect(data.userId).toBe('test-user-123')
      expect(data.status).toBe('starting')
      expect(data.createdAt).toBeDefined()
      expect(data.lastActivity).toBeDefined()
    })

    it('should return existing session if already exists', async () => {
      // Create first session
      const request1 = new NextRequest('http://localhost:3000/api/code-server/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workspaceId: 'ai-project-123',
          userId: 'test-user-123',
        }),
      })

      const response1 = await POST(request1)
      const data1 = await response1.json()

      // Create second session with same parameters
      const request2 = new NextRequest('http://localhost:3000/api/code-server/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workspaceId: 'ai-project-123',
          userId: 'test-user-123',
        }),
      })

      const response2 = await POST(request2)
      const data2 = await response2.json()

      expect(response2.status).toBe(200)
      expect(data2.id).toBe(data1.id)
      expect(data2.workspaceId).toBe('ai-project-123')
    })

    it('should require authentication', async () => {
      ;(getServerSession as any).mockResolvedValue(null)

      const request = new NextRequest('http://localhost:3000/api/code-server/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workspaceId: 'ai-project-123',
          userId: 'test-user-123',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('should validate user ownership', async () => {
      const request = new NextRequest('http://localhost:3000/api/code-server/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workspaceId: 'ai-project-123',
          userId: 'different-user-456',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toBe('Forbidden')
    })

    it('should list user sessions', async () => {
      // Create a session first
      const createRequest = new NextRequest('http://localhost:3000/api/code-server/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workspaceId: 'ai-project-123',
          userId: 'test-user-123',
        }),
      })

      await POST(createRequest)

      // List sessions
      const listRequest = new NextRequest('http://localhost:3000/api/code-server/session', {
        method: 'GET',
      })

      const response = await GET(listRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.sessions).toBeDefined()
      expect(Array.isArray(data.sessions)).toBe(true)
      expect(data.sessions.length).toBe(1)
      expect(data.sessions[0].workspaceId).toBe('ai-project-123')
      expect(data.sessions[0].userId).toBe('test-user-123')
    })

    it('should filter sessions by workspace ID', async () => {
      // Create multiple sessions
      const createRequest1 = new NextRequest('http://localhost:3000/api/code-server/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workspaceId: 'ai-project-123',
          userId: 'test-user-123',
        }),
      })

      const createRequest2 = new NextRequest('http://localhost:3000/api/code-server/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workspaceId: 'ai-project-456',
          userId: 'test-user-123',
        }),
      })

      await POST(createRequest1)
      await POST(createRequest2)

      // List sessions filtered by workspace ID
      const listRequest = new NextRequest('http://localhost:3000/api/code-server/session?workspaceId=ai-project-123', {
        method: 'GET',
      })

      const response = await GET(listRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.sessions).toBeDefined()
      expect(data.sessions.length).toBe(1)
      expect(data.sessions[0].workspaceId).toBe('ai-project-123')
    })
  })

  describe('File Sync Integration', () => {
    it('should sync files to workspace', async () => {
      const testFiles = [
        {
          path: 'src/App.js',
          content: 'import React from "react";\n\nfunction App() {\n  return <div>Hello World</div>;\n}\n\nexport default App;',
          type: 'file',
        },
        {
          path: 'package.json',
          content: JSON.stringify({
            name: 'test-app',
            version: '1.0.0',
            dependencies: {
              react: '^18.0.0',
            },
          }, null, 2),
          type: 'file',
        },
        {
          path: 'README.md',
          content: '# Test App\n\nThis is a test application.',
          type: 'file',
        },
      ]

      const request = new NextRequest('http://localhost:3000/api/files/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workspaceId: 'ai-project-123',
          files: testFiles,
        }),
      })

      const response = await FileSyncPOST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.workspaceId).toBe('ai-project-123')
      expect(data.filesUploaded).toBe(3)
      expect(data.message).toContain('Files synced successfully')
    })

    it('should handle empty file list', async () => {
      const request = new NextRequest('http://localhost:3000/api/files/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workspaceId: 'ai-project-123',
          files: [],
        }),
      })

      const response = await FileSyncPOST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.filesUploaded).toBe(0)
    })

    it('should validate file structure', async () => {
      const invalidFiles = [
        {
          path: 'src/App.js',
          // Missing content
          type: 'file',
        },
      ]

      const request = new NextRequest('http://localhost:3000/api/files/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workspaceId: 'ai-project-123',
          files: invalidFiles,
        }),
      })

      const response = await FileSyncPOST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid request data')
    })

    it('should require authentication for file sync', async () => {
      ;(getServerSession as any).mockResolvedValue(null)

      const request = new NextRequest('http://localhost:3000/api/files/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workspaceId: 'ai-project-123',
          files: [],
        }),
      })

      const response = await FileSyncPOST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })
  })

  describe('Complete Workspace Creation Workflow', () => {
    it('should create workspace and seed files in correct order', async () => {
      // Step 1: Create code-server session
      const sessionRequest = new NextRequest('http://localhost:3000/api/code-server/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workspaceId: 'ai-project-123',
          userId: 'test-user-123',
        }),
      })

      const sessionResponse = await POST(sessionRequest)
      const sessionData = await sessionResponse.json()

      expect(sessionResponse.status).toBe(200)
      expect(sessionData.workspaceId).toBe('ai-project-123')
      expect(sessionData.status).toBe('starting')

      // Step 2: Seed files
      const files = [
        {
          path: 'src/App.js',
          content: 'import React from "react";\n\nfunction App() {\n  return <div>Hello World</div>;\n}\n\nexport default App;',
          type: 'file',
        },
        {
          path: 'package.json',
          content: JSON.stringify({
            name: 'test-app',
            version: '1.0.0',
            dependencies: {
              react: '^18.0.0',
            },
          }, null, 2),
          type: 'file',
        },
      ]

      const filesRequest = new NextRequest('http://localhost:3000/api/files/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workspaceId: 'ai-project-123',
          files,
        }),
      })

      const filesResponse = await FileSyncPOST(filesRequest)
      const filesData = await filesResponse.json()

      expect(filesResponse.status).toBe(200)
      expect(filesData.success).toBe(true)
      expect(filesData.workspaceId).toBe('ai-project-123')
      expect(filesData.filesUploaded).toBe(2)

      // Step 3: Verify session still exists
      const listRequest = new NextRequest('http://localhost:3000/api/code-server/session?workspaceId=ai-project-123', {
        method: 'GET',
      })

      const listResponse = await GET(listRequest)
      const listData = await listResponse.json()

      expect(listResponse.status).toBe(200)
      expect(listData.sessions.length).toBe(1)
      expect(listData.sessions[0].workspaceId).toBe('ai-project-123')
    })

    it('should handle concurrent workspace creation', async () => {
      // Create multiple sessions concurrently
      const promises = Array.from({ length: 3 }, (_, i) => {
        const request = new NextRequest('http://localhost:3000/api/code-server/session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            workspaceId: `ai-project-${i}`,
            userId: 'test-user-123',
          }),
        })
        return POST(request)
      })

      const responses = await Promise.all(promises)
      const dataArray = await Promise.all(responses.map(r => r.json()))

      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200)
      })

      // All should have different workspace IDs
      const workspaceIds = dataArray.map(data => data.workspaceId)
      expect(new Set(workspaceIds).size).toBe(3)
    })

    it('should clean up resources on error', async () => {
      // This test would verify cleanup behavior
      // For now, we'll just test that errors are handled gracefully
      
      const request = new NextRequest('http://localhost:3000/api/code-server/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workspaceId: '', // Invalid workspace ID
          userId: 'test-user-123',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid request data')
    })
  })
})