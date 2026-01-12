/**
 * Tests for PerformanceGraphWidget Component
 * Enhanced Monitoring Dashboards feature (AGENT 97)
 */

import { render, screen, waitFor } from '@testing-library/react'
import { PerformanceGraphWidget } from '@/components/dashboard/PerformanceGraphWidget'

// Mock fetch globally
global.fetch = jest.fn()

// Mock recharts to avoid rendering issues in tests
jest.mock('recharts', () => ({
  LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  )
}))

describe('PerformanceGraphWidget', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  const mockPerformanceData = {
    timeRange: '1h',
    timestamp: '2026-01-12T10:00:00Z',
    metrics: {
      requests: 5000,
      avgLatency: 135,
      errorRate: 1.2,
      p95Latency: 200,
      p99Latency: 250
    },
    dataPoints: [
      { timestamp: '2026-01-12T09:00:00Z', latency: 120, requests: 50 },
      { timestamp: '2026-01-12T09:05:00Z', latency: 150, requests: 60 },
      { timestamp: '2026-01-12T09:10:00Z', latency: 130, requests: 55 }
    ]
  }

  describe('Rendering', () => {
    it('should display loading state initially', () => {
      global.fetch = jest.fn(() => new Promise(() => {})) as jest.Mock

      const { container } = render(<PerformanceGraphWidget />)

      expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
      expect(container.querySelector('.h-6.bg-gray-200')).toBeInTheDocument()
      expect(container.querySelector('.h-64.bg-gray-200')).toBeInTheDocument()
    })

    it('should render performance graph with data', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockPerformanceData
      }) as jest.Mock

      render(<PerformanceGraphWidget />)

      await waitFor(() => {
        expect(screen.getByText('Performance Trends')).toBeInTheDocument()
      })

      expect(screen.getByText('135ms')).toBeInTheDocument()
      expect(screen.getByText('200ms')).toBeInTheDocument()
      expect(screen.getByText('250ms')).toBeInTheDocument()
    })

    it('should display metrics summary correctly', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockPerformanceData
      }) as jest.Mock

      render(<PerformanceGraphWidget />)

      await waitFor(() => {
        expect(screen.getByText('Average')).toBeInTheDocument()
        expect(screen.getByText('P95 Latency')).toBeInTheDocument()
        expect(screen.getByText('Max (P99)')).toBeInTheDocument()
      })
    })

    it('should display time range badge', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockPerformanceData
      }) as jest.Mock

      render(<PerformanceGraphWidget timeRange="1h" />)

      await waitFor(() => {
        expect(screen.getByText('1h')).toBeInTheDocument()
      })
    })

    it('should display total requests and error rate', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockPerformanceData
      }) as jest.Mock

      render(<PerformanceGraphWidget />)

      await waitFor(() => {
        expect(screen.getByText('Total Requests')).toBeInTheDocument()
        expect(screen.getByText('5,000')).toBeInTheDocument()
        expect(screen.getByText('Error Rate')).toBeInTheDocument()
        expect(screen.getByText('1.20%')).toBeInTheDocument()
      })
    })

    it('should display last update timestamp', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockPerformanceData
      }) as jest.Mock

      render(<PerformanceGraphWidget />)

      await waitFor(() => {
        expect(screen.getByText(/Last updated:/)).toBeInTheDocument()
      })
    })
  })

  describe('API Integration', () => {
    it('should fetch data from correct endpoint with default time range', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockPerformanceData
      }) as jest.Mock

      render(<PerformanceGraphWidget />)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/dashboard/performance?range=1h')
        )
      })
    })

    it('should support different time ranges', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ...mockPerformanceData, timeRange: '24h' })
      }) as jest.Mock

      render(<PerformanceGraphWidget timeRange="24h" />)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('range=24h')
        )
        expect(screen.getByText('24h')).toBeInTheDocument()
      })
    })

    it('should support 6h time range', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ...mockPerformanceData, timeRange: '6h' })
      }) as jest.Mock

      render(<PerformanceGraphWidget timeRange="6h" />)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('range=6h')
        )
      })
    })

    it('should support 7d time range', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ...mockPerformanceData, timeRange: '7d' })
      }) as jest.Mock

      render(<PerformanceGraphWidget timeRange="7d" />)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('range=7d')
        )
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('API error')) as jest.Mock

      render(<PerformanceGraphWidget />)

      await waitFor(() => {
        expect(screen.getByText('Error Loading Performance Data')).toBeInTheDocument()
        expect(screen.getByText('API error')).toBeInTheDocument()
      })
    })

    it('should handle HTTP error responses', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      }) as jest.Mock

      render(<PerformanceGraphWidget />)

      await waitFor(() => {
        expect(screen.getByText(/Error Loading Performance Data/)).toBeInTheDocument()
        expect(screen.getByText(/500.*Internal Server Error/)).toBeInTheDocument()
      })
    })

    it('should display error UI with correct styling', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Test error')) as jest.Mock

      const { container } = render(<PerformanceGraphWidget />)

      await waitFor(() => {
        expect(screen.getByText('Error Loading Performance Data')).toBeInTheDocument()
        // Check for error styling
        const errorBox = container.querySelector('.border-red-300')
        expect(errorBox).toBeInTheDocument()
      })
    })
  })

  describe('Auto-refresh', () => {
    it('should refresh data at specified interval', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockPerformanceData
      }) as jest.Mock

      render(<PerformanceGraphWidget refreshInterval={5000} />)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1)
      })

      // Advance time by 5 seconds
      jest.advanceTimersByTime(5000)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2)
      })

      // Advance time by another 5 seconds
      jest.advanceTimersByTime(5000)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(3)
      })
    })

    it('should use default refresh interval of 60 seconds', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockPerformanceData
      }) as jest.Mock

      render(<PerformanceGraphWidget />)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1)
      })

      jest.advanceTimersByTime(60000)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2)
      })
    })

    it('should clear interval on unmount', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockPerformanceData
      }) as jest.Mock

      const { unmount } = render(<PerformanceGraphWidget refreshInterval={5000} />)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1)
      })

      unmount()

      jest.advanceTimersByTime(5000)

      // Should not call fetch again after unmount
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('Chart Integration', () => {
    it('should render recharts components', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockPerformanceData
      }) as jest.Mock

      render(<PerformanceGraphWidget />)

      await waitFor(() => {
        expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
        expect(screen.getByTestId('line-chart')).toBeInTheDocument()
        expect(screen.getByTestId('line')).toBeInTheDocument()
        expect(screen.getByTestId('x-axis')).toBeInTheDocument()
        expect(screen.getByTestId('y-axis')).toBeInTheDocument()
      })
    })
  })

  describe('Custom Styling', () => {
    it('should apply custom className', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockPerformanceData
      }) as jest.Mock

      const { container } = render(<PerformanceGraphWidget className="custom-class" />)

      await waitFor(() => {
        expect(container.querySelector('.custom-class')).toBeInTheDocument()
      })
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty data points array', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ...mockPerformanceData,
          dataPoints: []
        })
      }) as jest.Mock

      render(<PerformanceGraphWidget />)

      await waitFor(() => {
        expect(screen.getByText('Performance Trends')).toBeInTheDocument()
      })
    })

    it('should handle null data gracefully', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => null
      }) as jest.Mock

      const { container } = render(<PerformanceGraphWidget />)

      await waitFor(() => {
        expect(container.firstChild).toBeNull()
      })
    })

    it('should format large numbers with commas', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ...mockPerformanceData,
          metrics: {
            ...mockPerformanceData.metrics,
            requests: 1234567
          }
        })
      }) as jest.Mock

      render(<PerformanceGraphWidget />)

      await waitFor(() => {
        expect(screen.getByText('1,234,567')).toBeInTheDocument()
      })
    })
  })
})
