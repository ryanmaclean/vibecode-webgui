/**
 * Unit tests for LatencyHistogram component
 * Tests latency visualization, percentile metrics, and color-coded histogram
 */

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { LatencyHistogram } from '@/components/monitoring/LatencyHistogram'

global.fetch = jest.fn()

describe('LatencyHistogram Component', () => {
  const mockLatencyData = {
    timestamp: '2026-02-23T00:00:00Z',
    period: '24h',
    latency: {
      avg: 850,
      p50: 600,
      p95: 1500,
      p99: 2200,
      min: 200,
      max: 3000,
      histogram: [
        { bucket: '<500ms', count: 45 },
        { bucket: '500-1000ms', count: 30 },
        { bucket: '1-2s', count: 20 },
        { bucket: '>2s', count: 5 }
      ]
    },
    byModel: [
      { model: 'gpt-4', avgLatency: 1200, p95Latency: 2000, requestCount: 50 },
      { model: 'gpt-3.5-turbo', avgLatency: 500, p95Latency: 800, requestCount: 50 }
    ]
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockLatencyData
    })
  })

  test('renders latency percentile metrics cards', async () => {
    render(<LatencyHistogram period="24h" />)

    await waitFor(() => {
      expect(screen.getByText('600ms')).toBeInTheDocument() // P50
      expect(screen.getByText('1,500ms')).toBeInTheDocument() // P95
      expect(screen.getByText('2,200ms')).toBeInTheDocument() // P99
      expect(screen.getByText('850ms')).toBeInTheDocument() // Average
    })
  })

  test('renders histogram with correct bucket counts', async () => {
    render(<LatencyHistogram period="24h" />)

    await waitFor(() => {
      expect(screen.getByText('<500ms')).toBeInTheDocument()
      expect(screen.getByText('45')).toBeInTheDocument() // Count for <500ms bucket
    })
  })

  test('histogram bars have correct color coding', async () => {
    const { container } = render(<LatencyHistogram period="24h" />)

    await waitFor(() => {
      // Green for fast responses (<500ms)
      const greenBars = container.querySelectorAll('[fill="#10b981"]') // Tailwind green-500
      expect(greenBars.length).toBeGreaterThan(0)

      // Yellow for moderate responses
      const yellowBars = container.querySelectorAll('[fill="#f59e0b"]') // Tailwind yellow-500
      expect(yellowBars.length).toBeGreaterThan(0)

      // Red for slow responses
      const redBars = container.querySelectorAll('[fill="#ef4444"]') // Tailwind red-500
      expect(redBars.length).toBeGreaterThan(0)
    })
  })

  test('displays model breakdown table', async () => {
    render(<LatencyHistogram period="24h" />)

    await waitFor(() => {
      expect(screen.getByText('gpt-4')).toBeInTheDocument()
      expect(screen.getByText('gpt-3.5-turbo')).toBeInTheDocument()
      expect(screen.getByText('1,200ms')).toBeInTheDocument() // GPT-4 avg latency
      expect(screen.getByText('500ms')).toBeInTheDocument() // GPT-3.5 avg latency
    })
  })

  test('handles loading state', () => {
    render(<LatencyHistogram period="24h" />)
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  test('handles error state', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Failed to fetch'))

    render(<LatencyHistogram period="24h" />)

    await waitFor(() => {
      expect(screen.getByText(/failed to load/i)).toBeInTheDocument()
    })
  })

  test('handles empty state when no latency data', async () => {
    const emptyData = {
      ...mockLatencyData,
      latency: { ...mockLatencyData.latency, histogram: [] },
      byModel: []
    }
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => emptyData
    })

    render(<LatencyHistogram period="24h" />)

    await waitFor(() => {
      expect(screen.getByText(/no latency data/i)).toBeInTheDocument()
    })
  })

  test('auto-refresh works correctly', async () => {
    jest.useFakeTimers()

    render(<LatencyHistogram period="24h" refreshInterval={5000} />)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })

    jest.advanceTimersByTime(5000)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2)
    })

    jest.useRealTimers()
  })

  test('period prop is passed to API', async () => {
    render(<LatencyHistogram period="7d" />)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/monitoring/ai-metrics?period=7d')
    })
  })
})
