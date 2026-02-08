import { AlertTriangle } from 'lucide-react'

/**
 * Banner indicating a page shows demo/mock data and needs real backend connections.
 * Add this to any page that uses hardcoded data instead of live API calls.
 */
export function DemoBanner() {
  return (
    <div className="mb-4 flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
      <AlertTriangle className="h-5 w-5 flex-shrink-0" />
      <span>
        <strong>Demo Mode:</strong> This page displays sample data. Connect a real backend to see live information.
      </span>
    </div>
  )
}
