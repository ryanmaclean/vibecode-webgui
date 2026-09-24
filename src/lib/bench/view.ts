/**
 * Derived presentation data for ryanlab.bench.v1 records.
 *
 * Everything here is a disposable projection (constraint: derived views are
 * disposable). The raw records remain the only benchmark truth; this module
 * never stores, rewrites or back-fills them.
 */

import {
  BENCH_V1_CANONICAL_SOURCE,
  BENCH_V1_CORE_METRICS,
  BENCH_V1_SCHEMA,
  type BenchCoreMetric,
  type BenchRecordV1,
  measuredMetricKeys,
  metricValue,
} from './v1'

export const BENCH_VIEW_SCHEMA = 'vibecode.bench-view.v1' as const

export type MetricUnit = 'bytes' | 'ms' | 'us' | 'ratio' | 'bytes/run' | 'bytes/GiB' | 'unknown'
export type MetricDirection = 'lower-is-better' | 'unknown'

export interface MetricSpec {
  key: string
  label: string
  unit: MetricUnit
  direction: MetricDirection
  /** Recommended Datadog metric name from skills:docs/BENCHMARKING.md, for linking only. */
  datadogMetric: string | null
}

export const CORE_METRIC_SPECS: Record<BenchCoreMetric, MetricSpec> = {
  artifact_bytes: { key: 'artifact_bytes', label: 'Artifact size', unit: 'bytes', direction: 'lower-is-better', datadogMetric: 'ryanlab.artifact.bytes' },
  rss_bytes: { key: 'rss_bytes', label: 'RSS', unit: 'bytes', direction: 'lower-is-better', datadogMetric: 'ryanlab.runtime.rss_bytes' },
  boot_ms: { key: 'boot_ms', label: 'Boot to ready', unit: 'ms', direction: 'lower-is-better', datadogMetric: 'ryanlab.runtime.boot_ms' },
  rename_us_p50: { key: 'rename_us_p50', label: 'rename p50', unit: 'us', direction: 'lower-is-better', datadogMetric: 'ryanlab.fs.rename_us' },
  fsync_us_p50: { key: 'fsync_us_p50', label: 'fsync p50', unit: 'us', direction: 'lower-is-better', datadogMetric: 'ryanlab.fs.fsync_us' },
  recovery_ms: { key: 'recovery_ms', label: 'Recovery', unit: 'ms', direction: 'lower-is-better', datadogMetric: 'ryanlab.fs.recovery_ms' },
  write_amplification: { key: 'write_amplification', label: 'Write amplification', unit: 'ratio', direction: 'lower-is-better', datadogMetric: 'ryanlab.fs.write_amplification' },
  metadata_bytes_per_run: { key: 'metadata_bytes_per_run', label: 'Metadata / run', unit: 'bytes/run', direction: 'lower-is-better', datadogMetric: 'ryanlab.fs.metadata_bytes_per_run' },
  history_bytes_per_gib: { key: 'history_bytes_per_gib', label: 'History / GiB', unit: 'bytes/GiB', direction: 'lower-is-better', datadogMetric: 'ryanlab.fs.history_bytes_per_gib' },
  lineage_reconstruction_ms: { key: 'lineage_reconstruction_ms', label: 'Lineage reconstruction', unit: 'ms', direction: 'lower-is-better', datadogMetric: 'ryanlab.lineage.reconstruction_ms' },
}

const CORE_SET: ReadonlySet<string> = new Set(BENCH_V1_CORE_METRICS)

/** Spec for any metric key; extension metrics get a neutral spec. */
export function metricSpec(key: string): MetricSpec {
  if (CORE_SET.has(key)) return CORE_METRIC_SPECS[key as BenchCoreMetric]
  return { key, label: key, unit: 'unknown', direction: 'unknown', datadogMetric: null }
}

const NOT_MEASURED = 'not measured'

function trimNumber(value: number, digits: number): string {
  return Number(value.toFixed(digits)).toString()
}

