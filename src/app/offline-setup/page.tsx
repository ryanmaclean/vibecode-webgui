/**
 * Offline Setup Page
 *
 * Guide users through setting up Ollama for offline/air-gapped coding.
 * Shows Ollama status, installed models, and recommended models for offline use.
 */

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ollamaClient, OFFLINE_CODING_MODELS, type OfflineReadinessStatus } from '@/lib/ollama-client'

interface ModelCardProps {
  model: string
  size: number
  description: string
  installed: boolean
  recommended: boolean
  onInstall?: () => void
  installing?: boolean
}

function ModelCard({ model, size, description, installed, recommended, onInstall, installing }: ModelCardProps) {
  const sizeFormatted = ollamaClient.formatModelSize(size)

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-foreground">{model}</h3>
            {recommended && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                Recommended
              </span>
            )}
            {installed && (
              <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-500">
                Installed
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          <p className="mt-1 text-xs text-muted-foreground">Size: {sizeFormatted}</p>
        </div>
        {!installed && onInstall && (
          <Button
            size="sm"
            onClick={onInstall}
            disabled={installing}
            className="whitespace-nowrap"
          >
            {installing ? 'Installing...' : 'Install'}
          </Button>
        )}
      </div>
    </div>
  )
}

export default function OfflineSetupPage() {
  const [status, setStatus] = useState<OfflineReadinessStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [installingModel, setInstallingModel] = useState<string | null>(null)

  const checkStatus = async () => {
    try {
      setLoading(true)
      setError(null)
      const readiness = await ollamaClient.checkOfflineReadiness()
      setStatus(readiness)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check Ollama status')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    checkStatus()
  }, [])

  const handleInstallModel = async (modelName: string) => {
    try {
      setInstallingModel(modelName)
      await ollamaClient.pullModel(modelName, (progress) => {
        // Could show progress here in the future
      })
      // Refresh status after installation
      await checkStatus()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to install model')
    } finally {
      setInstallingModel(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Offline Setup</h1>
            <p className="text-sm text-muted-foreground">
              Configure local AI models for air-gapped and offline coding with Ollama.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={checkStatus}
              disabled={loading}
            >
              Refresh Status
            </Button>
            <Link href="/" className="text-sm text-primary hover:underline">
              Back to dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {/* Status Overview */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-foreground mb-4">Ollama Status</h2>
          <div className="rounded-lg border border-border bg-card p-6">
            {error ? (
              <div className="text-sm text-destructive">
                <p className="font-semibold mb-2">Error:</p>
                <p>{error}</p>
              </div>
            ) : status ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className={`h-3 w-3 rounded-full ${status.ollamaAvailable ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="text-sm font-medium text-foreground">
                    Ollama Service: {status.ollamaAvailable ? 'Running' : 'Not Available'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div className={`h-3 w-3 rounded-full ${status.checks.hasModels ? 'bg-green-500' : 'bg-yellow-500'}`} />
                  <span className="text-sm font-medium text-foreground">
                    Installed Models: {status.installedModels.length}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div className={`h-3 w-3 rounded-full ${status.ready ? 'bg-green-500' : 'bg-yellow-500'}`} />
                  <span className="text-sm font-medium text-foreground">
                    Offline Ready: {status.ready ? 'Yes' : 'No'}
                  </span>
                </div>

                {status.totalDiskUsage > 0 && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium">Disk Usage:</span> {status.diskUsageSummary.used}
                    </p>
                    {status.estimatedDiskNeeded > 0 && (
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium">Additional Space Needed:</span> {status.diskUsageSummary.needed}
                      </p>
                    )}
                  </div>
                )}

                {/* Recommendations */}
                {status.recommendations.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <p className="text-sm font-semibold text-foreground mb-2">Recommendations:</p>
                    <ul className="space-y-1">
                      {status.recommendations.map((rec, idx) => (
                        <li key={idx} className="text-sm text-muted-foreground">
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </section>

        {/* Ollama Not Available Message */}
        {status && !status.ollamaAvailable && (
          <section className="mb-8">
            <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-6">
              <h3 className="text-lg font-semibold text-foreground mb-2">Ollama Not Detected</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Ollama is required for offline AI-powered coding. Install it to enable local model support.
              </p>
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Installation Steps:</p>
                <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground ml-2">
                  <li>Visit <a href="https://ollama.ai" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">ollama.ai</a> to download</li>
                  <li>Install Ollama for your operating system</li>
                  <li>Start the Ollama service (it usually starts automatically)</li>
                  <li>Return here and click "Refresh Status"</li>
                </ol>
              </div>
            </div>
          </section>
        )}

        {/* Recommended Models */}
        {status && status.ollamaAvailable && (
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">Recommended Models</h2>
            <p className="text-sm text-muted-foreground mb-4">
              These models are optimized for offline coding. Install at least one to get started.
            </p>
            <div className="space-y-3">
              {OFFLINE_CODING_MODELS.map((model) => {
                const installed = status.installedModels.some(
                  (name) => name === model.model || name.startsWith(model.model.split(':')[0])
                )
                return (
                  <ModelCard
                    key={model.model}
                    model={model.model}
                    size={model.size}
                    description={model.description}
                    installed={installed}
                    recommended={model.recommended}
                    onInstall={() => handleInstallModel(model.model)}
                    installing={installingModel === model.model}
                  />
                )
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
