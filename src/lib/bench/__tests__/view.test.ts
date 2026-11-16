/**
 * @jest-environment node
 */
import { parseBenchRecords, type BenchRecordV1 } from '../v1'
import {
  BENCH_VIEW_SCHEMA,
  CORE_METRIC_SPECS,
  buildBenchView,
  compareRecords,
  formatMetricValue,
  type MetricDelta,
  metricSpec,
  seriesGroupKey,
  seriesKeyOf,
  seriesId,
} from '../view'
import { BENCH_V1_CORE_METRICS } from '../v1'

// Synthetic test records: values are fixtures, not measurements.
function byMetric(deltas: MetricDelta[]): Record<string, MetricDelta> {
  const out: Record<string, MetricDelta> = {}
  for (const d of deltas) out[d.key] = d
  return out
}

function pair(a: Record<string, unknown>, b: Record<string, unknown>): [BenchRecordV1, BenchRecordV1] {
  const [x, y] = recs(a, b)
  if (!x || !y) throw new Error('expected two records')
  return [x, y]
}

function recs(...inputs: Array<Record<string, unknown>>): BenchRecordV1[] {
  const base = {
    schema: 'ryanlab.bench.v1',
    project: 'smolfire',
    runtime: 'freebsd-pvh',
    filesystem: 'ffs',
    workload: 'boot',
    timestamp: '2026-09-23T00:00:00Z',
    metrics: {},
  }
  const { records, issues } = parseBenchRecords(inputs.map((i) => ({ ...base, ...i })))
  if (issues.length) throw new Error(JSON.stringify(issues))
  return records
}

describe('metric specs', () => {
  it('covers every core metric with a Datadog name from BENCHMARKING.md', () => {
    for (const key of BENCH_V1_CORE_METRICS) {
      expect(CORE_METRIC_SPECS[key].datadogMetric).toMatch(/^ryanlab\./)
      expect(CORE_METRIC_SPECS[key].direction).toBe('lower-is-better')
    }
  })

  it('gives extension metrics a neutral spec', () => {
    expect(metricSpec('jail_spawn_ms')).toMatchObject({ unit: 'unknown', direction: 'unknown', datadogMetric: null })
  })
})

describe('formatMetricValue', () => {
  it('never renders null as zero', () => {
    expect(formatMetricValue('boot_ms', null)).toBe('not measured')
  })

  it('formats units', () => {
    expect(formatMetricValue('rss_bytes', 512)).toBe('512 B')
    expect(formatMetricValue('artifact_bytes', 3 * 1024 * 1024)).toBe('3 MiB')
    expect(formatMetricValue('metadata_bytes_per_run', 2048)).toBe('2 KiB/run')
    expect(formatMetricValue('boot_ms', 12.345)).toBe('12.35 ms')
    expect(formatMetricValue('fsync_us_p50', 40)).toBe('40 µs')
    expect(formatMetricValue('write_amplification', 1.25)).toBe('1.25×')
    expect(formatMetricValue('custom', 0.12345)).toBe('0.123')
  })
})

describe('compareRecords', () => {
  it('classifies lower-is-better changes and marks one-sided metrics not comparable', () => {
    const [a, b] = pair(
      { metrics: { boot_ms: 100, rss_bytes: 1000, recovery_ms: 5, custom_x: 1 } },
      { metrics: { boot_ms: 80, rss_bytes: 1100, fsync_us_p50: 9, custom_x: 2 } }
    )
    const byKey = byMetric(compareRecords(a, b))
    expect(byKey.boot_ms).toMatchObject({ verdict: 'better', delta: -20, deltaPct: -20 })
    expect(byKey.rss_bytes).toMatchObject({ verdict: 'worse', delta: 100, deltaPct: 10 })
    expect(byKey.recovery_ms?.verdict).toBe('not-comparable')
    expect(byKey.fsync_us_p50?.verdict).toBe('not-comparable')
    expect(byKey.custom_x?.verdict).toBe('changed')
  })

  it('handles zero baselines and unchanged values', () => {
    const [a, b] = pair({ metrics: { boot_ms: 0, rss_bytes: 7 } }, { metrics: { boot_ms: 5, rss_bytes: 7 } })
    const byKey = byMetric(compareRecords(a, b))
    expect(byKey.boot_ms).toMatchObject({ verdict: 'worse', deltaPct: null })
    expect(byKey.rss_bytes?.verdict).toBe('same')
  })
})

