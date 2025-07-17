import { useQuery } from '@tanstack/react-query'
import { healthApi } from '../services/api'
import { CheckCircle, AlertCircle, XCircle, Loader } from 'lucide-react'

export function StatusIndicator() {
  const { data: health, isLoading } = useQuery({
    queryKey: ['health'],
    queryFn: healthApi.getDetailedHealth,
    refetchInterval: 30000, // 30 seconds
    retry: false
  })

  if (isLoading) {
    return (
      <div className="flex items-center gap-x-2">
        <Loader className="h-4 w-4 animate-spin text-gray-400" />
        <span className="text-sm text-gray-500">Checking...</span>
      </div>
    )
  }

  if (!health) {
    return (
      <div className="flex items-center gap-x-2">
        <XCircle className="h-4 w-4 text-red-500" />
        <span className="text-sm text-red-600">Offline</span>
      </div>
    )
  }

  const isHealthy = health.status === 'healthy'
  const hasWarnings = Object.values(health.checks || {}).some(
    (check: any) => check.status === 'warning'
  )

  return (
    <div className="flex items-center gap-x-2">
      {isHealthy ? (
        hasWarnings ? (
          <>
            <AlertCircle className="h-4 w-4 text-yellow-500" />
            <span className="text-sm text-yellow-600">Warning</span>
          </>
        ) : (
          <>
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span className="text-sm text-green-600">Healthy</span>
          </>
        )
      ) : (
        <>
          <XCircle className="h-4 w-4 text-red-500" />
          <span className="text-sm text-red-600">Unhealthy</span>
        </>
      )}
    </div>
  )
}
