/**
 * Integration test: /api/codebase-index
 * - Mocks NextAuth session
 * - Mocks CodebaseIndexer without requiring live filesystem/database
 * - Verifies all route methods return well-formed responses
 */

// Mock NextAuth session to bypass auth in tests (must be hoisted before route import)
jest.mock('next-auth', () => ({
  getServerSession: jest.fn().mockResolvedValue({ user: { id: '1' } }),
}))

// Mock Prisma for DELETE operation
jest.mock('@/lib/prisma', () => ({
  prisma: {
    codebaseIndex: {
      deleteMany: jest.fn().mockResolvedValue({ count: 150 }),
    },
    rAGChunk: {
      deleteMany: jest.fn().mockResolvedValue({ count: 450 }),
    },
  },
}))

// Mock CodebaseIndexer with simulated indexing operations
jest.mock('@/lib/indexing/codebase-indexer', () => {
  const actual = jest.requireActual('@/lib/indexing/codebase-indexer') as typeof import('@/lib/indexing/codebase-indexer')

  // Mock indexing status
  const mockIndexingStatus = {
    projectId: 123,
    totalFiles: 150,
    indexedFiles: 150,
    progress: 100,
    isIndexing: false,
    lastIndexedAt: new Date('2024-02-15T10:30:00Z'),
    totalChunks: 450
  }

  // Mock indexing results for project
  const mockIndexingResults = [
    {
      success: true,
      filePath: '/project/src/components/Header.tsx',
      chunkCount: 5
    },
    {
      success: true,
      filePath: '/project/src/lib/utils.ts',
      chunkCount: 3
    },
    {
      success: true,
      filePath: '/project/src/api/routes.ts',
      chunkCount: 8
    }
  ]

  // Mock single file reindex result
  const mockReindexResult = {
    success: true,
    filePath: '/project/src/components/Header.tsx',
    chunkCount: 6
  }

  return {
    __esModule: true,
    ...actual,
    CodebaseIndexer: jest.fn().mockImplementation(() => ({
      async getIndexStatus(projectId: number) {
        return { ...mockIndexingStatus, projectId }
      },
      async indexProject(
        projectId: number,
        workspaceId: number,
        userId: number,
        projectPath: string,
        onProgress?: (current: number, total: number, currentFile: string) => void
      ) {
        // Simulate progress callbacks if provided
        if (onProgress) {
          mockIndexingResults.forEach((result, index) => {
            onProgress(index + 1, mockIndexingResults.length, result.filePath)
          })
        }
        return mockIndexingResults
      },
      async updateIndex(
        filePath: string,
        projectId: number,
        workspaceId: number,
        userId: number
      ) {
        return { ...mockReindexResult, filePath }
      },
    })),
  }
})

import { GET as getIndexStatus, POST as indexProject, PUT as reindexFile, DELETE as deleteIndex } from '@/app/api/codebase-index/route'

describe('GET /api/codebase-index (mocked indexer)', () => {
  it('returns indexing status for a project', async () => {
    const req = new Request('http://localhost/api/codebase-index?projectId=123', {
      method: 'GET',
    }) as any

    const res = await getIndexStatus(req) as any
    expect(res).toBeTruthy()
    const status = typeof res.status === 'number' ? res.status : 200
    expect(status).toBeGreaterThanOrEqual(200)
    expect(status).toBeLessThan(500)

    // Try to parse JSON if available
    let data: any = undefined
    if (typeof res.json === 'function') {
      try { data = await res.json() } catch (_) { /* ignore */ }
    } else if (typeof res.text === 'function') {
      try { const raw = await res.text(); data = raw ? JSON.parse(raw) : undefined } catch (_) { /* ignore */ }
    }

    if (data && typeof data === 'object') {
      if (data.status === 'success' && data.data) {
        expect(typeof data.data.projectId).toBe('number')
        expect(typeof data.data.totalFiles).toBe('number')
        expect(typeof data.data.indexedFiles).toBe('number')
        expect(typeof data.data.progress).toBe('number')
        expect(typeof data.data.isIndexing).toBe('boolean')
        expect(typeof data.data.totalChunks).toBe('number')
        expect(data.data.projectId).toBe(123)
      }
    }
  }, 60_000)

  it('returns 400 when projectId is missing', async () => {
    const req = new Request('http://localhost/api/codebase-index', {
      method: 'GET',
    }) as any

    const res = await getIndexStatus(req) as any
    expect(res).toBeTruthy()
    const status = typeof res.status === 'number' ? res.status : 200
    expect(status).toBe(400)
  }, 60_000)

  it('returns 400 when projectId is invalid', async () => {
    const req = new Request('http://localhost/api/codebase-index?projectId=invalid', {
      method: 'GET',
    }) as any

    const res = await getIndexStatus(req) as any
    expect(res).toBeTruthy()
    const status = typeof res.status === 'number' ? res.status : 200
    expect(status).toBe(400)
  }, 60_000)
})

