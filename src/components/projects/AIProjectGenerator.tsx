/**
 * AI Project Generator Component
 * Provides the core Bolt.diy/Lovable/Replit-like experience
 * User describes project → AI generates → Opens in code-server
 * 
 * This is a thin wrapper around the ProjectGenerator component
 * which handles the actual project generation logic.
 */

'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ProjectGenerator } from '@/components/ProjectGenerator'
import { useRouter } from 'next/navigation'

interface AIProjectGeneratorProps {
  /** Additional CSS class names */
  className?: string;
  /** Initial prompt to pre-fill */
  initialPrompt?: string;
  /** Auto-start generation if initialPrompt is provided */
  autoStart?: boolean;
}

/**
 * AI Project Generator component that provides a user interface for
 * generating new projects using AI. Integrates with the ProjectGenerator
 * component for the actual generation logic.
 */
export function AIProjectGenerator({ 
  className = '',
  initialPrompt = '',
  autoStart = false 
}: AIProjectGeneratorProps) {
  const router = useRouter()
  const [isRedirecting, setIsRedirecting] = useState(false)

  /**
   * Handle project generation completion
   * @param data The generated project data
   */
  const handleProjectComplete = (data: { workspaceId: string; projectName: string }) => {
    console.log('Project generation complete:', data)
    
    // Set a small delay before redirecting to show success state
    setIsRedirecting(true)
    setTimeout(() => {
      router.push(`/workspace/${data.workspaceId}`)
    }, 1500)
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="bg-gradient-to-r from-purple-600 to-blue-500 bg-clip-text text-transparent">
            AI Project Generator
          </span>
        </CardTitle>
        <CardDescription>
          Describe your project and let AI generate the code. We&apos;ll set up a complete development environment for you.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ProjectGenerator 
          initialPrompt={initialPrompt}
          autoStart={autoStart}
          onComplete={handleProjectComplete}
        />
        
        <div className="mt-4 text-xs text-muted-foreground text-center">
          <p>AI-powered code generation</p>
          <p className="mt-1">Powered by <span className="font-medium">VibeCode AI</span></p>
        </div>
      </CardContent>
    </Card>
  )
}