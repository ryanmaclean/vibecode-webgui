'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { KubernetesCheckResult, SetupStepStatus } from '@/types/setup'
import { defaultKubernetesCheckResult } from '@/types/setup'

type KubernetesCheckProps = {
  onCheckComplete?: (result: KubernetesCheckResult) => void
  autoCheck?: boolean
}

export function KubernetesCheck({ onCheckComplete, autoCheck = false }: KubernetesCheckProps) {
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState<KubernetesCheckResult>(defaultKubernetesCheckResult)
  const [error, setError] = useState<string | null>(null)

  const checkKubernetes = async () => {
    try {
      setChecking(true)
      setError(null)
      setResult({ ...defaultKubernetesCheckResult, status: 'in_progress', message: 'Checking Kubernetes...' })

      const response = await fetch('/api/setup/kubernetes')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to check Kubernetes')
      }

      if (!data.success) {
        throw new Error(data.error || 'Kubernetes check failed')
      }

      const checkResult = data.data as KubernetesCheckResult
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
        connected: false,
      })
    } finally {
      setChecking(false)
    }
  }

  // Auto-check on mount if enabled
  useState(() => {
    if (autoCheck) {
      checkKubernetes()
    }
  })

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
            <CardTitle>Kubernetes</CardTitle>
            <CardDescription>Cluster orchestration for development environments</CardDescription>
          </div>
          {getStatusBadge(result.status)}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm text-foreground">{result.message}</p>

          {result.version && (
            <p className="text-xs text-muted-foreground">Version: {result.version}</p>
          )}

          {result.clusterName && (
            <p className="text-xs text-muted-foreground">Cluster: {result.clusterName}</p>
          )}

          {result.connected !== undefined && (
            <p className="text-xs text-muted-foreground">
              Status: {result.connected ? 'Connected' : 'Not connected'}
            </p>
          )}
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950 p-3">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {result.status === 'error' && !result.connected && (
          <div className="rounded-md border border-border bg-muted p-3">
            <p className="text-sm font-medium text-foreground mb-2">Next Steps:</p>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
              <li>Install kubectl and a local cluster (minikube, k3d, or kind)</li>
              <li>Start your Kubernetes cluster</li>
              <li>Configure your kubeconfig file</li>
              <li>Click &quot;Check Kubernetes&quot; to verify</li>
            </ul>
          </div>
        )}

        {result.status === 'warning' && (
          <div className="rounded-md border border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950 p-3">
            <p className="text-xs text-yellow-700 dark:text-yellow-300">
              Consider upgrading to Kubernetes 1.24+ for optimal compatibility.
            </p>
          </div>
        )}

        <Button
          onClick={checkKubernetes}
          disabled={checking}
          className="w-full"
          variant={result.status === 'completed' ? 'outline' : 'default'}
        >
          {checking ? 'Checking...' : result.status === 'completed' ? 'Re-check Kubernetes' : 'Check Kubernetes'}
        </Button>
      </CardContent>
    </Card>
  )
}
