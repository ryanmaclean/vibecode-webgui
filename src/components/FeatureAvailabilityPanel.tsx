import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { FeatureAvailabilityStatus, FeatureStatus } from "@/lib/offline-features"

interface FeatureAvailabilityPanelProps {
  className?: string
}

interface FeatureStatusResponse {
  isOnline: boolean
  isOffline: boolean
  features: FeatureAvailabilityStatus
}

const getStatusColor = (status: FeatureStatus): string => {
  switch (status) {
    case "AVAILABLE":
      return "bg-green-500 text-white hover:bg-green-600"
    case "DEGRADED":
      return "bg-yellow-500 text-white hover:bg-yellow-600"
    case "UNAVAILABLE":
      return "bg-red-500 text-white hover:bg-red-600"
    case "CHECKING":
      return "bg-blue-500 text-white hover:bg-blue-600"
    default:
      return "bg-gray-500 text-white hover:bg-gray-600"
  }
}

const getStatusLabel = (status: FeatureStatus): string => {
  switch (status) {
    case "AVAILABLE":
      return "Available"
    case "DEGRADED":
      return "Degraded"
    case "UNAVAILABLE":
      return "Unavailable"
    case "CHECKING":
      return "Checking..."
    default:
      return "Unknown"
  }
}

const FeatureAvailabilityPanel = React.memo(({ className }: FeatureAvailabilityPanelProps) => {
  const [featureStatus, setFeatureStatus] = React.useState<FeatureAvailabilityStatus | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const fetchFeatureStatus = async () => {
      try {
        setIsLoading(true)
        setError(null)

        const response = await fetch("/api/offline/status")
        if (!response.ok) {
          throw new Error(`Failed to fetch feature status: ${response.statusText}`)
        }

        const data: FeatureStatusResponse = await response.json()
        setFeatureStatus(data.features)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error")
      } finally {
        setIsLoading(false)
      }
    }

    fetchFeatureStatus()

    // Refresh feature status every 30 seconds
    const intervalId = setInterval(fetchFeatureStatus, 30000)

    return () => {
      clearInterval(intervalId)
    }
  }, [])

  if (isLoading) {
    return (
      <div className={cn("w-full", className)} data-testid="feature-availability-panel">
        <Card>
          <CardHeader>
            <CardTitle>Feature Availability</CardTitle>
            <CardDescription>Loading feature status...</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className={cn("w-full", className)} data-testid="feature-availability-panel">
        <Card>
          <CardHeader>
            <CardTitle>Feature Availability</CardTitle>
            <CardDescription className="text-red-500">Error: {error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (!featureStatus) {
    return (
      <div className={cn("w-full", className)} data-testid="feature-availability-panel">
        <Card>
          <CardHeader>
            <CardTitle>Feature Availability</CardTitle>
            <CardDescription>No feature status available</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className={cn("w-full space-y-4", className)} data-testid="feature-availability-panel">
      <Card>
        <CardHeader>
          <CardTitle>Feature Availability</CardTitle>
          <CardDescription>
            {featureStatus.offlineReady
              ? "System is ready for offline operation"
              : "Some features may be limited offline"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* AI Models */}
          <div className="space-y-2" data-testid="ai-feature">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">AI Models</h4>
              <Badge
                variant="secondary"
                className={cn(getStatusColor(featureStatus.ai.status))}
              >
                {getStatusLabel(featureStatus.ai.status)}
              </Badge>
            </div>
            <div className="text-sm text-muted-foreground">
              {featureStatus.ai.ollamaAvailable ? (
                <>
                  <p>Ollama: Running</p>
                  <p>Installed Models: {featureStatus.ai.modelCount}</p>
                  {featureStatus.ai.missingModels.length > 0 && (
                    <p className="text-yellow-600">
                      Missing recommended: {featureStatus.ai.missingModels.join(", ")}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-red-500">Ollama: Not available</p>
              )}
              {featureStatus.ai.error && (
                <p className="text-red-500 text-xs mt-1">{featureStatus.ai.error}</p>
              )}
            </div>
          </div>

          {/* Vector Search */}
          <div className="space-y-2" data-testid="vector-db-feature">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">Vector Search</h4>
              <Badge
                variant="secondary"
                className={cn(getStatusColor(featureStatus.vectorDb.status))}
              >
                {getStatusLabel(featureStatus.vectorDb.status)}
              </Badge>
            </div>
            <div className="text-sm text-muted-foreground">
              {featureStatus.vectorDb.connected ? (
                <>
                  <p>Database: Connected</p>
                  <p>Provider: {featureStatus.vectorDb.provider}</p>
                  <p>
                    pgvector:{" "}
                    {featureStatus.vectorDb.pgVectorInstalled ? "Installed" : "Not installed"}
                  </p>
                </>
              ) : (
                <p className="text-red-500">Database: Not connected</p>
              )}
              {featureStatus.vectorDb.error && (
                <p className="text-red-500 text-xs mt-1">{featureStatus.vectorDb.error}</p>
              )}
            </div>
          </div>

          {/* Cache */}
          <div className="space-y-2" data-testid="cache-feature">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">Cache</h4>
              <Badge
                variant="secondary"
                className={cn(getStatusColor(featureStatus.cache.status))}
              >
                {getStatusLabel(featureStatus.cache.status)}
              </Badge>
            </div>
            <div className="text-sm text-muted-foreground">
              {featureStatus.cache.enabled ? (
                <>
                  <p>Status: Enabled</p>
                  {featureStatus.cache.backend && <p>Backend: {featureStatus.cache.backend}</p>}
                </>
              ) : (
                <p>Status: Disabled</p>
              )}
              {featureStatus.cache.error && (
                <p className="text-red-500 text-xs mt-1">{featureStatus.cache.error}</p>
              )}
            </div>
          </div>

          {/* Templates */}
          <div className="space-y-2" data-testid="templates-feature">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">Templates</h4>
              <Badge
                variant="secondary"
                className={cn(getStatusColor(featureStatus.templates.status))}
              >
                {getStatusLabel(featureStatus.templates.status)}
              </Badge>
            </div>
            <div className="text-sm text-muted-foreground">
              <p>Available Templates: {featureStatus.templates.templateCount}</p>
              <p>Storage: {featureStatus.templates.localOnly ? "Local" : "Remote"}</p>
              {featureStatus.templates.error && (
                <p className="text-red-500 text-xs mt-1">{featureStatus.templates.error}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
})

FeatureAvailabilityPanel.displayName = "FeatureAvailabilityPanel"

export { FeatureAvailabilityPanel }
