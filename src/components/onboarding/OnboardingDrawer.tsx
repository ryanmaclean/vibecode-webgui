'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTheme } from 'next-themes'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'

const LOCAL_STORAGE_KEY = 'vibecode-onboarding/preferences'

const cliEditors = [
  { label: 'Vim', value: 'vim' },
  { label: 'Neovim', value: 'neovim' },
  { label: 'Emacs', value: 'emacs' },
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

const defaultPreferences: Preferences = {
  theme: 'dark',
  cliEditor: '',
  integrations: integrations.reduce((acc, item) => {
    acc[item.id] = false
    return acc
  }, {} as Record<string, boolean>),
}

type OnboardingDrawerProps = {
  open: boolean
  onClose: () => void
}

export function OnboardingDrawer({ open, onClose }: OnboardingDrawerProps) {
  const { theme, setTheme } = useTheme()
  const [preferences, setPreferences] = useState<Preferences>(defaultPreferences)

  useEffect(() => {
    if (!open) return

    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        setPreferences({
          ...defaultPreferences,
          ...parsed,
          integrations: {
            ...defaultPreferences.integrations,
            ...(parsed.integrations || {}),
          },
        })
      } else if (theme === 'light' || theme === 'dark') {
        setPreferences((prev) => ({ ...prev, theme }))
      }
    } catch (error) {
      console.warn('Failed to read onboarding preferences', error)
    }
  }, [open, theme])

  useEffect(() => {
    if (!open) return
    setTheme(preferences.theme)
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(preferences))
  }, [open, preferences, setTheme])

  const integrationsComplete = useMemo(() => {
    return integrations.every((item) => preferences.integrations[item.id])
  }, [preferences.integrations])

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
                  variant={preferences.theme === value ? 'default' : 'outline'}
                  onClick={() => setPreferences((prev) => ({ ...prev, theme: value }))}
                  className="flex-1"
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
                value={preferences.cliEditor}
                onChange={(event) =>
                  setPreferences((prev) => ({ ...prev, cliEditor: event.target.value }))
                }
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
                      checked={preferences.integrations[item.id]}
                      onChange={(event) =>
                        setPreferences((prev) => ({
                          ...prev,
                          integrations: {
                            ...prev.integrations,
                            [item.id]: event.target.checked,
                          },
                        }))
                      }
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
              <Badge asChild variant="secondary">
                <a href="/tools/codeium">Codeium Playground</a>
              </Badge>
              <Badge asChild variant="secondary">
                <a href="/console">AI Console</a>
              </Badge>
              <Badge asChild variant="secondary">
                <a href="/docs/logs/AGENT_ACTIVITY_LOG.md" target="_blank" rel="noreferrer">
                  Activity Log
                </a>
              </Badge>
              <Badge asChild variant="secondary">
                <a href="https://github.com/ryanmaclean/vibecode-webgui" target="_blank" rel="noreferrer">
                  GitHub Repo
                </a>
              </Badge>
            </CardContent>
          </Card>
        </div>
      </aside>
    </div>
  )
}
