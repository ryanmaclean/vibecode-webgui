'use client'

import React from 'react'
import EnhancedChatInterface from '@/components/chat/EnhancedChatInterface'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const EnhancedChatPlaywrightPage = () => {
  return (
    <div className="min-h-screen bg-muted/20 py-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4">
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">
              Playwright Harness: Enhanced Chat Interface
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              This route renders the <code>EnhancedChatInterface</code> component with minimal props so
              instrumentation tests can exercise streaming behaviors, reduced-motion fallbacks, and
              accessibility affordances.
            </p>
            <p className="font-medium text-primary">
              Automated tests should intercept <code>/api/chat/stream</code> to provide scripted SSE payloads.
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardContent className="p-0">
            <EnhancedChatInterface
              workspaceId="playwright-workspace"
              initialContext={['playwright-notes.md']}
              className="h-[70vh]"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default EnhancedChatPlaywrightPage
