/**
 * Benchmarks: presentation of shared ryanlab.bench.v1 records.
 * VibeCode displays benchmark results; producers own them.
 */

import React from 'react'
import { BenchImporter } from '@/components/bench/BenchImporter'

export const metadata = { title: 'Benchmarks' }

export default function BenchmarksPage(): React.JSX.Element {
  return (
    <main className="mx-auto max-w-5xl space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Benchmarks</h1>
      <p className="text-sm text-muted-foreground">
        Displays <code>ryanlab.bench.v1</code> records (schema owned by{' '}
        <code>ryanmaclean/skills</code>). Records are parsed locally and never stored here.
        Agents can use <code>POST /api/v1/bench/view</code> for the same projection.
      </p>
      <BenchImporter />
    </main>
  )
}
