import { Metadata } from 'next'
import Link from 'next/link'
import { VisualDiffPlayground } from '@/components/editor/VisualDiffPlayground'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Visual Diff Demo',
  description: 'Interactive demonstration of the VisualDiff component with Monaco DiffEditor, showing granular code change management with accept/reject controls.',
}

export default function VisualDiffDemoPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-10">
      <section className="space-y-4">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">Interactive Demo</p>
        <h1 className="text-4xl font-semibold text-foreground">Visual Diff Playground</h1>
        <p className="max-w-3xl text-base text-muted-foreground">
          Explore granular code modification display with the VisualDiff component. Compare code changes side-by-side, view detailed statistics, and use interactive accept/reject controls to manage changes at the hunk level. Built with Monaco DiffEditor for a seamless developer experience.
        </p>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <Button asChild variant="secondary">
            <Link href="https://microsoft.github.io/monaco-editor/" target="_blank" rel="noreferrer">
              Learn about Monaco Editor
            </Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/tools/codeium" rel="noreferrer">
              See Codeium Playground
            </Link>
          </Button>
        </div>
      </section>

      <VisualDiffPlayground />
    </main>
  )
}
