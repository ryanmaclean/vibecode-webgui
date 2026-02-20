'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { DatabaseCheckResult, SetupStepStatus } from '@/types/setup'
import { defaultDatabaseCheckResult } from '@/types/setup'

type DatabaseCheckProps = {
  onCheckComplete?: (result: DatabaseCheckResult) => void
  autoCheck?: boolean
}

export function DatabaseCheck({ onCheckComplete, autoCheck = false }: DatabaseCheckProps) {
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState<DatabaseCheckResult>(defaultDatabaseCheckResult)
  const [error, setError] = useState<string | null>(null)

  const checkDatabase = async () => {
    try {
      setChecking(true)
      setError(null)
      setResult({ ...defaultDatabaseCheckResult, status: 'in_progress', message: 'Checking database...' })

      const response = await fetch('/api/setup/database')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to check database')
      }

      if (!data.success) {
        throw new Error(data.error || 'Database check failed')
      }

      const checkResult = data.data as DatabaseCheckResult
      setResult(checkResult)

      if (onCheckComplete) {
        onCheckComplete(checkResult)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(errorMessage)
      setResult({
        status: 'error',
        message: errorMessage,
        initialized: false,
        migrationsComplete: false,
      })
    } finally {
      setChecking(false)
    }
  }

  // Auto-check on mount if enabled
  useEffect(() => {
    if (autoCheck) {
      checkDatabase()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCheck])

  const getStatusBadge = (status: SetupStepStatus) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500 text-white">✓ Ready</Badge>
      case 'warning':
        return <Badge className="bg-yellow-500 text-white">⚠ Warning</Badge>
      case 'error':
        return <Badge variant="destructive">✗ Error</Badge>
      case 'in_progress':
        return <Badge className="bg-blue-500 text-white">Checking...</Badge>
      case 'pending':
      default:
        return <Badge variant="outline">Not Checked</Badge>
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Database</CardTitle>
            <CardDescription>Database connection and initialization status</CardDescription>
          </div>
          {getStatusBadge(result.status)}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm text-foreground">{result.message}</p>

          {result.initialized !== undefined && (
            <p className="text-xs text-muted-foreground">
              Initialized: {result.initialized ? 'Yes' : 'No'}
            </p>
          )}

          {result.migrationsComplete !== undefined && (
            <p className="text-xs text-muted-foreground">
              Migrations: {result.migrationsComplete ? 'Complete' : 'Incomplete'}
            </p>
          )}
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950 p-3">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {result.status === 'error' && !result.initialized && (
          <div className="rounded-md border border-border bg-muted p-3">
            <p className="text-sm font-medium text-foreground mb-2">Next Steps:</p>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
              <li>Check database connection settings in .env</li>
              <li>Ensure database server is running</li>
              <li>Run database migrations if needed</li>
              <li>Click &quot;Check Database&quot; to verify</li>
            </ul>
          </div>
        )}

        {result.status === 'warning' && (
          <div className="rounded-md border border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950 p-3">
            <p className="text-xs text-yellow-700 dark:text-yellow-300">
              Database is connected but some initialization steps may be pending.
            </p>
          </div>
        )}

        <Button
          onClick={checkDatabase}
          disabled={checking}
          className="w-full"
          variant={result.status === 'completed' ? 'outline' : 'default'}
        >
          {checking ? 'Checking...' : result.status === 'completed' ? 'Re-check Database' : 'Check Database'}
        </Button>
      </CardContent>
    </Card>
  )
}
