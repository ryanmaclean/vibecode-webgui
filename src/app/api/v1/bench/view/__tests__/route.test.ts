/**
 * @jest-environment node
 */
import { ReadableStream as NodeReadableStream } from 'node:stream/web'
import type { NextRequest } from 'next/server'
import { GET, POST } from '../route'
import {
  BENCH_VIEW_MAX_BYTES,
  BENCH_VIEW_MAX_ISSUES,
  BENCH_VIEW_MAX_RECORDS,
} from '@/lib/bench/endpoint'

// tests/jest.setup.js replaces next/server with a mock whose NextRequest has
// no body stream, and tests/jest.polyfills.js stubs ReadableStream. The route
// only reads `headers` and the `body` byte stream, so build that surface
// directly with Node's spec ReadableStream.
const CHUNK = 64 * 1024

function streamOf(bytes: Uint8Array): ReadableStream<Uint8Array> {
  let offset = 0
  return new NodeReadableStream<Uint8Array>({
    pull(controller) {
      if (offset >= bytes.byteLength) {
        controller.close()
        return
      }
      controller.enqueue(bytes.subarray(offset, offset + CHUNK))
      offset += CHUNK
    },
  }) as unknown as ReadableStream<Uint8Array>
}

function requestWith(body: ReadableStream<Uint8Array> | null, headers: Record<string, string>): NextRequest {
  return { headers: new Headers(headers), body } as unknown as NextRequest
}

// Synthetic test record: values are fixtures, not measurements.
const rec = (overrides: Record<string, unknown> = {}) => ({
  schema: 'ryanlab.bench.v1',
  project: 'moth',
  timestamp: '2026-09-23T00:00:00Z',
  workload: 'worker-footprint-v1',
  metrics: { rss_bytes: 4096 },
  ...overrides,
})

function post(body: string, headers: Record<string, string> = {}): NextRequest {
  return requestWith(streamOf(new TextEncoder().encode(body)), {
    'content-type': 'application/json',
    ...headers,
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

  it('stops reading a streamed body without Content-Length once it passes the limit', async () => {
    const chunk = new Uint8Array(CHUNK).fill(0x20)
    let pulled = 0
    let cancelled = false
    // An endless body: the route must stop shortly after the limit, not drain it.
    const stream = new NodeReadableStream<Uint8Array>({
      pull(controller) {
        pulled++
        controller.enqueue(chunk)
      },
      cancel() {
        cancelled = true
      },
    }) as unknown as ReadableStream<Uint8Array>
    const res = await POST(requestWith(stream, { 'content-type': 'application/json' }))
    expect(res.status).toBe(413)
    expect((await res.json()).error.code).toBe('payload_too_large')
    expect(cancelled).toBe(true)
    expect(pulled * CHUNK).toBeLessThan(BENCH_VIEW_MAX_BYTES + 4 * CHUNK)
  })

  it('rejects too many candidates before validating them', async () => {
    const body = JSON.stringify(Array.from({ length: BENCH_VIEW_MAX_RECORDS + 1 }, () => ({})))
    const res = await POST(post(body))
    expect(res.status).toBe(413)
    const json = await res.json()
    expect(json.error.code).toBe('too_many_records')
    expect(json.error.issues).toBeUndefined()
  })

  it('caps the issues returned for invalid candidates', async () => {
    const body = JSON.stringify(Array.from({ length: BENCH_VIEW_MAX_RECORDS }, () => ({})))
    const res = await POST(post(body))
    expect(res.status).toBe(422)
    const json = await res.json()
    expect(json.error.issues).toHaveLength(BENCH_VIEW_MAX_ISSUES)
    expect(json.error.issue_count).toBeGreaterThan(BENCH_VIEW_MAX_ISSUES)

    const mixed = await POST(post(JSON.stringify([rec(), ...Array.from({ length: 200 }, () => ({}))])))
    expect(mixed.status).toBe(200)
    const view = await mixed.json()
    expect(view.rejected).toHaveLength(BENCH_VIEW_MAX_ISSUES)
    expect(view.rejected_issue_count).toBeGreaterThan(BENCH_VIEW_MAX_ISSUES)
  })
})
