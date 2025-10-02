/**
 * Terminal Loading Skeleton
 * Provides visual feedback while terminal components are loading
 */

export function TerminalSkeleton() {
  return (
    <div className="relative w-full h-full bg-gray-900 animate-pulse">
      <div className="absolute inset-0 flex flex-col p-4 space-y-2">
        {/* Terminal header lines */}
        <div className="h-4 bg-gray-800 rounded w-3/4"></div>
        <div className="h-4 bg-gray-800 rounded w-1/2"></div>

        {/* Terminal content placeholder */}
        <div className="flex-1 flex flex-col space-y-3 pt-4">
          <div className="flex space-x-2">
            <div className="h-3 bg-gray-700 rounded w-8"></div>
            <div className="h-3 bg-gray-700 rounded w-64"></div>
          </div>
          <div className="flex space-x-2">
            <div className="h-3 bg-gray-700 rounded w-8"></div>
            <div className="h-3 bg-gray-700 rounded w-96"></div>
          </div>
          <div className="flex space-x-2">
            <div className="h-3 bg-gray-700 rounded w-8"></div>
            <div className="h-3 bg-gray-700 rounded w-48"></div>
          </div>

          {/* Blinking cursor indicator */}
          <div className="flex space-x-2">
            <div className="h-3 bg-gray-700 rounded w-8"></div>
            <div className="h-3 w-2 bg-green-500 rounded animate-pulse"></div>
          </div>
        </div>
      </div>

      {/* Loading overlay */}
      <div className="absolute inset-0 bg-gray-900/50 flex items-center justify-center">
        <div className="bg-gray-800 rounded-lg p-4 shadow-lg">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="text-white">Loading terminal...</span>
          </div>
        </div>
      </div>
    </div>
  )
}
