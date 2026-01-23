/**
 * Dashboard Error Boundary Tests
 *
 * Tests for the DashboardErrorBoundary component including:
 * - Error catching and fallback UI rendering
 * - Widget-specific fallback configurations
 * - Retry functionality
 * - Stale data display
 * - Error logging integration
 */

import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import {
  DashboardErrorBoundary,
  withDashboardErrorBoundary
} from '@/components/dashboard/DashboardErrorBoundary'

// Mock the error tracking module
jest.mock('@/lib/monitoring/error-tracking', () => ({
  trackError: jest.fn()
}))

import { trackError } from '@/lib/monitoring/error-tracking'

const mockTrackError = trackError as jest.Mock

// ============================================================================
// Test Helper Components
// ============================================================================

// Component that throws an error
const ThrowError = ({ shouldThrow = true }: { shouldThrow?: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test widget error')
  }
  return <div data-testid="widget-content">Widget loaded successfully</div>
}

// Component with custom error message
const ThrowCustomError = ({ message }: { message: string }) => {
  throw new Error(message)
}

// Working widget component for testing
const WorkingWidget = () => (
  <div data-testid="working-widget">
    <h3>Working Widget</h3>
    <p>This widget is working correctly</p>
  </div>
)

// ============================================================================
// Test Suite
// ============================================================================