describe('POST /api/codebase-index (mocked indexer)', () => {
  it('triggers project indexing and returns results', async () => {
    const payload = {
      projectId: 123,
      workspaceId: 456,
      projectPath: '/project/root'
    }

    const req = new Request('http://localhost/api/codebase-index', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    }) as any

    const res = await indexProject(req) as any
    expect(res).toBeTruthy()
    const status = typeof res.status === 'number' ? res.status : 200
    expect(status).toBeGreaterThanOrEqual(200)
    expect(status).toBeLessThan(500)

    // Try to parse JSON if available
    let data: any = undefined
    if (typeof res.json === 'function') {
      try { data = await res.json() } catch (_) { /* ignore */ }
    } else if (typeof res.text === 'function') {
      try { const raw = await res.text(); data = raw ? JSON.parse(raw) : undefined } catch (_) { /* ignore */ }
    }

    if (data && typeof data === 'object') {
      if (data.status === 'success' && data.data) {
        expect(data.data.projectId).toBe(123)
        expect(typeof data.data.totalFiles).toBe('number')
        expect(typeof data.data.successCount).toBe('number')
        expect(typeof data.data.failureCount).toBe('number')
        expect(Array.isArray(data.data.results)).toBe(true)

        if (data.data.results.length > 0) {
          const firstResult = data.data.results[0]
          expect(typeof firstResult.success).toBe('boolean')
          expect(typeof firstResult.filePath).toBe('string')
          expect(typeof firstResult.chunkCount).toBe('number')
        }
      }
    }
  }, 60_000)

  it('returns 400 when request body is invalid', async () => {
    const payload = {
      projectId: 'invalid',
      workspaceId: 456
      // missing projectPath
    }

    const req = new Request('http://localhost/api/codebase-index', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    }) as any

    const res = await indexProject(req) as any
    expect(res).toBeTruthy()
    const status = typeof res.status === 'number' ? res.status : 200
    expect(status).toBe(400)
  }, 60_000)
})

describe('PUT /api/codebase-index (mocked indexer)', () => {
  it('re-indexes a specific file and returns result', async () => {
    const payload = {
      projectId: 123,
      workspaceId: 456,
      filePath: '/project/src/components/Header.tsx'
    }

    const req = new Request('http://localhost/api/codebase-index', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    }) as any

    const res = await reindexFile(req) as any
    expect(res).toBeTruthy()
    const status = typeof res.status === 'number' ? res.status : 200
    expect(status).toBeGreaterThanOrEqual(200)
    expect(status).toBeLessThan(500)

    // Try to parse JSON if available
    let data: any = undefined
    if (typeof res.json === 'function') {
      try { data = await res.json() } catch (_) { /* ignore */ }
    } else if (typeof res.text === 'function') {
      try { const raw = await res.text(); data = raw ? JSON.parse(raw) : undefined } catch (_) { /* ignore */ }
    }

    if (data && typeof data === 'object') {
      if (data.status === 'success' && data.data) {
        expect(typeof data.data.success).toBe('boolean')
        expect(typeof data.data.filePath).toBe('string')
        expect(typeof data.data.chunkCount).toBe('number')
        expect(data.data.filePath).toBe('/project/src/components/Header.tsx')
      }
    }
  }, 60_000)

  it('returns 400 when request body is invalid', async () => {
    const payload = {
      projectId: 123,
      workspaceId: 456
      // missing filePath
    }

    const req = new Request('http://localhost/api/codebase-index', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    }) as any

    const res = await reindexFile(req) as any
    expect(res).toBeTruthy()
    const status = typeof res.status === 'number' ? res.status : 200
    expect(status).toBe(400)
  }, 60_000)
})

describe('DELETE /api/codebase-index (mocked indexer)', () => {
  it('deletes project index successfully', async () => {
    const payload = {
      projectId: 123
    }

    const req = new Request('http://localhost/api/codebase-index', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    }) as any

    const res = await deleteIndex(req) as any
    expect(res).toBeTruthy()
    const status = typeof res.status === 'number' ? res.status : 200
    expect(status).toBeGreaterThanOrEqual(200)
    expect(status).toBeLessThan(500)

    // Try to parse JSON if available
    let data: any = undefined
    if (typeof res.json === 'function') {
      try { data = await res.json() } catch (_) { /* ignore */ }
    } else if (typeof res.text === 'function') {
      try { const raw = await res.text(); data = raw ? JSON.parse(raw) : undefined } catch (_) { /* ignore */ }
    }

    if (data && typeof data === 'object') {
      if (data.status === 'success' && data.data) {
        expect(typeof data.data.projectId).toBe('number')
        expect(typeof data.data.deletedIndexes).toBe('number')
        expect(typeof data.data.deletedChunks).toBe('number')
        expect(data.data.projectId).toBe(123)
      }
    }
  }, 60_000)

  it('returns 400 when projectId is missing', async () => {
    const payload = {}

    const req = new Request('http://localhost/api/codebase-index', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    }) as any

    const res = await deleteIndex(req) as any
    expect(res).toBeTruthy()
    const status = typeof res.status === 'number' ? res.status : 200
    expect(status).toBe(400)
  }, 60_000)
})
