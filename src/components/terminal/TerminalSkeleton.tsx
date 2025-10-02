/**
 * Terminal Loading Skeleton
 * Provides visual feedback while terminal components are loading
 * WCAG 2.1 AA Compliant with reduced motion support
 */

export function TerminalSkeleton() {
  return (
    <div
      className="relative w-full h-full bg-gray-900"
      role="status"
      aria-label="Loading terminal"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="absolute inset-0 flex flex-col p-4 space-y-2">
        {/* Terminal header lines */}
        <div
          className="h-4 bg-gray-800 rounded w-3/4 animate-pulse motion-reduce:animate-none motion-reduce:opacity-70"
          aria-hidden="true"
        />
        <div
          className="h-4 bg-gray-800 rounded w-1/2 animate-pulse motion-reduce:animate-none motion-reduce:opacity-70"
          aria-hidden="true"
        />

        {/* Terminal content placeholder */}
        <div className="flex-1 flex flex-col space-y-3 pt-4">
          <div className="flex space-x-2">
            <div
              className="h-3 bg-gray-700 rounded w-8 animate-pulse motion-reduce:animate-none motion-reduce:opacity-70"
              aria-hidden="true"
            />
            <div
              className="h-3 bg-gray-700 rounded w-64 animate-pulse motion-reduce:animate-none motion-reduce:opacity-70"
              aria-hidden="true"
            />
          </div>
          <div className="flex space-x-2">
            <div
              className="h-3 bg-gray-700 rounded w-8 animate-pulse motion-reduce:animate-none motion-reduce:opacity-70"
              aria-hidden="true"
            />
            <div
              className="h-3 bg-gray-700 rounded w-96 animate-pulse motion-reduce:animate-none motion-reduce:opacity-70"
              aria-hidden="true"
            />
          </div>
          <div className="flex space-x-2">
            <div
              className="h-3 bg-gray-700 rounded w-8 animate-pulse motion-reduce:animate-none motion-reduce:opacity-70"
              aria-hidden="true"
            />
            <div
              className="h-3 bg-gray-700 rounded w-48 animate-pulse motion-reduce:animate-none motion-reduce:opacity-70"
              aria-hidden="true"
            />
          </div>

          {/* Blinking cursor indicator */}
          <div className="flex space-x-2">
            <div
              className="h-3 bg-gray-700 rounded w-8 animate-pulse motion-reduce:animate-none motion-reduce:opacity-70"
              aria-hidden="true"
            />
            <div
              className="h-3 w-2 bg-green-500 rounded animate-pulse motion-reduce:animate-none motion-reduce:opacity-70"
              aria-label="Cursor"
            />
          </div>
        </div>
      </div>

      {/* Loading overlay */}
      <div
        className="absolute inset-0 bg-gray-900/50 flex items-center justify-center"
        role="alert"
        aria-live="assertive"
      >
        <div className="bg-gray-800 rounded-lg p-4 shadow-lg">
          <div className="flex items-center space-x-3">
            <div
              className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 motion-reduce:animate-none motion-reduce:opacity-70"
              aria-hidden="true"
            />
            <span className="text-white">Loading terminal...</span>
          </div>
        </div>
      </div>
    </div>
  )
}
