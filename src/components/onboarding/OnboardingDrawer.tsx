'use client'

import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { useUserPreferences } from '@/providers/UserPreferencesProvider'

const cliEditors = [
  { label: 'Vim', value: 'vim' },
  { label: 'Neovim', value: 'neovim' },
  { label: 'code-server', value: 'code-server' },
]

const recommendedExtensions = [
  { name: 'Codeium', id: 'codeium.codeium' },
  { name: 'ESLint', id: 'dbaeumer.vscode-eslint' },
  { name: 'Datadog', id: 'datadog.datadog-vscode' },
]

const integrations = [
  { id: 'github', label: 'GitHub' },
  { id: 'gitlab', label: 'GitLab' },
  { id: 'linear', label: 'Linear' },
  { id: 'jira', label: 'Jira' },
  { id: 'openai', label: 'OpenAI' },
  { id: 'anthropic', label: 'Anthropic' },
]

type Preferences = {
  theme: 'light' | 'dark'
  cliEditor: string
  integrations: Record<string, boolean>
}

type OnboardingDrawerProps = {
  open: boolean
  onClose: () => void
}

export function OnboardingDrawer({ open, onClose }: OnboardingDrawerProps) {
  const { preferences, save, isLoading, error } = useUserPreferences()
  const [saving, setSaving] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const integrationState = useMemo(() => {
    const base = integrations.reduce((acc, item) => {
      acc[item.id] = false
      return acc
    }, {} as Record<string, boolean>)
    return {
      ...base,
      ...(preferences.integrations ?? {}),
    }
  }, [preferences.integrations])

  const mergedPreferences: Preferences = {
    theme: preferences.theme === 'auto' ? 'dark' : preferences.theme,
    cliEditor: preferences.cliEditor,
    integrations: integrationState,
  }

  const handleUpdate = async (updates: Partial<Preferences>) => {
    try {
      setSaving(true)
      setLocalError(null)
      await save({
        theme: updates.theme ?? preferences.theme,
        preferredIde: preferences.preferredIde,
        extensions: preferences.extensions,
        integrations: updates.integrations ?? preferences.integrations,
        aiProviders: preferences.aiProviders,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update preferences'
      setLocalError(message)
    } finally {
      setSaving(false)
    }
  }

  const integrationsComplete = useMemo(() => {
    return integrations.every((item) => mergedPreferences.integrations[item.id])
  }, [mergedPreferences.integrations])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} aria-hidden="true" />
      <aside className="relative w-full max-w-md overflow-y-auto border-l border-border bg-card shadow-xl">
        <header className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur p-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Welcome to VibeCode</h2>
            <p className="text-sm text-muted-foreground">
              Tweak your workspace and connect the services you rely on every day.
            </p>
            {(error || localError) && (
              <p className="text-xs text-red-500">{localError ?? error}</p>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close onboarding">
            ✕
          </Button>
        </header>

        <div className="space-y-6 p-6 pb-24">
          <Card>
            <CardHeader>
              <CardTitle>Theme</CardTitle>
              <CardDescription>Select the default appearance for the dashboard.</CardDescription>
            </CardHeader>
            <CardContent className="flex gap-4">
              {(['light', 'dark'] as const).map((value) => (
                <Button
                  key={value}
                  variant={mergedPreferences.theme === value ? 'default' : 'outline'}
                  onClick={() => handleUpdate({ theme: value })}
                  className="flex-1"
                  disabled={saving || isLoading}
                >
                  {value === 'light' ? 'Light' : 'Dark'}
                </Button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>CLI Editor Preference</CardTitle>
              <CardDescription>We&apos;ll tailor future tips for your favourite terminal editor.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Label htmlFor="cli-editor" className="text-sm text-muted-foreground">Editor</Label>
              <select
                id="cli-editor"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={mergedPreferences.cliEditor}
                onChange={(event) => handleUpdate({ cliEditor: event.target.value })}
                disabled={saving || isLoading}
              >
                <option value="">Select an editor</option>
                {cliEditors.map((editor) => (
                  <option key={editor.value} value={editor.value}>
                    {editor.label}
                  </option>
                ))}
              </select>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recommended Extensions</CardTitle>
              <CardDescription>Install these VS Code extensions to match the VibeCode stack.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {recommendedExtensions.map((ext) => (
                <div key={ext.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">{ext.name}</p>
                    <p className="text-xs text-muted-foreground">{ext.id}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigator.clipboard.writeText(`vscode:extension/${ext.id}`)}
                  >
                    Copy
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Integrations</CardTitle>
              <CardDescription>Track which services you&apos;ve connected.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {integrations.map((item) => (
                <label key={item.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                      checked={mergedPreferences.integrations[item.id]}
                      onChange={(event) =>
                        handleUpdate({
                          integrations: {
                            ...mergedPreferences.integrations,
                            [item.id]: event.target.checked,
                          },
                        })
                      }
                      disabled={saving || isLoading}
                    />
                    <span className="text-sm text-foreground">{item.label}</span>
                  </div>
                  <Button variant="ghost" size="sm" asChild>
                    <a
                      href={`https://docs.vibecode.ai/integrations/${item.id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Setup
                    </a>
                  </Button>
                </label>
              ))}
              {!integrationsComplete && (
                <p className="text-xs text-muted-foreground">
                  Check each integration off once you&apos;ve connected the account or API key.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Badge variant="secondary">
                <a href="/tools/codeium" className="no-underline">Codeium Playground</a>
              </Badge>
              <Badge variant="secondary">
                <a href="/console" className="no-underline">AI Console</a>
              </Badge>
              <Badge variant="secondary">
                <a href="/docs/logs/AGENT_ACTIVITY_LOG.md" target="_blank" rel="noreferrer" className="no-underline">
                  Activity Log
                </a>
              </Badge>
              <Badge variant="secondary">
                <a href="https://github.com/ryanmaclean/vibecode-webgui" target="_blank" rel="noreferrer" className="no-underline">
                  GitHub
                </a>
              </Badge>
            </CardContent>
          </Card>
        </div>
      </aside>
    </div>
  )
}
