'use client'

import React, { useState, useEffect } from 'react'
import { useProjectGenerator, UseProjectGeneratorOptions } from '@/hooks/useProjectGenerator'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'

export interface ProjectGeneratorProps {
  initialPrompt?: string
  autoStart?: boolean
  onComplete?: (data: { workspaceId: string; projectName: string }) => void
}

export function ProjectGenerator({
  initialPrompt = '',
  autoStart = false,
  onComplete,
}: ProjectGeneratorProps) {
  const [prompt, setPrompt] = useState(initialPrompt)

  const {
    isGenerating,
    progress,
    generateProject,
    cancelGeneration,
    updateProgress,
    handleComplete,
  } = useProjectGenerator({ onComplete })

  useEffect(() => {
    if (autoStart && initialPrompt) {
      generateProject(initialPrompt, {})
    }
  }, [autoStart, initialPrompt, generateProject])

  const handleGenerate = () => {
    if (prompt.trim()) {
      generateProject(prompt, {})
    }
  }

  const statusLabel =
    progress.status.charAt(0).toUpperCase() + progress.status.slice(1)

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          data-testid="prompt-input"
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe your project..."
          disabled={isGenerating}
          className="flex-1 rounded border px-3 py-2"
        />
        <Button
          data-testid="generate-button"
          onClick={handleGenerate}
          disabled={isGenerating || !prompt.trim()}
        >
          Generate
        </Button>
      </div>

      {progress.status !== 'idle' && progress.status !== 'error' && (
        <div className="space-y-2">
          <div className="text-sm font-medium">{statusLabel}</div>
          <div className="text-sm text-muted-foreground">{progress.message}</div>

          {typeof progress.progress === 'number' && progress.progress > 0 && (
            <Progress value={progress.progress} className="h-2" />
          )}
        </div>
      )}

      {isGenerating && (
        <Button variant="outline" onClick={cancelGeneration}>
          Cancel
        </Button>
      )}

      {progress.status === 'error' && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{progress.message}</AlertDescription>
          {progress.recoveryOptions && (
            <div className="mt-2 flex gap-2">
              {progress.recoveryOptions.map((opt) => (
                <Button key={opt.action} variant="outline" size="sm">
                  {opt.label}
                </Button>
              ))}
            </div>
          )}
        </Alert>
      )}
    </div>
  )
}
