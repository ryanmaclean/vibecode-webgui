/**
 * Monaco Editor Loading Skeleton
 * Provides visual feedback while Monaco Editor is loading
 * WCAG 2.1 AA Compliant with proper ARIA attributes
 */

export function EditorSkeleton() {
  return (
    <div
      className="relative w-full h-full bg-gray-900"
      role="status"
      aria-label="Loading Monaco Editor"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="absolute inset-0 flex flex-col">
        {/* Editor header/toolbar */}
        <div
          className="h-10 bg-gray-800 border-b border-gray-700 flex items-center px-4 space-x-3"
          aria-hidden="true"
        >
          <div className="h-4 bg-gray-700 rounded w-24 animate-pulse motion-reduce:animate-none motion-reduce:opacity-70"></div>
          <div className="h-4 bg-gray-700 rounded w-32 animate-pulse motion-reduce:animate-none motion-reduce:opacity-70"></div>
          <div className="flex-1"></div>
          <div className="h-4 bg-gray-700 rounded w-16 animate-pulse motion-reduce:animate-none motion-reduce:opacity-70"></div>
        </div>

        {/* Line numbers and code area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Line numbers */}
          <div className="w-12 bg-gray-850 border-r border-gray-700 p-2 space-y-2" aria-hidden="true">
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className="h-3 bg-gray-700 rounded w-6 animate-pulse motion-reduce:animate-none motion-reduce:opacity-70"
              ></div>
            ))}
          </div>

          {/* Code content placeholder */}
          <div className="flex-1 p-4 space-y-2" aria-hidden="true">
            <div className="h-3 bg-gray-800 rounded w-3/4 animate-pulse motion-reduce:animate-none motion-reduce:opacity-70"></div>
            <div className="h-3 bg-gray-800 rounded w-full animate-pulse motion-reduce:animate-none motion-reduce:opacity-70"></div>
            <div className="h-3 bg-gray-800 rounded w-5/6 animate-pulse motion-reduce:animate-none motion-reduce:opacity-70"></div>
            <div className="h-3 bg-gray-800 rounded w-full animate-pulse motion-reduce:animate-none motion-reduce:opacity-70"></div>
            <div className="h-3 bg-gray-800 rounded w-2/3 animate-pulse motion-reduce:animate-none motion-reduce:opacity-70"></div>
            <div className="h-3 bg-gray-800 rounded w-11/12 animate-pulse motion-reduce:animate-none motion-reduce:opacity-70"></div>
            <div className="h-3 bg-gray-800 rounded w-3/4 animate-pulse motion-reduce:animate-none motion-reduce:opacity-70"></div>
            <div className="h-3 bg-gray-800 rounded w-full animate-pulse motion-reduce:animate-none motion-reduce:opacity-70"></div>
            <div className="h-3 bg-gray-800 rounded w-4/5 animate-pulse motion-reduce:animate-none motion-reduce:opacity-70"></div>
            <div className="h-3 bg-gray-800 rounded w-full animate-pulse motion-reduce:animate-none motion-reduce:opacity-70"></div>
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
            ></div>
            <span className="text-white">Loading Monaco Editor...</span>
          </div>
        </div>
      </div>
    </div>
  )
}
