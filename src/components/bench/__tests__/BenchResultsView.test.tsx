import React from 'react'
import { render, screen, within } from '@testing-library/react'
import { BenchResultsView } from '../BenchResultsView'
import { parseBenchRecords } from '@/lib/bench/v1'

// Synthetic test records: values are fixtures, not measurements.
const base = {
  schema: 'ryanlab.bench.v1',
  project: 'smolfire',
  runtime: 'freebsd-pvh',
  filesystem: 'ffs',
  workload: 'bop-state-crash-recovery-v1',
}

describe('BenchResultsView', () => {
  it('renders latest values and deltas per series', () => {
    const { records } = parseBenchRecords([
      { ...base, timestamp: '2026-09-23T00:00:00Z', metrics: { boot_ms: 100, rss_bytes: 1024 } },
      { ...base, timestamp: '2026-09-23T01:00:00Z', commit: 'abcdef1234567890', metrics: { boot_ms: 80, rss_bytes: 2048, recovery_ms: null } },
    ])
    render(<BenchResultsView records={records} />)

    const series = screen.getByRole('region', {
      name: 'Benchmark series smolfire/freebsd-pvh/ffs/bop-state-crash-recovery-v1',
    })
    expect(within(series).getByText('2 runs · latest', { exact: false })).toBeInTheDocument()
    expect(within(series).getByText(/abcdef123456/)).toBeInTheDocument()

    const boot = series.querySelector('tr[data-metric="boot_ms"]') as HTMLElement
    expect(within(boot).getByText('80 ms')).toBeInTheDocument()
    expect(within(boot).getByText('-20.0%')).toHaveAttribute('data-verdict', 'better')

    const rss = series.querySelector('tr[data-metric="rss_bytes"]') as HTMLElement
    expect(within(rss).getByText('2 KiB')).toBeInTheDocument()
    expect(within(rss).getByText('+100.0%')).toHaveAttribute('data-verdict', 'worse')

    // null metrics are not rendered as values at all
    expect(series.querySelector('tr[data-metric="recovery_ms"]')).toBeNull()
  })

  it('keeps metrics measured only in the previous run as not measured', () => {
    const { records } = parseBenchRecords([
      { ...base, timestamp: '2026-09-23T00:00:00Z', metrics: { boot_ms: 100, fsync_us_p50: 12 } },
      { ...base, timestamp: '2026-09-23T01:00:00Z', metrics: { boot_ms: 90, fsync_us_p50: null } },
    ])
    render(<BenchResultsView records={records} />)
    const series = screen.getByRole('region', {
      name: 'Benchmark series smolfire/freebsd-pvh/ffs/bop-state-crash-recovery-v1',
    })
    const fsync = series.querySelector('tr[data-metric="fsync_us_p50"]') as HTMLElement
    expect(fsync).not.toBeNull()
    expect(within(fsync).getByText('not measured')).toBeInTheDocument()
    expect(within(fsync).getByText('—')).toHaveAttribute('data-verdict', 'not-comparable')
  })

  it('validates raw input and lists rejected records', () => {
    render(
      <BenchResultsView
        input={[{ ...base, timestamp: '2026-09-23T00:00:00Z', metrics: {} }, { schema: 'ryanlab.bench.v1' }]}
      />
    )
    expect(screen.getByText('No metrics measured in the latest run.')).toBeInTheDocument()
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('record 1')
    expect(alert).toHaveTextContent('records skipped')
  })

  it('shows an empty state', () => {
    render(<BenchResultsView records={[]} />)
    expect(screen.getByText('No ryanlab.bench.v1 records to display.')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
