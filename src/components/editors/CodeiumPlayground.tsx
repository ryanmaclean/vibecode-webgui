'use client'

import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { Document, Language } from '@codeium/react-code-editor'
import clsx from 'clsx'

const CodeiumEditor = dynamic(() => import('@codeium/react-code-editor').then(mod => mod.CodeiumEditor), {
  ssr: false,
  loading: () => (
    <div className="flex h-96 w-full items-center justify-center rounded-md border border-dashed border-muted-foreground/40 bg-muted/30">
      <span className="text-sm text-muted-foreground">Loading Codeium Editor…</span>
    </div>
  ),
})

const SAMPLE_SNIPPET = `function greet(name) {
  const message = ` + '`Hello, ${name}!`' + `
  console.log(message)
  return message
}

greet('Codeium')
`

const HTML_CONTEXT = `<html>
  <body>
    <main>
      <h1>Welcome to the Codeium playground</h1>
      <section id="output"></section>
    </main>
  </body>
</html>`

const SUPPORTED_LANGUAGES = [
  { label: 'TypeScript', value: 'typescript' },
  { label: 'JavaScript', value: 'javascript' },
  { label: 'Python', value: 'python' },
  { label: 'Go', value: 'go' },
  { label: 'Rust', value: 'rust' }
] as const

const THEMES = [
  { label: 'VS Dark', value: 'vs-dark' },
  { label: 'VS Light', value: 'vs' }
] as const

const themeClassName = 'flex h-10 w-full items-center rounded-md border border-input bg-background px-3 text-sm'

export default function CodeiumPlayground() {
  const [language, setLanguage] = useState<(typeof SUPPORTED_LANGUAGES)[number]['value']>('typescript')
  const [theme, setTheme] = useState<(typeof THEMES)[number]['value']>('vs-dark')
  const [autoFormat, setAutoFormat] = useState(true)
  const [value, setValue] = useState(SAMPLE_SNIPPET)
  const [useHtmlContext, setUseHtmlContext] = useState(true)

  const contextDocuments = useMemo(() => {
    if (!useHtmlContext) return undefined

    return [
      new Document({
        absolutePath: '/app/index.html',
        relativePath: 'index.html',
        text: HTML_CONTEXT,
        editorLanguage: 'html',
        language: Language.HTML,
      }),
    ]
  }, [useHtmlContext])

  return (
    <div className="space-y-6">
      <div className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row">
          <div className="flex w-full flex-col gap-2 lg:max-w-xs">
            <label className="text-sm font-medium text-foreground">Language</label>
            <select
              className={themeClassName}
              value={language}
              onChange={(event) => setLanguage(event.target.value as typeof language)}
            >
              {SUPPORTED_LANGUAGES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex w-full flex-col gap-2 lg:max-w-xs">
            <label className="text-sm font-medium text-foreground">Theme</label>
            <select
              className={themeClassName}
              value={theme}
              onChange={(event) => setTheme(event.target.value as typeof theme)}
            >
              {THEMES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex w-full flex-wrap items-center gap-3 lg:max-w-xs lg:flex-nowrap">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                checked={autoFormat}
                onChange={(event) => setAutoFormat(event.target.checked)}
              />
              Format on type
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                checked={useHtmlContext}
                onChange={(event) => setUseHtmlContext(event.target.checked)}
              />
              Include HTML context
            </label>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Codeium autocompletion works out of the box—type inside the editor and accept suggestions with <kbd className="rounded bg-muted px-1 text-xs">Tab</kbd>. Toggle
          contextual documents to see richer completions.
        </p>
      </div>

      <div className={clsx('overflow-hidden rounded-xl border border-border shadow-sm', 'bg-[#1e1e1e] text-white')}>
        <CodeiumEditor
          height="500px"
          language={language}
          theme={theme}
          path={`/playground/example.${language === 'javascript' ? 'js' : language}`}
          value={value}
          onChange={(nextValue) => setValue(nextValue ?? '')}
          options={{ formatOnType: autoFormat, minimap: { enabled: false } }}
          otherDocuments={contextDocuments}
        />
      </div>
    </div>
  )
}
