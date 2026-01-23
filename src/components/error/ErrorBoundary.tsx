'use client'

import React, { Component, ErrorInfo, ReactNode, useCallback, useState } from 'react'

// ============================================================================
// Types
// ============================================================================

export type ErrorBoundaryVariant = 'default' | 'ai' | 'collaboration' | 'compact' | 'inline'

export interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  /** Render prop for custom fallback with error context */
  fallbackRender?: (props: FallbackRenderProps) => ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  /** Visual variant for the error display */
  variant?: ErrorBoundaryVariant
  /** Component name for better error context */
  componentName?: string
  /** Enable automatic retry with exponential backoff */
  enableAutoRetry?: boolean
  /** Maximum auto retry attempts */
  maxRetries?: number
  /** Custom action button configuration */
  actionButton?: {
    label: string
    onClick: () => void
  }
}

export interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  retryCount: number
}

export interface FallbackRenderProps {
  error: Error | null
  errorInfo: ErrorInfo | null
  resetError: () => void
  retryCount: number
  componentName?: string
}

// ============================================================================
// Error Icons
// ============================================================================

const ErrorIcon = ({ className = "h-12 w-12" }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
    />
  </svg>
)

const AIErrorIcon = ({ className = "h-12 w-12" }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
    />
  </svg>
)

const CollaborationErrorIcon = ({ className = "h-12 w-12" }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
    />
  </svg>
)

// ============================================================================
// Variant Configurations
// ============================================================================

const variantConfig = {
  default: {
    containerClass: 'min-h-[400px] flex items-center justify-center p-4',
    cardClass: 'max-w-md w-full bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center',
    titleClass: 'text-xl font-semibold text-red-900 dark:text-red-100 mb-2',
    messageClass: 'text-red-700 dark:text-red-300 mb-4',
    buttonClass: 'px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2',
    iconClass: 'mx-auto h-12 w-12 text-red-500 dark:text-red-400',
    Icon: ErrorIcon,
    title: 'Something went wrong',
    defaultMessage: 'An unexpected error occurred'
  },
  ai: {
    containerClass: 'min-h-[300px] flex items-center justify-center p-4',
    cardClass: 'max-w-md w-full bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-6 text-center',
    titleClass: 'text-xl font-semibold text-purple-900 dark:text-purple-100 mb-2',
    messageClass: 'text-purple-700 dark:text-purple-300 mb-4',
    buttonClass: 'px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2',
    iconClass: 'mx-auto h-12 w-12 text-purple-500 dark:text-purple-400',
    Icon: AIErrorIcon,
    title: 'AI Service Unavailable',
    defaultMessage: 'The AI assistant encountered an issue. Please try again.'
  },
  collaboration: {
    containerClass: 'min-h-[300px] flex items-center justify-center p-4',
    cardClass: 'max-w-md w-full bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 text-center',
    titleClass: 'text-xl font-semibold text-blue-900 dark:text-blue-100 mb-2',
    messageClass: 'text-blue-700 dark:text-blue-300 mb-4',
    buttonClass: 'px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
    iconClass: 'mx-auto h-12 w-12 text-blue-500 dark:text-blue-400',
    Icon: CollaborationErrorIcon,
    title: 'Collaboration Error',
    defaultMessage: 'Unable to sync with collaborators. Please check your connection.'
  },
  compact: {
    containerClass: 'p-3',
    cardClass: 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-center gap-3',
    titleClass: 'text-sm font-medium text-red-900 dark:text-red-100',
    messageClass: 'text-xs text-red-700 dark:text-red-300',
    buttonClass: 'px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors',
    iconClass: 'h-5 w-5 text-red-500 dark:text-red-400 flex-shrink-0',
    Icon: ErrorIcon,
    title: 'Error',
    defaultMessage: 'Something went wrong'
  },
  inline: {
    containerClass: 'p-2',
    cardClass: 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded px-3 py-2 flex items-center gap-2',
    titleClass: 'text-xs font-medium text-yellow-900 dark:text-yellow-100',
    messageClass: 'text-xs text-yellow-700 dark:text-yellow-300',
    buttonClass: 'px-2 py-0.5 text-xs bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors',
    iconClass: 'h-4 w-4 text-yellow-500 dark:text-yellow-400 flex-shrink-0',
    Icon: ErrorIcon,
    title: 'Error',
    defaultMessage: 'Something went wrong'
  }
}

