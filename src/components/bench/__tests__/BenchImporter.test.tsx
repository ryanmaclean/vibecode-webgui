import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { BenchImporter } from '../BenchImporter'
import { BENCH_VIEW_MAX_BYTES } from '@/lib/bench/endpoint'

// Synthetic test record: values are fixtures, not measurements.
const line = (ts: string, boot: number, workload = 'state-machine-v1'): string =>
  JSON.stringify({
    schema: 'ryanlab.bench.v1',
    project: 'bop',
    timestamp: ts,
    workload,
    metrics: { boot_ms: boot },
  })

/** A File-like object whose text() resolves when the test says so. */
function deferredFile(size = 10): { file: File; resolve: (text: string) => void; text: jest.Mock } {
  let resolve: (text: string) => void = () => undefined
  const text = jest.fn(
    () =>
      new Promise<string>((r) => {
        resolve = r
      })
  )
  const file = { name: 'bench.ndjson', size, text } as unknown as File
  return { file, resolve: (t: string) => resolve(t), text }
}

function selectFile(input: HTMLElement, file: File): void {
  fireEvent.change(input, { target: { files: [file] } })
}

describe('BenchImporter', () => {
  it('parses pasted NDJSON into series and surfaces bad lines', () => {
    render(<BenchImporter />)
    const textarea = screen.getByLabelText(/ryanlab\.bench\.v1 records/)
    fireEvent.change(textarea, {
      target: { value: [line('2026-09-23T00:00:00Z', 50), 'oops', line('2026-09-23T01:00:00Z', 40)].join('\n') },
    })
    expect(screen.getByRole('region', { name: 'Benchmark series bop/-/-/state-machine-v1' })).toBeInTheDocument()
    expect(screen.getByText('40 ms')).toBeInTheDocument()
    expect(screen.getByText('-20.0%')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('line is not valid JSON')
  })

  it('rejects oversized files before reading them', () => {
    render(<BenchImporter />)
    const { file, text } = deferredFile(BENCH_VIEW_MAX_BYTES + 1)
    selectFile(screen.getByLabelText('Load benchmark file'), file)
    expect(text).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(`exceeds ${BENCH_VIEW_MAX_BYTES} bytes`)
  })

  it('rejects oversized pasted input without parsing it', () => {
    render(<BenchImporter />)
    const textarea = screen.getByLabelText(/ryanlab\.bench\.v1 records/)
    fireEvent.change(textarea, { target: { value: ' '.repeat(BENCH_VIEW_MAX_BYTES + 1) } })
    expect(screen.getByRole('alert')).toHaveTextContent(`exceeds ${BENCH_VIEW_MAX_BYTES} bytes`)
    expect(textarea).toHaveValue('')
  })

  it('discards a file read that finishes after a newer edit', async () => {
    render(<BenchImporter />)
    const pending = deferredFile()
    selectFile(screen.getByLabelText('Load benchmark file'), pending.file)

    const textarea = screen.getByLabelText(/ryanlab\.bench\.v1 records/)
    fireEvent.change(textarea, { target: { value: line('2026-09-23T00:00:00Z', 50, 'newer') } })

    await act(async () => {
      pending.resolve(line('2026-09-23T00:00:00Z', 50, 'stale'))
    })
    expect(screen.getByRole('region', { name: 'Benchmark series bop/-/-/newer' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Benchmark series bop/-/-/stale' })).toBeNull()
  })

  it('applies only the most recent of overlapping file reads', async () => {
    render(<BenchImporter />)
    const input = screen.getByLabelText('Load benchmark file')
    const first = deferredFile()
    const second = deferredFile()
    selectFile(input, first.file)
    selectFile(input, second.file)

    await act(async () => {
      second.resolve(line('2026-09-23T00:00:00Z', 50, 'second'))
    })
    await act(async () => {
      first.resolve(line('2026-09-23T00:00:00Z', 50, 'first'))
    })
    expect(screen.getByRole('region', { name: 'Benchmark series bop/-/-/second' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Benchmark series bop/-/-/first' })).toBeNull()
  })

  it('clears the file input so the same file can be imported again', async () => {
    render(<BenchImporter />)
    const input = screen.getByLabelText('Load benchmark file') as HTMLInputElement
    // React tracks `value` with an own property on the node; wrap whichever
    // descriptor is in effect so we can observe the reset.
    const own = Object.getOwnPropertyDescriptor(input, 'value')
    const inherited = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')
    const descriptor = own ?? inherited
    if (!descriptor?.set || !descriptor.get) throw new Error('expected a value accessor')
    const writes: string[] = []
    Object.defineProperty(input, 'value', {
      configurable: true,
      get: descriptor.get,
      set(v: string) {
        writes.push(v)
        descriptor.set?.call(this, v)
      },
    })

    const { file, resolve, text } = deferredFile()
    selectFile(input, file)
    await act(async () => resolve(line('2026-09-23T00:00:00Z', 50)))
    expect(writes).toContain('')

    // Selecting the same file again reads it again.
    const again = deferredFile()
    selectFile(input, again.file)
    await act(async () => again.resolve(line('2026-09-23T00:00:00Z', 50)))
    expect(text).toHaveBeenCalledTimes(1)
    expect(again.text).toHaveBeenCalledTimes(1)
  })
})
