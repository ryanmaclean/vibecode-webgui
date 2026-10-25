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
  BENCH_VIEW_MAX_ISSUES,
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

function payloadTooLarge(): NextResponse {
  return NextResponse.json(
    errorBody('payload_too_large', `body exceeds ${BENCH_VIEW_MAX_BYTES} bytes`),
    { status: 413 }
  )
}

/**
 * Read the body as UTF-8, counting bytes as they stream in. Returns null as
 * soon as more than `max` bytes arrive (the stream is cancelled), so a client
 * that omits or understates Content-Length cannot make us buffer an
 * unbounded body.
 */
async function readBodyWithLimit(request: NextRequest, max: number): Promise<string | null> {
  const reader = request.body?.getReader()
  if (!reader) return ''

  const decoder = new TextDecoder()
  let total = 0
  let text = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) return text + decoder.decode()
    total += value.byteLength
    if (total > max) {
      await reader.cancel().catch(() => undefined)
      return null
    }
    text += decoder.decode(value, { stream: true })
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const declaredLength = Number(request.headers.get('content-length') ?? '0')
  if (declaredLength > BENCH_VIEW_MAX_BYTES) return payloadTooLarge()

  let text: string | null
  try {
    text = await readBodyWithLimit(request, BENCH_VIEW_MAX_BYTES)
  } catch {
    return NextResponse.json(errorBody('unreadable_body', 'could not read request body'), {
      status: 400,
    })
  }
  if (text === null) return payloadTooLarge()

  const { records, issues, issueCount, truncated } = parseBenchText(text, {
    maxCandidates: BENCH_VIEW_MAX_RECORDS,
    maxIssues: BENCH_VIEW_MAX_ISSUES,
  })

  if (truncated) {
    return NextResponse.json(
      errorBody('too_many_records', `at most ${BENCH_VIEW_MAX_RECORDS} records per request`),
      { status: 413 }
    )
  }

  if (records.length === 0) {
    return NextResponse.json(
      errorBody('no_valid_records', `no valid ${BENCH_V1_SCHEMA} records in body`, {
        issues,
        issue_count: issueCount,
      }),
      { status: 422 }
    )
  }

  return NextResponse.json({
    ...buildBenchView(records),
    rejected: issues,
    rejected_issue_count: issueCount,
  })
}
