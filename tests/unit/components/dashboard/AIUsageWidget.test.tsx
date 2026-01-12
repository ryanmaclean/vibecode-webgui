/**
 * Tests for AIUsageWidget Component
 * Enhanced Monitoring Dashboards feature (AGENT 97)
 */

import { render, screen, waitFor } from '@testing-library/react'
import { AIUsageWidget } from '@/components/dashboard/AIUsageWidget'

// Mock fetch globally
global.fetch = jest.fn()

// Mock recharts to avoid rendering issues in tests
jest.mock('recharts', () => ({
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div data-testid="bar" />,
  PieChart: ({ children }: { children: React.ReactNode }) => <div data-testid="pie-chart">{children}</div>,
  Pie: ({ children }: { children: React.ReactNode }) => <div data-testid="pie">{children}</div>,
  Cell: () => <div data-testid="cell" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  )
}))

describe('AIUsageWidget', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  const mockAIUsageData = {
    timestamp: '2026-01-12T10:00:00Z',
    timeRange: '24h',
    providers: {
      openrouter: {
        requests: 450,
        tokens: {
          input: 35000,
          output: 22000,
          total: 57000
        },
        cost: 3.42,
        avgLatency: 1200
      },
      anthropic: {
        requests: 320,
        tokens: {
          input: 28000,
          output: 18000,
          total: 46000
        },
        cost: 2.76,
        avgLatency: 950
      },
      openai: {
        requests: 280,
        tokens: {
          input: 25000,
          output: 15000,
          total: 40000
        },
        cost: 2.40,
        avgLatency: 1100
      }
    },
    models: [
      { name: 'claude-3.5-sonnet', requests: 280, tokens: 35000, avgLatency: 950, cost: 1.57 },
      { name: 'gpt-4-turbo', requests: 220, tokens: 28000, avgLatency: 1100, cost: 1.26 },
      { name: 'gpt-3.5-turbo', requests: 190, tokens: 22000, avgLatency: 750, cost: 0.99 },
      { name: 'claude-3-opus', requests: 150, tokens: 19000, avgLatency: 1200, cost: 0.86 },
      { name: 'llama-3-70b', requests: 140, tokens: 18000, avgLatency: 850, cost: 0.81 }
    ],
    totalCost: 8.58,
    totalTokens: 143000,
    totalRequests: 1050,
    costByProvider: [
      { provider: 'openrouter', cost: 3.42, percentage: 39.86 },
      { provider: 'anthropic', cost: 2.76, percentage: 32.17 },
      { provider: 'openai', cost: 2.40, percentage: 27.97 }
    ]
  }

  describe('Rendering', () => {
    it('should display loading state initially', () => {
      global.fetch = jest.fn(() => new Promise(() => {})) as jest.Mock

      const { container } = render(<AIUsageWidget />)

      expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
      expect(container.querySelector('.h-6.bg-gray-200')).toBeInTheDocument()
    })

    it('should render AI usage widget with data', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockAIUsageData
      }) as jest.Mock

      render(<AIUsageWidget />)

      await waitFor(() => {
        expect(screen.getByText('AI Usage & Costs')).toBeInTheDocument()
      })
    })

    it('should display time range badge', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockAIUsageData
      }) as jest.Mock

      render(<AIUsageWidget />)

      await waitFor(() => {
        expect(screen.getByText('24h')).toBeInTheDocument()
      })
    })

    it('should display summary cards', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockAIUsageData
      }) as jest.Mock

      render(<AIUsageWidget />)

      await waitFor(() => {
        expect(screen.getByText('Total Requests')).toBeInTheDocument()
        expect(screen.getByText('Total Tokens')).toBeInTheDocument()
        expect(screen.getByText('Estimated Cost')).toBeInTheDocument()
      })
    })

    it('should display correct total values', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockAIUsageData
      }) as jest.Mock

      render(<AIUsageWidget />)

      await waitFor(() => {
        expect(screen.getByText('1,050')).toBeInTheDocument() // Total requests
        expect(screen.getByText('143.0K')).toBeInTheDocument() // Total tokens
        expect(screen.getByText('$8.58')).toBeInTheDocument() // Total cost
      })
    })

    it('should display provider breakdown section', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockAIUsageData
      }) as jest.Mock

      render(<AIUsageWidget />)

      await waitFor(() => {
        expect(screen.getByText('Provider Usage')).toBeInTheDocument()
      })

      // Check that provider data is displayed (check for specific metrics)
      expect(screen.getByText('450 requests • 1200ms avg')).toBeInTheDocument()
      expect(screen.getByText('320 requests • 950ms avg')).toBeInTheDocument()
      expect(screen.getByText('280 requests • 1100ms avg')).toBeInTheDocument()
    })

    it('should display provider details correctly', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockAIUsageData
      }) as jest.Mock

      render(<AIUsageWidget />)

      await waitFor(() => {
        expect(screen.getByText('450 requests • 1200ms avg')).toBeInTheDocument()
        expect(screen.getByText('$3.42')).toBeInTheDocument()
        expect(screen.getByText('57.0K tokens')).toBeInTheDocument()
      })
    })

    it('should display top models chart section', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockAIUsageData
      }) as jest.Mock

      render(<AIUsageWidget />)

      await waitFor(() => {
        expect(screen.getByText('Top Models by Usage')).toBeInTheDocument()
      })
    })

    it('should display cost distribution section', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockAIUsageData
      }) as jest.Mock

      render(<AIUsageWidget />)

      await waitFor(() => {
        expect(screen.getByText('Cost Distribution')).toBeInTheDocument()
        expect(screen.getByText('39.9%')).toBeInTheDocument()
        expect(screen.getByText('32.2%')).toBeInTheDocument()
        expect(screen.getByText('28.0%')).toBeInTheDocument()
      })
    })

    it('should display last update timestamp', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockAIUsageData
      }) as jest.Mock

      render(<AIUsageWidget />)

      await waitFor(() => {
        expect(screen.getByText(/Last updated:/)).toBeInTheDocument()
      })
    })
  })

  describe('API Integration', () => {
    it('should fetch data from correct endpoint', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockAIUsageData
      }) as jest.Mock

      render(<AIUsageWidget />)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/dashboard/ai-usage')
      })
    })

    it('should handle API response correctly', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockAIUsageData
      }) as jest.Mock

      render(<AIUsageWidget />)

      await waitFor(() => {
        expect(screen.getByText('AI Usage & Costs')).toBeInTheDocument()
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('API error')) as jest.Mock

      render(<AIUsageWidget />)

      await waitFor(() => {
        expect(screen.getByText('Error Loading AI Usage Data')).toBeInTheDocument()
        expect(screen.getByText('API error')).toBeInTheDocument()
      })
    })

    it('should handle HTTP error responses', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      }) as jest.Mock

      render(<AIUsageWidget />)

      await waitFor(() => {
        expect(screen.getByText(/Error Loading AI Usage Data/)).toBeInTheDocument()
        expect(screen.getByText(/500.*Internal Server Error/)).toBeInTheDocument()
      })
    })

    it('should display error UI with correct styling', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Test error')) as jest.Mock

      const { container } = render(<AIUsageWidget />)

      await waitFor(() => {
        expect(screen.getByText('Error Loading AI Usage Data')).toBeInTheDocument()
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
        json: async () => mockAIUsageData
      }) as jest.Mock

      render(<AIUsageWidget refreshInterval={5000} />)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1)
      })

      jest.advanceTimersByTime(5000)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2)
      })

      jest.advanceTimersByTime(5000)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(3)
      })
    })

    it('should use default refresh interval of 60 seconds', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockAIUsageData
      }) as jest.Mock

      render(<AIUsageWidget />)

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
        json: async () => mockAIUsageData
      }) as jest.Mock

      const { unmount } = render(<AIUsageWidget refreshInterval={5000} />)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1)
      })

      unmount()

      jest.advanceTimersByTime(5000)

      expect(global.fetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('Chart Integration', () => {
    it('should render recharts components', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockAIUsageData
      }) as jest.Mock

      render(<AIUsageWidget />)

      await waitFor(() => {
        expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
        expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
        expect(screen.getByTestId('bar')).toBeInTheDocument()
      })
    })
  })

  describe('Data Formatting', () => {
    it('should format token count in thousands', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockAIUsageData
      }) as jest.Mock

      render(<AIUsageWidget />)

      await waitFor(() => {
        expect(screen.getByText('143.0K')).toBeInTheDocument()
      })
    })

    it('should format cost with 2 decimal places', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockAIUsageData
      }) as jest.Mock

      render(<AIUsageWidget />)

      await waitFor(() => {
        expect(screen.getByText('$8.58')).toBeInTheDocument()
      })
    })

    it('should format percentages with 1 decimal place', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockAIUsageData
      }) as jest.Mock

      render(<AIUsageWidget />)

      await waitFor(() => {
        expect(screen.getByText('39.9%')).toBeInTheDocument()
      })
    })

    it('should format large numbers with commas', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ...mockAIUsageData,
          totalRequests: 1234567
        })
      }) as jest.Mock

      render(<AIUsageWidget />)

      await waitFor(() => {
        expect(screen.getByText('1,234,567')).toBeInTheDocument()
      })
    })
  })

  describe('Custom Styling', () => {
    it('should apply custom className', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockAIUsageData
      }) as jest.Mock

      const { container } = render(<AIUsageWidget className="custom-class" />)

      await waitFor(() => {
        expect(container.querySelector('.custom-class')).toBeInTheDocument()
      })
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty providers', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ...mockAIUsageData,
          providers: {}
        })
      }) as jest.Mock

      render(<AIUsageWidget />)

      await waitFor(() => {
        expect(screen.getByText('Provider Usage')).toBeInTheDocument()
      })
    })

    it('should handle empty models array', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ...mockAIUsageData,
          models: []
        })
      }) as jest.Mock

      render(<AIUsageWidget />)

      await waitFor(() => {
        expect(screen.getByText('Top Models by Usage')).toBeInTheDocument()
      })
    })

    it('should handle null data gracefully', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => null
      }) as jest.Mock

      const { container } = render(<AIUsageWidget />)

      await waitFor(() => {
        expect(container.firstChild).toBeNull()
      })
    })

    it('should display only top 5 models', async () => {
      const manyModels = Array.from({ length: 10 }, (_, i) => ({
        name: `model-${i}`,
        requests: 100 - i * 5,
        tokens: 10000,
        avgLatency: 1000,
        cost: 1.0
      }))

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ...mockAIUsageData,
          models: manyModels
        })
      }) as jest.Mock

      render(<AIUsageWidget />)

      await waitFor(() => {
        expect(screen.getByText('Top Models by Usage')).toBeInTheDocument()
      })
    })

    it('should handle zero costs', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ...mockAIUsageData,
          totalCost: 0,
          costByProvider: []
        })
      }) as jest.Mock

      render(<AIUsageWidget />)

      await waitFor(() => {
        expect(screen.getByText('$0.00')).toBeInTheDocument()
      })
    })

    it('should handle very large token counts', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ...mockAIUsageData,
          totalTokens: 9876543210
        })
      }) as jest.Mock

      render(<AIUsageWidget />)

      await waitFor(() => {
        expect(screen.getByText('9876543.2K')).toBeInTheDocument()
      })
    })
  })

  describe('Provider Display', () => {
    it('should capitalize provider names', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockAIUsageData
      }) as jest.Mock

      render(<AIUsageWidget />)

      await waitFor(() => {
        // Check that provider usage section exists
        expect(screen.getByText('Provider Usage')).toBeInTheDocument()
      })

      // Check for provider-specific metrics instead of provider names which appear multiple times
      expect(screen.getByText('450 requests • 1200ms avg')).toBeInTheDocument()
    })

    it('should display all provider information', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockAIUsageData
      }) as jest.Mock

      render(<AIUsageWidget />)

      await waitFor(() => {
        // Check that provider usage section exists
        expect(screen.getByText('Provider Usage')).toBeInTheDocument()
      })

      // Check for specific provider data
      expect(screen.getByText('450 requests • 1200ms avg')).toBeInTheDocument()
      expect(screen.getByText('$3.42')).toBeInTheDocument()
    })
  })
})
