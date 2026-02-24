/**
 * Unit tests for CostBreakdown component
 * Tests cost visualization, period filtering, export functionality
 */

import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { CostBreakdown } from '@/components/monitoring/CostBreakdown'

global.fetch = jest.fn()

describe('CostBreakdown Component', () => {
  const mockCostData = {
    timestamp: '2026-02-23T00:00:00Z',
    period: '24h',
    overview: {
      totalCost: 12.45,
      avgCostPerRequest: 0.0124,
      costTrend: 0.15 // 15% increase
    },
    byModel: [
      { model: 'gpt-4', totalCost: 8.50, requestCount: 500, avgCost: 0.017 },
      { model: 'gpt-3.5-turbo', totalCost: 3.95, requestCount: 500, avgCost: 0.0079 }
    ],
    byProvider: [
      { provider: 'openai', totalCost: 12.45, requestCount: 1000 }
    ]
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockCostData
    })
  })

  test('renders cost summary metrics', async () => {
    render(<CostBreakdown />)

    await waitFor(() => {
      expect(screen.getByText('$12.45')).toBeInTheDocument() // Total cost
      expect(screen.getByText('$0.0124')).toBeInTheDocument() // Avg per request
    })
  })

  test('displays cost trend indicator', async () => {
    render(<CostBreakdown />)

    await waitFor(() => {
      expect(screen.getByText(/15%/)).toBeInTheDocument() // Trend percentage
      // Should show up arrow icon for positive trend
      const trendIcon = screen.getByTestId('trend-up-icon')
      expect(trendIcon).toBeInTheDocument()
    })
  })

  test('renders period selector dropdown', async () => {
    render(<CostBreakdown />)

    await waitFor(() => {
      const periodSelector = screen.getByRole('combobox')
      expect(periodSelector).toBeInTheDocument()
      expect(periodSelector).toHaveValue('24h')
    })
  })

  test('changing period triggers data refetch', async () => {
    render(<CostBreakdown />)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/monitoring/ai-metrics?period=24h')
    })

    const periodSelector = screen.getByRole('combobox')
    fireEvent.change(periodSelector, { target: { value: '7d' } })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/monitoring/ai-metrics?period=7d')
    })
  })

  test('renders pie chart for cost by model', async () => {
    const { container } = render(<CostBreakdown />)

    await waitFor(() => {
      // Look for PieChart component
      const pieChart = container.querySelector('.recharts-pie')
      expect(pieChart).toBeInTheDocument()
    })
  })

  test('renders bar chart for cost comparison', async () => {
    const { container } = render(<CostBreakdown />)

    await waitFor(() => {
      // Look for BarChart component
      const barChart = container.querySelector('.recharts-bar')
      expect(barChart).toBeInTheDocument()
    })
  })

  test('displays detailed breakdown table', async () => {
    render(<CostBreakdown />)

    await waitFor(() => {
      expect(screen.getByText('gpt-4')).toBeInTheDocument()
      expect(screen.getByText('$8.50')).toBeInTheDocument()
      expect(screen.getByText('500')).toBeInTheDocument() // Request count
    })
  })

  test('export button is visible', async () => {
    render(<CostBreakdown />)

    await waitFor(() => {
      const exportButton = screen.getByRole('button', { name: /export/i })
      expect(exportButton).toBeInTheDocument()
    })
  })

  test('clicking export button triggers download', async () => {
    // Mock window.open or fetch for download
    const mockOpen = jest.fn()
    window.open = mockOpen

    render(<CostBreakdown />)

    await waitFor(() => {
      const exportButton = screen.getByRole('button', { name: /export/i })
      fireEvent.click(exportButton)
    })

    // Verify export endpoint is called
    expect(mockOpen).toHaveBeenCalledWith(
      expect.stringContaining('/api/monitoring/ai-metrics/export'),
      '_blank'
    )
  })

  test('handles loading state', () => {
    render(<CostBreakdown />)
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  test('handles error state', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Failed to fetch'))

    render(<CostBreakdown />)

    await waitFor(() => {
      expect(screen.getByText(/failed to load/i)).toBeInTheDocument()
    })
  })

  test('handles empty state', async () => {
    const emptyData = {
      ...mockCostData,
      overview: { totalCost: 0, avgCostPerRequest: 0, costTrend: 0 },
      byModel: [],
      byProvider: []
    }
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => emptyData
    })

    render(<CostBreakdown />)

    await waitFor(() => {
      expect(screen.getByText(/no cost data/i)).toBeInTheDocument()
    })
  })

  test('auto-refresh works', async () => {
    jest.useFakeTimers()

    render(<CostBreakdown refreshInterval={5000} />)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })

    jest.advanceTimersByTime(5000)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2)
    })

    jest.useRealTimers()
  })
})
