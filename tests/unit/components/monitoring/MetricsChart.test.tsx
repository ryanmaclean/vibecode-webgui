/**
 * Unit tests for MetricsChart component
 * Tests token usage visualization, auto-refresh, period filtering, and data display
 */

import React from 'react'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import { MetricsChart } from '@/components/monitoring/MetricsChart'

// Mock fetch globally
global.fetch = jest.fn()

describe('MetricsChart Component', () => {
  const mockMetricsData = {
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
      json: async () => mockMetricsData
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
    jest.clearAllTimers()
    jest.useRealTimers()
  })

  test('renders loading state initially', () => {
    const { container } = render(<MetricsChart period="24h" />)
    // Check for skeleton loading UI (component renders animate-pulse div, not "loading" text)
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  test('fetches and displays metrics data', async () => {
    render(<MetricsChart period="24h" />)

    // Component formats 150000 as "150.0K"
    const tokensElement = await screen.findByText(/150\.0K/i, { timeout: 5000 })
    expect(tokensElement).toBeInTheDocument()

    const costElement = await screen.findByText(/\$12\.45/i, { timeout: 5000 })
    expect(costElement).toBeInTheDocument()

    const errorElement = await screen.findByText(/2\.00%/i, { timeout: 5000 })
    expect(errorElement).toBeInTheDocument()

    // Verify fetch was called with correct URL
    expect(global.fetch).toHaveBeenCalledWith('/api/monitoring/ai-metrics?period=24h')
  })

  test('displays error state when fetch fails', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

    render(<MetricsChart period="24h" />)

    const errorElement = await screen.findByText(/Error Loading Metrics/i, { timeout: 5000 })
    expect(errorElement).toBeInTheDocument()
  })

  test('retry button refetches data after error', async () => {
    ;(global.fetch as jest.Mock)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({ ok: true, json: async () => mockMetricsData })

    render(<MetricsChart period="24h" />)

    const errorElement = await screen.findByText(/Error Loading Metrics/i, { timeout: 5000 })
    expect(errorElement).toBeInTheDocument()

    const retryButton = screen.getByRole('button', { name: /retry/i })
    fireEvent.click(retryButton)

    const tokensElement = await screen.findByText(/150\.0K/i, { timeout: 5000 })
    expect(tokensElement).toBeInTheDocument()

    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  test('displays empty state when no data available', async () => {
    const emptyData = { ...mockMetricsData, timeSeries: [], overview: { ...mockMetricsData.overview, totalRequests: 0, totalTokens: 0 } }
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => emptyData
    })

    render(<MetricsChart period="24h" />)

    // Component still renders with zero values, check for "0 requests"
    const zeroRequestsElement = await screen.findByText(/0 requests/i, { timeout: 5000 })
    expect(zeroRequestsElement).toBeInTheDocument()
  })

  test('auto-refresh triggers data fetch at specified interval', async () => {
    jest.useFakeTimers()

    render(<MetricsChart period="24h" refreshInterval={5000} />)

    // Wait for initial fetch
    await screen.findByText(/150\.0K/i, { timeout: 5000 })
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

  test('formatNumber helper formats large numbers correctly', async () => {
    const largeData = {
      ...mockMetricsData,
      overview: {
        ...mockMetricsData.overview,
        totalTokens: 1500000 // 1.5M
      }
    }
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => largeData
    })

    render(<MetricsChart period="24h" />)

    const largeNumberElement = await screen.findByText(/1\.50M/i, { timeout: 5000 })
    expect(largeNumberElement).toBeInTheDocument()
  })

  test('formatCurrency helper formats currency correctly', async () => {
    render(<MetricsChart period="24h" />)

    const currencyElement = await screen.findByText(/\$12\.45/i, { timeout: 5000 })
    expect(currencyElement).toBeInTheDocument()
  })

  test('period prop is passed to API endpoint', async () => {
    render(<MetricsChart period="7d" />)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/monitoring/ai-metrics?period=7d')
    }, { timeout: 5000 })
  })

  test('custom className prop is applied', () => {
    const { container } = render(<MetricsChart period="24h" className="custom-class" />)

    const chartContainer = container.firstChild
    expect(chartContainer).toHaveClass('custom-class')
  })
})
