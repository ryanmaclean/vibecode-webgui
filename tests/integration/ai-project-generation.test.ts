/**
 * Integration tests for AI Project Generation workflow
 * Tests the complete Lovable/Replit/Bolt.diy flow
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { NextRequest } from 'next/server'
import { POST } from '../../src/app/api/ai/generate-project/route'
import { getServerSession } from 'next-auth'

// Mock dependencies
jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}))

jest.mock('../../src/lib/auth', () => ({
  authOptions: {},
}))

// Mock fetch for external API calls
const mockFetch = jest.fn()
global.fetch = mockFetch

describe('AI Project Generation Integration', () => {
  const mockSession = {
    user: {
      id: 'test-user-123',
      email: 'test@example.com',
      name: 'Test User',
    },
  }

  const mockOpenRouterResponse = {
    choices: [
      {
        message: {
          content: JSON.stringify({
            name: 'todo-app',
            description: 'A simple todo application',
            files: [
              {
                path: 'src/index.js',
                content: 'console.log("Hello, World!");',
                type: 'file',
              },
              {
                path: 'package.json',
                content: '{"name": "todo-app"}',
                type: 'file',
              },
            ],
            scripts: {
              start: 'node src/index.js',
              dev: 'nodemon src/index.js',
            },
            dependencies: {
              express: '^4.18.0',
            },
            devDependencies: {
              nodemon: '^3.0.0',
            },
            envVars: [
              {
                name: 'PORT',
                value: '3000',
                description: 'Application port',
              },
            ],
          }),
        },
      },
    ],
  }

  const mockCodeServerResponse = {
    id: 'cs-123',
    workspaceId: 'ai-project-123',
    url: 'http://localhost:8080',
    status: 'starting',
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as any).mockResolvedValue(mockSession)
    
    // Mock environment variables
    process.env.OPENROUTER_API_KEY = 'test-key'
    process.env.NEXTAUTH_URL = 'http://localhost:3000'
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('POST /api/ai/generate-project', () => {
    it('should generate a complete project from AI prompt', async () => {
      // Mock OpenRouter API response
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockOpenRouterResponse,
        })
        // Mock code-server session creation
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockCodeServerResponse,
        })
        // Mock file sync API
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true }),
        })

      const request = new NextRequest('http://localhost:3000/api/ai/generate-project', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: 'Create a simple todo app with Express.js',
          language: 'javascript',
          framework: 'express',
          features: ['Authentication', 'Database'],
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.workspaceId).toBeDefined()
      expect(data.workspaceUrl).toMatch(/^\/workspace\/ai-project-/)
      expect(data.projectStructure).toEqual({
        name: 'todo-app',
        description: 'A simple todo application',
        fileCount: 2,
        language: 'javascript',
        framework: 'express',
      })

      // Verify OpenRouter API was called correctly
      expect(mockFetch).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Authorization': 'Bearer test-key',
            'Content-Type': 'application/json',
          },
          body: expect.stringContaining('Create a simple todo app with Express.js'),
        })
      )

      // Verify code-server session was created
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/code-server/session',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: expect.stringContaining('test-user-123'),
        })
      )

      // Verify files were seeded
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/files/sync',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: expect.stringContaining('src/index.js'),
        })
      )
    })

    it('should handle custom project name', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockOpenRouterResponse,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockCodeServerResponse,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true }),
        })

      const request = new NextRequest('http://localhost:3000/api/ai/generate-project', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: 'Create a todo app',
          projectName: 'my-awesome-todo',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.projectStructure.name).toBe('my-awesome-todo')
    })

    it('should require authentication', async () => {
      ;(getServerSession as any).mockResolvedValue(null)

      const request = new NextRequest('http://localhost:3000/api/ai/generate-project', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: 'Create a todo app',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('should validate input data', async () => {
      const request = new NextRequest('http://localhost:3000/api/ai/generate-project', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: '', // Empty prompt should fail
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid request data')
    })

    it('should handle OpenRouter API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      })

      const request = new NextRequest('http://localhost:3000/api/ai/generate-project', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: 'Create a todo app',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to generate project')
    })

    it('should handle code-server session creation errors', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockOpenRouterResponse,
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
        })

      const request = new NextRequest('http://localhost:3000/api/ai/generate-project', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: 'Create a todo app',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to generate project')
    })

    it('should handle file seeding errors', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockOpenRouterResponse,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockCodeServerResponse,
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
        })

      const request = new NextRequest('http://localhost:3000/api/ai/generate-project', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: 'Create a todo app',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to generate project')
    })

    it('should handle invalid AI response format', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: 'Invalid JSON response',
              },
            },
          ],
        }),
      })

      const request = new NextRequest('http://localhost:3000/api/ai/generate-project', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: 'Create a todo app',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to generate project')
    })
  })

  describe('AI Project Generation Workflow', () => {
    it('should create workspace with generated files', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockOpenRouterResponse,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockCodeServerResponse,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true }),
        })

      const request = new NextRequest('http://localhost:3000/api/ai/generate-project', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: 'Create a React todo app',
          language: 'typescript',
          framework: 'react',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)

      // Verify the complete workflow
      expect(mockFetch).toHaveBeenCalledTimes(3)
      
      // 1. AI generation
      expect(mockFetch).toHaveBeenNthCalledWith(
        1,
        'https://openrouter.ai/api/v1/chat/completions',
        expect.any(Object)
      )
      
      // 2. Code-server session creation
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        'http://localhost:3000/api/code-server/session',
        expect.any(Object)
      )
      
      // 3. File seeding
      expect(mockFetch).toHaveBeenNthCalledWith(
        3,
        'http://localhost:3000/api/files/sync',
        expect.any(Object)
      )
    })

    it('should generate appropriate file structure', async () => {
      const complexProjectResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                name: 'react-todo-app',
                description: 'A React todo application with TypeScript',
                files: [
                  {
                    path: 'src/App.tsx',
                    content: 'import React from "react";\n\nfunction App() {\n  return <div>Todo App</div>;\n}',
                    type: 'file',
                  },
                  {
                    path: 'src/components/TodoList.tsx',
                    content: 'export const TodoList = () => <div>Todo List</div>;',
                    type: 'file',
                  },
                  {
                    path: 'src/types/index.ts',
                    content: 'export interface Todo {\n  id: string;\n  text: string;\n  completed: boolean;\n}',
                    type: 'file',
                  },
                  {
                    path: 'tailwind.config.js',
                    content: 'module.exports = { content: ["./src/**/*.{js,jsx,ts,tsx}"] };',
                    type: 'file',
                  },
                ],
                scripts: {
                  start: 'react-scripts start',
                  build: 'react-scripts build',
                  test: 'react-scripts test',
                },
                dependencies: {
                  react: '^18.0.0',
                  'react-dom': '^18.0.0',
                  typescript: '^4.9.0',
                },
                devDependencies: {
                  '@types/react': '^18.0.0',
                  'tailwindcss': '^3.0.0',
                },
                envVars: [
                  {
                    name: 'REACT_APP_API_URL',
                    value: 'http://localhost:3001',
                    description: 'API base URL',
                  },
                ],
              }),
            },
          },
        ],
      }

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => complexProjectResponse,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockCodeServerResponse,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true }),
        })

      const request = new NextRequest('http://localhost:3000/api/ai/generate-project', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: 'Create a React todo app with TypeScript and Tailwind',
          language: 'typescript',
          framework: 'react',
          features: ['Responsive Design', 'Testing'],
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.projectStructure.fileCount).toBe(4)

      // Verify files were seeded with correct structure
      const filesSyncCall = mockFetch.mock.calls[2]
      const filesSyncBody = JSON.parse(filesSyncCall[1].body)
      
      expect(filesSyncBody.files).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: 'src/App.tsx',
            content: expect.stringContaining('React'),
          }),
          expect.objectContaining({
            path: 'package.json',
            content: expect.stringContaining('react-todo-app'),
          }),
          expect.objectContaining({
            path: '.env.example',
            content: expect.stringContaining('REACT_APP_API_URL'),
          }),
        ])
      )
    })
  })
})