/**
 * Unit tests for MetricsChart component
 * Tests token usage visualization, auto-refresh, period filtering, and data display
 */

import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
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
      totalRequests: 150,
      totalInputTokens: 12000,
      totalOutputTokens: 8000,
      totalTokens: 20000,
      totalCost: 0.65,
      errorCount: 3,
      errorRate: 0.02,
      avgCostPerRequest: 0.0043,
      avgTokensPerRequest: 133.33
    },
    timeSeries: [
      { timestamp: '2026-02-23T10:00:00Z', requestCount: 10, tokenCount: 1500, cost: 0.05, errors: 0 },
      { timestamp: '2026-02-23T11:00:00Z', requestCount: 15, tokenCount: 2000, cost: 0.07, errors: 1 }
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
  })

  test('renders loading state initially', () => {
    render(<MetricsChart period="24h" />)
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  test('fetches and displays metrics data', async () => {
    render(<MetricsChart period="24h" />)

    await waitFor(() => {
      // Check summary metrics are displayed
      expect(screen.getByText(/20K/)).toBeInTheDocument() // Total tokens formatted
      expect(screen.getByText(/\$0\.65/)).toBeInTheDocument() // Total cost
      expect(screen.getByText(/2\.0%/)).toBeInTheDocument() // Error rate
    })

    // Verify fetch was called with correct URL
    expect(global.fetch).toHaveBeenCalledWith('/api/monitoring/ai-metrics?period=24h')
  })

  test('displays error state when fetch fails', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

    render(<MetricsChart period="24h" />)

    await waitFor(() => {
      expect(screen.getByText(/failed to load/i)).toBeInTheDocument()
    })
  })

  test('retry button refetches data after error', async () => {
    ;(global.fetch as jest.Mock)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({ ok: true, json: async () => mockMetricsData })

    render(<MetricsChart period="24h" />)

    await waitFor(() => {
      expect(screen.getByText(/failed to load/i)).toBeInTheDocument()
    })

    const retryButton = screen.getByRole('button', { name: /retry/i })
    fireEvent.click(retryButton)

    await waitFor(() => {
      expect(screen.getByText(/20K/)).toBeInTheDocument()
    })

    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  test('displays empty state when no data available', async () => {
    const emptyData = { ...mockMetricsData, timeSeries: [], overview: { ...mockMetricsData.overview, totalRequests: 0 } }
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => emptyData
    })

    render(<MetricsChart period="24h" />)

    await waitFor(() => {
      expect(screen.getByText(/no data available/i)).toBeInTheDocument()
    })
  })

  test('auto-refresh triggers data fetch at specified interval', async () => {
    jest.useFakeTimers()

    render(<MetricsChart period="24h" refreshInterval={5000} />)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })

    // Fast-forward 5 seconds
    jest.advanceTimersByTime(5000)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2)
    })

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

    await waitFor(() => {
      expect(screen.getByText(/1\.5M/)).toBeInTheDocument()
    })
  })

  test('formatCurrency helper formats currency correctly', async () => {
    render(<MetricsChart period="24h" />)

    await waitFor(() => {
      expect(screen.getByText(/\$0\.65/)).toBeInTheDocument()
    })
  })

  test('period prop is passed to API endpoint', async () => {
    render(<MetricsChart period="7d" />)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/monitoring/ai-metrics?period=7d')
    })
  })

  test('custom className prop is applied', () => {
    const { container } = render(<MetricsChart period="24h" className="custom-class" />)

    const chartContainer = container.firstChild
    expect(chartContainer).toHaveClass('custom-class')
  })
})
