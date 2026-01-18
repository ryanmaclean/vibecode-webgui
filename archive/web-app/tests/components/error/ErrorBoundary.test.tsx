import { render, screen, fireEvent } from '@testing-library/react'
import { ErrorBoundary } from '@/components/error/ErrorBoundary'
import React from 'react'

// Component that throws an error
const ThrowError = ({ shouldThrow = true }: { shouldThrow?: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error message')
  }
  return <div>No error</div>
}

// Component with custom error message
const ThrowCustomError = ({ message }: { message: string }) => {
  throw new Error(message)
}

describe('ErrorBoundary', () => {
  // Suppress console.error for cleaner test output
  const originalError = console.error
  beforeAll(() => {
    console.error = jest.fn()
  })

  afterAll(() => {
    console.error = originalError
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should render children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <div>Test content</div>
      </ErrorBoundary>
    )

    expect(screen.getByText('Test content')).toBeInTheDocument()
  })

  it('should catch errors thrown by child components', () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    )

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText('Test error message')).toBeInTheDocument()
  })

  it('should display fallback UI when error is caught', () => {
    const { container } = render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    )

    // Check for error icon (SVG)
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()

    // Check for error title
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()

    // Check for error message
    expect(screen.getByText('Test error message')).toBeInTheDocument()

    // Check for Try Again button
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })

  it('should reset error state when Try Again button is clicked', () => {
    const { rerender } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )

    // Error UI should be visible
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()

    const tryAgainButton = screen.getByRole('button', { name: /try again/i })

    // Update the component to not throw before clicking reset
    rerender(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    )

    // Click Try Again button
    fireEvent.click(tryAgainButton)

    // Children should be rendered again
    expect(screen.getByText('No error')).toBeInTheDocument()
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument()
  })

  it('should log errors to console', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error')

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    )

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'ErrorBoundary caught an error:',
      expect.any(Error),
      expect.any(Object)
    )
  })

  it('should call onError callback when provided', () => {
    const onErrorMock = jest.fn()

    render(
      <ErrorBoundary onError={onErrorMock}>
        <ThrowError />
      </ErrorBoundary>
    )

    expect(onErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Test error message' }),
      expect.any(Object)
    )
  })

  it('should render custom fallback UI when provided', () => {
    const customFallback = <div>Custom error UI</div>

    render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowError />
      </ErrorBoundary>
    )

    expect(screen.getByText('Custom error UI')).toBeInTheDocument()
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument()
  })

  it('should display custom error messages', () => {
    const customMessage = 'Custom error occurred'

    render(
      <ErrorBoundary>
        <ThrowCustomError message={customMessage} />
      </ErrorBoundary>
    )

    expect(screen.getByText(customMessage)).toBeInTheDocument()
  })

  it('should show error details in development mode', () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    )

    // Check for details element (error stack trace)
    expect(screen.getByText('Error Details (Development Only)')).toBeInTheDocument()

    process.env.NODE_ENV = originalEnv
  })

  it('should handle multiple children components', () => {
    render(
      <ErrorBoundary>
        <div>First child</div>
        <div>Second child</div>
        <div>Third child</div>
      </ErrorBoundary>
    )

    expect(screen.getByText('First child')).toBeInTheDocument()
    expect(screen.getByText('Second child')).toBeInTheDocument()
    expect(screen.getByText('Third child')).toBeInTheDocument()
  })

  it('should maintain error boundary isolation between instances', () => {
    render(
      <div>
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
        <ErrorBoundary>
          <div>This boundary is fine</div>
        </ErrorBoundary>
      </div>
    )

    // First boundary should show error
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()

    // Second boundary should render normally
    expect(screen.getByText('This boundary is fine')).toBeInTheDocument()
  })

  it('should display default message when error has no message', () => {
    const ThrowEmptyError = () => {
      throw new Error()
    }

    render(
      <ErrorBoundary>
        <ThrowEmptyError />
      </ErrorBoundary>
    )

    expect(screen.getByText('An unexpected error occurred')).toBeInTheDocument()
  })
})
