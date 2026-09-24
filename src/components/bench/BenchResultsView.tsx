'use client'

/**
 * Renders ryanlab.bench.v1 records as per-series tables with latest-vs-previous
 * deltas. Pure presentation: accepts records (already validated, or raw input
 * to validate) and derives everything else locally.
 */

import React, { useMemo } from 'react'
import { type BenchRecordV1, type BenchIssue, measuredMetricKeys, metricValue, parseBenchRecords } from '@/lib/bench/v1'
import {
  type BenchSeriesView,
  type MetricDelta,
  buildBenchView,
  formatMetricValue,
  metricSpec,
} from '@/lib/bench/view'

export interface BenchResultsViewProps {
  /** Validated records. Takes precedence over `input`. */
  records?: readonly BenchRecordV1[]
  /** Unvalidated input (record, array, or `{records}` envelope). */
  input?: unknown
  title?: string
}

const VERDICT_CLASS: Record<MetricDelta['verdict'], string> = {
  better: 'text-green-600 dark:text-green-400',
  worse: 'text-red-600 dark:text-red-400',
  same: 'text-muted-foreground',
  changed: 'text-amber-600 dark:text-amber-400',
  'not-comparable': 'text-muted-foreground',
}

function formatDelta(delta: MetricDelta | undefined): string {
  if (!delta || delta.verdict === 'not-comparable') return '—'
  if (delta.verdict === 'same') return 'no change'
  const sign = (delta.delta ?? 0) > 0 ? '+' : ''
  if (delta.deltaPct === null) return `${sign}${formatMetricValue(delta.key, delta.delta)}`
  return `${sign}${delta.deltaPct.toFixed(1)}%`
}

function SeriesTable({ series }: { series: BenchSeriesView }): React.JSX.Element {
  const keys = measuredMetricKeys(series.latest)
  const deltaByKey = new Map(series.deltas.map((d) => [d.key, d]))
  const { key, latest } = series

  return (
    <section
      className="rounded-lg border border-border p-4"
      data-testid="bench-series"
      data-series-id={series.id}
      aria-label={`Benchmark series ${series.id}`}
    >
      <header className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="font-semibold">{key.workload}</h3>
        <span className="text-sm text-muted-foreground">
          {key.project}
          {key.runtime ? ` · ${key.runtime}` : ''}
          {key.filesystem ? ` · ${key.filesystem}` : ''}
        </span>
        <span className="text-xs text-muted-foreground">
          {series.records.length} run{series.records.length === 1 ? '' : 's'} · latest{' '}
          <time dateTime={latest.timestamp}>{latest.timestamp}</time>
          {latest.commit ? ` · ${latest.commit.slice(0, 12)}` : ''}
        </span>
      </header>

      {keys.length === 0 ? (
        <p className="text-sm text-muted-foreground">No metrics measured in the latest run.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th scope="col" className="py-1 pr-4 font-medium">Metric</th>
              <th scope="col" className="py-1 pr-4 font-medium">Latest</th>
              <th scope="col" className="py-1 font-medium">vs previous</th>
            </tr>
          </thead>
          <tbody>
            {keys.map((metric) => {
              const delta = deltaByKey.get(metric)
              return (
                <tr key={metric} data-metric={metric}>
                  <th scope="row" className="py-1 pr-4 font-normal">{metricSpec(metric).label}</th>
                  <td className="py-1 pr-4 tabular-nums">
                    {formatMetricValue(metric, metricValue(latest, metric))}
                  </td>
                  <td
                    className={`py-1 tabular-nums ${delta ? VERDICT_CLASS[delta.verdict] : 'text-muted-foreground'}`}
                    data-verdict={delta?.verdict ?? 'none'}
                  >
                    {formatDelta(delta)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      {latest.notes ? <p className="mt-2 text-xs text-muted-foreground">{latest.notes}</p> : null}
    </section>
  )
}

export function BenchResultsView({
  records,
  input,
  title = 'Benchmarks',
}: BenchResultsViewProps): React.JSX.Element {
  const { view, issues } = useMemo(() => {
    let accepted: readonly BenchRecordV1[]
    let rejected: BenchIssue[] = []
    if (records) {
      accepted = records
    } else if (input !== undefined) {
      const parsed = parseBenchRecords(input)
      accepted = parsed.records
      rejected = parsed.issues
    } else {
      accepted = []
    }
    return { view: buildBenchView(accepted), issues: rejected }
  }, [records, input])

  return (
    <div className="space-y-4" data-testid="bench-results" data-schema={view.input_schema}>
      <h2 className="text-lg font-semibold">{title}</h2>
      {view.series.length === 0 ? (
        <p className="text-sm text-muted-foreground">No ryanlab.bench.v1 records to display.</p>
      ) : (
        view.series.map((series) => <SeriesTable key={series.id} series={series} />)
      )}
      {issues.length > 0 ? (
        <div role="alert" className="rounded border border-red-300 p-3 text-sm" data-testid="bench-issues">
          <p className="font-medium">
            {issues.length} validation issue{issues.length === 1 ? '' : 's'} (records skipped)
          </p>
          <ul className="mt-1 list-disc pl-5">
            {issues.slice(0, 20).map((issue, i) => (
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

export default BenchResultsView
