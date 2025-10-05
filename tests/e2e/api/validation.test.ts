/**
 * E2E Tests for Zod Input Validation on API Routes
 * Tests security validations for issue #462
 */

import { describe, test, expect } from '@jest/globals'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

describe('API Input Validation - Issue #462', () => {
  describe('/api/ai/chat/enhanced', () => {
    test('should reject empty message', async () => {
      const response = await fetch(`${API_BASE_URL}/api/ai/chat/enhanced`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: '',
          model: 'gpt-4',
          context: {
            workspaceId: 'test-workspace',
            files: [],
            previousMessages: []
          }
        })
      })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe('Invalid request data')
      expect(data.details).toContainEqual(
        expect.objectContaining({
          field: 'message',
          message: expect.stringContaining('cannot be empty')
        })
      )
    })

    test('should reject oversized message (>50KB)', async () => {
      const largeMessage = 'x'.repeat(50001)
      const response = await fetch(`${API_BASE_URL}/api/ai/chat/enhanced`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: largeMessage,
          model: 'gpt-4',
          context: {
            workspaceId: 'test-workspace',
            files: [],
            previousMessages: []
          }
        })
      })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.details).toContainEqual(
        expect.objectContaining({
          field: 'message',
          message: expect.stringContaining('exceeds maximum')
        })
      )
    })

    test('should reject workspace ID with path traversal', async () => {
      const response = await fetch(`${API_BASE_URL}/api/ai/chat/enhanced`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'test',
          model: 'gpt-4',
          context: {
            workspaceId: '../../../etc/passwd',
            files: [],
            previousMessages: []
          }
        })
      })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.details).toContainEqual(
        expect.objectContaining({
          field: 'context.workspaceId',
          message: expect.stringContaining('invalid characters')
        })
      )
    })

    test('should reject invalid model', async () => {
      const response = await fetch(`${API_BASE_URL}/api/ai/chat/enhanced`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'test',
          model: 'invalid-model',
          context: {
            workspaceId: 'test-workspace',
            files: [],
            previousMessages: []
          }
        })
      })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.details).toContainEqual(
        expect.objectContaining({
          field: 'model',
          message: expect.stringContaining('Invalid')
        })
      )
    })

    test('should reject files with path traversal', async () => {
      const response = await fetch(`${API_BASE_URL}/api/ai/chat/enhanced`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'test',
          model: 'gpt-4',
          context: {
            workspaceId: 'test-workspace',
            files: ['../../etc/passwd'],
            previousMessages: []
          }
        })
      })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.details).toContainEqual(
        expect.objectContaining({
          field: 'context.files',
          message: expect.stringContaining('path traversal')
        })
      )
    })

    test('should reject too many context files (>50)', async () => {
      const manyFiles = Array(51).fill('file.txt')
      const response = await fetch(`${API_BASE_URL}/api/ai/chat/enhanced`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'test',
          model: 'gpt-4',
          context: {
            workspaceId: 'test-workspace',
            files: manyFiles,
            previousMessages: []
          }
        })
      })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.details).toContainEqual(
        expect.objectContaining({
          field: 'context.files',
          message: expect.stringContaining('Too many')
        })
      )
    })
  })

  describe('/api/workspaces/[id]', () => {
    test('should reject workspace ID with special characters', async () => {
      const response = await fetch(`${API_BASE_URL}/api/workspaces/../admin`, {
        method: 'GET'
      })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe('Invalid workspace ID')
    })

    test('should reject workspace ID with path traversal', async () => {
      const response = await fetch(`${API_BASE_URL}/api/workspaces/..%2F..%2Fetc%2Fpasswd`, {
        method: 'GET'
      })

      expect(response.status).toBe(400)
    })

    test('should accept valid workspace ID', async () => {
      const response = await fetch(`${API_BASE_URL}/api/workspaces/test-workspace-123`, {
        method: 'GET'
      })

      // Should not reject due to validation (may 404 if workspace doesn't exist)
      expect(response.status).not.toBe(400)
    })
  })

  describe('/api/ai/upload', () => {
    test('should reject missing workspace ID', async () => {
      const formData = new FormData()
      formData.append('files', new Blob(['test']), 'test.txt')

      const response = await fetch(`${API_BASE_URL}/api/ai/upload`, {
        method: 'POST',
        body: formData
      })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.details).toContainEqual(
        expect.objectContaining({
          field: 'workspaceId',
          message: expect.stringContaining('required')
        })
      )
    })

    test('should reject workspace ID with path traversal', async () => {
      const formData = new FormData()
      formData.append('workspaceId', '../../../etc')
      formData.append('files', new Blob(['test']), 'test.txt')

      const response = await fetch(`${API_BASE_URL}/api/ai/upload`, {
        method: 'POST',
        body: formData
      })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.details).toContainEqual(
        expect.objectContaining({
          field: 'workspaceId',
          message: expect.stringContaining('invalid characters')
        })
      )
    })

    test('should reject file with path traversal in filename', async () => {
      const formData = new FormData()
      formData.append('workspaceId', 'test-workspace')
      formData.append('files', new Blob(['test']), '../../etc/passwd')

      const response = await fetch(`${API_BASE_URL}/api/ai/upload`, {
        method: 'POST',
        body: formData
      })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('invalid characters')
    })

    test('should reject too many files (>10)', async () => {
      const formData = new FormData()
      formData.append('workspaceId', 'test-workspace')

      for (let i = 0; i < 11; i++) {
        formData.append('files', new Blob(['test']), `file${i}.txt`)
      }

      const response = await fetch(`${API_BASE_URL}/api/ai/upload`, {
        method: 'POST',
        body: formData
      })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('Too many files')
    })

    test('should reject oversized file (>10MB)', async () => {
      const formData = new FormData()
      formData.append('workspaceId', 'test-workspace')

      // Create a 10MB+ file
      const largeContent = new Uint8Array(10 * 1024 * 1024 + 1)
      formData.append('files', new Blob([largeContent]), 'large.txt')

      const response = await fetch(`${API_BASE_URL}/api/ai/upload`, {
        method: 'POST',
        body: formData
      })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('exceeds maximum size')
    })
  })

  describe('/api/docs/search', () => {
    test('should reject empty query', async () => {
      const response = await fetch(`${API_BASE_URL}/api/docs/search?q=`, {
        method: 'GET'
      })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.details).toContainEqual(
        expect.objectContaining({
          field: 'q',
          message: expect.stringContaining('cannot be empty')
        })
      )
    })

    test('should reject oversized query (>200 chars)', async () => {
      const longQuery = 'x'.repeat(201)
      const response = await fetch(`${API_BASE_URL}/api/docs/search?q=${longQuery}`, {
        method: 'GET'
      })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.details).toContainEqual(
        expect.objectContaining({
          field: 'q',
          message: expect.stringContaining('exceeds maximum')
        })
      )
    })

    test('should reject malicious regex patterns (ReDoS)', async () => {
      const response = await fetch(`${API_BASE_URL}/api/docs/search?q=.*.*.*.*`, {
        method: 'GET'
      })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.details).toContainEqual(
        expect.objectContaining({
          field: 'q',
          message: expect.stringContaining('dangerous patterns')
        })
      )
    })

    test('should reject invalid limit values', async () => {
      const response = await fetch(`${API_BASE_URL}/api/docs/search?q=test&limit=1000`, {
        method: 'GET'
      })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.details).toContainEqual(
        expect.objectContaining({
          field: 'limit',
          message: expect.stringContaining('cannot exceed 100')
        })
      )
    })

    test('should accept valid search query', async () => {
      const response = await fetch(`${API_BASE_URL}/api/docs/search?q=test&limit=10`, {
        method: 'GET'
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.query).toBe('test')
    })
  })

  describe('/api/ai/web-search', () => {
    test('should reject empty query', async () => {
      const response = await fetch(`${API_BASE_URL}/api/ai/web-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: ''
        })
      })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.details).toContainEqual(
        expect.objectContaining({
          field: 'query',
          message: expect.stringContaining('cannot be empty')
        })
      )
    })

    test('should reject oversized query (>500 chars)', async () => {
      const longQuery = 'x'.repeat(501)
      const response = await fetch(`${API_BASE_URL}/api/ai/web-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: longQuery
        })
      })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.details).toContainEqual(
        expect.objectContaining({
          field: 'query',
          message: expect.stringContaining('exceeds maximum')
        })
      )
    })

    test('should reject malicious query patterns', async () => {
      const response = await fetch(`${API_BASE_URL}/api/ai/web-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: '<script>alert("xss")</script>'
        })
      })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.details).toContainEqual(
        expect.objectContaining({
          field: 'query',
          message: expect.stringContaining('malicious')
        })
      )
    })

    test('should reject invalid maxResults', async () => {
      const response = await fetch(`${API_BASE_URL}/api/ai/web-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'test',
          maxResults: 100
        })
      })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.details).toContainEqual(
        expect.objectContaining({
          field: 'maxResults',
          message: expect.stringContaining('cannot exceed 20')
        })
      )
    })

    test('should reject invalid language code', async () => {
      const response = await fetch(`${API_BASE_URL}/api/ai/web-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'test',
          language: 'english'
        })
      })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.details).toContainEqual(
        expect.objectContaining({
          field: 'language',
          message: expect.stringContaining('2-letter code')
        })
      )
    })

    test('should accept valid web search request', async () => {
      const response = await fetch(`${API_BASE_URL}/api/ai/web-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'test query',
          maxResults: 5,
          language: 'en',
          region: 'us'
        })
      })

      // Should not reject due to validation
      expect(response.status).not.toBe(400)
    })
  })
})