function formatBytes(value: number): string {
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB']
  let v = value
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${trimNumber(v, i === 0 ? 0 : 2)} ${units[i]}`
}

/** Human-readable metric value. `null` renders as "not measured", never 0. */
export function formatMetricValue(key: string, value: number | null): string {
  if (value === null) return NOT_MEASURED
  const spec = metricSpec(key)
  switch (spec.unit) {
    case 'bytes':
      return formatBytes(value)
    case 'bytes/run':
      return `${formatBytes(value)}/run`
    case 'bytes/GiB':
      return `${formatBytes(value)}/GiB`
    case 'ms':
      return `${trimNumber(value, 2)} ms`
    case 'us':
      return `${trimNumber(value, 2)} µs`
    case 'ratio':
      return `${trimNumber(value, 3)}×`
    default:
      return trimNumber(value, 3)
  }
}

/**
 * Series identity: the stable low-cardinality dimensions from the contract.
 * Records that share these are comparable over time.
 */
export interface BenchSeriesKey {
  project: string
  runtime: string | null
  filesystem: string | null
  workload: string
}

export function seriesKeyOf(record: BenchRecordV1): BenchSeriesKey {
  return {
    project: record.project,
    runtime: record.runtime ?? null,
    filesystem: record.filesystem ?? null,
    workload: record.workload,
  }
}

export function seriesId(key: BenchSeriesKey): string {
  return [key.project, key.runtime ?? '-', key.filesystem ?? '-', key.workload].join('/')
}

export type DeltaVerdict = 'better' | 'worse' | 'same' | 'changed' | 'not-comparable'

export interface MetricDelta {
  key: string
  baseline: number | null
  candidate: number | null
  delta: number | null
  /** Relative change vs baseline in percent; null when baseline is 0 or missing. */
  deltaPct: number | null
  verdict: DeltaVerdict
}

/**
 * Compare two records metric by metric. Only metrics measured in both are
 * comparable; a metric measured on one side only is `not-comparable` rather
 * than being treated as a regression or improvement.
 */
export function compareRecords(baseline: BenchRecordV1, candidate: BenchRecordV1): MetricDelta[] {
  const keys = Array.from(
    new Set([...measuredMetricKeys(baseline), ...measuredMetricKeys(candidate)])
  )
  const core = BENCH_V1_CORE_METRICS.filter((k) => keys.includes(k))
  const ext = keys.filter((k) => !CORE_SET.has(k)).sort()

  return [...core, ...ext].map((key) => {
    const b = metricValue(baseline, key)
    const c = metricValue(candidate, key)
    if (b === null || c === null) {
      return { key, baseline: b, candidate: c, delta: null, deltaPct: null, verdict: 'not-comparable' }
    }
    const delta = c - b
    const deltaPct = b === 0 ? null : (delta / b) * 100
    let verdict: DeltaVerdict
    if (delta === 0) verdict = 'same'
    else if (metricSpec(key).direction === 'lower-is-better') verdict = delta < 0 ? 'better' : 'worse'
    else verdict = 'changed'
    return { key, baseline: b, candidate: c, delta, deltaPct, verdict }
  })
}

export interface BenchSeriesView {
  id: string
  key: BenchSeriesKey
  /** Records in the series, oldest first. */
  records: BenchRecordV1[]
  latest: BenchRecordV1
  previous: BenchRecordV1 | null
  /** latest vs previous; empty when the series has one record. */
  deltas: MetricDelta[]
}

export interface BenchView {
  schema: typeof BENCH_VIEW_SCHEMA
  input_schema: typeof BENCH_V1_SCHEMA
  canonical_source: typeof BENCH_V1_CANONICAL_SOURCE
  record_count: number
  series: BenchSeriesView[]
}

function timeOf(record: BenchRecordV1): number {
  return Date.parse(record.timestamp)
}

/** Group records into comparable series, each sorted oldest -> newest. */
export function buildBenchView(records: readonly BenchRecordV1[]): BenchView {
  const groups = new Map<string, { key: BenchSeriesKey; records: BenchRecordV1[] }>()
  for (const record of records) {
    const key = seriesKeyOf(record)
    const id = seriesId(key)
    const group = groups.get(id)
    if (group) group.records.push(record)
    else groups.set(id, { key, records: [record] })
  }

  const series: BenchSeriesView[] = Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, group]) => {
      const sorted = [...group.records].sort((a, b) => timeOf(a) - timeOf(b))
      // Groups are created with one record, so `latest` always exists.
      const latest = sorted[sorted.length - 1] as BenchRecordV1
      const previous = sorted[sorted.length - 2] ?? null
      return {
        id,
        key: group.key,
        records: sorted,
        latest,
        previous,
        deltas: previous ? compareRecords(previous, latest) : [],
      }
    })

  return {
    schema: BENCH_VIEW_SCHEMA,
    input_schema: BENCH_V1_SCHEMA,
    canonical_source: BENCH_V1_CANONICAL_SOURCE,
    record_count: records.length,
    series,
  }
}
