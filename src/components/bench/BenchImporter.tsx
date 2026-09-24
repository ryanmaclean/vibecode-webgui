'use client'

/**
 * Local-only importer for ryanlab.bench.v1 records: paste JSON/NDJSON or pick
 * a file produced by smolFire, BOP, Moth, agent-jail or autoresearch. Nothing
 * is uploaded or persisted; parsing happens in the browser.
 */

import React, { useState } from 'react'
import { parseBenchText, type BenchParseResult } from '@/lib/bench/v1'
import { BenchResultsView } from './BenchResultsView'

const EMPTY: BenchParseResult = { records: [], issues: [] }

export function BenchImporter(): React.JSX.Element {
  const [text, setText] = useState('')
  const [parsed, setParsed] = useState<BenchParseResult>(EMPTY)

  const load = (value: string): void => {
    setText(value)
    setParsed(parseBenchText(value))
  }

  const onFile = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0]
    if (file) load(await file.text())
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
          onChange={(e) => load(e.target.value)}
          spellCheck={false}
        />
        <input
          type="file"
          accept=".json,.ndjson,.jsonl,application/json,application/x-ndjson"
          aria-label="Load benchmark file"
          onChange={(e) => void onFile(e)}
        />
      </div>
      <BenchResultsView records={parsed.records} />
      {parsed.issues.length > 0 ? (
        <div role="alert" className="rounded border border-red-300 p-3 text-sm">
          {parsed.issues.length} validation issue{parsed.issues.length === 1 ? '' : 's'}:
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
