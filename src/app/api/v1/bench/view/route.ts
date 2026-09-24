/**
 * /api/v1/bench/view — stateless ryanlab.bench.v1 -> presentation projection.
 *
 * GET  returns a machine-readable descriptor (input/output schema ids,
 *      canonical schema source, accepted content types, limits).
 * POST validates ryanlab.bench.v1 records (JSON record, array, `{records}`
 *      envelope, or NDJSON) and returns the derived `vibecode.bench-view.v1`.
 *
 * Nothing is persisted: VibeCode is not the source of benchmark truth.
 * Producers (smolFire, BOP, Moth, agent-jail, autoresearch) own the records.
 */

import { NextRequest, NextResponse } from 'next/server'
import { BENCH_V1_SCHEMA, parseBenchText } from '@/lib/bench/v1'
import { BENCH_VIEW_SCHEMA, buildBenchView } from '@/lib/bench/view'
import {
  BENCH_VIEW_MAX_BYTES,
  BENCH_VIEW_MAX_RECORDS,
  describeBenchViewEndpoint,
} from '@/lib/bench/endpoint'

export const dynamic = 'force-dynamic'

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(describeBenchViewEndpoint())
}

function errorBody(
  code: string,
  message: string,
  extra: Record<string, unknown> = {}
): { schema: string; error: Record<string, unknown> } {
  return { schema: BENCH_VIEW_SCHEMA, error: { code, message, ...extra } }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const declaredLength = Number(request.headers.get('content-length') ?? '0')
  if (declaredLength > BENCH_VIEW_MAX_BYTES) {
    return NextResponse.json(
      errorBody('payload_too_large', `body exceeds ${BENCH_VIEW_MAX_BYTES} bytes`),
      { status: 413 }
    )
  }

  let text: string
  try {
    text = await request.text()
  } catch {
    return NextResponse.json(errorBody('unreadable_body', 'could not read request body'), {
      status: 400,
    })
  }

  if (new TextEncoder().encode(text).byteLength > BENCH_VIEW_MAX_BYTES) {
    return NextResponse.json(
      errorBody('payload_too_large', `body exceeds ${BENCH_VIEW_MAX_BYTES} bytes`),
      { status: 413 }
    )
  }

  const { records, issues } = parseBenchText(text)

  if (records.length > BENCH_VIEW_MAX_RECORDS) {
    return NextResponse.json(
      errorBody('too_many_records', `at most ${BENCH_VIEW_MAX_RECORDS} records per request`),
      { status: 413 }
    )
  }

  if (records.length === 0) {
    return NextResponse.json(
      errorBody('no_valid_records', `no valid ${BENCH_V1_SCHEMA} records in body`, { issues }),
      { status: 422 }
    )
  }

  return NextResponse.json({
    ...buildBenchView(records),
    rejected: issues,
  })
}
