'use client'

import Link from 'next/link'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'

const CodeiumPlayground = dynamic(
  () => import('@/components/editors/CodeiumPlayground').then((mod) => ({ default: mod.CodeiumPlayground })),
  {
    ssr: true,
    loading: () => (
      <div className="h-full w-full flex items-center justify-center bg-background" style={{ minHeight: '600px' }}>
        <div className="space-y-4 text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-muted border-t-primary" />
          <p className="text-sm text-muted-foreground">Loading playground…</p>
        </div>
      </div>
    ),
  }
)

export default function CodeiumPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-10">
      <section className="space-y-4">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">AI Coding Playground</p>
        <h1 className="text-4xl font-semibold text-foreground">Codeium Autocomplete Playground</h1>
        <p className="max-w-3xl text-base text-muted-foreground">
          Explore Codeium&apos;s lightning-fast AI autocompletion right in the browser. This playground reuses our existing monacopilot wiring, so the completions
          you see here match what developers get inside the IDE. No API keys or setup required.
        </p>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <Button asChild variant="secondary">
            <Link href="https://github.com/Exafunction/codeium-react-code-editor" target="_blank" rel="noreferrer">
              View Codeium React Code Editor on GitHub
            </Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="https://codeium.com" target="_blank" rel="noreferrer">
              Learn more about Codeium
            </Link>
          </Button>
        </div>
      </section>

      <CodeiumPlayground />
    </main>
  )
}
