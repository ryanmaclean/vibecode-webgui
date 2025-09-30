import { Metadata } from 'next'
import Link from 'next/link'
import { CodeiumPlayground } from '@/components/editors/CodeiumPlayground'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Codeium Monaco Playground',
  description: 'Experiment with Codeium inline completions directly in the browser using our Monaco + monacopilot integration.',
}

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
