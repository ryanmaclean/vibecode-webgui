// API tests for AI Chat Streaming endpoint
// Tests OpenRouter integration, streaming, and error handling

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { POST } from '@/app/api/ai/chat/stream/route'
import { NextRequest } from 'next/server'

// Mock OpenAI SDK
const mockOpenAI = {
  chat: {
    completions: {
      create: jest.fn()
    }
  }
}

jest.mock('openai', () => ({
  OpenAI: jest.fn(() => mockOpenAI)
}))

// Mock environment variables
jest.mock('process', () => ({
  env: {
    OPENROUTER_API_KEY: 'test-api-key',
    NEXTAUTH_URL: 'http://localhost:3000'
  }
}))

describe('/api/ai/chat/stream', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('POST request handling', () => {
    it('returns streaming response for valid request', async () => {
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield {
            choices: [{
              delta: { content: 'Hello' }
            }]
          }
          yield {
            choices: [{
              delta: { content: ' there!' }
            }]
          }
        }
      }

      mockOpenAI.chat.completions.create.mockResolvedValue(mockStream)

      const request = new NextRequest('http://localhost:3000/api/ai/chat/stream', {
        method: 'POST',
        body: JSON.stringify({
          message: 'Hello',
          model: 'anthropic/claude-3-sonnet',
          context: {
            workspaceId: 'test-workspace',
            files: ['test.js'],
            previousMessages: []
          }
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toBe('text/event-stream')
      expect(response.headers.get('Cache-Control')).toBe('no-cache')
      
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
        model: 'anthropic/claude-3-sonnet',
        messages: expect.arrayContaining([
          expect.objectContaining({ role: 'system' }),
          expect.objectContaining({ role: 'user', content: 'Hello' })
        ]),
        stream: true,
        temperature: 0.7,
        max_tokens: 4000,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0
      })
    })

    it('validates required fields', async () => {
      const request = new NextRequest('http://localhost:3000/api/ai/chat/stream', {
        method: 'POST',
        body: JSON.stringify({
          // Missing message and model
          context: {
            workspaceId: 'test'
          }
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Message and model are required')
    })

    it('handles missing API key', async () => {
      // Mock missing API key
      jest.doMock('process', () => ({
        env: {
          OPENROUTER_API_KEY: undefined
        }
      }))

      const request = new NextRequest('http://localhost:3000/api/ai/chat/stream', {
        method: 'POST',
        body: JSON.stringify({
          message: 'Hello',
          model: 'anthropic/claude-3-sonnet',
          context: { workspaceId: 'test' }
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('OpenRouter API key not configured')
    })

    it('builds context from workspace files', async () => {
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield { choices: [{ delta: { content: 'Response' } }] }
        }
      }

      mockOpenAI.chat.completions.create.mockResolvedValue(mockStream)

      const request = new NextRequest('http://localhost:3000/api/ai/chat/stream', {
        method: 'POST',
        body: JSON.stringify({
          message: 'Analyze my code',
          model: 'anthropic/claude-3-sonnet',
          context: {
            workspaceId: 'test-workspace',
            files: ['app.js', 'utils.js', 'config.json'],
            previousMessages: []
          }
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      })

      await POST(request)

      const systemMessage = mockOpenAI.chat.completions.create.mock.calls[0][0].messages[0]
      expect(systemMessage.role).toBe('system')
      expect(systemMessage.content).toContain('app.js, utils.js, config.json')
      expect(systemMessage.content).toContain('test-workspace')
    })

    it('includes previous messages for context', async () => {
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield { choices: [{ delta: { content: 'Response' } }] }
        }
      }

      mockOpenAI.chat.completions.create.mockResolvedValue(mockStream)

      const previousMessages = [
        { type: 'user', content: 'Previous question' },
        { type: 'assistant', content: 'Previous answer' }
      ]

      const request = new NextRequest('http://localhost:3000/api/ai/chat/stream', {
        method: 'POST',
        body: JSON.stringify({
          message: 'Follow up question',
          model: 'anthropic/claude-3-sonnet',
          context: {
            workspaceId: 'test',
            files: [],
            previousMessages
          }
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      })

      await POST(request)

      const messages = mockOpenAI.chat.completions.create.mock.calls[0][0].messages
      expect(messages).toHaveLength(4) // system + 2 previous + current
      expect(messages[1]).toEqual({ role: 'user', content: 'Previous question' })
      expect(messages[2]).toEqual({ role: 'assistant', content: 'Previous answer' })
      expect(messages[3]).toEqual({ role: 'user', content: 'Follow up question' })
    })

    it('limits previous messages to prevent token overflow', async () => {
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield { choices: [{ delta: { content: 'Response' } }] }
        }
      }

      mockOpenAI.chat.completions.create.mockResolvedValue(mockStream)

      // Create 10 previous messages
      const previousMessages = Array.from({ length: 10 }, (_, i) => ({
        type: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i}`
      }))

      const request = new NextRequest('http://localhost:3000/api/ai/chat/stream', {
        method: 'POST',
        body: JSON.stringify({
          message: 'Current question',
          model: 'anthropic/claude-3-sonnet',
          context: {
            workspaceId: 'test',
            files: [],
            previousMessages
          }
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      })

      await POST(request)

      const messages = mockOpenAI.chat.completions.create.mock.calls[0][0].messages
      // Should include system + last 6 previous + current = 8 total
      expect(messages).toHaveLength(8)
    })

    it('handles OpenAI API errors', async () => {
      mockOpenAI.chat.completions.create.mockRejectedValue(new Error('API Error'))

      const request = new NextRequest('http://localhost:3000/api/ai/chat/stream', {
        method: 'POST',
        body: JSON.stringify({
          message: 'Hello',
          model: 'anthropic/claude-3-sonnet',
          context: { workspaceId: 'test' }
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to process chat request')
      expect(data.details).toBe('API Error')
    })

    it('handles malformed JSON request', async () => {
      const request = new NextRequest('http://localhost:3000/api/ai/chat/stream', {
        method: 'POST',
        body: 'invalid json',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to process chat request')
    })
  })

  describe('CORS handling', () => {
    it('handles OPTIONS request for CORS', async () => {
      const { OPTIONS } = await import('@/app/api/ai/chat/stream/route')
      
      const response = await OPTIONS()

      expect(response.status).toBe(200)
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST')
      expect(response.headers.get('Access-Control-Allow-Headers')).toContain('Content-Type')
    })
  })

  describe('Response streaming', () => {
    it('formats streaming chunks correctly', async () => {
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield { choices: [{ delta: { content: 'Hello' } }] }
          yield { choices: [{ delta: { content: ' world' } }] }
          yield { choices: [{ delta: {} }] } // Empty delta
        }
      }

      mockOpenAI.chat.completions.create.mockResolvedValue(mockStream)

      const request = new NextRequest('http://localhost:3000/api/ai/chat/stream', {
        method: 'POST',
        body: JSON.stringify({
          message: 'Hello',
          model: 'anthropic/claude-3-sonnet',
          context: { workspaceId: 'test' }
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const response = await POST(request)
      
      expect(response.headers.get('Content-Type')).toBe('text/event-stream')
      expect(response.headers.get('Cache-Control')).toBe('no-cache')
      expect(response.headers.get('Connection')).toBe('keep-alive')
    })
  })
})