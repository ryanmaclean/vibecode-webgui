'use client'

/**
 * Local-only importer for ryanlab.bench.v1 records: paste JSON/NDJSON or pick
 * a file produced by smolFire, BOP, Moth, agent-jail or autoresearch. Nothing
 * is uploaded or persisted; parsing happens in the browser.
 *
 * Input is bounded by the same limits as /api/v1/bench/view so a large file or
 * paste cannot freeze the tab: size is checked before reading or parsing, and
 * the candidate/issue caps bound validation work.
 */

import React, { useRef, useState } from 'react'
import { parseBenchText, type BenchParseResult } from '@/lib/bench/v1'
import {
  BENCH_VIEW_MAX_BYTES,
  BENCH_VIEW_MAX_ISSUES,
  BENCH_VIEW_MAX_RECORDS,
} from '@/lib/bench/endpoint'
import { BenchResultsView } from './BenchResultsView'

const EMPTY: BenchParseResult = { records: [], issues: [], issueCount: 0, truncated: false }

const TOO_LARGE = `Input exceeds ${BENCH_VIEW_MAX_BYTES} bytes; not parsed.`
const TOO_MANY = `Input has more than ${BENCH_VIEW_MAX_RECORDS} records; not parsed.`

/** UTF-8 byte length, short-circuiting when the string is obviously too long. */
function exceedsMaxBytes(value: string): boolean {
  // Every UTF-16 code unit encodes to at least one byte.
  if (value.length > BENCH_VIEW_MAX_BYTES) return true
  return new TextEncoder().encode(value).byteLength > BENCH_VIEW_MAX_BYTES
}

export function BenchImporter(): React.JSX.Element {
  const [text, setText] = useState('')
  const [parsed, setParsed] = useState<BenchParseResult>(EMPTY)
  const [inputError, setInputError] = useState<string | null>(null)
  // Incremented on every edit or file selection; a file read only applies if
  // its token is still current when it resolves.
  const requestToken = useRef(0)

  const load = (value: string): void => {
    // Rejected input leaves the current text and results untouched.
    if (exceedsMaxBytes(value)) {
      setInputError(TOO_LARGE)
      return
    }
    setText(value)
    const result = parseBenchText(value, {
      maxCandidates: BENCH_VIEW_MAX_RECORDS,
      maxIssues: BENCH_VIEW_MAX_ISSUES,
    })
    setParsed(result)
    setInputError(result.truncated ? TOO_MANY : null)
  }

  const onEdit = (value: string): void => {
    requestToken.current += 1
    load(value)
  }

  const onFile = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const input = event.target
    const file = input.files?.[0]
    // Clear the selection so choosing the same file again fires `change`.
    input.value = ''
    if (!file) return

    const token = ++requestToken.current
    if (file.size > BENCH_VIEW_MAX_BYTES) {
      setInputError(TOO_LARGE)
      return
    }
    let content: string
    try {
      content = await file.text()
    } catch {
      if (token === requestToken.current) setInputError('Could not read the selected file.')
      return
    }
    if (token !== requestToken.current) return
    load(content)
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="bench-input" className="block text-sm font-medium">
          ryanlab.bench.v1 records (JSON record, array, or NDJSON)
        </label>
        <textarea
          id="bench-input"
          className="h-40 w-full rounded border border-border bg-background p-2 font-mono text-xs"
          value={text}
          onChange={(e) => onEdit(e.target.value)}
          spellCheck={false}
        />
        <input
          type="file"
          accept=".json,.ndjson,.jsonl,application/json,application/x-ndjson"
          aria-label="Load benchmark file"
          onChange={(e) => void onFile(e)}
        />
      </div>
      {inputError ? (
        <p role="alert" className="rounded border border-red-300 p-3 text-sm">
          {inputError}
        </p>
      ) : null}
      <BenchResultsView records={parsed.records} />
      {parsed.issueCount > 0 ? (
        <div role="alert" className="rounded border border-red-300 p-3 text-sm">
          {parsed.issueCount} validation issue{parsed.issueCount === 1 ? '' : 's'}:
          <ul className="mt-1 list-disc pl-5">
            {parsed.issues.slice(0, 20).map((issue, i) => (
              <li key={i}>
                record {issue.index}
                {issue.path ? ` · ${issue.path}` : ''}: {issue.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

export default BenchImporter
