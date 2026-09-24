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

/**
 * Bounds for batch parsing. Both default to unbounded; callers that accept
 * untrusted input (the API route, the browser importer) must set them.
 */
export interface BenchParseOptions {
  /**
   * Maximum number of candidate records (array items, envelope items or
   * non-blank NDJSON lines). When the input has more, nothing is validated
   * and the result is `{ truncated: true }` with no records or issues.
   */
  maxCandidates?: number
  /** Maximum number of issues kept in `issues`; `issueCount` is still exact. */
  maxIssues?: number
}

export interface BenchParseResult {
  records: BenchRecordV1[]
  /** Validation issues, at most `maxIssues` of them. */
  issues: BenchIssue[]
  /** Total number of issues found, including any dropped by `maxIssues`. */
  issueCount: number
  /** True when the input exceeded `maxCandidates` and was not validated. */
  truncated: boolean
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

/** Accumulates records and a bounded list of issues with an exact total. */
class ParseAccumulator {
  readonly records: BenchRecordV1[] = []
  readonly issues: BenchIssue[] = []
  issueCount = 0

  constructor(private readonly maxIssues: number) {}

  addIssues(issues: readonly BenchIssue[]): void {
    this.issueCount += issues.length
    const room = this.maxIssues - this.issues.length
    if (room > 0) this.issues.push(...issues.slice(0, room))
  }

  add(candidate: unknown, index: number): void {
    const parsed = parseBenchRecord(candidate, index)
    if (parsed.ok) this.records.push(parsed.record)
    else this.addIssues(parsed.issues)
  }

  result(): BenchParseResult {
    return {
      records: this.records,
      issues: this.issues,
      issueCount: this.issueCount,
      truncated: false,
    }
  }
}

function truncatedResult(): BenchParseResult {
  return { records: [], issues: [], issueCount: 0, truncated: true }
}

function emptyResult(): BenchParseResult {
  return { records: [], issues: [], issueCount: 0, truncated: false }
}

/**
 * Validate a batch. Accepts a single record, an array of records, or an
 * envelope `{ records: [...] }`. Valid records are kept even when others fail.
 * The candidate count is checked against `maxCandidates` before any record is
 * validated.
 */
export function parseBenchRecords(input: unknown, options: BenchParseOptions = {}): BenchParseResult {
  const { maxCandidates = Infinity, maxIssues = Infinity } = options
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

  if (candidates.length > maxCandidates) return truncatedResult()

  const acc = new ParseAccumulator(maxIssues)
  candidates.forEach((candidate, index) => acc.add(candidate, index))
  return acc.result()
}

/**
 * Parse text that is either JSON (record, array, or envelope) or NDJSON
 * (one record per line; blank lines ignored). NDJSON is the natural format
 * for append-only benchmark logs. `options` bounds work as in
 * {@link parseBenchRecords}; for NDJSON, non-blank lines are counted before
 * any line is parsed.
 */
export function parseBenchText(text: string, options: BenchParseOptions = {}): BenchParseResult {
  const trimmed = text.trim()
  if (trimmed === '') return emptyResult()

  try {
    return parseBenchRecords(JSON.parse(trimmed), options)
  } catch {
    // Not a single JSON document: fall through to NDJSON.
  }

  const { maxCandidates = Infinity, maxIssues = Infinity } = options
  const lines = trimmed.split(/\r?\n/).filter((line) => line.trim() !== '')
  if (lines.length > maxCandidates) return truncatedResult()

  const acc = new ParseAccumulator(maxIssues)
  lines.forEach((line, index) => {
    let value: unknown
    try {
      value = JSON.parse(line)
    } catch {
      acc.addIssues([{ index, path: '', message: 'line is not valid JSON' }])
      return
    }
    acc.add(value, index)
  })
  return acc.result()
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
