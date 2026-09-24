/**
 * Descriptor and limits for /api/v1/bench/view. Lives outside route.ts because
 * Next.js route modules may only export HTTP handlers and route config.
 */

import { BENCH_V1_CANONICAL_SOURCE, BENCH_V1_SCHEMA, BENCH_V1_SCHEMA_URL } from './v1'
import { BENCH_VIEW_SCHEMA } from './view'

export const BENCH_VIEW_ENDPOINT = '/api/v1/bench/view' as const
export const BENCH_VIEW_MAX_BYTES = 1024 * 1024
export const BENCH_VIEW_MAX_RECORDS = 5000

export interface BenchViewEndpointDescriptor {
  schema: 'vibecode.endpoint.v1'
  endpoint: typeof BENCH_VIEW_ENDPOINT
  methods: string[]
  input_schema: typeof BENCH_V1_SCHEMA
  input_schema_url: typeof BENCH_V1_SCHEMA_URL
  canonical_source: typeof BENCH_V1_CANONICAL_SOURCE
  output_schema: typeof BENCH_VIEW_SCHEMA
  accepted_content_types: string[]
  accepted_shapes: string[]
  limits: { max_bytes: number; max_records: number }
  persistence: 'none'
}

export function describeBenchViewEndpoint(): BenchViewEndpointDescriptor {
  return {
    schema: 'vibecode.endpoint.v1',
    endpoint: BENCH_VIEW_ENDPOINT,
    methods: ['GET', 'POST'],
    input_schema: BENCH_V1_SCHEMA,
    input_schema_url: BENCH_V1_SCHEMA_URL,
    canonical_source: BENCH_V1_CANONICAL_SOURCE,
    output_schema: BENCH_VIEW_SCHEMA,
    accepted_content_types: ['application/json', 'application/x-ndjson', 'text/plain'],
    accepted_shapes: ['record', 'record[]', '{ records: record[] }', 'ndjson'],
    limits: { max_bytes: BENCH_VIEW_MAX_BYTES, max_records: BENCH_VIEW_MAX_RECORDS },
    persistence: 'none',
  }
}