describe('DashboardErrorBoundary', () => {
  // Suppress console.error for cleaner test output
  const originalError = console.error
  const originalEnv = process.env.NODE_ENV

  beforeAll(() => {
    console.error = jest.fn()
  })

  afterAll(() => {
    console.error = originalError
    process.env.NODE_ENV = originalEnv
  })

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  // --------------------------------------------------------------------------
  // Basic Functionality Tests
  // --------------------------------------------------------------------------

  describe('basic functionality', () => {
    it('should render children when no error occurs', () => {
      render(
        <DashboardErrorBoundary>
          <WorkingWidget />
        </DashboardErrorBoundary>
      )

      expect(screen.getByTestId('working-widget')).toBeInTheDocument()
      expect(screen.getByText('Working Widget')).toBeInTheDocument()
    })

    it('should catch errors thrown by child components', () => {
      render(
        <DashboardErrorBoundary widgetTitle="Test Widget">
          <ThrowError />
        </DashboardErrorBoundary>
      )

      expect(screen.getByText('Unable to load widget data')).toBeInTheDocument()
      expect(screen.getByText('Test widget error')).toBeInTheDocument()
    })

    it('should display the widget title in error state', () => {
      render(
        <DashboardErrorBoundary widgetTitle="Performance Metrics">
          <ThrowError />
        </DashboardErrorBoundary>
      )

      expect(screen.getByText('Performance Metrics')).toBeInTheDocument()
    })
  })

  // --------------------------------------------------------------------------
  // Widget Type Fallback UI Tests
  // --------------------------------------------------------------------------

  describe('widget-specific fallback UI', () => {
    it('should render performance widget fallback UI', () => {
      render(
        <DashboardErrorBoundary widgetType="performance" widgetTitle="Performance Trends">
          <ThrowError />
        </DashboardErrorBoundary>
      )

      expect(screen.getByText('Performance Trends')).toBeInTheDocument()
      expect(screen.getByText('Average')).toBeInTheDocument()
      expect(screen.getByText('P95 Latency')).toBeInTheDocument()
      expect(screen.getByText('Max (P99)')).toBeInTheDocument()
      // Check placeholder values
      expect(screen.getAllByText('-- ms')).toHaveLength(3)
    })

    it('should render health widget fallback UI', () => {
      render(
        <DashboardErrorBoundary widgetType="health" widgetTitle="System Health">
          <ThrowError />
        </DashboardErrorBoundary>
      )

      expect(screen.getByText('System Health')).toBeInTheDocument()
      expect(screen.getByText('Database')).toBeInTheDocument()
      expect(screen.getByText('Cache')).toBeInTheDocument()
      expect(screen.getByText('AI Services')).toBeInTheDocument()
      expect(screen.getAllByText('Unknown')).toHaveLength(3)
    })

    it('should render usage widget fallback UI', () => {
      render(
        <DashboardErrorBoundary widgetType="usage" widgetTitle="AI Usage">
          <ThrowError />
        </DashboardErrorBoundary>
      )

      expect(screen.getByText('AI Usage')).toBeInTheDocument()
      expect(screen.getByText('Total Requests')).toBeInTheDocument()
      expect(screen.getByText('Total Tokens')).toBeInTheDocument()
      expect(screen.getByText('Estimated Cost')).toBeInTheDocument()
    })

    it('should render generic widget fallback UI as default', () => {
      render(
        <DashboardErrorBoundary widgetTitle="Custom Widget">
          <ThrowError />
        </DashboardErrorBoundary>
      )

      expect(screen.getByText('Custom Widget')).toBeInTheDocument()
      expect(screen.getByText('Status')).toBeInTheDocument()
      expect(screen.getByText('Unavailable')).toBeInTheDocument()
    })
  })

  // --------------------------------------------------------------------------
  // Retry Functionality Tests
  // --------------------------------------------------------------------------

  describe('retry functionality', () => {
    it('should display retry button', () => {
      render(
        <DashboardErrorBoundary widgetTitle="Test Widget">
          <ThrowError />
        </DashboardErrorBoundary>
      )

      const retryButton = screen.getByRole('button', { name: /retry/i })
      expect(retryButton).toBeInTheDocument()
    })

    it('should reset error state when retry button is clicked', async () => {
      const { rerender } = render(
        <DashboardErrorBoundary widgetTitle="Test Widget">
          <ThrowError shouldThrow={true} />
        </DashboardErrorBoundary>
      )

      // Error UI should be visible
      expect(screen.getByText('Unable to load widget data')).toBeInTheDocument()

      // Update component to not throw before retry
      rerender(
        <DashboardErrorBoundary widgetTitle="Test Widget">
          <ThrowError shouldThrow={false} />
        </DashboardErrorBoundary>
      )

      // Click retry button
      const retryButton = screen.getByRole('button', { name: /retry/i })
      fireEvent.click(retryButton)

      // Wait for the retry delay
      act(() => {
        jest.advanceTimersByTime(300)
      })

      // Children should be rendered again
      await waitFor(() => {
        expect(screen.getByTestId('widget-content')).toBeInTheDocument()
      })
    })

    it('should show retrying state on retry button', () => {
      render(
        <DashboardErrorBoundary widgetTitle="Test Widget">
          <ThrowError />
        </DashboardErrorBoundary>
      )

      const retryButton = screen.getByRole('button', { name: /retry/i })
      fireEvent.click(retryButton)

      // Button should show retrying state (before timeout completes)
      expect(screen.getByText('Retrying...')).toBeInTheDocument()
    })

    it('should increment retry count on each retry attempt', () => {
      render(
        <DashboardErrorBoundary widgetTitle="Test Widget">
          <ThrowError />
        </DashboardErrorBoundary>
      )

      // First retry
      const retryButton = screen.getByRole('button', { name: /retry/i })
      fireEvent.click(retryButton)

      act(() => {
        jest.advanceTimersByTime(300)
      })

      // Should show retry count after failed retry
      expect(screen.getByText('Retry attempts: 1')).toBeInTheDocument()
    })

    it('should auto-retry when enableAutoRetry is true', async () => {
      render(
        <DashboardErrorBoundary
          widgetTitle="Test Widget"
          enableAutoRetry={true}
          maxRetries={3}
          retryDelay={1000}
        >
          <ThrowError />
        </DashboardErrorBoundary>
      )

      // Error should be caught
      expect(screen.getByText('Unable to load widget data')).toBeInTheDocument()

      // Wait for auto-retry delay
      act(() => {
        jest.advanceTimersByTime(1000)
      })

      // Should see retrying state
      expect(screen.getByText('Retrying...')).toBeInTheDocument()

      // Wait for internal retry delay to complete
      act(() => {
        jest.advanceTimersByTime(300)
      })

      // After retry completes and error is caught again, should show retry count
      await waitFor(() => {
        expect(screen.getByText('Retry attempts: 1')).toBeInTheDocument()
      })
    })
  })

  // --------------------------------------------------------------------------
  // Stale Data Display Tests
  // --------------------------------------------------------------------------

  describe('stale data display', () => {
    it('should show stale data warning when staleData is provided', () => {
      const staleData = { value: 100, timestamp: '2024-01-01' }

      render(
        <DashboardErrorBoundary
          widgetTitle="Test Widget"
          staleData={staleData}
        >
          <ThrowError />
        </DashboardErrorBoundary>
      )

      expect(screen.getByText('Stale Data')).toBeInTheDocument()
      expect(screen.getByText('Showing cached data. Live updates unavailable.')).toBeInTheDocument()
    })

    it('should display retry button with stale data', () => {
      const staleData = { value: 100 }

      render(
        <DashboardErrorBoundary
          widgetTitle="Test Widget"
          staleData={staleData}
        >
          <ThrowError />
        </DashboardErrorBoundary>
      )

      const retryButton = screen.getByRole('button', { name: /retry/i })
      expect(retryButton).toBeInTheDocument()
    })
  })

  // --------------------------------------------------------------------------
  // Error Logging Tests
  // --------------------------------------------------------------------------

  describe('error logging', () => {
    it('should log errors to console in development mode', () => {
      process.env.NODE_ENV = 'development'
      const consoleErrorSpy = jest.spyOn(console, 'error')

      render(
        <DashboardErrorBoundary widgetTitle="Test Widget" widgetType="performance">
          <ThrowError />
        </DashboardErrorBoundary>
      )

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('DashboardErrorBoundary caught error'),
        expect.any(Error),
        expect.any(Object)
      )
    })

    it('should call trackError for monitoring integration', () => {
      render(
        <DashboardErrorBoundary widgetTitle="Test Widget" widgetType="health">
          <ThrowError />
        </DashboardErrorBoundary>
      )

      expect(mockTrackError).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Test widget error' }),
        expect.objectContaining({
          component: 'DashboardErrorBoundary',
          widget_type: 'health',
          widget_title: 'Test Widget'
        })
      )
    })

    it('should call onError callback when provided', () => {
      const onErrorMock = jest.fn()

      render(
        <DashboardErrorBoundary widgetTitle="Test Widget" onError={onErrorMock}>
          <ThrowError />
        </DashboardErrorBoundary>
      )

      expect(onErrorMock).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Test widget error' }),
        expect.any(Object)
      )
    })
  })

  // --------------------------------------------------------------------------
  // Error Details Display Tests
  // --------------------------------------------------------------------------

  describe('error details display', () => {
    it('should show error details in development mode', () => {
      process.env.NODE_ENV = 'development'

      render(
        <DashboardErrorBoundary widgetTitle="Test Widget">
          <ThrowError />
        </DashboardErrorBoundary>
      )

      expect(screen.getByText('Error Details (Development Only)')).toBeInTheDocument()
    })

    it('should display custom error messages', () => {
      const customMessage = 'Custom widget error occurred'

      render(
        <DashboardErrorBoundary widgetTitle="Test Widget">
          <ThrowCustomError message={customMessage} />
        </DashboardErrorBoundary>
      )

      expect(screen.getByText(customMessage)).toBeInTheDocument()
    })
  })

  // --------------------------------------------------------------------------
  // Error Boundary Isolation Tests
  // --------------------------------------------------------------------------

  describe('error boundary isolation', () => {
    it('should isolate errors between multiple dashboard widgets', () => {
      render(
        <div className="dashboard-grid">
          <DashboardErrorBoundary widgetTitle="Widget 1" widgetType="performance">
            <ThrowError />
          </DashboardErrorBoundary>
          <DashboardErrorBoundary widgetTitle="Widget 2" widgetType="health">
            <WorkingWidget />
          </DashboardErrorBoundary>
          <DashboardErrorBoundary widgetTitle="Widget 3" widgetType="usage">
            <div data-testid="widget-3">Widget 3 content</div>
          </DashboardErrorBoundary>
        </div>
      )

      // First widget should show error
      expect(screen.getByText('Widget 1')).toBeInTheDocument()
      expect(screen.getByText('Unable to load widget data')).toBeInTheDocument()

      // Second widget should render normally
      expect(screen.getByTestId('working-widget')).toBeInTheDocument()

      // Third widget should render normally
      expect(screen.getByTestId('widget-3')).toBeInTheDocument()
    })
  })
})

