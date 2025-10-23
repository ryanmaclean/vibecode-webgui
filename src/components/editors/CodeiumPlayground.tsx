'use client'

import { useCallback, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import type { editor as EditorNS } from 'monaco-editor'
import { setupMonacopilot } from '@/lib/monaco/monacopilot-integration'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
// import { logger } from '@/lib/logger';
const MonacoEditor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[480px] w-full items-center justify-center rounded-lg border border-dashed border-muted-foreground/40 bg-muted/30">
      <span className="text-sm text-muted-foreground">Loading Monaco editor…</span>
    </div>
  ),
})

type LanguageOption = {
  label: string
  value: string
  sample: string
}

const LANGUAGE_OPTIONS: LanguageOption[] = [
  {
    label: 'TypeScript',
    value: 'typescript',
    sample: `function greet(name: string) {
  const message = ` + '`Hello, ${name}!`' + `
  logger.info(message)
  return message
}

greet('Codeium')
`,
  },
  {
    label: 'Python',
    value: 'python',
    sample: `def fibonacci(n: int) -> list[int]:
    sequence = [0, 1]
    while len(sequence) < n:
        sequence.append(sequence[-1] + sequence[-2])
    return sequence

print(fibonacci(10))
`,
  },
  {
    label: 'Go',
    value: 'go',
    sample: `package main

import "fmt"
func fibonacci(n int) []int {
    seq := []int{0, 1}
    for len(seq) < n {
        seq = append(seq, seq[len(seq)-1]+seq[len(seq)-2])
    }
    return seq
}

func main() {
    fmt.Println(fibonacci(10))
}
`,
  },
]

const THEMES = [
  { label: 'Dark (VS)', value: 'vs-dark' },
  { label: 'Light (VS)', value: 'vs' },
] as const

export function CodeiumPlayground() {
  const [language, setLanguage] = useState<string>(LANGUAGE_OPTIONS[0]!.value)
  const [theme, setTheme] = useState<(typeof THEMES)[number]['value']>('vs-dark')
  const [status, setStatus] = useState('Setting up Monaco…')
  const [apiStatus, setApiStatus] = useState('Checking Codeium backend…')
  const [lastSuggestion, setLastSuggestion] = useState<string | null>(null)

  const sample = useMemo(() => {
    return LANGUAGE_OPTIONS.find((option) => option.value === language)?.sample ?? ''
  }, [language])

  const handleMount = useCallback(
    async (editorInstance: EditorNS.IStandaloneCodeEditor, monaco: typeof import('monaco-editor')) => {
      setStatus('Monaco ready (v0.53.0)')

      try {
        setupMonacopilot(monaco as any, editorInstance, {
          endpoint: '/api/code-completion',
          language,
          debug: false,
        })
        setStatus('✅ Codeium autocomplete ready')
      } catch (error) {
        setStatus(`⚠️ Failed to initialise Codeium: ${(error as Error).message}`)
      }
    },
    [language]
  )

  const handleValidate = useCallback(() => {
    fetch('/api/code-completion')
      .then(async (response) => {
        if (!response.ok) throw new Error(`${response.status}`)
        const body = await response.json()
        setApiStatus(`✅ ${body.provider ?? 'Codeium'} (${body.model ?? 'codestral'}) online`)
      })
      .catch((error: Error) => {
        setApiStatus(`⚠️ Unable to reach Codeium API: ${error.message}`)
      })
  }, [])

  const handleChange = useCallback((value?: string) => {
    if (value && value !== lastSuggestion) {
      setLastSuggestion(value)
    }
  }, [lastSuggestion])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="space-y-1">
          <Badge variant="secondary" className="w-fit">Powered by Codeium</Badge>
          <CardTitle className="text-2xl">Interactive Monaco Playground</CardTitle>
          <CardDescription>
            Try Codeium&apos;s instant autocomplete inside the browser. Start typing to see inline suggestions powered by our existing monacopilot integration.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="codeium-language">Language</Label>
              <select
                id="codeium-language"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
              >
                {LANGUAGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="codeium-theme">Theme</Label>
              <select
                id="codeium-theme"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                value={theme}
                onChange={(event) => setTheme(event.target.value as (typeof THEMES)[number]['value'])}
              >
                {THEMES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                <p>{status}</p>
                <button
                  className="mt-1 text-xs text-primary underline-offset-4 hover:underline"
                  type="button"
                  onClick={handleValidate}
                >
                  Re-check API connection
                </button>
                <p className="text-xs text-muted-foreground/80">{apiStatus}</p>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-border shadow-sm">
            <MonacoEditor
              height="480px"
              language={language}
              value={sample}
              theme={theme}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                smoothScrolling: true,
                cursorBlinking: 'smooth',
              }}
              onMount={handleMount}
              onChange={handleChange}
            />
          </div>

          <div className="rounded-lg border border-dashed border-border/70 bg-muted/40 p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Usage tips</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Type a function signature (for example, <code className="rounded bg-muted px-1">function greet</code>) and pause a moment for Codeium to propose completion. Accept with <kbd className="rounded bg-muted px-1">Tab</kbd>.</li>
              <li>Switch languages to see language-aware completions. Samples reset automatically, but you can clear the buffer to start fresh.</li>
              <li>Use the API status checker if suggestions stop appearing—this hits our `/api/code-completion` endpoint.</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
