'use client'

import Link from 'next/link'
import CodeiumPlayground from '@/components/editors/CodeiumPlayground'

export default function CodeiumToolPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-10">
      <div className="space-y-3">
        <p className="text-sm font-medium uppercase tracking-wide text-primary">AI coding playground</p>
        <h1 className="text-3xl font-semibold text-foreground md:text-4xl">Codeium Autocomplete Playground</h1>
        <p className="max-w-3xl text-base text-muted-foreground">
          Experiment with Codeium&apos;s React code editor—an AI-powered extension of Monaco with realtime autocomplete. Choose your language, tweak the
          theme, and watch suggestions flow without configuring API keys. You can also provide neighboring documents to improve the context of completions.
        </p>
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <span>
            Need more details?&nbsp;
            <Link className="text-primary underline-offset-4 hover:underline" href="https://github.com/Exafunction/codeium-react-code-editor" target="_blank" rel="noreferrer">
              Visit the Codeium React Code Editor repository
            </Link>
          </span>
        </div>
      </div>

      <CodeiumPlayground />

      <div className="rounded-xl border border-border bg-muted/40 p-6 text-sm text-muted-foreground">
        <h2 className="mb-2 text-base font-semibold text-foreground">Tips</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Accept completions with <kbd className="rounded bg-muted px-1 text-xs">Tab</kbd>. Undo suggestions with <kbd className="rounded bg-muted px-1 text-xs">Esc</kbd>.
          </li>
          <li>
            Provide contextual files (like HTML snippets) to improve suggestions via the &ldquo;Include HTML context&rdquo; toggle.
          </li>
          <li>
            The editor honours Monaco options—try turning off format-on-type or switching to the light theme for accessibility testing.
          </li>
        </ul>
      </div>
    </div>
  )
}
