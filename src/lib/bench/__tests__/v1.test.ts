/**
 * @jest-environment node
 */
import schemaJson from './fixtures/bench.v1.schema.json'
import exampleJson from './fixtures/bench.v1.example.json'
import {
  BENCH_V1_CORE_METRICS,
  BENCH_V1_SCHEMA,
  BENCH_V1_SCHEMA_URL,
  benchRecordV1Schema,
  measuredMetricKeys,
  metricValue,
  parseBenchRecord,
  parseBenchRecords,
  parseBenchText,
} from '../v1'

// Synthetic test record: values are fixtures, not measurements.
function record(overrides: Record<string, unknown> = {}) {
  return {
    schema: 'ryanlab.bench.v1',
    project: 'smolfire',
    timestamp: '2026-09-23T00:00:00Z',
    runtime: 'freebsd-pvh',
    filesystem: 'ffs',
    workload: 'bop-state-crash-recovery-v1',
    metrics: { boot_ms: 120, rss_bytes: 1048576 },
    tags: { purpose: 'test-fixture' },
    ...overrides,
  }
}

describe('drift against canonical skills schema', () => {
  it('uses the same schema id and $id', () => {
    expect(schemaJson.properties.schema.const).toBe(BENCH_V1_SCHEMA)
    expect(schemaJson.$id).toBe(BENCH_V1_SCHEMA_URL)
  })

  it('mirrors the core metric set exactly', () => {
    expect(Object.keys(schemaJson.properties.metrics.properties).sort()).toEqual(
      [...BENCH_V1_CORE_METRICS].sort()
    )
  })

  it('mirrors the top-level property set', () => {
    const zodKeys = Object.keys(benchRecordV1Schema.shape).sort()
    expect(Object.keys(schemaJson.properties).sort()).toEqual(zodKeys)
  })

  it('enforces the same required fields', () => {
    for (const field of schemaJson.required) {
      const input = record() as Record<string, unknown>
      delete input[field]
      const parsed = parseBenchRecord(input)
      expect(parsed.ok).toBe(false)
      if (!parsed.ok) expect(parsed.issues.map((i) => i.path)).toContain(field)
    }
  })

  it('accepts the canonical example record', () => {
    const parsed = parseBenchRecord(exampleJson)
    expect(parsed.ok).toBe(true)
  })
})

describe('parseBenchRecord', () => {
  it('rejects a different schema id', () => {
    const parsed = parseBenchRecord(record({ schema: 'ryanlab.bench.v2' }))
    expect(parsed.ok).toBe(false)
  })

  it('rejects negative metrics and non-integer byte counts', () => {
    const neg = parseBenchRecord(record({ metrics: { boot_ms: -1 } }))
    expect(neg.ok).toBe(false)
    if (!neg.ok) expect(neg.issues[0]?.path).toBe('metrics.boot_ms')

    const frac = parseBenchRecord(record({ metrics: { rss_bytes: 1.5 } }))
    expect(frac.ok).toBe(false)
  })

  it('rejects malformed artifact hashes and timestamps', () => {
    expect(parseBenchRecord(record({ artifact_sha256: 'abc' })).ok).toBe(false)
    expect(parseBenchRecord(record({ timestamp: 'yesterday' })).ok).toBe(false)
  })

  it('accepts offset timestamps and a valid sha256', () => {
    const parsed = parseBenchRecord(
      record({ timestamp: '2026-09-23T09:00:00+09:00', artifact_sha256: 'a'.repeat(64) })
    )
    expect(parsed.ok).toBe(true)
  })

  it('preserves extension metrics and unknown top-level fields', () => {
    const parsed = parseBenchRecord(
      record({ metrics: { boot_ms: 5, jail_spawn_ms: 3.2, label: 'x' }, run_id: 'r-1' })
    )
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.record.metrics.jail_spawn_ms).toBe(3.2)
      expect(parsed.record.run_id).toBe('r-1')
    }
  })

  it('keeps null as not-measured rather than zero', () => {
    const parsed = parseBenchRecord(exampleJson)
    if (!parsed.ok) throw new Error('example should parse')
    expect(metricValue(parsed.record, 'boot_ms')).toBeNull()
    expect(measuredMetricKeys(parsed.record)).toEqual([])
  })
})

describe('parseBenchRecords', () => {
  it('accepts a single record, an array, or a records envelope', () => {
    expect(parseBenchRecords(record()).records).toHaveLength(1)
    expect(parseBenchRecords([record(), record()]).records).toHaveLength(2)
    expect(parseBenchRecords({ records: [record()] }).records).toHaveLength(1)
  })

  it('keeps valid records and reports invalid ones by index', () => {
    const result = parseBenchRecords([record(), { schema: 'nope' }, record()])
    expect(result.records).toHaveLength(2)
    expect(result.issues.every((i) => i.index === 1)).toBe(true)
  })
})

describe('parseBenchText', () => {
  it('parses NDJSON, skipping blank lines and reporting bad lines', () => {
    const text = [JSON.stringify(record()), '', '{not json', JSON.stringify(record())].join('\n')
    const result = parseBenchText(text)
    expect(result.records).toHaveLength(2)
    expect(result.issues).toEqual([{ index: 1, path: '', message: 'line is not valid JSON' }])
  })

  it('parses a JSON array document', () => {
    expect(parseBenchText(JSON.stringify([record(), record()])).records).toHaveLength(2)
  })

  it('returns nothing for empty input', () => {
    expect(parseBenchText('  \n ')).toEqual({ records: [], issues: [], issueCount: 0, truncated: false })
  })
})

describe('parse bounds', () => {
  it('refuses more candidates than maxCandidates before validating any of them', () => {
    const empties = Array.from({ length: 11 }, () => ({}))
    for (const input of [empties, { records: empties }]) {
      expect(parseBenchRecords(input, { maxCandidates: 10 })).toEqual({
        records: [],
        issues: [],
        issueCount: 0,
        truncated: true,
      })
    }
    expect(parseBenchText(JSON.stringify(empties), { maxCandidates: 10 }).truncated).toBe(true)
  })

  it('counts non-blank NDJSON lines against maxCandidates', () => {
    const lines = Array.from({ length: 3 }, () => JSON.stringify(record()))
    expect(parseBenchText(lines.join('\n\n'), { maxCandidates: 3 }).records).toHaveLength(3)
    expect(parseBenchText([...lines, '{}'].join('\n'), { maxCandidates: 3 }).truncated).toBe(true)
  })

  it('caps returned issues but reports the exact total', () => {
    const result = parseBenchRecords([record(), {}, {}, {}], { maxIssues: 2 })
    expect(result.records).toHaveLength(1)
    expect(result.issues).toHaveLength(2)
    expect(result.issueCount).toBeGreaterThan(2)
    expect(result.truncated).toBe(false)
    const ndjson = parseBenchText(['oops', 'nope', JSON.stringify(record())].join('\n'), { maxIssues: 1 })
    expect(ndjson.issues).toEqual([{ index: 0, path: '', message: 'line is not valid JSON' }])
    expect(ndjson.issueCount).toBe(2)
  })
})

describe('measuredMetricKeys', () => {
  it('lists core metrics in schema order, then extensions alphabetically', () => {
    const parsed = parseBenchRecord(
      record({ metrics: { zeta_ms: 1, rss_bytes: 10, alpha_ms: 2, boot_ms: 3, fsync_us_p50: null } })
    )
    if (!parsed.ok) throw new Error('should parse')
    expect(measuredMetricKeys(parsed.record)).toEqual(['rss_bytes', 'boot_ms', 'alpha_ms', 'zeta_ms'])
  })
})
