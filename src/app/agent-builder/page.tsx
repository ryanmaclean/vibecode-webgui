/**
 * Agent Builder Integration Page
 *
 * Authenticated workspace that surfaces the new Agent Builder + ChatKit workflow embed.
 */

'use client'

import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { AgentBuilderWorkflowEmbed } from '@/components/agents'

const DEFAULT_WORKFLOW_ID = 'wf_68e54ea7658881908de665bb5150f59303c9a0d16d9151e9'

export default function AgentBuilderPage() {
  const { isAuthenticated, isLoading, user } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background to-muted text-center px-6">
        <h1 className="text-3xl font-bold text-foreground mb-2">Agent Builder requires sign-in</h1>
        <p className="text-muted-foreground mb-6 max-w-md">
          Sign in to provision ChatKit sessions and embed Agent Builder workflows inside VibeCode.
        </p>
        <div className="flex gap-3">
          <Link href="/auth/signin">
            <Button>Sign in</Button>
          </Link>
          <Link href="/auth/register">
            <Button variant="outline">Create account</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Agent Builder</h1>
            <p className="text-sm text-muted-foreground">
              Manage OpenAI Agent Builder workflows and preview them with ChatKit.
            </p>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>{user?.name || user?.email}</span>
            <Link href="/" className="text-primary hover:underline">
              Back to dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <AgentBuilderWorkflowEmbed initialWorkflowId={DEFAULT_WORKFLOW_ID} />
      </main>
    </div>
  )
}
