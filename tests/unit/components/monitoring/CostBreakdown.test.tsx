/**
 * Unit tests for CostBreakdown component
 * Tests cost visualization, period filtering, export functionality
 */

import React from 'react'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import { CostBreakdown } from '@/components/monitoring/CostBreakdown'

global.fetch = jest.fn()

describe('CostBreakdown Component', () => {
  const mockCostData = {
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
      json: async () => mockCostData
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
    jest.clearAllTimers()
    jest.useRealTimers()
  })

  test('renders cost summary metrics', async () => {
    render(<CostBreakdown />)

    await screen.findByText(/\$12\.45/i, {}, { timeout: 5000 })
    await screen.findByText(/\$0\.0124/i, {}, { timeout: 5000 })
  })

  test('displays cost trend indicator', async () => {
    render(<CostBreakdown />)

    await screen.findByText(/15%/i, {}, { timeout: 5000 })
    // Should show up arrow icon for positive trend
    const trendIcon = await screen.findByTestId('trend-up-icon', {}, { timeout: 5000 })
    expect(trendIcon).toBeInTheDocument()
  })

  test('renders period selector dropdown', async () => {
    render(<CostBreakdown />)

    const periodSelector = await screen.findByRole('combobox', {}, { timeout: 5000 })
    expect(periodSelector).toBeInTheDocument()
    expect(periodSelector).toHaveValue('24h')
  })

  test('changing period triggers data refetch', async () => {
    render(<CostBreakdown />)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/monitoring/ai-metrics?period=24h')
    }, { timeout: 5000 })

    const periodSelector = await screen.findByRole('combobox', {}, { timeout: 5000 })

    fireEvent.change(periodSelector, { target: { value: '7d' } })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/monitoring/ai-metrics?period=7d')
    }, { timeout: 5000 })
  })

  test('renders pie chart for cost by model', async () => {
    const { container } = render(<CostBreakdown />)

    // Wait for data to load
    await screen.findByText(/\$12\.45/i, {}, { timeout: 5000 })

    await waitFor(() => {
      // Look for PieChart component
      const pieChart = container.querySelector('.recharts-pie')
      expect(pieChart).toBeInTheDocument()
    }, { timeout: 5000 })
  })

  test('renders bar chart for cost comparison', async () => {
    const { container } = render(<CostBreakdown />)

    // Wait for data to load
    await screen.findByText(/\$12\.45/i, {}, { timeout: 5000 })

    await waitFor(() => {
      // Look for BarChart component
      const barChart = container.querySelector('.recharts-bar')
      expect(barChart).toBeInTheDocument()
    }, { timeout: 5000 })
  })

  test('displays detailed breakdown table', async () => {
    render(<CostBreakdown />)

    await screen.findByText(/gpt-4/i, {}, { timeout: 5000 })
    await screen.findByText(/\$8\.50/i, {}, { timeout: 5000 })
    await screen.findByText(/500/, {}, { timeout: 5000 })
  })

  test('export button is visible', async () => {
    render(<CostBreakdown />)

    const exportButton = await screen.findByRole('button', { name: /export/i }, { timeout: 5000 })
    expect(exportButton).toBeInTheDocument()
  })

  test('clicking export button triggers download', async () => {
    // Mock window.open or fetch for download
    const mockOpen = jest.fn()
    window.open = mockOpen

    render(<CostBreakdown />)

    const exportButton = await screen.findByRole('button', { name: /export/i }, { timeout: 5000 })
    fireEvent.click(exportButton)

    // Verify export endpoint is called
    expect(mockOpen).toHaveBeenCalledWith(
      expect.stringContaining('/api/monitoring/ai-metrics/export'),
      '_blank'
    )
  })

  test('handles loading state', () => {
    const { container } = render(<CostBreakdown />)
    // Check for skeleton loading UI (component renders animate-pulse div, not "loading" text)
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  test('handles error state', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Failed to fetch'))

    render(<CostBreakdown />)

    const errorElement = await screen.findByText(/error loading cost data/i, {}, { timeout: 5000 })
    expect(errorElement).toBeInTheDocument()
  })

  test('handles empty state', async () => {
    const emptyData = {
      ...mockCostData,
      overview: {
        totalCost: 0,
        totalRequests: 0,
        totalTokens: 0,
        avgCostPerRequest: 0,
        avgCostPerToken: 0,
        costTrend: 'stable' as const,
        costChange: 0,
        costChangePercent: 0
      },
      byModel: [],
      byProvider: []
    }
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => emptyData
    })

    render(<CostBreakdown />)

    // Component still renders with zero values, check for "$0.00"
    const zeroElement = await screen.findByText(/\$0\.00/i, {}, { timeout: 5000 })
    expect(zeroElement).toBeInTheDocument()
  })

  test('auto-refresh works', async () => {
    jest.useFakeTimers()

    render(<CostBreakdown refreshInterval={5000} />)

    // Wait for initial fetch
    await screen.findByText(/\$12\.45/i, {}, { timeout: 5000 })
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
})
