/**
 * ryanlab.bench.v1 consumer.
 *
 * VibeCode is a *consumer* of the shared benchmark contract, never its
 * source of truth. The canonical schema lives in
 * ryanmaclean/skills:schemas/bench.v1.schema.json (see docs/BENCHMARKING.md
 * in that repo). This module mirrors that JSON Schema as a zod validator so
 * the UI and API can accept records produced by smolFire, BOP, Moth,
 * agent-jail and autoresearch without inventing a VibeCode-specific format.
 *
 * Rules carried over from the contract:
 * - `metrics` is open for extension; unknown metrics are preserved, not dropped.
 * - `null` means "not measured". It is never coerced to 0.
 * - Unknown top-level fields are preserved (additionalProperties: true).
 *
 * See docs/architecture/BENCH_V1_INTEGRATION.md.
 */

import { z } from 'zod'

export const BENCH_V1_SCHEMA = 'ryanlab.bench.v1' as const
export const BENCH_V1_SCHEMA_URL =
  'https://ryanmaclean.com/schemas/ryanlab.bench.v1.schema.json' as const
export const BENCH_V1_CANONICAL_SOURCE =
  'ryanmaclean/skills:schemas/bench.v1.schema.json' as const

/** Core metric keys defined by the v1 schema, in schema order. */
export const BENCH_V1_CORE_METRICS = [
  'artifact_bytes',
  'rss_bytes',
  'boot_ms',
  'rename_us_p50',
  'fsync_us_p50',
  'recovery_ms',
  'write_amplification',
  'metadata_bytes_per_run',
  'history_bytes_per_gib',
  'lineage_reconstruction_ms',
] as const

export type BenchCoreMetric = (typeof BENCH_V1_CORE_METRICS)[number]

const INTEGER_METRICS: ReadonlySet<BenchCoreMetric> = new Set(['artifact_bytes', 'rss_bytes'])

const nullableString = z.string().nullable()

function coreMetricSchema(key: BenchCoreMetric): z.ZodOptional<z.ZodNullable<z.ZodNumber>> {
  const base = INTEGER_METRICS.has(key) ? z.number().int() : z.number()
  return base.min(0).nullable().optional()
}

const metricsShape = Object.fromEntries(
  BENCH_V1_CORE_METRICS.map((key) => [key, coreMetricSchema(key)])
) as Record<BenchCoreMetric, ReturnType<typeof coreMetricSchema>>

export const benchMetricsV1Schema = z.object(metricsShape).catchall(z.unknown())

export const benchRecordV1Schema = z
  .object({
    schema: z.literal(BENCH_V1_SCHEMA),
    project: z.string(),
    timestamp: z.iso.datetime({ offset: true }),
    runtime: nullableString.optional(),
    filesystem: nullableString.optional(),
    workload: z.string(),
    commit: nullableString.optional(),
    artifact_sha256: z
      .string()
      .regex(/^[a-fA-F0-9]{64}$/, 'artifact_sha256 must be 64 hex characters')
      .nullable()
      .optional(),
    metrics: benchMetricsV1Schema,
    tags: z.record(z.string(), z.string()).optional(),
    notes: nullableString.optional(),
  })
  .catchall(z.unknown())

export type BenchRecordV1 = z.infer<typeof benchRecordV1Schema>

/** A single validation problem, addressed by record index and JSON path. */
export interface BenchIssue {
  /** Position of the record in the input (array index or NDJSON line index). */
  index: number
  /** Dotted path inside the record, or '' for the record itself. */
  path: string
  message: string
}

export interface BenchParseResult {
  records: BenchRecordV1[]
  issues: BenchIssue[]
}

export type BenchParseOne =
  | { ok: true; record: BenchRecordV1 }
  | { ok: false; issues: BenchIssue[] }

function toIssues(error: z.ZodError, index: number): BenchIssue[] {
  return error.issues.map((issue) => ({
    index,
    path: issue.path.map(String).join('.'),
    message: issue.message,
  }))
}

/** Validate one candidate record. */
export function parseBenchRecord(input: unknown, index = 0): BenchParseOne {
  const result = benchRecordV1Schema.safeParse(input)
  if (result.success) return { ok: true, record: result.data }
  return { ok: false, issues: toIssues(result.error, index) }
}

/**
 * Validate a batch. Accepts a single record, an array of records, or an
 * envelope `{ records: [...] }`. Valid records are kept even when others fail.
 */
export function parseBenchRecords(input: unknown): BenchParseResult {
  let candidates: unknown[]
  if (Array.isArray(input)) {
    candidates = input
  } else if (
    input !== null &&
    typeof input === 'object' &&
    !('schema' in input) &&
    Array.isArray((input as { records?: unknown }).records)
  ) {
    candidates = (input as { records: unknown[] }).records
  } else {
    candidates = [input]
  }

  const records: BenchRecordV1[] = []
  const issues: BenchIssue[] = []
  candidates.forEach((candidate, index) => {
    const parsed = parseBenchRecord(candidate, index)
    if (parsed.ok) records.push(parsed.record)
    else issues.push(...parsed.issues)
  })
  return { records, issues }
}

/**
 * Parse text that is either JSON (record, array, or envelope) or NDJSON
 * (one record per line; blank lines ignored). NDJSON is the natural format
 * for append-only benchmark logs.
 */
export function parseBenchText(text: string): BenchParseResult {
  const trimmed = text.trim()
  if (trimmed === '') return { records: [], issues: [] }

  try {
    return parseBenchRecords(JSON.parse(trimmed))
  } catch {
    // Not a single JSON document: fall through to NDJSON.
  }

  const records: BenchRecordV1[] = []
  const issues: BenchIssue[] = []
  let index = 0
  for (const line of trimmed.split(/\r?\n/)) {
    if (line.trim() === '') continue
    let value: unknown
    try {
      value = JSON.parse(line)
    } catch {
      issues.push({ index, path: '', message: 'line is not valid JSON' })
      index++
      continue
    }
    const parsed = parseBenchRecord(value, index)
    if (parsed.ok) records.push(parsed.record)
    else issues.push(...parsed.issues)
    index++
  }
  return { records, issues }
}

/** Numeric value of a metric, or null when absent/not measured/non-numeric. */
export function metricValue(record: BenchRecordV1, key: string): number | null {
  const value = (record.metrics as Record<string, unknown>)[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/** Metric keys present on a record with a numeric value, core metrics first. */
export function measuredMetricKeys(record: BenchRecordV1): string[] {
  const core = BENCH_V1_CORE_METRICS.filter((k) => metricValue(record, k) !== null)
  const coreSet = new Set<string>(BENCH_V1_CORE_METRICS)
  const extension = Object.keys(record.metrics)
    .filter((k) => !coreSet.has(k) && metricValue(record, k) !== null)
    .sort()
  return [...core, ...extension]
}
