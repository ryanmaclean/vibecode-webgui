/**
 * Unit tests for LatencyHistogram component
 * Tests latency visualization, percentile metrics, and color-coded histogram
 */

import React from 'react'
import { render, screen, waitFor, act } from '@testing-library/react'
import { LatencyHistogram } from '@/components/monitoring/LatencyHistogram'

global.fetch = jest.fn()

describe('LatencyHistogram Component', () => {
  const mockLatencyData = {
    timestamp: '2026-02-23T00:00:00Z',
    period: '24h',
    startDate: '2026-02-22T00:00:00Z',
    endDate: '2026-02-23T00:00:00Z',
    overview: {
      totalCost: 12.45,
      totalRequests: 1000,
      totalInputTokens: 100000,
      totalOutputTokens: 50000,
      totalTokens: 150000,
      errorCount: 20,
      errorRate: 0.02,
      avgCostPerRequest: 0.01245,
      avgTokensPerRequest: 150,
      costChangePercent: 15,
      costTrend: 'increasing' as const
    },
    latency: {
      avgLatency: 500,
      p50Latency: 450,
      p95Latency: 1200,
      p99Latency: 2000,
      minLatency: 100,
      maxLatency: 3000,
      histogram: [
        { range: '0-100ms', min: 0, max: 100, count: 10 },
        { range: '100-500ms', min: 100, max: 500, count: 50 },
        { range: '500-1000ms', min: 500, max: 1000, count: 30 },
        { range: '1-2s', min: 1000, max: 2000, count: 8 },
        { range: '2-5s', min: 2000, max: 5000, count: 2 },
        { range: '5-10s', min: 5000, max: 10000, count: 0 },
        { range: '10s+', min: 10000, max: Infinity, count: 0 }
      ]
    },
    byModel: [
      {
        model: 'gpt-4',
        requestCount: 500,
        totalInputTokens: 50000,
        totalOutputTokens: 30000,
        totalTokens: 80000,
        totalCost: 8.50,
        errorRate: 0.02,
        avgLatency: 450,
        p95Latency: 1200,
        avgCostPerRequest: 0.017,
        avgCostPerToken: 0.0001063,
        costPercentage: 68.3
      },
      {
        model: 'gpt-3.5-turbo',
        requestCount: 500,
        totalInputTokens: 50000,
        totalOutputTokens: 20000,
        totalTokens: 70000,
        totalCost: 3.95,
        errorRate: 0.01,
        avgLatency: 350,
        p95Latency: 800,
        avgCostPerRequest: 0.0079,
        avgCostPerToken: 0.0000564,
        costPercentage: 31.7
      }
    ],
    byProvider: [
      {
        provider: 'openai',
        requestCount: 1000,
        totalInputTokens: 100000,
        totalOutputTokens: 50000,
        totalTokens: 150000,
        totalCost: 12.45,
        errorRate: 0.02,
        avgLatency: 400,
        p95Latency: 1000
      }
    ],
    byRequestType: [
      {
        requestType: 'completion',
        requestCount: 800,
        totalCost: 10.00,
        errorRate: 0.015
      }
    ],
    timeSeries: [
      {
        timestamp: '2026-02-23T10:00:00Z',
        requestCount: 100,
        inputTokens: 10000,
        outputTokens: 5000,
        tokenCount: 15000,
        cost: 1.25,
        errors: 2
      },
      {
        timestamp: '2026-02-23T11:00:00Z',
        requestCount: 120,
        inputTokens: 12000,
        outputTokens: 6000,
        tokenCount: 18000,
        cost: 1.50,
        errors: 1
      }
    ]
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockLatencyData
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
    jest.clearAllTimers()
    jest.useRealTimers()
  })

  test('renders latency percentile metrics cards', async () => {
    render(<LatencyHistogram period="24h" />)

    await screen.findByText(/600ms/i, {}, { timeout: 5000 })
    await screen.findByText(/1,500ms/i, {}, { timeout: 5000 })
    await screen.findByText(/2,200ms/i, {}, { timeout: 5000 })
    await screen.findByText(/850ms/i, {}, { timeout: 5000 })
  })

  test('renders histogram with correct bucket counts', async () => {
    render(<LatencyHistogram period="24h" />)

    await screen.findByText(/<500ms/i, {}, { timeout: 5000 })
    await screen.findByText(/45/, {}, { timeout: 5000 })
  })

  test('histogram bars have correct color coding', async () => {
    const { container } = render(<LatencyHistogram period="24h" />)

    // Wait for data to load
    await screen.findByText(/<500ms/i, {}, { timeout: 5000 })

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
    }, { timeout: 5000 })
  })

  test('displays model breakdown table', async () => {
    render(<LatencyHistogram period="24h" />)

    await screen.findByText(/gpt-4/i, {}, { timeout: 5000 })
    await screen.findByText(/gpt-3.5-turbo/i, {}, { timeout: 5000 })
    await screen.findByText(/1,200ms/i, {}, { timeout: 5000 })
    await screen.findByText(/500ms/i, {}, { timeout: 5000 })
  })

  test('handles loading state', () => {
    const { container } = render(<LatencyHistogram period="24h" />)
    // Check for skeleton loading UI (component renders animate-pulse div, not "loading" text)
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  test('handles error state', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Failed to fetch'))

    render(<LatencyHistogram period="24h" />)

    const errorElement = await screen.findByText(/Error Loading Latency Data/i, {}, { timeout: 5000 })
    expect(errorElement).toBeInTheDocument()
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

    // Component returns null when no data, so check it doesn't render error
    expect(screen.queryByText(/Error Loading/i)).not.toBeInTheDocument()
  })

  test('auto-refresh works correctly', async () => {
    jest.useFakeTimers()

    render(<LatencyHistogram period="24h" refreshInterval={5000} />)

    // Wait for initial fetch
    await screen.findByText(/600ms/i, {}, { timeout: 5000 })
    expect(global.fetch).toHaveBeenCalledTimes(1)

    // Advance time and check for second fetch
    act(() => {
      jest.advanceTimersByTime(5000)
    })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2)
    }, { timeout: 5000 })

    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  test('period prop is passed to API', async () => {
    render(<LatencyHistogram period="7d" />)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/monitoring/ai-metrics?period=7d')
    }, { timeout: 5000 })
  })
})