// ============================================================================
// withDashboardErrorBoundary HOC Tests
// ============================================================================

describe('withDashboardErrorBoundary HOC', () => {
  const originalError = console.error

  beforeAll(() => {
    console.error = jest.fn()
  })

  afterAll(() => {
    console.error = originalError
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should wrap component with error boundary', () => {
    const WrappedWidget = withDashboardErrorBoundary(WorkingWidget, {
      widgetType: 'performance',
      widgetTitle: 'Wrapped Widget'
    })

    render(<WrappedWidget />)

    expect(screen.getByTestId('working-widget')).toBeInTheDocument()
  })

  it('should catch errors in wrapped component', () => {
    const WrappedWidget = withDashboardErrorBoundary(ThrowError, {
      widgetType: 'health',
      widgetTitle: 'Failing Widget'
    })

    render(<WrappedWidget shouldThrow={true} />)

    expect(screen.getByText('Unable to load widget data')).toBeInTheDocument()
    expect(screen.getByText('Failing Widget')).toBeInTheDocument()
  })

  it('should set displayName correctly', () => {
    const TestComponent = () => <div>Test</div>
    TestComponent.displayName = 'MyTestComponent'

    const WrappedComponent = withDashboardErrorBoundary(TestComponent)

    expect(WrappedComponent.displayName).toBe('withDashboardErrorBoundary(MyTestComponent)')
  })

  it('should call onError handler from options', () => {
    const onErrorMock = jest.fn()

    const WrappedWidget = withDashboardErrorBoundary(ThrowError, {
      widgetTitle: 'Test Widget',
      onError: onErrorMock
    })

    render(<WrappedWidget shouldThrow={true} />)

    expect(onErrorMock).toHaveBeenCalled()
  })

  it('should enable auto-retry from options', async () => {
    jest.useFakeTimers()

    const WrappedWidget = withDashboardErrorBoundary(ThrowError, {
      widgetTitle: 'Test Widget',
      enableAutoRetry: true,
      maxRetries: 2
    })

    render(<WrappedWidget shouldThrow={true} />)

    expect(screen.getByText('Unable to load widget data')).toBeInTheDocument()

    // Auto retry should be triggered after default delay (2000ms) + internal delay (300ms)
    act(() => {
      jest.advanceTimersByTime(2000 + 300 + 100) // Extra margin for state updates
    })

    // After retry completes and error is caught again, should show retry count
    await waitFor(() => {
      expect(screen.getByText('Retry attempts: 1')).toBeInTheDocument()
    })

    jest.useRealTimers()
  })

  it('should pass className to the error boundary', () => {
    const WrappedWidget = withDashboardErrorBoundary(ThrowError, {
      widgetTitle: 'Test Widget'
    })

    const { container } = render(<WrappedWidget shouldThrow={true} className="custom-class" />)

    // The error fallback container should have the custom class
    const errorContainer = container.querySelector('.custom-class')
    expect(errorContainer).toBeInTheDocument()
  })
})

// ============================================================================
// SafeWidgets Integration Tests
// ============================================================================

describe('SafeWidgets', () => {
  const originalError = console.error

  beforeAll(() => {
    console.error = jest.fn()
  })

  afterAll(() => {
    console.error = originalError
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  // Note: These tests would require mocking the actual widget components
  // and their API calls. For now, we test the wrapper functionality.

  it('should export all safe widget components', async () => {
    const { SafePerformanceGraphWidget, SafeSystemHealthWidget, SafeAIUsageWidget } =
      await import('@/components/dashboard/SafeWidgets')

    expect(SafePerformanceGraphWidget).toBeDefined()
    expect(SafeSystemHealthWidget).toBeDefined()
    expect(SafeAIUsageWidget).toBeDefined()
  })
})
