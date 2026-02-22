'use client'

import { useCallback, useMemo, useState } from 'react'
import { useTheme } from 'next-themes'
import { VisualDiff } from './VisualDiff'
import type { ChangeStatistics } from './DiffControls'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'

type LanguageOption = {
  label: string
  value: string
  original: string
  modified: string
}

const LANGUAGE_OPTIONS: LanguageOption[] = [
  {
    label: 'TypeScript',
    value: 'typescript',
    original: `function greet(name: string) {
  console.log("Hello, " + name)
  return "Hello, " + name
}

const result = greet('World')
console.log(result)
`,
    modified: `function greet(name: string) {
  const message = \`Hello, \${name}!\`
  console.info(message)
  return message
}

const result = greet('World')
console.info('Greeting:', result)
`,
  },
  {
    label: 'JavaScript',
    value: 'javascript',
    original: `function calculateTotal(items) {
  let total = 0
  for (let i = 0; i < items.length; i++) {
    total = total + items[i].price
  }
  return total
}

const items = [
  { name: 'Apple', price: 1.50 },
  { name: 'Banana', price: 0.75 }
]
console.log(calculateTotal(items))
`,
    modified: `function calculateTotal(items) {
  return items.reduce((total, item) => total + item.price, 0)
}

const items = [
  { name: 'Apple', price: 1.50 },
  { name: 'Banana', price: 0.75 },
  { name: 'Orange', price: 2.00 }
]
console.log('Total:', calculateTotal(items))
`,
  },
  {
    label: 'Python',
    value: 'python',
    original: `def fibonacci(n):
    result = []
    a, b = 0, 1
    for i in range(n):
        result.append(a)
        a, b = b, a + b
    return result

print(fibonacci(10))
`,
    modified: `def fibonacci(n: int) -> list[int]:
    """Generate Fibonacci sequence up to n numbers."""
    if n <= 0:
        return []
    if n == 1:
        return [0]

    result = [0, 1]
    while len(result) < n:
        result.append(result[-1] + result[-2])
    return result

# Generate and display first 10 Fibonacci numbers
fib_sequence = fibonacci(10)
print(f"Fibonacci sequence: {fib_sequence}")
`,
  },
  {
    label: 'JSON',
    value: 'json',
    original: `{
  "name": "my-app",
  "version": "1.0.0",
  "dependencies": {
    "react": "^17.0.0",
    "express": "^4.17.0"
  }
}
`,
    modified: `{
  "name": "my-app",
  "version": "2.0.0",
  "description": "A modern web application",
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "express": "^4.18.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0"
  }
}
`,
  },
]

const THEMES = [
  { label: 'Dark', value: 'dark' },
  { label: 'Light', value: 'light' },
] as const

export function VisualDiffPlayground() {
  const { setTheme, theme: currentTheme } = useTheme()
  const [language, setLanguage] = useState<string>(LANGUAGE_OPTIONS[0]!.value)
  const [acceptedCount, setAcceptedCount] = useState(0)
  const [rejectedCount, setRejectedCount] = useState(0)
  const [currentAction, setCurrentAction] = useState<string>('Waiting for action...')

  const selectedExample = useMemo(() => {
    return LANGUAGE_OPTIONS.find((option) => option.value === language) ?? LANGUAGE_OPTIONS[0]!
  }, [language])

  // Calculate statistics based on the example (simplified for demo)
  const statistics: ChangeStatistics = useMemo(() => {
    const original = selectedExample.original
    const modified = selectedExample.modified
    const originalLines = original.split('\n')
    const modifiedLines = modified.split('\n')

    // Simple heuristic: count line differences
    const additions = Math.max(0, modifiedLines.length - originalLines.length)
    const deletions = Math.max(0, originalLines.length - modifiedLines.length)
    const modifications = Math.min(originalLines.length, modifiedLines.length)

    return {
      additions: additions + Math.floor(modifications * 0.3),
      deletions: deletions + Math.floor(modifications * 0.2),
      modifications: Math.floor(modifications * 0.5),
    }
  }, [selectedExample])

  const handleAccept = useCallback(() => {
    setAcceptedCount((prev) => prev + 1)
    setCurrentAction(`✅ Accepted changes (Total: ${acceptedCount + 1})`)
  }, [acceptedCount])

  const handleReject = useCallback(() => {
    setRejectedCount((prev) => prev + 1)
    setCurrentAction(`❌ Rejected changes (Total: ${rejectedCount + 1})`)
  }, [rejectedCount])

  const handleLanguageChange = useCallback((newLanguage: string) => {
    setLanguage(newLanguage)
    setCurrentAction('Language changed - review the new diff')
  }, [])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="space-y-1">
          <Badge variant="secondary" className="w-fit">Powered by Monaco DiffEditor</Badge>
          <CardTitle className="text-2xl">Interactive Diff Viewer</CardTitle>
          <CardDescription>
            Compare code changes side-by-side with full syntax highlighting. Use the controls to accept or reject changes, switch between programming languages, and toggle themes. The component displays real-time statistics about additions, deletions, and modifications.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="diff-language">Language</Label>
              <select
                id="diff-language"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                value={language}
                onChange={(event) => handleLanguageChange(event.target.value)}
              >
                {LANGUAGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="diff-theme">Theme</Label>
              <select
                id="diff-theme"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                value={currentTheme ?? 'system'}
                onChange={(event) => setTheme(event.target.value)}
              >
                <option value="system">System Default</option>
                {THEMES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Action Status</Label>
              <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                <p className="truncate" title={currentAction}>{currentAction}</p>
                <p className="text-xs text-muted-foreground/80">
                  Accepted: {acceptedCount} | Rejected: {rejectedCount}
                </p>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-border shadow-sm" style={{ height: '600px' }}>
            <VisualDiff
              original={selectedExample.original}
              modified={selectedExample.modified}
              language={language}
              height="100%"
              showControls={true}
              onAccept={handleAccept}
              onReject={handleReject}
              statistics={statistics}
              controlsLabel={`Changes in ${selectedExample.label}`}
            />
          </div>

          <div className="rounded-lg border border-dashed border-border/70 bg-muted/40 p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Usage tips</p>
            <ul className="mt-2 list-inside list-disc space-y-1">
              <li>Switch between different programming languages to see syntax highlighting in action</li>
              <li>Use the accept/reject controls to simulate change management workflows</li>
              <li>The diff is side-by-side: original on the left, modified on the right</li>
              <li>Statistics show the breakdown of additions (green), deletions (red), and modifications (gray)</li>
              <li>Theme switching follows your system preferences or can be overridden manually</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
