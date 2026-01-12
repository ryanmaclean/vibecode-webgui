/**
 * System Health Widget Component Tests
 * Tests the SystemHealthWidget UI component
 *
 * AGENT 92: Enhanced Monitoring Dashboards Foundation
 */

import React from 'react'
import { render, screen, waitFor, act } from '@testing-library/react'
import { SystemHealthWidget } from '@/components/dashboard/SystemHealthWidget'

// Mock fetch globally
global.fetch = jest.fn()

describe('SystemHealthWidget', () => {
  const mockHealthyData = {
    timestamp: '2026-01-11T12:00:00.000Z',
    health: {
      database: 'healthy',
      cache: 'healthy',
      ai: 'healthy',
      overall: 'healthy'
    },
    performance: {
      avgResponseTime: 120,
      requestsPerMinute: 50
    },
    system: {
      uptime: 86400,
      uptimeFormatted: '1d 0h 0m',
      memory: {
        used: 512,
        total: 1024,
        percentage: 50
      }
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  it('should render loading state initially', () => {
    (global.fetch as jest.Mock).mockImplementation(() => new Promise(() => {}))

    const { container } = render(<SystemHealthWidget />)

    // Check for loading skeleton
    const loadingElements = container.querySelectorAll('.animate-pulse')
    expect(loadingElements.length).toBeGreaterThan(0)
  })

  it('should fetch and display health status', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockHealthyData
    })

    await act(async () => {
      render(<SystemHealthWidget />)
    })

    await waitFor(() => {
      expect(screen.getByText('System Health')).toBeInTheDocument()
    })

    expect(screen.getByText('All Systems Operational')).toBeInTheDocument()
    expect(screen.getByText('Database')).toBeInTheDocument()
    expect(screen.getByText('Cache (Valkey)')).toBeInTheDocument()
    expect(screen.getByText('AI Services')).toBeInTheDocument()
  })

  it('should display all health statuses correctly', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockHealthyData
    })

    await act(async () => {
      render(<SystemHealthWidget />)
    })

    await waitFor(() => {
      const healthyElements = screen.getAllByText('Healthy')
      expect(healthyElements.length).toBeGreaterThan(0)
    })
  })

  it('should display warning status correctly', async () => {
    const warningData = {
      ...mockHealthyData,
      health: {
        database: 'healthy' as const,
        cache: 'warning' as const,
        ai: 'healthy' as const,
        overall: 'warning' as const
      }
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => warningData
    });

    await act(async () => {
      render(<SystemHealthWidget />)
    })

    await waitFor(() => {
      expect(screen.getByText('Degraded Performance')).toBeInTheDocument()
      expect(screen.getByText('Warning')).toBeInTheDocument()
    })
  })

  it('should display error status correctly', async () => {
    const errorData = {
      ...mockHealthyData,
      health: {
        database: 'error' as const,
        cache: 'healthy' as const,
        ai: 'healthy' as const,
        overall: 'error' as const
      }
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => errorData
    });

    await act(async () => {
      render(<SystemHealthWidget />)
    })

    await waitFor(() => {
      expect(screen.getByText('System Issues Detected')).toBeInTheDocument()
      expect(screen.getByText('Error')).toBeInTheDocument()
    })
  })

  it('should display performance metrics', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockHealthyData
    })

    await act(async () => {
      render(<SystemHealthWidget />)
    })

    await waitFor(() => {
      expect(screen.getByText('120ms')).toBeInTheDocument()
      expect(screen.getByText('50')).toBeInTheDocument()
    })
  })

  it('should display system resource information', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockHealthyData
    })

    await act(async () => {
      render(<SystemHealthWidget />)
    })

    await waitFor(() => {
      expect(screen.getByText('1d 0h 0m')).toBeInTheDocument()
      expect(screen.getByText('50%')).toBeInTheDocument()
    })
  })

  it('should show error state on API failure', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('API error'))

    await act(async () => {
      render(<SystemHealthWidget />)
    })

    await waitFor(() => {
      expect(screen.getByText('Error Loading Health Status')).toBeInTheDocument()
      expect(screen.getByText(/API error/i)).toBeInTheDocument()
    })
  })

  it('should show error state on non-OK response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error'
    })

    await act(async () => {
      render(<SystemHealthWidget />)
    })

    await waitFor(() => {
      expect(screen.getByText('Error Loading Health Status')).toBeInTheDocument()
    })
  })

  it('should refresh data at specified interval', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockHealthyData
    })

    await act(async () => {
      render(<SystemHealthWidget refreshInterval={5000} />)
    })

    // Initial fetch
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })

    // Advance time by 5 seconds
    await act(async () => {
      jest.advanceTimersByTime(5000)
    })

    // Should fetch again
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2)
    })
  })

  it('should display last update time', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockHealthyData
    })

    await act(async () => {
      render(<SystemHealthWidget />)
    })

    await waitFor(() => {
      expect(screen.getByText(/Last updated:/i)).toBeInTheDocument()
    })
  })

  it('should apply custom className', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockHealthyData
    })

    const { container } = render(<SystemHealthWidget className="custom-class" />)

    await waitFor(() => {
      const widget = container.querySelector('.custom-class')
      expect(widget).toBeInTheDocument()
    })
  })

  it('should fetch from correct API endpoint', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockHealthyData
    })

    await act(async () => {
      render(<SystemHealthWidget />)
    })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/dashboard/overview')
    })
  })

  it('should cleanup interval on unmount', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockHealthyData
    })

    const { unmount } = render(<SystemHealthWidget refreshInterval={5000} />)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })

    unmount()

    // Advance time - should not fetch after unmount
    await act(async () => {
      jest.advanceTimersByTime(5000)
    })

    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('should handle multiple status types in single render', async () => {
    const mixedData = {
      ...mockHealthyData,
      health: {
        database: 'healthy' as const,
        cache: 'warning' as const,
        ai: 'error' as const,
        overall: 'error' as const
      }
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mixedData
    });

    await act(async () => {
      render(<SystemHealthWidget />)
    })

    await waitFor(() => {
      expect(screen.getByText('Healthy')).toBeInTheDocument()
      expect(screen.getByText('Warning')).toBeInTheDocument()
      expect(screen.getByText('Error')).toBeInTheDocument()
    })
  })
})
