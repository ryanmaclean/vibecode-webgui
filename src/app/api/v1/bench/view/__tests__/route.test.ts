/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { GET, POST } from '../route'
import { BENCH_VIEW_MAX_BYTES } from '@/lib/bench/endpoint'

// Synthetic test record: values are fixtures, not measurements.
const rec = (overrides: Record<string, unknown> = {}) => ({
  schema: 'ryanlab.bench.v1',
  project: 'moth',
  timestamp: '2026-09-23T00:00:00Z',
  workload: 'worker-footprint-v1',
  metrics: { rss_bytes: 4096 },
  ...overrides,
})

function post(body: string, headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/v1/bench/view', {
    method: 'POST',
    body,
    headers: { 'content-type': 'application/json', ...headers },
  })
}

describe('GET /api/v1/bench/view', () => {
  it('returns a machine-readable descriptor', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({
      schema: 'vibecode.endpoint.v1',
      input_schema: 'ryanlab.bench.v1',
      output_schema: 'vibecode.bench-view.v1',
      canonical_source: 'ryanmaclean/skills:schemas/bench.v1.schema.json',
      persistence: 'none',
    })
  })
})

describe('POST /api/v1/bench/view', () => {
  it('returns a derived view for a JSON array', async () => {
    const res = await POST(post(JSON.stringify([rec(), rec({ timestamp: '2026-09-23T01:00:00Z', metrics: { rss_bytes: 2048 } })])))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.schema).toBe('vibecode.bench-view.v1')
    expect(body.record_count).toBe(2)
    expect(body.rejected).toEqual([])
    expect(body.series[0].deltas[0]).toMatchObject({ key: 'rss_bytes', verdict: 'better', deltaPct: -50 })
  })

  it('accepts NDJSON and reports rejected lines alongside accepted ones', async () => {
    const ndjson = [JSON.stringify(rec()), JSON.stringify({ schema: 'ryanlab.bench.v1' })].join('\n')
    const res = await POST(post(ndjson, { 'content-type': 'application/x-ndjson' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.record_count).toBe(1)
    expect(body.rejected.length).toBeGreaterThan(0)
    expect(body.rejected.every((i: { index: number }) => i.index === 1)).toBe(true)
  })

  it('returns 422 with issues when nothing validates', async () => {
    const res = await POST(post(JSON.stringify({ schema: 'other' })))
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error.code).toBe('no_valid_records')
    expect(body.error.issues.length).toBeGreaterThan(0)
  })

  it('rejects oversized bodies with 413', async () => {
    const res = await POST(post('x', { 'content-length': String(BENCH_VIEW_MAX_BYTES + 1) }))
    expect(res.status).toBe(413)
    const big = await POST(post(' '.repeat(BENCH_VIEW_MAX_BYTES + 1)))
    expect(big.status).toBe(413)
  })
})
