'use client'

import { ErrorBoundary } from '@/components/error/ErrorBoundary'
import { logger } from '@/lib/logger'

export default function GenerativeUILayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        logger.error('Generative UI error', { error, errorInfo })
      }}
      fallback={
        <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
          <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg border border-red-200 p-8 text-center">
            <div className="mb-6">
              <svg
                className="mx-auto h-20 w-20 text-red-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-3">
              AI Chat Error
            </h2>
            <p className="text-lg text-gray-600 mb-6">
              The AI-powered chat interface encountered an error.
              This could be due to an API issue or network problem.
            </p>
            <div className="space-y-3">
              <button
                onClick={() => window.location.reload()}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Reload Chat Interface
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="w-full px-6 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-medium"
              >
                Return to Home
              </button>
            </div>
          </div>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  )
}
