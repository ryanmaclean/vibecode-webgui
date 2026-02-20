'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { AIKeysCheckResult, SetupStepStatus } from '@/types/setup'
import { defaultAIKeysCheckResult } from '@/types/setup'

type AIKeysCheckProps = {
  onCheckComplete?: (result: AIKeysCheckResult) => void
  autoCheck?: boolean
}

export function AIKeysCheck({ onCheckComplete, autoCheck = false }: AIKeysCheckProps) {
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState<AIKeysCheckResult>(defaultAIKeysCheckResult)
  const [error, setError] = useState<string | null>(null)

  const checkAIKeys = async () => {
    try {
      setChecking(true)
      setError(null)
      setResult({ ...defaultAIKeysCheckResult, status: 'in_progress', message: 'Checking AI keys...' })

      const response = await fetch('/api/setup/ai-keys')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to check AI keys')
      }

      if (!data.success) {
        throw new Error(data.error || 'AI keys check failed')
      }

      const checkResult = data.data as AIKeysCheckResult
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
      })
    } finally {
      setChecking(false)
    }
  }

  // Auto-check on mount if enabled
  useState(() => {
    if (autoCheck) {
      checkAIKeys()
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
            <CardTitle>AI Keys</CardTitle>
            <CardDescription>API keys for AI providers (OpenAI, Anthropic, etc.)</CardDescription>
          </div>
          {getStatusBadge(result.status)}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm text-foreground">{result.message}</p>

          {result.validKeys && result.validKeys.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-foreground">Valid Keys:</p>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                {result.validKeys.map((key) => (
                  <li key={key}>{key}</li>
                ))}
              </ul>
            </div>
          )}

          {result.missingKeys && result.missingKeys.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-foreground">Missing Keys:</p>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                {result.missingKeys.map((key) => (
                  <li key={key}>{key}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950 p-3">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {result.status === 'error' && result.missingKeys && result.missingKeys.length > 0 && (
          <div className="rounded-md border border-border bg-muted p-3">
            <p className="text-sm font-medium text-foreground mb-2">Next Steps:</p>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
              <li>Add missing API keys to your .env file</li>
              <li>Ensure keys are properly configured</li>
              <li>Click &quot;Check AI Keys&quot; to verify</li>
            </ul>
          </div>
        )}

        {result.status === 'warning' && (
          <div className="rounded-md border border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950 p-3">
            <p className="text-xs text-yellow-700 dark:text-yellow-300">
              Some AI providers are not configured. You can add them later if needed.
            </p>
          </div>
        )}

        <Button
          onClick={checkAIKeys}
          disabled={checking}
          className="w-full"
          variant={result.status === 'completed' ? 'outline' : 'default'}
        >
          {checking ? 'Checking...' : result.status === 'completed' ? 'Re-check AI Keys' : 'Check AI Keys'}
        </Button>
      </CardContent>
    </Card>
  )
}
