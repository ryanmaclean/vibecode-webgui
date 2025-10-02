/**
 * Prompt Interface Loading Skeleton
 * Provides visual feedback while PromptInterface is loading
 */

export function PromptInterfaceSkeleton() {
  return (
    <div className="h-screen flex flex-col bg-background animate-pulse">
      {/* Header skeleton */}
      <div className="border-b border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-64"></div>
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
          </div>
          <div className="flex items-center gap-4">
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-10"></div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Chat panel skeleton */}
        <div className="w-1/3 border-r border-border/50 flex flex-col">
          <div className="p-4 border-b border-border/50">
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-2"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-48"></div>
          </div>

          {/* Messages skeleton */}
          <div className="flex-1 p-4 space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
                <div className={`${i % 2 === 0 ? 'max-w-[80%] mr-12' : 'max-w-[80%] ml-12'} p-4 rounded-lg ${
                  i % 2 === 0 ? 'bg-card border' : 'bg-gray-200 dark:bg-gray-700'
                }`}>
                  <div className="space-y-2">
                    <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-full"></div>
                    <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4"></div>
                    <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-5/6"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Input area skeleton */}
          <div className="border-t border-border/50 p-4">
            <div className="flex gap-2">
              <div className="flex-1 h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div className="h-10 w-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>
          </div>
        </div>

        {/* Preview panel skeleton */}
        <div className="flex-1 flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-border/50">
            <div className="flex items-center gap-4">
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-10"></div>
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-10"></div>
            </div>
          </div>

          {/* Preview content skeleton */}
          <div className="flex-1 p-4 bg-muted/30 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-lg mx-auto mb-4"></div>
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-48 mx-auto mb-2"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-64 mx-auto"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Loading overlay */}
      <div className="absolute inset-0 bg-black/30 flex items-center justify-center pointer-events-none">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-lg" role="status" aria-live="polite">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" aria-hidden="true"></div>
            <span className="text-gray-900 dark:text-white">Loading AI Interface...</span>
          </div>
        </div>
      </div>
    </div>
  )
}
