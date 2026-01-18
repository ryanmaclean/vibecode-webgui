/**
 * AgentBuilderWorkflowEmbed
 *
 * Client-side wrapper that lets users connect published Agent Builder workflows
 * via ChatKit using the freshly released Agent Builder + ChatKit beta APIs.
 *
 * Features:
 * - Workflow ID, version, and state variables configuration
 * - Session provisioning via /api/agent-builder/session
 * - Live ChatKit embed with automatic token refresh
 * - Optional ChatKit runtime tweaks (uploads, history, titling)
 */

'use client'

// Import ChatKit types only - the component loads at runtime
import type {} from '@openai/chatkit'

import { useMemo, useState } from 'react'
import { ChatKit, useChatKit, type UseChatKitOptions } from '@openai/chatkit-react'
import { Loader, RefreshCw, Settings } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import type { AgentBuilderSession, AgentBuilderSessionRequest } from '@/types/agent-builder'

export interface AgentBuilderWorkflowEmbedProps {
  initialWorkflowId?: string
}

type NumberInputValue = number | ''

const MAX_SESSION_DURATION_SECONDS = 60 * 60 * 24 // 24 hours constraint from API docs
const MAX_RATE_LIMIT = 1000

export function AgentBuilderWorkflowEmbed({ initialWorkflowId }: AgentBuilderWorkflowEmbedProps) {
  const [workflowId, setWorkflowId] = useState(initialWorkflowId ?? '')
  const [version, setVersion] = useState('')
  const [stateVariablesInput, setStateVariablesInput] = useState('')
  const [expiresInSeconds, setExpiresInSeconds] = useState<NumberInputValue>('')
  const [rateLimitPerMinute, setRateLimitPerMinute] = useState<NumberInputValue>('')
  const [autoTitleEnabled, setAutoTitleEnabled] = useState(true)
  const [uploadsEnabled, setUploadsEnabled] = useState(false)
  const [uploadsMaxFiles, setUploadsMaxFiles] = useState<NumberInputValue>(5)
  const [uploadsMaxSize, setUploadsMaxSize] = useState<NumberInputValue>(50)
  const [historyEnabled, setHistoryEnabled] = useState(true)
  const [historyRecentThreads, setHistoryRecentThreads] = useState<NumberInputValue>('')

  const [config, setConfig] = useState<AgentBuilderSessionRequest | null>(
    initialWorkflowId ? { workflowId: initialWorkflowId } : null
  )
  const [sessionInfo, setSessionInfo] = useState<AgentBuilderSession | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [sessionError, setSessionError] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [nonce, setNonce] = useState(0)

  const chatKitOptions = useMemo<UseChatKitOptions>(() => {
    return {
      api: {
        getClientSecret: async () => {
          if (!config) {
            throw new Error('Configure a workflow to request a session.')
          }

          try {
            const response = await fetch('/api/agent-builder/session', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(config),
            })

            if (!response.ok) {
              const errorPayload = await response.json().catch(() => ({}))
              const message =
                typeof errorPayload?.error === 'string'
                  ? errorPayload.error
                  : 'Failed to create Agent Builder session'
              setSessionError(message)
              throw new Error(message)
            }

            const data: AgentBuilderSession = await response.json()
            setSessionInfo(data)
            setSessionError(null)
            return data.clientSecret
          } catch (error) {
            const message =
              error instanceof Error ? error.message : 'Failed to create Agent Builder session'
            setSessionError(message)
            throw error
          }
        },
      },
      theme: {
        colorScheme: 'dark',
      },
      history: config?.chatkit?.history
        ? {
            enabled: config.chatkit.history.enabled ?? true,
            recentThreads: config.chatkit.history.recentThreads ?? undefined,
          }
        : undefined,
    }
  }, [config, nonce])

  const { control } = useChatKit(chatKitOptions)

  const parseStateVariables = (input: string) => {
    if (!input.trim()) return undefined

    let parsed: unknown
    try {
      parsed = JSON.parse(input)
    } catch (error) {
      throw new Error('State variables must be valid JSON')
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('State variables JSON must be an object with key/value pairs')
    }

    const result: Record<string, string | number | boolean> = {}
    for (const [key, value] of Object.entries(parsed)) {
      const valueType = typeof value
      if (valueType === 'string' || valueType === 'number' || valueType === 'boolean') {
        result[key] = value as string | number | boolean
      } else {
        throw new Error(
          `State variable "${key}" must be a string, number, or boolean (received ${valueType})`
        )
      }
    }

    return result
  }

  const buildChatKitOverrides = (): AgentBuilderSessionRequest['chatkit'] => {
    const overrides: AgentBuilderSessionRequest['chatkit'] = {}
    let hasOverrides = false

    if (!autoTitleEnabled) {
      overrides.automaticThreadTitling = { enabled: false }
      hasOverrides = true
    }

    if (uploadsEnabled) {
      overrides.uploads = {
        enabled: true,
        maxFiles: typeof uploadsMaxFiles === 'number' ? uploadsMaxFiles : undefined,
        maxFileSizeMB: typeof uploadsMaxSize === 'number' ? uploadsMaxSize : undefined,
      }
      hasOverrides = true
    }

    if (!historyEnabled || historyRecentThreads !== '') {
      overrides.history = {
        enabled: historyEnabled,
        recentThreads:
          historyEnabled && typeof historyRecentThreads === 'number'
            ? historyRecentThreads
            : undefined,
      }
      hasOverrides = true
    }

    return hasOverrides ? overrides : undefined
  }

  const handleConnect = async (event: React.FormEvent) => {
    event.preventDefault()
    if (isConnecting) return

    if (!workflowId.trim()) {
      setFormError('Workflow ID is required')
      return
    }

    setIsConnecting(true)
    try {
      const stateVariables = parseStateVariables(stateVariablesInput)
      const sessionConfig: AgentBuilderSessionRequest = {
        workflowId: workflowId.trim(),
        version: version.trim() || undefined,
        stateVariables,
        expiresInSeconds:
          typeof expiresInSeconds === 'number' ? Math.min(expiresInSeconds, MAX_SESSION_DURATION_SECONDS) : undefined,
        rateLimitPerMinute:
          typeof rateLimitPerMinute === 'number' ? Math.min(rateLimitPerMinute, MAX_RATE_LIMIT) : undefined,
        chatkit: buildChatKitOverrides(),
      }

      setConfig(sessionConfig)
      setSessionInfo(null)
      setSessionError(null)
      setFormError(null)
      setNonce((value) => value + 1)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to configure workflow')
    } finally {
      setIsConnecting(false)
    }
  }

  const handleReconnect = () => {
    if (!config) return
    setNonce((value) => value + 1)
    setSessionError(null)
    setSessionInfo(null)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Agent Builder Workflow
          </CardTitle>
          <CardDescription>
            Paste your published workflow ID from Agent Builder to embed ChatKit directly inside
            VibeCode. Configure session behaviour before launching the embedded chat.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleConnect} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="workflowId">Workflow ID</Label>
                <Input
                  id="workflowId"
                  placeholder="wf_xxxxxxxxxxxxxxxxx"
                  value={workflowId}
                  onChange={(event) => setWorkflowId(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="version">Version (optional)</Label>
                <Input
                  id="version"
                  placeholder="latest"
                  value={version}
                  onChange={(event) => setVersion(event.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="stateVariables">State variables (JSON object)</Label>
              <Textarea
                id="stateVariables"
                placeholder='{"topic":"support"}'
                value={stateVariablesInput}
                onChange={(event) => setStateVariablesInput(event.target.value)}
                className="font-mono text-sm"
                rows={4}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="expiresIn">
                  Session expiry (seconds) <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="expiresIn"
                  type="number"
                  min={60}
                  max={MAX_SESSION_DURATION_SECONDS}
                  placeholder="600"
                  value={expiresInSeconds}
                  onChange={(event) =>
                    setExpiresInSeconds(event.target.value ? Number(event.target.value) : '')
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rateLimit">
                  Requests per minute <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="rateLimit"
                  type="number"
                  min={1}
                  max={MAX_RATE_LIMIT}
                  placeholder="10"
                  value={rateLimitPerMinute}
                  onChange={(event) =>
                    setRateLimitPerMinute(event.target.value ? Number(event.target.value) : '')
                  }
                />
              </div>
            </div>

            <Separator />

            <div className="grid gap-4 md:grid-cols-3">
              <div className="flex items-start gap-2">
                <Switch
                  id="autoTitle"
                  checked={autoTitleEnabled}
                  onCheckedChange={(checked) => setAutoTitleEnabled(checked)}
                />
                <div>
                  <Label htmlFor="autoTitle">Automatic thread titles</Label>
                  <p className="text-sm text-muted-foreground">
                    Disable to stop ChatKit from generating thread names.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-start gap-2">
                  <Switch
                    id="uploads"
                    checked={uploadsEnabled}
                    onCheckedChange={(checked) => setUploadsEnabled(checked)}
                  />
                  <div>
                    <Label htmlFor="uploads">Enable uploads</Label>
                    <p className="text-sm text-muted-foreground">
                      Allow end users to upload files into the session.
                    </p>
                  </div>
                </div>
                {uploadsEnabled && (
                  <div className="grid grid-cols-2 gap-2 pl-8">
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={uploadsMaxFiles}
                      onChange={(event) =>
                        setUploadsMaxFiles(event.target.value ? Number(event.target.value) : '')
                      }
                      placeholder="Max files"
                    />
                    <Input
                      type="number"
                      min={1}
                      max={512}
                      value={uploadsMaxSize}
                      onChange={(event) =>
                        setUploadsMaxSize(event.target.value ? Number(event.target.value) : '')
                      }
                      placeholder="Max size MB"
                    />
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-start gap-2">
                  <Switch
                    id="history"
                    checked={historyEnabled}
                    onCheckedChange={(checked) => setHistoryEnabled(checked)}
                  />
                  <div>
                    <Label htmlFor="history">Chat history</Label>
                    <p className="text-sm text-muted-foreground">
                      Control whether previous threads are visible to end users.
                    </p>
                  </div>
                </div>
                {historyEnabled && (
                  <div className="pl-8">
                    <Input
                      type="number"
                      min={1}
                      placeholder="Recent threads (optional)"
                      value={historyRecentThreads}
                      onChange={(event) =>
                        setHistoryRecentThreads(event.target.value ? Number(event.target.value) : '')
                      }
                    />
                  </div>
                )}
              </div>
            </div>

            {formError && (
              <Alert variant="destructive">
                <AlertTitle>Configuration error</AlertTitle>
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={isConnecting}>
                {isConnecting ? (
                  <>
                    <Loader className="mr-2 h-4 w-4 animate-spin" />
                    Configuring…
                  </>
                ) : (
                  'Launch workflow'
                )}
              </Button>
              {config && (
                <Button type="button" variant="outline" onClick={handleReconnect}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh session
                </Button>
              )}
            </div>
          </form>

          {sessionError && (
            <Alert variant="destructive">
              <AlertTitle>Session error</AlertTitle>
              <AlertDescription>{sessionError}</AlertDescription>
            </Alert>
          )}

          {sessionInfo && (
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <Badge variant="outline">Session active</Badge>
              <span>Session ID: {sessionInfo.sessionId}</span>
              <span>
                Expires:{' '}
                {new Date(sessionInfo.expiresAt * 1000).toLocaleString(undefined, {
                  hour: '2-digit',
                  minute: '2-digit',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
              <span>Requests/min: {sessionInfo.maxRequestsPerMinute}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>ChatKit Preview</CardTitle>
          <CardDescription>
            This is the live embed connected to your Agent Builder workflow. Interact to validate
            your agent before rolling it into production.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {config ? (
            <div className="border border-border rounded-lg overflow-hidden">
              <ChatKit key={nonce} control={control} className="h-[600px] w-full bg-card" />
            </div>
          ) : (
            <div className="flex h-[280px] items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground">
              Configure a workflow above to start a ChatKit session.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
