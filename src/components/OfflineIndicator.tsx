import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface OfflineIndicatorProps {
  className?: string
}

const OfflineIndicator = React.memo(({ className }: OfflineIndicatorProps) => {
  const [isOnline, setIsOnline] = React.useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  )

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

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Badge
        variant={isOnline ? "default" : "secondary"}
        className={cn(
          isOnline
            ? "bg-green-500 text-white hover:bg-green-600"
            : "bg-yellow-500 text-white hover:bg-yellow-600"
        )}
      >
        {isOnline ? "Online" : "Offline Mode"}
      </Badge>
    </div>
  )
})

OfflineIndicator.displayName = "OfflineIndicator"

export { OfflineIndicator }
