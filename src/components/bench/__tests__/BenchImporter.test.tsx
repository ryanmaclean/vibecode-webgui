import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { BenchImporter } from '../BenchImporter'

// Synthetic test record: values are fixtures, not measurements.
const line = (ts: string, boot: number): string =>
  JSON.stringify({
    schema: 'ryanlab.bench.v1',
    project: 'bop',
    timestamp: ts,
    workload: 'state-machine-v1',
    metrics: { boot_ms: boot },
  })

describe('BenchImporter', () => {
  it('parses pasted NDJSON into series and surfaces bad lines', () => {
    render(<BenchImporter />)
    const textarea = screen.getByLabelText(/ryanlab\.bench\.v1 records/)
    fireEvent.change(textarea, {
      target: { value: [line('2026-09-23T00:00:00Z', 50), 'oops', line('2026-09-23T01:00:00Z', 40)].join('\n') },
    })
    expect(screen.getByTestId('bench-series')).toHaveAttribute('data-series-id', 'bop/-/-/state-machine-v1')
    expect(screen.getByText('40 ms')).toBeInTheDocument()
    expect(screen.getByText('-20.0%')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('line is not valid JSON')
  })
})
