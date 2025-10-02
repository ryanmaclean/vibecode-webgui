/**
 * Monaco Editor Loading Skeleton
 * Provides visual feedback while Monaco Editor is loading
 */

export function EditorSkeleton() {
  return (
    <div className="relative w-full h-full bg-gray-900 animate-pulse">
      <div className="absolute inset-0 flex flex-col">
        {/* Editor header/toolbar */}
        <div className="h-10 bg-gray-800 border-b border-gray-700 flex items-center px-4 space-x-3">
          <div className="h-4 bg-gray-700 rounded w-24"></div>
          <div className="h-4 bg-gray-700 rounded w-32"></div>
          <div className="flex-1"></div>
          <div className="h-4 bg-gray-700 rounded w-16"></div>
        </div>

        {/* Line numbers and code area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Line numbers */}
          <div className="w-12 bg-gray-850 border-r border-gray-700 p-2 space-y-2">
            {[...Array(20)].map((_, i) => (
              <div key={i} className="h-3 bg-gray-700 rounded w-6"></div>
            ))}
          </div>

          {/* Code content placeholder */}
          <div className="flex-1 p-4 space-y-2">
            <div className="h-3 bg-gray-800 rounded w-3/4"></div>
            <div className="h-3 bg-gray-800 rounded w-full"></div>
            <div className="h-3 bg-gray-800 rounded w-5/6"></div>
            <div className="h-3 bg-gray-800 rounded w-full"></div>
            <div className="h-3 bg-gray-800 rounded w-2/3"></div>
            <div className="h-3 bg-gray-800 rounded w-11/12"></div>
            <div className="h-3 bg-gray-800 rounded w-3/4"></div>
            <div className="h-3 bg-gray-800 rounded w-full"></div>
            <div className="h-3 bg-gray-800 rounded w-4/5"></div>
            <div className="h-3 bg-gray-800 rounded w-full"></div>
          </div>
        </div>
      </div>

      {/* Loading overlay */}
      <div className="absolute inset-0 bg-gray-900/50 flex items-center justify-center">
        <div className="bg-gray-800 rounded-lg p-4 shadow-lg" role="status" aria-live="polite">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" aria-hidden="true"></div>
            <span className="text-white">Loading Monaco Editor...</span>
          </div>
        </div>
      </div>
    </div>
  )
}
