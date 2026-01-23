/**
 * Error Boundary Components
 *
 * Centralized exports for all error boundary components and utilities.
 * Use these components to gracefully handle errors in React applications.
 *
 * @example
 * // Basic usage
 * import { ErrorBoundary } from '@/components/error'
 *
 * // AI-specific error handling
 * import { AIErrorBoundary, withAIErrorBoundary } from '@/components/error'
 *
 * // Collaboration-specific error handling
 * import { CollaborationErrorBoundary, withCollaborationErrorBoundary } from '@/components/error'
 */

export {
  // Main Error Boundary
  ErrorBoundary,

  // Specialized Error Boundaries
  AIErrorBoundary,
  CollaborationErrorBoundary,
  CompactErrorBoundary,
  InlineErrorBoundary,

  // Higher-Order Components
  withErrorBoundary,
  withAIErrorBoundary,
  withCollaborationErrorBoundary,

  // Hook
  useErrorHandler,

  // Types
  type ErrorBoundaryProps,
  type ErrorBoundaryState,
  type ErrorBoundaryVariant,
  type FallbackRenderProps,
} from './ErrorBoundary'
