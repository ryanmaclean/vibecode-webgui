import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface OfflineIndicatorProps {
  className?: string
}

interface FeatureAvailability {
  name: string
  available: boolean
  description: string
}

const FEATURE_AVAILABILITY: FeatureAvailability[] = [
  { name: "Browse Local Files", available: true, description: "Access cached files" },
  { name: "View Organizations", available: true, description: "View cached organization data" },
  { name: "View Projects", available: true, description: "View cached project data" },
  { name: "Create Tasks", available: false, description: "Requires server connection" },
  { name: "Sync Data", available: false, description: "Requires server connection" },
  { name: "Real-time Updates", available: false, description: "Requires server connection" },
]

const OfflineIndicator = React.memo(({ className }: OfflineIndicatorProps) => {
  const [isOnline, setIsOnline] = React.useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  )
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false)
  const dropdownRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }

    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isDropdownOpen])

  const handleBadgeClick = () => {
    setIsDropdownOpen(!isDropdownOpen)
  }

  return (
    <div className={cn("relative flex items-center gap-2", className)} data-testid="offline-indicator" ref={dropdownRef}>
      <Badge
        variant={isOnline ? "default" : "secondary"}
        className={cn(
          "cursor-pointer transition-all",
          isOnline
            ? "bg-green-500 text-white hover:bg-green-600"
            : "bg-yellow-500 text-white hover:bg-yellow-600"
        )}
        onClick={handleBadgeClick}
      >
        {isOnline ? "Online" : "Offline Mode"}
        <span className="ml-1 text-xs">▼</span>
      </Badge>

      {isDropdownOpen && (
        <div
          className={cn(
            "absolute top-full right-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50",
            "dark:bg-gray-800 dark:border-gray-700"
          )}
          data-testid="feature-availability-dropdown"
        >
          <div className="p-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">
              Feature Availability
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {isOnline ? "All features available" : "Limited features in offline mode"}
            </p>
          </div>

          <div className="p-2 max-h-64 overflow-y-auto">
            {FEATURE_AVAILABILITY.map((feature) => {
              const isAvailable = isOnline || feature.available
              return (
                <div
                  key={feature.name}
                  className={cn(
                    "flex items-start gap-3 p-2 rounded-md",
                    "hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  )}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    <div
                      className={cn(
                        "w-2 h-2 rounded-full",
                        isAvailable
                          ? "bg-green-500"
                          : "bg-gray-300 dark:bg-gray-600"
                      )}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "text-sm font-medium",
                      isAvailable
                        ? "text-gray-900 dark:text-gray-100"
                        : "text-gray-400 dark:text-gray-500"
                    )}>
                      {feature.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {feature.description}
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    <span
                      className={cn(
                        "text-xs px-2 py-0.5 rounded",
                        isAvailable
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                      )}
                    >
                      {isAvailable ? "Available" : "Unavailable"}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
})

OfflineIndicator.displayName = "OfflineIndicator"

export { OfflineIndicator }
