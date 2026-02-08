'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { ProjectGenerator } from '@/components/ProjectGenerator'

interface AIProjectGeneratorProps {
  initialPrompt?: string
  autoStart?: boolean
}

export function AIProjectGenerator({ initialPrompt, autoStart }: AIProjectGeneratorProps) {
  const router = useRouter()

  const handleComplete = (data: { workspaceId: string; projectName: string }) => {
    router.push(`/workspace/${data.workspaceId}`)
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">AI Project Generator</h1>
        <p className="text-muted-foreground">
          Describe your project and let AI generate the code for you.
        </p>
      </div>

      <ProjectGenerator
        initialPrompt={initialPrompt}
        autoStart={autoStart}
        onComplete={handleComplete}
      />

      <div className="text-center text-xs text-muted-foreground">
        <p>AI-powered code generation</p>
        <p>Powered by <strong>VibeCode AI</strong></p>
      </div>
    </div>
  )
}

export default AIProjectGenerator
