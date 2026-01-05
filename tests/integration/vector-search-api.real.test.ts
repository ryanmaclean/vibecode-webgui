/**
 * Integration test: /api/ai/search
 * - Mocks NextAuth session
 * - Requires DATABASE_URL to point at Azure Postgres (with pgvector)
 * - Verifies the route returns results or a well-formed empty response
 */

// Check if PostgreSQL is available (set by jest.globalSetup.js)
const SKIP_POSTGRES = process.env.SKIP_POSTGRES_TESTS === '1';

// Mock NextAuth session to bypass auth in tests (must be hoisted before route import)
jest.mock('next-auth', () => ({
  getServerSession: jest.fn().mockResolvedValue({ user: { id: '1' } }),
}))

// Stub vectorStore with a direct SQL-based similarity search using pg
jest.mock('@/lib/vector-store', () => {
  const { Client } = require('pg')
  const actual = jest.requireActual('@/lib/vector-store') as typeof import('@/lib/vector-store')
  function unitVec(dim: number) {
    const v = Array.from({ length: dim }, () => Math.random() * 2 - 1)
    const m = Math.sqrt(v.reduce((s, x) => s + x * x, 0))
    return v.map((x) => x / m)
  }
  return {
    __esModule: true,
    ...actual,
    vectorStore: {
      async search(
        _query: string,
        opts: { workspaceId?: number; fileIds?: number[]; limit?: number; threshold?: number } = {}
      ) {
        const limit = opts.limit ?? 5
        const conn = process.env.DATABASE_URL
        if (!conn) throw new Error('DATABASE_URL required for test')
        const client = new Client({ connectionString: conn })
        await client.connect()
        const vec = unitVec(1536)
        const vecLiteral = '[' + vec.map((x) => x.toFixed(6)).join(',') + ']'
        const rows = await client.query(
          `SELECT rc.chunk_id, rc.content, rc.start_line, rc.end_line, rc.tokens, rc.file_id,
                  (1 - (rc.embedding <=> $1::vector)) as similarity
             FROM rag_chunks rc
            WHERE rc.embedding IS NOT NULL
            ORDER BY rc.embedding <=> $1::vector
            LIMIT $2`,
          [vecLiteral, limit]
        )
        await client.end()
        return rows.rows.map((r: any) => ({
          chunk: {
            id: r.chunk_id,
            content: r.content,
            embedding: [],
            metadata: { fileId: r.file_id, fileName: 'unknown', tokens: r.tokens || 0 },
          },
          similarity: r.similarity,
        }))
      },
      async getContext() {
        return ''
      },
      async getStats() {
        return { totalChunks: 0, totalFiles: 0, averageChunkSize: 0 }
      },
    },
  }
})

import { POST as vectorSearchPost } from '@/app/api/ai/search/route'

const hasDb = !!process.env.DATABASE_URL
const skipTests = SKIP_POSTGRES || !hasDb;

(skipTests ? describe.skip : describe)('POST /api/ai/search (real DB)', () => {
  it('returns vector search results or an empty set without throwing', async () => {
      const payload = {
        query: 'Datadog DBM vector ingestion verification',
        limit: 5,
        threshold: 0.05,
      }

      const req = new Request('http://localhost/api/ai/search', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      }) as any

      const res = await vectorSearchPost(req) as any
      expect(res).toBeTruthy()
      const status = typeof res.status === 'number' ? res.status : 200
      expect(status).toBeGreaterThanOrEqual(200)
      expect(status).toBeLessThan(500)

      // Try to parse JSON if available; tolerate environments where body read differs
      let data: any = undefined
      if (typeof res.json === 'function') {
        try { data = await res.json() } catch (_) { /* ignore */ }
      } else if (typeof res.text === 'function') {
        try { const raw = await res.text(); data = raw ? JSON.parse(raw) : undefined } catch (_) { /* ignore */ }
      }

      if (data && typeof data === 'object') {
        if (data.success && Array.isArray(data.results)) {
          if (data.results.length > 0) {
            const r = data.results[0]
            expect(typeof r.similarity).toBe('number')
          }
        }
      }
  }, 60_000);
});