describe('buildBenchView', () => {
  it('groups by project/runtime/filesystem/workload and sorts by time', () => {
    const records = recs(
      { timestamp: '2026-09-23T02:00:00Z', metrics: { boot_ms: 90 } },
      { timestamp: '2026-09-23T01:00:00Z', metrics: { boot_ms: 100 } },
      { workload: 'recovery', metrics: { recovery_ms: 3 } },
      { runtime: null, filesystem: null, project: 'bop', metrics: {} }
    )
    const view = buildBenchView(records)
    expect(view.schema).toBe(BENCH_VIEW_SCHEMA)
    expect(view.input_schema).toBe('ryanlab.bench.v1')
    expect(view.record_count).toBe(4)
    expect(view.series.map((s) => s.id)).toEqual([
      'bop/-/-/boot',
      'smolfire/freebsd-pvh/ffs/boot',
      'smolfire/freebsd-pvh/ffs/recovery',
    ])
    const boot = view.series[1]
    if (!boot) throw new Error('missing boot series')
    expect(boot.records.map((r) => r.metrics.boot_ms)).toEqual([100, 90])
    expect(boot.previous?.metrics.boot_ms).toBe(100)
    expect(boot.deltas).toEqual([
      { key: 'boot_ms', baseline: 100, candidate: 90, delta: -10, deltaPct: -10, verdict: 'better' },
    ])
    expect(view.series[2]?.deltas).toEqual([])
  })

  it('does not mutate input order', () => {
    const records = recs({ timestamp: '2026-09-23T02:00:00Z' }, { timestamp: '2026-09-23T01:00:00Z' })
    const before = records.map((r) => r.timestamp)
    buildBenchView(records)
    expect(records.map((r) => r.timestamp)).toEqual(before)
  })

  it('builds stable series ids', () => {
    expect(seriesId({ project: 'p', runtime: null, filesystem: 'zfs', workload: 'w' })).toBe('p/-/zfs/w')
  })

  it('does not merge series whose display ids collide on /', () => {
    const records = recs(
      { project: 'a/b', runtime: 'c', filesystem: null, workload: 'w', metrics: { boot_ms: 10 } },
      { project: 'a', runtime: 'b/c', filesystem: null, workload: 'w', metrics: { boot_ms: 99 } }
    )
    const [first, second] = records
    if (!first || !second) throw new Error('expected two records')
    expect(seriesId(seriesKeyOf(first))).toBe(seriesId(seriesKeyOf(second)))
    const view = buildBenchView(records)
    expect(view.series).toHaveLength(2)
    expect(view.series.every((s) => s.records.length === 1 && s.deltas.length === 0)).toBe(true)
    expect(view.series.map((s) => s.key.project).sort()).toEqual(['a', 'a/b'])
  })

  it('does not merge a null dimension with a literal -', () => {
    const records = recs(
      { runtime: null, metrics: { boot_ms: 10 } },
      { runtime: '-', metrics: { boot_ms: 99 } }
    )
    const view = buildBenchView(records)
    expect(view.series).toHaveLength(2)
    expect(view.series.map((s) => s.key.runtime)).toEqual(expect.arrayContaining([null, '-']))
    expect(view.series.every((s) => s.deltas.length === 0)).toBe(true)
  })

  it('gives distinct keys distinct group keys', () => {
    const base = { project: 'p', filesystem: null, workload: 'w' }
    expect(seriesGroupKey({ ...base, runtime: null })).not.toBe(seriesGroupKey({ ...base, runtime: '-' }))
    expect(seriesGroupKey({ project: 'a/b', runtime: 'c', filesystem: null, workload: 'w' })).not.toBe(
      seriesGroupKey({ project: 'a', runtime: 'b/c', filesystem: null, workload: 'w' })
    )
  })
})
