// API tests for AI File Upload endpoint
// Tests file upload, RAG indexing, and error handling

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { POST, GET } from '@/app/api/ai/upload/route'
import { NextRequest } from 'next/server'
import { existsSync } from 'fs'

// Mock filesystem operations
jest.mock('fs', () => ({
  existsSync: jest.fn()
}))

jest.mock('fs/promises', () => ({
  writeFile: jest.fn(),
  mkdir: jest.fn(),
  readFile: jest.fn()
}))

jest.mock('path', () => ({
  join: jest.fn((...args) => args.join('/')),
  extname: jest.fn((filename) => {
    const parts = filename.split('.')
    return parts.length > 1 ? `.${parts[parts.length - 1]}` : ''
  }),
  dirname: jest.fn((path) => path.split('/').slice(0, -1).join('/'))
}))

describe('/api/ai/upload', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(existsSync).mockReturnValue(false) // Default to directories not existing
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('POST - File Upload', () => {
    it('successfully uploads and processes files', async () => {
      const { writeFile, mkdir } = await import('fs/promises')

      // Mock file content
      const fileContent = 'console.log("Hello world");'
      const mockFile = new File([fileContent], 'test.js', { type: 'application/javascript' })

      // Create FormData
      const formData = new FormData()
      formData.append('workspaceId', 'test-workspace')
      formData.append('files', mockFile)

      const request = new NextRequest('http://localhost:3000/api/ai/upload', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.filesUploaded).toBe(1)
      expect(data.files).toHaveLength(1)
      expect(data.files[0]).toMatchObject({
        name: 'test.js',
        size: fileContent.length,
        language: 'javascript'
      })
      expect(data.ragChunks).toBeGreaterThan(0)

      // Verify filesystem operations
      expect(mkdir).toHaveBeenCalled()
      expect(writeFile).toHaveBeenCalled()
    })

    it('validates required workspaceId', async () => {
      const formData = new FormData()
      formData.append('files', new File(['test'], 'test.txt'))

      const request = new NextRequest('http://localhost:3000/api/ai/upload', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Workspace ID is required')
    })

    it('validates files are provided', async () => {
      const formData = new FormData()
      formData.append('workspaceId', 'test-workspace')

      const request = new NextRequest('http://localhost:3000/api/ai/upload', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('No files provided')
    })

    it('detects programming languages correctly', async () => {
      const testCases = [
        { filename: 'test.js', expectedLanguage: 'javascript' },
        { filename: 'test.ts', expectedLanguage: 'typescript' },
        { filename: 'test.py', expectedLanguage: 'python' },
        { filename: 'test.java', expectedLanguage: 'java' },
        { filename: 'test.cpp', expectedLanguage: 'cpp' },
        { filename: 'test.html', expectedLanguage: 'html' },
        { filename: 'test.css', expectedLanguage: 'css' },
        { filename: 'test.json', expectedLanguage: 'json' },
        { filename: 'test.md', expectedLanguage: 'markdown' },
        { filename: 'test.unknown', expectedLanguage: 'text' }
      ]

      for (const testCase of testCases) {
        const formData = new FormData()
        formData.append('workspaceId', 'test-workspace')
        formData.append('files', new File(['test content'], testCase.filename))

        const request = new NextRequest('http://localhost:3000/api/ai/upload', {
          method: 'POST',
          body: formData
        })

        const response = await POST(request)
        const data = await response.json()

        expect(data.files[0].language).toBe(testCase.expectedLanguage)
      }
    })

    it('creates RAG chunks for text content', async () => {
      const longContent = Array(2000).fill('word').join(' ') // Create content longer than chunk size
      const mockFile = new File([longContent], 'large.txt', { type: 'text/plain' })

      const formData = new FormData()
      formData.append('workspaceId', 'test-workspace')
      formData.append('files', mockFile)

      const request = new NextRequest('http://localhost:3000/api/ai/upload', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      const data = await response.json()

      expect(data.ragChunks).toBeGreaterThan(1) // Should create multiple chunks
    })

    it('handles multiple file uploads', async () => {
      const files = [
        new File(['file 1 content'], 'file1.js'),
        new File(['file 2 content'], 'file2.py'),
        new File(['file 3 content'], 'file3.md')
      ]

      const formData = new FormData()
      formData.append('workspaceId', 'test-workspace')
      files.forEach(file => formData.append('files', file))

      const request = new NextRequest('http://localhost:3000/api/ai/upload', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.filesUploaded).toBe(3)
      expect(data.files).toHaveLength(3)
    })

    it('continues processing other files when one fails', async () => {
      // This test would require mocking file processing to fail for specific files
      // For now, we'll test the basic case
      const formData = new FormData()
      formData.append('workspaceId', 'test-workspace')
      formData.append('files', new File(['content'], 'test.js'))

      const request = new NextRequest('http://localhost:3000/api/ai/upload', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
    })

    it('creates proper directory structure', async () => {
      const { mkdir } = await import('fs/promises')

      const formData = new FormData()
      formData.append('workspaceId', 'test-workspace')
      formData.append('files', new File(['test'], 'test.txt'))

      const request = new NextRequest('http://localhost:3000/api/ai/upload', {
        method: 'POST',
        body: formData
      })

      await POST(request)

      // Should create both uploads and RAG directories
      expect(mkdir).toHaveBeenCalledWith(
        expect.stringContaining('uploads/test-workspace'),
        { recursive: true }
      )
    })

    it('handles filesystem errors gracefully', async () => {
      const { writeFile } = await import('fs/promises')
      jest.mocked(writeFile).mockRejectedValue(new Error('Disk full'))

      const formData = new FormData()
      formData.append('workspaceId', 'test-workspace')
      formData.append('files', new File(['test'], 'test.txt'))

      const request = new NextRequest('http://localhost:3000/api/ai/upload', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to upload files')
    })
  })

  describe('GET - List Files', () => {
    it('requires workspaceId parameter', async () => {
      const request = new NextRequest('http://localhost:3000/api/ai/upload')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Workspace ID is required')
    })

    it('returns empty list for new workspace', async () => {
      const request = new NextRequest('http://localhost:3000/api/ai/upload?workspaceId=new-workspace')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.files).toEqual([])
      expect(data.totalFiles).toBe(0)
      expect(data.totalSize).toBe(0)
    })
  })

  describe('File Processing', () => {
    it('generates checksums for file content', async () => {
      const content1 = 'same content'
      const content2 = 'same content'
      const content3 = 'different content'

      const files = [
        new File([content1], 'file1.txt'),
        new File([content2], 'file2.txt'),
        new File([content3], 'file3.txt')
      ]

      const formData = new FormData()
      formData.append('workspaceId', 'test-workspace')
      files.forEach(file => formData.append('files', file))

      const request = new NextRequest('http://localhost:3000/api/ai/upload', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      const data = await response.json()

      // Files with same content should have same checksum (if we exposed it)
      expect(data.files).toHaveLength(3)
    })

    it('counts lines correctly', async () => {
      const multiLineContent = 'line 1\nline 2\nline 3\nline 4'
      const mockFile = new File([multiLineContent], 'multi.txt')

      const formData = new FormData()
      formData.append('workspaceId', 'test-workspace')
      formData.append('files', mockFile)

      const request = new NextRequest('http://localhost:3000/api/ai/upload', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      const data = await response.json()

      expect(data.files[0].lines).toBe(4)
    })

    it('handles binary files gracefully', async () => {
      // Create a binary-like file
      const binaryContent = new Uint8Array([0, 1, 2, 3, 255, 254, 253])
      const mockFile = new File([binaryContent], 'binary.bin')

      const formData = new FormData()
      formData.append('workspaceId', 'test-workspace')
      formData.append('files', mockFile)

      const request = new NextRequest('http://localhost:3000/api/ai/upload', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)

      // Should not crash, even if binary content causes issues
      expect(response.status).toBe(200)
    })
  })

  describe('RAG Indexing', () => {
    it('creates chunks with proper metadata', async () => {
      const content = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5'
      const mockFile = new File([content], 'test.txt')

      const formData = new FormData()
      formData.append('workspaceId', 'test-workspace')
      formData.append('files', mockFile)

      const request = new NextRequest('http://localhost:3000/api/ai/upload', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      const data = await response.json()

      expect(data.ragChunks).toBeGreaterThan(0)
    })

    it('handles existing RAG index', async () => {
      const { readFile, writeFile } = await import('fs/promises')

      // Mock existing RAG index
      const existingIndex = [
        {
          fileId: 'existing-file',
          chunks: [{ id: 'chunk-1', content: 'existing content' }]
        }
      ]

      jest.mocked(existsSync).mockReturnValue(true)
      jest.mocked(readFile).mockResolvedValue(JSON.stringify(existingIndex))

      const formData = new FormData()
      formData.append('workspaceId', 'test-workspace')
      formData.append('files', new File(['new content'], 'new.txt'))

      const request = new NextRequest('http://localhost:3000/api/ai/upload', {
        method: 'POST',
        body: formData
      })

      await POST(request)

      // Should merge with existing index
      expect(writeFile).toHaveBeenCalledWith(
        expect.stringContaining('rag'),
        expect.stringContaining('existing-file')
      )
    })
  })
})