// ============================================================================
// Default Fallback Component
// ============================================================================

interface DefaultFallbackProps {
  variant: ErrorBoundaryVariant
  error: Error | null
  componentName?: string
  onReset: () => void
  actionButton?: ErrorBoundaryProps['actionButton']
}

function DefaultFallback({
  variant,
  error,
  componentName,
  onReset,
  actionButton
}: DefaultFallbackProps) {
  const config = variantConfig[variant]
  const isCompact = variant === 'compact' || variant === 'inline'

  if (isCompact) {
    return (
      <div className={config.containerClass}>
        <div className={config.cardClass}>
          <config.Icon className={config.iconClass} />
          <div className="flex-1 min-w-0">
            <p className={config.titleClass}>{config.title}</p>
            <p className={config.messageClass}>
              {error?.message || config.defaultMessage}
            </p>
          </div>
          <button onClick={onReset} className={config.buttonClass}>
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={config.containerClass}>
      <div className={config.cardClass}>
        <div className="mb-4">
          <config.Icon className={config.iconClass} />
        </div>

        <h2 className={config.titleClass}>
          {config.title}
        </h2>

        {componentName && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            Component: {componentName}
          </p>
        )}

        <p className={config.messageClass}>
          {error?.message || config.defaultMessage}
        </p>

        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <button onClick={onReset} className={config.buttonClass}>
            Try Again
          </button>
          {actionButton && (
            <button
              onClick={actionButton.onClick}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              {actionButton.label}
            </button>
          )}
        </div>

        {process.env.NODE_ENV === 'development' && error && (
          <details className="mt-4 text-left">
            <summary className="cursor-pointer text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
              Error Details (Development Only)
            </summary>
            <pre className="mt-2 text-xs text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-800 p-3 rounded overflow-auto max-h-40">
              {error.stack}
            </pre>
          </details>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Error Boundary Class Component
// ============================================================================

/**
 * Production-grade Error Boundary component for React 19
 * Catches JavaScript errors anywhere in the child component tree
 *
 * Supports multiple visual variants:
 * - default: Standard error display
 * - ai: AI/ML feature errors with purple theme
 * - collaboration: Real-time collaboration errors with blue theme
 * - compact: Minimal inline error display
 * - inline: Very compact inline error display
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryTimeoutId: NodeJS.Timeout | null = null

  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error to console
    console.error('ErrorBoundary caught an error:', error, errorInfo)

    // Update state with error info
    this.setState({ errorInfo })

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }

    // Handle auto-retry if enabled
    const { enableAutoRetry, maxRetries = 3 } = this.props
    if (enableAutoRetry && this.state.retryCount < maxRetries) {
      const delay = Math.min(1000 * Math.pow(2, this.state.retryCount), 10000)
      this.retryTimeoutId = setTimeout(() => {
        this.handleReset()
      }, delay)
    }
  }

  componentWillUnmount(): void {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId)
    }
  }

  handleReset = (): void => {
    this.setState((prevState) => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: prevState.retryCount + 1
    }))
  }

  render(): ReactNode {
    const {
      children,
      fallback,
      fallbackRender,
      variant = 'default',
      componentName,
      actionButton
    } = this.props
    const { hasError, error, errorInfo, retryCount } = this.state

    if (hasError) {
      // Custom fallback element
      if (fallback) {
        return fallback
      }

      // Custom fallback render function
      if (fallbackRender) {
        return fallbackRender({
          error,
          errorInfo,
          resetError: this.handleReset,
          retryCount,
          componentName
        })
      }

      // Default fallback based on variant
      return (
        <DefaultFallback
          variant={variant}
          error={error}
          componentName={componentName}
          onReset={this.handleReset}
          actionButton={actionButton}
        />
      )
    }

    return children
  }
}

// ============================================================================
// Specialized Error Boundary Wrappers (Functional Components)
// ============================================================================

/**
 * Error boundary specialized for AI components
 * Features AI-specific error messages and retry capabilities
 */
export function AIErrorBoundary({
  children,
  onError,
  componentName,
  fallbackRender,
  ...props
}: Omit<ErrorBoundaryProps, 'variant'>) {
  return (
    <ErrorBoundary
      {...props}
      variant="ai"
      componentName={componentName}
      onError={onError}
      enableAutoRetry
      maxRetries={2}
      fallbackRender={fallbackRender}
    >
      {children}
    </ErrorBoundary>
  )
}

/**
 * Error boundary specialized for collaboration components
 * Features collaboration-specific error messages and reconnection hints
 */
export function CollaborationErrorBoundary({
  children,
  onError,
  componentName,
  onReconnect,
  ...props
}: Omit<ErrorBoundaryProps, 'variant'> & { onReconnect?: () => void }) {
  return (
    <ErrorBoundary
      {...props}
      variant="collaboration"
      componentName={componentName}
      onError={onError}
      actionButton={
        onReconnect
          ? { label: 'Reconnect', onClick: onReconnect }
          : undefined
      }
    >
      {children}
    </ErrorBoundary>
  )
}

/**
 * Compact error boundary for use in smaller UI elements
 */
export function CompactErrorBoundary({
  children,
  onError,
  ...props
}: Omit<ErrorBoundaryProps, 'variant'>) {
  return (
    <ErrorBoundary {...props} variant="compact" onError={onError}>
      {children}
    </ErrorBoundary>
  )
}

/**
 * Inline error boundary for minimal space usage
 */
export function InlineErrorBoundary({
  children,
  onError,
  ...props
}: Omit<ErrorBoundaryProps, 'variant'>) {
  return (
    <ErrorBoundary {...props} variant="inline" onError={onError}>
      {children}
    </ErrorBoundary>
  )
}

// ============================================================================
// Hook for functional component error handling
// ============================================================================

/**
 * Hook to manually trigger error boundary from functional components
 * Usage: const { showError, clearError } = useErrorHandler()
 */
export function useErrorHandler() {
  const [error, setError] = useState<Error | null>(null)

  const showError = useCallback((err: Error | string) => {
    const errorObj = typeof err === 'string' ? new Error(err) : err
    setError(errorObj)
  }, [])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  // Throw the error to be caught by nearest error boundary
  if (error) {
    throw error
  }

  return { showError, clearError, hasError: !!error }
}

// ============================================================================
// HOC for wrapping components with error boundaries
// ============================================================================

/**
 * Higher-order component to wrap any component with an error boundary
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const displayName = WrappedComponent.displayName || WrappedComponent.name || 'Component'

  const WithErrorBoundary = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps} componentName={displayName}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  )

  WithErrorBoundary.displayName = `withErrorBoundary(${displayName})`

  return WithErrorBoundary
}

/**
 * HOC specifically for AI components
 */
export function withAIErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children' | 'variant'>
) {
  const displayName = WrappedComponent.displayName || WrappedComponent.name || 'AIComponent'

  const WithAIErrorBoundary = (props: P) => (
    <AIErrorBoundary {...errorBoundaryProps} componentName={displayName}>
      <WrappedComponent {...props} />
    </AIErrorBoundary>
  )

  WithAIErrorBoundary.displayName = `withAIErrorBoundary(${displayName})`

  return WithAIErrorBoundary
}

/**
 * HOC specifically for collaboration components
 */
export function withCollaborationErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children' | 'variant'> & { onReconnect?: () => void }
) {
  const displayName = WrappedComponent.displayName || WrappedComponent.name || 'CollaborationComponent'

  const WithCollaborationErrorBoundary = (props: P) => (
    <CollaborationErrorBoundary {...errorBoundaryProps} componentName={displayName}>
      <WrappedComponent {...props} />
    </CollaborationErrorBoundary>
  )

  WithCollaborationErrorBoundary.displayName = `withCollaborationErrorBoundary(${displayName})`

  return WithCollaborationErrorBoundary
}

export default ErrorBoundary
